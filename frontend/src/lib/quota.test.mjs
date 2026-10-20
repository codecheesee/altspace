import { test } from 'node:test';
import assert from 'node:assert/strict';

const LIMIT = 50;
const WARNING = 40;
const WINDOW = 14 * 24 * 60 * 60 * 1000;

function consume(record, now) {
  const current = now - record.windowStartedAt < WINDOW ? record : { windowStartedAt: now, used: 0 };
  const next = { windowStartedAt: current.windowStartedAt, used: Math.min(LIMIT, current.used + 1) };
  return {
    ...next,
    allowed: next.used <= LIMIT,
    remaining: Math.max(0, LIMIT - next.used),
    warning: next.used >= WARNING && next.used < LIMIT,
  };
}

test('advanced search warns at 40 and blocks after 50 uses', () => {
  const now = Date.now();
  const warning = consume({ windowStartedAt: now, used: 39 }, now);
  assert.equal(warning.used, 40);
  assert.equal(warning.warning, true);
  assert.equal(warning.remaining, 10);

  const exhausted = consume({ windowStartedAt: now, used: 49 }, now);
  assert.equal(exhausted.used, 50);
  assert.equal(exhausted.allowed, true);
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.warning, false);
});

test('advanced search quota resets after 14 days', () => {
  const now = Date.now();
  const reset = consume({ windowStartedAt: now - WINDOW - 1, used: 50 }, now);
  assert.equal(reset.used, 1);
  assert.equal(reset.allowed, true);
});
