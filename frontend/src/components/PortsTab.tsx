import { Activity, Skull, ChevronRight, Flame, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import { ErrorBoundary } from "./ErrorBoundary";
import type { PortItem } from "../types";

interface PortsTabProps {
  filteredPorts: PortItem[];
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  selectedPort: PortItem | null;
  isSidebarVisible: boolean;
  onKillPort: (pid: number, port: number) => void;
  onRefreshPorts: () => void;
}

export function PortsTab({
  filteredPorts,
  selectedIndex,
  setSelectedIndex,
  selectedPort,
  isSidebarVisible,
  onKillPort,
  onRefreshPorts,
}: PortsTabProps) {
  return (
    <ErrorBoundary label="Ports Panel">
      {/* Left Pane: Listening Ports List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredPorts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
            <Activity className="w-8 h-8 text-neutral-600 stroke-[1.5]" />
            <p className="text-sm font-medium text-neutral-400">No active ports found matching filter</p>
            <p className="text-xs text-neutral-600">Type a port number like :3000 or :8080</p>
          </div>
        ) : (
          filteredPorts.map((p: PortItem, index: number) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={`${p.port}-${p.pid}`}
                onClick={() => setSelectedIndex(index)}
                onDoubleClick={() => onKillPort(p.pid, p.port)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                  isSelected
                    ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                    : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-16 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                    :{p.port}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-[13.5px] truncate tracking-tight text-white flex items-center gap-2">
                      {p.process_name}
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      PID {p.pid} • {p.state}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKillPort(p.pid, p.port);
                    }}
                    className="px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Skull className="w-3 h-3" />
                    Kill
                  </button>
                  <ChevronRight
                    className={cn(
                      "w-3.5 h-3.5 transition",
                      isSelected ? "text-neutral-400 translate-x-0.5" : "text-transparent"
                    )}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right Pane: Port Inspector */}
      {isSidebarVisible && selectedPort && (
        <div className="w-[300px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
              <div className="text-3xl font-mono font-black text-emerald-400 tracking-wider flex items-center gap-1">
                :{selectedPort.port}
              </div>
              <span className="text-[11px] text-emerald-300 font-medium mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                TCP LISTENING
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-neutral-500 font-medium">Process Name</span>
                <span className="text-white font-mono font-semibold">{selectedPort.process_name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-neutral-500 font-medium">Process ID (PID)</span>
                <span className="text-neutral-200 font-mono">{selectedPort.pid}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-neutral-500 font-medium">Protocol</span>
                <span className="text-neutral-300 font-mono">IPv4 / IPv6 TCP</span>
              </div>
              <div className="py-1">
                <span className="text-neutral-500 font-medium block mb-1">Status</span>
                <div className="text-[11px] text-emerald-400 font-mono bg-white/[0.03] p-2 rounded-lg border border-white/[0.04] leading-relaxed">
                  Bound to :{selectedPort.port}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10.5px] text-neutral-400 leading-normal flex items-start gap-2">
              <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Terminating uses Windows Taskkill tree mode (/F /T) to instantly unblock orphaned dev servers.
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => onKillPort(selectedPort.pid, selectedPort.port)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs font-bold text-red-400 border border-red-500/30 transition shadow-sm"
            >
              <Skull className="w-4 h-4" />
              Kill Process (Free Port :{selectedPort.port})
            </button>
            <button
              onClick={onRefreshPorts}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-neutral-200 border border-white/[0.06] transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
              Refresh Active Ports
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
