import { useState, useCallback, useMemo } from "react";
import { tauriInvoke } from "../lib/appStorage";
import type { ClipboardHistoryItem } from "../types";

export function useClipboardHistory(query: string, onNotify?: (msg: string) => void) {
  const [clipboardItems, setClipboardItems] = useState<ClipboardHistoryItem[]>([]);
  const [clipboardFilter, setClipboardFilter] = useState<"all" | "code" | "url" | "color" | "text">("all");

  const fetchClipboard = useCallback(async () => {
    try {
      const res = await tauriInvoke<ClipboardHistoryItem[]>("get_clipboard_history");
      if (res && Array.isArray(res)) setClipboardItems(res);
    } catch (_) {}
  }, []);

  const filteredClipboard = useMemo(() => {
    return clipboardItems.filter((c) => {
      if (clipboardFilter !== "all") {
        if (clipboardFilter === "code" && c.content_type !== "code" && c.content_type !== "json") return false;
        if (clipboardFilter === "url" && c.content_type !== "url") return false;
        if (clipboardFilter === "color" && c.content_type !== "color") return false;
        if (clipboardFilter === "text" && c.content_type !== "text") return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return c.content.toLowerCase().includes(q) || c.content_type.toLowerCase().includes(q);
    });
  }, [clipboardItems, clipboardFilter, query]);

  const clipCounts = useMemo(() => {
    const counts = { all: clipboardItems.length, code: 0, url: 0, color: 0, text: 0 };
    for (const c of clipboardItems) {
      if (c.content_type === "code" || c.content_type === "json") counts.code++;
      else if (c.content_type === "url") counts.url++;
      else if (c.content_type === "color") counts.color++;
      else counts.text++;
    }
    return counts;
  }, [clipboardItems]);

  const handleCopyClipboard = useCallback(async (content: string) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("copy_clipboard_item", { content });
        onNotify?.("Copied to system clipboard!");
        return;
      } catch (_) {}
    }
    navigator.clipboard.writeText(content);
    onNotify?.("Copied to system clipboard!");
  }, [onNotify]);

  const handleClearClipboard = useCallback(async () => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("clear_clipboard_history");
        setClipboardItems([]);
        onNotify?.("RAM Clipboard Cleared");
        return;
      } catch (_) {}
    }
    setClipboardItems([]);
  }, [onNotify]);

  return {
    clipboardItems,
    filteredClipboard,
    clipboardFilter,
    setClipboardFilter,
    clipCounts,
    fetchClipboard,
    handleCopyClipboard,
    handleClearClipboard,
  };
}
