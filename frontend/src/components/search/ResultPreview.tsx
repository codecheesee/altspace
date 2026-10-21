import {
  Folder,
  Terminal,
  ExternalLink,
  Copy,
  FileCode,
  Zap,
  AlignLeft,
  GitBranch,
  Eye,
  Settings,
  LayoutGrid,
  Gamepad2,
  Palette,
  Code,
  Package,
  Layers,
  Play,
  Search,
  BookOpen,
  Globe,
  KeyRound,
  Braces,
  Sparkles,
  Fingerprint,
  Binary,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { PRESET_THEMES } from "../../lib/theme";
import { formatDisplayPath, getDriveOrigin } from "../../lib/formatters";
import { MiniScreenBlueprint } from "../MiniScreenBlueprint";
import { DockerWslPreview } from "./DockerWslPreview";
import { ActionPlanPreview } from "./ActionPlanPreview";
import type { Item, SpecialCard, GitInfo, ShellResult } from "../../types";

interface ResultPreviewProps {
  selectedSpecial: SpecialCard | null;
  selectedItem: Item | null;
  currentThemeId: string;
  terminalRunning: boolean;
  terminalResult: ShellResult | null;
  gitInfo: GitInfo | null;
  setQuery: (q: string) => void;
  onCopyClipboard: (content: string) => void;
  onCopiedNotification: (msg: string) => void;
  onExecuteTerminalCommand: (cmd: string) => void;
  onLaunchTerminalWindow: (cmd: string) => void;
  onOpenUrl: (url: string) => void;
  onOpenFolder: (path: string) => void;
  onLaunchGame: (uri: string) => void;
  onSelectTheme: (themeId: string) => void;
  onSnapWindow: (snapPosition: string) => void;
  onOpenQuickLook: () => void;
}

export function ResultPreview({
  selectedSpecial,
  selectedItem,
  currentThemeId,
  terminalRunning,
  terminalResult,
  gitInfo,
  setQuery,
  onCopyClipboard,
  onCopiedNotification,
  onExecuteTerminalCommand,
  onLaunchTerminalWindow,
  onOpenUrl,
  onOpenFolder,
  onLaunchGame,
  onSelectTheme,
  onSnapWindow,
  onOpenQuickLook,
}: ResultPreviewProps) {
  if (selectedSpecial) {
    if (selectedSpecial.kind === "plan") {
      return (
        <ActionPlanPreview
          plan={selectedSpecial.data}
          onCopiedNotification={onCopiedNotification}
        />
      );
    }

    if (selectedSpecial.kind === "transform") {
      const t = selectedSpecial.data;
      return (
        <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden select-none">
          <div className="space-y-3.5 overflow-y-auto pr-0.5">
            {/* Header Card */}
            <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-gradient-to-b from-purple-500/[0.08] to-purple-500/[0.02] border border-purple-500/20 shadow-sm relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm border bg-purple-500/15 text-purple-400 border-purple-500/30">
                {t.kind === "jwt" && <KeyRound className="w-5 h-5" />}
                {(t.kind === "json" || t.kind === "yaml") && <Braces className="w-5 h-5" />}
                {t.kind === "regex" && <Sparkles className="w-5 h-5" />}
                {t.kind === "hash" && <Fingerprint className="w-5 h-5" />}
                {t.kind === "encoding" && <Binary className="w-5 h-5" />}
                {(t.kind === "uuid" || t.kind === "time") && <Clock className="w-5 h-5" />}
              </div>

              <div className="text-sm font-bold font-mono text-white tracking-tight break-all">
                {t.title}
              </div>

              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-purple-300 border border-white/[0.08]">
                  {t.badge}
                </span>
                {t.meta?.algorithm && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
                    {t.meta.algorithm}
                  </span>
                )}
                {t.meta?.expiresIn && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border",
                      t.meta.isExpired
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        t.meta.isExpired ? "bg-rose-400" : "bg-emerald-400 animate-pulse"
                      )}
                    />
                    {t.meta.expiresIn}
                  </span>
                )}
              </div>
            </div>

            {/* Claims / Details breakdown */}
            {t.kind === "jwt" && t.meta && (
              <div className="space-y-1.5 text-xs font-mono">
                {t.meta.subject && (
                  <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-500">Subject (sub)</span>
                    <span className="text-zinc-200 truncate max-w-[150px]">{t.meta.subject}</span>
                  </div>
                )}
                {t.meta.issuer && (
                  <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                    <span className="text-zinc-500">Issuer (iss)</span>
                    <span className="text-zinc-200 truncate max-w-[150px]">{t.meta.issuer}</span>
                  </div>
                )}
              </div>
            )}

            {/* Main Code Viewport */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Output Result</span>
                <span className="text-zinc-500 font-mono">100% Offline</span>
              </div>
              <div className="bg-black/50 border border-white/[0.06] rounded-xl p-2.5 font-mono text-[11px] text-zinc-200 overflow-y-auto max-h-[180px] break-all leading-relaxed whitespace-pre-wrap selection:bg-purple-500/30">
                {t.output}
              </div>
            </div>

            {t.meta?.headerJson && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Token Header
                </span>
                <div className="bg-black/40 border border-white/[0.04] rounded-lg p-2 font-mono text-[10.5px] text-zinc-400 max-h-16 overflow-y-auto whitespace-pre-wrap">
                  {t.meta.headerJson}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
            <button
              onClick={() => {
                onCopyClipboard(t.output);
                onCopiedNotification(`Copied ${t.title}!`);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-xs font-bold text-purple-300 border border-purple-500/30 transition shadow-sm cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Output (Enter)</span>
            </button>

            {t.meta?.yamlOutput && (
              <button
                onClick={() => {
                  onCopyClipboard(t.meta?.yamlOutput || "");
                  onCopiedNotification("YAML copied to clipboard!");
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-zinc-300 border border-white/[0.06] transition cursor-pointer"
              >
                <span>Copy as YAML</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (selectedSpecial.kind === "calc") {
      return (
        <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-sky-500/[0.06] border border-sky-500/20">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 shadow-sm border bg-sky-500/10 text-sky-400 border-sky-500/25">
                <span className="font-mono text-xl font-bold">=</span>
              </div>
              <div className="text-xl font-bold font-mono text-white tracking-tight break-all">
                {selectedSpecial.data.result}
              </div>
              <div className="text-xs text-zinc-400 font-mono mt-0.5">
                {selectedSpecial.data.expression}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Engine</span>
                <span className="text-zinc-300 font-mono">Instant Local Parser</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Category</span>
                <span className="text-sky-300 font-mono uppercase">{selectedSpecial.data.type}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Action</span>
                <span className="text-zinc-200">Copy Result (↵)</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
              Evaluated instantly on your CPU with zero cloud latency and zero network traffic.
            </p>
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => {
                onCopyClipboard(selectedSpecial.data.result);
                onCopiedNotification("Result copied to clipboard!");
                setQuery("");
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-300 border border-sky-500/30 transition shadow-sm cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{selectedSpecial.data.actionLabel || "Copy Result (↵)"}</span>
            </button>
          </div>
        </div>
      );
    }

    if (selectedSpecial.kind === "quickjump") {
      return (
        <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-sky-500/[0.06] border border-sky-500/20">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 shadow-sm border bg-sky-500/10 text-sky-400 border-sky-500/25">
                {selectedSpecial.data.iconType === "github" && <Code className="w-5 h-5 stroke-[2]" />}
                {selectedSpecial.data.iconType === "npm" && <Package className="w-5 h-5 stroke-[2]" />}
                {selectedSpecial.data.iconType === "so" && <Layers className="w-5 h-5 stroke-[2]" />}
                {selectedSpecial.data.iconType === "youtube" && <Play className="w-5 h-5 fill-current stroke-[1.5]" />}
                {selectedSpecial.data.iconType === "google" && <Search className="w-5 h-5 stroke-[2]" />}
                {selectedSpecial.data.iconType === "wiki" && <BookOpen className="w-5 h-5 stroke-[2]" />}
                {selectedSpecial.data.iconType === "web" && <Globe className="w-5 h-5 stroke-[2]" />}
              </div>
              <div className="text-sm font-semibold text-white tracking-tight break-all max-w-full">
                {selectedSpecial.data.title}
              </div>
              <span className="text-[10px] font-mono text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30 mt-1 uppercase">
                {selectedSpecial.data.badge} Quick-Jump
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Provider</span>
                <span className="text-white font-mono uppercase">{selectedSpecial.data.badge}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Action</span>
                <span className="text-zinc-200">Open in Browser (↵)</span>
              </div>
              <div className="py-1">
                <span className="text-zinc-500 font-medium block mb-1">Target URL</span>
                <div className="text-[11px] text-zinc-300 font-mono bg-white/[0.03] p-2 rounded-lg break-all border border-white/[0.04] leading-relaxed select-text">
                  {selectedSpecial.data.url}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => {
                onOpenUrl(selectedSpecial.data.url);
                setQuery("");
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-300 border border-sky-500/30 transition shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Browser (↵)</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedSpecial.data.url);
                onCopiedNotification("Copied URL to clipboard!");
              }}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.06] transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy URL</span>
            </button>
          </div>
        </div>
      );
    }

    if (selectedSpecial.kind === "snippet") {
      return (
        <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 shadow-sm border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                <AlignLeft className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="text-sm font-semibold text-white tracking-tight break-all max-w-full">
                {selectedSpecial.data.snippet.name}
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 mt-1">
                {selectedSpecial.data.snippet.keyword}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500 font-medium">Category</span>
                <span className="text-white font-mono uppercase">{selectedSpecial.data.snippet.category}</span>
              </div>
              <div className="py-1">
                <span className="text-zinc-500 font-medium block mb-1">Expanded Content</span>
                <div className="text-[11px] text-zinc-200 font-mono bg-white/[0.03] p-2.5 rounded-lg break-all border border-white/[0.04] leading-relaxed select-text whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {selectedSpecial.data.resolvedContent}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => {
                onCopyClipboard(selectedSpecial.data.resolvedContent);
                onCopiedNotification("Snippet copied & ready!");
                setQuery("");
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition shadow-sm cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Expanded Snippet (↵)</span>
            </button>
          </div>
        </div>
      );
    }

    if (selectedSpecial.kind === "terminal") {
      return (
        <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-3 min-h-0 flex flex-col flex-1">
            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-sky-500/[0.06] border border-sky-500/20 shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm border bg-sky-500/10 text-sky-400 border-sky-500/25 font-mono font-bold text-sm">
                &gt;_
              </div>
              <div className="text-xs font-mono font-semibold text-sky-300 tracking-tight truncate max-w-full">
                {selectedSpecial.data.command}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[9.5px] font-mono text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30 uppercase tracking-wide">
                  PowerShell Core
                </span>
                {terminalRunning ? (
                  <span className="text-[9.5px] font-mono text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                    RUNNING...
                  </span>
                ) : terminalResult ? (
                  <span
                    className={cn(
                      "text-[9.5px] font-mono px-2 py-0.5 rounded border uppercase",
                      terminalResult.exit_code === 0
                        ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                        : "text-rose-300 bg-rose-500/15 border-rose-500/30"
                    )}
                  >
                    Exit {terminalResult.exit_code} ({terminalResult.elapsed_ms}ms)
                  </span>
                ) : (
                  <span className="text-[9.5px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                    READY
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between pb-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                <span>Console Output</span>
                {terminalResult && (terminalResult.stdout || terminalResult.stderr) && (
                  <button
                    onClick={() => {
                      const out = terminalResult.stdout || terminalResult.stderr;
                      navigator.clipboard.writeText(out);
                      onCopiedNotification("Output copied to clipboard!");
                    }}
                    className="text-[9.5px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy</span>
                  </button>
                )}
              </div>
              <div className="flex-1 bg-black/60 border border-white/[0.08] rounded-xl p-3 font-mono text-[11px] leading-relaxed text-zinc-200 overflow-y-auto select-text shadow-inner">
                {terminalRunning ? (
                  <div className="flex items-center gap-2 text-amber-400/80 animate-pulse">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Executing command silently in background...</span>
                  </div>
                ) : terminalResult ? (
                  <>
                    {terminalResult.stdout && (
                      <div className="whitespace-pre-wrap text-emerald-300/90 break-words">
                        {terminalResult.stdout}
                      </div>
                    )}
                    {terminalResult.stderr && (
                      <div className="whitespace-pre-wrap text-rose-400/90 break-words mt-2">
                        {terminalResult.stderr}
                      </div>
                    )}
                    {!terminalResult.stdout && !terminalResult.stderr && (
                      <div className="text-zinc-500 italic">
                        Command finished with exit code {terminalResult.exit_code} (No output returned).
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-zinc-500 italic text-[10.5px]">
                    Type your command and press <kbd className="text-zinc-300 font-mono bg-white/[0.08] px-1 py-0.5 rounded text-[10px]">↵ Enter</kbd> to execute.<br /><br />
                    Press <kbd className="text-zinc-300 font-mono bg-white/[0.08] px-1 py-0.5 rounded text-[10px]">Ctrl+T</kbd> to launch interactively in Windows Terminal.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-white/[0.06] shrink-0">
            <button
              disabled={terminalRunning}
              onClick={() => onExecuteTerminalCommand(selectedSpecial.data.command)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-xs font-bold text-sky-300 border border-sky-500/35 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{terminalRunning ? "Running..." : "Run Command (↵)"}</span>
            </button>
            <button
              onClick={() => onLaunchTerminalWindow(selectedSpecial.data.command)}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.06] transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Windows Terminal (Ctrl+T)</span>
            </button>
          </div>
        </div>
      );
    }

    if (selectedSpecial.kind === "ai") {
      return (
        <div className="w-[360px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-3 min-h-0 flex flex-col flex-1">
            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-purple-500/[0.06] border border-purple-500/20 shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm border bg-purple-500/10 text-purple-400 border-purple-500/25 font-bold text-sm">
                AI
              </div>
              <div className="text-xs font-semibold text-purple-300 tracking-tight truncate max-w-full">
                {selectedSpecial.data.prompt}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[9.5px] font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30 uppercase tracking-wide">
                  {selectedSpecial.data.model} (Offline MCP)
                </span>
              </div>
            </div>

            <div className="flex-1 bg-black/60 border border-white/[0.08] rounded-xl p-3 font-mono text-[11px] leading-relaxed text-zinc-200 overflow-y-auto select-text shadow-inner">
              {selectedSpecial.data.error ? (
                <div className="space-y-3 text-zinc-300 text-[11px] font-sans">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Ollama is not running on localhost:11434</span>
                  </div>
                  <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                    AltSpace provides 100% free, private local AI using Ollama. To start asking questions:
                  </p>

                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/[0.06] space-y-2">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-purple-400 font-semibold">
                      Step 1: Install Free Ollama
                    </div>
                    <div className="flex items-center justify-between font-mono bg-black/50 p-1.5 rounded border border-white/[0.04]">
                      <span className="text-zinc-300 text-[10px] select-all">winget install Ollama.Ollama</span>
                      <button
                        onClick={() => {
                          onCopyClipboard("winget install Ollama.Ollama");
                          onCopiedNotification("Copied install command!");
                        }}
                        className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[9.5px] font-semibold cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="text-[10px] uppercase font-mono tracking-wider text-purple-400 font-semibold mt-1">
                      Step 2: Run Lightweight Model
                    </div>
                    <div className="flex items-center justify-between font-mono bg-black/50 p-1.5 rounded border border-white/[0.04]">
                      <span className="text-zinc-300 text-[10px] select-all">ollama run llama3.2</span>
                      <button
                        onClick={() => {
                          onCopyClipboard("ollama run llama3.2");
                          onCopiedNotification("Copied run command!");
                        }}
                        className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[9.5px] font-semibold cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-sky-500/[0.06] border border-sky-500/20 text-[10.5px] text-zinc-300 space-y-1">
                    <span className="text-sky-300 font-semibold">Prefer Claude 3.7 or GPT-4o?</span>
                    <p className="text-zinc-400 text-[10px]">
                      Add your cloud API key in Settings (<kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">Ctrl+,</kbd>) under Local Copilot.
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 text-[10px] text-emerald-300">
                    💡 <strong>Offline fast path works right now!</strong> Try: <code className="text-white font-mono">? fix 5173</code> or <code className="text-white font-mono">? reclaim memory</code>
                  </div>
                </div>
              ) : selectedSpecial.data.response ? (
                <div className="whitespace-pre-wrap text-zinc-200/90 break-words font-sans text-xs leading-relaxed">
                  {selectedSpecial.data.response}
                </div>
              ) : (
                <div className="text-zinc-500 italic text-[10.5px]">
                  {selectedSpecial.data.isLoading
                    ? "Connecting to local Ollama and generating tokens..."
                    : "Type your question after '?' to generate instant answers locally."}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => {
                if (selectedSpecial.data.response) {
                  onCopyClipboard(selectedSpecial.data.response);
                  onCopiedNotification("AI answer copied to clipboard!");
                }
              }}
              disabled={!selectedSpecial.data.response}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-xs font-semibold text-purple-300 border border-purple-500/30 transition shadow-sm disabled:opacity-40 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Answer (↵)</span>
            </button>
          </div>
        </div>
      );
    }
  }

  if (!selectedItem) {
    return null;
  }

  if (selectedItem.path.startsWith("docker://") || selectedItem.path.startsWith("wsl://")) {
    return (
      <DockerWslPreview
        itemPath={selectedItem.path}
        onCopiedNotification={onCopiedNotification}
      />
    );
  }

  // Normal selected item preview
  return (
    <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden">
      <div className="space-y-4 overflow-y-auto pr-0.5">
        <div className="flex flex-col items-center text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] shadow-sm relative group">
          {selectedItem.category === "Game" ? (
            selectedItem.bannerUrl ? (
              <img
                src={selectedItem.bannerUrl}
                alt=""
                className="w-full h-24 rounded-lg object-cover border border-violet-500/25 shadow-md mb-2.5"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 shadow-md border bg-violet-500/10 text-violet-400 border-violet-500/20">
                <Gamepad2 className="w-6 h-6 stroke-[2]" />
              </div>
            )
          ) : selectedItem.category === "Theme" ? (
            (() => {
              const themeId = selectedItem.path.replace("theme://", "");
              const tObj = PRESET_THEMES.find((t) => t.id === themeId);
              const isCurrent = themeId === currentThemeId;
              return (
                <div className="w-full flex flex-col items-center">
                  <div
                    className="w-full h-20 rounded-lg border mb-2.5 flex flex-col justify-between p-2.5 shadow-md relative overflow-hidden"
                    style={{
                      backgroundColor: tObj?.bg || "#111114",
                      borderColor: tObj?.borderColor || "rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shadow-sm"
                          style={{ backgroundColor: tObj?.accentHex || "#38bdf8" }}
                        />
                        <span className="text-[11px] font-semibold text-white/90">
                          {tObj?.name}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div
                      className="h-6 rounded border px-2 flex items-center text-[10px] font-mono text-white/70"
                      style={{
                        backgroundColor: tObj?.cardBg || "#16161a",
                        borderColor: tObj?.selectedBorder || "rgba(255,255,255,0.1)",
                      }}
                    >
                      Accent: {tObj?.accentHex}
                    </div>
                  </div>
                  <h3 className="font-semibold text-[14px] text-white tracking-tight truncate max-w-full">
                    {tObj?.name || selectedItem.title}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">
                    {tObj?.description}
                  </p>
                </div>
              );
            })()
          ) : selectedItem.category === "Window Management" ? (
            <MiniScreenBlueprint layoutType={selectedItem.size || "left-half"} className="w-16 h-11 mb-2.5" />
          ) : selectedItem.iconData ? (
            <img
              src={selectedItem.iconData}
              alt=""
              className="w-12 h-12 rounded-xl object-contain p-1.5 bg-black/40 border border-white/[0.08] shadow-md mb-2.5"
            />
          ) : (
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 shadow-md border",
                selectedItem.category === "Application" && "bg-sky-500/10 text-sky-400 border-sky-500/20",
                selectedItem.category === "Folder" && "bg-sky-500/10 text-sky-400 border-sky-500/20",
                selectedItem.category === "File" && "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
                selectedItem.category === "Command" && "bg-sky-500/10 text-sky-400 border-sky-500/20",
                selectedItem.category === "Setting" && "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
                selectedItem.category === "Snippet" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              )}
            >
              {selectedItem.category === "Application" && <Zap className="w-6 h-6 stroke-[2]" />}
              {selectedItem.category === "Folder" && <Folder className="w-6 h-6 stroke-[2]" />}
              {selectedItem.category === "File" && <FileCode className="w-6 h-6 stroke-[2]" />}
              {selectedItem.category === "Command" && <Terminal className="w-6 h-6 stroke-[2]" />}
              {selectedItem.category === "Setting" && <Settings className="w-6 h-6 stroke-[2]" />}
              {selectedItem.category === "Snippet" && <AlignLeft className="w-6 h-6 stroke-[2]" />}
            </div>
          )}

          <h3 className="font-semibold text-[14px] text-zinc-100 tracking-tight truncate max-w-full">
            {selectedItem.title}
          </h3>
          <p className="text-[11.5px] text-zinc-400 font-medium mt-0.5">
            {selectedItem.category}
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
            <span className="text-zinc-500 font-medium">Type</span>
            <span className="text-zinc-300 font-medium">{selectedItem.category}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
            <span className="text-zinc-500 font-medium">Drive Origin</span>
            <span className="text-zinc-300 font-mono text-[11px]">{getDriveOrigin(selectedItem.path)}</span>
          </div>
          {selectedItem.size && (
            <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
              <span className="text-zinc-500 font-medium">Size</span>
              <span className="text-zinc-300 font-mono">{selectedItem.size}</span>
            </div>
          )}
          {selectedItem.updated && (
            <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
              <span className="text-zinc-500 font-medium">Modified</span>
              <span className="text-zinc-300 font-medium">{selectedItem.updated}</span>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Location</span>
              <button
                onClick={() => onOpenFolder(selectedItem.path)}
                className="text-[10.5px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
                title="Open enclosing folder in File Explorer"
              >
                <Folder className="w-3 h-3" />
                <span>Reveal</span>
              </button>
            </div>
            <div className="text-[11px] font-medium text-zinc-200 truncate font-mono" title={selectedItem.path}>
              {formatDisplayPath(selectedItem.path)}
            </div>
            <div className="text-[9px] text-zinc-500 font-mono break-all line-clamp-2 select-text">
              {selectedItem.path}
            </div>
          </div>

          {gitInfo && gitInfo.is_repo && (
            <div className="p-2.5 rounded-lg bg-sky-500/[0.05] border border-sky-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                <span className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                  {gitInfo.branch || "HEAD"}
                </span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border",
                    gitInfo.modified_count === 0 && gitInfo.untracked_count === 0
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  )}
                >
                  {gitInfo.modified_count === 0 && gitInfo.untracked_count === 0
                    ? "Clean"
                    : `${gitInfo.modified_count} mod, ${gitInfo.untracked_count} untracked`}
                </span>
              </div>
              {gitInfo.last_commit_message && (
                <div className="text-[10.5px] text-zinc-300 font-mono truncate bg-black/20 p-1.5 rounded border border-white/[0.04]">
                  {gitInfo.last_commit_message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2">
        {selectedItem.category === "Game" ? (
          <button
            onClick={() => onLaunchGame(selectedItem.path)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-violet-600/25 hover:bg-violet-600/35 text-xs font-semibold text-violet-300 border border-violet-500/35 transition shadow-sm cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Play Game (↵)</span>
          </button>
        ) : selectedItem.category === "Theme" ? (
          <button
            onClick={() => {
              const themeId = selectedItem.path.replace("theme://", "");
              onSelectTheme(themeId);
              setQuery("");
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-xs font-semibold text-sky-300 border border-sky-500/30 transition shadow-sm cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Apply Theme (↵)</span>
          </button>
        ) : selectedItem.category === "Window Management" ? (
          <button
            onClick={() => onSnapWindow(selectedItem.path)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-300 border border-sky-500/30 transition shadow-sm cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Snap Active Window (↵)</span>
          </button>
        ) : (
          <>
            <button
              onClick={onOpenQuickLook}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 border border-white/[0.08] transition shadow-sm cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>QuickLook</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedItem.path);
                onCopiedNotification("Copied path to clipboard!");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition shadow-sm cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy Path</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
