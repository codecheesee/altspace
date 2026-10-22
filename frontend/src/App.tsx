import React, { useState, useEffect, useRef, useCallback } from "react";
import { InputModal } from "./components/InputModal";
import { HeaderBar } from "./components/HeaderBar";
import { FooterBar } from "./components/FooterBar";
import { SearchTab } from "./components/SearchTab";
import { ClipboardTab } from "./components/ClipboardTab";
import { PortsTab } from "./components/PortsTab";
import { ActionDrawer } from "./components/ActionDrawer";
import { QuickLookModal } from "./components/QuickLookModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { StoreTab } from "./components/StoreTab";
import { LicenseModal } from "./components/LicenseModal";
import { ShellConfirmationModal } from "./components/ShellConfirmationModal";
import { ActionTimelineDrawer } from "./components/ActionTimelineDrawer";
import { ActionApprovalModal } from "./components/ActionApprovalModal";
import { DiagnosticsModal } from "./components/DiagnosticsModal";
import { UpdateModal } from "./components/UpdateModal";
import { validateAltConfig, computeConfigDiff } from "./lib/configValidator";
import type { ActionRequest, ActionEvaluation } from "./lib/actionBroker";
import { BUILTIN_EXTENSIONS } from "./lib/registry";
import { toggleFeature, FEATURE_REGISTRY, type FeatureId } from "./lib/featureMatrix";
import { launchEnvProfile } from "./lib/secureVault";
import {
  wslShutdown,
  wslLaunchShell,
  dockerStartDaemon,
  dockerOpenShell,
} from "./lib/dockerWsl";
import { useThemeEngine } from "./hooks/useThemeEngine";
import { usePortInspector } from "./hooks/usePortInspector";
import { useClipboardHistory } from "./hooks/useClipboardHistory";
import { useSearchEngine } from "./hooks/useSearchEngine";
import { useContextualActions } from "./hooks/useContextualActions";
import {
  tauriInvoke,
  recordItemUsage,
  getStoredBoolean,
  saveStoredBoolean,
  SIDEBAR_PREFERENCE_KEY,
  DRIVE_SEARCH_PREFERENCE_KEY,
} from "./lib/appStorage";
import { refreshCurrencyRates } from "./lib/calc";
import type {
  Mode,
  Item,
  GitInfo,
  FilePreview,
  DriveIndexStats,
  UpdateInfo,
} from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<Mode>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Notification Toast State
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseModalTab, setLicenseModalTab] = useState<"account" | "features" | "about">("account");
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateBannerDismissed, setIsUpdateBannerDismissed] = useState(false);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    request: ActionRequest;
    evaluation: ActionEvaluation;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const notify = useCallback((msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2500);
  }, []);

  const [shellConfirmation, setShellConfirmation] = useState<{
    command: string;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const requestShellConfirmation = useCallback(
    (command: string) =>
      new Promise<boolean>((resolve) => {
        setShellConfirmation({ command, resolve });
      }),
    []
  );
  const resolveShellConfirmation = useCallback((approved: boolean) => {
    setShellConfirmation((current) => {
      current?.resolve(approved);
      return null;
    });
  }, []);

  // 1. Theme Engine Hook
  const {
    currentThemeId,
    customAccent,
    activeTheme,
    handleSelectTheme,
    handleCycleTheme,
    handleSetCustomAccent,
    handleResetCustomAccent,
  } = useThemeEngine(notify);

  // 2. Search Engine Hook (L1/L2 Search, Free Local AI, Plugins)
  const currentMode: Mode = activeTab;

  const {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    items,
    frequentApps,
    recentWorkspaces,
    specialCard,
    selectedItem,
    selectedSpecial,
    terminalRunning,
    terminalResult,
    handleExecuteTerminalCommand,
    handleLaunchTerminalWindow,
    plugins,
  } = useSearchEngine({
    currentMode,
    currentThemeId,
    onNotify: notify,
    onPremiumRequired: () => setShowLicenseModal(true),
    onConfirmShellCommand: requestShellConfirmation,
  });

  // 3. Dev Ports Inspector Hook
  const qTrimLower = query.trim().toLowerCase();
  const isPortMode =
    activeTab === "ports" ||
    qTrimLower === ":port" ||
    qTrimLower === ":ports" ||
    qTrimLower.startsWith(":port ") ||
    qTrimLower.startsWith(":ports ") ||
    qTrimLower.startsWith("free ") ||
    qTrimLower.startsWith("kill port ") ||
    qTrimLower.startsWith("port ") ||
    /^:\d+/.test(qTrimLower);

  const isStoreMode =
    activeTab === "store" ||
    qTrimLower === ":store" ||
    qTrimLower.startsWith(":store ") ||
    qTrimLower === ":ext" ||
    qTrimLower.startsWith(":ext ");

  const isClipboardMode =
    activeTab === "clipboard" ||
    qTrimLower === ":clip" ||
    qTrimLower === ":clipboard" ||
    qTrimLower.startsWith(":clip ") ||
    qTrimLower.startsWith(":clipboard ");

  const resolvedMode: Mode = isStoreMode
    ? "store"
    : isPortMode
    ? "ports"
    : isClipboardMode
    ? "clipboard"
    : currentMode;

  const {
    filteredPorts,
    portStatusMsg,
    setPortStatusMsg,
    fetchPorts,
    fetchForensics,
    handleKillPort,
    handlePurgeAllDevServers,
  } = usePortInspector(query);

  // 4. Clipboard History Hook
  const {
    filteredClipboard,
    clipboardFilter,
    setClipboardFilter,
    clipCounts,
    fetchClipboard,
    handleCopyClipboard,
    handleClearClipboard,
  } = useClipboardHistory(query, notify);

  // Preferences & System State
  const [autostart, setAutostart] = useState(false);
  const [driveStats, setDriveStats] = useState<DriveIndexStats | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionSelectedIndex, setActionSelectedIndex] = useState(0);
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() =>
    getStoredBoolean(SIDEBAR_PREFERENCE_KEY, false)
  );

  // Input Modal State (replaces prompt/alert)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (v: string) => void;
  } | null>(null);

  // Auto-Updater Check on Mount & Periodic Interval
  useEffect(() => {
    const isAutoCheckEnabled = localStorage.getItem("altspace_auto_check_updates") !== "false";
    if (!isAutoCheckEnabled) return;

    const performCheck = () => {
      tauriInvoke<UpdateInfo>("check_app_update")
        .then((info) => {
          if (info) {
            setUpdateInfo(info);
            if (info.has_update) {
              notify(`✨ AltSpace Update v${info.latest_version} available!`);
            }
          }
        })
        .catch(() => {});
    };

    // Initial check after 8s grace period to keep startup ultra-fast
    const initialTimer = setTimeout(performCheck, 8000);
    // Recurring check every 4 hours
    const intervalTimer = setInterval(performCheck, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [notify]);

  // Load autostart and drive settings
  useEffect(() => {
    tauriInvoke<boolean>("get_autostart_status")
      .then((status) => {
        if (typeof status === "boolean") setAutostart(status);
      })
      .catch(() => {});

    const searchAllDrives = getStoredBoolean(DRIVE_SEARCH_PREFERENCE_KEY, true);
    tauriInvoke<DriveIndexStats>("set_search_all_drives", { enabled: searchAllDrives })
      .then((stats) => {
        if (stats) setDriveStats(stats);
      })
      .catch(() => {});

    refreshCurrencyRates();

    tauriInvoke<boolean>("get_safe_mode_status")
      .then((safe) => {
        if (safe) {
          setIsSafeMode(true);
          notify("🛡️ Safe Mode Active: Community extensions bypassed.");
        }
      })
      .catch(() => {});
  }, [notify]);

  // Poll ports & clipboard
  useEffect(() => {
    fetchPorts();
    fetchClipboard();

    const interval = setInterval(() => {
      if (resolvedMode === "ports") fetchPorts();
      else if (resolvedMode === "clipboard") fetchClipboard();
    }, 1500);

    return () => clearInterval(interval);
  }, [resolvedMode, fetchPorts, fetchClipboard]);

  // Focus & Summon Listener
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let unlistenMode: (() => void) | null = null;
    let unlistenFeedback: (() => void) | null = null;
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

      listen("open-feedback", () => {
        setShowFeedbackModal(true);
      }).then((fn) => {
        unlistenFeedback = fn;
      });

      listen("check-updates", () => {
        setIsUpdateModalOpen(true);
      }).then((fn) => {
        unlistenUpdates = fn;
      });
    }).catch(() => {});

    return () => {
      if (unlisten) unlisten();
      if (unlistenMode) unlistenMode();
      if (unlistenFeedback) unlistenFeedback();
      if (unlistenUpdates) unlistenUpdates();
    };
  }, [setQuery]);

  const isAnyModalOpen = Boolean(
    showFeedbackModal ||
    showLicenseModal ||
    showDiagnosticsModal ||
    showTimelineDrawer ||
    showActionsModal ||
    quickLookOpen ||
    isUpdateModalOpen ||
    pendingApproval !== null ||
    inputModalConfig !== null ||
    shellConfirmation !== null
  );

  // Always ensure omnibar is focused when palette is visible or regains focus, unless inside a modal
  useEffect(() => {
    const onFocus = () => {
      if (!isAnyModalOpen) {
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    onFocus();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isAnyModalOpen]);

  // Restore focus to omnibar immediately when any modal is dismissed
  useEffect(() => {
    if (!isAnyModalOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isAnyModalOpen]);

  // Contextual file preview and Git info
  useEffect(() => {
    if (!selectedItem?.path) {
      setGitInfo(null);
      setFilePreview(null);
      return;
    }

    tauriInvoke<GitInfo>("get_git_info", { path: selectedItem.path })
      .then((info) => setGitInfo(info || null))
      .catch(() => setGitInfo(null));

    tauriInvoke<FilePreview>("read_file_preview", { path: selectedItem.path })
      .then((preview) => setFilePreview(preview || null))
      .catch(() => setFilePreview(null));
  }, [selectedItem?.path]);

  // Dismiss window
  const handleDismissWindow = useCallback(async () => {
    try {
      await tauriInvoke("hide_window");
    } catch (_) {}
  }, []);

  // Item Launch & Actions
  const handleLaunch = useCallback(async (path: string) => {
    recordItemUsage(path);
    if (tauriInvoke) {
      try {
        await tauriInvoke("launch_item", { path });
        handleDismissWindow();
        return;
      } catch (_) {}
    }
  }, [handleDismissWindow]);

  const handleOpenFolder = useCallback(async (path: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("open_parent_folder", { path });
        return;
      } catch (_) {}
    }
  }, []);

  const handleOpenUrl = useCallback(async (url: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("open_url", { url });
        notify("Opening in default browser...");
        return;
      } catch (_) {}
    }
    window.open(url, "_blank");
  }, [notify]);

  const handleLaunchGame = useCallback(async (launchUri: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("launch_game", { launchUri });
        notify("Launching Game...");
        handleDismissWindow();
        return;
      } catch (err: any) {
        setPortStatusMsg(`Game launch error: ${err}`);
      }
    }
  }, [handleDismissWindow, notify, setPortStatusMsg]);

  const handleSnapWindow = useCallback(async (position: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("snap_window", { position });
        handleDismissWindow();
      } catch (err: any) {
        setPortStatusMsg(`Snap error: ${err}`);
      }
    }
  }, [handleDismissWindow, setPortStatusMsg]);

  const handleItemAction = useCallback(async (item: Item) => {
    if (item.path.startsWith("plugin://")) {
      const scriptPath = item.path.replace("plugin://", "");
      try {
        notify(`Running plugin: ${item.title}...`);
        const out = await tauriInvoke<string>("run_plugin", { scriptPath, args: "" });
        if (out) {
          notify(`Plugin output: ${out.slice(0, 50)}...`);
        }
      } catch (err: any) {
        notify(`Plugin error: ${err}`);
      }
      return;
    }

    if (item.path.startsWith("feature-toggle://")) {
      const fid = item.path.replace("feature-toggle://", "") as FeatureId;
      const next = toggleFeature(fid);
      const meta = FEATURE_REGISTRY[fid];
      notify(`${meta ? meta.name : fid}: ${next ? "Enabled" : "Disabled"}`);
      setQuery("");
      return;
    }

    if (item.path.startsWith("env-launch://")) {
      const profileName = item.path.replace("env-launch://", "");
      notify(`Transiently injecting secrets for '${profileName}'...`);
      launchEnvProfile(profileName, "wt")
        .then((msg) => {
          notify(msg);
          setQuery("");
        })
        .catch((err: any) => {
          notify(`Launch error: ${err.message || err}`);
        });
      return;
    }

    if (item.path.startsWith("plan-exec://")) {
      notify(`Action plan step active: ${item.title}. Press Enter or click 'Approve & Execute' in preview drawer.`);
      return;
    }

    if (item.path === "wsl://shutdown") {
      notify("Shutting down WSL virtual machine to reclaim RAM...");
      wslShutdown()
        .then((res) => {
          notify(res.message);
          setQuery("");
        })
        .catch((err: any) => notify(`WSL shutdown error: ${err.message || err}`));
      return;
    }

    if (item.path.startsWith("wsl://")) {
      const distro = item.path.replace("wsl://", "");
      notify(`Launching WSL shell for '${distro}' in Windows Terminal...`);
      wslLaunchShell(distro)
        .then((msg) => {
          notify(msg);
          setQuery("");
        })
        .catch((err: any) => notify(`WSL error: ${err.message || err}`));
      return;
    }

    if (item.path === "docker://start-daemon") {
      notify("Launching Docker Desktop...");
      dockerStartDaemon()
        .then((msg) => {
          notify(msg);
          setQuery("");
        })
        .catch((err: any) => notify(`Docker launch error: ${err.message || err}`));
      return;
    }

    if (item.path.startsWith("docker://")) {
      const cid = item.path.replace("docker://", "");
      notify(`Opening interactive shell for container ${cid.slice(0, 10)}...`);
      dockerOpenShell(cid)
        .then((msg) => {
          notify(msg);
          setQuery("");
        })
        .catch((err: any) => notify(`Docker shell error: ${err.message || err}`));
      return;
    }

    if (item.id === "util-cockpit" || item.path === ":docker") {
      setQuery("docker");
      return;
    }

    if (item.id === "util-features" || item.path === "altspace://features") {
      setLicenseModalTab("features");
      setShowLicenseModal(true);
      return;
    }

    if (item.id === "util-clipboard") {
      setActiveTab("clipboard");
      setQuery("");
    } else if (
      item.id === "util-about" ||
      item.id === "quota-limit-notice" ||
      item.path === "altspace://license" ||
      item.path === "altspace://about"
    ) {
      setLicenseModalTab("account");
      setShowLicenseModal(true);
      return;
    } else if (item.id === "util-ports") {
      setActiveTab("ports");
      setQuery("");
    } else if (item.id === "util-drives") {
      setShowActionsModal(true);
    } else if (item.id === "util-feedback") {
      setShowFeedbackModal(true);
      setQuery("");
    } else if (item.id === "util-contribute") {
      if (tauriInvoke) {
        tauriInvoke("open_url", { url: "https://github.com/codecheesee/altspace/blob/main/.github/CONTRIBUTING.md" });
      } else {
        window.open("https://github.com/codecheesee/altspace/blob/main/.github/CONTRIBUTING.md", "_blank");
      }
      handleDismissWindow();
    } else if (item.id === "util-update" || item.path.startsWith("update://")) {
      setIsUpdateModalOpen(true);
      setQuery("");
      return;
    } else if (item.id === "util-community") {
      if (tauriInvoke) {
        tauriInvoke("open_url", { url: "https://github.com/codecheesee/altspace" });
      } else {
        window.open("https://github.com/codecheesee/altspace", "_blank");
      }
      handleDismissWindow();
    } else if (item.id === "util-discord" || item.path === "altspace://discord") {
      if (tauriInvoke) {
        tauriInvoke("open_url", { url: "https://discord.gg/EtVCN9m7JV" });
      } else {
        window.open("https://discord.gg/EtVCN9m7JV", "_blank");
      }
      handleDismissWindow();
    } else if (item.category === "Setting") {
      if (tauriInvoke) tauriInvoke("open_settings_uri", { uri: item.path });
      handleDismissWindow();
    } else if (item.category === "Snippet") {
      handleCopyClipboard(item.path);
      notify("Snippet copied & ready to paste!");
      setQuery("");
    } else if (item.category === "Window Management") {
      handleSnapWindow(item.path);
    } else if (item.category === "Game") {
      handleLaunchGame(item.path);
    } else if (item.category === "Theme") {
      handleSelectTheme(item.path.replace("theme://", ""));
      setQuery("");
    } else if (item.category === "Folder") {
      handleOpenFolder(item.path);
    } else {
      handleLaunch(item.path);
    }
  }, [handleCopyClipboard, handleDismissWindow, handleLaunch, handleLaunchGame, handleOpenFolder, handleSelectTheme, handleSnapWindow, notify, setQuery]);

  // Sidebar visibility
  const selectedPort = filteredPorts[selectedIndex] || filteredPorts[0];
  const selectedClip = filteredClipboard[selectedIndex] || filteredClipboard[0];
  const isAutoRich = Boolean(
    (resolvedMode === "clipboard" && selectedClip) ||
    (resolvedMode === "ports" && selectedPort) ||
    (selectedSpecial) ||
    (selectedItem && (selectedItem.category === "File" || selectedItem.category === "Folder" || selectedItem.category === "Game"))
  );
  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((previous) => {
      const next = !previous;
      saveStoredBoolean(SIDEBAR_PREFERENCE_KEY, next);
      return next;
    });
  }, []);

  // Custom accent prompt modal
  const openCustomAccentModal = () => {
    setInputModalConfig({
      title: "Custom Accent Color",
      description: "Enter a 6-digit hex color code (e.g. #8b5cf6)",
      placeholder: "#8b5cf6",
      defaultValue: activeTheme.accentHex,
      onConfirm: (hex) => {
        setInputModalConfig(null);
        handleSetCustomAccent(hex);
      },
    });
  };

  // Export / Import config
  const handleExportConfig = () => {
    const config = {
      app: "AltSpace",
      config_version: 2,
      version: "2.2.0",
      exported_at: new Date().toISOString(),
      theme_id: currentThemeId,
      custom_accent: customAccent,
      autostart,
      sidebar_visible: isSidebarVisible,
      search_all_drives: driveStats?.search_all_drives ?? false,
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    notify("AltSpace Config copied (.altconfig JSON)!");
  };

  const handleImportConfig = () => {
    setInputModalConfig({
      title: "Import AltSpace Config",
      description: "Paste your non-sensitive .altconfig JSON bundle below",
      placeholder: '{"config_version": 2, "theme_id": "raycast-dark", ...}',
      onConfirm: (input) => {
        setInputModalConfig(null);
        if (!input?.trim()) return;
        try {
          const parsed = JSON.parse(input.trim());
          const validation = validateAltConfig(parsed);
          if (!validation.valid || !validation.config) {
            notify(validation.error || "Configuration validation failed");
            return;
          }
          const validConfig = validation.config;
          const currentConfig = {
            theme_id: currentThemeId,
            custom_accent: customAccent,
            sidebar_visible: isSidebarVisible,
            search_all_drives: driveStats?.search_all_drives ?? false,
          };
          const diff = computeConfigDiff(currentConfig, validConfig);
          const changeCount = diff.filter((d) => d.status === "changed" || d.status === "added").length;

          if (validConfig.theme_id) handleSelectTheme(validConfig.theme_id);
          if (typeof validConfig.custom_accent === "string") handleSetCustomAccent(validConfig.custom_accent);
          if (typeof validConfig.sidebar_visible === "boolean") {
            setIsSidebarVisible(validConfig.sidebar_visible);
            saveStoredBoolean(SIDEBAR_PREFERENCE_KEY, validConfig.sidebar_visible);
          }
          if (typeof validConfig.search_all_drives === "boolean") {
            saveStoredBoolean(DRIVE_SEARCH_PREFERENCE_KEY, validConfig.search_all_drives);
            tauriInvoke<DriveIndexStats>("set_search_all_drives", { enabled: validConfig.search_all_drives })
              .then((stats) => {
                if (stats) setDriveStats(stats);
              })
              .catch(() => notify("Drive preference could not be applied"));
          }
          notify(`Config imported cleanly (${changeCount} preferences updated)!`);
        } catch (err: any) {
          notify(err?.message ? `Import failed: ${err.message}` : "Invalid config JSON — import failed");
        }
      },
    });
  };

  // 5. Contextual Actions Hook
  const { getContextualActions } = useContextualActions({
    currentMode: resolvedMode,
    selectedItem,
    selectedSpecial,
    selectedPort,
    selectedClip,
    isSidebarVisible,
    isAutoRich,
    currentThemeId,
    activeTheme,
    autostart,
    driveStats,
    onItemAction: handleItemAction,
    onCopyClipboard: handleCopyClipboard,
    onOpenFolder: handleOpenFolder,
    onKillPort: handleKillPort,
    onPurgeDevServers: handlePurgeAllDevServers,
    onToggleSidebar: toggleSidebar,
    onCycleTheme: handleCycleTheme,
    onSelectTheme: handleSelectTheme,
    onSetCustomAccent: openCustomAccentModal,
    onResetCustomAccent: handleResetCustomAccent,
    onExportConfig: handleExportConfig,
    onImportConfig: handleImportConfig,
    onToggleAutostart: async () => {
      const next = !autostart;
      await tauriInvoke("set_autostart", { enable: next });
      setAutostart(next);
      notify(next ? "Autostart on Boot: Enabled" : "Autostart on Boot: Disabled");
    },
    onToggleAllDrives: async () => {
      const enabled = !(driveStats?.search_all_drives ?? false);
      const updated = await tauriInvoke<DriveIndexStats>("set_search_all_drives", { enabled });
      if (updated) {
        setDriveStats(updated);
        saveStoredBoolean(DRIVE_SEARCH_PREFERENCE_KEY, enabled);
      }
      notify("Multi-Drive Search toggled");
    },
    onRescanDrives: async () => {
      await tauriInvoke("rescan_drives");
      notify("Rescanning all NTFS drives...");
    },
    onCloseActionsModal: () => setShowActionsModal(false),
    onOpenQuickLook: () => setQuickLookOpen(true),
    onOpenFeedback: () => setShowFeedbackModal(true),
    onOpenStore: () => { setActiveTab("store"); setQuery(""); },
    onOpenLicense: () => setShowLicenseModal(true),
    onOpenDiagnostics: () => setShowDiagnosticsModal(true),
  });

  // Global Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If any modal/drawer is open, modals handle their own keys (Esc, Enter, inputs)
    if (isAnyModalOpen) {
      if (e.key === "Escape") {
        if (showLicenseModal) setShowLicenseModal(false);
        if (showDiagnosticsModal) setShowDiagnosticsModal(false);
        if (showTimelineDrawer) setShowTimelineDrawer(false);
        if (showFeedbackModal) setShowFeedbackModal(false);
        if (showActionsModal) setShowActionsModal(false);
        if (quickLookOpen) setQuickLookOpen(false);
      }
      return;
    }

    const activeEl = document.activeElement;
    const isTyping = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

    if ((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === "b" || e.code === "KeyB")) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "," || e.code === "Comma")) {
      e.preventDefault();
      setLicenseModalTab("features");
      setShowLicenseModal(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key?.toLowerCase() === "d" || e.code === "KeyD")) {
      e.preventDefault();
      setShowDiagnosticsModal((prev) => !prev);
      return;
    }

    if ((e.key?.toLowerCase() === "k" || e.code === "KeyK") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowActionsModal((prev) => !prev);
      setActionSelectedIndex(0);
      return;
    }

    if ((e.key?.toLowerCase() === "h" || e.code === "KeyH") && e.altKey) {
      e.preventDefault();
      setShowTimelineDrawer((prev) => !prev);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const maxLen = resolvedMode === "all" ? (specialCard ? items.length + 1 : items.length) : resolvedMode === "ports" ? filteredPorts.length : resolvedMode === "store" ? BUILTIN_EXTENSIONS.length : filteredClipboard.length;
      setSelectedIndex((prev) => (prev < maxLen - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resolvedMode === "all") {
        if (selectedSpecial) {
          if (selectedSpecial.kind === "calc") {
            handleCopyClipboard(selectedSpecial.data.result);
            setQuery("");
          } else if (selectedSpecial.kind === "transform") {
            handleCopyClipboard(selectedSpecial.data.output);
            notify(`✓ Copied ${selectedSpecial.data.title}`);
            setQuery("");
          } else if (selectedSpecial.kind === "quickjump") {
            handleOpenUrl(selectedSpecial.data.url);
            setQuery("");
          } else if (selectedSpecial.kind === "snippet") {
            handleCopyClipboard(selectedSpecial.data.resolvedContent);
            notify("Snippet copied to clipboard!");
            setQuery("");
          } else if (selectedSpecial.kind === "terminal") {
            handleExecuteTerminalCommand(selectedSpecial.data.command);
          } else if (selectedSpecial.kind === "ai") {
            if (selectedSpecial.data.response) {
              handleCopyClipboard(selectedSpecial.data.response);
              notify("AI response copied!");
            } else if (selectedSpecial.data.error) {
              handleOpenUrl("https://github.com/codecheesee/altspace/blob/main/docs/OLLAMA_SETUP_GUIDE.md");
              notify("Opening Ollama Setup Guide in browser...");
            }
          }
        } else if (selectedItem) {
          if (e.ctrlKey) handleOpenFolder(selectedItem.path);
          else handleItemAction(selectedItem);
        }
      } else if (resolvedMode === "ports" && selectedPort) {
        handleKillPort(selectedPort.pid, selectedPort.port);
      } else if (resolvedMode === "clipboard" && selectedClip) {
        handleCopyClipboard(selectedClip.content);
      }
    } else if (e.key === " " && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Space for QuickLook: Only when NOT typing in an input or textarea
      if (!isTyping && resolvedMode === "all" && selectedItem && (document.activeElement !== inputRef.current || query === "" || e.shiftKey)) {
        e.preventDefault();
        setQuickLookOpen((prev) => !prev);
      }
    } else if (e.key === "Escape") {
      if (quickLookOpen) setQuickLookOpen(false);
      else if (showActionsModal) setShowActionsModal(false);
      else if (query) setQuery("");
      else handleDismissWindow();
    }
  };

  // Container background click immediately returns focus to the search omnibar
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (isAnyModalOpen) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("textarea")) {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  }, [isAnyModalOpen]);

  // Window-level keydown listener & Global Omnibar Steering (Type-to-Search)
  // Ensures any typing immediately enters the search box regardless of mouse position or prior clicks
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (isAnyModalOpen) return;

      const active = document.activeElement;
      const isInputActive = active === inputRef.current || active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        if (quickLookOpen) {
          e.preventDefault();
          setQuickLookOpen(false);
        } else if (showActionsModal) {
          e.preventDefault();
          setShowActionsModal(false);
        } else if (query) {
          e.preventDefault();
          setQuery("");
        } else {
          e.preventDefault();
          handleDismissWindow();
        }
        return;
      }

      // If already focused in input, let normal input events flow
      if (isInputActive) return;

      // Ignore pure modifiers or special control combinations
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Tab" || e.key === "CapsLock" || e.key === "Shift") return;

      // Arrow navigation over items even if mouse was clicked outside input
      if (e.key === "ArrowDown") {
        e.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        if (selectedItem) {
          e.preventDefault();
          handleItemAction(selectedItem);
        }
        return;
      }

      // Printable character: steer directly into the search input!
      if (e.key.length === 1) {
        e.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        setQuery((prev) => prev + e.key);
        setSelectedIndex(0);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        setQuery((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [
    isAnyModalOpen,
    query,
    items,
    selectedItem,
    quickLookOpen,
    showActionsModal,
    handleDismissWindow,
    handleItemAction,
  ]);

  return (
    <div
      className="w-full h-full border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col overflow-hidden text-neutral-100 font-sans select-none transition-colors duration-150"
      style={{
        backgroundColor: activeTheme.bg,
        borderColor: activeTheme.borderColor,
      }}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {copiedNotification || `${resolvedMode} mode, ${items.length} items`}
      </div>

      {isSafeMode && (
        <div
          role="alert"
          className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1 text-center text-xs text-amber-300 flex items-center justify-center gap-2 select-none"
        >
          <span>🛡️ <strong>Safe Mode Active</strong>: Community and local extensions are quarantined. Built-in tools only.</span>
        </div>
      )}

      {updateInfo?.has_update && !isUpdateBannerDismissed && (
        <div
          role="alert"
          className="bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-emerald-500/10 border-b border-emerald-500/20 px-3.5 py-1 text-xs text-emerald-300 flex items-center justify-between select-none animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            className="flex items-center gap-2 text-left hover:text-white transition cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">AltSpace v{updateInfo.latest_version} Available</span>
            <span className="text-zinc-400 text-[11px] hidden sm:inline">• Click to view changelog and update</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10.5px] font-semibold border border-emerald-500/30 transition cursor-pointer"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsUpdateBannerDismissed(true)}
              className="text-zinc-400 hover:text-white text-xs px-1 cursor-pointer"
              title="Dismiss for this session"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <HeaderBar
        currentMode={resolvedMode}
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
        onOpenWebsite={() => handleOpenUrl("https://codecheesee.github.io/altspace/")}
        onDismiss={handleDismissWindow}
      />

      <div className="flex-1 flex overflow-hidden">
        {resolvedMode === "all" && (
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
            onCopiedNotification={notify}
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

        {resolvedMode === "clipboard" && (
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

        {resolvedMode === "ports" && (
          <PortsTab
            filteredPorts={filteredPorts}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            selectedPort={selectedPort}
            isSidebarVisible={isSidebarVisible}
            onKillPort={handleKillPort}
            onRefreshPorts={fetchPorts}
            fetchForensics={fetchForensics}
          />
        )}

        {resolvedMode === "store" && (
          <StoreTab
            query={query}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            onCopiedNotification={notify}
          />
        )}
      </div>

      <FooterBar
        currentMode={resolvedMode}
        itemsCount={items.length}
        clipsCount={filteredClipboard.length}
        portsCount={filteredPorts.length}
        activeTheme={activeTheme}
        onCycleTheme={handleCycleTheme}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={toggleSidebar}
        onOpenFeedback={() => setShowFeedbackModal(true)}
        onOpenLicense={() => setShowLicenseModal(true)}
        onOpenTimeline={() => setShowTimelineDrawer((prev) => !prev)}
        onOpenDiagnostics={() => setShowDiagnosticsModal(true)}
        onOpenWebsite={() => handleOpenUrl("https://codecheesee.github.io/altspace/")}
        onOpenActions={() => {
          setShowActionsModal((prev) => !prev);
          setActionSelectedIndex(0);
        }}
      />

      <ActionDrawer
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        activeTheme={activeTheme}
        currentMode={resolvedMode}
        selectedItem={selectedItem}
        selectedPort={selectedPort}
        actions={getContextualActions()}
        actionSelectedIndex={actionSelectedIndex}
        setActionSelectedIndex={setActionSelectedIndex}
      />

      <QuickLookModal
        isOpen={quickLookOpen}
        onClose={() => setQuickLookOpen(false)}
        selectedItem={selectedItem}
        filePreview={filePreview}
        onLaunch={handleLaunch}
        onCopiedNotification={notify}
      />

            <ActionTimelineDrawer
        isOpen={showTimelineDrawer}
        onClose={() => setShowTimelineDrawer(false)}
      />

      <ActionApprovalModal
        request={pendingApproval?.request ?? null}
        evaluation={pendingApproval?.evaluation ?? null}
        onApprove={() => {
          pendingApproval?.resolve(true);
          setPendingApproval(null);
        }}
        onCancel={() => {
          pendingApproval?.resolve(false);
          setPendingApproval(null);
        }}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        activeTheme={activeTheme}
        notify={notify}
      />

      <LicenseModal
        isOpen={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        activeTheme={activeTheme}
        notify={notify}
        initialTab={licenseModalTab}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        notify={notify}
        initialInfo={updateInfo}
      />

      <DiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        safeMode={isSafeMode}
        totalPlugins={plugins.length}
        driveIndexedCount={driveStats?.total_drives ?? 1}
        currentThemeId={currentThemeId}
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

      <ShellConfirmationModal
        isOpen={shellConfirmation !== null}
        command={shellConfirmation?.command ?? ""}
        onConfirm={() => resolveShellConfirmation(true)}
        onCancel={() => resolveShellConfirmation(false)}
      />
    </div>
  );
}
