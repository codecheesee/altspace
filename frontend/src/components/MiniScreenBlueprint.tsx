import { cn } from "../lib/utils";

export function MiniScreenBlueprint({
  layoutType,
  className,
}: {
  layoutType: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-7 h-5 rounded-[4px] border border-white/20 bg-black/40 p-[1.5px] flex shrink-0 relative overflow-hidden shadow-sm",
        className
      )}
    >
      {layoutType === "left-half" && (
        <div className="w-1/2 h-full bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "right-half" && (
        <div className="w-1/2 h-full ml-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "top-half" && (
        <div className="w-full h-1/2 bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "bottom-half" && (
        <div className="w-full h-1/2 mt-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "maximize" && (
        <div className="w-full h-full bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "center" && (
        <div className="w-2/3 h-2/3 m-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "first-third" && (
        <div className="w-1/3 h-full bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "center-third" && (
        <div className="w-1/3 h-full mx-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "last-third" && (
        <div className="w-1/3 h-full ml-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "top-left" && (
        <div className="w-1/2 h-1/2 bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "top-right" && (
        <div className="w-1/2 h-1/2 ml-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "bottom-left" && (
        <div className="w-1/2 h-1/2 mt-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
      {layoutType === "bottom-right" && (
        <div className="w-1/2 h-1/2 ml-auto mt-auto bg-blue-500/80 rounded-[2px] shadow-sm animate-in fade-in" />
      )}
    </div>
  );
}
