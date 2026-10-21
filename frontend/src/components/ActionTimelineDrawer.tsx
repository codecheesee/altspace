import React, { useState, useEffect } from "react";
import { History, RotateCcw, CheckCircle2, XCircle, Clock, X } from "lucide-react";
import type { LedgerEntry } from "../lib/actionBroker";
import { getActionLedger, undoAction } from "../lib/actionBroker";

interface ActionTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActionTimelineDrawer: React.FC<ActionTimelineDrawerProps> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [undoStatus, setUndoStatus] = useState<string | null>(null);

  const loadLedger = async () => {
    try {
      const data = await getActionLedger();
      setEntries(data);
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      loadLedger();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleUndo = async (actionId: string) => {
    setUndoStatus(null);
    try {
      const res = await undoAction(actionId);
      setUndoStatus(res || "Action reverted successfully");
      loadLedger();
    } catch (err: any) {
      setUndoStatus(`Undo failed: ${err}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-neutral-900/98 border-l border-white/10 shadow-2xl flex flex-col backdrop-blur-xl animate-slide-left"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white tracking-tight">Execution Timeline</h2>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {undoStatus && (
        <div className="px-5 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{undoStatus}</span>
        </div>
      )}

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {entries.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-xs">
            No native execution history recorded in this session.
          </div>
        ) : (
          entries.map((item) => {
            const isCompleted = item.status === "completed";
            const isFailed = item.status === "failed";
            const isHighRisk = item.risk_tier === "always_approve";

            return (
              <div
                key={item.id}
                className="p-3.5 bg-neutral-950/70 border border-white/5 rounded-xl space-y-2 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isFailed ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="font-semibold text-neutral-200">{item.action_name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                      isHighRisk
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700"
                    }`}
                  >
                    {item.risk_tier}
                  </span>
                </div>

                <div className="text-xs text-neutral-400 font-mono break-all line-clamp-2">
                  {item.target}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-neutral-500">
                  <span>{new Date(item.timestamp * 1000).toLocaleTimeString()}</span>
                  {item.undo_available && (
                    <button
                      onClick={() => handleUndo(item.id)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 bg-neutral-950/60 text-[11px] text-neutral-500 flex items-center justify-between">
        <span>Audited by Capability Broker</span>
        <button
          onClick={loadLedger}
          className="hover:text-neutral-300 transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};
