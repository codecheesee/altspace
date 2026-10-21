import { useEffect } from "react";
import { FileText, Copy, X, HardDrive, ExternalLink } from "lucide-react";
import type { Item, FilePreview } from "../types";

interface QuickLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: Item | null;
  filePreview: FilePreview | null;
  onLaunch: (path: string) => void;
  onCopiedNotification: (msg: string) => void;
}

export function QuickLookModal({
  isOpen,
  onClose,
  selectedItem,
  filePreview,
  onLaunch,
  onCopiedNotification,
}: QuickLookModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !selectedItem) return null;

  return (
    <div
      className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-[#16171a] border border-white/[0.14] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* QuickLook Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-sm text-white truncate font-mono">
              {selectedItem.title}
            </span>
            {filePreview?.extension && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.06] text-neutral-300 border border-white/[0.08]">
                .{filePreview.extension}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filePreview?.content && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(filePreview.content || "");
                  onCopiedNotification("Copied file content!");
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-neutral-200 border border-white/[0.08] transition"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* QuickLook Content */}
        <div className="flex-1 overflow-auto p-4 text-xs font-mono select-text bg-[#0e0f11] text-neutral-200">
          {filePreview?.is_text && filePreview.content ? (
            <pre className="whitespace-pre-wrap leading-relaxed font-mono">
              {filePreview.content}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-400 space-y-3">
              <HardDrive className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
              <p className="text-sm font-medium text-white">{selectedItem.title}</p>
              <p className="text-xs text-neutral-500 font-mono break-all max-w-md">
                {selectedItem.path}
              </p>
              {filePreview?.size_bytes ? (
                <span className="text-xs text-neutral-400 font-mono">
                  {(filePreview.size_bytes / 1024).toFixed(1)} KB
                </span>
              ) : null}
              <button
                onClick={() => {
                  onLaunch(selectedItem.path);
                  onClose();
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 transition flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open with Windows Default App
              </button>
            </div>
          )}
        </div>

        {/* QuickLook Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[11px] text-neutral-500">
          <span className="font-mono truncate">{selectedItem.path}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400 font-mono text-[10px]">
            Press Space or ESC to close
          </kbd>
        </div>
      </div>
    </div>
  );
}
