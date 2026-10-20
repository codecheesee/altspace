/**
 * AltSpace Centralized Trial & Quota Management Engine
 * Single source of truth for the 100-action / 30-day trial policy,
 * role-based gating (Free, Supporter, Pro, Contributor, Maintainer),
 * and zero-cost local search protection.
 */

export type EntitlementRole = "free" | "supporter" | "pro" | "contributor" | "maintainer";

export const TRIAL_ACTION_LIMIT = 100;
export const TRIAL_WARNING_THRESHOLD = 80;
export const TRIAL_WINDOW_DAYS = 30;
export const TRIAL_WINDOW_MS = TRIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface QuotaState {
  windowStartedAt: number;
  used: number;
}

export interface QuotaConsumptionResult {
  allowed: boolean;
  remaining: number;
  warning: boolean;
  blockedReason?: string;
  windowStartedAt: number;
  used: number;
  resetDate: string;
}

export interface ActionClassificationInput {
  query?: string;
  searchAllDrives?: boolean;
  isAiQuery?: boolean;
  isShellQuery?: boolean;
}

// In-memory idempotency tracking for in-flight requests
const processedIdempotencyKeys = new Set<string>();

/**
 * Classifies whether an interaction is a Premium Action
 * ONLY expensive operational features consume quota:
 * - AI requests / streaming prompts (? or ai:)
 * - Shell Command Runner (> or cmd: or sh:)
 * - Deep Multi-Drive Search across non-C: internal/external drives (searchAllDrives = true)
 *
 * All local app launches, file searches, calculator, dev ports, clipboard,
 * settings, snippets, and themes are 100% FREE FOREVER.
 */
export function classifyPremiumAction(input: ActionClassificationInput): boolean {
  if (input.isAiQuery) return true;
  if (input.isShellQuery) return true;

  const rawQuery = input.query || "";
  const qTrim = rawQuery.trim();

  // Empty query or single-character query NEVER consumes quota
  if (!qTrim || qTrim.length < 2) return false;

  // 1. AI Assistant query (? or ai:)
  if (qTrim.startsWith("?") || qTrim.toLowerCase().startsWith("ai:")) {
    return true;
  }

  // 2. Shell Command Runner (> or cmd: or sh:)
  if (
    qTrim.startsWith(">") ||
    qTrim.toLowerCase().startsWith("cmd:") ||
    qTrim.toLowerCase().startsWith("sh:")
  ) {
    return true;
  }

  // 3. Deep Multi-Drive Search across non-C: internal/external drives
  // Only consumes quota when explicitly enabled by user and searching general files (length >= 3)
  if (input.searchAllDrives && !qTrim.startsWith(":") && qTrim.length >= 3) {
    return true;
  }

  // Everything else: app search, calc, port killer, clipboard, themes, settings -> FREE
  return false;
}

/**
 * Checks whether a timestamp falls within the rolling 30-day window
 */
export function isWithinWindow(windowStartedAt: number, now = Date.now()): boolean {
  return Number.isFinite(windowStartedAt) && now - windowStartedAt < TRIAL_WINDOW_MS && now >= windowStartedAt;
}

/**
 * Creates or normalizes a QuotaState object
 */
export function makeQuotaState(windowStartedAt = Date.now(), used = 0): QuotaState {
  return {
    windowStartedAt,
    used: Math.max(0, Math.floor(used)),
  };
}

/**
 * Resets quota if the rolling 30-day window has expired
 */
export function resetExpiredWindow(current: QuotaState, now = Date.now()): QuotaState {
  if (isWithinWindow(current.windowStartedAt, now)) {
    return current;
  }
  return makeQuotaState(now, 0);
}

/**
 * Determines whether a warning notice should be shown (at 80 actions)
 */
export function shouldShowWarning(used: number): boolean {
  return used >= TRIAL_WARNING_THRESHOLD && used < TRIAL_ACTION_LIMIT;
}

/**
 * Checks if a user role has unlimited entitlement access
 */
export function hasUnlimitedAccess(role: EntitlementRole): boolean {
  return role === "maintainer" || role === "pro" || role === "supporter" || role === "contributor";
}

/**
 * Checks if a user is permitted to perform a premium action
 */
export function canUsePremiumAction(
  role: EntitlementRole,
  currentQuota: QuotaState,
  now = Date.now()
): boolean {
  if (hasUnlimitedAccess(role)) return true;
  const activeQuota = resetExpiredWindow(currentQuota, now);
  return activeQuota.used < TRIAL_ACTION_LIMIT;
}

/**
 * Consumes a single premium action under the 100-action / 30-day policy
 * Includes idempotency key protection, deterministic clock injection,
 * and role-based bypass.
 */
export function consumePremiumAction(
  role: EntitlementRole,
  currentQuota: QuotaState,
  idempotencyKey?: string,
  now = Date.now()
): { result: QuotaConsumptionResult; nextState: QuotaState } {
  // 1. Unlimited roles (Maintainer, Pro, Supporter, Contributor) never consume trial quota
  if (hasUnlimitedAccess(role)) {
    return {
      result: {
        allowed: true,
        remaining: Infinity,
        warning: false,
        windowStartedAt: currentQuota.windowStartedAt,
        used: currentQuota.used,
        resetDate: "Unlimited",
      },
      nextState: currentQuota,
    };
  }

  // 2. Idempotency check: duplicate in-flight or repeated request with same key consumes once
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    const activeQuota = resetExpiredWindow(currentQuota, now);
    const resetDate = new Date(activeQuota.windowStartedAt + TRIAL_WINDOW_MS).toLocaleDateString();
    return {
      result: {
        allowed: activeQuota.used <= TRIAL_ACTION_LIMIT,
        remaining: Math.max(0, TRIAL_ACTION_LIMIT - activeQuota.used),
        warning: shouldShowWarning(activeQuota.used),
        windowStartedAt: activeQuota.windowStartedAt,
        used: activeQuota.used,
        resetDate,
      },
      nextState: activeQuota,
    };
  }

  // 3. Normal rolling window evaluation
  const activeQuota = resetExpiredWindow(currentQuota, now);

  if (activeQuota.used >= TRIAL_ACTION_LIMIT) {
    const resetDate = new Date(activeQuota.windowStartedAt + TRIAL_WINDOW_MS).toLocaleDateString();
    return {
      result: {
        allowed: false,
        remaining: 0,
        warning: false,
        blockedReason: `100 advanced actions trial used. Resets on ${resetDate}. Upgrade or contribute to unlock unmetered access.`,
        windowStartedAt: activeQuota.windowStartedAt,
        used: activeQuota.used,
        resetDate,
      },
      nextState: activeQuota,
    };
  }

  // Increment usage count
  const nextUsed = activeQuota.used + 1;
  const nextState: QuotaState = {
    windowStartedAt: activeQuota.windowStartedAt,
    used: nextUsed,
  };

  if (idempotencyKey) {
    processedIdempotencyKeys.add(idempotencyKey);
    // Keep set bounded
    if (processedIdempotencyKeys.size > 200) {
      const iter = processedIdempotencyKeys.values();
      for (let i = 0; i < 50; i++) {
        const val = iter.next().value;
        if (val) processedIdempotencyKeys.delete(val);
      }
    }
  }

  const remaining = Math.max(0, TRIAL_ACTION_LIMIT - nextUsed);
  const resetDate = new Date(activeQuota.windowStartedAt + TRIAL_WINDOW_MS).toLocaleDateString();

  return {
    result: {
      allowed: true,
      remaining,
      warning: shouldShowWarning(nextUsed),
      windowStartedAt: activeQuota.windowStartedAt,
      used: nextUsed,
      resetDate,
    },
    nextState,
  };
}

/**
 * Clears in-memory idempotency cache (useful for deterministic unit tests)
 */
export function resetIdempotencyCache(): void {
  processedIdempotencyKeys.clear();
}
