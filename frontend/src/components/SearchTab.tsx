import {
  Search,
  Folder,
  Zap,
  Terminal,
  ExternalLink,
  Copy,
  ChevronRight,
  FileCode,
  HardDrive,
  Clipboard as ClipboardIcon,
  Activity,
  Palette,
  Braces,
  RefreshCw,
  Calculator,
  Lock,
  Code,
  Package,
  Layers,
  Play,
  BookOpen,
  GitBranch,
  Eye,
  Settings,
  AlignLeft,
  LayoutGrid,
  Gamepad2,
  Globe,
} from "lucide-react";
import { cn } from "../lib/utils";
import { PRESET_THEMES } from "../lib/theme";
import { tauriInvoke, UTILITY_ITEMS } from "../lib/appStorage";
import { renderHighlightedText, formatDisplayPath, getItemSubtitle, getDriveOrigin } from "../lib/formatters";
import { MiniScreenBlueprint } from "./MiniScreenBlueprint";
import { ErrorBoundary } from "./ErrorBoundary";
import type { Item, SpecialCard, GitInfo, ShellResult } from "../types";

interface SearchTabProps {
  query: string;
  setQuery: (q: string) => void;
  specialCard: SpecialCard | null;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  selectedSpecial: SpecialCard | null;
  selectedItem: Item | null;
  items: Item[];
  frequentApps: Item[];
  recentWorkspaces: Item[];
  isSidebarVisible: boolean;
  terminalRunning: boolean;
  terminalResult: ShellResult | null;
  gitInfo: GitInfo | null;
  currentThemeId: string;
  onCopyClipboard: (content: string) => void;
  onCopiedNotification: (msg: string) => void;
  onItemAction: (item: Item) => void;
  onExecuteTerminalCommand: (cmd: string) => void;
  onLaunchTerminalWindow: (cmd: string) => void;
  onOpenUrl: (url: string) => void;
  onOpenFolder: (path: string) => void;
  onLaunchGame: (uri: string) => void;
  onSelectTheme: (themeId: string) => void;
  onSnapWindow: (snapPosition: string) => void;
  onOpenQuickLook: () => void;
}

export function SearchTab({
  query,
  setQuery,
  specialCard,
  selectedIndex,
  setSelectedIndex,
  selectedSpecial,
  selectedItem,
  items,
  frequentApps,
  recentWorkspaces,
  isSidebarVisible,
  terminalRunning,
  terminalResult,
  gitInfo,
  currentThemeId,
  onCopyClipboard,
  onCopiedNotification,
  onItemAction,
  onExecuteTerminalCommand,
  onLaunchTerminalWindow,
  onOpenUrl,
  onOpenFolder,
  onLaunchGame,
  onSelectTheme,
  onSnapWindow,
  onOpenQuickLook,
}: SearchTabProps) {
  return (
    <ErrorBoundary label="Search Panel">
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
                onCopyClipboard(specialCard.data.result);
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
                {specialCard.data.type}
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
              onOpenUrl(specialCard.data.url);
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
              onCopyClipboard(specialCard.data.resolvedContent);
              onCopiedNotification(`Snippet copied & ready!`);
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
            onDoubleClick={() => onExecuteTerminalCommand(specialCard.data.command)}
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
            {/* Section 1: Suggested Applications */}
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
                      onDoubleClick={() => onItemAction(item)}
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
                      onDoubleClick={() => onItemAction(item)}
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
                      onDoubleClick={() => onItemAction(item)}
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
                    onDoubleClick={() => onItemAction(item)}
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
                      onCopyClipboard(selectedSpecial.data.result);
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
                    onOpenUrl(selectedSpecial.data.url);
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
                    onCopiedNotification("Copied URL to clipboard!");
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
                    onCopyClipboard(selectedSpecial.data.resolvedContent);
                    onCopiedNotification(`Snippet copied & ready!`);
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
                          onCopiedNotification("Output copied to clipboard!");
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
                  onClick={() => onExecuteTerminalCommand(selectedSpecial.data.command)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-bold text-emerald-300 border border-emerald-500/35 transition shadow-sm disabled:opacity-50"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  {terminalRunning ? "Running..." : "Run Command (↵)"}
                </button>
                <button
                  onClick={() => onLaunchTerminalWindow(selectedSpecial.data.command)}
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
                      onClick={() => onOpenFolder(selectedItem.path)}
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
                  onClick={() => onLaunchGame(selectedItem.path)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600/25 hover:bg-violet-600/35 text-xs font-bold text-violet-300 border border-violet-500/35 transition shadow-sm cursor-pointer"
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Play Game (↵)</span>
                </button>
              ) : selectedItem.category === "Theme" ? (
                <button
                  onClick={() => {
                    const themeId = selectedItem.path.replace("theme://", "");
                    onSelectTheme(themeId);
                    setQuery("");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 text-xs font-bold text-purple-300 border border-purple-500/35 transition shadow-sm cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Apply Theme (↵)</span>
                </button>
              ) : selectedItem.category === "Window Management" ? (
                <button
                  onClick={() => onSnapWindow(selectedItem.path)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-xs font-semibold text-blue-300 border border-blue-500/30 transition shadow-sm cursor-pointer"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Snap Active Window (↵)</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={onOpenQuickLook}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-xs font-semibold text-neutral-200 border border-white/[0.08] transition shadow-sm cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>QuickLook (Space)</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedItem.path);
                      onCopiedNotification("Copied path to clipboard!");
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
        ) : null
      )}
    </ErrorBoundary>
  );
}
