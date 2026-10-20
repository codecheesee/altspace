import type { Item } from "../../types";

interface ResultMetadataProps {
  item: Item;
  isSelected?: boolean;
}

export function ResultMetadata({ item, isSelected }: ResultMetadataProps) {
  const isDriveItem = item.path && /^[A-Za-z]:/.test(item.path);
  const driveLetter = isDriveItem ? item.path[0].toUpperCase() : null;

  return (
    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
      {driveLetter && (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
            isSelected
              ? "bg-zinc-800 text-zinc-300 border-zinc-700"
              : "bg-white/[0.03] text-zinc-500 border-white/[0.05]"
          }`}
          title={`Origin: Drive ${driveLetter}:`}
        >
          {driveLetter}:
        </span>
      )}

      {item.size && (
        <span className="text-[10.5px] text-zinc-500">
          {item.size}
        </span>
      )}
    </div>
  );
}
