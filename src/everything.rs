use windows::core::PCWSTR;
use windows::Win32::Foundation::BOOL;

#[derive(Debug, Clone)]
pub struct FileResult {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
}

// Low-level FFI bindings to Everything64.dll
#[allow(non_snake_case)]
mod ffi {
    use super::*;

    #[link(name = "Everything64")]
    extern "system" {
        pub fn Everything_SetSearchW(search: PCWSTR);
        pub fn Everything_SetMax(max: u32);
        pub fn Everything_SetOffset(offset: u32);
        pub fn Everything_QueryW(wait: BOOL) -> BOOL;
        pub fn Everything_GetNumResults() -> u32;
        pub fn Everything_GetResultFileNameW(index: u32) -> PCWSTR;
        pub fn Everything_GetResultPathW(index: u32) -> PCWSTR;
        pub fn Everything_IsFolderResult(index: u32) -> BOOL;
        pub fn Everything_GetLastError() -> u32;
    }
}

pub struct EverythingClient;

impl EverythingClient {
    pub fn new() -> Self {
        Self
    }

    pub fn search(&self, query: &str, limit: u32) -> Result<Vec<FileResult>, String> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        let mut wide_query: Vec<u16> = query.encode_utf16().collect();
        wide_query.push(0);

        unsafe {
            ffi::Everything_SetSearchW(PCWSTR(wide_query.as_ptr()));
            ffi::Everything_SetMax(limit);
            ffi::Everything_SetOffset(0);

            let ok = ffi::Everything_QueryW(BOOL(1));
            if !ok.as_bool() {
                let err = ffi::Everything_GetLastError();
                return Err(format!("Everything query failed with error code: {}", err));
            }

            let count = ffi::Everything_GetNumResults();
            let mut results = Vec::with_capacity(count as usize);

            for i in 0..count {
                let fn_pcwstr = ffi::Everything_GetResultFileNameW(i);
                let path_pcwstr = ffi::Everything_GetResultPathW(i);
                let is_folder = ffi::Everything_IsFolderResult(i).as_bool();

                let name = if !fn_pcwstr.is_null() {
                    fn_pcwstr.to_string().unwrap_or_default()
                } else {
                    String::new()
                };

                let path = if !path_pcwstr.is_null() {
                    path_pcwstr.to_string().unwrap_or_default()
                } else {
                    String::new()
                };

                results.push(FileResult {
                    name,
                    path,
                    is_folder,
                });
            }

            Ok(results)
        }
    }
}
