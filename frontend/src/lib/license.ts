/**
 * Entitlement boundary for paid AltSpace features.
 *
 * The client never creates or verifies license keys. Purchases happen through
 * the configured Merchant of Record checkout, and entitlement responses must
 * come from the configured provider/backend endpoint.
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
  tier: "Free" | "Supporter";
  provider?: string;
  expiresAt?: string;
  reason?: string;
}

export interface VerifiedEntitlement {
  active: boolean;
  tier: "free" | "supporter";
  provider?: string;
  expiresAt?: string;
}

const ENTITLEMENT_ENDPOINT =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ENTITLEMENT_ENDPOINT
    ? String(import.meta.env.VITE_ENTITLEMENT_ENDPOINT)
    : "";

function freeStatus(reason: string): LicenseStatus {
  return { isSupporter: false, tier: "Free", reason };
}

function parseEntitlement(value: unknown): VerifiedEntitlement | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.active !== "boolean") return null;
  if (data.tier !== "free" && data.tier !== "supporter") return null;
  return {
    active: data.active,
    tier: data.tier,
    provider: typeof data.provider === "string" ? data.provider : undefined,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
  };
}

export function getLicenseStatus(): LicenseStatus {
  return freeStatus(
    ENTITLEMENT_ENDPOINT
      ? "Entitlement verification is available after the provider/backend is deployed."
      : "No entitlement service is configured; AltSpace is running in Free mode."
  );
}

export async function refreshEntitlement(): Promise<LicenseStatus> {
  if (!ENTITLEMENT_ENDPOINT) return getLicenseStatus();

  try {
    const response = await fetch(ENTITLEMENT_ENDPOINT, {
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    if (!response.ok) return freeStatus(`Entitlement service returned HTTP ${response.status}.`);
    const entitlement = parseEntitlement(await response.json());
    if (!entitlement || !entitlement.active || entitlement.tier !== "supporter") {
      return freeStatus("No active provider-verified supporter entitlement was returned.");
    }
    return {
      isSupporter: true,
      tier: "Supporter",
      provider: entitlement.provider,
      expiresAt: entitlement.expiresAt,
    };
  } catch (error) {
    return freeStatus(`Entitlement verification failed: ${String(error)}`);
  }
}

export function deactivateLicense(): void {
  // Local license keys are intentionally unsupported. There is no client
  // authority to revoke or manufacture an entitlement.
}
