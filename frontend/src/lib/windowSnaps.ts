export interface WindowSnapCommand {
  id: string;
  title: string;
  subtitle: string;
  position: string;
  keywords: string[];
  layoutType:
    | "left-half"
    | "right-half"
    | "top-half"
    | "bottom-half"
    | "maximize"
    | "center"
    | "first-third"
    | "center-third"
    | "last-third"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
}

export const WINDOW_SNAP_COMMANDS: WindowSnapCommand[] = [
  {
    id: "snap-left-half",
    title: "Left Half",
    subtitle: "Snap active window to the left 50% of the display",
    position: "left",
    keywords: ["left", "half", "split", "snap", "tile", "west", "50%"],
    layoutType: "left-half"
  },
  {
    id: "snap-right-half",
    title: "Right Half",
    subtitle: "Snap active window to the right 50% of the display",
    position: "right",
    keywords: ["right", "half", "split", "snap", "tile", "east", "50%"],
    layoutType: "right-half"
  },
  {
    id: "snap-maximize",
    title: "Maximize Window",
    subtitle: "Expand active window to full screen work area",
    position: "max",
    keywords: ["max", "maximize", "fullscreen", "full", "expand", "100%"],
    layoutType: "maximize"
  },
  {
    id: "snap-center",
    title: "Center Window",
    subtitle: "Place window in the center of the display (66% size)",
    position: "center",
    keywords: ["center", "middle", "focus", "normal", "restore"],
    layoutType: "center"
  },
  {
    id: "snap-top-half",
    title: "Top Half",
    subtitle: "Snap active window to top 50% of the display",
    position: "top",
    keywords: ["top", "up", "north", "half", "snap"],
    layoutType: "top-half"
  },
  {
    id: "snap-bottom-half",
    title: "Bottom Half",
    subtitle: "Snap active window to bottom 50% of the display",
    position: "bottom",
    keywords: ["bottom", "down", "south", "half", "snap"],
    layoutType: "bottom-half"
  },
  {
    id: "snap-first-third",
    title: "First Third (Left 1/3)",
    subtitle: "Tile window to the leftmost 33% of the display",
    position: "first-third",
    keywords: ["third", "left third", "first third", "33%"],
    layoutType: "first-third"
  },
  {
    id: "snap-center-third",
    title: "Center Third (Middle 1/3)",
    subtitle: "Tile window to the middle 33% of the display",
    position: "center-third",
    keywords: ["third", "center third", "middle third", "33%"],
    layoutType: "center-third"
  },
  {
    id: "snap-last-third",
    title: "Last Third (Right 1/3)",
    subtitle: "Tile window to the rightmost 33% of the display",
    position: "last-third",
    keywords: ["third", "right third", "last third", "33%"],
    layoutType: "last-third"
  },
  {
    id: "snap-top-left",
    title: "Top Left Quarter",
    subtitle: "Snap window to top-left 25% quadrant",
    position: "top-left",
    keywords: ["top left", "quarter", "quadrant", "25%"],
    layoutType: "top-left"
  },
  {
    id: "snap-top-right",
    title: "Top Right Quarter",
    subtitle: "Snap window to top-right 25% quadrant",
    position: "top-right",
    keywords: ["top right", "quarter", "quadrant", "25%"],
    layoutType: "top-right"
  },
  {
    id: "snap-bottom-left",
    title: "Bottom Left Quarter",
    subtitle: "Snap window to bottom-left 25% quadrant",
    position: "bottom-left",
    keywords: ["bottom left", "quarter", "quadrant", "25%"],
    layoutType: "bottom-left"
  },
  {
    id: "snap-bottom-right",
    title: "Bottom Right Quarter",
    subtitle: "Snap window to bottom-right 25% quadrant",
    position: "bottom-right",
    keywords: ["bottom right", "quarter", "quadrant", "25%"],
    layoutType: "bottom-right"
  }
];

export function searchWindowSnaps(query: string): WindowSnapCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Match if query is "snap", "tile", "window", "win", or matches any specific keywords
  return WINDOW_SNAP_COMMANDS.filter((cmd) => {
    if (cmd.title.toLowerCase().includes(q)) return true;
    if (cmd.position.toLowerCase().includes(q)) return true;
    return cmd.keywords.some((kw) => kw.includes(q) || q.includes(kw));
  });
}
