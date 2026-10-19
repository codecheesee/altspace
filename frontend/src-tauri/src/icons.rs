use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;
use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

fn get_cache_file_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            return parent.join("icon_cache.json");
        }
    }
    PathBuf::from("icon_cache.json")
}

fn load_cache_from_disk() -> HashMap<String, String> {
    let path = get_cache_file_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&content) {
            return map;
        }
    }
    HashMap::new()
}

fn save_cache_to_disk(cache: &HashMap<String, String>) {
    let path = get_cache_file_path();
    if let Ok(serialized) = serde_json::to_string(cache) {
        let _ = fs::write(&path, serialized);
    }
}

static ICON_CACHE_DIRTY: AtomicBool = AtomicBool::new(false);

static ICON_CACHE: Lazy<Mutex<HashMap<String, String>>> = Lazy::new(|| {
    Mutex::new(load_cache_from_disk())
});

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(CHARSET[(b0 >> 2) as usize] as char);
        result.push(CHARSET[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

pub fn get_app_icon_base64(path: &str) -> Option<String> {
    if let Ok(cache) = ICON_CACHE.lock() {
        if let Some(cached) = cache.get(path) {
            return Some(cached.clone());
        }
    }

    let wide_path: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    let mut sfi = SHFILEINFOW::default();

    unsafe {
        let res = SHGetFileInfoW(
            PCWSTR(wide_path.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut sfi as *mut _ as *mut _),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );

        if res == 0 || sfi.hIcon.is_invalid() {
            return None;
        }

        let mut icon_info = ICONINFO::default();
        if GetIconInfo(sfi.hIcon, &mut icon_info).is_err() {
            let _ = DestroyIcon(sfi.hIcon);
            return None;
        }

        let mut bmp = BITMAP::default();
        if GetObjectW(
            HGDIOBJ(icon_info.hbmColor.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut _ as *mut _),
        ) == 0
        {
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
            let _ = DestroyIcon(sfi.hIcon);
            return None;
        }

        let width = bmp.bmWidth;
        let height = bmp.bmHeight;
        let buf_size = (width * height * 4) as usize;
        let mut pixels = vec![0u8; buf_size];

        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // negative for top-down bitmap
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: buf_size as u32,
                ..Default::default()
            },
            ..Default::default()
        };

        let hdc = GetDC(HWND::default());
        let lines = GetDIBits(
            hdc,
            icon_info.hbmColor,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bi,
            DIB_RGB_COLORS,
        );
        let _ = ReleaseDC(HWND::default(), hdc);
        let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
        let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
        let _ = DestroyIcon(sfi.hIcon);

        if lines == 0 {
            return None;
        }

        // Build complete BMP file in memory
        let file_header_size = 14u32;
        let info_header_size = 40u32;
        let file_size = file_header_size + info_header_size + buf_size as u32;

        let mut bmp_data = Vec::with_capacity(file_size as usize);
        // BITMAPFILEHEADER
        bmp_data.extend_from_slice(b"BM");
        bmp_data.extend_from_slice(&file_size.to_le_bytes());
        bmp_data.extend_from_slice(&0u32.to_le_bytes()); // Reserved
        bmp_data.extend_from_slice(&(file_header_size + info_header_size).to_le_bytes()); // Offset to pixels

        // BITMAPINFOHEADER (top-down biHeight)
        bmp_data.extend_from_slice(&info_header_size.to_le_bytes());
        bmp_data.extend_from_slice(&width.to_le_bytes());
        bmp_data.extend_from_slice(&(-height).to_le_bytes());
        bmp_data.extend_from_slice(&1u16.to_le_bytes()); // biPlanes
        bmp_data.extend_from_slice(&32u16.to_le_bytes()); // biBitCount
        bmp_data.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
        bmp_data.extend_from_slice(&(buf_size as u32).to_le_bytes());
        bmp_data.extend_from_slice(&0u32.to_le_bytes()); // biXPelsPerMeter
        bmp_data.extend_from_slice(&0u32.to_le_bytes()); // biYPelsPerMeter
        bmp_data.extend_from_slice(&0u32.to_le_bytes()); // biClrUsed
        bmp_data.extend_from_slice(&0u32.to_le_bytes()); // biClrImportant

        // Raw pixel data
        bmp_data.extend_from_slice(&pixels);

        let data_uri = format!("data:image/bmp;base64,{}", base64_encode(&bmp_data));

        if let Ok(mut cache) = ICON_CACHE.lock() {
            cache.insert(path.to_string(), data_uri.clone());
            if !ICON_CACHE_DIRTY.swap(true, Ordering::Relaxed) {
                // Asynchronously flush cache to disk in background without stalling search thread
                std::thread::spawn(|| {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    if ICON_CACHE_DIRTY.swap(false, Ordering::Relaxed) {
                        if let Ok(cache) = ICON_CACHE.lock() {
                            save_cache_to_disk(&cache);
                        }
                    }
                });
            }
        }

        Some(data_uri)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_icon() {
        // Test extracting icon from explorer.exe or cmd.exe
        let icon = get_app_icon_base64(r"C:\Windows\explorer.exe");
        println!("Explorer icon extracted: {}", icon.is_some());
        assert!(icon.is_some(), "Should extract icon from explorer.exe");
        assert!(icon.unwrap().starts_with("data:image/bmp;base64,"));

        let appdata = std::env::var("APPDATA").unwrap_or_default();
        let lnk_path = format!(r"{}\Microsoft\Windows\Start Menu\Programs\Visual Studio Code\Visual Studio Code.lnk", appdata);
        let lnk_icon = get_app_icon_base64(&lnk_path);
        println!("VS Code lnk icon extracted: {}", lnk_icon.is_some());
    }
}
