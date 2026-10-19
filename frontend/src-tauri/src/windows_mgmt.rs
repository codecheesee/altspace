use std::sync::LazyLock;
use std::sync::Mutex;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetDesktopWindow, GetForegroundWindow, GetShellWindow, GetWindow,
    IsWindow, IsWindowVisible, SetWindowPos, ShowWindow, GW_HWNDNEXT, HWND_TOP,
    SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_MAXIMIZE, SW_RESTORE,
};

/// Tracks the window that was focused before AltSpace was summoned
pub static PREVIOUS_WINDOW: LazyLock<Mutex<Option<isize>>> = LazyLock::new(|| Mutex::new(None));

/// Updates the tracked previous foreground window if it's not AltSpace or Desktop/Shell
pub fn record_previous_foreground(current_altspace_hwnd: HWND) {
    unsafe {
        let fg = GetForegroundWindow();
        if !fg.0.is_null() && fg != current_altspace_hwnd && is_valid_user_window(fg) {
            if let Ok(mut lock) = PREVIOUS_WINDOW.lock() {
                *lock = Some(fg.0 as isize);
            }
        }
    }
}

/// Checks if a window is a user application window (not desktop, taskbar, or invisible)
pub fn is_valid_user_window(hwnd: HWND) -> bool {
    unsafe {
        if !IsWindow(hwnd).as_bool() || !IsWindowVisible(hwnd).as_bool() {
            return false;
        }

        let desktop = GetDesktopWindow();
        let shell = GetShellWindow();
        if hwnd == desktop || hwnd == shell {
            return false;
        }

        // Filter out Windows Taskbar
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(hwnd, &mut class_name);
        if len > 0 {
            let class_str = String::from_utf16_lossy(&class_name[..len as usize]);
            if class_str == "Shell_TrayWnd" || class_str == "Shell_SecondaryTrayWnd" {
                return false;
            }
        }

        true
    }
}

/// Finds the target application window to snap
pub fn get_target_snap_window(altspace_hwnd: HWND) -> Option<HWND> {
    // 1. Try previously recorded window
    if let Ok(lock) = PREVIOUS_WINDOW.lock() {
        if let Some(h) = *lock {
            let hwnd = HWND(h as _);
            if is_valid_user_window(hwnd) {
                return Some(hwnd);
            }
        }
    }

    // 2. Fallback: scan z-order below AltSpace
    unsafe {
        let mut candidate = GetWindow(altspace_hwnd, GW_HWNDNEXT).unwrap_or_default();
        let mut depth = 0usize;
        while !candidate.0.is_null() && depth < 64 {
            if is_valid_user_window(candidate) {
                return Some(candidate);
            }
            candidate = GetWindow(candidate, GW_HWNDNEXT).unwrap_or_default();
            depth += 1;
        }
    }

    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapPosition {
    LeftHalf,
    RightHalf,
    TopHalf,
    BottomHalf,
    FirstThird,
    CenterThird,
    LastThird,
    LeftTwoThirds,
    RightTwoThirds,
    TopLeftQuarter,
    TopRightQuarter,
    BottomLeftQuarter,
    BottomRightQuarter,
    Maximize,
    Center,
}

impl SnapPosition {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "left" | "left-half" | "left_half" => Some(Self::LeftHalf),
            "right" | "right-half" | "right_half" => Some(Self::RightHalf),
            "top" | "top-half" | "top_half" => Some(Self::TopHalf),
            "bottom" | "bottom-half" | "bottom_half" => Some(Self::BottomHalf),
            "first-third" | "first_third" | "left-third" => Some(Self::FirstThird),
            "center-third" | "center_third" => Some(Self::CenterThird),
            "last-third" | "last_third" | "right-third" => Some(Self::LastThird),
            "left-two-thirds" | "left_two_thirds" => Some(Self::LeftTwoThirds),
            "right-two-thirds" | "right_two_thirds" => Some(Self::RightTwoThirds),
            "top-left" | "top_left" => Some(Self::TopLeftQuarter),
            "top-right" | "top_right" => Some(Self::TopRightQuarter),
            "bottom-left" | "bottom_left" => Some(Self::BottomLeftQuarter),
            "bottom-right" | "bottom_right" => Some(Self::BottomRightQuarter),
            "max" | "maximize" | "fullscreen" => Some(Self::Maximize),
            "center" | "middle" => Some(Self::Center),
            _ => None,
        }
    }

    /// Computes window bounds based on monitor work area (RECT: left, top, right, bottom)
    pub fn calculate_rect(&self, work: RECT) -> RECT {
        let work_x = work.left;
        let work_y = work.top;
        let work_w = work.right - work.left;
        let work_h = work.bottom - work.top;

        match self {
            Self::LeftHalf => RECT {
                left: work_x,
                top: work_y,
                right: work_x + work_w / 2,
                bottom: work_y + work_h,
            },
            Self::RightHalf => RECT {
                left: work_x + work_w / 2,
                top: work_y,
                right: work_x + work_w,
                bottom: work_y + work_h,
            },
            Self::TopHalf => RECT {
                left: work_x,
                top: work_y,
                right: work_x + work_w,
                bottom: work_y + work_h / 2,
            },
            Self::BottomHalf => RECT {
                left: work_x,
                top: work_y + work_h / 2,
                right: work_x + work_w,
                bottom: work_y + work_h,
            },
            Self::FirstThird => RECT {
                left: work_x,
                top: work_y,
                right: work_x + work_w / 3,
                bottom: work_y + work_h,
            },
            Self::CenterThird => RECT {
                left: work_x + work_w / 3,
                top: work_y,
                right: work_x + (2 * work_w) / 3,
                bottom: work_y + work_h,
            },
            Self::LastThird => RECT {
                left: work_x + (2 * work_w) / 3,
                top: work_y,
                right: work_x + work_w,
                bottom: work_y + work_h,
            },
            Self::LeftTwoThirds => RECT {
                left: work_x,
                top: work_y,
                right: work_x + (2 * work_w) / 3,
                bottom: work_y + work_h,
            },
            Self::RightTwoThirds => RECT {
                left: work_x + work_w / 3,
                top: work_y,
                right: work_x + work_w,
                bottom: work_y + work_h,
            },
            Self::TopLeftQuarter => RECT {
                left: work_x,
                top: work_y,
                right: work_x + work_w / 2,
                bottom: work_y + work_h / 2,
            },
            Self::TopRightQuarter => RECT {
                left: work_x + work_w / 2,
                top: work_y,
                right: work_x + work_w,
                bottom: work_y + work_h / 2,
            },
            Self::BottomLeftQuarter => RECT {
                left: work_x,
                top: work_y + work_h / 2,
                right: work_x + work_w / 2,
                bottom: work_y + work_h,
            },
            Self::BottomRightQuarter => RECT {
                left: work_x + work_w / 2,
                top: work_y + work_h / 2,
                right: work_x + work_w,
                bottom: work_y + work_h,
            },
            Self::Center => RECT {
                left: work_x + work_w / 6,
                top: work_y + work_h / 6,
                right: work_x + (5 * work_w) / 6,
                bottom: work_y + (5 * work_h) / 6,
            },
            Self::Maximize => work,
        }
    }
}

/// Snaps the target window to the requested position
pub fn snap_active_window(altspace_hwnd: HWND, position_str: &str) -> Result<(), String> {
    let position = SnapPosition::from_str(position_str)
        .ok_or_else(|| format!("Invalid snap position: {}", position_str))?;

    let target_hwnd = get_target_snap_window(altspace_hwnd)
        .ok_or_else(|| "No target application window found to snap".to_string())?;

    unsafe {
        // Un-maximize if currently maximized so SetWindowPos works accurately
        let _ = ShowWindow(target_hwnd, SW_RESTORE);

        if position == SnapPosition::Maximize {
            let _ = ShowWindow(target_hwnd, SW_MAXIMIZE);
            return Ok(());
        }

        // Get monitor work area for the target window
        let monitor = MonitorFromWindow(target_hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if !GetMonitorInfoW(monitor, &mut mi).as_bool() {
            return Err("Failed to query monitor work area".into());
        }

        let rect = position.calculate_rect(mi.rcWork);
        let x = rect.left;
        let y = rect.top;
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;

        let res = SetWindowPos(
            target_hwnd,
            HWND_TOP,
            x,
            y,
            w,
            h,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );

        if res.is_err() {
            return Err("Failed to reposition window".into());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snap_position_parsing() {
        assert_eq!(SnapPosition::from_str("left"), Some(SnapPosition::LeftHalf));
        assert_eq!(SnapPosition::from_str("RIGHT"), Some(SnapPosition::RightHalf));
        assert_eq!(SnapPosition::from_str("center"), Some(SnapPosition::Center));
        assert_eq!(SnapPosition::from_str("max"), Some(SnapPosition::Maximize));
        assert_eq!(SnapPosition::from_str("invalid_pos"), None);
    }

    #[test]
    fn test_calculate_rect_half_split() {
        let work = RECT {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };

        let left = SnapPosition::LeftHalf.calculate_rect(work);
        assert_eq!(left.left, 0);
        assert_eq!(left.right, 960);
        assert_eq!(left.bottom, 1080);

        let right = SnapPosition::RightHalf.calculate_rect(work);
        assert_eq!(right.left, 960);
        assert_eq!(right.right, 1920);
        assert_eq!(right.bottom, 1080);
    }

    #[test]
    fn test_calculate_rect_third_split() {
        let work = RECT {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };

        let center_third = SnapPosition::CenterThird.calculate_rect(work);
        assert_eq!(center_third.left, 640);
        assert_eq!(center_third.right, 1280);
        assert_eq!(center_third.bottom, 1080);
    }
}
