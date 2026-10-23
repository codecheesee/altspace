import { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Gamepad2,
  Settings,
  Palette,
  Keyboard,
  Shield,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Search,
  ExternalLink,
  Filter,
  CheckCircle2,
  RotateCcw,
  Plus,
} from "lucide-react";
import {
  KNOWN_NOISE_EXTENSIONS,
  getExtensionFilterConfig,
  toggleExtensionState,
  toggleMasterFilter,
  addCustomBlockedExtension,
  resetExtensionFilterToDefault,
  type ExtensionFilterConfig,
} from "../lib/fileFilter";
import { cn } from "../lib/utils";
import { tauriInvoke } from "../lib/appStorage";
import type { Mode, Item, PortItem, ActionItem } from "../types";

export type SubmenuCategory =
  | "main"
  | "quick-actions"
  | "game-hub"
  | "preferences"
  | "aesthetics"
  | "shortcuts"
  | "security"
  | "community"
  | "file-filters";

interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: {
    cardBg: string;
    borderColor: string;
    accentHex?: string;
  };
  currentMode: Mode;
  selectedItem: Item | null;
  selectedPort: PortItem | null;
  actions: ActionItem[];
  actionSelectedIndex: number;
  setActionSelectedIndex: (idx: number | ((prev: number) => number)) => void;
  isProOrSupporter?: boolean;
  licenseTier?: string;
}

interface ShortcutDef {
  id: string;
  category: "General" | "Navigation" | "Dev Tools" | "Omnibar";
  label: string;
  keys: string[];
  description: string;
}

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  {
    id: "summon",
    category: "General",
    label: "Summon AltSpace Launcher",
    keys: ["Alt", "Space"],
    description: "Instant cold invocation across all applications",
  },
  {
    id: "dismiss",
    category: "General",
    label: "Dismiss / Hide Window",
    keys: ["Esc"],
    description: "Minimizes AltSpace to system tray",
  },
  {
    id: "open",
    category: "Navigation",
    label: "Execute / Open Selected",
    keys: ["↵"],
    description: "Launch application, open folder, or run selected action",
  },
  {
    id: "admin",
    category: "Navigation",
    label: "Run as Administrator",
    keys: ["Ctrl", "Shift", "↵"],
    description: "Launch selected application or script with elevated UAC privileges",
  },
  {
    id: "reveal",
    category: "Navigation",
    label: "Reveal in File Explorer",
    keys: ["Ctrl", "O"],
    description: "Open containing directory and highlight item in Windows Explorer",
  },
  {
    id: "copy-path",
    category: "Navigation",
    label: "Copy Path to Clipboard",
    keys: ["Ctrl", "C"],
    description: "Copy absolute path of selected item to clipboard",
  },
  {
    id: "preview",
    category: "Navigation",
    label: "QuickLook File Preview",
    keys: ["Space"],
    description: "Inspect code, images, or metadata in instant preview card",
  },
  {
    id: "actions",
    category: "Navigation",
    label: "Open Contextual Action Drawer",
    keys: ["Tab", "Ctrl+K"],
    description: "Browse curated submenus, secondary actions, and developer tools",
  },
  {
    id: "sidebar",
    category: "Navigation",
    label: "Toggle Details Sidebar",
    keys: ["Ctrl", "B"],
    description: "Show or hide contextual preview sidebar",
  },
  {
    id: "ports",
    category: "Dev Tools",
    label: "Dev Port Inspector",
    keys: ["Alt", "P"],
    description: "Inspect listening localhost TCP ports and process trees",
  },
  {
    id: "clipboard",
    category: "Dev Tools",
    label: "In-Memory Clipboard History",
    keys: ["Alt", "C"],
    description: "Search and restore DPAPI-protected clipboard items",
  },
  {
    id: "timeline",
    category: "Dev Tools",
    label: "Execution Timeline & 1-Click Undo",
    keys: ["Alt", "H"],
    description: "Review past actions and revert changes with single click",
  },
  {
    id: "diagnostics",
    category: "Dev Tools",
    label: "Privacy Diagnostics Report",
    keys: ["Ctrl", "Shift", "D"],
    description: "Audit sanitized logs and verified DPAPI credentials",
  },
  {
    id: "feedback",
    category: "General",
    label: "Beta Feedback & Bounties",
    keys: ["Ctrl", "Shift", "F"],
    description: "Send direct maintainer feedback and view feature bounties",
  },
  {
    id: "cmd-fix",
    category: "Omnibar",
    label: "Self-Healing Scan",
    keys: [":fix"],
    description: "Scan and resolve dev port collisions, git locks, and zombies",
  },
  {
    id: "cmd-port",
    category: "Omnibar",
    label: "Inspect Specific Port",
    keys: [":<port>"],
    description: "e.g. :3000 to inspect process holding port 3000",
  },
  {
    id: "cmd-theme",
    category: "Omnibar",
    label: "Theme Switcher",
    keys: [":theme"],
    description: "Cycle or select custom accent colors and glass themes",
  },
  {
    id: "cmd-games",
    category: "Omnibar",
    label: "Game Hub",
    keys: [":games"],
    description: "Search and launch games with fast mode or recording",
  },
];

export function ActionDrawer({
  isOpen,
  onClose,
  currentMode,
  selectedItem,
  selectedPort,
  actions,
  actionSelectedIndex,
  setActionSelectedIndex,
  isProOrSupporter = false,
  licenseTier = "Free",
}: ActionDrawerProps) {
  const [currentCategory, setCurrentCategory] = useState<SubmenuCategory>("main");
  const [subSelectedIndex, setSubSelectedIndex] = useState(0);
  const [shortcutFilter, setShortcutFilter] = useState("");
  const [filterConfig, setFilterConfig] = useState<ExtensionFilterConfig>(() => getExtensionFilterConfig());
  const [extSearchText, setExtSearchText] = useState("");
  const [customExtInput, setCustomExtInput] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const handleToggleExtension = (ext: string, shouldBlock: boolean) => {
    const updated = toggleExtensionState(ext, shouldBlock);
    setFilterConfig(updated);
    setFeedbackNotice(shouldBlock ? `Blocked ${ext} from search` : `Allowed ${ext} in search`);
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const handleToggleMaster = () => {
    const updated = toggleMasterFilter(!filterConfig.filterEnabled);
    setFilterConfig(updated);
    setFeedbackNotice(updated.filterEnabled ? "Search Noise Filter Enabled" : "Search Noise Filter Disabled");
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const handleAddCustomExt = () => {
    if (!customExtInput.trim()) return;
    const updated = addCustomBlockedExtension(customExtInput.trim());
    setFilterConfig(updated);
    setFeedbackNotice(`Added ${customExtInput.trim()} to blocked list`);
    setCustomExtInput("");
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const handleResetDefaults = () => {
    const updated = resetExtensionFilterToDefault();
    setFilterConfig(updated);
    setFeedbackNotice("Reset filters to factory defaults");
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  // Reset to main view whenever opened
  useEffect(() => {
    if (isOpen) {
      setCurrentCategory("main");
      setSubSelectedIndex(0);
      setShortcutFilter("");
      if (tauriInvoke) {
        tauriInvoke("focus_window").catch(() => {});
      }
    }
  }, [isOpen]);

  // Group contextual actions by submenu category
  const categorizedActions = useMemo(() => {
    const quick: ActionItem[] = [];
    const game: ActionItem[] = [];
    const prefs: ActionItem[] = [];
    const aesthetics: ActionItem[] = [];
    const security: ActionItem[] = [];
    const community: ActionItem[] = [];

    for (const a of actions) {
      const sec = a.section.toUpperCase();
      if (sec.includes("PRIMARY") || sec.includes("STANDARD") || sec.includes("DEVELOPER")) {
        quick.push(a);
      } else if (sec.includes("DOCKER") || sec.includes("WSL") || sec.includes("DANGEROUS")) {
        security.push(a);
      } else if (sec.includes("PREFERENCES")) {
        prefs.push(a);
      } else if (sec.includes("THEME") || sec.includes("APPEARANCE")) {
        aesthetics.push(a);
      } else if (sec.includes("CONFIG") || sec.includes("SECURITY")) {
        security.push(a);
      } else if (sec.includes("COMMUNITY") || sec.includes("SUPPORT")) {
        community.push(a);
      } else {
        quick.push(a);
      }
    }

    return { quick, game, prefs, aesthetics, security, community };
  }, [actions]);

  // Main menu items (7 curated professional categories)
  const mainCategories = useMemo(() => {
    const isGame = selectedItem?.category === "Game";
    return [
      {
        id: "quick-actions" as SubmenuCategory,
        title: "Quick Actions",
        desc: selectedItem ? `Context actions for ${selectedItem.title}` : "Item actions & launch options",
        icon: <Zap className="w-4 h-4 text-emerald-400" />,
        badge: `${categorizedActions.quick.length} actions`,
      },
      ...(isGame
        ? [
            {
              id: "game-hub" as SubmenuCategory,
              title: "Game Hub & Boost",
              desc: "Fast launch, recording triggers, game directory",
              icon: <Gamepad2 className="w-4 h-4 text-purple-400" />,
              badge: "Gamer Mode",
            },
          ]
        : []),
      {
        id: "preferences" as SubmenuCategory,
        title: "Preferences & Engine",
        desc: "Windows autostart, multi-drive index, rescan",
        icon: <Settings className="w-4 h-4 text-sky-400" />,
        badge: `${categorizedActions.prefs.length} items`,
      },
      {
        id: "file-filters" as SubmenuCategory,
        title: "File Noise Filters",
        desc: "Block unwanted extensions (.ini, .log, .tmp, .ink)",
        icon: <Filter className="w-4 h-4 text-emerald-400" />,
        badge: filterConfig.filterEnabled ? `${filterConfig.blockedExtensions.length} blocked` : "Disabled",
      },
      {
        id: "aesthetics" as SubmenuCategory,
        title: "Aesthetics & Themes",
        desc: "Dynamic themes, custom accent colors, glass effects",
        icon: <Palette className="w-4 h-4 text-pink-400" />,
        badge: `${categorizedActions.aesthetics.length} items`,
      },
      {
        id: "shortcuts" as SubmenuCategory,
        title: "Keyboard Shortcuts",
        desc: "Catalog of global & local hotkeys and commands",
        icon: <Keyboard className="w-4 h-4 text-amber-400" />,
        badge: `${DEFAULT_SHORTCUTS.length} keys`,
      },
      {
        id: "security" as SubmenuCategory,
        title: "Aegis Security & Self-Healing",
        desc: "Scan deadlocks, DPAPI secret vault, diagnostics",
        icon: <Shield className="w-4 h-4 text-emerald-400" />,
        badge: `${categorizedActions.security.length} tools`,
      },
      {
        id: "community" as SubmenuCategory,
        title: licenseTier === "Maintainer"
          ? "Maintainer & Community"
          : isProOrSupporter
          ? "Pro Membership & Community"
          : "AltSpace Pro & Community",
        desc: licenseTier === "Maintainer"
          ? "Sovereign Lifetime Access (@codecheesee) · Feedback, GitHub"
          : isProOrSupporter
          ? "Active Subscription · Feedback, GitHub"
          : "Founder Pass, Pro Features, Feedback, GitHub",
        icon: (
          <Sparkles
            className={cn(
              "w-4 h-4",
              licenseTier === "Maintainer"
                ? "text-amber-400"
                : isProOrSupporter
                ? "text-purple-400"
                : "text-indigo-400"
            )}
          />
        ),
        badge: licenseTier === "Maintainer" ? "Maintainer" : isProOrSupporter ? "Pro" : "Get Pro",
      },
    ];
  }, [selectedItem, categorizedActions]);

  // Current active list depending on whether we are on main view or in a submenu
  const currentSubmenuActions = useMemo((): ActionItem[] => {
    switch (currentCategory) {
      case "quick-actions":
        return categorizedActions.quick;
      case "preferences":
        return categorizedActions.prefs;
      case "aesthetics":
        return categorizedActions.aesthetics;
      case "security":
        return categorizedActions.security;
      case "community":
        return categorizedActions.community;
      case "game-hub":
        return [
          {
            id: "game-fast-launch",
            title: "Launch in Fast Game Mode",
            subtitle: "Boosts process to HIGH_PRIORITY_CLASS and optimizes RAM",
            icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
            badge: "Game Boost",
            section: "GAMER OPTIONS",
            shortcut: "↵",
            run: () => {
              if (selectedItem?.path) {
                tauriInvoke("launch_game", { launchUri: selectedItem.path }).catch(() => {});
              }
              onClose();
            },
          },
          {
            id: "game-record-launch",
            title: "Launch with Windows Game Bar",
            subtitle: "Boots game and summons Xbox Game Bar recording (Win+G)",
            icon: <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />,
            badge: "Recording",
            section: "GAMER OPTIONS",
            shortcut: "Win G",
            run: () => {
              if (selectedItem?.path) {
                tauriInvoke("launch_game", { launchUri: selectedItem.path }).catch(() => {});
                tauriInvoke("execute_system_command", { command: "start ms-gamebar:" }).catch(() => {});
              }
              onClose();
            },
          },
          {
            id: "game-open-folder",
            title: "Open Game Installation Folder",
            subtitle: "Reveal game executable directory in File Explorer",
            icon: <ExternalLink className="w-3.5 h-3.5 text-sky-400" />,
            section: "GAMER OPTIONS",
            run: () => {
              if (selectedItem?.path) {
                tauriInvoke("open_parent_folder", { path: selectedItem.path }).catch(() => {});
              }
              onClose();
            },
          },
        ];
      default:
        return [];
    }
  }, [currentCategory, categorizedActions, selectedItem, onClose]);

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or Backspace to step back from a submenu
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (currentCategory !== "main") {
          setCurrentCategory("main");
          setSubSelectedIndex(0);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "Backspace" && currentCategory !== "main" && currentCategory !== "shortcuts") {
        e.preventDefault();
        e.stopPropagation();
        setCurrentCategory("main");
        setSubSelectedIndex(0);
        return;
      }

      // Arrow Down
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (currentCategory === "main") {
          setActionSelectedIndex((prev) => (prev < mainCategories.length - 1 ? prev + 1 : prev));
        } else if (currentCategory === "shortcuts") {
          // Handled inside shortcuts scroll
        } else {
          setSubSelectedIndex((prev) => (prev < currentSubmenuActions.length - 1 ? prev + 1 : prev));
        }
        return;
      }

      // Arrow Up
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (currentCategory === "main") {
          setActionSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (currentCategory === "shortcuts") {
          // Handled inside shortcuts scroll
        } else {
          setSubSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        return;
      }

      // Enter
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (currentCategory === "main") {
          const selected = mainCategories[actionSelectedIndex];
          if (selected) {
            setCurrentCategory(selected.id);
            setSubSelectedIndex(0);
          }
        } else if (currentCategory === "shortcuts") {
          // No action on shortcuts
        } else {
          const act = currentSubmenuActions[subSelectedIndex];
          if (act) act.run();
        }
        return;
      }

      // Ctrl + K to toggle close
      if ((e.key?.toLowerCase() === "k" || e.code === "KeyK") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    isOpen,
    onClose,
    currentCategory,
    mainCategories,
    actionSelectedIndex,
    setActionSelectedIndex,
    currentSubmenuActions,
    subSelectedIndex,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-end p-3 z-50 animate-in fade-in duration-100 select-none"
      onClick={onClose}
    >
      <div
        className="w-[400px] max-h-[480px] border border-white/[0.08] bg-[#0c0c0e] rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-3 flex flex-col space-y-2.5 animate-in zoom-in-95 duration-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Breadcrumbs & Navigation */}
        <div className="px-2 py-1 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {currentCategory !== "main" ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentCategory("main");
                  setSubSelectedIndex(0);
                }}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition cursor-pointer group"
                title="Back to Main Menu (Esc or Backspace)"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Menu</span>
              </button>
            ) : (
              <span className="text-[12px] font-semibold text-white truncate block">
                {currentMode === "all"
                  ? selectedItem?.title ? `Menu · ${selectedItem.title}` : "AltSpace Menu"
                  : currentMode === "ports"
                  ? `Port :${selectedPort?.port}`
                  : "Clipboard Actions"}
              </span>
            )}

            {currentCategory !== "main" && (
              <>
                <span className="text-zinc-600 text-xs">/</span>
                <span className="text-xs font-semibold text-white capitalize">
                  {currentCategory.replace("-", " ")}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-zinc-500 hover:text-white transition cursor-pointer"
            title="Dismiss Menu (Esc)"
          >
            <kbd className="kbd-cap hover:border-zinc-500">Esc</kbd>
          </button>
        </div>

        {/* Level 0: Main Hierarchical Menu */}
        {currentCategory === "main" && (
          <div className="overflow-y-auto space-y-1 px-1 py-1 max-h-[380px] custom-scrollbar">
            {mainCategories.map((cat, idx) => {
              const isSelected = idx === actionSelectedIndex;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCurrentCategory(cat.id);
                    setSubSelectedIndex(0);
                  }}
                  onMouseEnter={() => setActionSelectedIndex(idx)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer border",
                    isSelected
                      ? "bg-white/[0.08] text-white border-white/[0.12] shadow-sm"
                      : "text-zinc-400 border-transparent hover:bg-white/[0.04] hover:text-zinc-200"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="shrink-0 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      {cat.icon}
                    </span>
                    <div className="min-w-0">
                      <span className="font-semibold text-white block truncate">
                        {cat.title}
                      </span>
                      <span className="text-[10.5px] text-zinc-400 block truncate">
                        {cat.desc}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {cat.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                        {cat.badge}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Level 1: Submenu Action Items */}
        {currentCategory !== "main" && currentCategory !== "shortcuts" && (
          <div className="overflow-y-auto space-y-1 px-1 py-1 max-h-[380px] custom-scrollbar">
            {currentSubmenuActions.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No active actions available in this section.
              </div>
            ) : (
              currentSubmenuActions.map((action, idx) => {
                const isSelected = idx === subSelectedIndex;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => action.run()}
                    onMouseEnter={() => setSubSelectedIndex(idx)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer border",
                      isSelected
                        ? "bg-white/[0.08] text-white border-white/[0.12] shadow-sm"
                        : "text-zinc-400 border-transparent hover:bg-white/[0.04] hover:text-zinc-200"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="shrink-0 text-zinc-400">{action.icon}</span>
                      <div className="min-w-0">
                        <span className="font-medium text-white block truncate">
                          {action.title}
                        </span>
                        {action.subtitle && (
                          <span className="text-[10px] text-zinc-400 block truncate font-mono">
                            {action.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {action.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.05] border border-white/[0.08] text-zinc-300">
                          {action.badge}
                        </span>
                      )}
                      {action.shortcut && (
                        <kbd className="kbd-cap">{action.shortcut}</kbd>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Level 1: Dedicated File Noise Filters Submenu */}
        {currentCategory === "file-filters" && (
          <div className="flex flex-col space-y-2 overflow-hidden flex-1">
            {/* Master Toggle Banner */}
            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white">Search Noise Filter</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border",
                      filterConfig.filterEnabled
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}
                  >
                    {filterConfig.filterEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Automatically hide clutter (.ini, .log, .tmp, .ink, .dll) from file search results.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleMaster}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 shadow-sm",
                  filterConfig.filterEnabled
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                )}
              >
                {filterConfig.filterEnabled ? "Filter On" : "Filter Off"}
              </button>
            </div>

            {/* Notification alert pill */}
            {feedbackNotice && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{feedbackNotice}</span>
              </div>
            )}

            {/* Filter controls row */}
            <div className="flex items-center gap-2 shrink-0 px-0.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={extSearchText}
                  onChange={(e) => setExtSearchText(e.target.value)}
                  placeholder="Filter extensions (e.g. .ini, .log)..."
                  className="w-full pl-7 pr-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.2]"
                />
              </div>

              <button
                type="button"
                onClick={handleResetDefaults}
                title="Reset to recommended defaults"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.04] text-xs text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3 text-zinc-400" />
                <span>Reset</span>
              </button>
            </div>

            {/* Add Custom Extension Bar */}
            <div className="flex items-center gap-2 p-1.5 rounded-xl border border-white/[0.06] bg-black/20 shrink-0">
              <input
                type="text"
                value={customExtInput}
                onChange={(e) => setCustomExtInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomExt()}
                placeholder="Add custom extension (e.g. .bak2, .part)..."
                className="flex-1 px-2.5 py-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleAddCustomExt}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white transition cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>

            {/* Extensions List */}
            <div className="overflow-y-auto space-y-1.5 px-0.5 py-1 max-h-[260px] custom-scrollbar">
              {KNOWN_NOISE_EXTENSIONS.filter(
                (item) =>
                  !extSearchText ||
                  item.ext.toLowerCase().includes(extSearchText.toLowerCase()) ||
                  item.description.toLowerCase().includes(extSearchText.toLowerCase()) ||
                  item.category.toLowerCase().includes(extSearchText.toLowerCase())
              ).map((item) => {
                const isBlocked = filterConfig.blockedExtensions.includes(item.ext.toLowerCase());
                return (
                  <div
                    key={item.ext}
                    onClick={() => handleToggleExtension(item.ext, !isBlocked)}
                    className="p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] flex items-center justify-between text-xs transition cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <kbd className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-white/[0.06] border border-white/[0.1] text-amber-300 shrink-0">
                        {item.ext}
                      </kbd>
                      <div className="min-w-0">
                        <span className="text-zinc-200 block truncate font-medium">
                          {item.description}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExtension(item.ext, !isBlocked);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10.5px] font-semibold tracking-wider font-mono uppercase transition cursor-pointer shrink-0 border",
                        isBlocked
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25"
                          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                      )}
                    >
                      {isBlocked ? "Blocked" : "Allowed"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Level 1: Dedicated Keyboard Shortcuts Manager Submenu */}
        {currentCategory === "shortcuts" && (
          <div className="flex flex-col space-y-2 overflow-hidden flex-1">
            {/* Search filter for shortcuts */}
            <div className="relative shrink-0 px-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={shortcutFilter}
                onChange={(e) => setShortcutFilter(e.target.value)}
                placeholder="Search shortcuts (e.g. port, preview, fix)..."
                className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.2]"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto space-y-1.5 px-1 py-1 max-h-[320px] custom-scrollbar">
              {DEFAULT_SHORTCUTS.filter(
                (s) =>
                  !shortcutFilter ||
                  s.label.toLowerCase().includes(shortcutFilter.toLowerCase()) ||
                  s.description.toLowerCase().includes(shortcutFilter.toLowerCase()) ||
                  s.keys.some((k) => k.toLowerCase().includes(shortcutFilter.toLowerCase()))
              ).map((sc) => (
                <div
                  key={sc.id}
                  className="px-2.5 py-1.5 rounded-xl border border-white/[0.04] bg-white/[0.02] flex items-center justify-between text-xs hover:border-white/[0.1] transition"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-medium text-zinc-200 block truncate">
                      {sc.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 block truncate">
                      {sc.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {sc.keys.map((k) => (
                      <kbd key={k} className="kbd-cap font-mono text-[10.5px]">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Submenu Hint */}
        <div className="px-2 pt-1 border-t border-white/[0.06] flex items-center justify-between text-[10.5px] text-zinc-500 shrink-0">
          <span>
            {currentCategory === "main" ? "↑↓ Navigate · ↵ Select Submenu" : "↑↓ Navigate · ↵ Run · ⎋ Back"}
          </span>
          <span className="font-mono text-zinc-600">AltSpace v2.4</span>
        </div>
      </div>
    </div>
  );
}
