# Lemon Squeezy Entitlement & Commercial Boundary Guide

AltSpace uses **Lemon Squeezy** as its planned Merchant of Record (MoR). This document specifies the commercial boundary, security architecture, operator deployment steps, and client state machine.

---

## 1. Security Architecture & Threat Boundary

1. **Client Isolation**: The AltSpace desktop client contains zero Lemon Squeezy API keys, webhook signing secrets, database credentials, or private signing keys.
2. **Authoritative Server**: Paid entitlements (`Supporter` and `Pro`) are never determined by unverified client localStorage. Only an HTTPS entitlement service that verifies HMAC-SHA256 webhook signatures from Lemon Squeezy can issue authoritative entitlement payloads.
3. **Fail-Closed Principle**: If `VITE_ENTITLEMENT_ENDPOINT` is unconfigured, unreachable, or returns a malformed response, AltSpace fails closed into the safe **Free** tier. Core local capabilities (app launching, local search, calculator, port inspector, clipboard manager) remain permanently free and unlimited.

---

## 2. Roles and Tier Mapping

| Role / Tier | Source of Authority | Commercial Status | Capabilities & Quota |
| :--- | :--- | :--- | :--- |
| **Free** | Default client state | Unpaid / Default | Unlimited local actions; 100 trial premium actions per rolling 30-day window (warning at 80). |
| **Supporter** | Lemon Squeezy checkout variant | Voluntary financial sponsor | Unmetered access; donor badge; 20% allocated to GitHub Contributor Treasury. |
| **Pro** | Lemon Squeezy checkout variant | Commercial operational license | Unmetered access; priority support; advanced operational actions (multi-drive, hosted/local AI streaming). |
| **Contributor** | GitHub Sync (`>= 2` merged PRs) | Merited community contributor | Granted unmetered access via signed `entitlements.json` manifest (isolated from paid sponsors). |
| **Maintainer** | Sovereignty check (`@codecheesee`) | Repository author | Lifetime unmetered sovereign access. |

---

## 3. Taxes, Merchant of Record (MoR) & Treasury Mechanics

1. **Tax Collection**: As Merchant of Record, Lemon Squeezy calculates, collects, and remits VAT, GST, and US state sales taxes automatically based on purchaser jurisdiction.
2. **Gross vs. Net Reporting**:
   - Gross revenue = Total amount charged to customer including applicable sales taxes.
   - Net revenue = Gross revenue minus payment processor fees, platform fees, refunds, and chargebacks.
3. **Contributor Treasury Allocation**:
   - 20% of net supporter revenue is allocated to the public GitHub Contributor Treasury pool for issue bounties.
   - Operator must account for refunds: when an order is refunded, any associated treasury accrual is reversed.

---

## 4. Operator Deployment & Setup Steps

### Step 1: Configure Lemon Squeezy Store
1. Log in to [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/).
2. Create two product variants under your store:
   - **AltSpace Supporter Edition** (e.g., \$5/month or \$50/year or one-time tip)
   - **AltSpace Pro Edition** (e.g., \$10/month or \$99/year)
3. Note the numerical `variant_id` values for both products.

### Step 2: Configure Webhook Delivery
1. In Lemon Squeezy Dashboard, navigate to **Settings > Webhooks**.
2. Create a new webhook subscription targeting your HTTPS entitlement service:
   - URL: `https://api.yourdomain.com/webhooks/lemonsqueezy`
   - Secret: Generate a high-entropy 32+ character random secret (`openssl rand -hex 32`).
3. Subscribe to the following webhook events:
   - `order_created`
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `order_refunded`

### Step 3: Deploy HTTPS Entitlement Service
Deploy a lightweight serverless function or backend service (e.g., Cloudflare Workers, Fly.io, Vercel) with the following environment variables:

```bash
# Server-Side Only Secrets (NEVER expose to desktop client or frontend build)
LEMON_SQUEEZY_WEBHOOK_SECRET=your_high_entropy_webhook_secret_here
ENTITLEMENT_SIGNING_PRIVATE_KEY=your_ed25519_or_hmac_signing_key
ENTITLEMENT_SERVICE_DATABASE_URL=postgresql://user:pass@host/entitlements
PRO_VARIANT_IDS=2001,2002
SUPPORTER_VARIANT_IDS=1001,1002
```

### Step 4: Webhook Handler Logic
1. Extract `X-Signature` header from the incoming request.
2. Compute `crypto.createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET).update(rawBody).digest('hex')`.
3. Compare signatures with timing-safe equality (`crypto.timingSafeEqual`).
4. Record incoming `event.data.id` in database idempotency ledger. If ID has already been processed, return `200 OK` immediately without duplicate actions.
5. Update user entitlement state according to the event:
   - `order_created` / `subscription_created`: Activate tier (`supporter` or `pro`), store `customer_id` and `expiresAt`.
   - `subscription_cancelled`: Set status to `cancelled`, but preserve access until `renews_at` or `ends_at`.
   - `subscription_expired`: Set status to `expired`, revert user to `free`.
   - `order_refunded`: Immediately revoke tier and revert user to `free`.

### Step 5: Configure Client Environment Variables
In your client deployment / build configuration (`.env.production`):

```bash
# Public Client Variables
VITE_CHECKOUT_URL=https://yourstore.lemonsqueezy.com/buy/variant_id
VITE_ENTITLEMENT_ENDPOINT=https://api.yourdomain.com/v1/entitlements/verify
VITE_GITHUB_CLIENT_ID=your_oauth_app_client_id
```

---

## 5. Client Entitlement Response Contract

When the AltSpace client invokes `VITE_ENTITLEMENT_ENDPOINT`, the server must respond with:

```json
{
  "active": true,
  "tier": "pro",
  "login": "octocat",
  "provider": "lemonsqueezy",
  "expiresAt": "2027-10-21T00:00:00Z",
  "role": "Pro"
}
```

### Discrete Client State Machine

The client runtime (`frontend/src/lib/entitlementContract.ts`) deterministically maps server responses and connectivity status into 11 discrete states:

1. `Free`: Standard tier, unmetered local features, 100 trial actions / 30-day window.
2. `ActiveSupporter`: Valid active supporter subscription.
3. `ActivePro`: Valid active pro subscription or sovereign maintainer.
4. `Expired`: Previously active subscription reached end date without renewal.
5. `Refunded`: Order refunded or payment revoked; immediate downgrade to Free.
6. `CancelledActiveUntilExpiry`: User cancelled renewal, but paid billing cycle remains valid until `expiresAt`.
7. `VerificationPending`: User launched hosted checkout; waiting for webhook roundtrip.
8. `VerificationUnavailable`: Network unreachable or offline; client preserves cached state under grace period.
9. `CheckoutNotConfigured`: No checkout URL provided; payment buttons safely disabled.
10. `OfflineGracePeriod`: Up to 7 days offline execution before re-validation is required.
11. `Revoked`: Explicit administrative revocation.

---

## 6. Testing with Lemon Squeezy Test Mode

1. In Lemon Squeezy, toggle **Test Mode** on in the dashboard header.
2. Create test products and retrieve test checkout URLs.
3. Complete purchases using Lemon Squeezy test credit card numbers (`4242 4242 4242 4242`).
4. In **Settings > Webhooks**, use the **Send Test Request** button to simulate `order_created`, `subscription_cancelled`, and `order_refunded` events.
5. Verify in your server logs and client UI that states transition accurately from `Free` to `ActivePro` to `Refunded`.
