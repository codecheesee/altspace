use chrono::Local;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::LazyLock;
use std::sync::Mutex;
use std::time::Duration;
use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber, OpenClipboard,
    SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

const CF_UNICODETEXT: u32 = 13;
const MAX_HISTORY: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: String,
    pub content: String,
    pub preview: String,
    pub content_type: String, // "color", "url", "json", "code", "text"
    pub timestamp: String,
    pub char_count: usize,
    pub line_count: usize,
}

pub struct ClipboardManager {
    history: Mutex<VecDeque<ClipboardItem>>,
    secret_regexes: Vec<Regex>,
    color_regex: Regex,
    url_regex: Regex,
}

impl ClipboardManager {
    pub fn new() -> Self {
        let secret_patterns = vec![
            r#"ghp_[a-zA-Z0-9]{30,}"#,                                   // GitHub PAT
            r#"gho_[a-zA-Z0-9]{30,}"#,                                   // GitHub OAuth
            r#"github_pat_[a-zA-Z0-9_]{40,}"#,                           // GitHub fine-grained PAT
            r#"sk-[a-zA-Z0-9_\-]{20,}"#,                                 // OpenAI & generic AI keys
            r#"sk-ant-[a-zA-Z0-9_\-]{20,}"#,                             // Anthropic key
            r#"(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}"#,                      // AWS Access Key
            r#"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"#, // Private Keys
            r#"ey[A-Za-z0-9_\-]{10,}\.ey[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"#, // JWT token
            r#"xox[baprs]-[0-9a-zA-Z]{10,}"#,                            // Slack tokens
            r#"(?i)(?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{16,}['"]?"#, // Key-value tokens
        ];

        let secret_regexes = secret_patterns
            .into_iter()
            .filter_map(|p| Regex::new(p).ok())
            .collect();

        let color_regex =
            Regex::new(r"^(?:#[0-9a-fA-F]{3,8}|rgba?\([0-9\s,\.]+\)|hsla?\([0-9\s,\.%]+\))$")
                .unwrap();
        let url_regex = Regex::new(r"^https?://[^\s]+$").unwrap();

        Self {
            history: Mutex::new(VecDeque::with_capacity(MAX_HISTORY)),
            secret_regexes,
            color_regex,
            url_regex,
        }
    }

    pub fn is_secret(&self, text: &str) -> bool {
        let trimmed = text.trim();
        for re in &self.secret_regexes {
            if re.is_match(trimmed) {
                return true;
            }
        }
        false
    }

    pub fn detect_type(&self, text: &str) -> String {
        let trimmed = text.trim();

        if self.color_regex.is_match(trimmed) {
            return "color".into();
        }

        if self.url_regex.is_match(trimmed) {
            return "url".into();
        }

        if ((trimmed.starts_with('{') && trimmed.ends_with('}'))
            || (trimmed.starts_with('[') && trimmed.ends_with(']')))
            && serde_json::from_str::<serde_json::Value>(trimmed).is_ok()
        {
            return "json".into();
        }

        if trimmed.contains("fn ")
            || trimmed.contains("function ")
            || trimmed.contains("const ")
            || trimmed.contains("let ")
            || trimmed.contains("import ")
            || trimmed.contains("class ")
            || trimmed.contains("def ")
            || trimmed.contains("public ")
            || trimmed.contains("return ")
            || trimmed.contains("=>")
            || trimmed.contains(";") && trimmed.contains('\n')
        {
            return "code".into();
        }

        "text".into()
    }

    pub fn add_item(&self, text: &str) -> bool {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return false;
        }

        // Choice 2-b: Drop secrets immediately
        if self.is_secret(trimmed) {
            log::info!("[Clipboard] Ignored sensitive secret from history (Policy 2-b).");
            return false;
        }

        let mut queue = self.history.lock().unwrap();

        // Avoid adding duplicate consecutive content
        if let Some(front) = queue.front() {
            if front.content == text {
                return false;
            }
        }

        let content_type = self.detect_type(trimmed);
        let preview = if trimmed.chars().count() > 120 {
            let truncated: String = trimmed.chars().take(120).collect();
            format!("{}...", truncated)
        } else {
            trimmed.to_string()
        };

        let item = ClipboardItem {
            id: format!("clip-{}", chrono::Utc::now().timestamp_millis()),
            content: text.to_string(),
            preview,
            content_type,
            timestamp: Local::now().format("%I:%M %p").to_string(),
            char_count: text.chars().count(),
            line_count: text.lines().count(),
        };

        if queue.len() >= MAX_HISTORY {
            queue.pop_back();
        }
        queue.push_front(item);
        true
    }

    pub fn get_history(&self) -> Vec<ClipboardItem> {
        let queue = self.history.lock().unwrap();
        queue.iter().cloned().collect()
    }

    pub fn clear(&self) {
        let mut queue = self.history.lock().unwrap();
        queue.clear();
    }
}

pub static CLIPBOARD_MANAGER: LazyLock<ClipboardManager> = LazyLock::new(ClipboardManager::new);

// Read text from the Windows Clipboard
pub fn read_system_clipboard_text() -> Option<String> {
    unsafe {
        if OpenClipboard(HWND::default()).is_err() {
            return None;
        }

        let handle = match GetClipboardData(CF_UNICODETEXT) {
            Ok(h) => h,
            Err(_) => {
                let _ = CloseClipboard();
                return None;
            }
        };

        let h_global = HGLOBAL(handle.0);
        let ptr = GlobalLock(h_global) as *const u16;
        if ptr.is_null() {
            let _ = CloseClipboard();
            return None;
        }

        let mut len = 0;
        while *ptr.add(len) != 0 {
            len += 1;
        }

        let slice = std::slice::from_raw_parts(ptr, len);
        let text = String::from_utf16_lossy(slice);

        let _ = GlobalUnlock(h_global);
        let _ = CloseClipboard();

        Some(text)
    }
}

// Write text to the Windows Clipboard
pub fn set_system_clipboard_text(text: &str) -> Result<(), String> {
    let utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let byte_len = utf16.len() * std::mem::size_of::<u16>();

    unsafe {
        if OpenClipboard(HWND::default()).is_err() {
            return Err("Cannot open clipboard".into());
        }

        let _ = EmptyClipboard();

        let h_mem = match GlobalAlloc(GMEM_MOVEABLE, byte_len) {
            Ok(h) => h,
            Err(e) => {
                let _ = CloseClipboard();
                return Err(format!("GlobalAlloc failed: {}", e));
            }
        };

        let ptr = GlobalLock(h_mem) as *mut u16;
        if ptr.is_null() {
            // Free the allocation before returning — OS does not own it yet
            let _ = GlobalFree(h_mem);
            let _ = CloseClipboard();
            return Err("GlobalLock failed".into());
        }

        std::ptr::copy_nonoverlapping(utf16.as_ptr(), ptr, utf16.len());
        let _ = GlobalUnlock(h_mem);

        let res = SetClipboardData(CF_UNICODETEXT, HANDLE(h_mem.0));
        let _ = CloseClipboard();

        if let Err(e) = res {
            // SetClipboardData failed — OS did NOT take ownership, so free h_mem
            let _ = GlobalFree(h_mem);
            return Err(format!("SetClipboardData failed: {}", e));
        }

        // On success the OS owns h_mem — do NOT call GlobalFree
        Ok(())
    }
}

// Background poller that watches for clipboard sequence changes
pub fn start_clipboard_monitor() {
    std::thread::spawn(|| {
        let mut last_seq = unsafe { GetClipboardSequenceNumber() };
        loop {
            std::thread::sleep(Duration::from_millis(300));
            let current_seq = unsafe { GetClipboardSequenceNumber() };
            if current_seq != last_seq && current_seq != 0 {
                last_seq = current_seq;
                if let Some(text) = read_system_clipboard_text() {
                    CLIPBOARD_MANAGER.add_item(&text);
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_detection() {
        let mgr = ClipboardManager::new();

        // Must drop these secrets:
        assert!(mgr.is_secret("ghp_1234567890abcdef1234567890abcdef1234"));
        assert!(mgr.is_secret("sk-proj-1234567890abcdefghijklmnop"));
        assert!(mgr.is_secret("AKIAIOSFODNN7EXAMPLE"));
        assert!(mgr.is_secret("api_key = \"supersecretlongtoken12345678\""));

        // Must NOT drop regular content:
        assert!(!mgr.is_secret("Hello world"));
        assert!(!mgr.is_secret("#3B82F6"));
        assert!(!mgr.is_secret("https://github.com/rust-lang/rust"));
        assert!(!mgr.is_secret("function test() { return 42; }"));
    }

    #[test]
    fn test_content_type_detection() {
        let mgr = ClipboardManager::new();

        assert_eq!(mgr.detect_type("#3B82F6"), "color");
        assert_eq!(mgr.detect_type("https://google.com"), "url");
        assert_eq!(mgr.detect_type("{\"name\": \"raycast\"}"), "json");
        assert_eq!(mgr.detect_type("const x = () => 42;"), "code");
        assert_eq!(mgr.detect_type("This is plain text"), "text");
    }

    #[test]
    fn test_in_memory_buffer_policy() {
        let mgr = ClipboardManager::new();
        mgr.clear();

        // Add valid text
        assert!(mgr.add_item("Regular note"));
        assert_eq!(mgr.get_history().len(), 1);

        // Try adding secret - should be rejected!
        assert!(!mgr.add_item("ghp_999999999999999999999999999999999999"));
        assert_eq!(
            mgr.get_history().len(),
            1,
            "Secret should not have been added!"
        );

        // Add color
        assert!(mgr.add_item("#10B981"));
        assert_eq!(mgr.get_history().len(), 2);
    }
}
