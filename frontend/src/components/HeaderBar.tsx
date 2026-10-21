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
  portStatusMsg,
  setPortStatusMsg,
  copiedNotification,
  setCopiedNotification,
  onOpenMenu,
  onDismiss,
}: HeaderBarProps) {
  return (
    <header className="shrink-0 select-none">
      {/* Specular Highlight Rim */}
      <div className="h-[1px] w-full bg-white/[0.08] shrink-0" />

      {/* Top Drag Region & Omnibar */}
      <div
        data-tauri-drag-region
        className="flex items-center px-4 py-3 border-b border-white/[0.08] gap-3 cursor-move bg-[#131317] select-none shrink-0"
      >
        <Search className="w-4 h-4 text-sky-400 shrink-0 stroke-[2]" />

        {/* Mode Pill Badges */}
        {currentMode === "clipboard" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/80 text-zinc-200 text-xs font-medium shrink-0 animate-in fade-in duration-100">
            <ClipboardIcon className="w-3 h-3 text-sky-400" />
            <span>Clipboard</span>
            <button
              onClick={() => {
                setActiveTab("all");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-zinc-400 hover:text-white ml-0.5 cursor-pointer"
              title="Return to Search (Esc)"
              aria-label="Return to Search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {currentMode === "ports" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/80 text-zinc-200 text-xs font-medium shrink-0 animate-in fade-in duration-100">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>Ports</span>
            <button
              onClick={() => {
                setActiveTab("all");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-zinc-400 hover:text-white ml-0.5 cursor-pointer"
              title="Return to Search (Esc)"
              aria-label="Return to Search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {currentMode === "store" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/80 text-zinc-200 text-xs font-medium shrink-0 animate-in fade-in duration-100">
            <ShoppingBag className="w-3 h-3 text-amber-400" />
            <span>Store</span>
            <button
              onClick={() => {
                setActiveTab("all");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-zinc-400 hover:text-white ml-0.5 cursor-pointer"
              title="Return to Search (Esc)"
              aria-label="Return to Search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          autoFocus={true}
          value={query}
          role="combobox"
          aria-expanded={true}
          aria-autocomplete="list"
          aria-controls="search-results-list"
          aria-label="Search apps, files, commands, and ports"
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
              : "Search apps, files, calculate, or type :store, :ports..."
          }
          className="w-full bg-transparent text-[14px] font-normal text-zinc-100 placeholder-zinc-500 outline-none border-none tracking-tight font-sans cursor-text"
        />

        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSelectedIndex(0);
              inputRef.current?.focus();
            }}
            className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition shrink-0 cursor-pointer"
            title="Clear query"
            aria-label="Clear query"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Command Menu Action Button */}
        <button
          onClick={onOpenMenu}
          title="Command Palette Menu (Ctrl+K)"
          aria-label="Command Palette Menu"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/[0.06] text-xs font-medium text-zinc-400 hover:text-zinc-100 transition cursor-pointer shrink-0"
        >
          <span>Menu</span>
          <kbd className="kbd-cap">Ctrl K</kbd>
        </button>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          title="Dismiss (Esc)"
          aria-label="Dismiss Command Palette"
          className="p-1 rounded hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-200 transition shrink-0 cursor-pointer"
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
          <button onClick={() => setPortStatusMsg(null)} className="cursor-pointer" aria-label="Dismiss notification">
            <X className="w-3 h-3 text-emerald-400" />
          </button>
        </div>
      )}

      {copiedNotification && (
        <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-sky-300 animate-in fade-in">
          <span className="flex items-center gap-2 font-medium">
            <Check className="w-3.5 h-3.5 text-sky-400" />
            {copiedNotification}
          </span>
          <button onClick={() => setCopiedNotification(null)} className="cursor-pointer" aria-label="Dismiss notification">
            <X className="w-3 h-3 text-sky-400" />
          </button>
        </div>
      )}
    </header>
  );
}
