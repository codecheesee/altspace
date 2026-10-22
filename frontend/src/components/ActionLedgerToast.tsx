import React, { useEffect, useState } from "react";
import { Zap, RotateCcw, X } from "lucide-react";

export interface HealingToastData {
  id: string;
  message: string;
  recipeId: string;
  undoToken?: string;
  durationMs?: number;
}

interface ActionLedgerToastProps {
  toast: HealingToastData | null;
  onDismiss: () => void;
  onUndo: (undoToken: string) => void;
}

export const ActionLedgerToast: React.FC<ActionLedgerToastProps> = ({
  toast,
  onDismiss,
  onUndo,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(8);

  useEffect(() => {
    if (!toast) return;

    setSecondsRemaining(8);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-zinc-900/95 border border-emerald-500/40 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.2)] backdrop-blur-md text-xs text-zinc-100 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        <Zap className="w-3.5 h-3.5 fill-emerald-400" />
        <span>Self-Healing:</span>
      </div>

      <span className="text-zinc-200 font-mono text-[11px] max-w-sm truncate">
        {toast.message}
      </span>

      {toast.undoToken && (
        <button
          type="button"
          onClick={() => onUndo(toast.undoToken!)}
          title="Click to roll back this action (Alt + H)"
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-100 font-medium transition cursor-pointer text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Undo ({secondsRemaining}s)</span>
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-0.5"
        aria-label="Dismiss toast"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
