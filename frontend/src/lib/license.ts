import { tauriInvoke } from "./appStorage";
import {
  getCurrentSession,
  saveCurrentSession,
  clearCurrentSession,
  GITHUB_MAINTAINER_LOGIN,
} from "./authProvider";

/**
 * Entitlement boundary for paid AltSpace features and Maintainer Lifetime Access.
 *
 * The maintainer (@codecheesee) receives permanent lifetime sovereign access.
 * Supporters are verified via GitHub Sponsors or automated entitlements manifest.
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
  avatarUrl?: string;
  provider?: string;
  expiresAt?: string;
  reason?: string;
  role?: string;
}

export interface VerifiedEntitlement {
  active: boolean;
  tier: "free" | "supporter" | "maintainer";
  login?: string;
  provider?: string;
  expiresAt?: string;
}

export const GITHUB_ENTITLEMENT_MANIFEST_URL =
  "https://raw.githubusercontent.com/codecheesee/altspace/main/entitlements.json";

const ENTITLEMENT_ENDPOINT =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ENTITLEMENT_ENDPOINT
    ? String(import.meta.env.VITE_ENTITLEMENT_ENDPOINT)
    : "";

export function isUnlimitedTier(status?: LicenseStatus | null): boolean {
  if (!status) return false;
  return status.tier === "Maintainer" || status.isMaintainer === true;
}

export function getStoredGitHubLogin(): string | null {
  const session = getCurrentSession();
  if (session?.login) return session.login.toLowerCase();

  try {
    const raw = localStorage.getItem("altspace_github_user_session_v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.login === "string" ? parsed.login.toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

export function saveStoredGitHubLogin(login: string): void {
  saveCurrentSession({
    provider: login.toLowerCase() === GITHUB_MAINTAINER_LOGIN ? "sovereign" : "github",
    login: login.toLowerCase(),
    authenticatedAt: Date.now(),
  });
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
  const session = getCurrentSession();

  // 1. Check if authenticated as maintainer @codecheesee
  if (session?.login === GITHUB_MAINTAINER_LOGIN || getStoredGitHubLogin() === GITHUB_MAINTAINER_LOGIN) {
    return {
      isSupporter: true,
      isMaintainer: true,
      tier: "Maintainer",
      login: GITHUB_MAINTAINER_LOGIN,
      avatarUrl: session?.avatarUrl || "https://avatars.githubusercontent.com/u/66432945?v=4",
      provider: "github-maintainer",
      reason: "Verified Maintainer Sovereign Access (Permanently Unlocked for @codecheesee)",
    };
  }

  // 2. Check if active session exists
  if (session && session.login) {
    return {
      isSupporter: false,
      tier: "Free",
      login: session.login,
      avatarUrl: session.avatarUrl,
      reason: `Connected as @${session.login}. Checking cloud entitlements...`,
    };
  }

  return freeStatus(
    "Standard Community Edition (Normal searches unlimited forever; 1,000 premium trial uses)."
  );
}

export async function refreshEntitlement(): Promise<LicenseStatus> {
  const session = getCurrentSession();
  const storedLogin = session?.login || getStoredGitHubLogin();

  // 1. Check if user is Maintainer (@codecheesee)
  if (storedLogin === GITHUB_MAINTAINER_LOGIN) {
    return {
      isSupporter: true,
      isMaintainer: true,
      tier: "Maintainer",
      login: GITHUB_MAINTAINER_LOGIN,
      avatarUrl: session?.avatarUrl || "https://avatars.githubusercontent.com/u/66432945?v=4",
      provider: "github-maintainer",
      reason: "Verified Maintainer Sovereign Access (Permanently Unlocked for @codecheesee)",
    };
  }

  // 2. Local AppData / Rust token check fallback
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
          avatarUrl: "https://avatars.githubusercontent.com/u/66432945?v=4",
          provider: "github-maintainer",
          reason: res.reason || "Verified Maintainer Sovereign Access (Permanently Unlocked)",
        };
      }
    } catch (_) {}
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

      // Check if logged-in user is listed in sponsors/contributors
      if (Array.isArray(payload?.sponsors) && storedLogin) {
        const match = payload.sponsors.find(
          (s: any) => String(s?.login || "").toLowerCase() === storedLogin.toLowerCase()
        );
        if (match) {
          const isExpired = match.expiresAt && new Date(match.expiresAt).getTime() < Date.now();
          if (!isExpired) {
            return {
              isSupporter: true,
              tier: "Supporter",
              login: storedLogin,
              avatarUrl: session?.avatarUrl,
              provider: match.role === "contributor" ? "github-contributor" : "github-sponsors",
              expiresAt: match.expiresAt,
              role: match.role || "sponsor",
              reason:
                match.role === "contributor"
                  ? "Verified Code Contributor Entitlement (2+ Merged PRs)"
                  : "Verified Active GitHub Sponsor Entitlement",
            };
          }
        }
      }

      // Check maintainers list in manifest
      if (Array.isArray(payload?.maintainers) && storedLogin) {
        const matchMaintainer = payload.maintainers.find(
          (m: any) => String(m?.login || "").toLowerCase() === storedLogin.toLowerCase()
        );
        if (matchMaintainer) {
          return {
            isSupporter: true,
            isMaintainer: true,
            tier: "Maintainer",
            login: storedLogin,
            avatarUrl: session?.avatarUrl,
            provider: "github-maintainer",
            reason: "Verified Maintainer Sovereign Access",
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

  return freeStatus(
    storedLogin
      ? `Connected as @${storedLogin}. Standard Community Edition (Normal searches unlimited forever; 1,000 premium trial uses).`
      : "Standard Community Edition (Normal searches unlimited forever; 1,000 premium trial uses)."
  );
}

export function deactivateLicense(): void {
  clearCurrentSession();
}
