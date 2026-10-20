/**
 * AltSpace Supporter License & Contributor Treasury Engine (2026 Production Architecture)
 *
 * Monetization Model:
 * - Open Core: 100% Free Forever under Apache 2.0.
 * - Supporter Edition: ₹99 / year (~$1.19/yr).
 * - 20% Contributor Treasury Allocation: ₹20 of every sale goes directly into
 *   the Community Feature Bounty Pool (managed via Open Collective / Polar.sh).
 * - Creators of extensions also get 100% of direct tips/sponsorships via GitHub Sponsors.
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

export const SUPPORTER_PRICE_INR = 299; // ₹299/year (~$3.60)
export const TREASURY_ALLOCATION_PCT = 20; // 20% to Community Treasury
export const TREASURY_PER_SALE_INR = Math.round((SUPPORTER_PRICE_INR * TREASURY_ALLOCATION_PCT) / 100); // ₹60

export const ACTIVE_BOUNTIES: FeatureBounty[] = [];

export interface LicenseStatus {
  isSupporter: boolean;
  tier: "Free" | "Supporter";
  licenseKey: string | null;
  activatedAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

const STORAGE_KEY = "altspace_supporter_license_v2";
const SALT = "ALTSPACE_2026_SUPPORTER_SALT_SECURE";

/**
 * Computes deterministic 6-character hex checksum for license key verification
 */
async function computeLicenseChecksum(plan: string, expiryHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${plan}:${expiryHex}:${SALT}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 3).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Validates cryptographic license key format:
 * Format: ALTSP-<PLAN>-<YYYYMMDD>-<CHECKSUM>
 * Example: ALTSP-SUPPORTER-20271020-A8F2BC
 */
export async function verifyLicenseKey(rawKey: string): Promise<{ valid: boolean; reason?: string; expiresAt?: string }> {
  const clean = rawKey.trim().toUpperCase();

  // Dev bypass / test key for evaluation
  if (clean === "ALTSP-DEV-2026" || clean === "ALTSP-SUPPORTER-2026") {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return { valid: true, expiresAt: nextYear.toISOString() };
  }

  const parts = clean.split("-");
  if (parts.length !== 4 || parts[0] !== "ALTSP") {
    return { valid: false, reason: "License key must follow ALTSP-<PLAN>-<DATE>-<HASH> format" };
  }

  const [_, plan, dateStr, checksum] = parts;
  if (plan !== "SUPPORTER" && plan !== "DEV" && plan !== "TEAM") {
    return { valid: false, reason: "Invalid license tier" };
  }

  // Parse YYYYMMDD
  if (!/^\d{8}$/.test(dateStr)) {
    return { valid: false, reason: "Invalid expiry date in license key" };
  }

  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(4, 6), 10) - 1;
  const day = parseInt(dateStr.slice(6, 8), 10);
  const expiryDate = new Date(year, month, day);

  if (isNaN(expiryDate.getTime())) {
    return { valid: false, reason: "Malformed license timestamp" };
  }

  if (expiryDate.getTime() < Date.now()) {
    return { valid: false, reason: "License key has expired" };
  }

  const expectedChecksum = await computeLicenseChecksum(plan, dateStr);
  if (checksum !== expectedChecksum) {
    return { valid: false, reason: "Invalid license key signature / checksum" };
  }

  return { valid: true, expiresAt: expiryDate.toISOString() };
}

export function getLicenseStatus(): LicenseStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isSupporter: false, tier: "Free", licenseKey: null };

    const data = JSON.parse(raw);
    if (data && data.key && data.tier === "Supporter") {
      const expires = data.expiresAt ? new Date(data.expiresAt) : null;
      const now = new Date();

      if (expires && expires.getTime() < now.getTime()) {
        deactivateLicense();
        return { isSupporter: false, tier: "Free", licenseKey: null };
      }

      const daysRemaining = expires
        ? Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : undefined;

      return {
        isSupporter: true,
        tier: "Supporter",
        licenseKey: data.key,
        activatedAt: data.activatedAt,
        expiresAt: data.expiresAt,
        daysRemaining,
      };
    }
  } catch (_) {}

  return { isSupporter: false, tier: "Free", licenseKey: null };
}

export async function activateLicenseKey(key: string): Promise<{ success: boolean; message: string }> {
  const clean = key.trim().toUpperCase();
  const verifyResult = await verifyLicenseKey(clean);

  if (!verifyResult.valid) {
    return { success: false, message: verifyResult.reason || "Invalid license key" };
  }

  const licenseData = {
    key: clean,
    tier: "Supporter",
    activatedAt: new Date().toISOString(),
    expiresAt: verifyResult.expiresAt,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(licenseData));
    return {
      success: true,
      message: "🎉 AltSpace Supporter Edition Activated! 20% contributed to the Open Source Bounty Treasury.",
    };
  } catch (err: any) {
    return { success: false, message: "Storage error: " + (err?.message || err) };
  }
}

export function deactivateLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}
