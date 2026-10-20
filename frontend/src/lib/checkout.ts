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

const DEFAULT_CHECKOUT_URL =
  "https://app.lemonsqueezy.com/checkout/buy/REPLACE_WITH_VARIANT_ID";

export const CHECKOUT_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_CHECKOUT_URL
    ? String(import.meta.env.VITE_CHECKOUT_URL)
    : DEFAULT_CHECKOUT_URL;
export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/codecheesee";

export function detectUserCurrency(timeZone?: string, languages?: string[]): CurrencyCode {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Calcutta") || tz.includes("Kolkata") || tz.includes("Asia/Colombo") || tz.includes("IST")) {
      return "INR";
    }
    const langs = languages || (typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : []);
    if (langs.some((lang) => lang?.toLowerCase().endsWith("-in"))) return "INR";
  } catch (_) {}
  return "USD";
}

export function getRegionalPricing(forcedCurrency?: CurrencyCode): RegionalPricing {
  const currency = forcedCurrency || detectUserCurrency();
  const price = currency === "INR" ? 299 : 12;
  const treasury = Number((price * 0.2).toFixed(currency === "INR" ? 0 : 2));
  return {
    currency,
    symbol: currency === "INR" ? "₹" : "$",
    price,
    formattedPrice: currency === "INR" ? "₹299" : "$12",
    monthlyEquivalent: currency === "INR" ? "~₹25/mo" : "$1/mo",
    treasuryAmount: treasury,
    formattedTreasury: currency === "INR" ? "₹60" : "$2.40",
    checkoutUrl: CHECKOUT_URL,
  };
}

export function openCheckout(currency?: CurrencyCode): void {
  const url = getRegionalPricing(currency).checkoutUrl;
  if (url.includes("REPLACE_WITH_VARIANT_ID")) return;
  if (tauriInvoke) {
    tauriInvoke("open_url", { url });
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
