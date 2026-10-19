import type { CalcResult } from "./lib/calc";
import type { QuickJumpResult } from "./lib/quickjumps";
import type { SnippetMatch } from "./lib/snippets";

export interface ShellResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
}

export interface TerminalCardData {
  command: string;
  result: ShellResult | null;
  isRunning: boolean;
}

export interface GameItem {
  id: string;
  title: string;
  platform: string;
  install_path: string;
  executable_path: string | null;
  launch_uri: string;
  banner_url: string | null;
  size_gb: number | null;
}

export type SpecialCard =
  | { kind: "calc"; data: CalcResult }
  | { kind: "quickjump"; data: QuickJumpResult }
  | { kind: "snippet"; data: SnippetMatch }
  | { kind: "terminal"; data: TerminalCardData };

export interface DriveIndexStats {
  search_all_drives: boolean;
  total_drives: number;
  drives: string[];
  indexed_count: number;
  is_indexing: boolean;
}

export type Mode = "all" | "clipboard" | "ports";

export interface Item {
  id: string;
  title: string;
  subtitle: string;
  category: "Application" | "File" | "Folder" | "Command" | "Setting" | "Snippet" | "Window Management" | "Game" | "Theme";
  iconType: "app" | "file" | "folder" | "cmd" | "setting" | "snippet" | "window-snap" | "game" | "theme";
  iconData?: string;
  path: string;
  size?: string;
  updated?: string;
  bannerUrl?: string;
  platform?: string;
}

export interface PortItem {
  port: number;
  pid: number;
  process_name: string;
  state: string;
}

export interface ClipboardHistoryItem {
  id: string;
  content: string;
  preview: string;
  content_type: string;
  timestamp: string;
  char_count: number;
  line_count: number;
}

export interface GitInfo {
  is_repo: boolean;
  branch?: string;
  modified_count: number;
  untracked_count: number;
  last_commit_message?: string;
}

export interface FilePreview {
  is_text: boolean;
  content?: string;
  extension: string;
  size_bytes: number;
}

export interface ActionItem {
  id: string;
  title: string;
  section: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}
