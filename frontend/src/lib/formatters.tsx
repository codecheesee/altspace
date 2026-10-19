import React from "react";
import type { Item } from "../types";

export function renderHighlightedText(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const subIdx = lowerText.indexOf(q);
  if (subIdx !== -1) {
    return (
      <>
        {text.slice(0, subIdx)}
        <span className="text-amber-400 font-semibold bg-amber-400/20 px-0.5 rounded">
          {text.slice(subIdx, subIdx + q.length)}
        </span>
        {text.slice(subIdx + q.length)}
      </>
    );
  }

  // Fast path for long path strings to prevent DOM highlight thrashing
  if (text.length > 50 || q.length > 15) return text;

  const chars: React.ReactNode[] = [];
  let qIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (qIdx < q.length && char.toLowerCase() === q[qIdx]) {
      chars.push(
        <span key={i} className="text-amber-400 font-semibold bg-amber-400/20 px-0.5 rounded">
          {char}
        </span>
      );
      qIdx++;
    } else {
      chars.push(char);
    }
  }
  return chars;
}

export function formatDisplayPath(path: string): string {
  if (!path) return "";
  const lower = path.toLowerCase();
  if (lower.includes("start menu\\programs\\")) {
    const parts = path.split(/start menu\\programs\\/i);
    if (parts.length > 1) {
      return "Start Menu > " + parts[1].replace(/\.lnk$/i, "");
    }
  }
  if (lower.includes("appdata\\local\\programs\\")) {
    const parts = path.split(/appdata\\local\\programs\\/i);
    if (parts.length > 1) {
      return "Local > " + parts[1];
    }
  }
  if (lower.includes("program files\\")) {
    const parts = path.split(/program files\\/i);
    if (parts.length > 1) {
      return "Program Files > " + parts[1];
    }
  }
  const driveMatch = path.match(/^([A-Za-z]:)/);
  const drivePrefix = driveMatch ? driveMatch[1].toUpperCase() : "";
  const segments = path.replace(/\//g, "\\").split("\\").filter(Boolean);
  if (segments.length > 3) {
    if (drivePrefix && !segments.slice(-3)[0].toUpperCase().startsWith(drivePrefix)) {
      return `${drivePrefix} > ... > ${segments.slice(-2).join(" > ")}`;
    }
    return segments.slice(-3).join(" > ");
  }
  return path;
}

export function getItemSubtitle(item: Item): string {
  if (item.category === "Window Management") {
    return item.subtitle;
  }
  if (item.category === "Setting") {
    return item.subtitle;
  }
  if (item.category === "Snippet") {
    return item.subtitle;
  }
  if (item.category === "Game") {
    return item.subtitle;
  }
  if (item.category === "Theme") {
    return item.subtitle;
  }
  if (item.category === "Folder") {
    return formatDisplayPath(item.path);
  }
  return formatDisplayPath(item.subtitle || item.path);
}

export function getDriveOrigin(path: string): string {
  const match = path.match(/^([A-Za-z]):/);
  if (!match) return "Local Storage";
  const letter = match[1].toUpperCase();
  if (letter === "C") return "Drive C: (System SSD)";
  if (letter === "D") return "Drive D: (Storage)";
  if (letter === "E") return "Drive E: (Storage)";
  if (letter === "F") return "Drive F: (Extra Volume)";
  return `Drive ${letter}: (Removable)`;
}
