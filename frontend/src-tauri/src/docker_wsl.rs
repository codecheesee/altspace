use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const PROBE_TIMEOUT: Duration = Duration::from_millis(3000);
const ACTION_TIMEOUT: Duration = Duration::from_secs(12);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WslDistro {
    pub name: String,
    pub state: String,
    pub version: u8,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WslOverview {
    pub installed: bool,
    pub distros: Vec<WslDistro>,
    pub running_distros_count: usize,
    pub vmmem_detected: bool,
    pub vmmem_ram_mb: Option<u64>,
    pub default_distro: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DockerContainer {
    pub id: String,
    pub names: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub ports: String,
    pub compose_project: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerOverview {
    pub installed: bool,
    pub daemon_running: bool,
    pub error_message: Option<String>,
    pub containers: Vec<DockerContainer>,
    pub running_count: usize,
    pub stopped_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentCockpitData {
    pub wsl: WslOverview,
    pub docker: DockerOverview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CockpitActionResult {
    pub success: bool,
    pub message: String,
    pub stdout: Option<String>,
}

/// Decodes standard UTF-8 or Windows UTF-16LE CLI output.
pub fn decode_process_output(raw_bytes: &[u8]) -> String {
    if raw_bytes.is_empty() {
        return String::new();
    }

    // Detect UTF-16LE by BOM (0xFF, 0xFE) or interleaved null bytes in the first few bytes
    let is_utf16_le = (raw_bytes.len() >= 2 && raw_bytes[0] == 0xFF && raw_bytes[1] == 0xFE)
        || (raw_bytes.len() >= 2 && raw_bytes[1] == 0 && raw_bytes[0] != 0);

    if is_utf16_le {
        let offset = if raw_bytes.len() >= 2 && raw_bytes[0] == 0xFF && raw_bytes[1] == 0xFE {
            2
        } else {
            0
        };
        let u16_slice: Vec<u16> = raw_bytes[offset..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        String::from_utf16_lossy(&u16_slice)
            .replace('\0', "")
            .trim()
            .to_string()
    } else {
        String::from_utf8_lossy(raw_bytes).trim().to_string()
    }
}

/// Strict sanitizer for container IDs, names, and distro identifiers.
/// Must be non-empty, alphanumeric / dash / underscore / dot, max 128 chars, and cannot start with '-'.
pub fn sanitize_identifier(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err("Identifier must be between 1 and 128 characters".into());
    }
    if trimmed.starts_with('-') {
        return Err("Identifier cannot begin with a dash to prevent flag injection".into());
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return Err("Identifier contains illegal characters (only alphanumeric, _, -, . allowed)".into());
    }
    Ok(trimmed.to_string())
}

/// Runs a command with a strict timeout and no window creation.
pub fn run_command_with_timeout(
    program: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<String, String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn {}: {}", program, e))?;

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let output = child.wait_with_output();
        let _ = tx.send(output);
    });

    match rx.recv_timeout(timeout) {
        Ok(Ok(output)) => {
            let stdout_str = decode_process_output(&output.stdout);
            let stderr_str = decode_process_output(&output.stderr);
            if output.status.success() {
                Ok(stdout_str)
            } else {
                let err_msg = if !stderr_str.is_empty() {
                    stderr_str
                } else if !stdout_str.is_empty() {
                    stdout_str
                } else {
                    format!("Process exited with status code {:?}", output.status.code())
                };
                Err(err_msg)
            }
        }
        Ok(Err(e)) => Err(format!("Error waiting for {}: {}", program, e)),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            Err(format!("{} command timed out after {:?}", program, timeout))
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("Command worker thread disconnected prematurely".into())
        }
    }
}

/// Inspects Windows processes to check if vmmem or vmmemWSL is active and returns its working set.
pub fn get_vmmem_memory_usage() -> (bool, Option<u64>) {
    unsafe {
        let snapshot = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            Ok(handle) => handle,
            Err(_) => return (false, None),
        };

        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut vmmem_found = false;
        let mut target_pid: Option<u32> = None;

        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let nul_pos = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..nul_pos]).to_lowercase();

                if name.starts_with("vmmem") {
                    vmmem_found = true;
                    target_pid = Some(entry.th32ProcessID);
                    break;
                }

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = windows::Win32::Foundation::CloseHandle(snapshot);

        if let Some(pid) = target_pid {
            // Read working set memory using tasklist / powershell or fallback estimation
            // For fast read, run lightweight tasklist filter
            if let Ok(output) = run_command_with_timeout(
                "tasklist.exe",
                &["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"],
                Duration::from_millis(1500),
            ) {
                // Parse CSV: "vmmemWSL.exe","1234","Console","1","524,288 K"
                for line in output.lines() {
                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 5 {
                        let mem_str = parts[4].replace('\"', "").replace(" K", "").replace(" KB", "").replace(',', "");
                        if let Ok(kb) = mem_str.trim().parse::<u64>() {
                            return (true, Some(kb / 1024));
                        }
                    }
                }
            }
            return (true, None);
        }

        (vmmem_found, None)
    }
}

/// Parses the output lines of `wsl.exe -l -v`.
pub fn parse_wsl_list_output(output: &str) -> Vec<WslDistro> {
    let mut distros = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.to_uppercase().starts_with("NAME") {
            continue;
        }

        let is_default = trimmed.starts_with('*');
        let content = if is_default {
            trimmed.trim_start_matches('*').trim()
        } else {
            trimmed
        };

        let tokens: Vec<&str> = content.split_whitespace().collect();
        if tokens.len() >= 3 {
            let name = tokens[0].to_string();
            let state = tokens[1].to_string();
            let version = tokens[2].parse::<u8>().unwrap_or(2);

            distros.push(WslDistro {
                name,
                state,
                version,
                is_default,
            });
        }
    }

    distros
}

/// Inspects WSL distributions and RAM usage.
pub fn get_wsl_overview() -> WslOverview {
    let (vmmem_detected, vmmem_ram_mb) = get_vmmem_memory_usage();

    match run_command_with_timeout("wsl.exe", &["-l", "-v"], PROBE_TIMEOUT) {
        Ok(stdout) => {
            let distros = parse_wsl_list_output(&stdout);
            let running_distros_count = distros.iter().filter(|d| d.state.eq_ignore_ascii_case("running")).count();
            let default_distro = distros.iter().find(|d| d.is_default).map(|d| d.name.clone());

            WslOverview {
                installed: true,
                distros,
                running_distros_count,
                vmmem_detected,
                vmmem_ram_mb,
                default_distro,
            }
        }
        Err(_) => WslOverview {
            installed: false,
            distros: Vec::new(),
            running_distros_count: 0,
            vmmem_detected,
            vmmem_ram_mb,
            default_distro: None,
        },
    }
}

/// Raw docker ps JSON structure from `docker ps -a --format "{{json .}}"`
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct DockerJsonLine {
    #[serde(rename = "ID")]
    id: Option<String>,
    names: Option<String>,
    image: Option<String>,
    status: Option<String>,
    state: Option<String>,
    ports: Option<String>,
    labels: Option<String>,
}

/// Parses a single JSON line from `docker ps --format "{{json .}}"`.
pub fn parse_docker_container_line(line: &str) -> Option<DockerContainer> {
    let trimmed = line.trim();
    if trimmed.is_empty() || !trimmed.starts_with('{') {
        return None;
    }

    if let Ok(parsed) = serde_json::from_str::<DockerJsonLine>(trimmed) {
        let id = parsed.id.unwrap_or_default();
        let names = parsed.names.unwrap_or_default();
        let image = parsed.image.unwrap_or_default();
        let status = parsed.status.unwrap_or_default();
        let state = parsed.state.unwrap_or_else(|| {
            if status.to_lowercase().starts_with("up") {
                "running".to_string()
            } else {
                "stopped".to_string()
            }
        });
        let ports = parsed.ports.unwrap_or_default();

        // Extract Compose project from Labels (e.g. com.docker.compose.project=myapp)
        let compose_project = parsed.labels.and_then(|lbls| {
            for part in lbls.split(',') {
                let kv: Vec<&str> = part.split('=').collect();
                if kv.len() == 2 && kv[0].trim() == "com.docker.compose.project" {
                    return Some(kv[1].trim().to_string());
                }
            }
            None
        });

        return Some(DockerContainer {
            id,
            names,
            image,
            status,
            state,
            ports,
            compose_project,
        });
    }

    None
}

/// Inspects Docker containers and daemon status.
pub fn get_docker_overview() -> DockerOverview {
    match run_command_with_timeout("docker.exe", &["ps", "-a", "--format", "{{json .}}"], PROBE_TIMEOUT) {
        Ok(stdout) => {
            let mut containers = Vec::new();
            for line in stdout.lines() {
                if let Some(c) = parse_docker_container_line(line) {
                    containers.push(c);
                }
            }

            let running_count = containers.iter().filter(|c| c.state.eq_ignore_ascii_case("running")).count();
            let stopped_count = containers.len().saturating_sub(running_count);

            DockerOverview {
                installed: true,
                daemon_running: true,
                error_message: None,
                containers,
                running_count,
                stopped_count,
            }
        }
        Err(err_msg) => {
            let not_installed = err_msg.contains("Failed to spawn docker.exe");
            let daemon_down = err_msg.contains("pipe/docker_engine")
                || err_msg.contains("daemon is running")
                || err_msg.contains("connection refused")
                || err_msg.contains("timed out");

            let friendly_err = if not_installed {
                "Docker CLI is not installed or not in PATH".to_string()
            } else if daemon_down {
                "Docker Desktop daemon is offline. Click to launch Docker Desktop.".to_string()
            } else {
                err_msg
            };

            DockerOverview {
                installed: !not_installed,
                daemon_running: false,
                error_message: Some(friendly_err),
                containers: Vec::new(),
                running_count: 0,
                stopped_count: 0,
            }
        }
    }
}

/// Full snapshot of both WSL and Docker environments.
pub fn get_environment_cockpit_snapshot() -> EnvironmentCockpitData {
    let wsl = get_wsl_overview();
    let docker = get_docker_overview();

    EnvironmentCockpitData { wsl, docker }
}

/// Executes safe container action (start | stop | restart).
pub fn docker_action(container_id: &str, action: &str) -> CockpitActionResult {
    let clean_id = match sanitize_identifier(container_id) {
        Ok(id) => id,
        Err(e) => return CockpitActionResult { success: false, message: e, stdout: None },
    };

    let valid_actions = ["start", "stop", "restart"];
    let clean_action = action.trim().to_lowercase();
    if !valid_actions.contains(&clean_action.as_str()) {
        return CockpitActionResult {
            success: false,
            message: format!("Invalid docker action '{}'. Must be start, stop, or restart", action),
            stdout: None,
        };
    }

    match run_command_with_timeout("docker.exe", &[&clean_action, &clean_id], ACTION_TIMEOUT) {
        Ok(stdout) => CockpitActionResult {
            success: true,
            message: format!("Successfully ran '{}' on container {}", clean_action, clean_id),
            stdout: Some(stdout),
        },
        Err(err) => CockpitActionResult {
            success: false,
            message: format!("Docker {} failed: {}", clean_action, err),
            stdout: None,
        },
    }
}

/// Retrieves the last N lines of logs for a container safely.
pub fn docker_logs(container_id: &str, tail: u32) -> Result<String, String> {
    let clean_id = sanitize_identifier(container_id)?;
    let tail_str = tail.clamp(10, 500).to_string();

    run_command_with_timeout("docker.exe", &["logs", "--tail", &tail_str, &clean_id], PROBE_TIMEOUT)
}

/// Reclaims WSL RAM by executing `wsl.exe --shutdown`.
pub fn wsl_shutdown() -> CockpitActionResult {
    match run_command_with_timeout("wsl.exe", &["--shutdown"], ACTION_TIMEOUT) {
        Ok(stdout) => CockpitActionResult {
            success: true,
            message: "WSL virtual machine shut down successfully. VMMem RAM reclaimed.".into(),
            stdout: Some(stdout),
        },
        Err(err) => CockpitActionResult {
            success: false,
            message: format!("WSL shutdown failed: {}", err),
            stdout: None,
        },
    }
}

/// Terminates a specific WSL distribution.
pub fn wsl_terminate(distro_name: &str) -> CockpitActionResult {
    let clean_name = match sanitize_identifier(distro_name) {
        Ok(name) => name,
        Err(e) => return CockpitActionResult { success: false, message: e, stdout: None },
    };

    match run_command_with_timeout("wsl.exe", &["-t", &clean_name], ACTION_TIMEOUT) {
        Ok(stdout) => CockpitActionResult {
            success: true,
            message: format!("WSL distribution '{}' terminated successfully.", clean_name),
            stdout: Some(stdout),
        },
        Err(err) => CockpitActionResult {
            success: false,
            message: format!("WSL terminate failed for '{}': {}", clean_name, err),
            stdout: None,
        },
    }
}

/// Spawns an interactive shell inside a container using Windows Terminal or PowerShell.
pub fn docker_open_shell(container_id: &str) -> Result<String, String> {
    let clean_id = sanitize_identifier(container_id)?;

    // Try Windows Terminal wt.exe first, fallback to powershell
    let wt_result = Command::new("wt.exe")
        .args(["-w", "0", "docker", "exec", "-it", &clean_id, "sh"])
        .spawn();

    if wt_result.is_ok() {
        return Ok(format!("Opened interactive shell for {} in Windows Terminal", clean_id));
    }

    Command::new("powershell.exe")
        .args(["-NoExit", "-Command", &format!("docker exec -it {} sh", clean_id)])
        .spawn()
        .map_err(|e| format!("Failed to spawn shell terminal: {}", e))?;

    Ok(format!("Opened interactive shell for {} in PowerShell", clean_id))
}

/// Spawns an interactive shell for a WSL distribution.
pub fn wsl_launch_shell(distro_name: &str) -> Result<String, String> {
    let clean_name = sanitize_identifier(distro_name)?;

    let wt_result = Command::new("wt.exe")
        .args(["-w", "0", "wsl.exe", "-d", &clean_name])
        .spawn();

    if wt_result.is_ok() {
        return Ok(format!("Launched WSL distribution '{}' in Windows Terminal", clean_name));
    }

    Command::new("powershell.exe")
        .args(["-NoExit", "-Command", &format!("wsl.exe -d {}", clean_name)])
        .spawn()
        .map_err(|e| format!("Failed to spawn WSL terminal: {}", e))?;

    Ok(format!("Launched WSL distribution '{}' in PowerShell", clean_name))
}

/// Attempts to start the Docker Desktop application if present.
pub fn start_docker_desktop() -> Result<String, String> {
    let default_paths = [
        r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
        r"C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe",
    ];

    for path in default_paths {
        if PathBuf::from(path).exists() {
            Command::new(path)
                .spawn()
                .map_err(|e| format!("Failed to launch Docker Desktop: {}", e))?;
            return Ok("Launching Docker Desktop...".into());
        }
    }

    Err("Docker Desktop executable not found in default installation directories".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_identifier_valid() {
        assert_eq!(sanitize_identifier("my-web-app").unwrap(), "my-web-app");
        assert_eq!(sanitize_identifier("postgres_16").unwrap(), "postgres_16");
        assert_eq!(sanitize_identifier("Ubuntu-22.04").unwrap(), "Ubuntu-22.04");
        assert_eq!(sanitize_identifier("a1b2c3d4e5f6").unwrap(), "a1b2c3d4e5f6");
    }

    #[test]
    fn test_sanitize_identifier_rejects_flags_and_injection() {
        assert!(sanitize_identifier("-it").is_err());
        assert!(sanitize_identifier("--privileged").is_err());
        assert!(sanitize_identifier("container; rm -rf /").is_err());
        assert!(sanitize_identifier("app & echo hacked").is_err());
        assert!(sanitize_identifier("").is_err());
    }

    #[test]
    fn test_decode_process_output_utf8_and_utf16() {
        // UTF-8 test
        let utf8_sample = b"hello world";
        assert_eq!(decode_process_output(utf8_sample), "hello world");

        // UTF-16LE test (as produced by wsl.exe)
        let utf16_sample: Vec<u8> = "Ubuntu\nStopped\n2"
            .encode_utf16()
            .flat_map(|u| u.to_le_bytes())
            .collect();
        assert_eq!(decode_process_output(&utf16_sample), "Ubuntu\nStopped\n2");
    }

    #[test]
    fn test_parse_wsl_list_output() {
        let sample = "  NAME      STATE           VERSION\n* Ubuntu    Running         2\n  Debian    Stopped         1\n";
        let distros = parse_wsl_list_output(sample);

        assert_eq!(distros.len(), 2);
        assert_eq!(distros[0].name, "Ubuntu");
        assert_eq!(distros[0].state, "Running");
        assert_eq!(distros[0].version, 2);
        assert!(distros[0].is_default);

        assert_eq!(distros[1].name, "Debian");
        assert_eq!(distros[1].state, "Stopped");
        assert_eq!(distros[1].version, 1);
        assert!(!distros[1].is_default);
    }

    #[test]
    fn test_parse_docker_container_line() {
        let line = r#"{"ID":"a1b2c3d4e5f6","Names":"altspace-redis","Image":"redis:alpine","State":"running","Status":"Up 3 hours","Ports":"0.0.0.0:6379->6379/tcp","Labels":"com.docker.compose.project=altspace,maintainer=dev"}"#;
        let container = parse_docker_container_line(line).expect("Should parse container");

        assert_eq!(container.id, "a1b2c3d4e5f6");
        assert_eq!(container.names, "altspace-redis");
        assert_eq!(container.image, "redis:alpine");
        assert_eq!(container.state, "running");
        assert_eq!(container.status, "Up 3 hours");
        assert_eq!(container.ports, "0.0.0.0:6379->6379/tcp");
        assert_eq!(container.compose_project.as_deref(), Some("altspace"));
    }
}
