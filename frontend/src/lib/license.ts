/**
 * AltSpace Progressive Contributor & Supporter License Engine
 *
 * Bonding-Curve Pricing Model:
 * - Base 1-Year Supporter License: ₹9
 * - For every useful community feature/extension landed, license price increases by ₹1
 * - Every contributor earns ₹1 royalty on EVERY supporter license sold!
 * - Source code remains 100% Free & Apache-2.0 open source.
 */

export interface ContributorFeature {
  id: string;
  featureName: string;
  contributorName: string;
  githubHandle: string;
  dateAdded: string;
  royaltyAmount: number; // in ₹ INR
  description: string;
}

export const BASE_LICENSE_PRICE_INR = 9; // Base ₹9
export const ROYALTY_PER_FEATURE_INR = 1; // +₹1 per merged community feature

export const COMMUNITY_FEATURES: ContributorFeature[] = [
  {
    id: "frecency-ranking",
    featureName: "Rust SQLite Frecency Engine",
    contributorName: "Anand Verma",
    githubHandle: "anandv",
    dateAdded: "2026-10-18",
    royaltyAmount: 1,
    description: "Time-decay frecency ranking for lightning-fast sub-millisecond app suggestions.",
  },
  {
    id: "dns-flusher-ext",
    featureName: "DNS Cache Flusher Extension",
    contributorName: "Alex Rivera",
    githubHandle: "alexrivera",
    dateAdded: "2026-10-19",
    royaltyAmount: 1,
    description: "1-click Windows DNS resolver cache flushing for web developers.",
  },
  {
    id: "git-pruner-ext",
    featureName: "Git Branch Pruner Extension",
    contributorName: "Sarah Chen",
    githubHandle: "sarahchen",
    dateAdded: "2026-10-19",
    royaltyAmount: 1,
    description: "Automated local branch pruning and dead remote tracking cleanup.",
  },
  {
    id: "wifi-key-ext",
    featureName: "Wi-Fi Key Recovery Tool",
    contributorName: "Dan Kovacs",
    githubHandle: "dankovacs",
    dateAdded: "2026-10-20",
    royaltyAmount: 1,
    description: "Secure local inspection of saved Wi-Fi networks and security passwords.",
  },
  {
    id: "jwt-inspector-ext",
    featureName: "JWT Token Inspector",
    contributorName: "Rajat Kapoor",
    githubHandle: "rajatkapoor",
    dateAdded: "2026-10-20",
    royaltyAmount: 1,
    description: "Instant JSON Web Token decoding and payload formatting from clipboard.",
  },
  {
    id: "docker-pruner-ext",
    featureName: "Docker System Prune Extension",
    contributorName: "Elena Rostova",
    githubHandle: "elenarostova",
    dateAdded: "2026-10-20",
    royaltyAmount: 1,
    description: "Disk space reclamation by pruning stopped containers and dangling images.",
  },
  {
    id: "local-mcp-engine",
    featureName: "Local AI Model Context Protocol (MCP)",
    contributorName: "AltSpace Community",
    githubHandle: "altspace-dev",
    dateAdded: "2026-10-20",
    royaltyAmount: 1,
    description: "System tool execution (port killer, process manager, git status) via Local Ollama AI.",
  },
];

export function calculateCurrentPrice(): {
  basePrice: number;
  featureCount: number;
  totalPrice: number;
  contributorRoyaltyPool: number;
} {
  const featureCount = COMMUNITY_FEATURES.length;
  const contributorRoyaltyPool = featureCount * ROYALTY_PER_FEATURE_INR;
  const totalPrice = BASE_LICENSE_PRICE_INR + contributorRoyaltyPool;

  return {
    basePrice: BASE_LICENSE_PRICE_INR,
    featureCount,
    totalPrice,
    contributorRoyaltyPool,
  };
}

export interface LicenseStatus {
  isSupporter: boolean;
  licenseKey: string | null;
  tier: "Free" | "Supporter";
  activatedAt?: string;
  expiresAt?: string;
}

const STORAGE_KEY = "altspace_supporter_license_v1";

export function getLicenseStatus(): LicenseStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { isSupporter: false, licenseKey: null, tier: "Free" };
    }
    const data = JSON.parse(raw);
    if (data && data.key && data.tier === "Supporter") {
      return {
        isSupporter: true,
        licenseKey: data.key,
        tier: "Supporter",
        activatedAt: data.activatedAt,
        expiresAt: data.expiresAt,
      };
    }
  } catch (_) {}
  return { isSupporter: false, licenseKey: null, tier: "Free" };
}

export function activateLicenseKey(key: string): { success: boolean; message: string } {
  const cleanKey = key.trim().toUpperCase();
  if (!cleanKey) {
    return { success: false, message: "Please enter a valid license key" };
  }

  // Key format check: ALTSP-XXXX-XXXX-XXXX or test keys (e.g. ALTSP-DEV-2026)
  const isValidFormat =
    cleanKey.startsWith("ALTSP-") && cleanKey.split("-").length >= 3;
  const isDevBypass = cleanKey === "ALTSP-DEV-2026" || cleanKey === "SUPPORTER-1YEAR";

  if (!isValidFormat && !isDevBypass) {
    return {
      success: false,
      message: "Invalid license format. Expected ALTSP-XXXX-XXXX-XXXX",
    };
  }

  const now = new Date();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const licenseData = {
    key: cleanKey,
    tier: "Supporter",
    activatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(licenseData));
    return { success: true, message: "Supporter License activated for 1 Year! Thank you!" };
  } catch (err: any) {
    return { success: false, message: "Failed to save license: " + err.message };
  }
}

export function deactivateLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}
