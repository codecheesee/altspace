import type { CalcResult } from "./lib/calc";
import type { QuickJumpResult } from "./lib/quickjumps";
import type { SnippetMatch } from "./lib/snippets";
import type { TransformResult } from "./lib/developerTransforms";

export type { TransformResult };

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

export interface AICardData {
  prompt: string;
  response: string;
  isLoading: boolean;
  model: string;
  error?: string | null;
}

export interface ActionPlanStep {
  id: string;
  title: string;
  description: string;
  risk_tier: "read_only_auto" | "preview_then_approve" | "always_approve";
  requires_approval: boolean;
  status: "pending" | "running" | "completed" | "failed";
  action: any;
  result_message?: string;
}

export interface ActionPlan {
  id: string;
  title: string;
  summary: string;
  target_context: string;
  steps: ActionPlanStep[];
  provider?: string;
  model?: string;
  is_byok?: boolean;
}

export interface GameCardData {
  id: string;
  title: string;
  subtitle: string;
  platform: string;
  install_path: string;
  executable_path?: string;
  launch_uri: string;
  banner_url?: string;
  cover_url?: string;
  badge_text?: string;
  accent_color?: string;
  genre?: string;
  developer?: string;
  release_year?: number;
  size_gb?: number;
  is_installed: boolean;
}

export type SpecialCard =
  | { kind: "calc"; data: CalcResult }
  | { kind: "quickjump"; data: QuickJumpResult }
  | { kind: "snippet"; data: SnippetMatch }
  | { kind: "terminal"; data: TerminalCardData }
  | { kind: "ai"; data: AICardData }
  | { kind: "transform"; data: TransformResult }
  | { kind: "plan"; data: ActionPlan }
  | { kind: "game"; data: GameCardData };

export interface DriveIndexStats {
  search_all_drives: boolean;
  total_drives: number;
  drives: string[];
  indexed_count: number;
  is_indexing: boolean;
}

export type Mode = "all" | "clipboard" | "ports" | "store";

export interface Item {
  id: string;
  title: string;
  subtitle: string;
  category: "Application" | "File" | "Folder" | "Command" | "Setting" | "Snippet" | "Window Management" | "Game" | "Theme" | "Plugin";
  iconType: "app" | "file" | "folder" | "cmd" | "setting" | "snippet" | "window-snap" | "game" | "theme" | "plugin";
  iconData?: string;
  path: string;
  size?: string;
  updated?: string;
  bannerUrl?: string;
  platform?: string;
}

export interface StorePluginItem {
  id: string;
  name: string;
  description: string;
  keyword: string;
  category: "Dev Tools" | "Productivity" | "System" | "Network" | "Media";
  author: string;
  authorGithub: string;
  sponsorUrl?: string;
  version: string;
  downloads: number;
  rating: number;
  verified?: boolean;
  royaltyPerSale?: number;
  scriptFilename: string;
  scriptContent: string;
  manifestJson: string;
  icon: string;
}

export interface PortItem {
  port: number;
  pid: number;
  process_name: string;
  state: string;
  forensics?: PortProcessForensics;
}

export interface PortProcessForensics {
  port: number;
  pid: number;
  process_name: string;
  parent_pid?: number | null;
  parent_name?: string | null;
  command_line?: string | null;
  executable_path?: string | null;
  project_hint?: string | null;
  is_wsl_or_docker: boolean;
  is_protected: boolean;
}

export interface KillVerifyResult {
  success: boolean;
  port: number;
  pid: number;
  verified_free: boolean;
  elapsed_ms: number;
  message: string;
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
  subtitle?: string;
  section: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
  isToggle?: boolean;
  toggleValue?: boolean;
  badge?: string;
}

export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_name: string;
  release_url: string;
  release_notes: string;
  features: string[];
  fixes: string[];
  download_url?: string | null;
  published_at?: string | null;
}
