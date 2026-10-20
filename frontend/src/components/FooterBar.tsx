import { PanelRightClose, PanelRightOpen } from "lucide-react";
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
  };
  onCycleTheme: () => void;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onOpenActions: () => void;
  onOpenFeedback?: () => void;
  onOpenLicense?: () => void;
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
}: FooterBarProps) {
  return (
    <footer
      role="contentinfo"
      aria-label="Application status and shortcut keys"
      className="h-9 px-4 bg-[#111114] border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 font-medium shrink-0 select-none"
    >
      {/* Left: Product title, dynamic count, and active theme badge */}
      <div className="flex items-center gap-2 text-[11.5px] text-zinc-400">
        <span className="font-semibold text-zinc-200 tracking-tight">AltSpace</span>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-400 font-mono text-[11px]">
          {currentMode === "all"
            ? `${itemsCount} ${itemsCount === 1 ? "result" : "results"}`
            : currentMode === "clipboard"
            ? `${clipsCount} clips`
            : currentMode === "ports"
            ? `${portsCount} ports`
            : "Extensions"}
        </span>
        <span className="text-zinc-600">/</span>
        <button
          onClick={onCycleTheme}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Cycle Theme (Ctrl+Shift+T)"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: activeTheme.accentHex }}
          />
          <span className="text-[10.5px] font-sans">{activeTheme.name}</span>
        </button>
      </div>

      {/* Right: Focused contextual keyboard actions */}
      <div className="flex items-center gap-3 text-[11px] whitespace-nowrap shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">Open</span>
          <kbd className="kbd-cap">↵</kbd>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">Preview</span>
          <kbd className="kbd-cap">Space</kbd>
        </div>

        <button
          onClick={onOpenActions}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Contextual Actions (Ctrl+K)"
        >
          <span>Actions</span>
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
          <span>Details</span>
          <kbd className="kbd-cap">Ctrl B</kbd>
        </button>
      </div>
    </footer>
  );
}
