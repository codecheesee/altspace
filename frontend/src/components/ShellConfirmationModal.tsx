import { useEffect, useRef } from "react";

interface ShellConfirmationModalProps {
  isOpen: boolean;
  command: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShellConfirmationModal({
  isOpen,
  command,
  onConfirm,
  onCancel,
}: ShellConfirmationModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      } else if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="shell-confirmation-title"
        aria-describedby="shell-confirmation-description"
        className="w-full max-w-lg rounded-xl border border-amber-400/30 bg-[#111114] p-5 text-zinc-100 shadow-2xl"
      >
        <h2 id="shell-confirmation-title" className="text-base font-semibold">
          Confirm AI shell command
        </h2>
        <p id="shell-confirmation-description" className="mt-2 text-xs leading-5 text-zinc-400">
          The local AI assistant requested PowerShell execution. Review the command before allowing it.
        </p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs leading-5 text-amber-100">
          {command}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/25"
          >
            Run command
          </button>
        </div>
      </section>
    </div>
  );
}
