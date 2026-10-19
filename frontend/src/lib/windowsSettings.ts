export interface WindowsSettingItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Windows Settings";
  uri: string;
  keywords: string[];
  area: string;
}

export const WINDOWS_SETTINGS: WindowsSettingItem[] = [
  // System & Display
  {
    id: "win-setting-display",
    title: "Display Settings",
    subtitle: "Resolution, scaling, multiple displays, brightness, night light",
    category: "Windows Settings",
    uri: "ms-settings:display",
    keywords: ["display", "monitor", "resolution", "scaling", "brightness", "night light", "hdr"],
    area: "System",
  },
  {
    id: "win-setting-sound",
    title: "Sound Settings",
    subtitle: "Audio output, volume mixer, input devices, spatial audio",
    category: "Windows Settings",
    uri: "ms-settings:sound",
    keywords: ["sound", "audio", "volume", "microphone", "speaker", "headphones", "mixer"],
    area: "System",
  },
  {
    id: "win-setting-notifications",
    title: "Notifications & Do Not Disturb",
    subtitle: "Focus sessions, app banners, lock screen alerts",
    category: "Windows Settings",
    uri: "ms-settings:notifications",
    keywords: ["notifications", "focus", "do not disturb", "dnd", "alerts", "quiet hours"],
    area: "System",
  },
  {
    id: "win-setting-power",
    title: "Power & Battery",
    subtitle: "Sleep mode, screen timeout, energy saver, battery health",
    category: "Windows Settings",
    uri: "ms-settings:powersleep",
    keywords: ["power", "battery", "sleep", "screen off", "energy", "performance mode"],
    area: "System",
  },
  {
    id: "win-setting-storage",
    title: "Storage & Cleanup Recommendations",
    subtitle: "Storage Sense, temporary files cleanup, disk space usage",
    category: "Windows Settings",
    uri: "ms-settings:storagesense",
    keywords: ["storage", "disk", "clean", "temp files", "free space", "space"],
    area: "System",
  },
  {
    id: "win-setting-multitasking",
    title: "Multitasking & Snap Windows",
    subtitle: "Snap layouts, virtual desktops, Alt+Tab window switching",
    category: "Windows Settings",
    uri: "ms-settings:multitasking",
    keywords: ["multitasking", "snap", "virtual desktop", "alt tab", "split screen"],
    area: "System",
  },
  {
    id: "win-setting-about",
    title: "About Your PC",
    subtitle: "Device specifications, Windows version, build, rename PC",
    category: "Windows Settings",
    uri: "ms-settings:about",
    keywords: ["about", "specs", "system info", "ram", "cpu", "windows version", "processor"],
    area: "System",
  },

  // Bluetooth & Devices
  {
    id: "win-setting-bluetooth",
    title: "Bluetooth & Devices",
    subtitle: "Pair wireless devices, audio headsets, mice, keyboards",
    category: "Windows Settings",
    uri: "ms-settings:bluetooth",
    keywords: ["bluetooth", "pair", "wireless", "headset", "earbuds", "controller"],
    area: "Devices",
  },
  {
    id: "win-setting-printers",
    title: "Printers & Scanners",
    subtitle: "Manage print queues, scanner devices, network printers",
    category: "Windows Settings",
    uri: "ms-settings:printers",
    keywords: ["printers", "scanners", "print", "fax", "spooler"],
    area: "Devices",
  },
  {
    id: "win-setting-mouse",
    title: "Mouse Settings",
    subtitle: "Cursor speed, primary button, scrolling lines, pointer style",
    category: "Windows Settings",
    uri: "ms-settings:mousetouchpad",
    keywords: ["mouse", "cursor", "pointer", "scroll", "dpi", "touchpad"],
    area: "Devices",
  },

  // Network & Internet
  {
    id: "win-setting-wifi",
    title: "Wi-Fi Settings",
    subtitle: "Available wireless networks, Wi-Fi properties, random hardware addresses",
    category: "Windows Settings",
    uri: "ms-settings:network-wifi",
    keywords: ["wifi", "wi-fi", "wireless", "wlan", "network", "internet", "ssid"],
    area: "Network",
  },
  {
    id: "win-setting-ethernet",
    title: "Ethernet Network Settings",
    subtitle: "IP configuration, DNS servers, network adapter properties",
    category: "Windows Settings",
    uri: "ms-settings:network-ethernet",
    keywords: ["ethernet", "lan", "cable", "network", "adapter", "ip", "dns"],
    area: "Network",
  },
  {
    id: "win-setting-vpn",
    title: "VPN Connections",
    subtitle: "Virtual Private Network profiles and proxy settings",
    category: "Windows Settings",
    uri: "ms-settings:network-vpn",
    keywords: ["vpn", "tunnel", "proxy", "network security"],
    area: "Network",
  },

  // Personalization
  {
    id: "win-setting-themes",
    title: "Themes & Colors",
    subtitle: "Dark/Light mode switch, accent colors, desktop background wallpaper",
    category: "Windows Settings",
    uri: "ms-settings:personalization-colors",
    keywords: ["dark mode", "light mode", "theme", "accent color", "wallpaper", "personalization"],
    area: "Personalization",
  },
  {
    id: "win-setting-taskbar",
    title: "Taskbar Behaviors & Icons",
    subtitle: "Taskbar alignment (center/left), auto-hide, system tray overflow",
    category: "Windows Settings",
    uri: "ms-settings:taskbar",
    keywords: ["taskbar", "dock", "system tray", "center taskbar", "auto-hide taskbar"],
    area: "Personalization",
  },
  {
    id: "win-setting-lockscreen",
    title: "Lock Screen Settings",
    subtitle: "Lock screen pictures, Windows Spotlight, status widgets",
    category: "Windows Settings",
    uri: "ms-settings:lockscreen",
    keywords: ["lockscreen", "lock screen", "spotlight", "screensaver"],
    area: "Personalization",
  },

  // Apps
  {
    id: "win-setting-installed-apps",
    title: "Installed Apps & Features",
    subtitle: "Search, uninstall, modify, and repair installed desktop applications",
    category: "Windows Settings",
    uri: "ms-settings:appsfeatures",
    keywords: ["apps", "installed apps", "uninstall", "programs", "features", "remove software"],
    area: "Apps",
  },
  {
    id: "win-setting-startup-apps",
    title: "Startup Apps Manager",
    subtitle: "Control apps that automatically start when logging in to Windows",
    category: "Windows Settings",
    uri: "ms-settings:startupapps",
    keywords: ["startup", "autostart", "boot apps", "login items"],
    area: "Apps",
  },
  {
    id: "win-setting-default-apps",
    title: "Default Apps & File Associations",
    subtitle: "Set default web browser, media player, email client, file extensions",
    category: "Windows Settings",
    uri: "ms-settings:defaultapps",
    keywords: ["default apps", "browser", "file associations", "open with"],
    area: "Apps",
  },

  // Accounts & Security
  {
    id: "win-setting-sign-in",
    title: "Sign-in Options (Windows Hello)",
    subtitle: "PIN, fingerprint scanner, facial recognition, security key, passwords",
    category: "Windows Settings",
    uri: "ms-settings:signinoptions",
    keywords: ["windows hello", "pin", "fingerprint", "face id", "password", "security key"],
    area: "Accounts",
  },
  {
    id: "win-setting-defender",
    title: "Windows Security & Defender",
    subtitle: "Virus & threat protection, firewall, core isolation, memory integrity",
    category: "Windows Settings",
    uri: "ms-settings:windowsdefender",
    keywords: ["security", "defender", "antivirus", "firewall", "threat protection"],
    area: "Privacy & Security",
  },

  // Windows Update & Developer
  {
    id: "win-setting-update",
    title: "Windows Update",
    subtitle: "Check for updates, update history, pause updates, delivery optimization",
    category: "Windows Settings",
    uri: "ms-settings:windowsupdate",
    keywords: ["windows update", "check update", "patch", "restart", "upgrade"],
    area: "Update",
  },
  {
    id: "win-setting-developers",
    title: "Developer Settings",
    subtitle: "Developer mode, remote desktop, device discovery, symlinks",
    category: "Windows Settings",
    uri: "ms-settings:developers",
    keywords: ["developer", "developer mode", "symlinks", "sideload", "remote desktop"],
    area: "System",
  },
  {
    id: "win-setting-control-panel",
    title: "Legacy Control Panel",
    subtitle: "Classic Windows Control Panel applet explorer",
    category: "Windows Settings",
    uri: "control",
    keywords: ["control panel", "classic", "legacy control", "applets"],
    area: "Control Panel",
  },
  {
    id: "win-setting-device-manager",
    title: "Device Manager",
    subtitle: "View and update hardware drivers, graphics cards, USB controllers",
    category: "Windows Settings",
    uri: "devmgmt.msc",
    keywords: ["device manager", "drivers", "hardware", "gpu driver", "usb"],
    area: "Hardware",
  },
  {
    id: "win-setting-task-manager",
    title: "Task Manager",
    subtitle: "Monitor running processes, performance, disk, CPU, GPU utilization",
    category: "Windows Settings",
    uri: "taskmgr",
    keywords: ["task manager", "taskmgr", "processes", "kill process", "performance", "cpu", "ram"],
    area: "System Tools",
  },
];

export function searchWindowsSettings(query: string): WindowsSettingItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Match title, subtitle, area, or keywords
  return WINDOWS_SETTINGS.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.subtitle.toLowerCase().includes(q)) return true;
    if (item.area.toLowerCase().includes(q)) return true;
    return item.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
  }).slice(0, 8);
}
