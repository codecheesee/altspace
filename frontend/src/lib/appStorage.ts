import { invoke } from "@tauri-apps/api/core";
import type { Item } from "../types";

export const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

export async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, any>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[Tauri] ${cmd} call error:`, err);
    return null;
  }
}

export async function invokeStrict<T = unknown>(cmd: string, args?: Record<string, any>): Promise<T> {
  return await invoke<T>(cmd, args);
}

export const APP_CACHE_KEY = "altspace_app_cache_v2";
export const FREQ_CACHE_KEY = "altspace_item_frequency_v1";

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
export const SIDEBAR_PREFERENCE_KEY = "altspace_sidebar_visible_v1";
export const DRIVE_SEARCH_PREFERENCE_KEY = "altspace_search_all_drives_v1";
export const ADVANCED_SEARCH_QUOTA_KEY = "altspace_advanced_search_quota_v1";

import {
  TRIAL_ACTION_LIMIT,
  TRIAL_WARNING_THRESHOLD,
  TRIAL_WINDOW_MS,
  classifyPremiumAction,
  consumePremiumAction,
  makeQuotaState,
  resetExpiredWindow,
} from "./quotaManager.ts";

export const ADVANCED_SEARCH_LIMIT = TRIAL_ACTION_LIMIT; // 100 actions per 30-day window
export const ADVANCED_SEARCH_WARNING_THRESHOLD = TRIAL_WARNING_THRESHOLD; // 80 actions
export const ADVANCED_SEARCH_WINDOW_MS = TRIAL_WINDOW_MS;
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

export function getStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch (_) {
    return fallback;
  }
}

export function saveStoredBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch (_) {}
}

export interface AdvancedSearchQuota {
  windowStartedAt: number;
  used: number;
}

export interface AdvancedSearchQuotaResult extends AdvancedSearchQuota {
  allowed: boolean;
  remaining: number;
  warning: boolean;
}

export function getAdvancedSearchQuota(now = Date.now()): AdvancedSearchQuota {
  try {
    const raw = localStorage.getItem(ADVANCED_SEARCH_QUOTA_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Number.isFinite(parsed.windowStartedAt) && Number.isFinite(parsed.used)) {
      return resetExpiredWindow(makeQuotaState(parsed.windowStartedAt, parsed.used), now);
    }
  } catch (_) {}

  return makeQuotaState(now, 0);
}

export function consumeAdvancedSearch(
  now = Date.now(),
  idempotencyKey?: string,
  role: "free" | "supporter" | "pro" | "contributor" | "maintainer" = "free"
): AdvancedSearchQuotaResult {
  const current = getAdvancedSearchQuota(now);
  const { result, nextState } = consumePremiumAction(role, current, idempotencyKey, now);

  try {
    localStorage.setItem(ADVANCED_SEARCH_QUOTA_KEY, JSON.stringify(nextState));
  } catch (_) {}

  return {
    windowStartedAt: result.windowStartedAt,
    used: result.used,
    allowed: result.allowed,
    remaining: result.remaining,
    warning: result.warning,
  };
}

/**
 * Classifies whether an interaction is a Premium Action (Multi-drive, AI, Shell)
 * Delegates to centralized classification engine in quotaManager.ts.
 */
export function isPremiumSearchQuery(query: string, searchAllDrives = false): boolean {
  return classifyPremiumAction({ query, searchAllDrives });
}
export const UTILITY_ITEMS: Item[] = [
  {
    id: "util-cockpit",
    title: "Docker + WSL2 Environment Cockpit",
    subtitle: "Manage Compose containers, inspect distro status, and reclaim WSL RAM (:docker)",
    category: "Command",
    iconType: "cmd",
    path: ":docker",
  },
  {
    id: "util-features",
    title: "Features & Modules Settings",
    subtitle: "Toggle, configure, and inspect health of AltSpace features (Ctrl+,)",
    category: "Setting",
    iconType: "setting",
    path: "altspace://features",
  },
  {
    id: "util-about",
    title: "About & Account",
    subtitle: "View subscription plan, permissions matrix, hardware machine ID, and sign in",
    category: "Command",
    iconType: "cmd",
    path: "altspace://about",
  },
  {
    id: "util-clipboard",
    title: "Clipboard History",
    subtitle: "Search, preview, and restore copied items and snippets",
    category: "Command",
    iconType: "cmd",
    path: "altspace://clipboard",
  },
  {
    id: "util-ports",
    title: "Port Killer & Dev Inspector",
    subtitle: "Inspect localhost processes (:3000, :5173, :8080) and free ports",
    category: "Command",
    iconType: "cmd",
    path: "altspace://ports",
  },
  {
    id: "util-drives",
    title: "Hard Disks & Multi-Drive Settings",
    subtitle: "Manage index across drives C:, D:, E:, F: and external volumes",
    category: "Command",
    iconType: "cmd",
    path: "altspace://drives",
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
  {
    id: "util-discord",
    title: "Join Discord Developer Community",
    subtitle: "Connect with developers, get AltSpace support, and discuss local systems engineering",
    category: "Command",
    iconType: "cmd",
    path: "altspace://discord",
  },
];
