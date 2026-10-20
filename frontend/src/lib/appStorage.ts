import { invoke } from "@tauri-apps/api/core";
import type { Item, PortItem, ClipboardHistoryItem } from "../types";

export async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, any>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[Tauri] ${cmd} call error:`, err);
    return null;
  }
}

export const APP_CACHE_KEY = "raycast_app_cache_v2";
export const FREQ_CACHE_KEY = "raycast_item_frequency_v1";

export function saveCachedApps(apps: Item[]): void {
  try {
    if (Array.isArray(apps) && apps.length > 0) {
      localStorage.setItem(APP_CACHE_KEY, JSON.stringify(apps.slice(0, 25)));
    }
  } catch (_) {}
}

export interface FrecencyRecord {
  count: number;
  lastUsed: number; // Unix epoch ms
}

export const FRECENCY_CACHE_KEY = "altspace_frecency_v2";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function calculateFrecencyScore(record?: FrecencyRecord | number, now = Date.now()): number {
  if (!record) return 0;
  if (typeof record === "number") {
    return record * 0.25; // Legacy raw count migration
  }
  const age = Math.max(0, now - record.lastUsed);
  const decay = Math.pow(0.5, age / SEVEN_DAYS_MS);
  // Recency bonus: items used within 4 hours get a direct priority boost
  const recencyBonus = age < 4 * 60 * 60 * 1000 ? 2.5 : 0;
  return record.count * decay + recencyBonus;
}

// In-memory cache for SQLite-computed frecency scores
let sqliteScoresCache: Record<string, number> | null = null;
let legacyMigrated = false;

export async function syncFrecencyFromDb(): Promise<Record<string, number>> {
  if (!legacyMigrated) {
    legacyMigrated = true;
    try {
      const raw = localStorage.getItem(FRECENCY_CACHE_KEY);
      if (raw) {
        const records: Record<string, FrecencyRecord | number> = JSON.parse(raw);
        const legacyEntries: [string, number][] = Object.entries(records).map(([k, v]) => [
          k,
          typeof v === "number" ? v : (v.count || 1),
        ]);
        if (legacyEntries.length > 0) {
          await tauriInvoke("import_legacy_frecency", { data: legacyEntries });
        }
      }
    } catch (_) {}
  }

  const entries = await tauriInvoke<Array<{ item_id: string; score: number }>>("get_frecency_scores");
  if (entries && Array.isArray(entries)) {
    const map: Record<string, number> = {};
    for (const entry of entries) {
      map[entry.item_id] = entry.score;
    }
    sqliteScoresCache = map;
    return map;
  }
  return getItemFrequencies();
}

// Auto-prime SQLite frecency cache on startup
if (typeof window !== "undefined") {
  syncFrecencyFromDb().catch(() => {});
}

export function recordItemUsage(idOrPath: string): void {
  // 1. Synchronous update for instant localStorage fallback
  try {
    const raw = localStorage.getItem(FRECENCY_CACHE_KEY);
    const records: Record<string, FrecencyRecord> = raw ? JSON.parse(raw) : {};
    const existing = records[idOrPath];
    records[idOrPath] = {
      count: (existing?.count || 0) + 1,
      lastUsed: Date.now(),
    };
    localStorage.setItem(FRECENCY_CACHE_KEY, JSON.stringify(records));
  } catch (_) {}

  // 2. Synchronous in-memory update for instant UI feedback
  if (sqliteScoresCache) {
    sqliteScoresCache[idOrPath] = (sqliteScoresCache[idOrPath] || 0) + 1;
  }

  // 3. Persist asynchronously to Rust SQLite frecency database
  tauriInvoke("record_frecency_usage", { itemId: idOrPath }).catch(() => {});
}

export function getItemFrequencies(): Record<string, number> {
  if (sqliteScoresCache && Object.keys(sqliteScoresCache).length > 0) {
    return sqliteScoresCache;
  }
  try {
    const raw = localStorage.getItem(FRECENCY_CACHE_KEY);
    if (!raw) return {};
    const records: Record<string, FrecencyRecord> = JSON.parse(raw);
    const now = Date.now();
    const scores: Record<string, number> = {};
    for (const [key, record] of Object.entries(records)) {
      scores[key] = calculateFrecencyScore(record, now);
    }
    return scores;
  } catch (_) {
    return {};
  }
}

export function sortByFrequency(list: Item[]): Item[] {
  const scores = getItemFrequencies();
  return [...list].sort((a, b) => {
    const scoreA = scores[a.path] ?? scores[a.id] ?? 0;
    const scoreB = scores[b.path] ?? scores[b.id] ?? 0;
    return scoreB - scoreA;
  });
}

export const DEFAULT_APPS: Item[] = [];

export function getCachedOrInitialApps(): Item[] {
  try {
    const raw = localStorage.getItem(APP_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortByFrequency(parsed);
      }
    }
  } catch (_) {}
  return sortByFrequency(DEFAULT_APPS);
}

export const DEMO_PORTS: PortItem[] = [
  { port: 3000, pid: 14208, process_name: "node.exe", state: "LISTENING" },
  { port: 5173, pid: 8940, process_name: "vite.exe", state: "LISTENING" },
  { port: 8080, pid: 21304, process_name: "java.exe", state: "LISTENING" },
  { port: 5432, pid: 4912, process_name: "postgres.exe", state: "LISTENING" }
];

export const DEMO_CLIPBOARD: ClipboardHistoryItem[] = [
  {
    id: "clip-1",
    content: "const fetchUser = async (id: string) => {\n  const res = await api.get(`/users/${id}`);\n  return res.data;\n};",
    preview: "const fetchUser = async (id: string) => { ...",
    content_type: "code",
    timestamp: "11:42 PM",
    char_count: 88,
    line_count: 4
  },
  {
    id: "clip-2",
    content: "#3B82F6",
    preview: "#3B82F6",
    content_type: "color",
    timestamp: "11:39 PM",
    char_count: 7,
    line_count: 1
  },
  {
    id: "clip-3",
    content: "https://linear.app/features/command-palette",
    preview: "https://linear.app/features/command-palette",
    content_type: "url",
    timestamp: "11:35 PM",
    char_count: 43,
    line_count: 1
  }
];

export const UTILITY_ITEMS: Item[] = [
  {
    id: "util-clipboard",
    title: "Clipboard History",
    subtitle: "Search, preview, and restore copied items and snippets",
    category: "Command",
    iconType: "cmd",
    path: "raycast://clipboard",
  },
  {
    id: "util-ports",
    title: "Port Killer & Dev Inspector",
    subtitle: "Inspect localhost processes (:3000, :5173, :8080) and free ports",
    category: "Command",
    iconType: "cmd",
    path: "raycast://ports",
  },
  {
    id: "util-drives",
    title: "Hard Disks & Multi-Drive Settings",
    subtitle: "Manage index across drives C:, D:, E:, F: and external volumes",
    category: "Command",
    iconType: "cmd",
    path: "raycast://drives",
  },
  {
    id: "util-feedback",
    title: "Send Feedback & Rate AltSpace",
    subtitle: "Submit a 1-5 star rating, feature idea, or bug report",
    category: "Command",
    iconType: "cmd",
    path: "altspace://feedback",
  },
  {
    id: "util-contribute",
    title: "Contribute to AltSpace",
    subtitle: "Explore good first issues, propose plugins, or view the architecture guide",
    category: "Command",
    iconType: "cmd",
    path: "altspace://contribute",
  },
  {
    id: "util-community",
    title: "Star on GitHub & Discussions",
    subtitle: "View the open-source repository (codecheesee/altspace) and star the project",
    category: "Command",
    iconType: "cmd",
    path: "altspace://community",
  },
];
