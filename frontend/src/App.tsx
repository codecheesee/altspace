import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  Folder,
  Terminal,
  ExternalLink,
  Copy,
  HardDrive,
  Shield,
  Trash2,
  Globe,
  Palette,
  RefreshCw,
  Skull,
  Flame,
  Power,
  Code,
  Play,
  Eye,
  Gamepad2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
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
  saveCustomAccent,
} from "./lib/theme";
import { refreshCurrencyRates } from "./lib/calc";
import { InputModal } from "./components/InputModal";
import { HeaderBar } from "./components/HeaderBar";
import { FooterBar } from "./components/FooterBar";
import { SearchTab } from "./components/SearchTab";
import { ClipboardTab } from "./components/ClipboardTab";
import { PortsTab } from "./components/PortsTab";
import { ActionDrawer } from "./components/ActionDrawer";
import { QuickLookModal } from "./components/QuickLookModal";
import type {
  ShellResult,
  GameItem,
  SpecialCard,
  DriveIndexStats,
  Mode,
  Item,
  PortItem,
  ClipboardHistoryItem,
  GitInfo,
  FilePreview,
} from "./types";
import {
  tauriInvoke,
  saveCachedApps,
  recordItemUsage,
  sortByFrequency,
  getCachedOrInitialApps,
  getItemFrequencies,
  UTILITY_ITEMS,
} from "./lib/appStorage";

export default function App() {
  const [activeTab, setActiveTab] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchSeq = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  void isPending;

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
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [portStatusMsg, setPortStatusMsg] = useState<string | null>(null);

  // Clipboard
  const [clipboardItems, setClipboardItems] = useState<ClipboardHistoryItem[]>([]);
  const [clipboardFilter, setClipboardFilter] = useState<"all" | "code" | "url" | "color" | "text">("all");
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // 21st.dev Theme Engine (Preserves Raycast Obsidian, Midnight Void OLED, Tokyo Night, Vercel Clean, Emerald Matrix)
  const [currentThemeId, setCurrentThemeId] = useState<string>(getSavedThemeId);
  const [customAccent, setCustomAccent] = useState<string | null>(getSavedCustomAccent);
  const activeTheme = resolveTheme(currentThemeId, customAccent);

  // Auto-Adaptive Minimalist Sidebar State
  const [manualSidebarToggle, setManualSidebarToggle] = useState<boolean | null>(null);
  const isAutoRichRef = useRef(false);

  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (v: string) => void;
  } | null>(null);

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
    setInputModalConfig({
      title: 'Custom Accent Color',
      description: 'Enter a 6-digit hex color code (e.g. #3b82f6)',
      placeholder: '#3b82f6',
      defaultValue: activeTheme.accentHex,
      onConfirm: (hex) => {
        setInputModalConfig(null);
        const clean = hex.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
          setCustomAccent(clean);
          saveCustomAccent(clean);
          setCopiedNotification(`Custom Accent Set: ${clean}`);
          setTimeout(() => setCopiedNotification(null), 2000);
        }
      },
    });
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
    setInputModalConfig({
      title: 'Import AltSpace Config',
      description: 'Paste your .altconfig JSON bundle below',
      placeholder: '{"theme_id": "raycast-obsidian", ...}',
      onConfirm: (input) => {
        setInputModalConfig(null);
        if (!input || !input.trim()) return;
        try {
          const parsed = JSON.parse(input.trim());
          if (parsed.theme_id && typeof parsed.theme_id === 'string') {
            setCurrentThemeId(parsed.theme_id);
            saveThemeId(parsed.theme_id);
          }
          if (parsed.custom_accent !== undefined) {
            setCustomAccent(parsed.custom_accent);
            if (parsed.custom_accent) saveCustomAccent(parsed.custom_accent);
          }
          setCopiedNotification('Config imported successfully!');
          setTimeout(() => setCopiedNotification(null), 2500);
        } catch {
          setCopiedNotification('Invalid config JSON — import failed');
          setTimeout(() => setCopiedNotification(null), 3000);
        }
      },
    });
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

  useEffect(() => {
    refreshCurrencyRates();
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

        startTransition(() => {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = mapped.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newItems];
          });
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
      <HeaderBar
        currentMode={currentMode}
        query={query}
        setQuery={setQuery}
        setSelectedIndex={setSelectedIndex}
        setActiveTab={setActiveTab}
        inputRef={inputRef}
        activeTheme={activeTheme}
        portStatusMsg={portStatusMsg}
        setPortStatusMsg={setPortStatusMsg}
        copiedNotification={copiedNotification}
        setCopiedNotification={setCopiedNotification}
        onOpenMenu={() => setShowActionsModal(true)}
        onDismiss={handleDismissWindow}
      />

      {/* Main Split Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* TAB 1: ALL (Apps & Files) */}
        {currentMode === "all" && (
          <SearchTab
            query={query}
            setQuery={setQuery}
            specialCard={specialCard}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            selectedSpecial={selectedSpecial}
            selectedItem={selectedItem}
            items={items}
            frequentApps={frequentApps}
            recentWorkspaces={recentWorkspaces}
            isSidebarVisible={isSidebarVisible}
            terminalRunning={terminalRunning}
            terminalResult={terminalResult}
            gitInfo={gitInfo}
            currentThemeId={currentThemeId}
            onCopyClipboard={handleCopyClipboard}
            onCopiedNotification={(msg) => {
              setCopiedNotification(msg);
              setTimeout(() => setCopiedNotification(null), 2000);
            }}
            onItemAction={handleItemAction}
            onExecuteTerminalCommand={handleExecuteTerminalCommand}
            onLaunchTerminalWindow={handleLaunchTerminalWindow}
            onOpenUrl={handleOpenUrl}
            onOpenFolder={handleOpenFolder}
            onLaunchGame={handleLaunchGame}
            onSelectTheme={handleSelectTheme}
            onSnapWindow={handleSnapWindow}
            onOpenQuickLook={() => setQuickLookOpen(true)}
          />
        )}

        {currentMode === "clipboard" && (
          <ClipboardTab
            filteredClipboard={filteredClipboard}
            clipboardFilter={clipboardFilter}
            setClipboardFilter={setClipboardFilter}
            clipCounts={clipCounts}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            selectedClip={selectedClip}
            isSidebarVisible={isSidebarVisible}
            onCopyClipboard={handleCopyClipboard}
            onClearClipboard={handleClearClipboard}
          />
        )}

        {currentMode === "ports" && (
          <PortsTab
            filteredPorts={filteredPorts}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            selectedPort={selectedPort}
            isSidebarVisible={isSidebarVisible}
            onKillPort={handleKillPort}
            onRefreshPorts={fetchPorts}
          />
        )}
      </div>

      <FooterBar
        currentMode={currentMode}
        itemsCount={items.length}
        clipsCount={filteredClipboard.length}
        portsCount={filteredPorts.length}
        activeTheme={activeTheme}
        onCycleTheme={handleCycleTheme}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={() => setManualSidebarToggle((prev) => (prev === null ? !isAutoRich : !prev))}
        onOpenActions={() => {
          setShowActionsModal((prev) => !prev);
          setActionSelectedIndex(0);
        }}
      />

      {/* Raycast Classic Bottom-Right Action Drawer (Option 1) */}
      <ActionDrawer
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        activeTheme={activeTheme}
        currentMode={currentMode}
        selectedItem={selectedItem}
        selectedPort={selectedPort}
        actions={getContextualActions()}
        actionSelectedIndex={actionSelectedIndex}
        setActionSelectedIndex={setActionSelectedIndex}
      />

      {/* QuickLook Interactive Overlay Modal (Choice 2) */}
      <QuickLookModal
        isOpen={quickLookOpen}
        onClose={() => setQuickLookOpen(false)}
        selectedItem={selectedItem}
        filePreview={filePreview}
        onLaunch={handleLaunch}
        onCopiedNotification={(msg) => {
          setCopiedNotification(msg);
          setTimeout(() => setCopiedNotification(null), 2000);
        }}
      />
      {inputModalConfig && (
        <InputModal
          isOpen={true}
          title={inputModalConfig.title}
          description={inputModalConfig.description}
          placeholder={inputModalConfig.placeholder}
          defaultValue={inputModalConfig.defaultValue}
          onConfirm={inputModalConfig.onConfirm}
          onCancel={() => setInputModalConfig(null)}
        />
      )}
    </div>
  );
}
