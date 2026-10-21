import { useEffect } from "react";
import { cn } from "../lib/utils";
import { tauriInvoke } from "../lib/appStorage";
import type { Mode, Item, PortItem, ActionItem } from "../types";

interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: {
    cardBg: string;
    borderColor: string;
  };
  currentMode: Mode;
  selectedItem: Item | null;
  selectedPort: PortItem | null;
  actions: ActionItem[];
  actionSelectedIndex: number;
  setActionSelectedIndex: (idx: number | ((prev: number) => number)) => void;
}

export function ActionDrawer({
  isOpen,
  onClose,
  currentMode,
  selectedItem,
  selectedPort,
  actions,
  actionSelectedIndex,
  setActionSelectedIndex,
}: ActionDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    if (tauriInvoke) {
      tauriInvoke("focus_window").catch(() => {});
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActionSelectedIndex((prev: number) => (prev < actions.length - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActionSelectedIndex((prev: number) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        actions[actionSelectedIndex]?.run();
        return;
      }
      if ((e.key?.toLowerCase() === "k" || e.code === "KeyK") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose, actions, actionSelectedIndex, setActionSelectedIndex]);

  if (!isOpen) return null;

  const sections = Array.from(new Set(actions.map((a) => a.section)));
  let runningIndex = 0;

  return (
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-end p-3 z-50 animate-in fade-in duration-100 select-none"
      onClick={onClose}
    >
      <div
        className="w-[360px] max-h-[440px] border border-white/[0.08] bg-[#0c0c0e] rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-2.5 flex flex-col space-y-2 animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Item Title & Esc hint */}
        <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <span className="text-[12px] font-semibold text-white truncate block">
              Actions for{" "}
              {currentMode === "all"
                ? selectedItem?.title || "Search"
                : currentMode === "ports"
                ? `Port :${selectedPort?.port}`
                : "Clipboard"}
            </span>
            <span className="text-[10px] text-zinc-400 truncate block font-mono">
              {currentMode === "all"
                ? selectedItem?.category || "Query"
                : currentMode === "ports"
                ? `PID ${selectedPort?.pid}`
                : "Selected Clip"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Close menu (Esc)"
          >
            <kbd className="kbd-cap hover:border-zinc-500">Esc</kbd>
          </button>
        </div>

        {/* Scrollable Actions List */}
        <div className="overflow-y-auto space-y-2.5 px-1 py-1 max-h-[350px]">
          {sections.map((sec) => {
            const sectionActions = actions.filter((a) => a.section === sec);

            return (
              <div key={sec} className="space-y-1">
                <div className="px-2 text-[9.5px] uppercase font-bold tracking-wider text-zinc-500">
                  {sec}
                </div>
                <div className="space-y-0.5">
                  {sectionActions.map((action) => {
                    const currentGlobalIdx = runningIndex++;
                    const isSelected = currentGlobalIdx === actionSelectedIndex;

                    return (
                      <div
                        key={action.id}
                        onClick={() => {
                          action.run();
                        }}
                        onMouseEnter={() => setActionSelectedIndex(currentGlobalIdx)}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition duration-75 relative",
                          isSelected
                            ? "bg-white/[0.06] text-white font-medium border border-white/[0.08] shadow-sm before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2.5px] before:rounded-r before:bg-white"
                            : "text-zinc-300 hover:bg-white/[0.03] hover:text-white border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="shrink-0 text-zinc-400">{action.icon}</span>
                          <span className="truncate">{action.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {action.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300 font-mono border border-white/[0.05]">
                              {action.badge}
                            </span>
                          )}
                          {action.isToggle ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "text-[9px] font-bold tracking-wider font-mono uppercase px-1.5 py-0.5 rounded",
                                  action.toggleValue
                                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                                    : "text-zinc-500 bg-zinc-800/80 border border-zinc-700/60"
                                )}
                              >
                                {action.toggleValue ? "ON" : "OFF"}
                              </span>
                              <div
                                className={cn(
                                  "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
                                  action.toggleValue ? "bg-emerald-500" : "bg-zinc-700"
                                )}
                              >
                                <span
                                  className={cn(
                                    "inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm",
                                    action.toggleValue ? "translate-x-3.5" : "translate-x-0.5"
                                  )}
                                />
                              </div>
                            </div>
                          ) : action.shortcut ? (
                            <kbd className="kbd-cap">{action.shortcut}</kbd>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
