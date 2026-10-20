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
import { BUILTIN_EXTENSIONS } from "./lib/registry";
import { useThemeEngine } from "./hooks/useThemeEngine";
import { usePortInspector } from "./hooks/usePortInspector";
import { useClipboardHistory } from "./hooks/useClipboardHistory";
import { useSearchEngine } from "./hooks/useSearchEngine";
import { useContextualActions } from "./hooks/useContextualActions";
import {
  tauriInvoke,
  recordItemUsage,
  getItemFrequencies,
} from "./lib/appStorage";
import { refreshCurrencyRates } from "./lib/calc";
import type {
  Mode,
  Item,
  GitInfo,
  FilePreview,
  DriveIndexStats,
} from "./types";

interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_url: string;
  release_notes: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Mode>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Notification Toast State
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2500);
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
  } = useSearchEngine({
    currentMode,
    currentThemeId,
    onNotify: notify,
  });

  // 3. Dev Ports Inspector Hook
  const isStoreMode = activeTab === "store" || query.startsWith(":store") || query.startsWith(":plugin") || query.startsWith(":ext");
  const smartPortMode = !isStoreMode && query.startsWith(":") && !query.startsWith(":theme");
  const resolvedMode: Mode = isStoreMode ? "store" : smartPortMode ? "ports" : currentMode;

  const {
    filteredPorts,
    portStatusMsg,
    setPortStatusMsg,
    fetchPorts,
    handleKillPort,
    handlePurgeAllDevServers,
  } = usePortInspector(query, smartPortMode);

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
  const [manualSidebarToggle, setManualSidebarToggle] = useState<boolean | null>(null);

  // Input Modal State (replaces prompt/alert)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (v: string) => void;
  } | null>(null);

  // Auto-Updater Check on Mount
  useEffect(() => {
    tauriInvoke<UpdateInfo>("check_app_update")
      .then((info) => {
        if (info && info.has_update) {
          notify(`⚡ AltSpace Update v${info.latest_version} available!`);
        }
      })
      .catch(() => {});
  }, [notify]);

  // Load autostart and drive settings
  useEffect(() => {
    tauriInvoke<boolean>("get_autostart_status")
      .then((status) => {
        if (typeof status === "boolean") setAutostart(status);
      })
      .catch(() => {});

    tauriInvoke<DriveIndexStats>("get_drive_settings")
      .then((stats) => {
        if (stats) setDriveStats(stats);
      })
      .catch(() => {});

    refreshCurrencyRates();
  }, []);

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
        }
      }).then((fn) => {
        unlistenMode = fn;
      });

      listen("open-feedback", () => {
        setShowFeedbackModal(true);
      }).then((fn) => {
        unlistenFeedback = fn;
      });
    }).catch(() => {});

    const onFocus = () => inputRef.current?.focus();
    window.addEventListener("focus", onFocus);

    return () => {
      if (unlisten) unlisten();
      if (unlistenMode) unlistenMode();
      if (unlistenFeedback) unlistenFeedback();
      window.removeEventListener("focus", onFocus);
    };
  }, [setQuery]);

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

    if (item.id === "util-clipboard") {
      setActiveTab("clipboard");
      setQuery("");
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
    } else if (item.id === "util-community") {
      if (tauriInvoke) {
        tauriInvoke("open_url", { url: "https://github.com/codecheesee/altspace" });
      } else {
        window.open("https://github.com/codecheesee/altspace", "_blank");
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
  const isSidebarVisible = manualSidebarToggle !== null ? manualSidebarToggle : isAutoRich;

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
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      theme_id: currentThemeId,
      custom_accent: customAccent,
      autostart,
      item_frequencies: getItemFrequencies(),
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    notify("AltSpace Config copied (.altconfig JSON)!");
  };

  const handleImportConfig = () => {
    setInputModalConfig({
      title: "Import AltSpace Config",
      description: "Paste your .altconfig JSON bundle below",
      placeholder: '{"theme_id": "raycast-dark", ...}',
      onConfirm: (input) => {
        setInputModalConfig(null);
        if (!input?.trim()) return;
        try {
          const parsed = JSON.parse(input.trim());
          if (parsed.theme_id) handleSelectTheme(parsed.theme_id);
          notify("Config imported successfully!");
        } catch {
          notify("Invalid config JSON — import failed");
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
    onToggleSidebar: () => setManualSidebarToggle((prev) => (prev === null ? !isAutoRich : !prev)),
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
      const updated = await tauriInvoke<DriveIndexStats>("set_search_all_drives", { enabled: !(driveStats?.search_all_drives ?? true) });
      if (updated) setDriveStats(updated);
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
  });

  // Global Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        actions[actionSelectedIndex]?.run();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowActionsModal(false);
        return;
      }
      if ((e.key?.toLowerCase() === "k" || e.code === "KeyK") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowActionsModal(false);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === "b" || e.code === "KeyB")) {
      e.preventDefault();
      setManualSidebarToggle((prev) => (prev === null ? !isAutoRich : !prev));
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
      if (resolvedMode === "all" && selectedItem && (document.activeElement !== inputRef.current || query === "" || e.shiftKey)) {
        e.preventDefault();
        setQuickLookOpen((prev) => !prev);
      }
    } else if ((e.key?.toLowerCase() === "k" || e.code === "KeyK") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowActionsModal((prev) => !prev);
      setActionSelectedIndex(0);
    } else if (e.key === "Escape") {
      if (quickLookOpen) setQuickLookOpen(false);
      else if (showActionsModal) setShowActionsModal(false);
      else if (query) setQuery("");
      else handleDismissWindow();
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
        onToggleSidebar={() => setManualSidebarToggle((prev) => (prev === null ? !isAutoRich : !prev))}
        onOpenFeedback={() => setShowFeedbackModal(true)}
        onOpenLicense={() => setShowLicenseModal(true)}
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
