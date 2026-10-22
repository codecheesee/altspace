use std::path::PathBuf;

/// Checks if WSL2 is installed and enabled on this Windows host.
pub fn is_wsl_installed() -> bool {
    // Check if wsl.exe exists in System32
    if let Ok(system_root) = std::env::var("SystemRoot") {
        let wsl_path = PathBuf::from(system_root).join("System32").join("wsl.exe");
        wsl_path.exists()
    } else {
        false
    }
}

/// Lists registered WSL distributions by inspecting the Windows registry directly (Zero Subprocess).
pub fn list_wsl_distributions() -> Vec<String> {
    use windows::core::w;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY_CURRENT_USER, KEY_READ,
        REG_SZ,
    };

    let mut distros = Vec::new();

    unsafe {
        let subkey = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Lxss");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();

        if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_READ, &mut hkey).is_ok() {
            let mut index = 0;
            let mut key_name_buf = [0u16; 256];

            loop {
                let mut name_len = key_name_buf.len() as u32;
                let enum_res = RegEnumKeyExW(
                    hkey,
                    index,
                    windows::core::PWSTR(key_name_buf.as_mut_ptr()),
                    &mut name_len,
                    None,
                    windows::core::PWSTR::null(),
                    None,
                    None,
                );

                if enum_res.is_err() {
                    break;
                }

                // Subkey found (GUID for distro). Open it to read DistributionName
                let guid_str = String::from_utf16_lossy(&key_name_buf[..name_len as usize]);
                let subkey_path = format!("Software\\Microsoft\\Windows\\CurrentVersion\\Lxss\\{}", guid_str);
                let wide_subkey: Vec<u16> = subkey_path.encode_utf16().chain(std::iter::once(0)).collect();

                let mut sub_hkey = windows::Win32::System::Registry::HKEY::default();
                if RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    windows::core::PCWSTR(wide_subkey.as_ptr()),
                    0,
                    KEY_READ,
                    &mut sub_hkey,
                ).is_ok() {
                    let mut data_buf = [0u16; 256];
                    let mut data_len = (data_buf.len() * 2) as u32;
                    let mut val_type = REG_SZ;

                    let val_name = w!("DistributionName");
                    if RegQueryValueExW(
                        sub_hkey,
                        val_name,
                        None,
                        Some(&mut val_type),
                        Some(data_buf.as_mut_ptr() as *mut _),
                        Some(&mut data_len),
                    ).is_ok() {
                        let len_chars = (data_len as usize / 2).saturating_sub(1);
                        let name = String::from_utf16_lossy(&data_buf[..len_chars]);
                        if !name.trim().is_empty() {
                            distros.push(name.trim().to_string());
                        }
                    }
                    let _ = RegCloseKey(sub_hkey);
                }

                index += 1;
            }

            let _ = RegCloseKey(hkey);
        }
    }

    distros
}
