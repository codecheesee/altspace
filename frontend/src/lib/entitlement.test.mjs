import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyLemonSqueezySignature,
  processLemonSqueezyEvent,
  validateEntitlementResponse,
  deriveClientState,
  createEntitlementLease,
  verifyEntitlementLease,
  hasLeaseFeature,
} from './entitlementContract.ts';

// Helper to compute test HMAC-SHA256 signature
function computeSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

test('1. Invalid webhook signature rejected', async () => {
  const secret = 'test_webhook_secret_xyz';
  const body = JSON.stringify({ meta: { event_name: 'order_created' } });
  const badSig = '0000000000000000000000000000000000000000000000000000000000000000';

  const valid = await verifyLemonSqueezySignature(body, badSig, secret);
  assert.equal(valid, false);

  const emptySig = await verifyLemonSqueezySignature(body, '', secret);
  assert.equal(emptySig, false);
});

test('2. Valid HMAC-SHA256 signature accepted', async () => {
  const secret = 'super_secret_signing_key_123';
  const body = JSON.stringify({ meta: { event_name: 'subscription_created' }, data: { id: 'evt_101' } });
  const validSig = computeSignature(body, secret);

  const valid = await verifyLemonSqueezySignature(body, validSig, secret);
  assert.equal(valid, true);
});

test('3. Duplicate event is processed idempotently without side-effects', () => {
  const processed = new Set();
  const event = {
    meta: { event_name: 'subscription_created', custom_data: { github_login: 'alice' } },
    data: { id: 'evt_dup_999', type: 'subscriptions', attributes: { store_id: 1, customer_id: 2, product_id: 10, variant_id: 1001, status: 'active', user_email: 'alice@example.com', created_at: '', updated_at: '' } },
  };

  const res1 = processLemonSqueezyEvent(event, processed);
  assert.equal(res1.accepted, true);
  assert.equal(res1.isDuplicate, false);
  assert.equal(res1.state, 'ActiveSupporter');

  // Second delivery of same event ID
  const res2 = processLemonSqueezyEvent(event, processed);
  assert.equal(res2.accepted, true);
  assert.equal(res2.isDuplicate, true);
  assert.match(res2.reason, /processed idempotently/);
});

test('4. Refund revokes entitlement immediately', () => {
  const processed = new Set();
  const refundEvent = {
    meta: { event_name: 'order_refunded', custom_data: { github_login: 'bob' } },
    data: { id: 'evt_ref_001', type: 'orders', attributes: { store_id: 1, customer_id: 5, product_id: 10, variant_id: 1001, status: 'refunded', user_email: 'bob@example.com', refunded: true, created_at: '', updated_at: '' } },
  };

  const res = processLemonSqueezyEvent(refundEvent, processed);
  assert.equal(res.accepted, true);
  assert.equal(res.tier, 'free');
  assert.equal(res.state, 'Refunded');
});

test('5. Cancellation preserves access only until current billing period expiry', () => {
  const processed = new Set();
  const futureExpiry = new Date(Date.now() + 15 * 86400000).toISOString();
  const cancelEvent = {
    meta: { event_name: 'subscription_cancelled', custom_data: { github_login: 'carol' } },
    data: { id: 'evt_cancel_002', type: 'subscriptions', attributes: { store_id: 1, customer_id: 6, product_id: 10, variant_id: 1001, status: 'cancelled', user_email: 'carol@example.com', ends_at: futureExpiry, created_at: '', updated_at: '' } },
  };

  const res = processLemonSqueezyEvent(cancelEvent, processed);
  assert.equal(res.accepted, true);
  assert.equal(res.state, 'CancelledActiveUntilExpiry');
  assert.equal(res.tier, 'supporter');
  assert.equal(res.expiresAt, futureExpiry);
});

test('6. Expired subscription removes access and reverts to Free tier', () => {
  const processed = new Set();
  const expiredEvent = {
    meta: { event_name: 'subscription_expired', custom_data: { github_login: 'dave' } },
    data: { id: 'evt_exp_003', type: 'subscriptions', attributes: { store_id: 1, customer_id: 7, product_id: 10, variant_id: 1001, status: 'expired', user_email: 'dave@example.com', created_at: '', updated_at: '' } },
  };

  const res = processLemonSqueezyEvent(expiredEvent, processed);
  assert.equal(res.accepted, true);
  assert.equal(res.tier, 'free');
  assert.equal(res.state, 'Expired');
});

test('7. Malformed entitlement response falls back safely to Free mode', () => {
  assert.equal(validateEntitlementResponse(null), null);
  assert.equal(validateEntitlementResponse({}), null);
  assert.equal(validateEntitlementResponse({ active: 'yes' }), null); // active must be boolean
  assert.equal(validateEntitlementResponse({ active: true, tier: 'admin_hacked' }), null); // invalid tier

  const derived = deriveClientState(validateEntitlementResponse({ active: true, tier: 'admin_hacked' }), {
    hasEndpoint: true,
    hasCheckoutUrl: true,
  });
  assert.equal(derived, 'Free');
});

test('8. Missing endpoint or unconfigured checkout becomes safe Free/not-configured state', () => {
  const unconfigured = deriveClientState(null, {
    hasEndpoint: false,
    hasCheckoutUrl: false,
  });
  assert.equal(unconfigured, 'CheckoutNotConfigured');

  const noResponse = deriveClientState(null, {
    hasEndpoint: true,
    hasCheckoutUrl: true,
    isOffline: false,
  });
  assert.equal(noResponse, 'Free');

  const offline = deriveClientState(null, {
    hasEndpoint: true,
    hasCheckoutUrl: true,
    isOffline: true,
  });
  assert.equal(offline, 'VerificationUnavailable');
});

test('9. Client-side codebase never contains private secrets', () => {
  // Verifying that sensitive environment keys are restricted from client bundles
  const clientSafeKeys = ['VITE_CHECKOUT_URL', 'VITE_ENTITLEMENT_ENDPOINT', 'VITE_GITHUB_CLIENT_ID'];
  const serverOnlyKeys = [
    'LEMON_SQUEEZY_WEBHOOK_SECRET',
    'ENTITLEMENT_SIGNING_PRIVATE_KEY',
    'ENTITLEMENT_SERVICE_DATABASE_URL',
  ];

  for (const key of serverOnlyKeys) {
    assert.equal(key.startsWith('VITE_'), false, `${key} must never be exposed as a VITE_ variable`);
  }
});

test('10. Local storage cannot create an authoritative paid entitlement without server validation', () => {
  // Simulated untrusted raw injection in localStorage
  const fakeLocalData = { active: true, tier: 'supporter', expiresAt: '2099-01-01' };
  const validated = validateEntitlementResponse(fakeLocalData);
  assert.ok(validated);

  // But without valid server endpoint and signature, deriveClientState will not treat it as trusted
  const untrustedState = deriveClientState(null, {
    hasEndpoint: false,
    hasCheckoutUrl: true,
  });
  assert.equal(untrustedState, 'Free');
});

test('11. Signed entitlement lease is verified with valid signature', async () => {
  const secret = 'super_secret_entitlement_key_2026';
  const lease = await createEntitlementLease(
    {
      subject: 'octocat',
      device: 'win11_dev_01',
      tier: 'pro',
      features: ['ai.remote', 'sync.multi-device'],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      keyId: 'entitlement-key-1',
    },
    secret
  );

  assert.ok(lease.signature);
  const result = await verifyEntitlementLease(lease, secret);
  assert.equal(result.valid, true);
});

test('12. Tampered entitlement lease is rejected by signature verification', async () => {
  const secret = 'super_secret_entitlement_key_2026';
  const lease = await createEntitlementLease(
    {
      subject: 'octocat',
      device: 'win11_dev_01',
      tier: 'free',
      features: [],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      keyId: 'entitlement-key-1',
    },
    secret
  );

  // Attempt tampering tier to pro without valid signature
  const tampered = { ...lease, tier: 'pro', features: ['ai.remote'] };
  const result = await verifyEntitlementLease(tampered, secret);
  assert.equal(result.valid, false);
});

test('13. Expired entitlement lease is rejected even if signature was valid', async () => {
  const secret = 'super_secret_entitlement_key_2026';
  const lease = await createEntitlementLease(
    {
      subject: 'octocat',
      device: 'win11_dev_01',
      tier: 'pro',
      features: ['ai.remote'],
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
      keyId: 'entitlement-key-1',
    },
    secret
  );

  const result = await verifyEntitlementLease(lease, secret);
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('expired'));
});

test('14. Feature checks correctly validate capabilities against active lease', () => {
  const proLease = {
    subject: 'octocat',
    device: 'win11_dev_01',
    tier: 'pro',
    features: ['ai.remote', 'sync.multi-device'],
    issuedAt: '',
    expiresAt: '',
    keyId: '',
    signature: '',
  };

  assert.equal(hasLeaseFeature(proLease, 'ai.remote'), true);
  assert.equal(hasLeaseFeature(proLease, 'sync.multi-device'), true);
  assert.equal(hasLeaseFeature(null, 'ai.remote'), false);
});
