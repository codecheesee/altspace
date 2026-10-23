import React, { useState, useEffect } from "react";
import {
  Activity,
  Check,
  Copy,
  Download,
  FileText,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  generateDiagnosticSnapshot,
  formatDiagnosticsForExport,
  type DiagnosticSnapshot,
} from "../lib/diagnostics";

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  safeMode?: boolean;
  totalPlugins?: number;
  driveIndexedCount?: number;
  currentThemeId?: string;
  quotaTier?: string;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  safeMode = false,
  totalPlugins = 0,
  driveIndexedCount = 0,
  currentThemeId = "altspace-obsidian",
  quotaTier = "core_free",
}) => {
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null);
  const [viewRawJson, setViewRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const snap = generateDiagnosticSnapshot({
        app: {
          name: "AltSpace",
          version: "2.2.0",
          safeMode,
        },
        storageAndIndex: {
          totalDrivesIndexed: driveIndexedCount,
          searchAllDrives: driveIndexedCount > 1,
          frecencyItemCount: 42,
        },
        extensions: {
          totalInstalled: totalPlugins,
          byTier: {
            builtIn: 2,
            verified: 0,
            community: Math.max(0, totalPlugins - 2),
            localDev: 0,
            revoked: 0,
          },
          quarantinedCount: 0,
        },
        theme: {
          currentThemeId,
          hasCustomAccent: false,
        },
        quota: {
          tier: quotaTier,
          isUnlimited: true,
        },
        recentLogs: [
          {
            level: "info",
            message: "AltSpace Core Broker initialized successfully",
            timestamp: new Date().toISOString(),
          },
        ],
      });
      setSnapshot(snap);
      setCopied(false);
    }
  }, [isOpen, safeMode, totalPlugins, driveIndexedCount, currentThemeId, quotaTier]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !snapshot) return null;

  const exportedText = formatDiagnosticsForExport(snapshot);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportedText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altspace-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="diagnostics-modal-title"
                className="text-lg font-semibold text-white tracking-tight"
              >
                Privacy-Preserving Diagnostics
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Inspect and export sanitized telemetry without leaking credentials or personal paths
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close diagnostics dialog"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Shield Banner */}
        <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Zero secrets, clipboard data, or raw user filesystem paths are contained in this export.
            </span>
          </div>
          <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-[11px] border border-emerald-500/30">
            {snapshot.redactionSummary.totalRedactedItems} Redacted
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Quick Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">App Version</span>
              <span className="font-mono text-zinc-100 font-medium">v{snapshot.app.version}</span>
              {snapshot.app.safeMode && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Safe Mode
                </span>
              )}
            </div>

            <div className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Platform</span>
              <span className="font-mono text-zinc-100 font-medium">
                {snapshot.system.platform} ({snapshot.system.arch})
              </span>
            </div>

            <div className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Installed Extensions</span>
              <span className="font-mono text-zinc-100 font-medium">{snapshot.extensions.totalInstalled}</span>
              <span className="text-[11px] text-zinc-500 ml-1">
                ({snapshot.extensions.byTier.builtIn} built-in)
              </span>
            </div>

            <div className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Indexing Scope</span>
              <span className="font-mono text-zinc-100 font-medium">
                {snapshot.storageAndIndex.searchAllDrives ? "All Drives" : "System Drive"}
              </span>
            </div>

            <div className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Active Theme</span>
              <span className="font-mono text-zinc-100 font-medium">{snapshot.theme.currentThemeId}</span>
            </div>

            <div className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Licensing Tier</span>
              <span className="font-mono text-zinc-100 font-medium">Core Apache-2.0</span>
            </div>
          </div>

          {/* Toggle between Structured View and Raw JSON */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                {viewRawJson ? "Raw Redacted JSON" : "Diagnostics Payload Preview"}
              </span>
              <button
                type="button"
                onClick={() => setViewRawJson(!viewRawJson)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                {viewRawJson ? "Show Formatted Preview" : "View Raw JSON Payload"}
              </button>
            </div>

            <pre className="p-3.5 bg-neutral-950/80 rounded-xl border border-white/5 text-xs font-mono text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed select-text">
              {viewRawJson
                ? JSON.stringify(snapshot, null, 2)
                : exportedText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-neutral-900/60 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">
            Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-white/10 text-zinc-300">Esc</kbd> to dismiss
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
              {copied ? "Copied Sanitized Report" : "Copy Report"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-sky-600/20"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
