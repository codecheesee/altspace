import { test } from 'node:test';
import assert from 'node:assert/strict';

const LIMIT = 1000;
const WARNING = 900;
const WINDOW = 30 * 24 * 60 * 60 * 1000;

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

function isPremiumSearchQuery(query, searchAllDrives = false) {
  const qTrim = query.trim();
  if (!qTrim || qTrim.length < 2) return false;
  if (qTrim.startsWith("?") || qTrim.toLowerCase().startsWith("ai:")) return true;
  if (qTrim.startsWith(">") || qTrim.toLowerCase().startsWith("cmd:") || qTrim.toLowerCase().startsWith("sh:")) return true;
  if (searchAllDrives && !qTrim.startsWith(":") && qTrim.length >= 3) return true;
  return false;
}

test('premium search quota warns at 900 and caps at 1,000 uses', () => {
  const now = Date.now();
  const warning = consume({ windowStartedAt: now, used: 899 }, now);
  assert.equal(warning.used, 900);
  assert.equal(warning.warning, true);
  assert.equal(warning.remaining, 100);

  const exhausted = consume({ windowStartedAt: now, used: 999 }, now);
  assert.equal(exhausted.used, 1000);
  assert.equal(exhausted.allowed, true);
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.warning, false);
});

test('premium search quota resets after 30-day window', () => {
  const now = Date.now();
  const reset = consume({ windowStartedAt: now - WINDOW - 1, used: 1000 }, now);
  assert.equal(reset.used, 1);
  assert.equal(reset.allowed, true);
});

test('normal searches are always free and unmetered', () => {
  assert.equal(isPremiumSearchQuery("chrome"), false);
  assert.equal(isPremiumSearchQuery("vscode"), false);
  assert.equal(isPremiumSearchQuery(":port 3000"), false);
  assert.equal(isPremiumSearchQuery(":store"), false);
  assert.equal(isPremiumSearchQuery(":clip"), false);
  assert.equal(isPremiumSearchQuery("25 * 4"), false);
  assert.equal(isPremiumSearchQuery("$100 in inr"), false);
});

test('power features are classified as premium searches', () => {
  assert.equal(isPremiumSearchQuery("? generate regex for email"), true);
  assert.equal(isPremiumSearchQuery("ai: explain rust ownership"), true);
  assert.equal(isPremiumSearchQuery("> Get-Process"), true);
  assert.equal(isPremiumSearchQuery("cmd: ipconfig /all"), true);
  assert.equal(isPremiumSearchQuery("annual_report.pdf", true), true); // searchAllDrives = true
});
