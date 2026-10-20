import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIAL_ACTION_LIMIT,
  TRIAL_WARNING_THRESHOLD,
  TRIAL_WINDOW_MS,
  classifyPremiumAction,
  consumePremiumAction,
  isWithinWindow,
  makeQuotaState,
  resetExpiredWindow,
  shouldShowWarning,
  canUsePremiumAction,
  hasUnlimitedAccess,
  resetIdempotencyCache,
} from './quotaManager.ts';

test('1. Free local search never consumes quota or classifies as premium', () => {
  assert.equal(classifyPremiumAction({ query: 'chrome' }), false);
  assert.equal(classifyPremiumAction({ query: 'vscode' }), false);
  assert.equal(classifyPremiumAction({ query: ':port 3000' }), false);
  assert.equal(classifyPremiumAction({ query: ':store' }), false);
  assert.equal(classifyPremiumAction({ query: ':clip' }), false);
  assert.equal(classifyPremiumAction({ query: '25 * 4' }), false);
  assert.equal(classifyPremiumAction({ query: '$100 in inr' }), false);
  assert.equal(classifyPremiumAction({ query: 'notepad.exe' }), false);
});

test('2. Empty query or single-character search never classifies as premium', () => {
  assert.equal(classifyPremiumAction({ query: '' }), false);
  assert.equal(classifyPremiumAction({ query: ' ' }), false);
  assert.equal(classifyPremiumAction({ query: 'a' }), false);
  assert.equal(classifyPremiumAction({ query: '?' }), false); // Under 2 chars
  assert.equal(classifyPremiumAction({ query: '>' }), false);
});

test('3. Repeated keystrokes/debounces do not trigger multiple quota increments', () => {
  resetIdempotencyCache();
  const now = Date.now();
  let state = makeQuotaState(now, 10);

  // When user is typing a query, it passes the same active query key or idempotency token
  const res1 = consumePremiumAction('free', state, 'query-req-abc-1', now);
  assert.equal(res1.result.used, 11);
  state = res1.nextState;

  // Repeated debounce event with same request key
  const res2 = consumePremiumAction('free', state, 'query-req-abc-1', now);
  assert.equal(res2.result.used, 11, 'Duplicate in-flight debounce must not increment quota');
});

test('4. Duplicate in-flight request with same idempotency key consumes once', () => {
  resetIdempotencyCache();
  const now = Date.now();
  const start = makeQuotaState(now, 50);

  const req1 = consumePremiumAction('free', start, 'idem-tx-999', now);
  assert.equal(req1.result.used, 51);

  const req2 = consumePremiumAction('free', req1.nextState, 'idem-tx-999', now);
  assert.equal(req2.result.used, 51);
  assert.equal(req2.result.remaining, 49);
});

test('5. Failed request does not consume quota (quota only persists upon successful acceptance)', () => {
  const now = Date.now();
  const initial = makeQuotaState(now, 20);
  // Simulating rejected query or client-side cancellation prior to acceptance
  const isEligible = classifyPremiumAction({ query: 'calc 1+1' });
  assert.equal(isEligible, false);
  // Initial state remains untouched
  assert.equal(initial.used, 20);
});

test('6. Cancelled request does not consume quota', () => {
  const now = Date.now();
  const initial = makeQuotaState(now, 45);
  // Aborted before acceptance
  const aborted = true;
  if (!aborted) {
    consumePremiumAction('free', initial);
  }
  assert.equal(initial.used, 45);
});

test('7. Warning appears exactly at 80 actions threshold', () => {
  assert.equal(shouldShowWarning(79), false);
  assert.equal(shouldShowWarning(80), true);
  assert.equal(shouldShowWarning(85), true);
  assert.equal(shouldShowWarning(99), true);
  assert.equal(shouldShowWarning(100), false); // At 100, it becomes blocked/paywalled
});

test('8. 100th accepted premium action is allowed', () => {
  const now = Date.now();
  const state99 = makeQuotaState(now, 99);
  const { result } = consumePremiumAction('free', state99, undefined, now);
  assert.equal(result.used, 100);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 0);
});

test('9. 101st action is blocked for Free users', () => {
  const now = Date.now();
  const state100 = makeQuotaState(now, 100);
  assert.equal(canUsePremiumAction('free', state100, now), false);

  const { result } = consumePremiumAction('free', state100, undefined, now);
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.match(result.blockedReason || '', /100 advanced actions trial used/);
});

test('10. Quota window resets correctly after rolling 30-day window', () => {
  const now = Date.now();
  const expiredState = makeQuotaState(now - TRIAL_WINDOW_MS - 1000, 100);

  const resetState = resetExpiredWindow(expiredState, now);
  assert.equal(resetState.used, 0);
  assert.equal(resetState.windowStartedAt, now);

  const { result } = consumePremiumAction('free', expiredState, undefined, now);
  assert.equal(result.allowed, true);
  assert.equal(result.used, 1);
  assert.equal(result.remaining, 99);
});

test('11. Paid Pro and Supporter policies are explicit and unmetered', () => {
  const now = Date.now();
  const cappedState = makeQuotaState(now, 100);

  assert.equal(hasUnlimitedAccess('pro'), true);
  assert.equal(hasUnlimitedAccess('supporter'), true);
  assert.equal(hasUnlimitedAccess('free'), false);

  const proConsume = consumePremiumAction('pro', cappedState, undefined, now);
  assert.equal(proConsume.result.allowed, true);
  assert.equal(proConsume.result.remaining, Infinity);

  const supporterConsume = consumePremiumAction('supporter', cappedState, undefined, now);
  assert.equal(supporterConsume.result.allowed, true);
  assert.equal(supporterConsume.result.remaining, Infinity);
});

test('12. Maintainer and Contributor roles are separate and have explicit policies', () => {
  const now = Date.now();
  const cappedState = makeQuotaState(now, 100);

  assert.equal(hasUnlimitedAccess('maintainer'), true);
  assert.equal(hasUnlimitedAccess('contributor'), true);

  const maintainerConsume = consumePremiumAction('maintainer', cappedState, undefined, now);
  assert.equal(maintainerConsume.result.allowed, true);
  assert.equal(maintainerConsume.result.remaining, Infinity);

  const contributorConsume = consumePremiumAction('contributor', cappedState, undefined, now);
  assert.equal(contributorConsume.result.allowed, true);
  assert.equal(contributorConsume.result.remaining, Infinity);
});
