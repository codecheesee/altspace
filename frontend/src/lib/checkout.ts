/**
 * AltSpace Purchasing Power Parity (PPP) & Checkout Engine (2026 Production)
 * Detects regional timezone/locales to provide fair pricing (₹299 INR in India vs $12 USD globally).
 * Generates direct Merchant of Record (Polar.sh / Stripe) checkout URLs with automated tax compliance.
 */

import { tauriInvoke } from "./appStorage";

export type CurrencyCode = "INR" | "USD";

export interface RegionalPricing {
  currency: CurrencyCode;
  symbol: string;
  price: number;
  formattedPrice: string;
  monthlyEquivalent: string;
  treasuryAmount: number;
  formattedTreasury: string;
  checkoutUrl: string;
}

export const CHECKOUT_URLS: Record<CurrencyCode, string> = {
  INR: "https://polar.sh/codecheesee/subscriptions/altspace-supporter-inr",
  USD: "https://polar.sh/codecheesee/subscriptions/altspace-supporter-usd",
};

/**
 * Detects if the user is in India or international based on browser timezone and language
 */
export function detectUserCurrency(timeZone?: string, languages?: string[]): CurrencyCode {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (
      tz.includes("Calcutta") ||
      tz.includes("Kolkata") ||
      tz.includes("Asia/Colombo") ||
      tz.includes("IST")
    ) {
      return "INR";
    }

    const langs =
      languages || (typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : []);
    for (const lang of langs) {
      if (lang && lang.toLowerCase().endsWith("-in")) {
        return "INR";
      }
    }
  } catch (_) {}

  return "USD";
}

/**
 * Returns formatted pricing and treasury allocation for the target currency
 */
export function getRegionalPricing(forcedCurrency?: CurrencyCode): RegionalPricing {
  const currency: CurrencyCode = forcedCurrency || detectUserCurrency();

  if (currency === "INR") {
    const price = 299; // ₹299 / year
    const treasury = Math.round(price * 0.2); // ₹60 (20%)
    return {
      currency: "INR",
      symbol: "₹",
      price,
      formattedPrice: "₹299",
      monthlyEquivalent: "~₹25/mo",
      treasuryAmount: treasury,
      formattedTreasury: "₹60",
      checkoutUrl: CHECKOUT_URLS.INR,
    };
  }

  // Global USD
  const price = 12; // $12 / year
  const treasury = Number((price * 0.2).toFixed(2)); // $2.40 (20%)
  return {
    currency: "USD",
    symbol: "$",
    price,
    formattedPrice: "$12",
    monthlyEquivalent: "$1/mo",
    treasuryAmount: treasury,
    formattedTreasury: "$2.40",
    checkoutUrl: CHECKOUT_URLS.USD,
  };
}

/**
 * Opens checkout in the user's default browser via Tauri IPC or window.open
 */
export function openCheckout(currency?: CurrencyCode): void {
  const pricing = getRegionalPricing(currency);
  if (tauriInvoke) {
    tauriInvoke("open_url", { url: pricing.checkoutUrl });
  } else if (typeof window !== "undefined") {
    window.open(pricing.checkoutUrl, "_blank");
  }
}
