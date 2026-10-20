import { PanelRightClose, PanelRightOpen, Heart } from "lucide-react";
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
}: FooterBarProps) {
  return (
    <div className="h-9 px-4 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400 font-medium shrink-0">
      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
        <span className="font-semibold text-neutral-300">AltSpace</span>
        <span className="text-neutral-600">/</span>
        <span className="text-neutral-400">
          {currentMode === "all"
            ? `${itemsCount} items`
            : currentMode === "clipboard"
            ? `${clipsCount} clips`
            : `${portsCount} ports`}
        </span>
        <span className="text-neutral-600">/</span>
        <button
          onClick={onCycleTheme}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white/[0.08] text-neutral-300 hover:text-white transition cursor-pointer border border-transparent hover:border-white/[0.08]"
          title="Click to cycle theme (Ctrl+Shift+T or search :theme)"
        >
          <span
            className="w-2 h-2 rounded-full shadow-sm"
            style={{ backgroundColor: activeTheme.accentHex }}
          />
          <span className="font-mono text-[10.5px]">{activeTheme.name}</span>
        </button>

        {onOpenFeedback && (
          <>
            <span className="text-neutral-600">/</span>
            <button
              onClick={onOpenFeedback}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/[0.08] text-neutral-300 hover:text-rose-300 transition cursor-pointer border border-transparent hover:border-white/[0.08]"
              title="Rate AltSpace or Send Feedback"
            >
              <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
              <span className="text-[10.5px]">Feedback</span>
            </button>
          </>
        )}
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
          onClick={onToggleSidebar}
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
          onClick={onOpenActions}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white/[0.08] text-neutral-300 hover:text-white transition shrink-0 cursor-pointer"
        >
          <span>Actions</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.12] text-white border border-white/[0.16] text-[10px] font-mono shadow-sm font-semibold">
            Ctrl K
          </kbd>
        </button>
      </div>
    </div>
  );
}
