import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAltConfig,
  computeConfigDiff,
  FORBIDDEN_CONFIG_KEYS,
} from './configValidator.ts';

test('1. Accepts valid non-sensitive .altconfig bundle', () => {
  const valid = {
    app: 'AltSpace',
    config_version: 2,
    theme_id: 'graphite-pro',
    custom_accent: '#38bdf8',
    autostart: true,
    sidebar_visible: false,
    search_all_drives: true,
  };

  const result = validateAltConfig(valid);
  assert.equal(result.valid, true);
  assert.equal(result.config.theme_id, 'graphite-pro');
  assert.equal(result.config.custom_accent, '#38bdf8');
});

test('2. Rejects configs containing forbidden secret or credential keys', () => {
  const hostile = {
    config_version: 2,
    theme_id: 'altspace-obsidian',
    api_key: 'sk-1234567890abcdef',
  };

  const result = validateAltConfig(hostile);
  assert.equal(result.valid, false);
  assert.equal(result.error.includes('forbidden'), true);
  assert.equal(result.error.includes('api_key'), true);
});

test('3. Rejects prototype pollution attempts in .altconfig JSON', () => {
  const pollution = JSON.parse('{"config_version": 2, "__proto__": {"admin": true}}');
  const result = validateAltConfig(pollution);
  assert.equal(result.valid, false);
  assert.equal(result.error.includes('__proto__') || result.error.includes('prototype'), true);
});

test('4. Rejects invalid data types or malformed color accents', () => {
  const invalidAccent = {
    config_version: 2,
    theme_id: 'altspace-obsidian',
    custom_accent: 'invalid-css-color',
  };
  assert.equal(validateAltConfig(invalidAccent).valid, false);

  const invalidBool = {
    config_version: 2,
    autostart: 'not_a_boolean',
  };
  assert.equal(validateAltConfig(invalidBool).valid, false);
});

test('5. Computes accurate dry-run diff between existing and incoming configs', () => {
  const current = {
    theme_id: 'altspace-obsidian',
    custom_accent: '#ff6363',
    sidebar_visible: true,
    search_all_drives: false,
  };

  const incoming = {
    config_version: 2,
    theme_id: 'graphite-pro',
    custom_accent: '#ff6363', // unchanged
    sidebar_visible: false, // changed
    search_all_drives: true, // changed
  };

  const diff = computeConfigDiff(current, incoming);
  assert.equal(diff.length >= 3, true);

  const themeDiff = diff.find((d) => d.key === 'theme_id');
  assert.equal(themeDiff?.status, 'changed');
  assert.equal(themeDiff?.currentValue, 'altspace-obsidian');
  assert.equal(themeDiff?.incomingValue, 'graphite-pro');

  const accentDiff = diff.find((d) => d.key === 'custom_accent');
  assert.equal(accentDiff?.status, 'unchanged');
});
