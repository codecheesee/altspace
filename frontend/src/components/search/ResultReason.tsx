import type { Item } from "../../types";

interface ResultReasonProps {
  item: Item;
  reason?: string;
  query?: string;
  isSelected?: boolean;
}

export function ResultReason({ item, reason, query, isSelected }: ResultReasonProps) {
  let displayReason = reason;

  if (!displayReason) {
    const q = query?.trim().toLowerCase();
    if (q && item.title.toLowerCase() === q) {
      displayReason = "Exact match";
    } else if (item.category === "Window Management") {
      displayReason = "Window tool";
    } else if (item.category === "Setting") {
      displayReason = "System setting";
    } else if (item.category === "Snippet") {
      displayReason = "Snippet";
    } else if (item.category === "Folder") {
      displayReason = "Workspace";
    } else if (item.category === "Application") {
      displayReason = "Application";
    } else {
      displayReason = item.category;
    }
  }

  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
        isSelected
          ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
          : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
      }`}
    >
      {displayReason}
    </span>
  );
}
