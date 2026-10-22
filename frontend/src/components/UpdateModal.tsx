import { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  X,
  ExternalLink,
  Download,
  RotateCw,
  Rocket,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { tauriInvoke } from "../lib/appStorage";
import type { UpdateInfo } from "../types";

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  notify: (msg: string) => void;
  initialInfo?: UpdateInfo | null;
}

const AUTO_CHECK_KEY = "altspace_auto_check_updates";

export function UpdateModal({
  isOpen,
  onClose,
  notify,
  initialInfo,
}: UpdateModalProps) {
  const [info, setInfo] = useState<UpdateInfo | null>(initialInfo || null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoCheck, setAutoCheck] = useState<boolean>(() => {
    return localStorage.getItem(AUTO_CHECK_KEY) !== "false";
  });
  const [showRawNotes, setShowRawNotes] = useState(false);

  const fetchUpdate = async () => {
    setIsChecking(true);
    setError(null);
    try {
      if (tauriInvoke) {
        const res = await tauriInvoke<UpdateInfo>("check_app_update");
        setInfo(res);
      } else {
        // Dev / Browser preview simulation
        setInfo({
          has_update: false,
          current_version: "2.2.0",
          latest_version: "2.2.0",
          release_name: "AltSpace 2.2.0 Security Hardening & Reliability Release",
          release_url: "https://github.com/codecheesee/altspace/releases",
          release_notes: "Latest developer release with DPAPI, Docker, WSL, and Action Planner.",
          features: [
            "Unified Capability Matrix with Option A Settings & Option C Omnibar hot-toggles",
            "Toolhelp32 process tree forensics and TCP table polling verification",
            "100% Offline Developer Transform Toolkit (JWT, JSON/YAML, Regex, UUID, Hash)",
            "Windows DPAPI Secret Vault & Environment Switcher",
          ],
          fixes: [
            "Invisibility rule eliminates zero-footprint disabled features",
            "Volatile crash dump ring buffer with zero disk writes",
          ],
        });
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (!initialInfo) {
        fetchUpdate();
      } else {
        setInfo(initialInfo);
      }
    }
  }, [isOpen, initialInfo]);

  const handleInstall = async () => {
    setIsInstalling(true);
    setInstallStatus("Connecting and downloading latest installer package...");
    try {
      if (tauriInvoke) {
        setInstallStatus("Downloading package and verifying cryptographic SHA-256 hash...");
        const res = await tauriInvoke<string>("trigger_app_update", {
          downloadUrl: info?.portable_url || info?.download_url || null,
          expectedSha256: info?.sha256_portable || null,
        });
        setInstallStatus(res || "Update verified. AltSpace is restarting now...");
        notify("✨ Update verified. AltSpace is restarting...");
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        window.open(info?.release_url || "https://github.com/codecheesee/altspace/releases", "_blank");
        setIsInstalling(false);
        setInstallStatus(null);
        onClose();
      }
    } catch (err: any) {
      setError(`Installation failed: ${err}`);
      setIsInstalling(false);
      setInstallStatus(null);
    }
  };

  const handleToggleAutoCheck = (enabled: boolean) => {
    setAutoCheck(enabled);
    localStorage.setItem(AUTO_CHECK_KEY, String(enabled));
    notify(enabled ? "Automatic update checks enabled" : "Automatic update checks paused");
  };

  const handleOpenReleasePage = () => {
    const url = info?.release_url || "https://github.com/codecheesee/altspace/releases";
    if (tauriInvoke) {
      tauriInvoke("open_url", { url }).catch(() => window.open(url, "_blank"));
    } else {
      window.open(url, "_blank");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-zinc-950/95 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-200 relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
      >
        {/* Glow ambient background accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="update-modal-title" className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                AltSpace Updates
                {info?.has_update && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    New Version
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Windows developer control plane release manager
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto relative z-10 text-xs">
          {/* Version Pill Strip */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] text-zinc-500 font-mono uppercase">Current Version</div>
              <div className="text-xs font-semibold text-zinc-300 font-mono">
                v{info?.current_version || "2.2.0"}
              </div>
            </div>

            <div className="h-6 w-[1px] bg-white/[0.08]" />

            <div className="space-y-0.5 text-right">
              <div className="text-[10px] text-zinc-500 font-mono uppercase">Latest Available</div>
              <div className={cn(
                "text-xs font-semibold font-mono",
                info?.has_update ? "text-emerald-400" : "text-zinc-300"
              )}>
                v{info?.latest_version || "2.2.0"}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isChecking && (
            <div className="py-8 flex flex-col items-center justify-center space-y-2.5 text-center">
              <RotateCw className="w-6 h-6 text-sky-400 animate-spin" />
              <p className="text-xs text-zinc-300 font-medium">Checking GitHub releases and distribution manifest...</p>
              <p className="text-[10.5px] text-zinc-500">Checking for verified signed updates</p>
            </div>
          )}

          {/* Error State */}
          {error && !isChecking && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-xs">Unable to reach update server</div>
                <div className="text-[11px] text-rose-400/90 leading-relaxed">{error}</div>
                <button
                  onClick={fetchUpdate}
                  className="mt-1 text-[11px] underline hover:text-white cursor-pointer font-medium"
                >
                  Retry check
                </button>
              </div>
            </div>
          )}

          {/* State A: Update Available with Changelog */}
          {!isChecking && !error && info?.has_update && (
            <div className="space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Rocket className="w-3.5 h-3.5" />
                  What's New in v{info.latest_version}
                </span>
                {info.published_at && (
                  <span className="text-[10px] font-normal text-zinc-500 font-mono">
                    {new Date(info.published_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Structured Features List */}
              {info.features && info.features.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold px-0.5">
                    Features & Capabilities
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1.5">
                    {info.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-zinc-300 leading-snug">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Fixes List */}
              {info.fixes && info.fixes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold px-0.5">
                    Fixes & Polish
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1.5">
                    {info.fixes.map((fix, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-zinc-300 leading-snug">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-1.5" />
                        <span>{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback to raw notes if neither parsed */}
              {(!info.features || info.features.length === 0) &&
                (!info.fixes || info.fixes.length === 0) &&
                info.release_notes && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1 text-[11px] text-zinc-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap font-mono">
                    {info.release_notes}
                  </div>
                )}

              {/* Optional raw changelog toggle */}
              {info.release_notes && (
                <button
                  type="button"
                  onClick={() => setShowRawNotes(!showRawNotes)}
                  className="text-[10.5px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  {showRawNotes ? "Hide full release notes" : "View raw GitHub release notes"}
                </button>
              )}

              {showRawNotes && (
                <div className="p-2 rounded-lg bg-zinc-900 border border-white/[0.06] text-[10px] font-mono text-zinc-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {info.release_notes}
                </div>
              )}

              {/* Installing feedback */}
              {isInstalling && (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Installing Update...</span>
                  </div>
                  <div className="text-[11px] text-zinc-300">{installStatus}</div>
                </div>
              )}
            </div>
          )}

          {/* State B: Already Up to Date */}
          {!isChecking && !error && !info?.has_update && info && (
            <div className="py-4 space-y-3 text-center animate-in fade-in-50 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">AltSpace is Up to Date</h3>
                <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  You are currently using the latest release of the 2026 Developer Control Plane.
                </p>
              </div>

              {/* Feature highlight card */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-left space-y-1.5 text-[11px] text-zinc-300">
                <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Active Pro &amp; Core Architecture</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-[10.5px]">
                  <li>• Hardware-bound DPAPI local credential security</li>
                  <li>• Sub-5ms indexed multi-drive search and port killer</li>
                  <li>• Docker Compose &amp; WSL2 Hyper-V RAM recovery</li>
                  <li>• Private local Ollama &amp; BYOK multi-step action plans</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => handleToggleAutoCheck(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Auto-check for updates</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {info?.has_update ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenReleasePage}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.1] hover:bg-white/[0.06] text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Release Notes</span>
                </button>
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isInstalling ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Install Update</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={fetchUpdate}
                  disabled={isChecking}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.1] hover:bg-white/[0.06] text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={cn("w-3 h-3", isChecking && "animate-spin")} />
                  <span>Check Again</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white font-medium text-xs transition cursor-pointer"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
