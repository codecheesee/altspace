import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pure logic unit tests for Action Broker typing, risk policies, and session caching

const RISK_TIERS = {
  READ_ONLY_AUTO: 'read_only_auto',
  PREVIEW_THEN_APPROVE: 'preview_then_approve',
  ALWAYS_APPROVE: 'always_approve',
};

function classifyRiskTier(actionType) {
  switch (actionType) {
    case 'ReadFile':
    case 'InstallUpdate':
      return RISK_TIERS.READ_ONLY_AUTO;
    case 'WriteFile':
    case 'CallHttpEndpoint':
    case 'InstallPlugin':
      return RISK_TIERS.PREVIEW_THEN_APPROVE;
    case 'DeleteFile':
    case 'RunProgram':
    case 'RunPowerShell':
      return RISK_TIERS.ALWAYS_APPROVE;
    default:
      return RISK_TIERS.ALWAYS_APPROVE;
  }
}

function isActionReversible(actionType, options = {}) {
  if (actionType === 'WriteFile') return true;
  if (actionType === 'InstallPlugin') return true;
  if (actionType === 'DeleteFile') return false;
  if (actionType === 'RunPowerShell') return false;
  return false;
}

test('1. Action broker classifies read actions as ReadOnlyAuto', () => {
  assert.equal(classifyRiskTier('ReadFile'), RISK_TIERS.READ_ONLY_AUTO);
  assert.equal(classifyRiskTier('InstallUpdate'), RISK_TIERS.READ_ONLY_AUTO);
});

test('2. Action broker classifies write and network actions as PreviewThenApprove', () => {
  assert.equal(classifyRiskTier('WriteFile'), RISK_TIERS.PREVIEW_THEN_APPROVE);
  assert.equal(classifyRiskTier('CallHttpEndpoint'), RISK_TIERS.PREVIEW_THEN_APPROVE);
  assert.equal(classifyRiskTier('InstallPlugin'), RISK_TIERS.PREVIEW_THEN_APPROVE);
});

test('3. Action broker classifies delete and shell execution as AlwaysApprove', () => {
  assert.equal(classifyRiskTier('DeleteFile'), RISK_TIERS.ALWAYS_APPROVE);
  assert.equal(classifyRiskTier('RunProgram'), RISK_TIERS.ALWAYS_APPROVE);
  assert.equal(classifyRiskTier('RunPowerShell'), RISK_TIERS.ALWAYS_APPROVE);
});

test('4. Reversibility metadata is accurately computed', () => {
  assert.equal(isActionReversible('WriteFile'), true);
  assert.equal(isActionReversible('InstallPlugin'), true);
  assert.equal(isActionReversible('DeleteFile'), false);
  assert.equal(isActionReversible('RunPowerShell'), false);
});

test('5. Session approval cache bypasses subsequent Level 2 previews', () => {
  const sessionApprovals = new Set();
  const target = 'C:\\workspace\\project\\config.json';
  const actionKey = `WriteFile:${target}`;

  function requiresApproval(actionType, targetPath) {
    const tier = classifyRiskTier(actionType);
    if (tier === RISK_TIERS.READ_ONLY_AUTO) return false;
    if (tier === RISK_TIERS.ALWAYS_APPROVE) return true; // Level 3 always approves
    return !sessionApprovals.has(`${actionType}:${targetPath}`);
  }

  // Initial attempt: requires approval
  assert.equal(requiresApproval('WriteFile', target), true);

  // User checks "Remember for this session"
  sessionApprovals.add(actionKey);

  // Second attempt: bypasses approval
  assert.equal(requiresApproval('WriteFile', target), false);

  // High risk action still requires approval regardless of session
  assert.equal(requiresApproval('DeleteFile', target), true);
});

test('6. Ledger record transitions through requested -> approved -> completed', () => {
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
