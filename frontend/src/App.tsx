import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Folder,
  Zap,
  Terminal,
  ExternalLink,
  Copy,
  ChevronRight,
  Check,
  X,
  FileCode,
  HardDrive,
  Clipboard as ClipboardIcon,
  Activity,
  Shield,
  Trash2,
  Globe,
  Palette,
  Braces,
  RefreshCw,
  Skull,
  Flame,
  Power,
  Calculator,
  Lock,
  Code,
  Package,
  Layers,
  Play,
  BookOpen,
  GitBranch,
  Eye,
  FileText,
  Settings,
  AlignLeft,
  LayoutGrid,
  Gamepad2,
  PanelRightClose,
  PanelRightOpen
} from "lucide-react";
import { cn } from "./lib/utils";
import { evaluateSmartQuery, type CalcResult } from "./lib/calc";
import { evaluateQuickJump, type QuickJumpResult } from "./lib/quickjumps";
import { searchSnippets, type SnippetMatch } from "./lib/snippets";
import { searchWindowsSettings } from "./lib/windowsSettings";
import { searchWindowSnaps } from "./lib/windowSnaps";
import {
  PRESET_THEMES,
  resolveTheme,
  getSavedThemeId,
  saveThemeId,
  getSavedCustomAccent,
  saveCustomAccent
} from "./lib/theme";

interface ShellResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
}

interface TerminalCardData {
  command: string;
  result: ShellResult | null;
  isRunning: boolean;
}

interface GameItem {
  id: string;
  title: string;
  platform: string;
  install_path: string;
  executable_path: string | null;
  launch_uri: string;
  banner_url: string | null;
  size_gb: number | null;
}

type SpecialCard =
  | { kind: "calc"; data: CalcResult }
  | { kind: "quickjump"; data: QuickJumpResult }
  | { kind: "snippet"; data: SnippetMatch }
  | { kind: "terminal"; data: TerminalCardData };

import { invoke } from "@tauri-apps/api/core";

async function tauriInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[Tauri] ${cmd} call error:`, err);
    return null;
  }
}

const APP_CACHE_KEY = "raycast_app_cache_v2";

function saveCachedApps(apps: Item[]) {
  try {
    if (Array.isArray(apps) && apps.length > 0) {
      localStorage.setItem(APP_CACHE_KEY, JSON.stringify(apps.slice(0, 25)));
    }
  } catch (_) {}
}

const FREQ_CACHE_KEY = "raycast_item_frequency_v1";

function recordItemUsage(idOrPath: string) {
  try {
    const raw = localStorage.getItem(FREQ_CACHE_KEY);
    const freqs: Record<string, number> = raw ? JSON.parse(raw) : {};
    freqs[idOrPath] = (freqs[idOrPath] || 0) + 1;
    localStorage.setItem(FREQ_CACHE_KEY, JSON.stringify(freqs));
  } catch (_) {}
}

function getItemFrequencies(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FREQ_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function sortByFrequency(list: Item[]): Item[] {
  const freqs = getItemFrequencies();
  return [...list].sort((a, b) => {
    const freqA = freqs[a.path] || freqs[a.id] || 0;
    const freqB = freqs[b.path] || freqs[b.id] || 0;
    return freqB - freqA;
  });
}

function getCachedOrInitialApps(): Item[] {
  try {
    const raw = localStorage.getItem(APP_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortByFrequency(parsed);
      }
    }
  } catch (_) {}
  return sortByFrequency(DEFAULT_APPS);
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const subIdx = lowerText.indexOf(q);
  if (subIdx !== -1) {
    return (
      <>
        {text.slice(0, subIdx)}
        <span className="text-amber-400 font-semibold bg-amber-400/20 px-0.5 rounded">
          {text.slice(subIdx, subIdx + q.length)}
        </span>
        {text.slice(subIdx + q.length)}
      </>
    );
  }

  // Fast path for long path strings to prevent DOM highlight thrashing
  if (text.length > 50 || q.length > 15) return text;

  const chars: React.ReactNode[] = [];
  let qIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (qIdx < q.length && char.toLowerCase() === q[qIdx]) {
      chars.push(
        <span key={i} className="text-amber-400 font-semibold bg-amber-400/20 px-0.5 rounded">
          {char}
        </span>
      );
      qIdx++;
    } else {
      chars.push(char);
    }
  }
  return chars;
}

function formatDisplayPath(path: string): string {
  if (!path) return "";
  const lower = path.toLowerCase();
  if (lower.includes("start menu\\programs\\")) {
    const parts = path.split(/start menu\\programs\\/i);
    if (parts.length > 1) {
      return "Start Menu > " + parts[1].replace(/\.lnk$/i, "");
    }
  }
  if (lower.includes("appdata\\local\\programs\\")) {
    const parts = path.split(/appdata\\local\\programs\\/i);
    if (parts.length > 1) {
      return "Local > " + parts[1];
    }
  }
  if (lower.includes("program files\\")) {
    const parts = path.split(/program files\\/i);
    if (parts.length > 1) {
      return "Program Files > " + parts[1];
    }
  }
  const driveMatch = path.match(/^([A-Za-z]:)/);
  const drivePrefix = driveMatch ? driveMatch[1].toUpperCase() : "";
  const segments = path.replace(/\//g, "\\").split("\\").filter(Boolean);
  if (segments.length > 3) {
    if (drivePrefix && !segments.slice(-3)[0].toUpperCase().startsWith(drivePrefix)) {
      return `${drivePrefix} > ... > ${segments.slice(-2).join(" > ")}`;
    }
    return segments.slice(-3).join(" > ");
  }
  return path;
}

function MiniScreenBlueprint({ layoutType, className }: { layoutType: string; className?: string }) {
  return (
    <div className={cn("w-7 h-5 rounded-[4px] border border-white/20 bg-black/40 p-[1.5px] flex shrink-0 relative overflow-hidden shadow-sm", className)}>
      {layoutType === "left-half" && (
        <div className="w-1/2 h-full bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "right-half" && (
        <div className="w-1/2 h-full ml-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "top-half" && (
        <div className="w-full h-1/2 bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "bottom-half" && (
        <div className="w-full h-1/2 mt-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "maximize" && (
        <div className="w-full h-full bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "center" && (
        <div className="w-2/3 h-2/3 m-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "first-third" && (
        <div className="w-1/3 h-full bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "center-third" && (
        <div className="w-1/3 h-full mx-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "last-third" && (
        <div className="w-1/3 h-full ml-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "top-left" && (
        <div className="w-1/2 h-1/2 bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "top-right" && (
        <div className="w-1/2 h-1/2 ml-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "bottom-left" && (
        <div className="w-1/2 h-1/2 mt-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "bottom-right" && (
        <div className="w-1/2 h-1/2 ml-auto mt-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
    </div>
  );
}

function getItemSubtitle(item: Item): string {
  if (item.category === "Window Management") {
    return item.subtitle;
  }
  if (item.category === "Setting") {
    return item.subtitle;
  }
  if (item.category === "Snippet") {
    return item.subtitle;
  }
  if (item.category === "Game") {
    return item.subtitle;
  }
  if (item.category === "Theme") {
    return item.subtitle;
  }
  if (item.category === "Folder") {
    return formatDisplayPath(item.path);
  }
  return formatDisplayPath(item.subtitle || item.path);
}

function getDriveOrigin(path: string): string {
  const match = path.match(/^([A-Za-z]):/);
  if (!match) return "Local Storage";
  const letter = match[1].toUpperCase();
  if (letter === "C") return "Drive C: (System SSD)";
  if (letter === "D") return "Drive D: (Storage)";
  if (letter === "E") return "Drive E: (Storage)";
  if (letter === "F") return "Drive F: (Extra Volume)";
  return `Drive ${letter}: (Removable)`;
}

interface DriveIndexStats {
  search_all_drives: boolean;
  total_drives: number;
  drives: string[];
  indexed_count: number;
  is_indexing: boolean;
}

type Mode = "all" | "clipboard" | "ports";

interface Item {
  id: string;
  title: string;
  subtitle: string;
  category: "Application" | "File" | "Folder" | "Command" | "Setting" | "Snippet" | "Window Management" | "Game" | "Theme";
  iconType: "app" | "file" | "folder" | "cmd" | "setting" | "snippet" | "window-snap" | "game" | "theme";
  iconData?: string;
  path: string;
  size?: string;
  updated?: string;
  bannerUrl?: string;
  platform?: string;
}

interface PortItem {
  port: number;
  pid: number;
  process_name: string;
  state: string;
}

interface ClipboardHistoryItem {
  id: string;
  content: string;
  preview: string;
  content_type: string;
  timestamp: string;
  char_count: number;
  line_count: number;
}

interface GitInfo {
  is_repo: boolean;
  branch?: string;
  modified_count: number;
  untracked_count: number;
  last_commit_message?: string;
}

interface FilePreview {
  is_text: boolean;
  content?: string;
  extension: string;
  size_bytes: number;
}

const DEFAULT_APPS: Item[] = [
  {
    id: "app-code",
    title: "Visual Studio Code",
    subtitle: "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    category: "Application",
    iconType: "app",
    path: "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    size: "142 MB",
    updated: "Yesterday"
  },
  {
    id: "app-notion",
    title: "Notion",
    subtitle: "C:\\Program Files\\Notion\\Notion.exe",
    category: "Application",
    iconType: "app",
    path: "C:\\Program Files\\Notion\\Notion.exe",
    size: "231 MB",
    updated: "3 days ago"
  },
  {
    id: "app-obsidian",
    title: "Obsidian",
    subtitle: "C:\\Program Files\\Obsidian\\Obsidian.exe",
    category: "Application",
    iconType: "app",
    path: "C:\\Program Files\\Obsidian\\Obsidian.exe",
    size: "89 MB",
    updated: "Last week"
  },
  {
    id: "app-powershell",
    title: "PowerShell 7",
    subtitle: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    category: "Application",
    iconType: "cmd",
    path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    size: "12 MB",
    updated: "Oct 12"
  },
  {
    id: "app-everything",
    title: "voidtools Everything",
    subtitle: "C:\\Program Files\\Everything\\Everything.exe",
    category: "Application",
    iconType: "app",
    path: "C:\\Program Files\\Everything\\Everything.exe",
    size: "2.2 MB",
    updated: "Oct 18"
  }
];

const DEMO_PORTS: PortItem[] = [
  { port: 3000, pid: 14208, process_name: "node.exe", state: "LISTENING" },
  { port: 5173, pid: 8940, process_name: "vite.exe", state: "LISTENING" },
  { port: 8080, pid: 21304, process_name: "java.exe", state: "LISTENING" },
  { port: 5432, pid: 4912, process_name: "postgres.exe", state: "LISTENING" }
];

const DEMO_CLIPBOARD: ClipboardHistoryItem[] = [
  {
    id: "clip-1",
    content: "const fetchUser = async (id: string) => {\n  const res = await api.get(`/users/${id}`);\n  return res.data;\n};",
    preview: "const fetchUser = async (id: string) => { ...",
    content_type: "code",
    timestamp: "11:42 PM",
    char_count: 88,
    line_count: 4
  },
  {
    id: "clip-2",
    content: "#3B82F6",
    preview: "#3B82F6",
    content_type: "color",
    timestamp: "11:39 PM",
    char_count: 7,
    line_count: 1
  },
  {
    id: "clip-3",
    content: "https://linear.app/features/command-palette",
    preview: "https://linear.app/features/command-palette",
    content_type: "url",
    timestamp: "11:35 PM",
    char_count: 43,
    line_count: 1
  }
];

const UTILITY_ITEMS: Item[] = [
  {
    id: "util-clipboard",
    title: "Clipboard History",
    subtitle: "Search, preview, and restore copied items and snippets",
    category: "Command",
    iconType: "cmd",
    path: "raycast://clipboard",
  },
  {
    id: "util-ports",
    title: "Port Killer & Dev Inspector",
    subtitle: "Inspect localhost processes (:3000, :5173, :8080) and free ports",
    category: "Command",
    iconType: "cmd",
    path: "raycast://ports",
  },
  {
    id: "util-drives",
    title: "Hard Disks & Multi-Drive Settings",
    subtitle: "Manage index across drives C:, D:, E:, F: and external volumes",
    category: "Command",
    iconType: "cmd",
    path: "raycast://drives",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchSeq = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 120ms Debounce for Heavy Rust IPC Deep Multi-Drive Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // Search Items (Instant render from small cache)
  const [items, setItems] = useState<Item[]>(getCachedOrInitialApps);

  // Multi-Drive Project Folders & Suggested Workspaces
  const [suggestedProjects, setSuggestedProjects] = useState<Item[]>([]);

  useEffect(() => {
    tauriInvoke<any[]>("get_suggested_projects")
      .then((res) => {
        if (res && Array.isArray(res) && res.length > 0) {
          setSuggestedProjects(
            res.map((r: any) => ({
              id: r.id,
              title: r.title,
              subtitle: r.subtitle,
              category: r.category,
              iconType: r.icon_type,
              iconData: r.icon_data || undefined,
              path: r.path,
              size: r.size || undefined,
              updated: r.updated || undefined,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Dev Ports
  const [ports, setPorts] = useState<PortItem[]>(DEMO_PORTS);
  const [portStatusMsg, setPortStatusMsg] = useState<string | null>(null);

  // Clipboard
  const [clipboardItems, setClipboardItems] = useState<ClipboardHistoryItem[]>(DEMO_CLIPBOARD);
  const [clipboardFilter, setClipboardFilter] = useState<"all" | "code" | "url" | "color" | "text">("all");
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // 21st.dev Theme Engine (Preserves Raycast Obsidian, Midnight Void OLED, Tokyo Night, Vercel Clean, Emerald Matrix)
  const [currentThemeId, setCurrentThemeId] = useState<string>(getSavedThemeId);
  const [customAccent, setCustomAccent] = useState<string | null>(getSavedCustomAccent);
  const activeTheme = resolveTheme(currentThemeId, customAccent);

  // Auto-Adaptive Minimalist Sidebar State
  const [manualSidebarToggle, setManualSidebarToggle] = useState<boolean | null>(null);
  const isAutoRichRef = useRef(false);

  const handleSelectTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
    saveThemeId(themeId);
    const target = PRESET_THEMES.find((t) => t.id === themeId);
    setCopiedNotification(`Theme activated: ${target?.name || themeId}`);
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  const handleCycleTheme = () => {
    const idx = PRESET_THEMES.findIndex((t) => t.id === currentThemeId);
    const nextTheme = PRESET_THEMES[(idx + 1) % PRESET_THEMES.length];
    handleSelectTheme(nextTheme.id);
  };

  const handleSetCustomAccent = () => {
    const hex = prompt("Enter a custom accent color (HEX format, e.g. #00f2fe, #ff6363, #a855f7):", activeTheme.accentHex);
    if (!hex) return;
    const clean = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      setCustomAccent(clean);
      saveCustomAccent(clean);
      setCopiedNotification(`Custom Accent Set: ${clean}`);
      setTimeout(() => setCopiedNotification(null), 2000);
    } else {
      alert("Please enter a valid 6-character hex code starting with # (e.g. #3b82f6)");
    }
  };

  const handleResetCustomAccent = () => {
    setCustomAccent(null);
    try {
      localStorage.removeItem("altspace_custom_accent_hex_v1");
    } catch (_) {}
    setCopiedNotification("Accent reset to preset default");
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  const handleExportConfig = () => {
    const config = {
      app: "AltSpace",
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      theme_id: currentThemeId,
      custom_accent: customAccent,
      autostart: autostart,
      search_all_drives: driveStats?.search_all_drives ?? true,
      item_frequencies: getItemFrequencies(),
    };
    const jsonStr = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedNotification("AltSpace Config copied to clipboard (.altconfig JSON)!");
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  const handleImportConfig = () => {
    try {
      const input = prompt("Paste your AltSpace configuration JSON bundle (.altconfig):");
      if (!input || !input.trim()) return;
      const parsed = JSON.parse(input.trim());
      if (parsed.theme_id && typeof parsed.theme_id === "string") {
        setCurrentThemeId(parsed.theme_id);
        saveThemeId(parsed.theme_id);
      }
      if (parsed.custom_accent !== undefined) {
        setCustomAccent(parsed.custom_accent);
        if (parsed.custom_accent) saveCustomAccent(parsed.custom_accent);
      }
      if (parsed.item_frequencies && typeof parsed.item_frequencies === "object") {
        localStorage.setItem(FREQ_CACHE_KEY, JSON.stringify(parsed.item_frequencies));
      }
      setCopiedNotification("Configuration imported successfully!");
      setTimeout(() => setCopiedNotification(null), 2500);
    } catch (e: any) {
      alert("Invalid configuration JSON: " + e.message);
    }
  };

  // Autostart Option (Decision 3)
  const [autostart, setAutostart] = useState(false);

  // Power UX & Dev states (Choice 2 & 3)
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [terminalResult, setTerminalResult] = useState<ShellResult | null>(null);
  const [terminalRunning, setTerminalRunning] = useState(false);

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionSelectedIndex, setActionSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Smart Prefix Rule 3-a: If query starts with ':', force Port Killer mode
  const isSmartPortPrefix = query.startsWith(":");
  const currentMode: Mode = isSmartPortPrefix ? "ports" : activeTab;

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentMode]);

  // Load autostart status on startup
  useEffect(() => {
    tauriInvoke<boolean>("get_autostart_status")
      .then((status) => {
        if (typeof status === "boolean") setAutostart(status);
      })
      .catch(() => {});
  }, []);

  const handleToggleAutostart = async () => {
    const next = !autostart;
    try {
      await tauriInvoke("set_autostart", { enable: next });
      setAutostart(next);
      setCopiedNotification(next ? "Autostart on Boot: Enabled" : "Autostart on Boot: Disabled");
      setTimeout(() => setCopiedNotification(null), 2500);
      return;
    } catch (err: any) {
      alert("Failed to update autostart: " + err);
      return;
    }
  };

  // Multi-Drive Hard Disk Search (All Disks: C:, D:, E:, F: + External)
  const [driveStats, setDriveStats] = useState<DriveIndexStats | null>(null);

  useEffect(() => {
    tauriInvoke<DriveIndexStats>("get_drive_settings")
      .then((stats) => {
        if (stats) setDriveStats(stats);
      })
      .catch(() => {});
  }, []);

  const handleToggleAllDrives = async () => {
    const current = driveStats?.search_all_drives ?? true;
    const next = !current;
    try {
      const updated = await tauriInvoke<DriveIndexStats>("set_search_all_drives", { enabled: next });
      if (updated) setDriveStats(updated);
      setCopiedNotification(
        next ? "Multi-Drive Search: Enabled (All Hard Disks & External)" : "Multi-Drive Search: Disabled (C: Only)"
      );
      setTimeout(() => setCopiedNotification(null), 2500);
    } catch (err: any) {
      console.error("Failed to toggle drive search:", err);
    }
  };

  const handleRescanDrives = async () => {
    try {
      setCopiedNotification("Rescanning all hard disks...");
      const updated = await tauriInvoke<DriveIndexStats>("rescan_drives");
      if (updated) setDriveStats(updated);
      setTimeout(() => {
        setCopiedNotification("Drives indexed successfully!");
        setTimeout(() => setCopiedNotification(null), 2000);
      }, 1200);
    } catch (err: any) {
      console.error("Failed to rescan drives:", err);
    }
  };

  const handleDismissWindow = async () => {
    try {
      await tauriInvoke("hide_window");
    } catch (_) {}
  };

  // Load listening ports
  const fetchPorts = async () => {
    try {
      const res = await tauriInvoke<PortItem[]>("get_listening_ports");
      if (res && Array.isArray(res) && res.length > 0) {
        setPorts(res);
      }
    } catch (_) {}
  };

  // Load clipboard history
  const fetchClipboard = async () => {
    try {
      const res = await tauriInvoke<ClipboardHistoryItem[]>("get_clipboard_history");
      if (res && Array.isArray(res) && res.length > 0) {
        setClipboardItems(res);
      }
    } catch (_) {}
  };

  // Load installed games across Steam, Epic, Xbox, and PC directories
  const [installedGames, setInstalledGames] = useState<GameItem[]>([]);
  const fetchGames = async () => {
    try {
      const res = await tauriInvoke<GameItem[]>("get_installed_games");
      if (res && Array.isArray(res)) {
        setInstalledGames(res);
      }
    } catch (_) {}
  };

  // Poll ports, clipboard, and games
  useEffect(() => {
    fetchPorts();
    fetchClipboard();
    fetchGames();

    const interval = setInterval(() => {
      if (currentMode === "ports") {
        fetchPorts();
      } else if (currentMode === "clipboard") {
        fetchClipboard();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentMode]);

  // Auto-focus search input on summon or window focus & listen to System Tray events
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let unlistenMode: (() => void) | null = null;
    let unlistenUpdates: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("window-summoned", () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }).then((fn) => {
        unlisten = fn;
      });

      listen<string>("open-mode", (e) => {
        if (e.payload === "clipboard") {
          setActiveTab("clipboard");
          setQuery("");
        } else if (e.payload === "ports") {
          setActiveTab("ports");
          setQuery("");
        } else if (e.payload === "games") {
          setActiveTab("all");
          setQuery(":game");
        }
      }).then((fn) => {
        unlistenMode = fn;
      });

      listen("check-updates", () => {
        setCopiedNotification("AltSpace is running the latest version (v1.0.0)");
        setTimeout(() => setCopiedNotification(null), 3000);
      }).then((fn) => {
        unlistenUpdates = fn;
      });
    }).catch(() => {});

    const onWindowFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("focus", onWindowFocus);

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      const isKeyK = e.key?.toLowerCase() === "k" || e.code === "KeyK";
      if (isKeyK && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        setShowActionsModal((prev) => !prev);
        setActionSelectedIndex(0);
      }

      const isKeyB = e.key?.toLowerCase() === "b" || e.code === "KeyB";
      if (isKeyB && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        setManualSidebarToggle((prev) => (prev === null ? !isAutoRichRef.current : !prev));
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown, true);

    return () => {
      if (unlisten) unlisten();
      if (unlistenMode) unlistenMode();
      if (unlistenUpdates) unlistenUpdates();
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("keydown", onGlobalKeyDown, true);
    };
  }, []);

  // Handle Search for "all" mode
  useEffect(() => {
    if (currentMode !== "all") return;

    function executeSearch() {
      const qTrim = query.trim();
      const settingsMatches = qTrim ? searchWindowsSettings(qTrim) : [];
      const settingItems: Item[] = settingsMatches.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: `Windows 11 ${s.area} • ${s.subtitle}`,
        category: "Setting",
        iconType: "setting",
        path: s.uri,
      }));

      const snippetMatches = qTrim ? searchSnippets(qTrim) : [];
      const snippetItems: Item[] = snippetMatches.map((m) => ({
        id: m.snippet.id,
        title: `${m.snippet.name} (${m.snippet.keyword})`,
        subtitle: `Expand snippet: "${m.resolvedContent.slice(0, 60)}"`,
        category: "Snippet",
        iconType: "snippet",
        path: m.resolvedContent,
      }));

      const snapMatches = qTrim ? searchWindowSnaps(qTrim) : [];
      const snapItems: Item[] = snapMatches.map((snap) => ({
        id: snap.id,
        title: snap.title,
        subtitle: snap.subtitle,
        category: "Window Management",
        iconType: "window-snap",
        path: snap.position,
        size: snap.layoutType,
      }));

      // Native Installed Games Matching (Steam, Epic, Xbox, PC)
      const qLower = qTrim.toLowerCase();
      const isGameFilter = qLower === ":game" || qLower === ":games" || qLower.startsWith(":game ");
      const gameSearchText = isGameFilter ? qLower.replace(/^:games?\s*/, "") : qLower;

      const matchedGames = installedGames.filter((g) => {
        if (isGameFilter) {
          if (!gameSearchText) return true;
          return g.title.toLowerCase().includes(gameSearchText) || g.platform.toLowerCase().includes(gameSearchText);
        }
        return g.title.toLowerCase().includes(qLower) || (qLower.length >= 3 && g.platform.toLowerCase().includes(qLower));
      });

      const gameItems: Item[] = matchedGames.map((g) => ({
        id: g.id,
        title: g.title,
        subtitle: `${g.platform} • ${g.size_gb ? `${g.size_gb} GB • ` : ""}${g.install_path}`,
        category: "Game",
        iconType: "game",
        path: g.launch_uri,
        size: g.size_gb ? `${g.size_gb} GB` : undefined,
        bannerUrl: g.banner_url || undefined,
        platform: g.platform,
      }));

      // 21st.dev Theme Engine Search Filter (:theme / :themes)
      const isThemeFilter = qLower === ":theme" || qLower === ":themes" || qLower.startsWith(":theme ");
      const themeSearchText = isThemeFilter ? qLower.replace(/^:themes?\s*/, "") : qLower;

      const matchedThemes = PRESET_THEMES.filter((t) => {
        if (isThemeFilter) {
          if (!themeSearchText) return true;
          return t.name.toLowerCase().includes(themeSearchText) || t.description.toLowerCase().includes(themeSearchText);
        }
        return (
          qLower.length >= 3 &&
          ("theme".includes(qLower) || "themes".includes(qLower) || t.name.toLowerCase().includes(qLower) || t.description.toLowerCase().includes(qLower))
        );
      });

      const themeItems: Item[] = matchedThemes.map((t) => ({
        id: `theme-${t.id}`,
        title: `${t.name}${t.id === currentThemeId ? " (Active)" : ""}`,
        subtitle: `${t.description} • Accent ${t.accentHex}`,
        category: "Theme",
        iconType: "theme",
        path: `theme://${t.id}`,
      }));

      if (isGameFilter) {
        setItems(gameItems);
        setSelectedIndex(0);
        return;
      }

      if (isThemeFilter) {
        setItems(themeItems);
        setSelectedIndex(0);
        return;
      }

      // 1. Instant 0ms Optimistic Filter (Immediate frame update)
      const fallbackList = getCachedOrInitialApps();
      if (!qTrim) {
        setItems(sortByFrequency(fallbackList));
      } else {
        const q = qTrim.toLowerCase();
        const filtered = fallbackList.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        );
        setItems([...themeItems, ...gameItems, ...snapItems, ...settingItems, ...snippetItems, ...filtered]);
      }
      setSelectedIndex(0);

    }

    executeSearch();
  }, [query, currentMode, currentThemeId]);

  // Phase 2: Asynchronous Debounced Deep Multi-Drive Search (Non-blocking L2 Index)
  useEffect(() => {
    if (currentMode !== "all") return;
    const qTrim = debouncedQuery.trim();
    if (!qTrim || qTrim.length < 2) return;
    if (qTrim.startsWith(":") || qTrim.startsWith(">") || qTrim.startsWith("!")) return;

    let active = true;
    const currentSeq = ++searchSeq.current;

    tauriInvoke<any[]>("search", { query: debouncedQuery })
      .then((res) => {
        if (!active || currentSeq !== searchSeq.current || !res || !Array.isArray(res) || res.length === 0) return;

        const mapped: Item[] = res.map((r: any) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          category: r.category,
          iconType: r.icon_type,
          iconData: r.icon_data || undefined,
          path: r.path,
          size: r.size || undefined,
          updated: r.updated || undefined,
        }));

        const appResults = mapped.filter((m) => m.category === "Application");
        if (appResults.length > 0) {
          saveCachedApps(appResults);
        }

        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = mapped.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newItems];
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [debouncedQuery, currentMode]);

  // Filtered dev ports
  const filteredPorts = ports.filter((p) => {
    const rawFilter = isSmartPortPrefix ? query.slice(1).trim().toLowerCase() : query.trim().toLowerCase();
    if (!rawFilter) return true;
    return (
      p.port.toString().includes(rawFilter) ||
      p.process_name.toLowerCase().includes(rawFilter) ||
      p.pid.toString().includes(rawFilter)
    );
  });

  // Filtered clipboard items with Raycast-style Type Filtering
  const filteredClipboard = clipboardItems.filter((c) => {
    if (clipboardFilter !== "all") {
      if (clipboardFilter === "code" && c.content_type !== "code" && c.content_type !== "json") return false;
      if (clipboardFilter === "url" && c.content_type !== "url") return false;
      if (clipboardFilter === "color" && c.content_type !== "color") return false;
      if (clipboardFilter === "text" && c.content_type !== "text") return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.content.toLowerCase().includes(q) || c.content_type.toLowerCase().includes(q);
  });

  const clipCounts = React.useMemo(() => {
    const counts = { all: clipboardItems.length, code: 0, url: 0, color: 0, text: 0 };
    for (const c of clipboardItems) {
      if (c.content_type === "code" || c.content_type === "json") counts.code++;
      else if (c.content_type === "url") counts.url++;
      else if (c.content_type === "color") counts.color++;
      else counts.text++;
    }
    return counts;
  }, [clipboardItems]);

  const quickLaunchApps = React.useMemo(() => {
    return items.filter((i) => i.category === "Application").slice(0, 5);
  }, [items]);

  const frequentApps = React.useMemo(() => {
    return items.filter((i) => i.category === "Application").slice(0, 8);
  }, [items]);

  const recentWorkspaces = React.useMemo(() => {
    if (suggestedProjects.length > 0) return suggestedProjects.slice(0, 6);
    return [
      {
        id: "proj-ss3d",
        title: "SS3D [Drive F:]",
        subtitle: "F:\\SS3D",
        category: "Folder" as const,
        iconType: "folder" as const,
        path: "F:\\SS3D",
      },
      {
        id: "proj-azure",
        title: "Azure IAM [Drive F:]",
        subtitle: "F:\\Azure IAM",
        category: "Folder" as const,
        iconType: "folder" as const,
        path: "F:\\Azure IAM",
      },
      {
        id: "proj-disha",
        title: "disha-archilab [Drive F:]",
        subtitle: "F:\\disha-archilab",
        category: "Folder" as const,
        iconType: "folder" as const,
        path: "F:\\disha-archilab",
      },
      {
        id: "proj-altspace",
        title: "altspace [Drive C:]",
        subtitle: "C:\\Users\\Public\\Projects\\altspace",
        category: "Folder" as const,
        iconType: "folder" as const,
        path: "C:\\Users\\Public\\Projects\\altspace",
      },
    ];
  }, [suggestedProjects]);

  const activeSuggestionsList = React.useMemo(() => {
    return [...frequentApps, ...recentWorkspaces, ...UTILITY_ITEMS];
  }, [frequentApps, recentWorkspaces]);

  const activeList = !query.trim() ? activeSuggestionsList : items.slice(0, 30);

  const calcResult: CalcResult | null = currentMode === "all" ? evaluateSmartQuery(query) : null;
  const quickJumpResult: QuickJumpResult | null = currentMode === "all" && !calcResult ? evaluateQuickJump(query) : null;
  const directSnippetMatch: SnippetMatch | null =
    currentMode === "all" && !calcResult && !quickJumpResult && query.trim().startsWith("!")
      ? searchSnippets(query.trim())[0] || null
      : null;

  const isTerminalCommand = currentMode === "all" && query.trim().startsWith(">");
  const terminalCmdText = isTerminalCommand ? query.trim().slice(1).trim() : "";

  const specialCard: SpecialCard | null = isTerminalCommand && terminalCmdText
    ? {
        kind: "terminal",
        data: {
          command: terminalCmdText,
          result: terminalResult,
          isRunning: terminalRunning,
        },
      }
    : calcResult
    ? { kind: "calc", data: calcResult }
    : quickJumpResult
    ? { kind: "quickjump", data: quickJumpResult }
    : directSnippetMatch
    ? { kind: "snippet", data: directSnippetMatch }
    : null;

  const selectedSpecial = currentMode === "all" && specialCard && selectedIndex === 0 ? specialCard : null;
  const selectedItemIndex = specialCard ? selectedIndex - 1 : selectedIndex;
  const selectedItem = currentMode === "all"
    ? (selectedSpecial ? null : activeList[selectedItemIndex] || activeList[0])
    : activeList[selectedIndex] || activeList[0];

  const selectedPort = filteredPorts[selectedIndex] || filteredPorts[0];
  const selectedClip = filteredClipboard[selectedIndex] || filteredClipboard[0];

  // Auto-Adaptive Rich Item Detection (Intelligent Context-Aware Expansion)
  const isAutoRich = React.useMemo(() => {
    if (currentMode === "clipboard") {
      return Boolean(selectedClip && (selectedClip.content.includes("\n") || selectedClip.content_type !== "text"));
    }
    if (currentMode === "ports") {
      return Boolean(selectedPort);
    }
    // "all" search mode:
    if (selectedSpecial) {
      return selectedSpecial.kind === "snippet" || selectedSpecial.kind === "terminal";
    }
    if (selectedItem) {
      if (selectedItem.category === "File" || selectedItem.category === "Folder") return true;
      if (selectedItem.category === "Game" && selectedItem.bannerUrl) return true;
    }
    return false;
  }, [currentMode, selectedClip, selectedPort, selectedSpecial, selectedItem]);

  useEffect(() => {
    isAutoRichRef.current = isAutoRich;
  }, [isAutoRich]);

  const isSidebarVisible = manualSidebarToggle !== null ? manualSidebarToggle : isAutoRich;

  // Fetch Git info and File preview whenever selected item changes (Choice 2 & 3)
  useEffect(() => {
    if (!selectedItem?.path) {
      setGitInfo(null);
      setFilePreview(null);
      return;
    }

    tauriInvoke<GitInfo>("get_git_info", { path: selectedItem.path })
      .then((info) => {
        if (info) setGitInfo(info);
        else setGitInfo(null);
      })
      .catch(() => setGitInfo(null));

    tauriInvoke<FilePreview>("read_file_preview", { path: selectedItem.path })
      .then((preview) => {
        if (preview) setFilePreview(preview);
        else setFilePreview(null);
      })
      .catch(() => setFilePreview(null));
  }, [selectedItem?.path]);

  // Actions
  const handleItemAction = (item: Item) => {
    if (item.id === "util-clipboard") {
      setActiveTab("clipboard");
      setQuery("");
    } else if (item.id === "util-ports") {
      setActiveTab("ports");
      setQuery("");
    } else if (item.id === "util-drives") {
      setShowActionsModal(true);
    } else if (item.category === "Setting") {
      handleOpenSettings(item.path);
    } else if (item.category === "Snippet") {
      handleCopyClipboard(item.path);
      setCopiedNotification(`Snippet copied & ready to paste!`);
      setTimeout(() => setCopiedNotification(null), 2500);
      setQuery("");
    } else if (item.category === "Window Management") {
      handleSnapWindow(item.path);
    } else if (item.category === "Game") {
      handleLaunchGame(item.path);
    } else if (item.category === "Theme") {
      const themeId = item.path.replace("theme://", "");
      handleSelectTheme(themeId);
      setQuery("");
    } else if (item.category === "Folder") {
      handleOpenFolder(item.path);
    } else {
      handleLaunch(item.path);
    }
  };

  const handleLaunchGame = async (launchUri: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("launch_game", { launchUri });
        setCopiedNotification("Launching Game...");
        setTimeout(() => setCopiedNotification(null), 2000);
        handleDismissWindow();
        return;
      } catch (err: any) {
        setPortStatusMsg(`Game launch error: ${err}`);
        setTimeout(() => setPortStatusMsg(null), 3500);
      }
    } else {
      alert(`Launch game: ${launchUri}`);
    }
  };

  const handleSnapWindow = async (position: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("snap_window", { position });
        handleDismissWindow();
        return;
      } catch (err: any) {
        setPortStatusMsg(`Snap error: ${err}`);
        setTimeout(() => setPortStatusMsg(null), 3000);
      }
    } else {
      alert(`Snap active window: ${position}`);
    }
  };

  const handleExecuteTerminalCommand = async (cmdText: string) => {
    if (!cmdText) return;
    setTerminalRunning(true);
    if (tauriInvoke) {
      try {
        const res = await tauriInvoke<ShellResult>("execute_shell_command", { command: cmdText });
        if (res) {
          setTerminalResult(res);
        }
      } catch (err: any) {
        setTerminalResult({
          success: false,
          exit_code: 1,
          stdout: "",
          stderr: String(err),
          elapsed_ms: 0,
        });
      } finally {
        setTerminalRunning(false);
      }
    } else {
      setTerminalRunning(false);
      alert(`Terminal command: ${cmdText}`);
    }
  };

  const handleLaunchTerminalWindow = async (cmdText: string) => {
    if (!cmdText) return;
    if (tauriInvoke) {
      try {
        await tauriInvoke("launch_in_terminal_window", { command: cmdText });
        handleDismissWindow();
      } catch (err: any) {
        setPortStatusMsg(`Terminal Error: ${err}`);
        setTimeout(() => setPortStatusMsg(null), 3000);
      }
    } else {
      alert(`Launch in terminal: ${cmdText}`);
    }
  };

  const handleOpenSettings = async (uri: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("open_settings_uri", { uri });
        setCopiedNotification(`Opening: ${uri}`);
        setTimeout(() => setCopiedNotification(null), 2000);
        handleDismissWindow();
        return;
      } catch (_) {}
    }
    window.open(uri, "_blank");
  };

  const handleLaunch = async (path: string) => {
    recordItemUsage(path);
    if (tauriInvoke) {
      try {
        await tauriInvoke("launch_item", { path });
        handleDismissWindow();
        return;
      } catch (_) {}
    }
    alert(`Opening: ${path}`);
  };

  const handlePurgeAllDevServers = async () => {
    try {
      const count = await tauriInvoke<number>("kill_all_dev_servers");
      setPortStatusMsg(`⚡ Successfully purged ${count || 0} orphaned dev servers!`);
      setTimeout(() => setPortStatusMsg(null), 3500);
      fetchPorts();
    } catch (err: any) {
      setPortStatusMsg(`Purge error: ${err}`);
      setTimeout(() => setPortStatusMsg(null), 3000);
    }
  };

  const handleOpenFolder = async (path: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("open_parent_folder", { path });
        return;
      } catch (_) {}
    }
    alert(`Opening folder for: ${path}`);
  };

  const handleOpenUrl = async (url: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("open_url", { url });
        setCopiedNotification("Opening in default browser...");
        setTimeout(() => setCopiedNotification(null), 2000);
        return;
      } catch (_) {}
    }
    window.open(url, "_blank");
  };

  const handleKillPort = async (pid: number, port: number) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("kill_port_process", { pid });
        setPortStatusMsg(`Terminated PID ${pid} (Port :${port} Freed)`);
        fetchPorts();
        setTimeout(() => setPortStatusMsg(null), 3000);
        return;
      } catch (err: any) {
        setPortStatusMsg(`Error: ${err}`);
        setTimeout(() => setPortStatusMsg(null), 3000);
        return;
      }
    }
    setPorts((prev) => prev.filter((p) => p.pid !== pid));
    setPortStatusMsg(`Killed simulated PID ${pid} (Port :${port})`);
    setTimeout(() => setPortStatusMsg(null), 3000);
  };

  const handleCopyClipboard = async (content: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("copy_clipboard_item", { content });
        setCopiedNotification("Copied to system clipboard!");
        setTimeout(() => setCopiedNotification(null), 2000);
        return;
      } catch (_) {}
    }
    navigator.clipboard.writeText(content);
    setCopiedNotification("Copied to system clipboard!");
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  const handleClearClipboard = async () => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("clear_clipboard_history");
        setClipboardItems([]);
        setCopiedNotification("RAM Clipboard Cleared");
        setTimeout(() => setCopiedNotification(null), 2000);
        return;
      } catch (_) {}
    }
    setClipboardItems([]);
  };

  interface ActionItem {
    id: string;
    title: string;
    section:
      | "PRIMARY ACTION"
      | "STANDARD ACTIONS"
      | "THEMES & APPEARANCE"
      | "CONFIG & BACKUP"
      | "DEVELOPER ACTIONS"
      | "DANGEROUS ACTIONS"
      | "PREFERENCES";
    shortcut?: string;
    icon: React.ReactNode;
    run: () => void | Promise<void>;
  }

  const getContextualActions = (): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (currentMode === "all") {
      if (selectedSpecial && selectedSpecial.kind === "calc") {
        actions.push({
          id: "calc-copy-result",
          title: selectedSpecial.data.systemAction ? `Execute: ${selectedSpecial.data.expression}` : `Copy Result (${selectedSpecial.data.result})`,
          section: "PRIMARY ACTION",
          shortcut: "↵",
          icon: <Copy className="w-4 h-4 text-emerald-400" />,
          run: () => {
            if (selectedSpecial.data.systemAction) {
              if (selectedSpecial.data.systemAction === "kill_all_dev_servers") {
                handlePurgeAllDevServers();
              } else if (tauriInvoke) {
                tauriInvoke("execute_system_command", { command: selectedSpecial.data.systemAction });
              }
            } else {
              handleCopyClipboard(selectedSpecial.data.result);
            }
            setShowActionsModal(false);
          }
        });
        if (!selectedSpecial.data.systemAction) {
          actions.push({
            id: "calc-copy-expression",
            title: `Copy Expression (${selectedSpecial.data.expression})`,
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+C",
            icon: <Copy className="w-4 h-4 text-neutral-400" />,
            run: () => {
              handleCopyClipboard(selectedSpecial.data.expression);
              setShowActionsModal(false);
            }
          });
        }
      } else if (selectedItem) {
        const isGame = selectedItem.category === "Game";
        const isApp = selectedItem.category === "Application";
        const isFolder = selectedItem.category === "Folder";
        const isFile = selectedItem.category === "File";
        const isSetting = selectedItem.category === "Setting";
        const isSnippet = selectedItem.category === "Snippet";

        // Primary Action
        actions.push({
          id: "item-primary",
          title: isGame
            ? "Play Game"
            : isApp
            ? "Launch Application"
            : isFolder
            ? "Open Folder"
            : isFile
            ? "Open File"
            : isSetting
            ? "Open Setting"
            : isSnippet
            ? "Insert Snippet"
            : "Open",
          section: "PRIMARY ACTION",
          shortcut: "↵",
          icon: isGame ? <Gamepad2 className="w-4 h-4 text-violet-400" /> : <Play className="w-4 h-4 text-emerald-400" />,
          run: () => {
            handleItemAction(selectedItem);
            setShowActionsModal(false);
          }
        });

        // App Specific: Run as Administrator
        if (isApp) {
          actions.push({
            id: "app-run-admin",
            title: "Run as Administrator",
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+Shift+↵",
            icon: <Shield className="w-4 h-4 text-amber-400" />,
            run: async () => {
              if (tauriInvoke) {
                try {
                  await tauriInvoke("run_as_admin", { path: selectedItem.path });
                  handleDismissWindow();
                } catch (err: any) {
                  setPortStatusMsg(`Admin Error: ${err}`);
                  setTimeout(() => setPortStatusMsg(null), 3000);
                }
              }
              setShowActionsModal(false);
            }
          });
        }

        // Files & Folders & Apps & Games: Reveal in Explorer
        if (isGame || isApp || isFolder || isFile) {
          actions.push({
            id: "item-reveal-explorer",
            title: "Reveal in File Explorer",
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+O",
            icon: <Folder className="w-4 h-4 text-blue-400" />,
            run: async () => {
              if (tauriInvoke) {
                try {
                  await tauriInvoke("reveal_in_explorer", { path: selectedItem.path });
                  handleDismissWindow();
                } catch (_) {}
              }
              setShowActionsModal(false);
            }
          });
        }

        // QuickLook for files & folders
        if (isFile || isFolder) {
          actions.push({
            id: "item-quicklook",
            title: "QuickLook Preview",
            section: "STANDARD ACTIONS",
            shortcut: "Space",
            icon: <Eye className="w-4 h-4 text-purple-400" />,
            run: () => {
              setQuickLookOpen(true);
              setShowActionsModal(false);
            }
          });
        }

        // Copy Path / Value
        actions.push({
          id: "item-copy-path",
          title: isSetting ? "Copy ms-settings URI" : isSnippet ? "Copy Snippet Text" : "Copy Full Path",
          section: "STANDARD ACTIONS",
          shortcut: "Ctrl+C",
          icon: <Copy className="w-4 h-4 text-neutral-400" />,
          run: async () => {
            if (tauriInvoke) {
              await tauriInvoke("copy_to_clipboard", { text: selectedItem.path });
            } else {
              navigator.clipboard.writeText(selectedItem.path);
            }
            setCopiedNotification(isSetting ? "Copied ms-settings URI" : "Copied path to clipboard");
            setTimeout(() => setCopiedNotification(null), 2000);
            setShowActionsModal(false);
          }
        });

        // Developer Actions (Terminal, VS Code) for Files, Folders, Apps
        if (isApp || isFolder || isFile) {
          actions.push({
            id: "item-open-terminal",
            title: "Open in Windows Terminal",
            section: "DEVELOPER ACTIONS",
            shortcut: "Ctrl+T",
            icon: <Terminal className="w-4 h-4 text-emerald-400" />,
            run: async () => {
              if (tauriInvoke) {
                try {
                  await tauriInvoke("open_in_terminal", { path: selectedItem.path });
                  handleDismissWindow();
                } catch (err: any) {
                  setPortStatusMsg(`Terminal Error: ${err}`);
                  setTimeout(() => setPortStatusMsg(null), 3000);
                }
              }
              setShowActionsModal(false);
            }
          });

          actions.push({
            id: "item-open-vscode",
            title: "Open in Visual Studio Code",
            section: "DEVELOPER ACTIONS",
            shortcut: "Ctrl+Shift+C",
            icon: <Code className="w-4 h-4 text-blue-400" />,
            run: async () => {
              if (tauriInvoke) {
                try {
                  await tauriInvoke("open_in_vscode", { path: selectedItem.path });
                  handleDismissWindow();
                } catch (err: any) {
                  setPortStatusMsg(`VS Code Error: ${err}`);
                  setTimeout(() => setPortStatusMsg(null), 3000);
                }
              }
              setShowActionsModal(false);
            }
          });
        }
      }
    } else if (currentMode === "ports" && selectedPort) {
      actions.push({
        id: "port-kill",
        title: `Kill Process Tree (PID ${selectedPort.pid})`,
        section: "PRIMARY ACTION",
        shortcut: "↵",
        icon: <Skull className="w-4 h-4 text-red-400" />,
        run: () => {
          handleKillPort(selectedPort.pid, selectedPort.port);
          setShowActionsModal(false);
        }
      });
      actions.push({
        id: "port-copy-pid",
        title: `Copy PID (${selectedPort.pid})`,
        section: "STANDARD ACTIONS",
        shortcut: "Ctrl+C",
        icon: <Copy className="w-4 h-4 text-neutral-400" />,
        run: () => {
          handleCopyClipboard(selectedPort.pid.toString());
          setShowActionsModal(false);
        }
      });
      actions.push({
        id: "port-open-browser",
        title: `Open http://localhost:${selectedPort.port}`,
        section: "STANDARD ACTIONS",
        shortcut: "Ctrl+B",
        icon: <Globe className="w-4 h-4 text-blue-400" />,
        run: () => {
          if (tauriInvoke) {
            tauriInvoke("open_url", { url: `http://localhost:${selectedPort.port}` });
          } else {
            window.open(`http://localhost:${selectedPort.port}`, "_blank");
          }
          setShowActionsModal(false);
        }
      });
      actions.push({
        id: "port-kill-all",
        title: "Kill All Dev Servers (:3000, :5173...)",
        section: "DANGEROUS ACTIONS",
        shortcut: ":kill",
        icon: <Flame className="w-4 h-4 text-amber-400" />,
        run: () => {
          handlePurgeAllDevServers();
          setShowActionsModal(false);
        }
      });
    } else if (currentMode === "clipboard" && selectedClip) {
      actions.push({
        id: "clip-paste",
        title: "Copy Clip to System Clipboard",
        section: "PRIMARY ACTION",
        shortcut: "↵",
        icon: <Copy className="w-4 h-4 text-emerald-400" />,
        run: () => {
          handleCopyClipboard(selectedClip.content);
          setShowActionsModal(false);
        }
      });
      actions.push({
        id: "clip-clear-all",
        title: "Clear Entire Clipboard Cache",
        section: "DANGEROUS ACTIONS",
        shortcut: "Ctrl+Del",
        icon: <Trash2 className="w-4 h-4 text-red-400" />,
        run: () => {
          handleClearClipboard();
          setShowActionsModal(false);
        }
      });
    }

    // Theme & Appearance (21st.dev Engine)
    actions.push({
      id: "theme-cycle",
      title: "Cycle Next Theme Preset",
      section: "THEMES & APPEARANCE",
      shortcut: "Ctrl+Shift+T",
      icon: <Palette className="w-4 h-4 text-purple-400" />,
      run: () => {
        handleCycleTheme();
        setShowActionsModal(false);
      },
    });

    PRESET_THEMES.forEach((t) => {
      actions.push({
        id: `theme-select-${t.id}`,
        title: `${t.name}${t.id === currentThemeId ? " (Active)" : ""}`,
        section: "THEMES & APPEARANCE",
        icon: (
          <span
            className="w-3.5 h-3.5 rounded-full inline-block border border-white/30 shrink-0 shadow-sm"
            style={{ backgroundColor: t.accentHex }}
          />
        ),
        run: () => {
          handleSelectTheme(t.id);
          setShowActionsModal(false);
        },
      });
    });

    actions.push({
      id: "theme-custom-accent",
      title: customAccent ? `Change Custom Accent (${customAccent})` : "Set Custom Hex Accent...",
      section: "THEMES & APPEARANCE",
      icon: <Palette className="w-4 h-4 text-cyan-400" />,
      run: () => {
        handleSetCustomAccent();
        setShowActionsModal(false);
      },
    });

    if (customAccent) {
      actions.push({
        id: "theme-reset-accent",
        title: "Reset Accent to Preset Default",
        section: "THEMES & APPEARANCE",
        icon: <RefreshCw className="w-4 h-4 text-neutral-400" />,
        run: () => {
          handleResetCustomAccent();
          setShowActionsModal(false);
        },
      });
    }

    // Config & Backup Bundle (.altconfig / JSON)
    actions.push({
      id: "config-export",
      title: "Export AltSpace Config (.altconfig JSON)",
      section: "CONFIG & BACKUP",
      shortcut: "Ctrl+Shift+E",
      icon: <Copy className="w-4 h-4 text-emerald-400" />,
      run: () => {
        handleExportConfig();
        setShowActionsModal(false);
      },
    });

    actions.push({
      id: "config-import",
      title: "Import AltSpace Config...",
      section: "CONFIG & BACKUP",
      icon: <ExternalLink className="w-4 h-4 text-blue-400" />,
      run: () => {
        handleImportConfig();
        setShowActionsModal(false);
      },
    });

    // Always append General Navigation / Preferences
    actions.push({
      id: "pref-autostart",
      title: autostart ? "Disable Windows Autostart" : "Enable Windows Autostart",
      section: "PREFERENCES",
      icon: <Power className="w-4 h-4 text-neutral-400" />,
      run: () => {
        handleToggleAutostart();
      }
    });

    actions.push({
      id: "pref-all-drives",
      title: (driveStats?.search_all_drives ?? true)
        ? "Disable Secondary Hard Disks (Search C: only)"
        : `Enable All Hard Disks (${driveStats?.drives?.length ? driveStats.drives.join(", ") : "C:, D:, F:"})`,
      section: "PREFERENCES",
      icon: <HardDrive className="w-4 h-4 text-amber-400" />,
      run: () => {
        handleToggleAllDrives();
      }
    });

    actions.push({
      id: "pref-rescan-drives",
      title: "Rescan & Re-index All Hard Disks",
      section: "PREFERENCES",
      icon: <RefreshCw className="w-4 h-4 text-blue-400" />,
      run: () => {
        handleRescanDrives();
      }
    });

    actions.push({
      id: "pref-toggle-sidebar",
      title: isSidebarVisible ? "Hide Details Sidebar" : "Show Details Sidebar",
      shortcut: "Ctrl B",
      section: "PREFERENCES",
      icon: isSidebarVisible ? <PanelRightClose className="w-4 h-4 text-rose-400" /> : <PanelRightOpen className="w-4 h-4 text-rose-400" />,
      run: () => {
        setManualSidebarToggle((prev) => (prev === null ? !isAutoRich : !prev));
        setShowActionsModal(false);
      }
    });

    return actions;
  };

  // Keyboard Navigation & Escape-to-Dismiss
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 1. Navigation when Action Panel is open
    if (showActionsModal) {
      const actions = getContextualActions();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActionSelectedIndex((prev) => (prev < actions.length - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActionSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const targetAction = actions[actionSelectedIndex];
        if (targetAction) targetAction.run();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowActionsModal(false);
        return;
      }
      const isKeyK = e.key?.toLowerCase() === "k" || e.code === "KeyK";
      if (isKeyK && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowActionsModal(false);
        return;
      }
    }

    // 2. Direct Hotkey Interception on Search List
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      handleCycleTheme();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "e" || e.key === "E")) {
      e.preventDefault();
      handleExportConfig();
      return;
    }

    if (e.ctrlKey && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      if (selectedItem?.category === "Application" && tauriInvoke) {
        tauriInvoke("run_as_admin", { path: selectedItem.path })
          .then(() => handleDismissWindow())
          .catch((err) => {
            setPortStatusMsg(`Admin Error: ${err}`);
            setTimeout(() => setPortStatusMsg(null), 3000);
          });
      }
      return;
    }

    if (e.ctrlKey && (e.key === "o" || e.key === "O")) {
      e.preventDefault();
      if (selectedItem?.path && tauriInvoke) {
        tauriInvoke("reveal_in_explorer", { path: selectedItem.path })
          .then(() => handleDismissWindow())
          .catch(() => {});
      }
      return;
    }

    if (e.ctrlKey && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      if (selectedSpecial && selectedSpecial.kind === "terminal") {
        handleLaunchTerminalWindow(selectedSpecial.data.command);
        return;
      }
      if (selectedItem?.path && tauriInvoke) {
        tauriInvoke("open_in_terminal", { path: selectedItem.path })
          .then(() => handleDismissWindow())
          .catch((err) => {
            setPortStatusMsg(`Terminal Error: ${err}`);
            setTimeout(() => setPortStatusMsg(null), 3000);
          });
      }
      return;
    }

    if (e.ctrlKey && e.shiftKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      if (selectedItem?.path && tauriInvoke) {
        tauriInvoke("open_in_vscode", { path: selectedItem.path })
          .then(() => handleDismissWindow())
          .catch((err) => {
            setPortStatusMsg(`VS Code Error: ${err}`);
            setTimeout(() => setPortStatusMsg(null), 3000);
          });
      }
      return;
    }

    let listLength = 0;
    if (currentMode === "all") listLength = activeList.length + (specialCard ? 1 : 0);
    else if (currentMode === "ports") listLength = filteredPorts.length;
    else if (currentMode === "clipboard") listLength = filteredClipboard.length;

    // Alt + 1..5 Instant Quick Launch Dock shortcut when not searching
    if (e.altKey && ["1", "2", "3", "4", "5"].includes(e.key) && !query.trim()) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      const app = quickLaunchApps[idx];
      if (app) handleLaunch(app.path);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < listLength - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Tab") {
      e.preventDefault();
      const modes: Mode[] = ["all", "clipboard", "ports"];
      const next = modes[(modes.indexOf(activeTab) + 1) % modes.length];
      setActiveTab(next);
      setSelectedIndex(0);
    } else if (e.key === "1" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setActiveTab("all");
      setSelectedIndex(0);
    } else if (e.key === "2" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setActiveTab("clipboard");
      setSelectedIndex(0);
    } else if (e.key === "3" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setActiveTab("ports");
      setSelectedIndex(0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentMode === "all") {
        if (selectedSpecial) {
          if (selectedSpecial.kind === "calc") {
            if (selectedSpecial.data.systemAction) {
              if (selectedSpecial.data.systemAction === "kill_all_dev_servers") {
                handlePurgeAllDevServers();
                setQuery("");
                return;
              }
              if (tauriInvoke) {
                tauriInvoke("execute_system_command", { command: selectedSpecial.data.systemAction })
                  .then(() => {
                    setPortStatusMsg(`Executed: ${selectedSpecial.data.expression}`);
                    setTimeout(() => setPortStatusMsg(null), 3000);
                  })
                  .catch((err: any) => {
                    setPortStatusMsg(`Error: ${err}`);
                    setTimeout(() => setPortStatusMsg(null), 3000);
                  });
              } else {
                alert(`Executed: ${selectedSpecial.data.systemAction}`);
              }
              setQuery("");
            } else {
              handleCopyClipboard(selectedSpecial.data.result);
              setQuery("");
            }
          } else if (selectedSpecial.kind === "quickjump") {
            handleOpenUrl(selectedSpecial.data.url);
            setQuery("");
          } else if (selectedSpecial.kind === "snippet") {
            handleCopyClipboard(selectedSpecial.data.resolvedContent);
            setCopiedNotification(`Expanded "${selectedSpecial.data.snippet.keyword}" to clipboard!`);
            setTimeout(() => setCopiedNotification(null), 2500);
            setQuery("");
          } else if (selectedSpecial.kind === "terminal") {
            handleExecuteTerminalCommand(selectedSpecial.data.command);
          }
        } else if (selectedItem) {
          if (e.ctrlKey) handleOpenFolder(selectedItem.path);
          else handleItemAction(selectedItem);
        }
      } else if (currentMode === "ports" && selectedPort) {
        handleKillPort(selectedPort.pid, selectedPort.port);
      } else if (currentMode === "clipboard" && selectedClip) {
        handleCopyClipboard(selectedClip.content);
      }
    } else if (e.key === " " && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (currentMode === "all" && selectedItem && (document.activeElement !== inputRef.current || query === "" || e.shiftKey)) {
        e.preventDefault();
        setQuickLookOpen((prev) => !prev);
      }
    } else if ((e.key?.toLowerCase() === "k" || e.code === "KeyK") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowActionsModal((prev) => !prev);
      setActionSelectedIndex(0);
    } else if (e.key === "Escape") {
      if (quickLookOpen) {
        setQuickLookOpen(false);
      } else if (showActionsModal) {
        setShowActionsModal(false);
      } else if (query) {
        setQuery("");
      } else {
        // Dismiss floating frameless popup
        handleDismissWindow();
      }
    }
  };

  return (
    <div
      className="w-full h-full border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col overflow-hidden text-neutral-100 font-sans select-none transition-colors duration-150"
      style={{
        backgroundColor: activeTheme.bg,
        borderColor: activeTheme.borderColor,
      }}
      onKeyDown={handleKeyDown}
    >
        {/* Top Ambient Mode Accent Glow Line */}
        <div
          className={cn(
            "h-[1.5px] w-full bg-gradient-to-r from-transparent to-transparent transition-all duration-300",
            currentMode === "all" && "via-white/[0.12]",
            currentMode === "clipboard" && "via-blue-500/70",
            currentMode === "ports" && "via-emerald-500/70"
          )}
          style={
            currentMode === "all"
              ? {
                  backgroundImage: `linear-gradient(to right, transparent, ${activeTheme.accentHex}88, transparent)`,
                }
              : undefined
          }
        />

        {/* Top Drag Region & Decluttered Omnibar */}
        <div
          data-tauri-drag-region
          className="flex items-center px-4 py-3 border-b border-white/[0.06] gap-3 cursor-move bg-white/[0.01]"
        >
          <Search className="w-4 h-4 text-neutral-400 shrink-0 stroke-[2.2]" />

          {/* Active Mode Pill Indicator if in Clipboard or Ports */}
          {currentMode === "clipboard" && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium shrink-0 animate-in fade-in">
              <ClipboardIcon className="w-3 h-3 text-blue-400" />
              <span>Clipboard</span>
              <button
                onClick={() => {
                  setActiveTab("all");
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="hover:text-white ml-0.5 cursor-pointer"
                title="Return to Search (Esc)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {currentMode === "ports" && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium shrink-0 animate-in fade-in">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Ports</span>
              <button
                onClick={() => {
                  setActiveTab("all");
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="hover:text-white ml-0.5 cursor-pointer"
                title="Return to Search (Esc)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={
              currentMode === "ports"
                ? "Filter port (e.g. 3000) or process name..."
                : currentMode === "clipboard"
                ? "Filter clipboard history..."
                : "Search apps, files, calculate, or type :port..."
            }
            className="w-full bg-transparent text-[14.5px] font-medium text-white placeholder-neutral-500 outline-none border-none tracking-tight font-sans cursor-text"
          />

          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-400 hover:text-white transition shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Clean Menu Action Button */}
          <button
            onClick={() => setShowActionsModal(true)}
            title="Raycast Menu & Settings (Ctrl+K)"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/[0.08] text-xs font-medium text-neutral-400 hover:text-white transition cursor-pointer shrink-0"
          >
            <span>Menu</span>
            <kbd className="text-[10px] font-mono bg-white/[0.06] border border-white/[0.08] px-1 rounded text-neutral-400">
              Ctrl K
            </kbd>
          </button>

          {/* Minimalist Dismiss Button */}
          <button
            onClick={handleDismissWindow}
            title="Dismiss / Hide (Esc)"
            className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-500 hover:text-neutral-200 transition shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Status Toast Banner if Action Occurred */}
      {portStatusMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
          <span className="flex items-center gap-2 font-mono">
            <Skull className="w-3.5 h-3.5 text-emerald-400" />
            {portStatusMsg}
          </span>
          <button onClick={() => setPortStatusMsg(null)}>
            <X className="w-3 h-3 text-emerald-400" />
          </button>
        </div>
      )}

      {copiedNotification && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-blue-300 animate-in fade-in">
          <span className="flex items-center gap-2 font-medium">
            <Check className="w-3.5 h-3.5 text-blue-400" />
            {copiedNotification}
          </span>
          <button onClick={() => setCopiedNotification(null)}>
            <X className="w-3 h-3 text-blue-400" />
          </button>
        </div>
      )}

      {/* Main Split Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* TAB 1: ALL (Apps & Files) */}
        {currentMode === "all" && (
          <>
            {/* Left Pane: Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {specialCard && specialCard.kind === "calc" && (
                <div
                  key="calc-result"
                  onClick={() => setSelectedIndex(0)}
                  onDoubleClick={() => {
                    if (specialCard.data.systemAction) {
                      if (tauriInvoke) tauriInvoke("execute_system_command", { command: specialCard.data.systemAction });
                      setQuery("");
                    } else {
                      handleCopyClipboard(specialCard.data.result);
                      setQuery("");
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                    selectedIndex === 0
                      ? "bg-white/[0.08] text-white shadow-sm border border-amber-500/30"
                      : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                        specialCard.data.type === "system" && "bg-red-500/10 text-red-400 border-red-500/20",
                        specialCard.data.type === "programmer" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                        specialCard.data.type === "unit" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        specialCard.data.type === "math" && "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}
                    >
                      {specialCard.data.type === "system" && <Lock className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.type === "programmer" && <Braces className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.type === "unit" && <RefreshCw className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.type === "math" && <Calculator className="w-4 h-4 stroke-[2]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate tracking-tight text-white flex items-center gap-2">
                        {specialCard.data.result}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate font-mono">
                        = {specialCard.data.expression}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md border uppercase tracking-wider font-mono",
                        selectedIndex === 0
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-white/[0.03] text-neutral-500 border-white/[0.05]"
                      )}
                    >
                      {specialCard.data.type === "system" ? "SYSTEM" : specialCard.data.type === "programmer" ? "BASE CONV" : specialCard.data.type === "unit" ? "UNIT" : "CALC"}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 transition",
                        selectedIndex === 0 ? "text-amber-400 translate-x-0.5" : "text-transparent"
                      )}
                    />
                  </div>
                </div>
              )}

              {specialCard && specialCard.kind === "quickjump" && (
                <div
                  key="quickjump-result"
                  onClick={() => setSelectedIndex(0)}
                  onDoubleClick={() => {
                    handleOpenUrl(specialCard.data.url);
                    setQuery("");
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                    selectedIndex === 0
                      ? "bg-white/[0.08] text-white shadow-sm border border-cyan-500/30"
                      : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                        specialCard.data.iconType === "github" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                        specialCard.data.iconType === "npm" && "bg-red-500/10 text-red-400 border-red-500/20",
                        specialCard.data.iconType === "so" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                        specialCard.data.iconType === "youtube" && "bg-red-500/10 text-red-400 border-red-500/20",
                        specialCard.data.iconType === "google" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        specialCard.data.iconType === "wiki" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        specialCard.data.iconType === "web" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      )}
                    >
                      {specialCard.data.iconType === "github" && <Code className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.iconType === "npm" && <Package className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.iconType === "so" && <Layers className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.iconType === "youtube" && <Play className="w-4 h-4 fill-current stroke-[1.5]" />}
                      {specialCard.data.iconType === "google" && <Search className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.iconType === "wiki" && <BookOpen className="w-4 h-4 stroke-[2]" />}
                      {specialCard.data.iconType === "web" && <Globe className="w-4 h-4 stroke-[2]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate tracking-tight text-white flex items-center gap-2">
                        {specialCard.data.title}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate font-mono">
                        {specialCard.data.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md border uppercase tracking-wider font-mono",
                        selectedIndex === 0
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                          : "bg-white/[0.03] text-neutral-500 border-white/[0.05]"
                      )}
                    >
                      {specialCard.data.badge}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 transition",
                        selectedIndex === 0 ? "text-cyan-400 translate-x-0.5" : "text-transparent"
                      )}
                    />
                  </div>
                </div>
              )}
              {specialCard && specialCard.kind === "snippet" && (
                <div
                  key="snippet-result"
                  onClick={() => setSelectedIndex(0)}
                  onDoubleClick={() => {
                    handleCopyClipboard(specialCard.data.resolvedContent);
                    setCopiedNotification(`Snippet copied & ready!`);
                    setTimeout(() => setCopiedNotification(null), 2000);
                    setQuery("");
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                    selectedIndex === 0
                      ? "bg-white/[0.08] text-white shadow-sm border border-emerald-500/30"
                      : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <AlignLeft className="w-4 h-4 stroke-[2]" />
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate tracking-tight text-white flex items-center gap-2">
                        {specialCard.data.snippet.name}
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {specialCard.data.snippet.keyword}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate font-mono">
                        "{specialCard.data.resolvedContent.slice(0, 50)}"
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md border uppercase tracking-wider font-mono",
                        selectedIndex === 0
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-white/[0.03] text-neutral-500 border-white/[0.05]"
                      )}
                    >
                      SNIPPET
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 transition",
                        selectedIndex === 0 ? "text-emerald-400 translate-x-0.5" : "text-transparent"
                      )}
                    />
                  </div>
                </div>
              )}
              {specialCard && specialCard.kind === "terminal" && (
                <div
                  key="terminal-result"
                  onClick={() => setSelectedIndex(0)}
                  onDoubleClick={() => handleExecuteTerminalCommand(specialCard.data.command)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                    selectedIndex === 0
                      ? "bg-white/[0.08] text-white shadow-sm border border-emerald-500/30"
                      : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono font-bold text-xs">
                      &gt;_
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate tracking-tight text-white flex items-center gap-2">
                        Run: <span className="font-mono text-emerald-300 font-normal">{specialCard.data.command}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate font-mono">
                        {terminalRunning
                          ? "Executing command in background..."
                          : terminalResult
                          ? `Exit ${terminalResult.exit_code} • ${terminalResult.elapsed_ms}ms • Press Enter to re-run`
                          : "Press ↵ Enter to run, Ctrl+T for external terminal"}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md border uppercase tracking-wider font-mono",
                        selectedIndex === 0
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-white/[0.03] text-neutral-500 border-white/[0.05]"
                      )}
                    >
                      {terminalRunning ? "RUNNING..." : "TERMINAL"}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 transition",
                        selectedIndex === 0 ? "text-emerald-400 translate-x-0.5" : "text-transparent"
                      )}
                    />
                  </div>
                </div>
              )}

              {!query.trim() ? (
                <div className="space-y-3">
                  {/* Section 1: Suggested Applications (Matching Official Raycast Windows) */}
                  <div>
                    <div className="px-2 pt-1 pb-1.5 flex items-center justify-between text-[11px] uppercase font-semibold tracking-wider text-neutral-400">
                      <span>Suggested Applications</span>
                      <span className="text-[10px] text-neutral-500 font-medium tracking-wider">Adaptive Rank</span>
                    </div>
                    <div className="space-y-0.5">
                      {frequentApps.map((item, localIdx) => {
                        const effectiveIndex = specialCard ? localIdx + 1 : localIdx;
                        const isSelected = effectiveIndex === selectedIndex;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedIndex(effectiveIndex)}
                            onDoubleClick={() => handleItemAction(item)}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                              isSelected
                                ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.08]"
                                : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-3">
                              {item.iconData ? (
                                <img
                                  src={item.iconData}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain p-0.5 bg-black/40 border border-white/[0.08] shadow-sm shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-red-500/10 text-red-400 border-red-500/20">
                                  <Zap className="w-4 h-4 stroke-[2]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-[13.5px] truncate tracking-tight text-white group-hover:text-white">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-neutral-400 truncate font-mono">
                                  {getItemSubtitle(item)}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {isSelected ? (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.12] border border-white/[0.18] text-[11px] font-medium text-white shadow-sm animate-in fade-in duration-100">
                                  <span>Open</span>
                                  <kbd className="text-[10px] font-mono text-neutral-300">↵</kbd>
                                </div>
                              ) : (
                                <span className="text-[10.5px] font-medium text-neutral-500 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                                  {item.category}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Recent Workspaces & Hard Disks */}
                  <div>
                    <div className="px-2 pt-2 pb-1.5 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                      <span className="flex items-center gap-1.5">
                        <span>📁</span>
                        <span>Recent Workspaces & Hard Disks</span>
                      </span>
                      <span className="text-[9.5px] font-mono text-neutral-600">All Volumes (C:, F:)</span>
                    </div>
                    <div className="space-y-0.5">
                      {recentWorkspaces.map((item, localIdx) => {
                        const globalIdx = frequentApps.length + localIdx;
                        const effectiveIndex = specialCard ? globalIdx + 1 : globalIdx;
                        const isSelected = effectiveIndex === selectedIndex;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedIndex(effectiveIndex)}
                            onDoubleClick={() => handleItemAction(item)}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                              isSelected
                                ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.08]"
                                : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-3">
                              {item.iconData ? (
                                <img
                                  src={item.iconData}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain p-0.5 bg-black/40 border border-white/[0.08] shadow-sm shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-amber-500/10 text-amber-400 border-amber-500/20">
                                  <Folder className="w-4 h-4 stroke-[2]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-[13.5px] truncate tracking-tight text-white group-hover:text-white">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-neutral-400 truncate font-mono">
                                  {getItemSubtitle(item)}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {isSelected ? (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.12] border border-white/[0.18] text-[11px] font-medium text-white shadow-sm animate-in fade-in duration-100">
                                  <span>Open</span>
                                  <kbd className="text-[10px] font-mono text-neutral-300">↵</kbd>
                                </div>
                              ) : (
                                <span className="text-[10.5px] font-medium text-neutral-500 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                                  {item.category}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Quick Utilities */}
                  <div>
                    <div className="px-2 pt-2 pb-1.5 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                      <span className="flex items-center gap-1.5">
                        <span>⚡</span>
                        <span>Quick Utilities</span>
                      </span>
                      <span className="text-[9.5px] font-mono text-neutral-600">Built-in Tools</span>
                    </div>
                    <div className="space-y-0.5">
                      {UTILITY_ITEMS.map((item, localIdx) => {
                        const globalIdx = frequentApps.length + recentWorkspaces.length + localIdx;
                        const effectiveIndex = specialCard ? globalIdx + 1 : globalIdx;
                        const isSelected = effectiveIndex === selectedIndex;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedIndex(effectiveIndex)}
                            onDoubleClick={() => handleItemAction(item)}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                              isSelected
                                ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.08]"
                                : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-3">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-purple-500/10 text-purple-400 border-purple-500/20">
                                {item.id === "util-clipboard" ? (
                                  <ClipboardIcon className="w-4 h-4 stroke-[2] text-blue-400" />
                                ) : item.id === "util-ports" ? (
                                  <Activity className="w-4 h-4 stroke-[2] text-emerald-400" />
                                ) : (
                                  <HardDrive className="w-4 h-4 stroke-[2] text-cyan-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-[13.5px] truncate tracking-tight text-white group-hover:text-white">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-neutral-400 truncate font-mono">
                                  {item.subtitle}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {isSelected ? (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.12] border border-white/[0.18] text-[11px] font-medium text-white shadow-sm animate-in fade-in duration-100">
                                  <span>Open</span>
                                  <kbd className="text-[10px] font-mono text-neutral-300">↵</kbd>
                                </div>
                              ) : (
                                <span className="text-[10.5px] font-medium text-neutral-500 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                                  Tool
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : items.length === 0 && !specialCard ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                  <Search className="w-8 h-8 text-neutral-600 stroke-[1.5]" />
                  <p className="text-sm font-medium text-neutral-400">No matching results found</p>
                  <p className="text-xs text-neutral-600">Try searching for an app name, shortcut, or web jump (e.g. gh, npm, yt, g)</p>
                </div>
              ) : (
                <div>
                  <div className="px-2 pt-1 pb-1.5 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                    <span>Search Results ({items.length})</span>
                    <span className="text-[9.5px] font-mono text-neutral-600">Instant Multi-Drive</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item: Item, index: number) => {
                      const effectiveIndex = specialCard ? index + 1 : index;
                      const isSelected = effectiveIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedIndex(effectiveIndex)}
                          onDoubleClick={() => handleItemAction(item)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                            isSelected
                              ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.08]"
                              : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            {item.category === "Window Management" ? (
                              <MiniScreenBlueprint layoutType={item.size || "left-half"} />
                            ) : item.iconData ? (
                              <img
                                src={item.iconData}
                                alt=""
                                className="w-7 h-7 rounded-lg object-contain p-0.5 bg-black/40 border border-white/[0.08] shadow-sm shrink-0"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                                  item.category === "Application" && "bg-red-500/10 text-red-400 border-red-500/20",
                                  item.category === "Folder" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                  item.category === "File" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                  item.category === "Command" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                                  item.category === "Setting" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                  item.category === "Snippet" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                  item.category === "Game" && "bg-violet-500/10 text-violet-400 border-violet-500/20",
                                  item.category === "Theme" && "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                )}
                              >
                                {item.category === "Application" && <Zap className="w-4 h-4 stroke-[2]" />}
                                {item.category === "Folder" && <Folder className="w-4 h-4 stroke-[2]" />}
                                {item.category === "File" && <FileCode className="w-4 h-4 stroke-[2]" />}
                                {item.category === "Command" && <Terminal className="w-4 h-4 stroke-[2]" />}
                                {item.category === "Setting" && <Settings className="w-4 h-4 stroke-[2]" />}
                                {item.category === "Snippet" && <AlignLeft className="w-4 h-4 stroke-[2]" />}
                                {item.category === "Game" && <Gamepad2 className="w-4 h-4 stroke-[2]" />}
                                {item.category === "Theme" && <Palette className="w-4 h-4 stroke-[2]" />}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="font-medium text-[13.5px] truncate tracking-tight text-white group-hover:text-white">
                                {renderHighlightedText(item.title, query)}
                              </div>
                              <div className="text-[11px] text-neutral-400 truncate font-mono">
                                {getItemSubtitle(item)}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {isSelected ? (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.12] border border-white/[0.18] text-[11px] font-medium text-white shadow-sm animate-in fade-in duration-100">
                                <span>{item.category === "Window Management" ? "Snap" : item.category === "Game" ? "Play" : item.category === "Theme" ? "Apply" : "Open"}</span>
                                <kbd className="text-[10px] font-mono text-neutral-300">↵</kbd>
                              </div>
                            ) : (
                              <span className="text-[10.5px] font-medium text-neutral-500 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                                {item.category === "Game" ? (item.platform || "Game") : item.category}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Pane: Inspector */}
            {isSidebarVisible && (
              selectedSpecial ? (
              selectedSpecial.kind === "calc" ? (
                <div className="w-[290px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-inner border",
                          selectedSpecial.data.type === "system"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}
                      >
                        {selectedSpecial.data.type === "system" ? (
                          <Lock className="w-6 h-6 stroke-[2]" />
                        ) : (
                          <Calculator className="w-6 h-6 stroke-[2]" />
                        )}
                      </div>
                      <div className="text-2xl font-mono font-bold text-white tracking-tight break-all max-w-full">
                        {selectedSpecial.data.result}
                      </div>
                      <span className="text-[11px] text-neutral-400 font-mono mt-1">
                        {selectedSpecial.data.expression}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Engine</span>
                        <span className="text-neutral-300 font-medium">Instant Local Parser</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Category</span>
                        <span className="text-amber-400 font-mono uppercase">{selectedSpecial.data.type}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Action</span>
                        <span className="text-neutral-200 font-medium">{selectedSpecial.data.actionLabel || "Copy Value"}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10.5px] text-neutral-400 leading-normal flex items-start gap-2">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Evaluated instantly on your CPU with zero cloud latency and zero network traffic.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => {
                        if (selectedSpecial.data.systemAction) {
                          if (tauriInvoke) tauriInvoke("execute_system_command", { command: selectedSpecial.data.systemAction });
                          setQuery("");
                        } else {
                          handleCopyClipboard(selectedSpecial.data.result);
                          setQuery("");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 border border-amber-500/30 transition shadow-sm"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {selectedSpecial.data.actionLabel || "Copy Result (↵)"}
                    </button>
                  </div>
                </div>
              ) : selectedSpecial.kind === "quickjump" ? (
                <div className="w-[290px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-cyan-500/[0.05] border border-cyan-500/20">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-inner border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                        {selectedSpecial.data.iconType === "github" && <Code className="w-6 h-6 stroke-[2]" />}
                        {selectedSpecial.data.iconType === "npm" && <Package className="w-6 h-6 stroke-[2]" />}
                        {selectedSpecial.data.iconType === "so" && <Layers className="w-6 h-6 stroke-[2]" />}
                        {selectedSpecial.data.iconType === "youtube" && <Play className="w-6 h-6 fill-current stroke-[1.5]" />}
                        {selectedSpecial.data.iconType === "google" && <Search className="w-6 h-6 stroke-[2]" />}
                        {selectedSpecial.data.iconType === "wiki" && <BookOpen className="w-6 h-6 stroke-[2]" />}
                        {selectedSpecial.data.iconType === "web" && <Globe className="w-6 h-6 stroke-[2]" />}
                      </div>
                      <div className="text-sm font-semibold text-white tracking-tight break-all max-w-full">
                        {selectedSpecial.data.title}
                      </div>
                      <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 mt-1 uppercase">
                        {selectedSpecial.data.badge} Quick-Jump
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Provider</span>
                        <span className="text-white font-mono uppercase">{selectedSpecial.data.badge}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Action</span>
                        <span className="text-neutral-200 font-medium">Open in Browser (↵)</span>
                      </div>
                      <div className="py-1">
                        <span className="text-neutral-500 font-medium block mb-1">Target URL</span>
                        <div className="text-[11px] text-neutral-300 font-mono bg-white/[0.03] p-2 rounded-lg break-all border border-white/[0.04] leading-relaxed select-text">
                          {selectedSpecial.data.url}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10.5px] text-neutral-400 leading-normal flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>
                        Opens instantly in your default Windows browser via native Win32 ShellExecute.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => {
                        handleOpenUrl(selectedSpecial.data.url);
                        setQuery("");
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-xs font-bold text-cyan-300 border border-cyan-500/30 transition shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in Browser (↵)
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedSpecial.data.url);
                        setCopiedNotification("Copied URL to clipboard!");
                        setTimeout(() => setCopiedNotification(null), 2000);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-neutral-200 border border-white/[0.06] transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy URL
                    </button>
                  </div>
                </div>
              ) : selectedSpecial.kind === "snippet" ? (
                <div className="w-[290px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-inner border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <AlignLeft className="w-6 h-6 stroke-[2]" />
                      </div>
                      <div className="text-sm font-semibold text-white tracking-tight break-all max-w-full">
                        {selectedSpecial.data.snippet.name}
                      </div>
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 mt-1">
                        {selectedSpecial.data.snippet.keyword}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Category</span>
                        <span className="text-white font-mono uppercase">{selectedSpecial.data.snippet.category}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Action</span>
                        <span className="text-neutral-200 font-medium">Copy & Expand (↵)</span>
                      </div>
                      <div className="py-1">
                        <span className="text-neutral-500 font-medium block mb-1">Expanded Content</span>
                        <div className="text-[11px] text-neutral-200 font-mono bg-white/[0.03] p-2.5 rounded-lg break-all border border-white/[0.04] leading-relaxed select-text whitespace-pre-wrap max-h-36 overflow-y-auto">
                          {selectedSpecial.data.resolvedContent}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10.5px] text-neutral-400 leading-normal flex items-start gap-2">
                      <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Dynamic tokens like date, time, and UUID are generated instantaneously.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => {
                        handleCopyClipboard(selectedSpecial.data.resolvedContent);
                        setCopiedNotification(`Snippet copied & ready!`);
                        setTimeout(() => setCopiedNotification(null), 2000);
                        setQuery("");
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-bold text-emerald-300 border border-emerald-500/30 transition shadow-sm"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Expanded Snippet (↵)
                    </button>
                  </div>
                </div>
              ) : selectedSpecial.kind === "terminal" ? (
                <div className="w-[300px] border-l border-white/[0.06] bg-[#0c0d11] p-4 flex flex-col justify-between overflow-hidden">
                  <div className="space-y-3 min-h-0 flex flex-col flex-1">
                    <div className="flex flex-col items-center text-center p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-inner border bg-emerald-500/10 text-emerald-400 border-emerald-500/25 font-mono font-bold text-sm">
                        &gt;_
                      </div>
                      <div className="text-xs font-mono font-semibold text-emerald-300 tracking-tight truncate max-w-full">
                        {selectedSpecial.data.command}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9.5px] font-mono text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wide">
                          PowerShell Core
                        </span>
                        {terminalRunning ? (
                          <span className="text-[9.5px] font-mono text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                            RUNNING...
                          </span>
                        ) : terminalResult ? (
                          <span
                            className={cn(
                              "text-[9.5px] font-mono px-2 py-0.5 rounded border uppercase",
                              terminalResult.exit_code === 0
                                ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                                : "text-rose-300 bg-rose-500/15 border-rose-500/30"
                            )}
                          >
                            Exit {terminalResult.exit_code} ({terminalResult.elapsed_ms}ms)
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-mono text-neutral-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                            READY
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between pb-1.5 text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                        <span>Console Output</span>
                        {terminalResult && (terminalResult.stdout || terminalResult.stderr) && (
                          <button
                            onClick={() => {
                              const out = terminalResult.stdout || terminalResult.stderr;
                              navigator.clipboard.writeText(out);
                              setCopiedNotification("Output copied to clipboard!");
                              setTimeout(() => setCopiedNotification(null), 2000);
                            }}
                            className="text-[9.5px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono cursor-pointer"
                          >
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copy</span>
                          </button>
                        )}
                      </div>
                      <div className="flex-1 bg-black/60 border border-white/[0.08] rounded-xl p-3 font-mono text-[11px] leading-relaxed text-neutral-200 overflow-y-auto select-text shadow-inner">
                        {terminalRunning ? (
                          <div className="flex items-center gap-2 text-amber-400/80 animate-pulse">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            <span>Executing command silently in background...</span>
                          </div>
                        ) : terminalResult ? (
                          <>
                            {terminalResult.stdout && (
                              <div className="whitespace-pre-wrap text-emerald-300/90 break-words">
                                {terminalResult.stdout}
                              </div>
                            )}
                            {terminalResult.stderr && (
                              <div className="whitespace-pre-wrap text-rose-400/90 break-words mt-2">
                                {terminalResult.stderr}
                              </div>
                            )}
                            {!terminalResult.stdout && !terminalResult.stderr && (
                              <div className="text-neutral-500 italic">
                                Command finished with exit code {terminalResult.exit_code} (No output returned).
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-neutral-500 italic text-[10.5px]">
                            Type your command and press <kbd className="text-neutral-300 font-mono bg-white/[0.08] px-1 py-0.5 rounded text-[10px]">↵ Enter</kbd> to execute and capture stdout/stderr right here in the cockpit.<br /><br />
                            Press <kbd className="text-neutral-300 font-mono bg-white/[0.08] px-1 py-0.5 rounded text-[10px]">Ctrl+T</kbd> to launch interactively in Windows Terminal.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-white/[0.06] shrink-0">
                    <button
                      disabled={terminalRunning}
                      onClick={() => handleExecuteTerminalCommand(selectedSpecial.data.command)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-bold text-emerald-300 border border-emerald-500/35 transition shadow-sm disabled:opacity-50"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      {terminalRunning ? "Running..." : "Run Command (↵)"}
                    </button>
                    <button
                      onClick={() => handleLaunchTerminalWindow(selectedSpecial.data.command)}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-neutral-300 border border-white/[0.06] transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in Windows Terminal (Ctrl+T)
                    </button>
                  </div>
                </div>
              ) : null
            ) : selectedItem ? (
              <div className="w-[300px] border-l border-white/[0.08] bg-black/25 p-4 flex flex-col justify-between overflow-hidden backdrop-blur-md">
                <div className="space-y-4 overflow-y-auto pr-0.5">
                  <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] shadow-sm relative group">
                    {selectedItem.category === "Game" ? (
                      selectedItem.bannerUrl ? (
                        <img
                          src={selectedItem.bannerUrl}
                          alt=""
                          className="w-full h-24 rounded-xl object-cover border border-violet-500/25 shadow-md mb-2.5"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2.5 shadow-md border bg-violet-500/10 text-violet-400 border-violet-500/20">
                          <Gamepad2 className="w-7 h-7 stroke-[2]" />
                        </div>
                      )
                    ) : selectedItem.category === "Theme" ? (
                      (() => {
                        const themeId = selectedItem.path.replace("theme://", "");
                        const tObj = PRESET_THEMES.find((t) => t.id === themeId);
                        const isCurrent = themeId === currentThemeId;
                        return (
                          <div className="w-full flex flex-col items-center">
                            <div
                              className="w-full h-20 rounded-xl border mb-2.5 flex flex-col justify-between p-2.5 shadow-md relative overflow-hidden"
                              style={{
                                backgroundColor: tObj?.bg || "#0e0f12",
                                borderColor: tObj?.borderColor || "rgba(255,255,255,0.1)",
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-3 h-3 rounded-full shadow-sm"
                                    style={{ backgroundColor: tObj?.accentHex || "#ff6363" }}
                                  />
                                  <span className="text-[11px] font-semibold text-white/90">
                                    {tObj?.name}
                                  </span>
                                </div>
                                {isCurrent && (
                                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <div
                                className="h-6 rounded-lg border px-2 flex items-center text-[10px] font-mono text-white/70"
                                style={{
                                  backgroundColor: tObj?.cardBg || "#15161a",
                                  borderColor: tObj?.selectedBorder || "rgba(255,255,255,0.1)",
                                }}
                              >
                                Accent: {tObj?.accentHex}
                              </div>
                            </div>
                            <h3 className="font-semibold text-[14.5px] text-white tracking-tight truncate max-w-full">
                              {tObj?.name || selectedItem.title}
                            </h3>
                            <p className="text-xs text-neutral-400 font-medium mt-0.5">
                              {tObj?.description}
                            </p>
                          </div>
                        );
                      })()
                    ) : selectedItem.category === "Window Management" ? (
                      <MiniScreenBlueprint layoutType={selectedItem.size || "left-half"} className="w-16 h-11 mb-2.5" />
                    ) : selectedItem.iconData ? (
                      <img
                        src={selectedItem.iconData}
                        alt=""
                        className="w-14 h-14 rounded-2xl object-contain p-1.5 bg-black/40 border border-white/[0.10] shadow-md mb-2.5"
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center mb-2.5 shadow-md border",
                          selectedItem.category === "Application" && "bg-red-500/10 text-red-400 border-red-500/20",
                          selectedItem.category === "Folder" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                          selectedItem.category === "File" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          selectedItem.category === "Command" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                          selectedItem.category === "Setting" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          selectedItem.category === "Snippet" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}
                      >
                        {selectedItem.category === "Application" && <Zap className="w-7 h-7 stroke-[2]" />}
                        {selectedItem.category === "Folder" && <Folder className="w-7 h-7 stroke-[2]" />}
                        {selectedItem.category === "File" && <FileCode className="w-7 h-7 stroke-[2]" />}
                        {selectedItem.category === "Command" && <Terminal className="w-7 h-7 stroke-[2]" />}
                        {selectedItem.category === "Setting" && <Settings className="w-7 h-7 stroke-[2]" />}
                        {selectedItem.category === "Snippet" && <AlignLeft className="w-7 h-7 stroke-[2]" />}
                      </div>
                    )}
                    <h3 className="font-semibold text-[14.5px] text-white tracking-tight truncate max-w-full">
                      {selectedItem.title}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium mt-0.5">
                      {selectedItem.category}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500 font-medium">Type</span>
                      <span className="text-neutral-300 font-medium">{selectedItem.category}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500 font-medium">Drive Origin</span>
                      <span className="text-neutral-300 font-mono text-[11px]">{getDriveOrigin(selectedItem.path)}</span>
                    </div>
                    {selectedItem.size && (
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Size</span>
                        <span className="text-neutral-300 font-mono">{selectedItem.size}</span>
                      </div>
                    )}
                    {selectedItem.updated && (
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-500 font-medium">Modified</span>
                        <span className="text-neutral-300 font-medium">{selectedItem.updated}</span>
                      </div>
                    )}
                    <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-semibold text-neutral-400 uppercase tracking-wider">Location</span>
                        <button
                          onClick={() => handleOpenFolder(selectedItem.path)}
                          className="text-[10.5px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition cursor-pointer"
                          title="Open enclosing folder in File Explorer"
                        >
                          <Folder className="w-3 h-3" />
                          <span>Reveal</span>
                        </button>
                      </div>
                      <div className="text-[11px] font-medium text-neutral-300 truncate" title={selectedItem.path}>
                        {formatDisplayPath(selectedItem.path)}
                      </div>
                      <div className="text-[9px] text-neutral-500 font-mono break-all line-clamp-2 select-text">
                        {selectedItem.path}
                      </div>
                    </div>

                    {gitInfo && gitInfo.is_repo && (
                      <div className="p-2.5 rounded-xl bg-purple-500/[0.08] border border-purple-500/25 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                          <span className="flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                            {gitInfo.branch || "HEAD"}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border",
                              gitInfo.modified_count === 0 && gitInfo.untracked_count === 0
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            )}
                          >
                            {gitInfo.modified_count === 0 && gitInfo.untracked_count === 0
                              ? "Clean"
                              : `${gitInfo.modified_count} mod, ${gitInfo.untracked_count} untracked`}
                          </span>
                        </div>
                        {gitInfo.last_commit_message && (
                          <div className="text-[10.5px] text-neutral-300 font-mono truncate bg-black/20 p-1.5 rounded border border-white/[0.04]">
                            {gitInfo.last_commit_message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2">
                  {selectedItem.category === "Game" ? (
                    <button
                      onClick={() => handleLaunchGame(selectedItem.path)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600/25 hover:bg-violet-600/35 text-xs font-bold text-violet-300 border border-violet-500/35 transition shadow-sm cursor-pointer"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>Play Game (↵)</span>
                    </button>
                  ) : selectedItem.category === "Theme" ? (
                    <button
                      onClick={() => {
                        const themeId = selectedItem.path.replace("theme://", "");
                        handleSelectTheme(themeId);
                        setQuery("");
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 text-xs font-bold text-purple-300 border border-purple-500/35 transition shadow-sm cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Apply Theme (↵)</span>
                    </button>
                  ) : selectedItem.category === "Window Management" ? (
                    <button
                      onClick={() => handleSnapWindow(selectedItem.path)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-xs font-semibold text-blue-300 border border-blue-500/30 transition shadow-sm cursor-pointer"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Snap Active Window (↵)</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setQuickLookOpen(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-xs font-semibold text-neutral-200 border border-white/[0.08] transition shadow-sm cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>QuickLook (Space)</span>
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedItem.path);
                          setCopiedNotification("Copied path to clipboard!");
                          setTimeout(() => setCopiedNotification(null), 2000);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-xs font-semibold text-neutral-200 border border-white/[0.08] transition shadow-sm cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Copy Path</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null)}
          </>
        )}

        {/* TAB 2: CLIPBOARD HISTORY (Feature 1-a & 2-b) */}
        {currentMode === "clipboard" && (
          <>
            {/* Left Pane: Clipboard Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Sleek Raycast-style Type Filter Pills Bar */}
              <div className="flex items-center gap-1 px-1 pb-2 border-b border-white/[0.06] overflow-x-auto shrink-0 mb-1">
                {(
                  [
                    { id: "all", label: "All", count: clipCounts.all },
                    { id: "code", label: "Code", count: clipCounts.code },
                    { id: "url", label: "Links", count: clipCounts.url },
                    { id: "color", label: "Colors", count: clipCounts.color },
                    { id: "text", label: "Text", count: clipCounts.text },
                  ] as const
                ).map((tab) => {
                  const isActive = clipboardFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setClipboardFilter(tab.id);
                        setSelectedIndex(0);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 border",
                        isActive
                          ? "bg-white/[0.12] text-white border-white/[0.2] shadow-sm font-semibold"
                          : "bg-white/[0.02] text-neutral-400 hover:text-neutral-200 border-white/[0.04] hover:bg-white/[0.05]"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px] font-mono px-1 rounded bg-black/30 opacity-70">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredClipboard.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                  <ClipboardIcon className="w-8 h-8 text-neutral-600 stroke-[1.5]" />
                  <p className="text-sm font-medium text-neutral-400">No clipboard items found</p>
                  <p className="text-xs text-neutral-600">Copy any text, color, URL or code snippet to capture</p>
                </div>
              ) : (
                filteredClipboard.map((clip: ClipboardHistoryItem, index: number) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => handleCopyClipboard(clip.content)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                        isSelected
                          ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                          : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                            clip.content_type === "color" && "border-white/20",
                            clip.content_type === "url" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                            clip.content_type === "code" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            clip.content_type === "json" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                            clip.content_type === "text" && "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}
                          style={clip.content_type === "color" ? { backgroundColor: clip.content } : {}}
                        >
                          {clip.content_type === "color" && <Palette className="w-3.5 h-3.5 text-white drop-shadow" />}
                          {clip.content_type === "url" && <Globe className="w-3.5 h-3.5 stroke-[2]" />}
                          {clip.content_type === "code" && <FileCode className="w-3.5 h-3.5 stroke-[2]" />}
                          {clip.content_type === "json" && <Braces className="w-3.5 h-3.5 stroke-[2]" />}
                          {clip.content_type === "text" && <ClipboardIcon className="w-3.5 h-3.5 stroke-[2]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="font-mono text-[12.5px] truncate tracking-tight text-neutral-200">
                            {clip.preview}
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                            <span>{clip.timestamp}</span>
                            <span>•</span>
                            <span>{clip.char_count} chars</span>
                            {clip.line_count > 1 && <span>• {clip.line_count} lines</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded uppercase border font-mono",
                            isSelected
                              ? "bg-white/[0.1] text-neutral-200 border-white/[0.12]"
                              : "bg-white/[0.03] text-neutral-500 border-white/[0.05]"
                          )}
                        >
                          {clip.content_type}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Pane: Clipboard Inspector */}
            {isSidebarVisible && selectedClip && (
              <div className="w-[310px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <ClipboardIcon className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Clipboard Item
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">
                      {selectedClip.content_type.toUpperCase()}
                    </span>
                  </div>

                  {selectedClip.content_type === "color" && (
                    <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02] flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg border border-white/20 shadow-md"
                        style={{ backgroundColor: selectedClip.content }}
                      />
                      <div>
                        <div className="text-sm font-mono font-bold text-white">{selectedClip.content}</div>
                        <div className="text-[11px] text-neutral-400">CSS Color Value</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[11px] text-neutral-500 font-medium">Content Preview</span>
                    <div className="max-h-[180px] overflow-y-auto text-[11.5px] text-neutral-300 font-mono bg-white/[0.03] p-3 rounded-xl break-all border border-white/[0.05] leading-relaxed whitespace-pre-wrap select-text">
                      {selectedClip.content}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500">Captured at</span>
                      <span className="text-neutral-300 font-mono">{selectedClip.timestamp}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500">Length</span>
                      <span className="text-neutral-300 font-mono">
                        {selectedClip.char_count} chars ({selectedClip.line_count} lines)
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/20 text-[11px] text-blue-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      Privacy Safeguard (1-a & 2-b)
                    </div>
                    <p className="text-[10px] text-blue-300/80 leading-normal">
                      RAM buffer only. Sensitive secrets & API keys are dropped automatically. Cleared on reboot.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleCopyClipboard(selectedClip.content)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-xs font-semibold text-blue-400 border border-blue-500/20 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Re-Copy to System Clipboard
                  </button>
                  <button
                    onClick={handleClearClipboard}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.03] hover:bg-red-500/10 text-xs font-medium text-neutral-400 hover:text-red-400 border border-white/[0.05] transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear In-Memory History
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 3: PORT KILLER & DEV TERMINATOR (Feature 2 & 3-a) */}
        {currentMode === "ports" && (
          <>
            {/* Left Pane: Listening Ports List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredPorts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                  <Activity className="w-8 h-8 text-neutral-600 stroke-[1.5]" />
                  <p className="text-sm font-medium text-neutral-400">No active ports found matching filter</p>
                  <p className="text-xs text-neutral-600">Type a port number like :3000 or :8080</p>
                </div>
              ) : (
                filteredPorts.map((p: PortItem, index: number) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={`${p.port}-${p.pid}`}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => handleKillPort(p.pid, p.port)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                        isSelected
                          ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                          : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="w-16 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                          :{p.port}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-[13.5px] truncate tracking-tight text-white flex items-center gap-2">
                            {p.process_name}
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            PID {p.pid} • {p.state}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKillPort(p.pid, p.port);
                          }}
                          className="px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Skull className="w-3 h-3" />
                          Kill
                        </button>
                        <ChevronRight
                          className={cn(
                            "w-3.5 h-3.5 transition",
                            isSelected ? "text-neutral-400 translate-x-0.5" : "text-transparent"
                          )}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Pane: Port Inspector */}
            {isSidebarVisible && selectedPort && (
              <div className="w-[300px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
                    <div className="text-3xl font-mono font-black text-emerald-400 tracking-wider flex items-center gap-1">
                      :{selectedPort.port}
                    </div>
                    <span className="text-[11px] text-emerald-300 font-medium mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                      TCP LISTENING
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500 font-medium">Process Name</span>
                      <span className="text-white font-mono font-semibold">{selectedPort.process_name}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500 font-medium">Process ID (PID)</span>
                      <span className="text-neutral-200 font-mono">{selectedPort.pid}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-neutral-500 font-medium">Protocol</span>
                      <span className="text-neutral-300 font-mono">IPv4 TCP Extended</span>
                    </div>
                    <div className="py-1">
                      <span className="text-neutral-500 font-medium block mb-1">Status</span>
                      <div className="text-[11px] text-emerald-400 font-mono bg-white/[0.03] p-2 rounded-lg border border-white/[0.04] leading-relaxed">
                        Bound to 0.0.0.0:{selectedPort.port}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10.5px] text-neutral-400 leading-normal flex items-start gap-2">
                    <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Terminating uses Windows Taskkill tree mode (/F /T) to instantly unblock orphaned dev servers.
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleKillPort(selectedPort.pid, selectedPort.port)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs font-bold text-red-400 border border-red-500/30 transition shadow-sm"
                  >
                    <Skull className="w-4 h-4" />
                    Kill Process (Free Port :{selectedPort.port})
                  </button>
                  <button
                    onClick={fetchPorts}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-neutral-200 border border-white/[0.06] transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                    Refresh Active Ports
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom 21st.dev AltSpace Footer Bar */}
      <div className="h-9 px-4 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400 font-medium shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
          <span className="font-semibold text-neutral-300">AltSpace</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-400">
            {currentMode === "all"
              ? `${items.length} items`
              : currentMode === "clipboard"
              ? `${filteredClipboard.length} clips`
              : `${filteredPorts.length} ports`}
          </span>
          <span className="text-neutral-600">/</span>
          <button
            onClick={handleCycleTheme}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white/[0.08] text-neutral-300 hover:text-white transition cursor-pointer border border-transparent hover:border-white/[0.08]"
            title="Click to cycle theme (Ctrl+Shift+T or search :theme)"
          >
            <span
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ backgroundColor: activeTheme.accentHex }}
            />
            <span className="font-mono text-[10.5px]">{activeTheme.name}</span>
          </button>
        </div>

        {/* Keyboard Badges */}
        <div className="flex items-center gap-3 text-[11px] whitespace-nowrap shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-neutral-400">Open</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white border border-white/[0.12] text-[10px] font-mono shadow-sm">
              ↵
            </kbd>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-neutral-400">Preview</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-300 border border-white/[0.12] text-[10px] font-mono shadow-sm">
              Space
            </kbd>
          </div>

          <button
            onClick={() => setManualSidebarToggle((prev) => (prev === null ? !isAutoRich : !prev))}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md transition shrink-0 cursor-pointer border text-xs",
              isSidebarVisible
                ? "bg-white/[0.12] text-white border-white/[0.16]"
                : "hover:bg-white/[0.08] text-neutral-400 hover:text-white border-transparent"
            )}
            title="Toggle Details Sidebar (Ctrl+B)"
          >
            {isSidebarVisible ? (
              <PanelRightClose className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span>Details</span>
            <kbd className="px-1 py-0.2 rounded bg-white/[0.08] text-[9.5px] font-mono">
              Ctrl B
            </kbd>
          </button>

          <button
            onClick={() => {
              setShowActionsModal((prev) => !prev);
              setActionSelectedIndex(0);
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white/[0.08] text-neutral-300 hover:text-white transition shrink-0 cursor-pointer"
          >
            <span>Actions</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.12] text-white border border-white/[0.16] text-[10px] font-mono shadow-sm font-semibold">
              Ctrl K
            </kbd>
          </button>
        </div>
      </div>

      {/* Raycast Classic Bottom-Right Action Drawer (Option 1) */}
      {showActionsModal && (
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-end justify-end p-3 z-50 animate-in fade-in duration-100"
          onClick={() => setShowActionsModal(false)}
        >
          <div
            className="w-[360px] max-h-[440px] border rounded-2xl shadow-2xl p-2.5 flex flex-col space-y-2 animate-in zoom-in-95 duration-100"
            style={{
              backgroundColor: activeTheme.cardBg,
              borderColor: activeTheme.borderColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Item Title & Esc hint */}
            <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <span className="text-[12px] font-semibold text-white truncate block">
                  Actions for {currentMode === "all" ? (selectedItem?.title || "Search") : currentMode === "ports" ? `Port :${selectedPort?.port}` : "Clipboard"}
                </span>
                <span className="text-[10px] text-neutral-400 truncate block font-mono">
                  {currentMode === "all" ? (selectedItem?.category || "Query") : currentMode === "ports" ? `PID ${selectedPort?.pid}` : "Selected Clip"}
                </span>
              </div>
              <kbd className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded shrink-0">
                Esc
              </kbd>
            </div>

            {/* Scrollable Actions List */}
            <div className="overflow-y-auto space-y-2.5 px-1 py-1 max-h-[350px] custom-scrollbar">
              {(() => {
                const actions = getContextualActions();
                const sections = Array.from(new Set(actions.map((a) => a.section)));
                let runningIndex = 0;

                return sections.map((sec) => {
                  const sectionActions = actions.filter((a) => a.section === sec);

                  return (
                    <div key={sec} className="space-y-1">
                      <div className="px-2 text-[9.5px] uppercase font-bold tracking-wider text-neutral-500">
                        {sec}
                      </div>
                      <div className="space-y-0.5">
                        {sectionActions.map((action) => {
                          const currentGlobalIdx = runningIndex++;
                          const isSelected = currentGlobalIdx === actionSelectedIndex;

                          return (
                            <div
                              key={action.id}
                              onClick={() => {
                                action.run();
                              }}
                              onMouseEnter={() => setActionSelectedIndex(currentGlobalIdx)}
                              className={cn(
                                "flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition duration-75",
                                isSelected
                                  ? "bg-white/[0.12] text-white font-medium border border-white/[0.14] shadow-sm"
                                  : "text-neutral-300 hover:bg-white/[0.04] hover:text-white border border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <span className="shrink-0">{action.icon}</span>
                                <span className="truncate">{action.title}</span>
                              </div>
                              {action.shortcut && (
                                <kbd className="text-[10px] font-mono text-neutral-300 bg-white/[0.08] border border-white/[0.1] px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                                  {action.shortcut}
                                </kbd>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* QuickLook Interactive Overlay Modal (Choice 2) */}
      {quickLookOpen && selectedItem && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
          onClick={() => setQuickLookOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] bg-[#16171a] border border-white/[0.14] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* QuickLook Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold text-sm text-white truncate font-mono">
                  {selectedItem.title}
                </span>
                {filePreview?.extension && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.06] text-neutral-300 border border-white/[0.08]">
                    .{filePreview.extension}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {filePreview?.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(filePreview.content || "");
                      setCopiedNotification("Copied file content!");
                      setTimeout(() => setCopiedNotification(null), 2000);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-neutral-200 border border-white/[0.08] transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy All
                  </button>
                )}
                <button
                  onClick={() => setQuickLookOpen(false)}
                  className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* QuickLook Content */}
            <div className="flex-1 overflow-auto p-4 text-xs font-mono select-text bg-[#0e0f11] text-neutral-200">
              {filePreview?.is_text && filePreview.content ? (
                <pre className="whitespace-pre-wrap leading-relaxed font-mono">
                  {filePreview.content}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-400 space-y-3">
                  <HardDrive className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
                  <p className="text-sm font-medium text-white">{selectedItem.title}</p>
                  <p className="text-xs text-neutral-500 font-mono break-all max-w-md">
                    {selectedItem.path}
                  </p>
                  {filePreview?.size_bytes ? (
                    <span className="text-xs text-neutral-400 font-mono">
                      {(filePreview.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  ) : null}
                  <button
                    onClick={() => {
                      handleLaunch(selectedItem.path);
                      setQuickLookOpen(false);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 transition flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open with Windows Default App
                  </button>
                </div>
              )}
            </div>

            {/* QuickLook Footer */}
            <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[11px] text-neutral-500">
              <span className="font-mono truncate">{selectedItem.path}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400 font-mono text-[10px]">
                Press Space or ESC to close
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
