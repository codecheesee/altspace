use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct AppInfo {
    pub name: String,
    pub path: PathBuf,
}

pub struct AppIndex {
    apps: Vec<AppInfo>,
    matcher: SkimMatcherV2,
}

impl AppIndex {
    pub fn new() -> Self {
        let mut index = Self {
            apps: Vec::new(),
            matcher: SkimMatcherV2::default(),
        };
        index.refresh();
        index
    }

    pub fn refresh(&mut self) {
        let mut found = Vec::new();

        let search_dirs = [
            dirs::data_dir().map(|p| p.join("Microsoft\\Windows\\Start Menu\\Programs")),
            Some(PathBuf::from(
                r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
            )),
        ];

        for dir in search_dirs.into_iter().flatten() {
            if !dir.exists() {
                continue;
            }
            for entry in WalkDir::new(dir)
                .follow_links(true)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "lnk" || ext_str == "url" {
                        if let Some(stem) = path.file_stem() {
                            let name = stem.to_string_lossy().to_string();
                            let lower = name.to_lowercase();
                            if !lower.contains("uninstall")
                                && !lower.contains("help")
                                && !lower.contains("readme")
                            {
                                found.push(AppInfo {
                                    name,
                                    path: path.to_path_buf(),
                                });
                            }
                        }
                    }
                }
            }
        }

        found.sort_by(|a, b| a.name.cmp(&b.name));
        found.dedup_by(|a, b| a.name == b.name);
        self.apps = found;
    }

    pub fn search(&self, query: &str) -> Vec<(AppInfo, i64)> {
        if query.trim().is_empty() {
            let popular = [
                "visual studio code",
                "code",
                "cursor",
                "chrome",
                "firefox",
                "notion",
                "obsidian",
                "terminal",
                "powershell",
                "everything",
                "spotify",
                "slack",
                "discord",
                "file explorer",
                "explorer",
                "canva",
                "settings",
            ];
            let mut top = Vec::new();
            let mut others = Vec::new();

            for app in &self.apps {
                let name_lower = app.name.to_lowercase();
                if popular
                    .iter()
                    .any(|&p| name_lower == p || name_lower.contains(p))
                {
                    top.push((app.clone(), 100));
                } else {
                    others.push((app.clone(), 0));
                }
            }

            top.extend(others);
            return top.into_iter().take(15).collect();
        }

        let q_lower = query.trim().to_lowercase();
        let mut matches = Vec::new();
        for app in &self.apps {
            let name_lower = app.name.to_lowercase();
            // Fast-path 1: Exact match -> highest priority
            if name_lower == q_lower {
                matches.push((app.clone(), 60000));
                continue;
            }
            // Fast-path 2: Name starts with query prefix -> ultra fast & highly relevant
            if name_lower.starts_with(&q_lower) {
                matches.push((app.clone(), 50000 + (100 - name_lower.len().min(100) as i64)));
                continue;
            }
            // Fast-path 3: Any word inside app name starts with query (e.g. "code" matches "Visual Studio Code")
            let word_match = name_lower
                .split_whitespace()
                .any(|w| w.starts_with(&q_lower));
            if word_match {
                matches.push((app.clone(), 45000 + (100 - name_lower.len().min(100) as i64)));
                continue;
            }
            // Fast-path 4: Acronym matching (e.g. "gta" -> "Grand Theft Auto", "vsc" -> "Visual Studio Code")
            let acronym: String = name_lower
                .split_whitespace()
                .filter_map(|w| w.chars().next())
                .collect();
            if acronym == q_lower || acronym.starts_with(&q_lower) {
                matches.push((app.clone(), 40000 + (100 - name_lower.len().min(100) as i64)));
                continue;
            }
            // Fast-path 5: Substring containment
            if name_lower.contains(&q_lower) {
                matches.push((app.clone(), 35000 + (100 - name_lower.len().min(100) as i64)));
                continue;
            }
            // Fallback: full fuzzy match ONLY if query length >= 4
            // (Strictly avoid loose scattered matching on short queries like 'gta' matching 'Git Bash')
            if q_lower.len() >= 4 {
                if let Some(score) = self.matcher.fuzzy_match(&app.name, query) {
                    if score > 75 {
                        matches.push((app.clone(), score));
                    }
                }
            }
        }

        matches.sort_by_key(|a| std::cmp::Reverse(a.1));
        matches.into_iter().take(15).collect()
    }
}

impl Default for AppIndex {
    fn default() -> Self {
        Self::new()
    }
}

mod dirs {
    use std::path::PathBuf;
    pub fn data_dir() -> Option<PathBuf> {
        std::env::var_os("APPDATA").map(PathBuf::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_scan() {
        let index = AppIndex::new();
        println!("Indexed {} applications", index.apps.len());
        assert!(
            !index.apps.is_empty(),
            "Expected to find at least one installed app"
        );
        let matches = index.search("code");
        println!("App search 'code' count: {}", matches.len());
        for (m, score) in matches {
            println!("- {} (Score: {}) -> {:?}", m.name, score, m.path);
        }
    }
}
