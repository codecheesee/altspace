import { PanelRightClose, PanelRightOpen, History, Activity } from "lucide-react";
import { cn } from "../lib/utils";
import type { Mode } from "../types";

interface FooterBarProps {
  currentMode: Mode;
  itemsCount: number;
  clipsCount: number;
  portsCount: number;
  activeTheme: {
    accentHex: string;
    name: string;
    headerBg: string;
    borderColor: string;
  };
  onCycleTheme: () => void;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onOpenActions: () => void;
  onOpenFeedback?: () => void;
  onOpenLicense?: () => void;
  onOpenTimeline?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenWebsite?: () => void;
}

export function FooterBar({
  currentMode,
  itemsCount,
  clipsCount,
  portsCount,
  activeTheme,
  onCycleTheme,
  isSidebarVisible,
  onToggleSidebar,
  onOpenActions,
  onOpenTimeline,
  onOpenDiagnostics,
  onOpenWebsite,
}: FooterBarProps) {
  return (
    <footer
      role="contentinfo"
      aria-label="Application status and shortcut keys"
      className="min-h-9 px-3 sm:px-4 py-1.5 bg-black/20 border-t flex items-center justify-between gap-2 text-xs text-zinc-400 font-medium shrink-0 select-none"
      style={{ backgroundColor: activeTheme.headerBg, borderColor: activeTheme.borderColor }}
    >
      {/* Left: Product title, dynamic count, and active theme badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-[11.5px] text-zinc-400 min-w-0">
        <button
          type="button"
          onClick={onOpenWebsite}
          title="Visit AltSpace Website"
          className="flex items-center gap-1.5 font-semibold text-zinc-200 hover:text-white tracking-tight cursor-pointer transition group"
        >
          <img
            src="/app-icon.png"
            alt="AltSpace"
            className="w-3.5 h-3.5 rounded group-hover:scale-110 transition"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/favicon.svg";
            }}
          />
          <span>AltSpace</span>
        </button>
        <span className="text-zinc-600 hidden sm:inline">/</span>
        <span className="text-zinc-400 font-mono text-[11px] truncate max-w-[9rem] sm:max-w-none">
          {currentMode === "all"
            ? `${itemsCount} ${itemsCount === 1 ? "result" : "results"}`
            : currentMode === "clipboard"
            ? `${clipsCount} clips`
            : currentMode === "ports"
            ? `${portsCount} ports`
            : "Extensions"}
        </span>
        <span className="text-zinc-600 hidden sm:inline">/</span>
        <button
          onClick={onCycleTheme}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Cycle Theme (Ctrl+Shift+T)"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: activeTheme.accentHex }}
          />
          <span className="text-[10.5px] font-sans hidden md:inline">{activeTheme.name}</span>
        </button>
      </div>

      {/* Right: Focused contextual keyboard actions */}
      <div className="flex items-center gap-1 sm:gap-3 text-[11px] whitespace-nowrap shrink-0">
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-zinc-400">Open</span>
          <kbd className="kbd-cap">↵</kbd>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-zinc-400">Preview</span>
          <kbd className="kbd-cap">Space</kbd>
        </div>

                {onOpenTimeline && (
          <button
            onClick={onOpenTimeline}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Execution Timeline (Alt+H)"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden lg:inline">Timeline</span>
          </button>
        )}

        {onOpenDiagnostics && (
          <button
            onClick={onOpenDiagnostics}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Privacy Diagnostics (Ctrl+Shift+D)"
            aria-label="Privacy Diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden xl:inline">Diagnostics</span>
          </button>
        )}

        <button
          onClick={onOpenActions}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Contextual Actions (Ctrl+K)"
        >
          <span className="hidden sm:inline">Actions</span>
          <kbd className="kbd-cap">Ctrl K</kbd>
        </button>

        <button
          onClick={onToggleSidebar}
          className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 rounded transition cursor-pointer text-xs",
            isSidebarVisible
              ? "bg-white/[0.08] text-zinc-200 border border-white/[0.12]"
              : "hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-transparent"
          )}
          title="Toggle Details Sidebar (Ctrl+B)"
          aria-label="Toggle Details Sidebar"
        >
          {isSidebarVisible ? (
            <PanelRightClose className="w-3.5 h-3.5 text-zinc-300" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span className="hidden sm:inline">Details</span>
          <kbd className="kbd-cap">Ctrl B</kbd>
        </button>
      </div>
    </footer>
  );
}
