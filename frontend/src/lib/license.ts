import { tauriInvoke, invokeStrict } from "./appStorage";
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
export const FOUNDER_PASS_PRICE_USD = 19;
export const FOUNDER_PASS_PRICE_INR = 999;
export const FOUNDER_PASS_MONTHS = 6;
export const TREASURY_ALLOCATION_PCT = 20;
export const TREASURY_PER_SALE_INR = Math.round((SUPPORTER_PRICE_INR * TREASURY_ALLOCATION_PCT) / 100);
export const ACTIVE_BOUNTIES: FeatureBounty[] = [];

export interface TrialState {
  isTrialActive: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  isExpired: boolean;
  startedAt: number;
}

const TRIAL_DURATION_DAYS = 7;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
const TRIAL_STORAGE_KEY = "altspace_aegis_pro_trial_start_epoch";

export function getProTrialState(): TrialState {
  let startMs = 0;
  try {
    const stored = localStorage.getItem(TRIAL_STORAGE_KEY);
    if (stored) {
      startMs = parseInt(stored, 10);
      if (isNaN(startMs)) {
        startMs = Date.now();
        localStorage.setItem(TRIAL_STORAGE_KEY, String(startMs));
      }
    } else {
      startMs = Date.now();
      localStorage.setItem(TRIAL_STORAGE_KEY, String(startMs));
    }
  } catch (_) {
    startMs = Date.now();
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - startMs);
  const remainingMs = Math.max(0, TRIAL_DURATION_MS - elapsed);
  const isTrialActive = remainingMs > 0;
  const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const hoursRemaining = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

  return {
    isTrialActive,
    daysRemaining,
    hoursRemaining,
    isExpired: !isTrialActive,
    startedAt: startMs,
  };
}

export interface LicenseStatus {
  isSupporter: boolean;
  tier: "Free" | "Supporter" | "Pro" | "Contributor" | "Maintainer";
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
  tier: "free" | "supporter" | "pro" | "contributor" | "maintainer";
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
  return (
    status.tier === "Maintainer" ||
    status.isMaintainer === true ||
    status.tier === "Pro" ||
    status.tier === "Supporter" ||
    status.tier === "Contributor"
  );
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
  if (
    data.tier !== "free" &&
    data.tier !== "supporter" &&
    data.tier !== "pro" &&
    data.tier !== "contributor" &&
    data.tier !== "maintainer"
  ) {
    return null;
  }
  return {
    active: data.active,
    tier: data.tier as "free" | "supporter" | "pro" | "contributor" | "maintainer",
    login: typeof data.login === "string" ? data.login : undefined,
    provider: typeof data.provider === "string" ? data.provider : undefined,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
  };
}

export function getLicenseStatus(): LicenseStatus {
  const session = getCurrentSession();

  // 1. Check if authenticated as maintainer @codecheesee or cached local sovereign status
  const isCachedMaintainer = (() => {
    try {
      return (
        typeof window !== "undefined" &&
        (localStorage.getItem("altspace_is_maintainer") === "true" ||
          localStorage.getItem("altspace_tier") === "Maintainer")
      );
    } catch (_) {
      return false;
    }
  })();

  if (
    isCachedMaintainer ||
    session?.login === GITHUB_MAINTAINER_LOGIN ||
    getStoredGitHubLogin() === GITHUB_MAINTAINER_LOGIN
  ) {
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
    "Standard Community Edition (Normal searches unlimited forever; 100 advanced actions trial)."
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

  // 2. Check Ed25519 Cryptographic License
  if (tauriInvoke) {
    try {
      const verified = await tauriInvoke<{
        valid: boolean;
        id: string;
        user: string;
        email?: string;
        tier: string;
        is_perpetual: boolean;
        expires_at?: string;
        machine: string;
        message: string;
      }>("get_active_verified_license");

      if (verified && verified.valid) {
        return {
          isSupporter: true,
          tier: "Pro",
          login: verified.user,
          avatarUrl: session?.avatarUrl,
          provider: "cryptographic-ed25519",
          expiresAt: verified.expires_at,
          role: "pro",
          reason: `Verified Ed25519 Cryptographic License (${verified.id})`,
        };
      }
    } catch (_) {}
  }

  // 2. Check offline DPAPI lease token
  if (tauriInvoke) {
    try {
      const hasProLease = await tauriInvoke<boolean>("vault_check_entitlement_lease");
      if (hasProLease) {
        return {
          isSupporter: true,
          tier: "Pro",
          login: storedLogin || "Pro Licensee",
          avatarUrl: session?.avatarUrl,
          provider: "offline-lease",
          reason: "Verified Local Pro Entitlement Lease (Hardware Linked)",
          role: "pro",
        };
      }
    } catch (_) {}
  }

  // 3. Local AppData / Rust token check fallback
  if (tauriInvoke) {
    try {
      const res = await tauriInvoke<{ is_maintainer: boolean; login: string; reason: string }>(
        "check_maintainer_status"
      );
      if (res && res.is_maintainer) {
        try {
          localStorage.setItem("altspace_is_maintainer", "true");
          localStorage.setItem("altspace_tier", "Maintainer");
        } catch (_) {}
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

      // 1. Check maintainers list in manifest
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

      // 2. Check Pro tier list in manifest
      if (Array.isArray(payload?.pro) && storedLogin) {
        const matchPro = payload.pro.find(
          (p: any) => String(p?.login || "").toLowerCase() === storedLogin.toLowerCase()
        );
        if (matchPro) {
          const isExpired = matchPro.expiresAt && new Date(matchPro.expiresAt).getTime() < Date.now();
          if (!isExpired) {
            return {
              isSupporter: true,
              tier: "Pro",
              login: storedLogin,
              avatarUrl: session?.avatarUrl,
              provider: matchPro.provider || "lemonsqueezy",
              expiresAt: matchPro.expiresAt,
              role: "pro",
              reason: "Verified Pro Entitlement (Unlimited Advanced Actions)",
            };
          }
        }
      }

      // 3. Check paid sponsors list in manifest
      if (Array.isArray(payload?.sponsors) && storedLogin) {
        const matchSponsor = payload.sponsors.find(
          (s: any) => String(s?.login || "").toLowerCase() === storedLogin.toLowerCase()
        );
        if (matchSponsor) {
          const isExpired = matchSponsor.expiresAt && new Date(matchSponsor.expiresAt).getTime() < Date.now();
          if (!isExpired) {
            return {
              isSupporter: true,
              tier: "Supporter",
              login: storedLogin,
              avatarUrl: session?.avatarUrl,
              provider: matchSponsor.provider || "github-sponsors",
              expiresAt: matchSponsor.expiresAt,
              role: "sponsor",
              reason: "Verified Active GitHub Sponsor Entitlement",
            };
          }
        }
      }

      // 4. Check code contributors list in manifest (strictly separate from paid sponsors)
      if (Array.isArray(payload?.contributors) && storedLogin) {
        const matchContributor = payload.contributors.find(
          (c: any) => String(c?.login || "").toLowerCase() === storedLogin.toLowerCase()
        );
        if (matchContributor) {
          const isExpired = matchContributor.expiresAt && new Date(matchContributor.expiresAt).getTime() < Date.now();
          if (!isExpired) {
            return {
              isSupporter: true,
              tier: "Contributor",
              login: storedLogin,
              avatarUrl: session?.avatarUrl,
              provider: "github-contributor",
              expiresAt: matchContributor.expiresAt,
              role: "contributor",
              reason: `Verified Code Contributor Entitlement (${matchContributor.mergedPRCount || 2}+ Merged PRs)`,
            };
          }
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
        if (entitlement.tier === "pro") {
          return {
            isSupporter: true,
            tier: "Pro",
            login: entitlement.login || storedLogin || undefined,
            provider: entitlement.provider || "lemonsqueezy",
            expiresAt: entitlement.expiresAt,
            reason: "Verified Pro Entitlement",
          };
        }
        if (entitlement.tier === "contributor") {
          return {
            isSupporter: true,
            tier: "Contributor",
            login: entitlement.login || storedLogin || undefined,
            provider: entitlement.provider || "github-contributor",
            expiresAt: entitlement.expiresAt,
            reason: "Verified Contributor Entitlement",
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
      ? `Connected as @${storedLogin}. Standard Community Edition (Normal searches unlimited forever; 100 advanced actions trial).`
      : "Standard Community Edition (Normal searches unlimited forever; 100 advanced actions trial)."
  );
}

export function deactivateLicense(): void {
  clearCurrentSession();
  if (tauriInvoke) {
    tauriInvoke("vault_delete_secret", { key: "altspace_entitlement_token" }).catch(() => {});
    tauriInvoke("vault_delete_secret", { key: "altspace_verified_license" }).catch(() => {});
  }
  try {
    localStorage.removeItem("altspace_entitlement_token");
    localStorage.removeItem("altspace_verified_license");
    localStorage.removeItem("altspace_is_maintainer");
    localStorage.removeItem("altspace_tier");
  } catch (_) {}
}

export async function activateManualLease(token: string): Promise<LicenseStatus> {
  const trimmed = token.trim();
  if (trimmed.startsWith("ALTS1-")) {
    const res = await invokeStrict<{
      valid: boolean;
      id: string;
      user: string;
      email?: string;
      tier: string;
      is_perpetual: boolean;
      expires_at?: string;
      machine: string;
      message: string;
    }>("verify_and_activate_license", { licenseKey: trimmed });

    if (res && res.valid) {
      return {
        isSupporter: true,
        tier: "Pro",
        login: res.user,
        provider: "cryptographic-ed25519",
        expiresAt: res.expires_at,
        role: "pro",
        reason: `Verified Ed25519 Cryptographic License (${res.id})`,
      };
    }
  }

  if (trimmed.length > 3) {
    if (tauriInvoke) {
      await tauriInvoke("vault_store_secret", { key: "altspace_entitlement_token", value: trimmed });
    } else {
      localStorage.setItem("altspace_entitlement_token", trimmed);
    }
  }
  return await refreshEntitlement();
}
