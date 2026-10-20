import { PanelRightClose, PanelRightOpen, Heart, Award } from "lucide-react";
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
  onOpenFeedback,
  onOpenLicense,
}: FooterBarProps) {
  return (
    <div className="h-9 px-4 bg-black/30 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 font-medium shrink-0 select-none">
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <span className="font-semibold text-zinc-200">AltSpace</span>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-400">
          {currentMode === "all"
            ? `${itemsCount} items`
            : currentMode === "clipboard"
            ? `${clipsCount} clips`
            : currentMode === "ports"
            ? `${portsCount} ports`
            : "Extensions"}
        </span>
        <span className="text-zinc-600">/</span>
        <button
          onClick={onCycleTheme}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/[0.06] text-zinc-300 hover:text-white transition cursor-pointer border border-transparent hover:border-white/[0.08]"
          title="Cycle Theme (Ctrl+Shift+T or :theme)"
        >
          <span
            className="w-2 h-2 rounded-full shadow-sm"
            style={{ backgroundColor: activeTheme.accentHex }}
          />
          <span className="font-mono text-[10.5px]">{activeTheme.name}</span>
        </button>

        {onOpenLicense && (
          <>
            <span className="text-zinc-600">/</span>
            <button
              onClick={onOpenLicense}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-amber-400/10 text-zinc-300 hover:text-amber-300 transition cursor-pointer border border-transparent hover:border-amber-400/20"
              title="Supporter License & Community Treasury"
            >
              <Award className="w-3 h-3 text-amber-400" />
              <span className="text-[10.5px] font-medium text-amber-300/90">Supporter</span>
            </button>
          </>
        )}

        {onOpenFeedback && (
          <>
            <span className="text-zinc-600">/</span>
            <button
              onClick={onOpenFeedback}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/[0.06] text-zinc-300 hover:text-rose-300 transition cursor-pointer border border-transparent hover:border-white/[0.08]"
              title="Send Feedback & Bug Reports"
            >
              <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
              <span className="text-[10.5px]">Feedback</span>
            </button>
          </>
        )}
      </div>

      {/* 21st.dev Tactile Physical Keyboard Badges */}
      <div className="flex items-center gap-3 text-[11px] whitespace-nowrap shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-zinc-400">Open</span>
          <kbd className="kbd-cap">↵</kbd>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-zinc-400">Preview</span>
          <kbd className="kbd-cap">Space</kbd>
        </div>

        <button
          onClick={onToggleSidebar}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded transition shrink-0 cursor-pointer text-xs",
            isSidebarVisible
              ? "bg-white/[0.08] text-white border border-white/[0.12]"
              : "hover:bg-white/[0.06] text-zinc-400 hover:text-white border border-transparent"
          )}
          title="Toggle Details Sidebar (Ctrl+B)"
        >
          {isSidebarVisible ? (
            <PanelRightClose className="w-3.5 h-3.5 text-zinc-300" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span>Details</span>
          <kbd className="kbd-cap">Ctrl B</kbd>
        </button>

        <button
          onClick={onOpenActions}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/[0.06] text-zinc-300 hover:text-white transition shrink-0 cursor-pointer border border-transparent hover:border-white/[0.08]"
        >
          <span>Actions</span>
          <kbd className="kbd-cap">Ctrl K</kbd>
        </button>
      </div>
    </div>
  );
}
