# Lemon Squeezy entitlement boundary

AltSpace uses Lemon Squeezy as the planned Merchant of Record. The desktop
client opens a hosted checkout URL and never contains a Lemon Squeezy API key,
webhook secret, signing key, or customer-management credential.

## Operator setup

1. Create the Supporter product and variant in Lemon Squeezy.
2. Set `VITE_CHECKOUT_URL` to the hosted checkout URL for that variant.
3. Deploy an HTTPS entitlement service and set `VITE_ENTITLEMENT_ENDPOINT`.
4. Configure a Lemon Squeezy webhook signing secret in the entitlement service,
   not in the desktop app.
5. Verify the webhook signature before storing subscription/order state.
6. Authenticate the entitlement request to the purchaser/device account using
   the deployment's own account/session mechanism. Do not trust a client-provided
   `active` flag, email address, or order ID.

## Client response contract

The endpoint must return JSON with this shape:

```json
{
  "active": true,
  "tier": "supporter",
  "provider": "lemonsqueezy",
  "expiresAt": "2027-10-20T00:00:00Z"
}
```

`tier` must be `supporter` and `active` must be `true` before the client treats
the response as an entitlement. Any HTTP error, malformed response, missing
endpoint, or inactive subscription leaves the app in Free mode.

The repository does not include a webhook handler or claim that payment
verification works until the operator deploys this service and configures the
provider secrets. Basic local launching and ordinary local search remain free.
Advanced search uses a 50-search allowance over 14 days, warns at 40, and
requires a verified Supporter entitlement after the allowance is exhausted.
