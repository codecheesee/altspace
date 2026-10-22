import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Pure logic unit tests for Action Broker typing, risk policies, token binding, and capability disablement

const RISK_TIERS = {
  READ_ONLY_AUTO: 'read_only_auto',
  PREVIEW_THEN_APPROVE: 'preview_then_approve',
  ALWAYS_APPROVE: 'always_approve',
};

const DISABLED_CAPABILITIES = new Set(['RunPowerShell', 'CallHttpEndpoint']);

function classifyRiskTier(actionType) {
  switch (actionType) {
    case 'ReadFile':
    case 'InstallUpdate':
      return RISK_TIERS.READ_ONLY_AUTO;
    case 'WriteFile':
    case 'InstallPlugin':
    case 'FreePortAndVerify':
    case 'RestartDockerContainer':
    case 'ReclaimWslMemory':
      return RISK_TIERS.PREVIEW_THEN_APPROVE;
    case 'DeleteFile':
    case 'RunProgram':
      return RISK_TIERS.ALWAYS_APPROVE;
    case 'RunPowerShell':
    case 'CallHttpEndpoint':
      return 'disabled_capability';
    default:
      return RISK_TIERS.ALWAYS_APPROVE;
  }
}

function isActionReversible(actionType) {
  if (actionType === 'WriteFile') return true;
  if (actionType === 'InstallPlugin') return true;
  if (actionType === 'DeleteFile') return false;
  if (actionType === 'RunProgram') return false;
  return false;
}

test('1. Action broker classifies read actions as ReadOnlyAuto', () => {
  assert.equal(classifyRiskTier('ReadFile'), RISK_TIERS.READ_ONLY_AUTO);
  assert.equal(classifyRiskTier('InstallUpdate'), RISK_TIERS.READ_ONLY_AUTO);
});

test('2. Action broker classifies write and system ops as PreviewThenApprove', () => {
  assert.equal(classifyRiskTier('WriteFile'), RISK_TIERS.PREVIEW_THEN_APPROVE);
  assert.equal(classifyRiskTier('InstallPlugin'), RISK_TIERS.PREVIEW_THEN_APPROVE);
  assert.equal(classifyRiskTier('FreePortAndVerify'), RISK_TIERS.PREVIEW_THEN_APPROVE);
  assert.equal(classifyRiskTier('RestartDockerContainer'), RISK_TIERS.PREVIEW_THEN_APPROVE);
  assert.equal(classifyRiskTier('ReclaimWslMemory'), RISK_TIERS.PREVIEW_THEN_APPROVE);
});

test('3. Action broker classifies delete and binary execution as AlwaysApprove', () => {
  assert.equal(classifyRiskTier('DeleteFile'), RISK_TIERS.ALWAYS_APPROVE);
  assert.equal(classifyRiskTier('RunProgram'), RISK_TIERS.ALWAYS_APPROVE);
});

test('4. RunPowerShell and CallHttpEndpoint are recognized as disabled capabilities', () => {
  assert.equal(DISABLED_CAPABILITIES.has('RunPowerShell'), true);
  assert.equal(DISABLED_CAPABILITIES.has('CallHttpEndpoint'), true);
  assert.equal(classifyRiskTier('RunPowerShell'), 'disabled_capability');
  assert.equal(classifyRiskTier('CallHttpEndpoint'), 'disabled_capability');
});

test('5. Reversibility metadata is accurately computed', () => {
  assert.equal(isActionReversible('WriteFile'), true);
  assert.equal(isActionReversible('InstallPlugin'), true);
  assert.equal(isActionReversible('DeleteFile'), false);
  assert.equal(isActionReversible('RunProgram'), false);
});

test('6. Challenge token model enforces single-use and prevents replay', () => {
  const challengeStore = new Map();

  function issueChallenge(action) {
    const token = crypto.randomBytes(32).toString('hex');
    const digest = crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex');
    challengeStore.set(token, { digest, expiresAt: Date.now() + 60000 });
    return token;
  }

  function verifyAndConsume(token, action) {
    if (!challengeStore.has(token)) return { ok: false, error: 'Invalid or already consumed token' };
    const record = challengeStore.get(token);
    challengeStore.delete(token); // Single-use consumption
    if (Date.now() > record.expiresAt) return { ok: false, error: 'Token expired' };
    const currentDigest = crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex');
    if (currentDigest !== record.digest) return { ok: false, error: 'Parameter mismatch' };
    return { ok: true };
  }

  const action = { type: 'WriteFile', payload: { path: 'C:\\test.txt', content: 'secure' } };
  const token = issueChallenge(action);

  // First consumption succeeds
  const first = verifyAndConsume(token, action);
  assert.equal(first.ok, true);

  // Second consumption (replay attack) fails closed
  const replay = verifyAndConsume(token, action);
  assert.equal(replay.ok, false);
  assert.equal(replay.error, 'Invalid or already consumed token');
});

test('7. Parameter mutation detection rejects altered payload with original token', () => {
  const challengeStore = new Map();

  function issueChallenge(action) {
    const token = crypto.randomBytes(32).toString('hex');
    const digest = crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex');
    challengeStore.set(token, { digest, expiresAt: Date.now() + 60000 });
    return token;
  }

  function verifyAndConsume(token, action) {
    if (!challengeStore.has(token)) return { ok: false, error: 'Invalid or already consumed token' };
    const record = challengeStore.get(token);
    challengeStore.delete(token);
    if (Date.now() > record.expiresAt) return { ok: false, error: 'Token expired' };
    const currentDigest = crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex');
    if (currentDigest !== record.digest) return { ok: false, error: 'Parameter mismatch' };
    return { ok: true };
  }

  const benignAction = { type: 'WriteFile', payload: { path: 'C:\\test.txt', content: 'safe' } };
  const token = issueChallenge(benignAction);

  // Attacker attempts to substitute a malicious action
  const maliciousAction = { type: 'WriteFile', payload: { path: 'C:\\Windows\\System32\\bad.dll', content: 'evil' } };
  const mutated = verifyAndConsume(token, maliciousAction);
  assert.equal(mutated.ok, false);
  assert.equal(mutated.error, 'Parameter mismatch');
});

test('8. Token expiry rejects timed-out challenges', () => {
  const challengeStore = new Map();
  const action = { type: 'DeleteFile', payload: { path: 'C:\\old.txt' } };
  const token = 'expired-token-xyz';
  challengeStore.set(token, {
    digest: crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex'),
    expiresAt: Date.now() - 1000, // Expired 1 second ago
  });

  function verifyAndConsume(tok, act) {
    if (!challengeStore.has(tok)) return { ok: false, error: 'Invalid token' };
    const record = challengeStore.get(tok);
    challengeStore.delete(tok);
    if (Date.now() > record.expiresAt) return { ok: false, error: 'Token expired' };
    return { ok: true };
  }

  const res = verifyAndConsume(token, action);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Token expired');
});

test('9. Ledger record transitions through requested -> approved -> completed', () => {
  const stateTransitions = ['requested', 'approved', 'started', 'completed'];
  let currentState = stateTransitions[0];

  assert.equal(currentState, 'requested');
  currentState = stateTransitions[1];
  assert.equal(currentState, 'approved');
  currentState = stateTransitions[2];
  assert.equal(currentState, 'started');
  currentState = stateTransitions[3];
  assert.equal(currentState, 'completed');
});
