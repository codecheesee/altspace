use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, SW_SHOWNORMAL,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GameItem {
    pub id: String,
    pub title: String,
    pub platform: String, // "Steam", "Epic Games", "Xbox", "Rockstar / PC", "GOG Galaxy", "Standalone"
    pub install_path: String,
    pub executable_path: Option<String>,
    pub launch_uri: String,
    pub banner_url: Option<String>,
    pub size_gb: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameModeStatus {
    pub is_gaming: bool,
    pub current_game: Option<String>,
}

/// Parse Steam ACF AppManifest file format into (appid, name, installdir, size_bytes)
pub fn parse_steam_acf(content: &str) -> Option<(String, String, String, u64)> {
    let mut appid = String::new();
    let mut name = String::new();
    let mut installdir = String::new();
    let mut size_bytes: u64 = 0;

    for line in content.lines() {
        let trimmed = line.trim();
        let parts: Vec<&str> = trimmed
            .split('"')
            .filter(|s| !s.trim().is_empty())
            .collect();

        if parts.len() >= 2 {
            let key = parts[0].to_lowercase();
            let val = parts[1];

            match key.as_str() {
                "appid" => appid = val.to_string(),
                "name" => name = val.to_string(),
                "installdir" => installdir = val.to_string(),
                "sizeondisk" => {
                    size_bytes = val.parse::<u64>().unwrap_or(0);
                }
                _ => {}
            }
        }
    }

    if !appid.is_empty() && !name.is_empty() {
        // Suppress steam runtime/redistributable utilities
        let lower = name.to_lowercase();
        if lower.contains("steamworks common")
            || lower.contains("steam vr")
            || lower.contains("proton")
            || lower.contains("steam linux runtime")
        {
            return None;
        }
        Some((appid, name, installdir, size_bytes))
    } else {
        None
    }
}

/// Parse Epic Games .item manifest JSON file
pub fn parse_epic_manifest(json_str: &str) -> Option<GameItem> {
    #[derive(Deserialize)]
    struct EpicManifest {
        #[serde(rename = "DisplayName")]
        display_name: Option<String>,
        #[serde(rename = "AppName")]
        app_name: Option<String>,
        #[serde(rename = "InstallLocation")]
        install_location: Option<String>,
        #[serde(rename = "InstallSize")]
        install_size: Option<u64>,
    }

    let parsed: EpicManifest = serde_json::from_str(json_str).ok()?;
    let title = parsed.display_name?;
    let app_name = parsed.app_name?;
    let install_path = parsed.install_location.unwrap_or_default();
    let size_bytes = parsed.install_size.unwrap_or(0);
    let size_gb = if size_bytes > 0 {
        Some(((size_bytes as f64 / 1_073_741_824.0) * 10.0).round() / 10.0)
    } else {
        None
    };

    let launch_uri = format!(
        "com.epicgames.launcher://apps/{}?action=launch&silent=true",
        app_name
    );

    Some(GameItem {
        id: format!("epic-{}", app_name),
        title,
        platform: "Epic Games".to_string(),
        install_path,
        executable_path: None,
        launch_uri,
        banner_url: None,
        size_gb,
    })
}

/// Validate launch URI against dangerous characters / arbitrary command injection
pub fn sanitize_game_launch_uri(uri: &str) -> Result<String, String> {
    let trimmed = uri.trim();
    if trimmed.is_empty() {
        return Err("Launch URI is empty".into());
    }

    // Protocol checks
    let is_steam = trimmed.starts_with("steam://rungameid/") || trimmed.starts_with("steam://run/");
    let is_epic = trimmed.starts_with("com.epicgames.launcher://apps/");
    let is_xbox = trimmed.starts_with("xbox://") || trimmed.starts_with("ms-xbl-");
    let is_file_path = (trimmed.len() >= 3 && trimmed.chars().nth(1) == Some(':'))
        || trimmed.starts_with(r"\\");

    if !is_steam && !is_epic && !is_xbox && !is_file_path {
        return Err(format!("Unsupported or insecure game launch protocol: {}", trimmed));
    }

    // Prevent shell metacharacter injections
    if trimmed.contains("&&")
        || trimmed.contains('|')
        || trimmed.contains(';')
        || trimmed.contains('`')
        || trimmed.contains('\n')
        || trimmed.contains('\r')
        || trimmed.contains('<')
        || trimmed.contains('>')
        || trimmed.contains('"')
    {
        return Err("Launch URI contains disallowed shell characters".into());
    }

    Ok(trimmed.to_string())
}

/// Scan installed games across Steam, Epic, standalone directory scans (D:\Games, C:\Games, etc.)
pub fn scan_all_installed_games() -> Vec<GameItem> {
    let mut games = Vec::new();
    let mut seen_titles = HashSet::new();

    // 1. Scan Steam Games
    scan_steam_games(&mut games, &mut seen_titles);

    // 2. Scan Epic Games
    scan_epic_games(&mut games, &mut seen_titles);

    // 3. Scan Common Windows Games directories (D:\Games, C:\Games, XboxGames)
    scan_common_game_directories(&mut games, &mut seen_titles);

    // 4. Scan Start Menu game shortcuts
    scan_start_menu_games(&mut games, &mut seen_titles);

    games.sort_by_key(|a| a.title.to_lowercase());
    games
}

fn scan_steam_games(games: &mut Vec<GameItem>, seen: &mut HashSet<String>) {
    let mut library_dirs = Vec::new();

    // Common Steam install locations
    let default_steam = PathBuf::from(r"C:\Program Files (x86)\Steam");
    if default_steam.exists() {
        library_dirs.push(default_steam.join("steamapps"));
    }

    // Secondary drives (D:\SteamLibrary, E:\SteamLibrary, F:\SteamLibrary, etc.)
    for drive in ['C', 'D', 'E', 'F', 'G'] {
        let p = PathBuf::from(format!(r"{}:\SteamLibrary\steamapps", drive));
        if p.exists() {
            library_dirs.push(p);
        }
        let p2 = PathBuf::from(format!(r"{}:\Games\Steam\steamapps", drive));
        if p2.exists() {
            library_dirs.push(p2);
        }
    }

    for lib_dir in library_dirs {
        if let Ok(entries) = fs::read_dir(&lib_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if let Some((appid, name, installdir, size_bytes)) =
                                parse_steam_acf(&content)
                            {
                                let lower = name.to_lowercase();
                                if seen.insert(lower) {
                                    let full_install_path =
                                        lib_dir.join("common").join(&installdir);
                                    let size_gb = if size_bytes > 0 {
                                        Some(
                                            ((size_bytes as f64 / 1_073_741_824.0) * 10.0)
                                                .round()
                                                / 10.0,
                                        )
                                    } else {
                                        None
                                    };

                                    let banner_url = Some(format!(
                                        "https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg",
                                        appid
                                    ));

                                    games.push(GameItem {
                                        id: format!("steam-{}", appid),
                                        title: name,
                                        platform: "Steam".to_string(),
                                        install_path: full_install_path
                                            .to_string_lossy()
                                            .to_string(),
                                        executable_path: None,
                                        launch_uri: format!("steam://rungameid/{}", appid),
                                        banner_url,
                                        size_gb,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn scan_epic_games(games: &mut Vec<GameItem>, seen: &mut HashSet<String>) {
    let manifest_dir = PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests");
    if manifest_dir.exists() {
        if let Ok(entries) = fs::read_dir(manifest_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("item") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Some(item) = parse_epic_manifest(&content) {
                            let lower = item.title.to_lowercase();
                            if seen.insert(lower) {
                                games.push(item);
                            }
                        }
                    }
                }
            }
        }
    }
}

fn scan_common_game_directories(games: &mut Vec<GameItem>, seen: &mut HashSet<String>) {
    let candidate_dirs = [
        r"D:\Games",
        r"C:\Games",
        r"E:\Games",
        r"C:\XboxGames",
        r"D:\XboxGames",
        r"E:\XboxGames",
    ];

    for root_str in candidate_dirs {
        let root = Path::new(root_str);
        if !root.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    let folder_name = match path.file_name().and_then(|n| n.to_str()) {
                        Some(name) => name,
                        None => continue,
                    };

                    let lower = folder_name.to_lowercase();
                    // Skip generic helper or mod backup directories
                    if lower.contains("mod")
                        || lower.contains("output")
                        || lower.contains("backup")
                        || lower.contains("installer")
                        || lower.contains("gamesave")
                    {
                        continue;
                    }

                    // Look for primary game executable
                    if let Ok(files) = fs::read_dir(&path) {
                        let mut main_exe: Option<PathBuf> = None;
                        for file_entry in files.filter_map(|e| e.ok()) {
                            let f_path = file_entry.path();
                            if f_path.extension().and_then(|e| e.to_str()) == Some("exe") {
                                let exe_name = f_path
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("")
                                    .to_lowercase();

                                if !exe_name.starts_with("unins")
                                    && !exe_name.contains("crash")
                                    && !exe_name.contains("helper")
                                    && !exe_name.contains("setup")
                                    && (exe_name.starts_with("play") || main_exe.is_none()) {
                                        main_exe = Some(f_path);
                                    }
                            }
                        }

                        if let Some(exe) = main_exe {
                            if seen.insert(lower.clone()) {
                                let platform = if root_str.to_lowercase().contains("xbox") {
                                    "Xbox"
                                } else if lower.contains("theft auto") || lower.contains("gta") {
                                    "Rockstar / PC"
                                } else {
                                    "Standalone"
                                };

                                games.push(GameItem {
                                    id: format!("local-{}", folder_name.replace(' ', "-").to_lowercase()),
                                    title: folder_name.to_string(),
                                    platform: platform.to_string(),
                                    install_path: path.to_string_lossy().to_string(),
                                    launch_uri: exe.to_string_lossy().to_string(),
                                    executable_path: Some(exe.to_string_lossy().to_string()),
                                    banner_url: None,
                                    size_gb: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

fn scan_start_menu_games(games: &mut Vec<GameItem>, seen: &mut HashSet<String>) {
    let mut search_roots = Vec::new();

    let all_users_menu = PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs");
    if all_users_menu.exists() {
        search_roots.push(all_users_menu);
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let user_menu = PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs");
        if user_menu.exists() {
            search_roots.push(user_menu);
        }
    }

    let known_game_keywords = [
        "grand theft auto", "gta", "rockstar", "valorant", "counter-strike", "cs2",
        "minecraft", "cyberpunk", "witcher", "elden ring", "helldivers", "balatro",
        "roblox", "apex legends", "league of legends", "fortnite", "call of duty",
        "modern warfare", "battlefield", "halo", "overwatch", "dota", "ea sports",
        "fifa", "forza", "palworld", "baldurs gate", "steam", "riot"
    ];

    for root in search_roots {
        for entry in walkdir::WalkDir::new(root)
            .max_depth(4)
            .into_iter()
            .filter_map(|e| e.ok())
        {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("lnk") {
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let lower = stem.to_lowercase();

            if lower.contains("uninstall") || lower.contains("help") {
                continue;
            }

            for keyword in &known_game_keywords {
                if lower.contains(keyword) {
                    if seen.insert(lower.clone()) {
                        games.push(GameItem {
                            id: format!("lnk-{}", stem.replace(' ', "-").to_lowercase()),
                            title: stem.to_string(),
                            platform: "PC Game".to_string(),
                            install_path: path.to_string_lossy().to_string(),
                            executable_path: None,
                            launch_uri: path.to_string_lossy().to_string(),
                            banner_url: None,
                            size_gb: None,
                        });
                    }
                    break;
                }
            }
        }
        }
    }
}

/// Check if a detected game or full-screen gaming title is currently foregrounded
pub fn get_game_mode_status() -> GameModeStatus {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return GameModeStatus {
                is_gaming: false,
                current_game: None,
            };
        }

        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        if len > 0 {
            let title = String::from_utf16_lossy(&title_buf[..len as usize]);
            let lower = title.to_lowercase();

            let gaming_titles = [
                "grand theft auto",
                "gta v",
                "call of duty",
                "counter-strike",
                "valorant",
                "apex legends",
                "overwatch",
                "fortnite",
                "cyberpunk",
                "witcher",
                "dota 2",
                "league of legends",
                "minecraft",
                "elden ring",
            ];

            for gt in &gaming_titles {
                if lower.contains(gt) {
                    return GameModeStatus {
                        is_gaming: true,
                        current_game: Some(title),
                    };
                }
            }
        }

        GameModeStatus {
            is_gaming: false,
            current_game: None,
        }
    }
}

/// Launch game safely using Win32 ShellExecuteW
pub fn launch_game(launch_uri: &str) -> Result<(), String> {
    let sanitized = sanitize_game_launch_uri(launch_uri)?;

    let mut wide_uri: Vec<u16> = sanitized.encode_utf16().collect();
    wide_uri.push(0);

    let mut wide_open: Vec<u16> = "open".encode_utf16().collect();
    wide_open.push(0);

    unsafe {
        let hinstance = ShellExecuteW(
            HWND(std::ptr::null_mut()),
            PCWSTR(wide_open.as_ptr()),
            PCWSTR(wide_uri.as_ptr()),
            PCWSTR(std::ptr::null()),
            PCWSTR(std::ptr::null()),
            SW_SHOWNORMAL,
        );

        if (hinstance.0 as usize) <= 32 {
            return Err(format!(
                "Failed to launch game '{}': ShellExecute code {}",
                sanitized, hinstance.0 as usize
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steam_acf_parsing() {
        let sample = r#"
"AppState"
{
	"appid"		"730"
	"name"		"Counter-Strike 2"
	"installdir"		"Counter-Strike Global Offensive"
	"SizeOnDisk"		"35489421312"
}
"#;
        let parsed = parse_steam_acf(sample);
        assert!(parsed.is_some());
        let (appid, name, installdir, size) = parsed.unwrap();
        assert_eq!(appid, "730");
        assert_eq!(name, "Counter-Strike 2");
        assert_eq!(installdir, "Counter-Strike Global Offensive");
        assert_eq!(size, 35489421312);
    }

    #[test]
    fn test_steam_acf_filters_redistributables() {
        let sample = r#"
"AppState"
{
	"appid"		"228980"
	"name"		"Steamworks Common Redistributables"
	"installdir"		"Steamworks Shared"
}
"#;
        let parsed = parse_steam_acf(sample);
        assert!(parsed.is_none());
    }

    #[test]
    fn test_epic_manifest_parsing() {
        let json = r#"{
            "DisplayName": "Grand Theft Auto V",
            "AppName": "GTAV",
            "InstallLocation": "D:\\Games\\Grand Theft Auto V",
            "InstallSize": 107374182400
        }"#;

        let parsed = parse_epic_manifest(json);
        assert!(parsed.is_some());
        let game = parsed.unwrap();
        assert_eq!(game.title, "Grand Theft Auto V");
        assert_eq!(game.platform, "Epic Games");
        assert_eq!(game.size_gb, Some(100.0));
        assert!(game.launch_uri.starts_with("com.epicgames.launcher://apps/GTAV"));
    }

    #[test]
    fn test_game_launch_uri_sanitization() {
        // Valid Steam
        assert!(sanitize_game_launch_uri("steam://rungameid/730").is_ok());
        // Valid Epic
        assert!(sanitize_game_launch_uri("com.epicgames.launcher://apps/GTAV?action=launch&silent=true").is_ok());
        // Valid absolute path
        assert!(sanitize_game_launch_uri(r"D:\Games\Grand Theft Auto V\PlayGTAV.exe").is_ok());

        // Dangerous / shell injection attempts
        assert!(sanitize_game_launch_uri("steam://rungameid/730 && calc.exe").is_err());
        assert!(sanitize_game_launch_uri("steam://run/123; rm -rf").is_err());
        assert!(sanitize_game_launch_uri("http://malicious.site/payload.exe").is_err());
        assert!(sanitize_game_launch_uri("").is_err());
    }

    #[test]
    fn test_game_mode_status() {
        let status = get_game_mode_status();
        // Should execute safely without panic on any platform state
        println!("Game mode active: {}", status.is_gaming);
    }
}
