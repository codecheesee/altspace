use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT, MOD_NOREPEAT,
};

pub const HOTKEY_ID: i32 = 1001;
pub const VK_SPACE: u32 = 0x20;

pub struct HotkeyManager {
    registered: bool,
}

impl HotkeyManager {
    pub fn new() -> Self {
        Self { registered: false }
    }

    pub fn register(&mut self, hwnd: HWND) -> bool {
        unsafe {
            let res = RegisterHotKey(
                hwnd,
                HOTKEY_ID,
                HOT_KEY_MODIFIERS(MOD_ALT.0 | MOD_NOREPEAT.0),
                VK_SPACE,
            );
            self.registered = res.is_ok();
            self.registered
        }
    }

    pub fn unregister(&mut self, hwnd: HWND) {
        if self.registered {
            unsafe {
                let _ = UnregisterHotKey(hwnd, HOTKEY_ID);
            }
            self.registered = false;
        }
    }
}
