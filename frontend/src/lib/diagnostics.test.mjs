import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactSensitiveDiagnostics,
  generateDiagnosticSnapshot,
  formatDiagnosticsForExport,
} from './diagnostics.ts';

test('1. Redacts sensitive tokens and secret keys from diagnostic strings', () => {
  const raw = 'Error on sk-proj-1234567890abcdef1234567890 and token ghp_123456789012345678901234567890123456';
  const { sanitized, count } = redactSensitiveDiagnostics(raw);

  assert.equal(sanitized.includes('sk-proj-'), false);
  assert.equal(sanitized.includes('ghp_'), false);
  assert.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
  assert.equal(sanitized.includes('[REDACTED_GITHUB_TOKEN]'), true);
  assert.equal(count, 2);
});

test('2. Anonymizes Windows user profile directories from paths', () => {
  const rawPath = 'Failed loading cache at C:\\Users\\JohnDoe\\AppData\\Local\\AltSpace\\cache.db';
  const { sanitized, count } = redactSensitiveDiagnostics(rawPath);

  assert.equal(sanitized.includes('JohnDoe'), false);
  assert.equal(sanitized, 'Failed loading cache at ~\\AppData\\Local\\AltSpace\\cache.db');
  assert.equal(count, 1);
});

test('3. Strips RSA/ECC private keys completely', () => {
  const rawKey = 'Loaded certificate. Private key:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\nService started.';
  const { sanitized, count } = redactSensitiveDiagnostics(rawKey);

  assert.equal(sanitized.includes('MIIEowIBAAKCAQEA'), false);
  assert.equal(sanitized.includes('[REDACTED_PRIVATE_KEY]'), true);
  assert.equal(count, 1);
});

test('4. Generates structured diagnostic snapshot with safe metadata defaults', () => {
  const snapshot = generateDiagnosticSnapshot({
    system: {
      platform: 'Windows NT 10.0',
      arch: 'x64',
      screenCount: 2,
      estimatedMemoryGb: '>=16GB',
    },
    extensions: {
      totalInstalled: 3,
      byTier: {
        builtIn: 2,
        verified: 1,
        community: 0,
        localDev: 0,
        revoked: 0,
      },
      quarantinedCount: 0,
    },
    recentLogs: [
      {
        level: 'warn',
        message: 'Could not connect to sk-test12345678901234567890 for user in C:\\Users\\Alice\\config',
        timestamp: '2026-10-21T10:00:00Z',
      },
    ],
  });

  assert.equal(snapshot.app.name, 'AltSpace');
  assert.equal(snapshot.system.arch, 'x64');
  assert.equal(snapshot.extensions.totalInstalled, 3);
  // Logs in snapshot must be automatically sanitized!
  assert.equal(snapshot.recentLogs[0].message.includes('sk-test'), false);
  assert.equal(snapshot.recentLogs[0].message.includes('Alice'), false);
  assert.equal(snapshot.redactionSummary.totalRedactedItems >= 2, true);
});

test('5. Formats sanitized diagnostics with export header banner', () => {
  const snapshot = generateDiagnosticSnapshot();
  const exported = formatDiagnosticsForExport(snapshot);

  assert.equal(exported.includes('AltSpace Diagnostics Report (Sanitized)'), true);
  assert.equal(exported.includes('Zero secrets or personal filesystem paths'), true);
  // Verify it contains parseable JSON after header
  const jsonPart = exported.split('===============================================\n')[1];
  const parsed = JSON.parse(jsonPart);
  assert.equal(parsed.app.name, 'AltSpace');
});
