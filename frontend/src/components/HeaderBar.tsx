import React from "react";
import {
  Search,
  Clipboard as ClipboardIcon,
  Activity,
  ShoppingBag,
  X,
  Skull,
  Check,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { Mode } from "../types";

interface HeaderBarProps {
  currentMode: Mode;
  query: string;
  setQuery: (q: string) => void;
  setSelectedIndex: (idx: number) => void;
  setActiveTab: (tab: Mode) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  activeTheme: {
    accentHex: string;
  };
  portStatusMsg: string | null;
  setPortStatusMsg: (msg: string | null) => void;
  copiedNotification: string | null;
  setCopiedNotification: (msg: string | null) => void;
  onOpenMenu: () => void;
  onDismiss: () => void;
}

export function HeaderBar({
  currentMode,
  query,
  setQuery,
  setSelectedIndex,
  setActiveTab,
  inputRef,
  activeTheme,
  portStatusMsg,
  setPortStatusMsg,
  copiedNotification,
  setCopiedNotification,
  onOpenMenu,
  onDismiss,
}: HeaderBarProps) {
  return (
    <>
      {/* Top Ambient Mode Accent Glow Line */}
      <div
        className={cn(
          "h-[1.5px] w-full bg-gradient-to-r from-transparent to-transparent transition-all duration-300",
          currentMode === "all" && "via-white/[0.12]",
          currentMode === "clipboard" && "via-blue-500/70",
          currentMode === "ports" && "via-emerald-500/70",
          currentMode === "store" && "via-purple-500/70"
        )}
        style={
          currentMode === "all"
            ? {
                backgroundImage: `linear-gradient(to right, transparent, ${activeTheme.accentHex}88, transparent)`,
              }
            : undefined
        }
      />

      {/* Top Drag Region & Decluttered Omnibar */}
      <div
        data-tauri-drag-region
        className="flex items-center px-4 py-3 border-b border-white/[0.06] gap-3 cursor-move bg-white/[0.01]"
      >
        <Search className="w-4 h-4 text-neutral-400 shrink-0 stroke-[2.2]" />

        {/* Active Mode Pill Indicator if in Clipboard, Ports or Store */}
        {currentMode === "clipboard" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium shrink-0 animate-in fade-in">
            <ClipboardIcon className="w-3 h-3 text-blue-400" />
            <span>Clipboard</span>
            <button
              onClick={() => {
                setActiveTab("all");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="hover:text-white ml-0.5 cursor-pointer"
              title="Return to Search (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {currentMode === "ports" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium shrink-0 animate-in fade-in">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>Ports</span>
            <button
              onClick={() => {
                setActiveTab("all");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="hover:text-white ml-0.5 cursor-pointer"
              title="Return to Search (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {currentMode === "store" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-medium shrink-0 animate-in fade-in">
            <ShoppingBag className="w-3 h-3 text-purple-400" />
            <span>Store</span>
            <button
              onClick={() => {
                setActiveTab("all");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="hover:text-white ml-0.5 cursor-pointer"
              title="Return to Search (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          placeholder={
            currentMode === "ports"
              ? "Filter port (e.g. 3000) or process name..."
              : currentMode === "clipboard"
              ? "Filter clipboard history..."
              : currentMode === "store"
              ? "Search extensions, keywords (e.g. :dns, :wifi), or authors..."
              : "Search apps, files, calculate, or type :store, :port..."
          }
          className="w-full bg-transparent text-[14.5px] font-medium text-white placeholder-neutral-500 outline-none border-none tracking-tight font-sans cursor-text"
        />

        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSelectedIndex(0);
              inputRef.current?.focus();
            }}
            className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-400 hover:text-white transition shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Clean Menu Action Button */}
        <button
          onClick={onOpenMenu}
          title="Raycast Menu & Settings (Ctrl+K)"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/[0.08] text-xs font-medium text-neutral-400 hover:text-white transition cursor-pointer shrink-0"
        >
          <span>Menu</span>
          <kbd className="text-[10px] font-mono bg-white/[0.06] border border-white/[0.08] px-1 rounded text-neutral-400">
            Ctrl K
          </kbd>
        </button>

        {/* Minimalist Dismiss Button */}
        <button
          onClick={onDismiss}
          title="Dismiss / Hide (Esc)"
          className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-500 hover:text-neutral-200 transition shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status Toast Banner if Action Occurred */}
      {portStatusMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
          <span className="flex items-center gap-2 font-mono">
            <Skull className="w-3.5 h-3.5 text-emerald-400" />
            {portStatusMsg}
          </span>
          <button onClick={() => setPortStatusMsg(null)}>
            <X className="w-3 h-3 text-emerald-400" />
          </button>
        </div>
      )}

      {copiedNotification && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-blue-300 animate-in fade-in">
          <span className="flex items-center gap-2 font-medium">
            <Check className="w-3.5 h-3.5 text-blue-400" />
            {copiedNotification}
          </span>
          <button onClick={() => setCopiedNotification(null)}>
            <X className="w-3 h-3 text-blue-400" />
          </button>
        </div>
      )}
    </>
  );
}
