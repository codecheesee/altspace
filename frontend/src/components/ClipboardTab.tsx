import {
  Clipboard as ClipboardIcon,
  Palette,
  Globe,
  FileCode,
  Braces,
  Shield,
  Copy,
  Trash2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ErrorBoundary } from "./ErrorBoundary";
import type { ClipboardHistoryItem } from "../types";

interface ClipboardTabProps {
  filteredClipboard: ClipboardHistoryItem[];
  clipboardFilter: "all" | "code" | "url" | "color" | "text";
  setClipboardFilter: (filter: "all" | "code" | "url" | "color" | "text") => void;
  clipCounts: {
    all: number;
    code: number;
    url: number;
    color: number;
    text: number;
  };
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  selectedClip: ClipboardHistoryItem | null;
  isSidebarVisible: boolean;
  onCopyClipboard: (content: string) => void;
  onClearClipboard: () => void;
}

export function ClipboardTab({
  filteredClipboard,
  clipboardFilter,
  setClipboardFilter,
  clipCounts,
  selectedIndex,
  setSelectedIndex,
  selectedClip,
  isSidebarVisible,
  onCopyClipboard,
  onClearClipboard,
}: ClipboardTabProps) {
  return (
    <ErrorBoundary label="Clipboard Panel">
      {/* Left Pane: Clipboard Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Sleek Raycast-style Type Filter Pills Bar */}
        <div className="flex items-center gap-1 px-1 pb-2 border-b border-white/[0.06] overflow-x-auto shrink-0 mb-1">
          {(
            [
              { id: "all", label: "All", count: clipCounts.all },
              { id: "code", label: "Code", count: clipCounts.code },
              { id: "url", label: "Links", count: clipCounts.url },
              { id: "color", label: "Colors", count: clipCounts.color },
              { id: "text", label: "Text", count: clipCounts.text },
            ] as const
          ).map((tab) => {
            const isActive = clipboardFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setClipboardFilter(tab.id);
                  setSelectedIndex(0);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 border",
                  isActive
                    ? "bg-white/[0.12] text-white border-white/[0.2] shadow-sm font-semibold"
                    : "bg-white/[0.02] text-neutral-400 hover:text-neutral-200 border-white/[0.04] hover:bg-white/[0.05]"
                )}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono px-1 rounded bg-black/30 opacity-70">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredClipboard.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
            <ClipboardIcon className="w-8 h-8 text-neutral-600 stroke-[1.5]" />
            <p className="text-sm font-medium text-neutral-400">No clipboard items found</p>
            <p className="text-xs text-neutral-600">Copy any text, color, URL or code snippet to capture</p>
          </div>
        ) : (
          filteredClipboard.map((clip: ClipboardHistoryItem, index: number) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={clip.id}
                onClick={() => setSelectedIndex(index)}
                onDoubleClick={() => onCopyClipboard(clip.content)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-100 group",
                  isSelected
                    ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                    : "text-neutral-300 hover:bg-white/[0.03] hover:text-neutral-200"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                      clip.content_type === "color" && "border-white/20",
                      clip.content_type === "url" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                      clip.content_type === "code" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      clip.content_type === "json" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                      clip.content_type === "text" && "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}
                    style={clip.content_type === "color" ? { backgroundColor: clip.content } : {}}
                  >
                    {clip.content_type === "color" && <Palette className="w-3.5 h-3.5 text-white drop-shadow" />}
                    {clip.content_type === "url" && <Globe className="w-3.5 h-3.5 stroke-[2]" />}
                    {clip.content_type === "code" && <FileCode className="w-3.5 h-3.5 stroke-[2]" />}
                    {clip.content_type === "json" && <Braces className="w-3.5 h-3.5 stroke-[2]" />}
                    {clip.content_type === "text" && <ClipboardIcon className="w-3.5 h-3.5 stroke-[2]" />}
                  </div>

                  <div className="min-w-0">
                    <div className="font-mono text-[12.5px] truncate tracking-tight text-neutral-200">
                      {clip.preview}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                      <span>{clip.timestamp}</span>
                      <span>•</span>
                      <span>{clip.char_count} chars</span>
                      {clip.line_count > 1 && <span>• {clip.line_count} lines</span>}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded uppercase border font-mono",
                      isSelected
                        ? "bg-white/[0.1] text-neutral-200 border-white/[0.12]"
                        : "bg-white/[0.03] text-neutral-500 border-white/[0.05]"
                    )}
                  >
                    {clip.content_type}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right Pane: Clipboard Inspector */}
      {isSidebarVisible && selectedClip && (
        <div className="w-[310px] border-l border-white/[0.06] bg-black/20 p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <ClipboardIcon className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Clipboard Item
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">
                {selectedClip.content_type.toUpperCase()}
              </span>
            </div>

            {selectedClip.content_type === "color" && (
              <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02] flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-white/20 shadow-md"
                  style={{ backgroundColor: selectedClip.content }}
                />
                <div>
                  <div className="text-sm font-mono font-bold text-white">{selectedClip.content}</div>
                  <div className="text-[11px] text-neutral-400">CSS Color Value</div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-medium">Content Preview</span>
              <div className="max-h-[180px] overflow-y-auto text-[11.5px] text-neutral-300 font-mono bg-white/[0.03] p-3 rounded-xl break-all border border-white/[0.05] leading-relaxed whitespace-pre-wrap select-text">
                {selectedClip.content}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-neutral-500">Captured at</span>
                <span className="text-neutral-300 font-mono">{selectedClip.timestamp}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-neutral-500">Length</span>
                <span className="text-neutral-300 font-mono">
                  {selectedClip.char_count} chars ({selectedClip.line_count} lines)
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/20 text-[11px] text-blue-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                Privacy Safeguard
              </div>
              <p className="text-[10px] text-blue-300/80 leading-normal">
                RAM buffer only. Sensitive secrets & API keys are dropped automatically. Cleared on reboot.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => onCopyClipboard(selectedClip.content)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-xs font-semibold text-blue-400 border border-blue-500/20 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              Re-Copy to System Clipboard
            </button>
            <button
              onClick={onClearClipboard}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.03] hover:bg-red-500/10 text-xs font-medium text-neutral-400 hover:text-red-400 border border-white/[0.05] transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear In-Memory History
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
