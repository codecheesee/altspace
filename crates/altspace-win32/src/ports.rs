use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

/// Map PIDs to Process Snapshot using Windows Toolhelp snapshot (Zero-Subprocess).
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

/// Map PIDs to Process Names using Windows Toolhelp snapshot.
pub fn get_process_names() -> HashMap<u32, String> {
    get_process_tree_map()
        .into_iter()
        .map(|(pid, p)| (pid, p.name))
        .collect()
}

/// Retrieve listening TCP ports and their owning processes via native Win32 GetExtendedTcpTable.
pub fn get_listening_ports() -> Vec<PortProcess> {
    let process_map = get_process_names();
    let mut ports = Vec::new();

    // Step 1: IPv4 listening ports scan
    unsafe {
        let mut size = 0u32;
        let _ = GetExtendedTcpTable(
            None,
            &mut size,
            true,
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );

        if size > 0 {
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
