use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use windows::Win32::Foundation::{CloseHandle, NO_ERROR};
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, MIB_TCP6TABLE_OWNER_PID, MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_ALL,
};
use windows::Win32::Networking::WinSock::{AF_INET, AF_INET6};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};

/// TCP_STATE_LISTEN = 2 per iphlpapi.h / MIB_TCP_STATE_LISTEN
const TCP_STATE_LISTEN: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProcess {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSnapshot {
    pub pid: u32,
    pub name: String,
    pub parent_pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProcessForensics {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub parent_pid: Option<u32>,
    pub parent_name: Option<String>,
    pub command_line: Option<String>,
    pub executable_path: Option<String>,
    pub project_hint: Option<String>,
    pub is_wsl_or_docker: bool,
    pub is_protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillVerifyResult {
    pub success: bool,
    pub port: u16,
    pub pid: u32,
    pub verified_free: bool,
    pub elapsed_ms: u64,
    pub message: String,
}

// Map PIDs to Process Snapshot using Windows Toolhelp snapshot
pub fn get_process_tree_map() -> HashMap<u32, ProcessSnapshot> {
    let mut map = HashMap::new();
    unsafe {
        if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };

            if Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    let name = String::from_utf16_lossy(
                        &entry.szExeFile[..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len())],
                    );
                    map.insert(
                        entry.th32ProcessID,
                        ProcessSnapshot {
                            pid: entry.th32ProcessID,
                            name,
                            parent_pid: entry.th32ParentProcessID,
                        },
                    );
                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snapshot);
        }
    }
    map
}

// Map PIDs to Process Names using Windows Toolhelp snapshot
pub fn get_process_names() -> HashMap<u32, String> {
    get_process_tree_map()
        .into_iter()
        .map(|(pid, p)| (pid, p.name))
        .collect()
}

// Retrieve listening TCP ports and their owning processes
pub fn get_listening_ports() -> Vec<PortProcess> {
    let process_map = get_process_names();
    let mut ports = Vec::new();

    unsafe {
        let mut size = 0u32;
        // Step 1: query required buffer size
        let _ = GetExtendedTcpTable(
            None,
            &mut size,
            true,
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );

        if size == 0 {
            return ports;
        }

        let mut buffer = vec![0u8; size as usize];
        let res = GetExtendedTcpTable(
            Some(buffer.as_mut_ptr() as *mut _),
            &mut size,
            true,
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );

        if res == NO_ERROR.0 {
            let table = &*(buffer.as_ptr() as *const MIB_TCPTABLE_OWNER_PID);
            let num_entries = table.dwNumEntries as usize;
            let rows_ptr = table.table.as_ptr();

            for i in 0..num_entries {
                let row = &*rows_ptr.add(i);
                // dwState 2 is MIB_TCP_STATE_LISTEN (Listening)
                if row.dwState == TCP_STATE_LISTEN {
                    // dwLocalPort is stored in network byte order (big endian)
                    let port = u16::from_be((row.dwLocalPort & 0xFFFF) as u16);
                    let pid = row.dwOwningPid;
                    let process_name = process_map
                        .get(&pid)
                        .cloned()
                        .unwrap_or_else(|| format!("PID {}", pid));

                    ports.push(PortProcess {
                        port,
                        pid,
                        process_name,
                        state: "LISTENING".into(),
                    });
                }
            }
        }
    }

    ports.sort_by_key(|p| p.port);
    ports.dedup_by_key(|p| (p.port, p.pid));

    // Step 2: IPv6 listening ports scan
    unsafe {
        let mut size6 = 0u32;
        let _ = GetExtendedTcpTable(
            None,
            &mut size6,
            true,
            AF_INET6.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );

        if size6 > 0 {
            let mut buffer6 = vec![0u8; size6 as usize];
            let res6 = GetExtendedTcpTable(
                Some(buffer6.as_mut_ptr() as *mut _),
                &mut size6,
                true,
                AF_INET6.0 as u32,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            );

            if res6 == NO_ERROR.0 {
                let table6 = &*(buffer6.as_ptr() as *const MIB_TCP6TABLE_OWNER_PID);
                let num_entries = table6.dwNumEntries as usize;
                let rows_ptr = table6.table.as_ptr();

                for i in 0..num_entries {
                    let row = &*rows_ptr.add(i);
                    if row.dwState == TCP_STATE_LISTEN {
                        let port = u16::from_be((row.dwLocalPort & 0xFFFF) as u16);
                        let pid = row.dwOwningPid;
                        let process_name = process_map
                            .get(&pid)
                            .cloned()
                            .unwrap_or_else(|| format!("PID {}", pid));

                        ports.push(PortProcess {
                            port,
                            pid,
                            process_name,
                            state: "LISTENING".into(),
                        });
                    }
                }
            }
        }
    }

    ports.sort_by_key(|p| p.port);
    ports.dedup_by_key(|p| (p.port, p.pid));
    ports
}

// Kill a process by PID cleanly
pub fn kill_pid(pid: u32) -> Result<(), String> {
    if pid == 0 || pid == 4 || pid == std::process::id() {
        return Err("Cannot terminate a protected process".into());
    }

    // Protect critical Windows OS processes against accidental termination
    let process_map = get_process_names();
    if let Some(proc_name) = process_map.get(&pid) {
        let name_lower = proc_name.to_lowercase();
        let protected = [
            "csrss.exe",
            "lsass.exe",
            "services.exe",
            "smss.exe",
            "wininit.exe",
            "winlogon.exe",
            "dwm.exe",
        ];
        if protected.iter().any(|&p| name_lower == p) {
            return Err(format!("Cannot terminate protected Windows system service: {}", proc_name));
        }
    }

    // Use taskkill /PID ... /F for reliable tree termination
    use std::os::windows::process::CommandExt;
    let status = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F", "/T"])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to execute taskkill: {}", e))?;

    if status.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&status.stderr);
        Err(format!("Termination failed: {}", stderr.trim()))
    }
}

fn extract_project_hint(cmd: Option<&str>, _exe: Option<&str>) -> Option<String> {
    if let Some(c) = cmd {
        for part in c.split_whitespace() {
            let clean = part.trim_matches('"').trim_matches('\'');
            if (clean.contains('\\') || clean.contains('/'))
                && (clean.ends_with(".js")
                    || clean.ends_with(".ts")
                    || clean.ends_with(".json")
                    || clean.ends_with(".rs")
                    || clean.ends_with(".py"))
            {
                if let Some(parent) = std::path::Path::new(clean).parent() {
                    if let Some(folder_name) = parent.file_name() {
                        let name_str = folder_name.to_string_lossy().to_string();
                        if !name_str.eq_ignore_ascii_case("bin") && !name_str.eq_ignore_ascii_case("dist") {
                            return Some(name_str);
                        }
                    }
                }
            }
        }
    }
    None
}

fn query_process_details_safe(pid: u32) -> (Option<String>, Option<String>, Option<String>) {
    use std::os::windows::process::CommandExt;
    let script = format!(
        "$p = Get-CimInstance Win32_Process -Filter 'ProcessId = {}' -ErrorAction SilentlyContinue; if ($p) {{ [PSCustomObject]@{{ c = $p.CommandLine; e = $p.ExecutablePath }} | ConvertTo-Json -Compress }}",
        pid
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    if let Ok(res) = output {
        if res.status.success() {
            let stdout = String::from_utf8_lossy(&res.stdout).trim().to_string();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&stdout) {
                let cmd = val.get("c").and_then(|v| v.as_str()).map(|s| s.to_string());
                let exe = val.get("e").and_then(|v| v.as_str()).map(|s| s.to_string());
                let hint = extract_project_hint(cmd.as_deref(), exe.as_deref());
                return (cmd, exe, hint);
            }
        }
    }
    (None, None, None)
}

pub fn get_port_process_forensics(port: u16, pid: u32) -> Result<PortProcessForensics, String> {
    let tree_map = get_process_tree_map();
    let proc_info = tree_map.get(&pid);

    let process_name = proc_info
        .map(|p| p.name.clone())
        .unwrap_or_else(|| format!("PID {}", pid));

    let parent_pid = proc_info.map(|p| p.parent_pid);
    let parent_name = parent_pid.and_then(|ppid| tree_map.get(&ppid).map(|p| p.name.clone()));

    let name_lower = process_name.to_lowercase();
    let protected = [
        "csrss.exe", "lsass.exe", "services.exe", "smss.exe", "wininit.exe",
        "winlogon.exe", "dwm.exe", "system",
    ];
    let is_protected = pid <= 4 || protected.iter().any(|&p| name_lower == p);

    let is_wsl_or_docker = name_lower.contains("wsl") || name_lower.contains("docker") || name_lower.contains("vpnkit");

    let (command_line, executable_path, project_hint) = if !is_protected {
        query_process_details_safe(pid)
    } else {
        (None, None, None)
    };

    Ok(PortProcessForensics {
        port,
        pid,
        process_name,
        parent_pid,
        parent_name,
        command_line,
        executable_path,
        project_hint,
        is_wsl_or_docker,
        is_protected,
    })
}

pub fn kill_and_verify_port(port: u16, pid: u32) -> Result<KillVerifyResult, String> {
    let start = std::time::Instant::now();

    // 1. Kill process tree cleanly
    kill_pid(pid)?;

    // 2. Poll listening ports table up to 600ms to verify liberation
    let mut verified_free = false;
    for _ in 0..12 {
        std::thread::sleep(std::time::Duration::from_millis(50));
        let active = get_listening_ports();
        if !active.iter().any(|p| p.port == port) {
            verified_free = true;
            break;
        }
    }

    let elapsed_ms = start.elapsed().as_millis() as u64;

    Ok(KillVerifyResult {
        success: true,
        port,
        pid,
        verified_free,
        elapsed_ms,
        message: if verified_free {
            format!("Port :{} freed and verified in {}ms", port, elapsed_ms)
        } else {
            format!("Process {} terminated, port :{} in TIME_WAIT / draining", pid, port)
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ports_scan() {
        let ports = get_listening_ports();
        println!("Found {} active listening TCP ports:", ports.len());
        for p in ports.iter().take(10) {
            println!("- Port :{} -> PID {} ({})", p.port, p.pid, p.process_name);
        }
        assert!(
            ports.windows(2).all(|pair| pair[0].port <= pair[1].port),
            "Listening ports should be sorted"
        );
        assert!(
            ports.windows(2).all(|pair| pair[0].port != pair[1].port || pair[0].pid != pair[1].pid),
            "Listening ports should not contain duplicate port/PID pairs"
        );
    }
}
