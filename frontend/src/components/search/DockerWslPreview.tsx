import { useState, useEffect } from "react";
import {
  Container,
  Terminal,
  RotateCw,
  Square,
  Play,
  FileText,
  Copy,
  Check,
  Cpu,
  Power,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  getEnvironmentCockpit,
  dockerContainerAction,
  dockerContainerLogs,
  dockerOpenShell,
  dockerStartDaemon,
  wslShutdown,
  wslTerminateDistro,
  wslLaunchShell,
  type DockerContainer,
  type WslDistro,
  type EnvironmentCockpitData,
} from "../../lib/dockerWsl";

interface DockerWslPreviewProps {
  itemPath: string; // e.g. "docker://<id>", "wsl://<distro>", "wsl://shutdown", "docker://start-daemon"
  onCopiedNotification: (msg: string) => void;
}

export function DockerWslPreview({ itemPath, onCopiedNotification }: DockerWslPreviewProps) {
  const [data, setData] = useState<EnvironmentCockpitData | null>(null);
  const [logs, setLogs] = useState<string | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const isDockerItem = itemPath.startsWith("docker://");
  const isWslItem = itemPath.startsWith("wsl://");
  const entityId = itemPath.replace(/^(docker|wsl):\/\//, "");

  const refreshData = async () => {
    try {
      const snap = await getEnvironmentCockpit();
      setData(snap);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshData();
    setLogs(null);
    setActionFeedback(null);
  }, [itemPath]);

  // Find container or distro
  const container: DockerContainer | undefined = data?.docker.containers.find(
    (c) => c.id === entityId || c.names === entityId
  );
  const distro: WslDistro | undefined = data?.wsl.distros.find((d) => d.name === entityId);

  const handleContainerAction = async (action: "start" | "stop" | "restart") => {
    if (!container) return;
    setIsActing(true);
    setActionFeedback(`Running docker ${action}...`);
    try {
      const res = await dockerContainerAction(container.id, action);
      setActionFeedback(res.message);
      await refreshData();
    } catch (err: unknown) {
      setActionFeedback(String(err));
    } finally {
      setIsActing(false);
    }
  };

  const handleFetchLogs = async () => {
    if (!container) return;
    setIsLoadingLogs(true);
    try {
      const output = await dockerContainerLogs(container.id, 50);
      setLogs(output || "No logs output returned.");
    } catch (err: unknown) {
      setLogs(`Failed to fetch logs: ${String(err)}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleOpenShell = async () => {
    if (!container) return;
    setIsActing(true);
    try {
      const msg = await dockerOpenShell(container.id);
      onCopiedNotification(msg);
    } catch (err: unknown) {
      onCopiedNotification(String(err));
    } finally {
      setIsActing(false);
    }
  };

  const handleWslLaunchShell = async () => {
    if (!distro) return;
    setIsActing(true);
    try {
      const msg = await wslLaunchShell(distro.name);
      onCopiedNotification(msg);
    } catch (err: unknown) {
      onCopiedNotification(String(err));
    } finally {
      setIsActing(false);
    }
  };

  const handleWslTerminate = async () => {
    if (!distro) return;
    setIsActing(true);
    try {
      const res = await wslTerminateDistro(distro.name);
      setActionFeedback(res.message);
      await refreshData();
    } catch (err: unknown) {
      setActionFeedback(String(err));
    } finally {
      setIsActing(false);
    }
  };

  const handleWslShutdown = async () => {
    setIsActing(true);
    try {
      const res = await wslShutdown();
      setActionFeedback(res.message);
      onCopiedNotification("WSL VM shut down. RAM reclaimed!");
      await refreshData();
    } catch (err: unknown) {
      setActionFeedback(String(err));
    } finally {
      setIsActing(false);
    }
  };

  const handleStartDaemon = async () => {
    setIsActing(true);
    try {
      const msg = await dockerStartDaemon();
      onCopiedNotification(msg);
      setActionFeedback(msg);
    } catch (err: unknown) {
      setActionFeedback(String(err));
    } finally {
      setIsActing(false);
    }
  };

  const copyLogText = () => {
    if (!logs) return;
    navigator.clipboard.writeText(logs);
    setCopiedLogs(true);
    onCopiedNotification("Logs copied to clipboard");
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // 1. Docker Daemon Offline Card
  if (entityId === "start-daemon" || (!data?.docker.daemon_running && isDockerItem && !container)) {
    return (
      <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden select-none">
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-b from-amber-500/[0.08] to-transparent border border-amber-500/20">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Container className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white tracking-tight">Docker Desktop Offline</div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              The Docker engine daemon pipe is not running. Launch Docker Desktop to inspect and manage containers.
            </p>
          </div>

          {actionFeedback && (
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
              {actionFeedback}
            </div>
          )}
        </div>

        <button
          onClick={handleStartDaemon}
          disabled={isActing}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-white shadow-md shadow-sky-500/20 transition cursor-pointer disabled:opacity-50"
        >
          <Power className="w-3.5 h-3.5" />
          <span>Launch Docker Desktop (↵)</span>
        </button>
      </div>
    );
  }

  // 2. WSL Shutdown / Reclaim RAM Card
  if (entityId === "shutdown") {
    const ramMb = data?.wsl.vmmem_ram_mb;
    return (
      <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden select-none">
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-b from-emerald-500/[0.08] to-transparent border border-emerald-500/20">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white tracking-tight">WSL Virtual Memory</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {ramMb ? `${ramMb} MB Active` : "vmmem Active"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              WSL2 allocates dynamic memory that Windows retains. Shutting down the WSL VM frees memory immediately back to Windows.
            </p>
          </div>

          {actionFeedback && (
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
              {actionFeedback}
            </div>
          )}
        </div>

        <button
          onClick={handleWslShutdown}
          disabled={isActing}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
        >
          <Power className="w-3.5 h-3.5" />
          <span>Reclaim Memory (wsl --shutdown)</span>
        </button>
      </div>
    );
  }

  // 3. WSL Distro Inspection Card
  if (isWslItem && distro) {
    const isRunning = distro.state.toLowerCase() === "running";
    return (
      <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden select-none">
        <div className="space-y-3.5 overflow-y-auto">
          {/* Header Card */}
          <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-gradient-to-b from-sky-500/[0.08] to-transparent border border-sky-500/20 relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Terminal className="w-5 h-5" />
            </div>

            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>{distro.name}</span>
              {distro.is_default && (
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Default
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={cn(
                  "text-[10px] font-mono font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                  isRunning
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                  )}
                />
                {distro.state}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                WSL {distro.version}
              </span>
            </div>
          </div>

          {actionFeedback && (
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10.5px] font-mono text-zinc-300">
              {actionFeedback}
            </div>
          )}

          {/* Quick Info */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5 text-[11px]">
            <div className="text-zinc-400 flex justify-between">
              <span>Architecture</span>
              <span className="font-mono text-zinc-200">x86_64</span>
            </div>
            <div className="text-zinc-400 flex justify-between">
              <span>Hypervisor</span>
              <span className="font-mono text-zinc-200">Hyper-V Virtualized</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-3 border-t border-white/[0.08]">
          <button
            onClick={handleWslLaunchShell}
            disabled={isActing}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Launch Shell in Windows Terminal (↵)</span>
          </button>

          {isRunning && (
            <button
              onClick={handleWslTerminate}
              disabled={isActing}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition cursor-pointer disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Terminate Distro</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. Docker Container Inspection Card
  if (container) {
    const isRunning = container.state.toLowerCase() === "running";

    return (
      <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden select-none">
        <div className="space-y-3 overflow-y-auto pr-0.5">
          {/* Header Card */}
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-gradient-to-b from-sky-500/[0.08] to-transparent border border-sky-500/20 relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Container className="w-5 h-5" />
            </div>

            <div className="text-sm font-bold text-white tracking-tight break-all">
              {container.names || container.id}
            </div>

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
              <span
                className={cn(
                  "text-[9.5px] font-mono font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                  isRunning
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                  )}
                />
                {container.state.toUpperCase()}
              </span>

              {container.compose_project && (
                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {container.compose_project}
                </span>
              )}

              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                {container.id.slice(0, 10)}
              </span>
            </div>
          </div>

          {actionFeedback && (
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-zinc-300">
              {actionFeedback}
            </div>
          )}

          {/* Details Table */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5 text-[10.5px]">
            <div>
              <span className="text-zinc-500 block text-[9.5px] uppercase">Image</span>
              <span className="font-mono text-zinc-200 break-all">{container.image}</span>
            </div>
            {container.ports && (
              <div>
                <span className="text-zinc-500 block text-[9.5px] uppercase">Ports</span>
                <span className="font-mono text-sky-300 break-all">{container.ports}</span>
              </div>
            )}
            <div>
              <span className="text-zinc-500 block text-[9.5px] uppercase">Status</span>
              <span className="text-zinc-300">{container.status}</span>
            </div>
          </div>

          {/* Logs View (if expanded) */}
          {logs !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-mono">
                <span>Recent Logs (tail 50)</span>
                <button
                  onClick={copyLogText}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  {copiedLogs ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedLogs ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-2 rounded-lg bg-black/60 border border-white/[0.08] text-[9.5px] font-mono text-zinc-300 max-h-36 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
                {logs}
              </pre>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5 pt-3 border-t border-white/[0.08] shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleContainerAction("restart")}
              disabled={isActing}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 border border-white/[0.08] transition cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={cn("w-3 h-3 text-sky-400", isActing && "animate-spin")} />
              <span>Restart</span>
            </button>

            {isRunning ? (
              <button
                onClick={() => handleContainerAction("stop")}
                disabled={isActing}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition cursor-pointer disabled:opacity-50"
              >
                <Square className="w-3 h-3" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={() => handleContainerAction("start")}
                disabled={isActing}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>Start</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleOpenShell}
              disabled={isActing || !isRunning}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium border border-sky-500/30 transition cursor-pointer disabled:opacity-50"
            >
              <Terminal className="w-3 h-3" />
              <span>Open Shell</span>
            </button>

            <button
              onClick={handleFetchLogs}
              disabled={isLoadingLogs}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 border border-white/[0.08] transition cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3 h-3 text-purple-400" />
              <span>{isLoadingLogs ? "Loading..." : "View Logs"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-center items-center text-center text-zinc-500 text-xs">
      <Container className="w-8 h-8 text-zinc-600 mb-2" />
      <span>Select a container or distro to inspect details.</span>
    </div>
  );
}
