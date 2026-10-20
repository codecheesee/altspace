import { Search } from "lucide-react";

interface SearchEmptyStateProps {
  query: string;
}

export function SearchEmptyState({ query }: SearchEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-150">
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 mb-3.5 shadow-sm">
        <Search className="w-5 h-5 stroke-[1.8]" />
      </div>

      <div className="text-[14px] font-semibold text-zinc-100 tracking-tight mb-1">
        No results for &ldquo;{query}&rdquo;
      </div>
      <p className="text-[12px] text-zinc-400 max-w-sm mb-5 leading-relaxed">
        Try searching by app name, shortcut, or use native desktop operators:
      </p>

      <div className="grid grid-cols-2 gap-2 text-left w-full max-w-md text-[11.5px] font-mono">
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-zinc-300">
          <span>:port / :3000</span>
          <span className="text-[10px] text-zinc-500 font-sans">Inspect Ports</span>
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-zinc-300">
          <span>350 * 12</span>
          <span className="text-[10px] text-zinc-500 font-sans">Instant Math</span>
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-zinc-300">
          <span>:store</span>
          <span className="text-[10px] text-zinc-500 font-sans">Extensions</span>
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-zinc-300">
          <span>? &lt;query&gt;</span>
          <span className="text-[10px] text-zinc-500 font-sans">Local AI</span>
        </div>
      </div>
    </div>
  );
}
