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
            Some(PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs")),
        ];

        for dir in search_dirs.into_iter().flatten() {
            if !dir.exists() {
                continue;
            }
            for entry in WalkDir::new(dir).follow_links(true).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "lnk" || ext_str == "url" {
                        if let Some(stem) = path.file_stem() {
                            let name = stem.to_string_lossy().to_string();
                            let lower = name.to_lowercase();
                            if !lower.contains("uninstall") && !lower.contains("help") && !lower.contains("readme") {
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
            return self.apps.iter().take(8).map(|a| (a.clone(), 0)).collect();
        }

        let mut matches = Vec::new();
        for app in &self.apps {
            if let Some(score) = self.matcher.fuzzy_match(&app.name, query) {
                matches.push((app.clone(), score));
            }
        }

        matches.sort_by(|a, b| b.1.cmp(&a.1));
        matches.into_iter().take(8).collect()
    }
}

mod dirs {
    use std::path::PathBuf;
    pub fn data_dir() -> Option<PathBuf> {
        std::env::var_os("APPDATA").map(PathBuf::from)
    }
}
