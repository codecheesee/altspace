import { cn } from "../lib/utils";
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
  setActionSelectedIndex: (idx: number) => void;
}

export function ActionDrawer({
  isOpen,
  onClose,
  activeTheme,
  currentMode,
  selectedItem,
  selectedPort,
  actions,
  actionSelectedIndex,
  setActionSelectedIndex,
}: ActionDrawerProps) {
  if (!isOpen) return null;

  const sections = Array.from(new Set(actions.map((a) => a.section)));
  let runningIndex = 0;

  return (
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-end justify-end p-3 z-50 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-[360px] max-h-[440px] border rounded-2xl shadow-2xl p-2.5 flex flex-col space-y-2 animate-in zoom-in-95 duration-100"
        style={{
          backgroundColor: activeTheme.cardBg,
          borderColor: activeTheme.borderColor,
        }}
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
            <span className="text-[10px] text-neutral-400 truncate block font-mono">
              {currentMode === "all"
                ? selectedItem?.category || "Query"
                : currentMode === "ports"
                ? `PID ${selectedPort?.pid}`
                : "Selected Clip"}
            </span>
          </div>
          <kbd className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded shrink-0">
            Esc
          </kbd>
        </div>

        {/* Scrollable Actions List */}
        <div className="overflow-y-auto space-y-2.5 px-1 py-1 max-h-[350px] custom-scrollbar">
          {sections.map((sec) => {
            const sectionActions = actions.filter((a) => a.section === sec);

            return (
              <div key={sec} className="space-y-1">
                <div className="px-2 text-[9.5px] uppercase font-bold tracking-wider text-neutral-500">
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
                          "flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition duration-75",
                          isSelected
                            ? "bg-white/[0.12] text-white font-medium border border-white/[0.14] shadow-sm"
                            : "text-neutral-300 hover:bg-white/[0.04] hover:text-white border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="shrink-0">{action.icon}</span>
                          <span className="truncate">{action.title}</span>
                        </div>
                        {action.shortcut && (
                          <kbd className="text-[10px] font-mono text-neutral-300 bg-white/[0.08] border border-white/[0.1] px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                            {action.shortcut}
                          </kbd>
                        )}
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
