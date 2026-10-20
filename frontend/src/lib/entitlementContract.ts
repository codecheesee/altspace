/**
 * AltSpace Provider-Neutral Entitlement Contract & Lemon Squeezy Boundary
 * Defines webhook schemas, HMAC signature verification, idempotency handling,
 * state transitions, and server/client data validation.
 */

export type ClientEntitlementState =
  | "Free"
  | "CheckoutNotConfigured"
  | "CheckoutOpened"
  | "VerificationPending"
  | "ActiveSupporter"
  | "ActivePro"
  | "CancelledActiveUntilExpiry"
  | "Expired"
  | "Refunded"
  | "OfflineGracePeriod"
  | "VerificationUnavailable";

export type EntitlementTier = "free" | "supporter" | "pro" | "contributor" | "maintainer";

export interface VerifiedEntitlementPayload {
  active: boolean;
  tier: EntitlementTier;
  login?: string;
  provider: string;
  expiresAt?: string;
  issuedAt?: string;
  role?: string;
}

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name:
      | "order_created"
      | "subscription_created"
      | "subscription_updated"
      | "subscription_cancelled"
      | "subscription_expired"
      | "subscription_resumed"
      | "order_refunded";
    custom_data?: {
      user_id?: string;
      github_login?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      store_id: number;
      customer_id: number;
      order_id?: number;
      product_id: number;
      variant_id: number;
      product_name?: string;
      variant_name?: string;
      status: string;
      user_email: string;
      user_name?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      created_at: string;
      updated_at: string;
      refunded?: boolean;
    };
  };
}

/**
 * Verifies the HMAC-SHA256 signature sent in the X-Signature header by Lemon Squeezy
 * Compatible with Node.js crypto and Web Cryptography API.
 */
export async function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  if (!rawBody || !signatureHeader || !secret) return false;

  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const computedHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Constant-time comparison
      if (computedHex.length !== signatureHeader.length) return false;
      let diff = 0;
      for (let i = 0; i < computedHex.length; i++) {
        diff |= computedHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
      }
      return diff === 0;
    }
  } catch (_) {}

  return false;
}

export interface WebhookProcessResult {
  accepted: boolean;
  isDuplicate: boolean;
  tier: EntitlementTier;
  state: ClientEntitlementState;
  login?: string;
  expiresAt?: string;
  reason: string;
}

/**
 * Processes a Lemon Squeezy webhook event idempotently
 */
export function processLemonSqueezyEvent(
  event: LemonSqueezyWebhookEvent,
  processedEventIds: Set<string>,
  proVariantIds: number[] = [2001, 2002],
  supporterVariantIds: number[] = [1001, 1002]
): WebhookProcessResult {
  const eventId = event?.data?.id;
  if (!eventId) {
    return {
      accepted: false,
      isDuplicate: false,
      tier: "free",
      state: "Free",
      reason: "Missing event identifier",
    };
  }

  // Idempotency: Duplicate events are rejected safely
  if (processedEventIds.has(eventId)) {
    return {
      accepted: true,
      isDuplicate: true,
      tier: "free",
      state: "Free",
      reason: `Event ${eventId} has already been processed idempotently.`,
    };
  }

  processedEventIds.add(eventId);

  const eventName = event.meta?.event_name;
  const attrs = event.data?.attributes;
  const login = event.meta?.custom_data?.github_login;
  const variantId = attrs?.variant_id || 0;

  // Map product variant to Tier
  const tier: EntitlementTier = proVariantIds.includes(variantId)
    ? "pro"
    : supporterVariantIds.includes(variantId)
    ? "supporter"
    : "supporter"; // Default paid tier is supporter

  // Event State Machine
  switch (eventName) {
    case "order_created":
    case "subscription_created":
    case "subscription_resumed": {
      const expiresAt = attrs.renews_at || attrs.ends_at || new Date(Date.now() + 365 * 86400000).toISOString();
      return {
        accepted: true,
        isDuplicate: false,
        tier,
        state: tier === "pro" ? "ActivePro" : "ActiveSupporter",
        login,
        expiresAt,
        reason: `Subscription ${eventName} successfully activated.`,
      };
    }

    case "subscription_updated": {
      const isPastDue = attrs.status === "past_due" || attrs.status === "unpaid";
      if (isPastDue) {
        return {
          accepted: true,
          isDuplicate: false,
          tier: "free",
          state: "OfflineGracePeriod",
          login,
          reason: "Subscription payment is past due; entering grace period.",
        };
      }
      const expiresAt = attrs.renews_at || attrs.ends_at || undefined;
      return {
        accepted: true,
        isDuplicate: false,
        tier,
        state: tier === "pro" ? "ActivePro" : "ActiveSupporter",
        login,
        expiresAt,
        reason: "Subscription updated successfully.",
      };
    }

    case "subscription_cancelled": {
      // Cancelled subscriptions remain active until current period ends
      const endsAt = attrs.ends_at || attrs.renews_at;
      const isStillValid = endsAt && new Date(endsAt).getTime() > Date.now();
      if (isStillValid) {
        return {
          accepted: true,
          isDuplicate: false,
          tier,
          state: "CancelledActiveUntilExpiry",
          login,
          expiresAt: endsAt,
          reason: `Subscription cancelled; access remains active until ${endsAt}.`,
        };
      }
      return {
        accepted: true,
        isDuplicate: false,
        tier: "free",
        state: "Expired",
        login,
        reason: "Subscription cancelled and period has elapsed.",
      };
    }

    case "subscription_expired": {
      return {
        accepted: true,
        isDuplicate: false,
        tier: "free",
        state: "Expired",
        login,
        reason: "Subscription expired; reverting to Free tier.",
      };
    }

    case "order_refunded": {
      return {
        accepted: true,
        isDuplicate: false,
        tier: "free",
        state: "Refunded",
        login,
        reason: "Order was refunded or revoked; access cancelled immediately.",
      };
    }

    default:
      return {
        accepted: true,
        isDuplicate: false,
        tier: "free",
        state: "Free",
        reason: `Unhandled event: ${eventName}`,
      };
  }
}

/**
 * Validates the shape and integrity of an entitlement response from an HTTPS backend
 */
export function validateEntitlementResponse(raw: unknown): VerifiedEntitlementPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

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

  // Check if expiration date is valid
  if (typeof data.expiresAt === "string") {
    const epoch = new Date(data.expiresAt).getTime();
    if (!Number.isFinite(epoch)) return null;
    if (epoch < Date.now()) {
      // Expired!
      return {
        active: false,
        tier: "free",
        login: typeof data.login === "string" ? data.login : undefined,
        provider: typeof data.provider === "string" ? data.provider : "unknown",
        expiresAt: data.expiresAt,
      };
    }
  }

  return {
    active: data.active,
    tier: data.tier as EntitlementTier,
    login: typeof data.login === "string" ? data.login : undefined,
    provider: typeof data.provider === "string" ? data.provider : "configured-provider",
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
    role: typeof data.role === "string" ? data.role : undefined,
  };
}

/**
 * Derives the strict UI entitlement state for the client
 */
export function deriveClientState(
  payload: VerifiedEntitlementPayload | null,
  options: {
    hasEndpoint: boolean;
    hasCheckoutUrl: boolean;
    checkoutOpened?: boolean;
    isOffline?: boolean;
  }
): ClientEntitlementState {
  if (!options.hasCheckoutUrl) {
    return "CheckoutNotConfigured";
  }

  if (payload) {
    if (!payload.active) {
      return "Expired";
    }
    if (payload.tier === "pro") return "ActivePro";
    if (payload.tier === "supporter") return "ActiveSupporter";
    if (payload.tier === "maintainer") return "ActivePro"; // Maintainer has sovereign Pro
    if (payload.tier === "contributor") return "ActiveSupporter";
    return "Free";
  }

  if (options.checkoutOpened) {
    return "VerificationPending";
  }

  if (options.isOffline) {
    return "VerificationUnavailable";
  }

  return "Free";
}
