import {
  Folder,
  FileCode,
  Settings,
  LayoutGrid,
  Gamepad2,
  Palette,
  Code,
  Zap,
  Command,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { renderHighlightedText, formatMiddleTruncatedPath, getItemSubtitle } from "../../lib/formatters";
import { ResultReason } from "./ResultReason";
import { ResultMetadata } from "./ResultMetadata";
import type { Item } from "../../types";

interface ResultRowProps {
  item: Item;
  effectiveIndex: number;
  isSelected: boolean;
  query: string;
  reason?: string;
  onSelect: (index: number) => void;
  onAction: (item: Item) => void;
}

export function ResultRow({
  item,
  effectiveIndex,
  isSelected,
  query,
  reason,
  onSelect,
  onAction,
}: ResultRowProps) {
  // Render icon based on item type and category
  const renderIcon = () => {
    if (item.iconData) {
      return (
        <img
          src={item.iconData}
          alt=""
          className="w-7 h-7 rounded-md object-contain p-0.5 bg-black/40 border border-white/[0.08] shrink-0"
        />
      );
    }

    if (item.category === "Folder") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-sky-500/10 text-sky-400 border-sky-500/20">
          <Folder className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Setting") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-zinc-500/10 text-zinc-300 border-zinc-500/20">
          <Settings className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Snippet") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
          <Code className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Window Management") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
          <LayoutGrid className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Game") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-violet-500/10 text-violet-400 border-violet-500/20">
          <Gamepad2 className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Theme") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-purple-500/10 text-purple-400 border-purple-500/20">
          <Palette className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Command") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-sky-500/10 text-sky-400 border-sky-500/20">
          <Command className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    if (item.category === "Application") {
      return (
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-sky-500/10 text-sky-400 border-sky-500/20">
          <Zap className="w-4 h-4 stroke-[2]" />
        </div>
      );
    }

    // Default icon
    return (
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-white/[0.04] text-zinc-300 border-white/[0.08]">
        <FileCode className="w-4 h-4 stroke-[1.8]" />
      </div>
    );
  };

  const subtitle = getItemSubtitle(item);
  const displaySubtitle = formatMiddleTruncatedPath(subtitle, 48);

  return (
    <div
      role="option"
      id={`result-option-${effectiveIndex}`}
      aria-selected={isSelected}
      data-index={effectiveIndex}
      onClick={() => onSelect(effectiveIndex)}
      onDoubleClick={() => onAction(item)}
      className={cn(
        "min-h-[56px] flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm select-none relative group transition-colors duration-100",
        isSelected
          ? "bg-white/[0.08] text-white shadow-sm border border-sky-400/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-sky-400"
          : "text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 border border-transparent"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 pr-3">
        {renderIcon()}

        <div className="min-w-0">
          <div className="font-medium text-[13.5px] truncate tracking-tight text-zinc-100 group-hover:text-white">
            {renderHighlightedText(item.title, query)}
          </div>
          <div className="text-[11.5px] text-zinc-400 truncate font-mono">
            {renderHighlightedText(displaySubtitle, query)}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <ResultMetadata item={item} isSelected={isSelected} />
        <ResultReason item={item} reason={reason} query={query} isSelected={isSelected} />
      </div>
    </div>
  );
}
