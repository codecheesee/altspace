import {
  Search,
  ChevronRight,
  Code,
  Package,
  Layers,
  Play,
  BookOpen,
  Globe,
  AlignLeft,
  KeyRound,
  Braces,
  Sparkles,
  Clock,
  Fingerprint,
  Binary,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ErrorBoundary } from "./ErrorBoundary";
import { ResultSection } from "./search/ResultSection";
import { ResultRow } from "./search/ResultRow";
import { ResultPreview } from "./search/ResultPreview";
import { SearchEmptyState } from "./search/SearchEmptyState";
import type { Item, SpecialCard, GitInfo, ShellResult } from "../types";

interface SearchTabProps {
  query: string;
  setQuery: (q: string) => void;
  specialCard: SpecialCard | null;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  selectedSpecial: SpecialCard | null;
  selectedItem: Item | null;
  items: Item[];
  frequentApps: Item[];
  recentWorkspaces: Item[];
  isSidebarVisible: boolean;
  terminalRunning: boolean;
  terminalResult: ShellResult | null;
  gitInfo: GitInfo | null;
  currentThemeId: string;
  onCopyClipboard: (content: string) => void;
  onCopiedNotification: (msg: string) => void;
  onItemAction: (item: Item) => void;
  onExecuteTerminalCommand: (cmd: string) => void;
  onLaunchTerminalWindow: (cmd: string) => void;
  onOpenUrl: (url: string) => void;
  onOpenFolder: (path: string) => void;
  onLaunchGame: (uri: string) => void;
  onSelectTheme: (themeId: string) => void;
  onSnapWindow: (snapPosition: string) => void;
  onOpenQuickLook: () => void;
}

export function SearchTab({
  query,
  setQuery,
  specialCard,
  selectedIndex,
  setSelectedIndex,
  selectedSpecial,
  selectedItem,
  items,
  frequentApps,
  recentWorkspaces,
  isSidebarVisible,
  terminalRunning,
  terminalResult,
  gitInfo,
  currentThemeId,
  onCopyClipboard,
  onCopiedNotification,
  onItemAction,
  onExecuteTerminalCommand,
  onLaunchTerminalWindow,
  onOpenUrl,
  onOpenFolder,
  onLaunchGame,
  onSelectTheme,
  onSnapWindow,
  onOpenQuickLook,
}: SearchTabProps) {
  const isSpecialSelected = selectedIndex === 0;

  // Screen-reader announcement text
  const screenReaderAnnouncement = query.trim()
    ? `${items.length + (specialCard ? 1 : 0)} results available for query ${query}`
    : `${frequentApps.length + recentWorkspaces.length} suggested items ready`;

  return (
    <ErrorBoundary label="Search Panel">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {screenReaderAnnouncement}
      </div>

      {/* Left Pane: Primary Results List */}
      <div
        id="search-results-list"
        role="listbox"
        aria-label="Search results and applications"
        className="flex-1 overflow-y-auto p-2 space-y-1.5 focus:outline-none"
      >
        {/* Special Cards at index 0 */}
        {specialCard && specialCard.kind === "transform" && (
          <div
            key="transform-result"
            role="option"
            id="result-option-0"
            aria-selected={isSpecialSelected}
            data-index={0}
            onClick={() => setSelectedIndex(0)}
            onDoubleClick={() => {
              onCopyClipboard(specialCard.data.output);
              onCopiedNotification(`Copied ${specialCard.data.title}!`);
              setQuery("");
            }}
            className={cn(
              "min-h-[58px] flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-sm select-none relative group transition-all duration-150 border",
              isSpecialSelected
                ? "bg-gradient-to-r from-purple-950/40 via-zinc-900/60 to-zinc-900/80 text-white shadow-[0_0_25px_-5px_rgba(168,85,247,0.25)] border-purple-500/40 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-purple-400 before:to-pink-500"
                : "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100 border-white/[0.06] bg-black/20"
            )}
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105",
                  specialCard.data.kind === "jwt"
                    ? "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                    : specialCard.data.kind === "json" || specialCard.data.kind === "yaml"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                    : specialCard.data.kind === "regex"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                )}
              >
                {specialCard.data.kind === "jwt" && <KeyRound className="w-4 h-4" />}
                {(specialCard.data.kind === "json" || specialCard.data.kind === "yaml") && <Braces className="w-4 h-4" />}
                {specialCard.data.kind === "regex" && <Sparkles className="w-4 h-4" />}
                {specialCard.data.kind === "hash" && <Fingerprint className="w-4 h-4" />}
                {specialCard.data.kind === "encoding" && <Binary className="w-4 h-4" />}
                {(specialCard.data.kind === "uuid" || specialCard.data.kind === "time") && <Clock className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[13.5px] truncate tracking-tight text-white font-mono">
                    {specialCard.data.title}
                  </span>
                  {specialCard.data.meta?.expiresIn && (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-medium flex items-center gap-1 border shrink-0",
                        specialCard.data.meta.isExpired
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          specialCard.data.meta.isExpired ? "bg-rose-400" : "bg-emerald-400 animate-pulse"
                        )}
                      />
                      {specialCard.data.meta.expiresIn}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-zinc-400 truncate font-mono mt-0.5 max-w-[420px]">
                  {specialCard.data.output.replace(/\n\s*/g, " ").slice(0, 80)}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border font-mono bg-white/[0.05] text-zinc-300 border-white/[0.08] shadow-sm">
                {specialCard.data.badge}
              </span>
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isSpecialSelected ? "text-purple-400 translate-x-0.5" : "text-transparent"
                )}
              />
            </div>
          </div>
        )}

        {specialCard && specialCard.kind === "calc" && (
          <div
            key="calc-result"
            role="option"
            id="result-option-0"
            aria-selected={isSpecialSelected}
            data-index={0}
            onClick={() => setSelectedIndex(0)}
            onDoubleClick={() => {
              onCopyClipboard(specialCard.data.result);
              onCopiedNotification("Result copied to clipboard!");
              setQuery("");
            }}
            className={cn(
              "min-h-[56px] flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm select-none relative group transition-colors duration-100",
              isSpecialSelected
                ? "bg-white/[0.08] text-white shadow-sm border border-sky-400/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-sky-400"
                : "text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 border border-transparent"
            )}
          >
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-sky-500/10 text-sky-400 border-sky-500/25 font-mono text-sm font-bold">
                =
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[15px] truncate tracking-tight text-white font-mono">
                  {specialCard.data.result}
                </div>
                <div className="text-[11.5px] text-zinc-400 truncate font-mono">
                  = {specialCard.data.expression}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                  isSpecialSelected
                    ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                    : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
                )}
              >
                {specialCard.data.type}
              </span>
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isSpecialSelected ? "text-sky-400 translate-x-0.5" : "text-transparent"
                )}
              />
            </div>
          </div>
        )}

        {specialCard && specialCard.kind === "quickjump" && (
          <div
            key="quickjump-result"
            role="option"
            id="result-option-0"
            aria-selected={isSpecialSelected}
            data-index={0}
            onClick={() => setSelectedIndex(0)}
            onDoubleClick={() => {
              onOpenUrl(specialCard.data.url);
              setQuery("");
            }}
            className={cn(
              "min-h-[56px] flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm select-none relative group transition-colors duration-100",
              isSpecialSelected
                ? "bg-white/[0.08] text-white shadow-sm border border-sky-400/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-sky-400"
                : "text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 border border-transparent"
            )}
          >
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-sky-500/10 text-sky-400 border-sky-500/25">
                {specialCard.data.iconType === "github" && <Code className="w-4 h-4 stroke-[2]" />}
                {specialCard.data.iconType === "npm" && <Package className="w-4 h-4 stroke-[2]" />}
                {specialCard.data.iconType === "so" && <Layers className="w-4 h-4 stroke-[2]" />}
                {specialCard.data.iconType === "youtube" && <Play className="w-4 h-4 fill-current stroke-[1.5]" />}
                {specialCard.data.iconType === "google" && <Search className="w-4 h-4 stroke-[2]" />}
                {specialCard.data.iconType === "wiki" && <BookOpen className="w-4 h-4 stroke-[2]" />}
                {specialCard.data.iconType === "web" && <Globe className="w-4 h-4 stroke-[2]" />}
              </div>

              <div className="min-w-0">
                <div className="font-semibold text-[13.5px] truncate tracking-tight text-white">
                  {specialCard.data.title}
                </div>
                <div className="text-[11px] text-zinc-400 truncate font-mono">
                  {specialCard.data.subtitle}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                  isSpecialSelected
                    ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                    : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
                )}
              >
                {specialCard.data.badge}
              </span>
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isSpecialSelected ? "text-sky-400 translate-x-0.5" : "text-transparent"
                )}
              />
            </div>
          </div>
        )}

        {specialCard && specialCard.kind === "snippet" && (
          <div
            key="snippet-result"
            role="option"
            id="result-option-0"
            aria-selected={isSpecialSelected}
            data-index={0}
            onClick={() => setSelectedIndex(0)}
            onDoubleClick={() => {
              onCopyClipboard(specialCard.data.resolvedContent);
              onCopiedNotification("Snippet copied & ready!");
              setQuery("");
            }}
            className={cn(
              "min-h-[56px] flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm select-none relative group transition-colors duration-100",
              isSpecialSelected
                ? "bg-white/[0.08] text-white shadow-sm border border-emerald-500/30 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-emerald-400"
                : "text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 border border-transparent"
            )}
          >
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                <AlignLeft className="w-4 h-4 stroke-[2]" />
              </div>

              <div className="min-w-0">
                <div className="font-semibold text-[13.5px] truncate tracking-tight text-white">
                  {specialCard.data.snippet.name}
                </div>
                <div className="text-[11px] text-zinc-400 truncate font-mono">
                  {specialCard.data.resolvedContent.slice(0, 55)}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                  isSpecialSelected
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
                )}
              >
                SNIPPET
              </span>
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isSpecialSelected ? "text-emerald-400 translate-x-0.5" : "text-transparent"
                )}
              />
            </div>
          </div>
        )}

        {specialCard && specialCard.kind === "terminal" && (
          <div
            key="terminal-result"
            role="option"
            id="result-option-0"
            aria-selected={isSpecialSelected}
            data-index={0}
            onClick={() => setSelectedIndex(0)}
            onDoubleClick={() => onExecuteTerminalCommand(specialCard.data.command)}
            className={cn(
              "min-h-[56px] flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm select-none relative group transition-colors duration-100",
              isSpecialSelected
                ? "bg-white/[0.08] text-white shadow-sm border border-sky-400/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-sky-400"
                : "text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 border border-transparent"
            )}
          >
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-sky-500/10 text-sky-400 border-sky-500/25 font-mono font-bold text-xs">
                &gt;_
              </div>

              <div className="min-w-0">
                <div className="font-semibold text-[13.5px] truncate tracking-tight text-white flex items-center gap-2">
                  Run: <span className="font-mono text-sky-300 font-normal">{specialCard.data.command}</span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate font-mono">
                  {terminalRunning
                    ? "Executing command in background..."
                    : terminalResult
                    ? `Exit ${terminalResult.exit_code} • ${terminalResult.elapsed_ms}ms • Press Enter to re-run`
                    : "Press ↵ Enter to run, Ctrl+T for external terminal"}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                  isSpecialSelected
                    ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                    : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
                )}
              >
                {terminalRunning ? "RUNNING..." : "TERMINAL"}
              </span>
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isSpecialSelected ? "text-sky-400 translate-x-0.5" : "text-transparent"
                )}
              />
            </div>
          </div>
        )}

        {specialCard && specialCard.kind === "ai" && (
          <div
            key="ai-result"
            role="option"
            id="result-option-0"
            aria-selected={isSpecialSelected}
            data-index={0}
            onClick={() => setSelectedIndex(0)}
            onDoubleClick={() => {
              if (specialCard.data.response) {
                onCopyClipboard(specialCard.data.response);
                onCopiedNotification("AI response copied to clipboard!");
              }
            }}
            className={cn(
              "min-h-[56px] flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm select-none relative group transition-colors duration-100",
              isSpecialSelected
                ? "bg-white/[0.08] text-white shadow-sm border border-purple-500/30 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-purple-400"
                : "text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 border border-transparent"
            )}
          >
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border bg-purple-500/10 text-purple-400 border-purple-500/25 font-bold text-xs">
                AI
              </div>

              <div className="min-w-0">
                <div className="font-semibold text-[13.5px] truncate tracking-tight text-white flex items-center gap-2">
                  Query: {specialCard.data.prompt}
                </div>
                <div className="text-[11px] text-zinc-400 truncate font-mono">
                  {specialCard.data.isLoading ? (
                    <span className="text-sky-300 animate-pulse">Generating response via local Ollama...</span>
                  ) : specialCard.data.error ? (
                    <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                      <span>⚡ Local Ollama is offline</span>
                      <span className="text-zinc-500 font-normal">• See setup guide &rarr;</span>
                    </span>
                  ) : specialCard.data.response ? (
                    <span className="text-zinc-300">{specialCard.data.response.slice(0, 60)}</span>
                  ) : (
                    "Offline inference • Zero cloud data leakage"
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wider font-mono",
                  specialCard.data.error
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : isSpecialSelected
                    ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                    : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
                )}
              >
                {specialCard.data.isLoading
                  ? "STREAMING"
                  : specialCard.data.error
                  ? "OFFLINE"
                  : specialCard.data.model}
              </span>
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isSpecialSelected ? "text-purple-400 translate-x-0.5" : "text-transparent"
                )}
              />
            </div>
          </div>
        )}

        {/* Empty Query: Default Sections */}
        {!query.trim() ? (
          <div className="space-y-3">
            {/* Section 1: Suggested Applications */}
            {frequentApps.length > 0 && (
              <ResultSection title="Suggested Applications" badge="Frequently used" count={frequentApps.length}>
                {frequentApps.map((item, localIdx) => {
                  const effectiveIndex = specialCard ? localIdx + 1 : localIdx;
                  const isSelected = effectiveIndex === selectedIndex;
                  return (
                    <ResultRow
                      key={item.id}
                      item={item}
                      effectiveIndex={effectiveIndex}
                      isSelected={isSelected}
                      query=""
                      reason="Frequently used"
                      onSelect={setSelectedIndex}
                      onAction={onItemAction}
                    />
                  );
                })}
              </ResultSection>
            )}

            {/* Section 2: Recent Workspaces & Hard Disks */}
            {recentWorkspaces.length > 0 && (
              <ResultSection title="Recent Workspaces" badge="User folders" count={recentWorkspaces.length}>
                {recentWorkspaces.map((item, localIdx) => {
                  const globalIdx = frequentApps.length + localIdx;
                  const effectiveIndex = specialCard ? globalIdx + 1 : globalIdx;
                  const isSelected = effectiveIndex === selectedIndex;
                  return (
                    <ResultRow
                      key={item.id}
                      item={item}
                      effectiveIndex={effectiveIndex}
                      isSelected={isSelected}
                      query=""
                      reason="Recent workspace"
                      onSelect={setSelectedIndex}
                      onAction={onItemAction}
                    />
                  );
                })}
              </ResultSection>
            )}

          </div>
        ) : items.length === 0 && !specialCard ? (
          <SearchEmptyState query={query} />
        ) : (
          <ResultSection
            title="Search Results"
            count={items.length}
            badge="Instant multi-drive"
          >
            {items.map((item: Item, index: number) => {
              const effectiveIndex = specialCard ? index + 1 : index;
              const isSelected = effectiveIndex === selectedIndex;
              return (
                <ResultRow
                  key={item.id}
                  item={item}
                  effectiveIndex={effectiveIndex}
                  isSelected={isSelected}
                  query={query}
                  onSelect={setSelectedIndex}
                  onAction={onItemAction}
                />
              );
            })}
          </ResultSection>
        )}
      </div>

      {/* Right Pane: Contextual Inspector / Preview */}
      {(isSidebarVisible || (selectedSpecial && (selectedSpecial.kind === "ai" || selectedSpecial.kind === "plan" || selectedSpecial.kind === "terminal" || selectedSpecial.kind === "transform"))) && (selectedSpecial || selectedItem) && (
        <ResultPreview
          selectedSpecial={selectedSpecial}
          selectedItem={selectedItem}
          currentThemeId={currentThemeId}
          terminalRunning={terminalRunning}
          terminalResult={terminalResult}
          gitInfo={gitInfo}
          setQuery={setQuery}
          onCopyClipboard={onCopyClipboard}
          onCopiedNotification={onCopiedNotification}
          onExecuteTerminalCommand={onExecuteTerminalCommand}
          onLaunchTerminalWindow={onLaunchTerminalWindow}
          onOpenUrl={onOpenUrl}
          onOpenFolder={onOpenFolder}
          onLaunchGame={onLaunchGame}
          onSelectTheme={onSelectTheme}
          onSnapWindow={onSnapWindow}
          onOpenQuickLook={onOpenQuickLook}
        />
      )}
    </ErrorBoundary>
  );
}
