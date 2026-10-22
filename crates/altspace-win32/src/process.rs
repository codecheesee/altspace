use windows::Win32::Foundation::{CloseHandle, FALSE, WAIT_OBJECT_0};
use windows::Win32::System::Threading::{
    OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION,
    PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
};

/// Set of protected Windows system processes that must NEVER be terminated
const PROTECTED_PROCESSES: &[&str] = &[
    "system",
    "system idle process",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "winlogon.exe",
    "explorer.exe",
    "dwm.exe",
    "fontdrvhost.exe",
    "sihost.exe",
    "taskhostw.exe",
    "altspace.exe",
];

/// Checks if a process is alive and accessible.
pub fn is_process_alive(pid: u32) -> bool {
    if pid == 0 || pid == 4 {
        return true;
    }
    unsafe {
        if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE, FALSE, pid) {
            let res = WaitForSingleObject(handle, 0);
            let _ = CloseHandle(handle);
            // If wait timed out (WAIT_TIMEOUT = 258), the process is still running!
            res.0 == 258
        } else {
            false
        }
    }
}

/// Terminates a process by PID using native Win32 `OpenProcess` + `TerminateProcess`.
/// Fails if the PID belongs to a protected OS process or current process.
pub fn terminate_pid(pid: u32, process_name: Option<&str>) -> Result<(), String> {
    let current_pid = std::process::id();
    if pid == 0 || pid == 4 || pid == current_pid {
        return Err(format!("Process PID {} is protected and cannot be terminated", pid));
    }

    if let Some(name) = process_name {
        let lower = name.to_lowercase();
        if PROTECTED_PROCESSES.iter().any(|&p| lower == p) {
            return Err(format!("Process '{}' (PID {}) is protected and cannot be terminated", name, pid));
        }
    }

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE | PROCESS_SYNCHRONIZE, FALSE, pid)
            .map_err(|e| format!("Failed to open process {}: {}", pid, e))?;

        let term_res = TerminateProcess(handle, 1);
        if term_res.is_err() {
            let _ = CloseHandle(handle);
            return Err(format!("Failed to terminate process PID {}", pid));
        }

        // Wait up to 1000ms for termination to complete
        let wait_res = WaitForSingleObject(handle, 1000);
        let _ = CloseHandle(handle);

        if wait_res == WAIT_OBJECT_0 {
            Ok(())
        } else {
            Err(format!("Process PID {} termination timed out", pid))
        }
    }
}

/// Recursively terminates child processes before terminating the target PID.
pub fn terminate_process_tree(target_pid: u32) -> Result<Vec<u32>, String> {
    let tree = super::ports::get_process_tree_map();
    let mut to_kill = Vec::new();

    // Find all descendants of target_pid
    let mut queue = vec![target_pid];
    while let Some(current) = queue.pop() {
        for (pid, info) in &tree {
            if info.parent_pid == current && *pid != current {
                to_kill.push(*pid);
                queue.push(*pid);
            }
        }
    }

    // Kill children in reverse order (bottom-up)
    let mut killed = Vec::new();
    for &child_pid in to_kill.iter().rev() {
        let name = tree.get(&child_pid).map(|p| p.name.as_str());
        if terminate_pid(child_pid, name).is_ok() {
            killed.push(child_pid);
        }
    }

    // Kill target process
    let target_name = tree.get(&target_pid).map(|p| p.name.as_str());
    terminate_pid(target_pid, target_name)?;
    killed.push(target_pid);

    Ok(killed)
}
