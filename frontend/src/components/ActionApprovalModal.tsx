import React, { useState, useEffect } from "react";
import { ShieldAlert, AlertTriangle, FileCode, Check, X, RotateCcw } from "lucide-react";
import type { ActionRequest, ActionEvaluation } from "../lib/actionBroker";
import { rememberSessionApproval } from "../lib/actionBroker";

interface ActionApprovalModalProps {
  request: ActionRequest | null;
  evaluation: ActionEvaluation | null;
  onApprove: (rememberSession: boolean) => void;
  onCancel: () => void;
}

export const ActionApprovalModal: React.FC<ActionApprovalModalProps> = ({
  request,
  evaluation,
  onApprove,
  onCancel,
}) => {
  const [rememberSession, setRememberSession] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        onApprove(rememberSession);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onApprove, onCancel, rememberSession]);

  if (!request || !evaluation) return null;

  const isLevel3 = evaluation.risk_tier === "always_approve";
  const badgeColor = isLevel3
    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
    : "bg-amber-500/10 text-amber-400 border-amber-500/20";

  const tierLabel = isLevel3 ? "High-Risk Action (Always Requires Approval)" : "Preview & Approval Required";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-xl bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-start gap-4 bg-gradient-to-r from-neutral-900 to-neutral-900/50">
          <div className={`p-3 rounded-xl border ${badgeColor}`}>
            {isLevel3 ? <ShieldAlert className="w-6 h-6 text-rose-400" /> : <AlertTriangle className="w-6 h-6 text-amber-400" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 id="approval-title" className="text-lg font-semibold text-white tracking-tight">
                Execution Broker Policy Check
              </h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-mono ${badgeColor}`}>
                {evaluation.risk_tier}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">{tierLabel}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Target Description */}
          <div className="p-3.5 bg-neutral-950/80 border border-white/5 rounded-xl font-mono text-xs text-neutral-200 break-all">
            <span className="text-neutral-500 select-none mr-2">$</span>
            {evaluation.target_summary}
          </div>

          {/* Diff / Code Preview if available */}
          {evaluation.diff_preview && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <FileCode className="w-3.5 h-3.5 text-neutral-500" />
                <span>Payload / Diff Preview:</span>
              </div>
              <pre className="p-3 bg-neutral-950/90 border border-white/5 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto max-h-48 scrollbar-thin">
                {evaluation.diff_preview}
              </pre>
            </div>
          )}

          {/* Reversibility Notice */}
          <div className="flex items-center gap-2 text-xs text-neutral-400 pt-1">
            <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
            <span>
              Reversibility:{" "}
              {evaluation.reversibility ? (
                <span className="text-emerald-400 font-medium">Reversible via Action Timeline</span>
              ) : (
                <span className="text-neutral-400 font-medium">Irreversible (Proceed with caution)</span>
              )}
            </span>
          </div>

          {/* Session remember checkbox for Level 2 */}
          {!isLevel3 && (
            <label className="flex items-center gap-2.5 pt-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(e) => setRememberSession(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Remember approval for this target for the rest of this session</span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-950/60 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">Press Ctrl+Enter to approve</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (rememberSession && !isLevel3) {
                  rememberSessionApproval("target", evaluation.target_summary);
                }
                onApprove(rememberSession);
              }}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg flex items-center gap-1.5 transition-all ${
                isLevel3
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Action</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
