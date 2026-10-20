import React from "react";

interface ResultSectionProps {
  title: string;
  badge?: string;
  count?: number;
  children: React.ReactNode;
}

export function ResultSection({ title, badge, count, children }: ResultSectionProps) {
  return (
    <div className="space-y-1 pt-1.5 first:pt-0" role="group" aria-label={title}>
      <div className="px-2.5 py-1 flex items-center justify-between text-[11px] uppercase font-semibold tracking-wider text-zinc-400 select-none">
        <span className="flex items-center gap-1.5">
          <span>{title}</span>
          {typeof count === "number" && (
            <span className="text-[10px] font-mono text-zinc-500 lowercase">
              ({count})
            </span>
          )}
        </span>
        {badge && (
          <span className="text-[10px] text-zinc-500 font-medium tracking-normal lowercase">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}
