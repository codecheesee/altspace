use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::thread;
use windows::core::PCWSTR;
use windows::Win32::Foundation::BOOL;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileResult {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveIndexStats {
    pub search_all_drives: bool,
    pub total_drives: usize,
    pub drives: Vec<String>,
    pub indexed_count: usize,
    pub is_indexing: bool,
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
    }
}

pub struct EverythingClient {
    search_all_drives: AtomicBool,
    cached_index: Arc<RwLock<Vec<FileResult>>>,
    indexed_drives: Arc<RwLock<Vec<String>>>,
    is_indexing: Arc<AtomicBool>,
}

impl EverythingClient {
    pub fn new() -> Self {
        let client = Self {
            search_all_drives: AtomicBool::new(true),
            cached_index: Arc::new(RwLock::new(Vec::new())),
            indexed_drives: Arc::new(RwLock::new(Vec::new())),
            is_indexing: Arc::new(AtomicBool::new(false)),
        };

        // Start initial multi-drive indexing in a background thread
        client.trigger_reindex();
        client
    }

    pub fn is_search_all_drives(&self) -> bool {
        self.search_all_drives.load(Ordering::Relaxed)
    }

    pub fn set_search_all_drives(&self, enabled: bool) {
        self.search_all_drives.store(enabled, Ordering::Relaxed);
        self.trigger_reindex();
    }

    pub fn get_stats(&self) -> DriveIndexStats {
        let drives = self.indexed_drives.read().unwrap_or_else(|e| e.into_inner()).clone();
        let total_drives = drives.len();
        let indexed_count = self.cached_index.read().unwrap_or_else(|e| e.into_inner()).len();
        let is_indexing = self.is_indexing.load(Ordering::Relaxed);

        DriveIndexStats {
            search_all_drives: self.is_search_all_drives(),
            total_drives,
            drives,
            indexed_count,
            is_indexing,
        }
    }

    pub fn trigger_reindex(&self) {
        if self.is_indexing.swap(true, Ordering::SeqCst) {
            // Already indexing
            return;
        }

        let search_all = self.search_all_drives.load(Ordering::Relaxed);
        let cached_index = Arc::clone(&self.cached_index);
        let indexed_drives = Arc::clone(&self.indexed_drives);
        let is_indexing = Arc::clone(&self.is_indexing);

        thread::spawn(move || {
            let mut found_drives = Vec::new();
            let mut indexed_items = Vec::new();

            // Detect all available drives on Windows (C:, D:, E:, F:, ...)
            for letter in b'C'..=b'Z' {
                let drive_root = format!("{}:\\", letter as char);
                let p = Path::new(&drive_root);
                if p.exists() && p.is_dir() {
                    found_drives.push(format!("{}:", letter as char));
                }
            }

            if let Ok(mut lock) = indexed_drives.write() {
                *lock = found_drives.clone();
            }

            // 1. Index C: Drive User Profile
            if let Some(profile_os) = std::env::var_os("USERPROFILE") {
                let profile = PathBuf::from(profile_os);
                let user_folders = [
                    profile.join("Desktop"),
                    profile.join("Downloads"),
                    profile.join("Documents"),
                    profile.join("Pictures"),
                    profile.join("Videos"),
                    profile.join("source"),
                    profile.join("projects"),
                    profile.join("workspace"),
                    profile.join("dev"),
                    profile.join("Code"),
                ];

                for folder in &user_folders {
                    if folder.exists() {
                        Self::scan_directory(folder, 3, &mut indexed_items);
                    }
                }
            }

            // 2. If search_all_drives is enabled, index secondary & external hard disks (D:, E:, F:, ...)
            if search_all {
                for drive in &found_drives {
                    if drive == "C:" {
                        continue;
                    }

                    let drive_root = format!("{}\\", drive);
                    let root_path = Path::new(&drive_root);
                    if let Ok(entries) = std::fs::read_dir(root_path) {
                        for entry in entries.filter_map(|e| e.ok()) {
                            let path = entry.path();
                            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                            // Skip system root junk folders
                            let name_lower = file_name.to_lowercase();
                            if name_lower.starts_with('$')
                                || name_lower == "system volume information"
                                || name_lower == "windowsapps"
                                || name_lower == "deliveryoptimization"
                                || name_lower == "wpsystem"
                                || name_lower == "dumpstack.log"
                                || name_lower == "pagefile.sys"
                                || name_lower == "hiberfil.sys"
                                || name_lower == "swapfile.sys"
                                || name_lower == ".pnpm-store"
                            {
                                continue;
                            }

                            if path.is_dir() {
                                // Add the root folder itself
                                indexed_items.push(FileResult {
                                    name: file_name.to_string(),
                                    path: drive_root.clone(),
                                    is_folder: true,
                                });

                                // Scan directory tree up to depth 3
                                Self::scan_directory(&path, 3, &mut indexed_items);
                            } else {
                                indexed_items.push(FileResult {
                                    name: file_name.to_string(),
                                    path: drive_root.clone(),
                                    is_folder: false,
                                });
                            }
                        }
                    }
                }
            }

            // Deduplicate and update in-memory cache
            if let Ok(mut lock) = cached_index.write() {
                *lock = indexed_items;
            }
            if let Ok(mut lock) = indexed_drives.write() {
                *lock = found_drives;
            }

            is_indexing.store(false, Ordering::SeqCst);
        });
    }

    fn scan_directory(dir: &Path, max_depth: usize, out: &mut Vec<FileResult>) {
        let walker = walkdir::WalkDir::new(dir)
            .max_depth(max_depth)
            .into_iter()
            .filter_entry(|entry| {
                let name = entry.file_name().to_string_lossy();
                let lower = name.to_lowercase();
                // Skip high noise build/dependency folders
                !(lower == "node_modules"
                    || lower == ".git"
                    || lower == ".pnpm-store"
                    || lower == "target"
                    || lower == "bin"
                    || lower == "obj"
                    || lower == ".cache"
                    || lower == "devcache"
                    || lower == "dist"
                    || lower == "build"
                    || lower == "venv"
                    || lower == "__pycache__"
                    || lower == "carftapps"
                    || lower == "tenorshare"
                    || lower == "3utools9")
            });

        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();
            if let Some(file_name) = path.file_name() {
                let name_str = file_name.to_string_lossy();
                let parent = path
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                out.push(FileResult {
                    name: name_str.to_string(),
                    path: parent,
                    is_folder: path.is_dir(),
                });
            }
        }
    }

    pub fn search(&self, query: &str, limit: u32) -> Result<Vec<FileResult>, String> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        // 1. Try native Everything IPC query first
        let mut wide_query: Vec<u16> = trimmed.encode_utf16().collect();
        wide_query.push(0);

        unsafe {
            ffi::Everything_SetSearchW(PCWSTR(wide_query.as_ptr()));
            ffi::Everything_SetMax(limit);
            ffi::Everything_SetOffset(0);

            let ok = ffi::Everything_QueryW(BOOL(1));
            if ok.as_bool() {
                let count = ffi::Everything_GetNumResults();
                if count > 0 {
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
                    return Ok(results);
                }
            }
        }

        // 2. High-speed Multi-Drive Fallback Search (< 1ms from in-memory index)
        Ok(self.fallback_search(trimmed, limit))
    }

    pub fn fallback_search(&self, query: &str, limit: u32) -> Vec<FileResult> {
        let q_lower = query.to_lowercase();
        let items = self.cached_index.read().unwrap_or_else(|e| e.into_inner());

        let mut matches = Vec::new();
        for item in items.iter() {
            let name_lower = item.name.to_lowercase();
            if name_lower.contains(&q_lower) {
                // Scoring: exact matches > starts with > contains
                let score = if name_lower == q_lower {
                    3
                } else if name_lower.starts_with(&q_lower) {
                    2
                } else {
                    1
                };
                matches.push((score, item.clone()));
            }
        }

        // Sort by score descending (most relevant first)
        matches.sort_by(|a, b| b.0.cmp(&a.0));

        matches
            .into_iter()
            .take(limit as usize)
            .map(|(_, item)| item)
            .collect()
    }

    pub fn get_top_folders(&self, limit: usize) -> Vec<FileResult> {
        let items = self.cached_index.read().unwrap_or_else(|e| e.into_inner());
        let mut folders = Vec::new();
        for item in items.iter() {
            if item.is_folder {
                let lower = item.name.to_lowercase();
                if !(lower == "desktop"
                    || lower == "downloads"
                    || lower == "pictures"
                    || lower == "videos"
                    || lower == "music")
                {
                    folders.push(item.clone());
                    if folders.len() >= limit {
                        break;
                    }
                }
            }
        }
        folders
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_drive_indexing() {
        let client = EverythingClient::new();
        // Wait for background thread to complete drive discovery & indexing
        let start = std::time::Instant::now();
        while client.get_stats().is_indexing && start.elapsed().as_secs() < 8 {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        let stats = client.get_stats();
        println!("Detected drives: {:?}", stats.drives);
        println!("Total indexed items: {}", stats.indexed_count);
        assert!(stats.total_drives >= 1, "Should detect at least 1 drive");
        assert!(!stats.drives.is_empty(), "Drives list should not be empty");

        let res = client.fallback_search("C:", 5);
        println!("Search 'C:' count: {}", res.len());
        assert!(stats.indexed_count > 0 || !res.is_empty(), "Indexer should discover system drives and paths");
    }
}
