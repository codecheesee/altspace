import { Play, Zap, Video, FolderOpen, Terminal, Gamepad2, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import type { GameCardData } from "../types";

interface GameHeroCardProps {
  game: GameCardData;
  isSelected: boolean;
  onLaunch: (uri: string) => void;
  onLaunchBoosted?: (uri: string) => void;
  onLaunchRecord?: (uri: string) => void;
  onOpenFolder: (path: string) => void;
}

export function GameHeroCard({
  game,
  isSelected,
  onLaunch,
  onLaunchBoosted,
  onLaunchRecord,
  onOpenFolder,
}: GameHeroCardProps) {
  const accentColor = game.accent_color || "#22c55e"; // GTA green default

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={clsx(
        "relative mx-3 my-2.5 rounded-2xl overflow-hidden border transition-all duration-200 shadow-2xl group",
        isSelected
          ? "border-emerald-500/80 ring-2 ring-emerald-500/30 bg-zinc-950/90 shadow-emerald-950/40"
          : "border-white/[0.12] hover:border-white/[0.22] bg-zinc-950/80"
      )}
    >
      {/* Background Hero Banner with High-Contrast Vignette Gradient */}
      {game.banner_url ? (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={game.banner_url}
            alt={game.title}
            className="w-full h-full object-cover object-center opacity-50 filter contrast-115 transform scale-105 group-hover:scale-100 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/60 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-gradient-to-br from-emerald-900/40 via-transparent to-transparent" />
      )}

      {/* Foreground Content */}
      <div className="relative z-10 p-4 sm:p-5 flex flex-col gap-3.5">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Game Badge / Iconic Roman Numeral */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl tracking-tighter shrink-0 shadow-lg border border-white/20 select-none font-serif"
              style={{
                backgroundColor: `${accentColor}30`,
                color: accentColor,
                borderColor: `${accentColor}80`,
                boxShadow: `0 0 16px ${accentColor}40`,
              }}
            >
              {game.badge_text || <Gamepad2 className="w-6 h-6" />}
            </div>

            {/* Title & Metadata */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate drop-shadow-sm">
                  {game.title}
                </h3>
                {game.is_installed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Installed
                  </span>
                )}
                {game.release_year && (
                  <span className="text-xs text-zinc-400 font-mono">
                    {game.release_year}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 mt-0.5 truncate flex items-center gap-2">
                <span>{game.subtitle}</span>
              </p>
            </div>
          </div>

          {/* Quick Keyboard Hint */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-[11px] text-zinc-400">
            <span>Play</span>
            <kbd className="kbd-cap">↵ Enter</kbd>
          </div>
        </div>

        {/* Primary Interactive Action Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.08]">
          {/* 1. Play Now Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLaunch(game.launch_uri);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 4px 14px ${accentColor}40`,
            }}
            title="Launch Game (Enter)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Now</span>
          </button>

          {/* 2. Game Boost Mode */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onLaunchBoosted) onLaunchBoosted(game.launch_uri);
              else onLaunch(game.launch_uri);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/25 transition cursor-pointer active:scale-95 shrink-0"
            title="Launch with High CPU Priority & Memory Optimization"
          >
            <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
            <span>Game Boost</span>
          </button>

          {/* 3. Record Mode */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onLaunchRecord) onLaunchRecord(game.launch_uri);
              else onLaunch(game.launch_uri);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/25 transition cursor-pointer active:scale-95 shrink-0"
            title="Launch with Xbox Game Bar / Instant Replay Recording"
          >
            <Video className="w-3.5 h-3.5 text-amber-400" />
            <span>Record</span>
          </button>

          {/* 4. Open Installation Folder */}
          {game.install_path && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFolder(game.install_path);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-zinc-800/80 border border-zinc-700/80 hover:border-zinc-500 hover:text-white transition cursor-pointer active:scale-95 shrink-0"
              title={`Open Installation Folder (${game.install_path})`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>Folder</span>
            </button>
          )}

          {/* 5. Direct Executable (e.g. GTA5.exe) */}
          {game.executable_path && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLaunch(game.executable_path!);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-sky-300 bg-sky-500/15 border border-sky-500/30 hover:border-sky-400 transition cursor-pointer active:scale-95 shrink-0 font-mono"
              title={`Launch Direct Executable (${game.executable_path})`}
            >
              <Terminal className="w-3 h-3 text-sky-400" />
              <span>{game.executable_path.split("\\").pop() || "Direct EXE"}</span>
            </button>
          )}
        </div>

        {/* Bottom subtle path indicator */}
        {game.install_path && (
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono truncate pt-1">
            <span className="truncate" title={game.install_path}>
              Path: {game.install_path}
            </span>
            {game.size_gb && <span className="shrink-0">{game.size_gb} GB</span>}
          </div>
        )}
      </div>
    </div>
  );
}
