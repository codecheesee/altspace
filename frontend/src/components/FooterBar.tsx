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
  onCycleTheme?: () => void;
  isSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
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
  onOpenActions,
  onOpenWebsite,
}: FooterBarProps) {
  const resultLabel =
    currentMode === "all"
      ? `${itemsCount} ${itemsCount === 1 ? "result" : "results"}`
      : currentMode === "clipboard"
      ? `${clipsCount} clips`
      : currentMode === "ports"
      ? `${portsCount} ports`
      : "Extensions";

  return (
    <footer
      role="contentinfo"
      aria-label="Application status bar"
      className="h-8 px-3 sm:px-4 bg-[#111115]/90 border-t flex items-center justify-between gap-3 text-xs text-zinc-400 font-medium shrink-0 select-none overflow-hidden"
      style={{
        backgroundColor: activeTheme.headerBg,
        borderColor: activeTheme.borderColor,
      }}
    >
      {/* Left: Product title & dynamic count (no theme selector) */}
      <div className="flex items-center gap-2 text-[11.5px] text-zinc-400 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onOpenWebsite}
          title="Visit AltSpace Website"
          className="flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-white tracking-tight cursor-pointer transition group"
        >
          <img
            src="/app-icon.png"
            alt="AltSpace"
            className="w-3.5 h-3.5 rounded group-hover:scale-110 transition shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/favicon.svg";
            }}
          />
          <span className="truncate">AltSpace</span>
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-400 font-mono text-[11px] truncate">
          {resultLabel}
        </span>
      </div>

      {/* Right: Minimalist, clean 2026 status line (no cluttered shortcut soup) */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-400 whitespace-nowrap shrink-0">
        <div className="hidden sm:flex items-center gap-1.5">
          <span>Open</span>
          <kbd className="kbd-cap">↵</kbd>
        </div>

        <span className="text-zinc-700 hidden sm:inline">•</span>

        <button
          type="button"
          onClick={onOpenActions}
          className="flex items-center gap-1.5 hover:text-zinc-200 transition cursor-pointer"
          title="Open Menu & Shortcuts (Ctrl+K)"
        >
          <span>Menu</span>
          <kbd className="kbd-cap">Ctrl K</kbd>
        </button>

        <span className="text-zinc-700 hidden md:inline">•</span>

        <div className="hidden md:flex items-center gap-1 text-zinc-500">
          <span>Dismiss</span>
          <kbd className="kbd-cap">Esc</kbd>
        </div>
      </div>
    </footer>
  );
}
