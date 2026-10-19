use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use windows::Win32::Foundation::{CloseHandle, NO_ERROR};
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_ALL,
};
use windows::Win32::Networking::WinSock::AF_INET;
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProcess {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub state: String,
}

// Map PIDs to Process Names using Windows Toolhelp snapshot
pub fn get_process_names() -> HashMap<u32, String> {
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
                    map.insert(entry.th32ProcessID, name);
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
                if row.dwState == 2 {
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
    ports
}

// Kill a process by PID cleanly
pub fn kill_pid(pid: u32) -> Result<(), String> {
    if pid == 0 || pid == 4 {
        return Err("Cannot terminate Windows System process".into());
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
        assert!(!ports.is_empty(), "Should find at least one listening port on Windows");
    }
}

