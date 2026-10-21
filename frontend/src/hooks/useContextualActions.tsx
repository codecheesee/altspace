import { useCallback } from "react";
import {
  Folder,
  Terminal,
  ExternalLink,
  Copy,
  HardDrive,
  Shield,
  Globe,
  Palette,
  RefreshCw,
  Skull,
  Flame,
  Power,
  Code,
  Eye,
  Gamepad2,
  PanelRightClose,
  PanelRightOpen,
  Heart,
  Star,
  ShoppingBag,
  Activity,
  User,
} from "lucide-react";
import { tauriInvoke } from "../lib/appStorage";
import type {
  ActionItem,
  Mode,
  Item,
  SpecialCard,
  PortItem,
  ClipboardHistoryItem,
  DriveIndexStats,
} from "../types";

interface UseContextualActionsProps {
  currentMode: Mode;
  selectedItem: Item | null;
  selectedSpecial: SpecialCard | null;
  selectedPort: PortItem | null;
  selectedClip: ClipboardHistoryItem | null;
  isSidebarVisible: boolean;
  isAutoRich: boolean;
  currentThemeId: string;
  activeTheme: { accentHex: string; name: string };
  autostart: boolean;
  driveStats: DriveIndexStats | null;
  onItemAction: (item: Item) => void;
  onCopyClipboard: (content: string) => void;
  onOpenFolder: (path: string) => void;
  onKillPort: (pid: number, port: number) => void;
  onPurgeDevServers: () => void;
  onToggleSidebar: () => void;
  onCycleTheme: () => void;
  onSelectTheme: (themeId: string) => void;
  onSetCustomAccent: () => void;
  onResetCustomAccent: () => void;
  onExportConfig: () => void;
  onImportConfig: () => void;
  onToggleAutostart: () => void;
  onToggleAllDrives: () => void;
  onRescanDrives: () => void;
  onCloseActionsModal: () => void;
  onOpenQuickLook: () => void;
  onOpenFeedback?: () => void;
  onOpenStore?: () => void;
  onOpenLicense?: () => void;
  onOpenDiagnostics?: () => void;
}

export function useContextualActions({
  currentMode,
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
  onItemAction,
  onCopyClipboard,
  onOpenFolder,
  onKillPort,
  onPurgeDevServers,
  onToggleSidebar,
  onCycleTheme,
  onSelectTheme,
  onSetCustomAccent,
  onResetCustomAccent,
  onExportConfig,
  onImportConfig,
  onToggleAutostart,
  onToggleAllDrives,
  onRescanDrives,
  onCloseActionsModal,
  onOpenQuickLook,
  onOpenFeedback,
  onOpenStore,
  onOpenLicense,
  onOpenDiagnostics,
}: UseContextualActionsProps) {
  const getContextualActions = useCallback((): ActionItem[] => {
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
                onPurgeDevServers();
              } else if (tauriInvoke) {
                tauriInvoke("execute_system_command", { command: selectedSpecial.data.systemAction });
              }
            } else {
              onCopyClipboard(selectedSpecial.data.result);
            }
            onCloseActionsModal();
          },
        });
        if (!selectedSpecial.data.systemAction) {
          actions.push({
            id: "calc-copy-expression",
            title: `Copy Expression (${selectedSpecial.data.expression})`,
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+C",
            icon: <Copy className="w-4 h-4 text-neutral-400" />,
            run: () => {
              onCopyClipboard(selectedSpecial.data.expression);
              onCloseActionsModal();
            },
          });
        }
      } else if (selectedSpecial && selectedSpecial.kind === "ai") {
        actions.push({
          id: "ai-copy-response",
          title: "Copy AI Response",
          section: "PRIMARY ACTION",
          shortcut: "↵",
          icon: <Copy className="w-4 h-4 text-purple-400" />,
          run: () => {
            if (selectedSpecial.data.response) {
              onCopyClipboard(selectedSpecial.data.response);
            }
            onCloseActionsModal();
          },
        });
        actions.push({
          id: "ai-copy-prompt",
          title: "Copy AI Prompt",
          section: "STANDARD ACTIONS",
          shortcut: "Ctrl+C",
          icon: <Copy className="w-4 h-4 text-neutral-400" />,
          run: () => {
            onCopyClipboard(selectedSpecial.data.prompt);
            onCloseActionsModal();
          },
        });
      } else if (selectedItem) {
        if (selectedItem.path.startsWith("docker://")) {
          const cid = selectedItem.path.replace("docker://", "");
          actions.push({
            id: "docker-open-shell",
            title: "Open Interactive Shell in Terminal",
            section: "DOCKER ACTIONS",
            shortcut: "↵",
            icon: <Terminal className="w-4 h-4 text-sky-400" />,
            run: () => {
              onItemAction(selectedItem);
              onCloseActionsModal();
            },
          });
          actions.push({
            id: "docker-restart-container",
            title: "Restart Container",
            section: "DOCKER ACTIONS",
            icon: <RefreshCw className="w-4 h-4 text-amber-400" />,
            run: () => {
              if (tauriInvoke) tauriInvoke("docker_container_action", { id: cid, action: "restart" });
              onCloseActionsModal();
            },
          });
          actions.push({
            id: "docker-stop-container",
            title: "Stop Container",
            section: "DOCKER ACTIONS",
            icon: <Power className="w-4 h-4 text-rose-400" />,
            run: () => {
              if (tauriInvoke) tauriInvoke("docker_container_action", { id: cid, action: "stop" });
              onCloseActionsModal();
            },
          });
          actions.push({
            id: "docker-copy-id",
            title: `Copy Container ID (${cid.slice(0, 12)})`,
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+C",
            icon: <Copy className="w-4 h-4 text-neutral-400" />,
            run: () => {
              onCopyClipboard(cid);
              onCloseActionsModal();
            },
          });
          return actions;
        }

        if (selectedItem.path.startsWith("wsl://")) {
          const distro = selectedItem.path.replace("wsl://", "");
          actions.push({
            id: "wsl-launch-shell",
            title: distro === "shutdown" ? "Reclaim WSL Virtual Memory" : `Launch ${distro} Shell in Windows Terminal`,
            section: "WSL ACTIONS",
            shortcut: "↵",
            icon: <Terminal className="w-4 h-4 text-sky-400" />,
            run: () => {
              onItemAction(selectedItem);
              onCloseActionsModal();
            },
          });
          if (distro !== "shutdown") {
            actions.push({
              id: "wsl-terminate-distro",
              title: `Terminate Distribution (${distro})`,
              section: "WSL ACTIONS",
              icon: <Power className="w-4 h-4 text-rose-400" />,
              run: () => {
                if (tauriInvoke) tauriInvoke("wsl_terminate_distro", { distro });
                onCloseActionsModal();
              },
            });
          }
          actions.push({
            id: "wsl-reclaim-ram",
            title: "Reclaim WSL Virtual Memory (wsl --shutdown)",
            section: "WSL ACTIONS",
            icon: <RefreshCw className="w-4 h-4 text-emerald-400" />,
            run: () => {
              if (tauriInvoke) tauriInvoke("wsl_shutdown");
              onCloseActionsModal();
            },
          });
          actions.push({
            id: "wsl-copy-name",
            title: `Copy Identifier (${distro})`,
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+C",
            icon: <Copy className="w-4 h-4 text-neutral-400" />,
            run: () => {
              onCopyClipboard(distro);
              onCloseActionsModal();
            },
          });
          return actions;
        }

        const isGame = selectedItem.category === "Game";
        const isApp = selectedItem.category === "Application";
        const isFolder = selectedItem.category === "Folder";
        const isFile = selectedItem.category === "File";
        const isSetting = selectedItem.category === "Setting";
        const isSnippet = selectedItem.category === "Snippet";

        actions.push({
          id: "item-primary",
          title: isGame
            ? "Play Game"
            : isApp
            ? "Launch Application"
            : isFolder
            ? "Open in File Explorer"
            : isSetting
            ? "Open Windows Setting"
            : isSnippet
            ? "Expand Snippet & Paste"
            : "Open File",
          section: "PRIMARY ACTION",
          shortcut: "↵",
          icon: isGame ? <Gamepad2 className="w-4 h-4 text-violet-400" /> : <ExternalLink className="w-4 h-4 text-amber-400" />,
          run: () => {
            onItemAction(selectedItem);
            onCloseActionsModal();
          },
        });

        if (isApp) {
          actions.push({
            id: "app-run-admin",
            title: "Run as Administrator",
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+Shift+↵",
            icon: <Shield className="w-4 h-4 text-rose-400" />,
            run: () => {
              if (tauriInvoke) tauriInvoke("run_as_admin", { path: selectedItem.path });
              onCloseActionsModal();
            },
          });
        }

        if (isFile || isFolder) {
          actions.push({
            id: "file-quicklook",
            title: "QuickLook Preview",
            section: "STANDARD ACTIONS",
            shortcut: "Space",
            icon: <Eye className="w-4 h-4 text-sky-400" />,
            run: () => {
              onOpenQuickLook();
              onCloseActionsModal();
            },
          });
        }

        if (isFolder || isFile) {
          actions.push({
            id: "file-reveal",
            title: "Reveal in File Explorer",
            section: "STANDARD ACTIONS",
            shortcut: "Ctrl+↵",
            icon: <Folder className="w-4 h-4 text-amber-400" />,
            run: () => {
              onOpenFolder(selectedItem.path);
              onCloseActionsModal();
            },
          });

          actions.push({
            id: "file-open-terminal",
            title: "Open Terminal Here",
            section: "DEVELOPER ACTIONS",
            shortcut: "Ctrl+T",
            icon: <Terminal className="w-4 h-4 text-emerald-400" />,
            run: () => {
              if (tauriInvoke) tauriInvoke("open_in_terminal", { path: selectedItem.path });
              onCloseActionsModal();
            },
          });

          actions.push({
            id: "file-open-vscode",
            title: "Open in VS Code",
            section: "DEVELOPER ACTIONS",
            shortcut: "Ctrl+Shift+C",
            icon: <Code className="w-4 h-4 text-blue-400" />,
            run: () => {
              if (tauriInvoke) tauriInvoke("open_in_vscode", { path: selectedItem.path });
              onCloseActionsModal();
            },
          });
        }

        actions.push({
          id: "item-copy-path",
          title: "Copy Absolute Path",
          section: "STANDARD ACTIONS",
          shortcut: "Ctrl+C",
          icon: <Copy className="w-4 h-4 text-neutral-400" />,
          run: () => {
            onCopyClipboard(selectedItem.path);
            onCloseActionsModal();
          },
        });
      }
    } else if (currentMode === "ports" && selectedPort) {
      actions.push({
        id: "port-kill",
        title: `Kill Process ${selectedPort.process_name} (PID ${selectedPort.pid})`,
        section: "PRIMARY ACTION",
        shortcut: "↵",
        icon: <Skull className="w-4 h-4 text-rose-400" />,
        run: () => {
          onKillPort(selectedPort.pid, selectedPort.port);
          onCloseActionsModal();
        },
      });

      actions.push({
        id: "port-purge-all",
        title: "Kill ALL Orphaned Dev Servers (:3000, :5173, :8080)",
        section: "DANGEROUS ACTIONS",
        shortcut: "Ctrl+Shift+K",
        icon: <Flame className="w-4 h-4 text-rose-500" />,
        run: () => {
          onPurgeDevServers();
          onCloseActionsModal();
        },
      });

      actions.push({
        id: "port-open-browser",
        title: `Open http://localhost:${selectedPort.port} in Browser`,
        section: "STANDARD ACTIONS",
        shortcut: "Ctrl+O",
        icon: <Globe className="w-4 h-4 text-cyan-400" />,
        run: () => {
          if (tauriInvoke) tauriInvoke("open_url", { url: `http://localhost:${selectedPort.port}` });
          onCloseActionsModal();
        },
      });
    } else if (currentMode === "clipboard" && selectedClip) {
      actions.push({
        id: "clip-paste",
        title: "Copy to Clipboard",
        section: "PRIMARY ACTION",
        shortcut: "↵",
        icon: <Copy className="w-4 h-4 text-emerald-400" />,
        run: () => {
          onCopyClipboard(selectedClip.content);
          onCloseActionsModal();
        },
      });
    }

    // PREFERENCES (Interactive switches with clear ON/OFF indicators)
    actions.push({
      id: "pref-autostart",
      title: "Launch on Windows Startup",
      section: "PREFERENCES",
      icon: <Power className="w-4 h-4 text-emerald-400" />,
      isToggle: true,
      toggleValue: autostart,
      run: () => {
        onToggleAutostart();
      },
    });

    actions.push({
      id: "pref-all-drives",
      title: "Search All Hard Drives (C:, D:, External)",
      section: "PREFERENCES",
      icon: <HardDrive className="w-4 h-4 text-blue-400" />,
      isToggle: true,
      toggleValue: driveStats?.search_all_drives ?? true,
      run: () => {
        onToggleAllDrives();
      },
    });

    actions.push({
      id: "pref-toggle-sidebar",
      title: "Context Preview Sidebar",
      section: "PREFERENCES",
      shortcut: "Ctrl+B",
      icon: isSidebarVisible ? <PanelRightClose className="w-4 h-4 text-rose-400" /> : <PanelRightOpen className="w-4 h-4 text-rose-400" />,
      isToggle: true,
      toggleValue: isSidebarVisible,
      run: () => {
        onToggleSidebar();
      },
    });

    actions.push({
      id: "pref-rescan-drives",
      title: "Re-index All Hard Drives Now",
      section: "PREFERENCES",
      icon: <RefreshCw className="w-4 h-4 text-zinc-400" />,
      badge: driveStats ? `${driveStats.indexed_count.toLocaleString()} files` : undefined,
      run: () => {
        onRescanDrives();
        onCloseActionsModal();
      },
    });

    // THEMES & APPEARANCE (Streamlined)
    actions.push({
      id: "theme-cycle",
      title: "Cycle Theme",
      section: "THEMES & APPEARANCE",
      badge: activeTheme.name,
      shortcut: "Ctrl+Shift+T",
      icon: (
        <span
          className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block shadow-sm"
          style={{ backgroundColor: activeTheme.accentHex }}
        />
      ),
      run: () => {
        onCycleTheme();
      },
    });

    actions.push({
      id: "theme-custom-accent",
      title: "Custom Accent Glow...",
      section: "THEMES & APPEARANCE",
      icon: <Palette className="w-4 h-4 text-amber-400" />,
      run: () => {
        onCloseActionsModal();
        onSetCustomAccent();
      },
    });

    actions.push({
      id: "theme-reset-accent",
      title: "Reset Theme to Preset Default",
      section: "THEMES & APPEARANCE",
      icon: <RefreshCw className="w-4 h-4 text-neutral-400" />,
      run: () => {
        onResetCustomAccent();
        onCloseActionsModal();
      },
    });

    // CONFIG & TOOLS
    actions.push({
      id: "config-export",
      title: "Export AltSpace Config (.altconfig JSON)",
      section: "CONFIG & TOOLS",
      shortcut: "Ctrl+Shift+E",
      icon: <Copy className="w-4 h-4 text-cyan-400" />,
      run: () => {
        onExportConfig();
        onCloseActionsModal();
      },
    });

    actions.push({
      id: "config-import",
      title: "Import AltSpace Config from Clipboard...",
      section: "CONFIG & TOOLS",
      icon: <HardDrive className="w-4 h-4 text-cyan-400" />,
      run: () => {
        onCloseActionsModal();
        onImportConfig();
      },
    });

    if (onOpenLicense) {
      actions.push({
        id: "sys-about-account",
        title: "About & Account (Profile, Plan & Machine ID)",
        section: "CONFIG & TOOLS",
        shortcut: "Ctrl+,",
        icon: <User className="w-4 h-4 text-sky-400" />,
        run: () => {
          onCloseActionsModal();
          onOpenLicense();
        },
      });
    }

    if (onOpenDiagnostics) {
      actions.push({
        id: "privacy-diagnostics",
        title: "Privacy Diagnostics & Sanitized Telemetry...",
        section: "CONFIG & TOOLS",
        shortcut: "Ctrl+Shift+D",
        icon: <Activity className="w-4 h-4 text-emerald-400" />,
        run: () => {
          onCloseActionsModal();
          onOpenDiagnostics();
        },
      });
    }

    // COMMUNITY & SUPPORT
    actions.push({
      id: "comm-store",
      title: "Community Extension Store",
      section: "COMMUNITY & SUPPORT",
      icon: <ShoppingBag className="w-4 h-4 text-purple-400" />,
      run: () => {
        onOpenStore?.();
        onCloseActionsModal();
      },
    });

    actions.push({
      id: "comm-feedback",
      title: "Submit Feedback & Report Issue",
      section: "COMMUNITY & SUPPORT",
      icon: <Heart className="w-4 h-4 text-rose-400" />,
      run: () => {
        onOpenFeedback?.();
        onCloseActionsModal();
      },
    });

    actions.push({
      id: "comm-github",
      title: "Star on GitHub (codecheesee/altspace)",
      section: "COMMUNITY & SUPPORT",
      icon: <Star className="w-4 h-4 text-amber-400" />,
      run: () => {
        if (tauriInvoke) tauriInvoke("open_url", { url: "https://github.com/codecheesee/altspace" });
        else window.open("https://github.com/codecheesee/altspace", "_blank");
        onCloseActionsModal();
      },
    });

    return actions;
  }, [
    currentMode,
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
    onItemAction,
    onCopyClipboard,
    onOpenFolder,
    onKillPort,
    onPurgeDevServers,
    onToggleSidebar,
    onCycleTheme,
    onSelectTheme,
    onSetCustomAccent,
    onResetCustomAccent,
    onExportConfig,
    onImportConfig,
    onToggleAutostart,
    onToggleAllDrives,
    onRescanDrives,
    onCloseActionsModal,
    onOpenQuickLook,
    onOpenFeedback,
    onOpenStore,
    onOpenLicense,
    onOpenDiagnostics,
  ]);

  return { getContextualActions };
}
