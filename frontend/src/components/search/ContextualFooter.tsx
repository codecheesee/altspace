import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Mode, Item, SpecialCard } from "../../types";

interface ContextualFooterProps {
  currentMode: Mode;
  query: string;
  itemsCount: number;
  clipsCount: number;
  portsCount: number;
  selectedItem: Item | null;
  selectedSpecial: SpecialCard | null;
  isSidebarVisible: boolean;
  activeTheme: {
    accentHex: string;
    name: string;
  };
  onCycleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenActions: () => void;
}

export function ContextualFooter({
  currentMode,
  query,
  itemsCount,
  clipsCount,
  portsCount,
  selectedItem,
  selectedSpecial,
  isSidebarVisible,
  activeTheme,
  onCycleTheme,
  onToggleSidebar,
  onOpenActions,
}: ContextualFooterProps) {
  const hasSelection = Boolean(selectedItem || selectedSpecial);
  const canPreview = Boolean(
    selectedItem?.path ||
    selectedSpecial?.kind === "quickjump" ||
    selectedSpecial?.kind === "snippet" ||
    selectedSpecial?.kind === "terminal"
  );

  return (
    <footer
      role="contentinfo"
      aria-label="Status and keyboard shortcuts bar"
      className="h-9 px-4 bg-[#111114] border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 font-medium shrink-0 select-none"
    >
      {/* Left: Product title, dynamic count, and active theme badge */}
      <div className="flex items-center gap-2 text-[11.5px] text-zinc-400">
        <span className="font-semibold text-zinc-200">AltSpace</span>
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
          <span className="text-[10.5px]">{activeTheme.name}</span>
        </button>
      </div>

      {/* Right: Only currently available keyboard actions */}
      <div className="flex items-center gap-3 text-[11px] whitespace-nowrap shrink-0">
        {hasSelection && (
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Open</span>
            <kbd className="kbd-cap">↵</kbd>
          </div>
        )}

        {canPreview && (
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Preview</span>
            <kbd className="kbd-cap">Space</kbd>
          </div>
        )}

        <button
          onClick={onOpenActions}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Contextual Actions (Ctrl+K)"
        >
          <span>Actions</span>
          <kbd className="kbd-cap">Ctrl K</kbd>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">{query ? "Clear" : "Close"}</span>
          <kbd className="kbd-cap">Esc</kbd>
        </div>

        <div className="h-3.5 w-[1px] bg-white/[0.08] mx-0.5" />

        <button
          onClick={onToggleSidebar}
          className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title={isSidebarVisible ? "Hide Inspector Pane (Ctrl+B)" : "Show Inspector Pane (Ctrl+B)"}
          aria-label={isSidebarVisible ? "Hide Inspector Pane" : "Show Inspector Pane"}
        >
          {isSidebarVisible ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </footer>
  );
}
