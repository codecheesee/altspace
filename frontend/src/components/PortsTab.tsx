import { useState, useEffect } from "react";
import {
  Activity,
  Skull,
  ChevronRight,
  Flame,
  RefreshCw,
  FolderGit2,
  Terminal,
  ShieldAlert,
  Copy,
  Check,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ErrorBoundary } from "./ErrorBoundary";
import { isFeatureEnabled } from "../lib/featureMatrix";
import type { PortItem, PortProcessForensics } from "../types";

interface PortsTabProps {
  filteredPorts: PortItem[];
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  selectedPort: PortItem | null;
  isSidebarVisible: boolean;
  onKillPort: (pid: number, port: number) => void;
  onRefreshPorts: () => void;
  fetchForensics?: (port: number, pid: number) => Promise<PortProcessForensics | null>;
}

export function PortsTab({
  filteredPorts,
  selectedIndex,
  setSelectedIndex,
  selectedPort,
  isSidebarVisible,
  onKillPort,
  onRefreshPorts,
  fetchForensics,
}: PortsTabProps) {
  const [forensics, setForensics] = useState<PortProcessForensics | null>(null);
  const [isLoadingForensics, setIsLoadingForensics] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const advancedEnabled = isFeatureEnabled("ports_advanced");

  useEffect(() => {
    if (!selectedPort || !fetchForensics || !advancedEnabled) {
      setForensics(null);
      return;
    }

    let active = true;
    setIsLoadingForensics(true);

    fetchForensics(selectedPort.port, selectedPort.pid)
      .then((data) => {
        if (active) {
          setForensics(data);
          setIsLoadingForensics(false);
        }
      })
      .catch(() => {
        if (active) {
          setForensics(null);
          setIsLoadingForensics(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedPort?.port, selectedPort?.pid, fetchForensics, advancedEnabled]);

  const handleCopyCmd = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleKillWithVerify = async (pid: number, port: number) => {
    setIsVerifying(true);
    try {
      await onKillPort(pid, port);
    } finally {
      setTimeout(() => setIsVerifying(false), 800);
    }
  };

  return (
    <ErrorBoundary label="Ports Panel">
      {/* Left Pane: Listening Ports List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 select-none">
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
                onDoubleClick={() => handleKillWithVerify(p.pid, p.port)}
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
                    <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                      <span>PID {p.pid}</span>
                      <span>•</span>
                      <span>{p.state}</span>
                      {advancedEnabled && forensics && forensics.port === p.port && forensics.project_hint && (
                        <>
                          <span>•</span>
                          <span className="text-purple-300 flex items-center gap-1">
                            <FolderGit2 className="w-3 h-3" />
                            {forensics.project_hint}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleKillWithVerify(p.pid, p.port);
                    }}
                    className="px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Skull className="w-3 h-3" />
                    Free
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

      {/* Right Pane: Minimalist Forensic Inspector & Recovery Cockpit */}
      {isSidebarVisible && selectedPort && (
        <div className="w-[320px] border-l border-white/[0.06] bg-black/25 p-4 flex flex-col justify-between overflow-y-auto select-none">
          <div className="space-y-3.5">
            {/* Header: Port Banner */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
              <div className="text-3xl font-mono font-black text-emerald-400 tracking-wider flex items-center gap-1">
                :{selectedPort.port}
              </div>
              <span className="text-[11px] text-emerald-300 font-medium mt-0.5 flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                TCP LISTENING
              </span>
            </div>

            {/* Forensic Metadata (if advanced mode enabled) */}
            {advancedEnabled && (
              <div className="space-y-2 text-xs">
                {/* Process Tree & Ancestry */}
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-1.5">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-purple-400" />
                      <span>Process Ancestry Tree</span>
                    </span>
                    {isLoadingForensics && (
                      <span className="text-[9px] text-zinc-500 font-mono animate-pulse">Inspecting...</span>
                    )}
                  </div>

                  {forensics?.parent_name ? (
                    <div className="text-[11px] font-mono text-zinc-200 flex items-center gap-1.5 truncate">
                      <span className="text-zinc-500">{forensics.parent_name} (PID {forensics.parent_pid})</span>
                      <span className="text-zinc-600">➔</span>
                      <span className="font-semibold text-white">{selectedPort.process_name}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-zinc-400">
                      {selectedPort.process_name} (PID {selectedPort.pid})
                    </div>
                  )}

                  {forensics?.project_hint && (
                    <div className="flex items-center gap-1 text-[11px] text-purple-300 pt-0.5">
                      <FolderGit2 className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="font-mono truncate">Project: {forensics.project_hint}</span>
                    </div>
                  )}
                </div>

                {/* Command Line Preview (if available) */}
                {forensics?.command_line && (
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-sky-400" />
                        <span>Command Line</span>
                      </span>
                      <button
                        onClick={() => handleCopyCmd(forensics.command_line || "")}
                        className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-white transition cursor-pointer"
                        title="Copy command line"
                      >
                        {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="text-[10.5px] font-mono text-zinc-300 bg-black/40 p-2 rounded border border-white/[0.04] max-h-16 overflow-y-auto break-all leading-tight">
                      {forensics.command_line}
                    </div>
                  </div>
                )}

                {/* Protected Warning if applicable */}
                {forensics?.is_protected && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10.5px] text-amber-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Protected Windows Service. Termination blocked for stability.</span>
                  </div>
                )}
              </div>
            )}

            {/* Standard Metrics fallback */}
            {!advancedEnabled && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-500 font-medium">Process</span>
                  <span className="text-white font-mono font-semibold">{selectedPort.process_name}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-500 font-medium">PID</span>
                  <span className="text-neutral-200 font-mono">{selectedPort.pid}</span>
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10.5px] text-neutral-400 leading-normal flex items-start gap-2">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Taskkill tree mode (/F /T) ensures all child workers and background threads are cleanly released.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => handleKillWithVerify(selectedPort.pid, selectedPort.port)}
              disabled={isVerifying || Boolean(forensics?.is_protected)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer",
                isVerifying
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : forensics?.is_protected
                  ? "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 cursor-not-allowed"
                  : "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30"
              )}
            >
              {isVerifying ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Verifying Port Free...</span>
                </>
              ) : (
                <>
                  <Skull className="w-3.5 h-3.5" />
                  <span>Free & Verify Port :{selectedPort.port}</span>
                </>
              )}
            </button>

            <button
              onClick={onRefreshPorts}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs font-medium text-neutral-200 border border-white/[0.06] transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Refresh Ports</span>
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
