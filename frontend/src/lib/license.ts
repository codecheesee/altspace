import { tauriInvoke } from "./appStorage";

/**
 * Entitlement boundary for paid AltSpace features and Maintainer Lifetime Access.
 *
 * The maintainer (@codecheesee) receives permanent lifetime sovereign access.
 * Supporters are verified via GitHub Sponsors or configured entitlement endpoints.
 */

export interface FeatureBounty {
  id: string;
  title: string;
  description: string;
  bountyAmountINR: number;
  status: "Open" | "Claimed" | "Completed";
  assignee?: string;
  githubIssueUrl: string;
}

export const SUPPORTER_PRICE_INR = 299;
export const TREASURY_ALLOCATION_PCT = 20;
export const TREASURY_PER_SALE_INR = Math.round((SUPPORTER_PRICE_INR * TREASURY_ALLOCATION_PCT) / 100);
export const ACTIVE_BOUNTIES: FeatureBounty[] = [];

export interface LicenseStatus {
  isSupporter: boolean;
  tier: "Free" | "Supporter" | "Maintainer";
  isMaintainer?: boolean;
  login?: string;
  provider?: string;
  expiresAt?: string;
  reason?: string;
}

export interface VerifiedEntitlement {
  active: boolean;
  tier: "free" | "supporter" | "maintainer";
  login?: string;
  provider?: string;
  expiresAt?: string;
}

const GITHUB_MAINTAINER_LOGIN = "codecheesee";
const GITHUB_ENTITLEMENT_MANIFEST_URL =
  "https://raw.githubusercontent.com/codecheesee/altspace/main/entitlements.json";

const ENTITLEMENT_ENDPOINT =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ENTITLEMENT_ENDPOINT
    ? String(import.meta.env.VITE_ENTITLEMENT_ENDPOINT)
    : "";

const STORED_GITHUB_USER_KEY = "altspace_github_user_session_v1";

export function isUnlimitedTier(status?: LicenseStatus | null): boolean {
  if (!status) return false;
  return status.tier === "Maintainer" || status.isMaintainer === true;
}

export function getStoredGitHubLogin(): string | null {
  try {
    const raw = localStorage.getItem(STORED_GITHUB_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.login === "string" ? parsed.login.toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

export function saveStoredGitHubLogin(login: string): void {
  try {
    localStorage.setItem(STORED_GITHUB_USER_KEY, JSON.stringify({ login: login.toLowerCase(), savedAt: Date.now() }));
  } catch (_) {}
}

function freeStatus(reason: string): LicenseStatus {
  return { isSupporter: false, tier: "Free", reason };
}

function parseEntitlement(value: unknown): VerifiedEntitlement | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.active !== "boolean") return null;
  if (data.tier !== "free" && data.tier !== "supporter" && data.tier !== "maintainer") return null;
  return {
    active: data.active,
    tier: data.tier,
    login: typeof data.login === "string" ? data.login : undefined,
    provider: typeof data.provider === "string" ? data.provider : undefined,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
  };
}

export function getLicenseStatus(): LicenseStatus {
  // Synchronous initial check: if stored login is maintainer, grant instant Maintainer status
  const storedLogin = getStoredGitHubLogin();
  if (storedLogin === GITHUB_MAINTAINER_LOGIN) {
    return {
      isSupporter: true,
      isMaintainer: true,
      tier: "Maintainer",
      login: GITHUB_MAINTAINER_LOGIN,
      provider: "github-maintainer",
      reason: "Verified Maintainer Sovereign Access (Permanently Unlocked for @codecheesee)",
    };
  }

  return freeStatus(
    ENTITLEMENT_ENDPOINT
      ? "Entitlement verification is available after the provider/backend is deployed."
      : "AltSpace is running in Standard Community Edition."
  );
}

export async function refreshEntitlement(): Promise<LicenseStatus> {
  // 1. Rust backend local repository & environment check for Maintainer Sovereign status
  if (tauriInvoke) {
    try {
      const res = await tauriInvoke<{ is_maintainer: boolean; login: string; reason: string }>(
        "check_maintainer_status"
      );
      if (res && res.is_maintainer) {
        saveStoredGitHubLogin(res.login || GITHUB_MAINTAINER_LOGIN);
        return {
          isSupporter: true,
          isMaintainer: true,
          tier: "Maintainer",
          login: res.login || GITHUB_MAINTAINER_LOGIN,
          provider: "github-maintainer",
          reason: res.reason || "Verified Maintainer Sovereign Access (Permanently Unlocked)",
        };
      }
    } catch (_) {}
  }

  // 2. Check stored GitHub identity
  const storedLogin = getStoredGitHubLogin();
  if (storedLogin === GITHUB_MAINTAINER_LOGIN) {
    return {
      isSupporter: true,
      isMaintainer: true,
      tier: "Maintainer",
      login: GITHUB_MAINTAINER_LOGIN,
      provider: "github-maintainer",
      reason: "Verified Maintainer Sovereign Access (Permanently Unlocked for @codecheesee)",
    };
  }

  // 3. Check automated GitHub repository manifest or configured endpoint
  const targetEndpoint = ENTITLEMENT_ENDPOINT || GITHUB_ENTITLEMENT_MANIFEST_URL;
  try {
    const response = await fetch(targetEndpoint, {
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    if (response.ok) {
      const payload = await response.json();
      // Support manifest with sponsors list or direct entitlement object
      if (Array.isArray(payload?.sponsors) && storedLogin) {
        const match = payload.sponsors.find(
          (s: any) => String(s?.login || "").toLowerCase() === storedLogin
        );
        if (match) {
          return {
            isSupporter: true,
            tier: "Supporter",
            login: storedLogin,
            provider: "github-sponsors",
            expiresAt: match.expiresAt,
            reason: "Verified Active GitHub Sponsor Entitlement",
          };
        }
      }

      const entitlement = parseEntitlement(payload);
      if (entitlement && entitlement.active) {
        if (entitlement.tier === "maintainer") {
          return {
            isSupporter: true,
            isMaintainer: true,
            tier: "Maintainer",
            login: entitlement.login || GITHUB_MAINTAINER_LOGIN,
            provider: entitlement.provider || "github-maintainer",
            reason: "Verified Maintainer Entitlement",
          };
        }
        if (entitlement.tier === "supporter") {
          return {
            isSupporter: true,
            tier: "Supporter",
            provider: entitlement.provider,
            expiresAt: entitlement.expiresAt,
            reason: "Verified Supporter Entitlement",
          };
        }
      }
    }
  } catch (_) {}

  return freeStatus("Standard Community Edition (Normal searches unlimited forever; 1,000 premium trial uses).");
}

export function deactivateLicense(): void {
  try {
    localStorage.removeItem(STORED_GITHUB_USER_KEY);
  } catch (_) {}
}
