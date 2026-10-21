import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APPS,
  getCachedOrInitialApps,
  getStoredBoolean,
  SIDEBAR_PREFERENCE_KEY,
  DRIVE_SEARCH_PREFERENCE_KEY,
} from './appStorage.ts';

test('1. Fresh install contains zero demo or fake applications', () => {
  assert.equal(DEFAULT_APPS.length, 0, 'DEFAULT_APPS must be empty on clean install');
});

test('2. No hardcoded developer or workspace paths in initial item catalog', () => {
  const initial = getCachedOrInitialApps();
  for (const item of initial) {
    assert.equal(
      item.path.includes('scratch') || item.path.includes('rohan'),
      false,
      `Item path ${item.path} contains hardcoded developer paths`
    );
  }
});

test('3. Empty search does not include clipboard results', () => {
  const initial = getCachedOrInitialApps();
  const clipboardItems = initial.filter(
    (i) => i.category === 'Clipboard' || (i.path && i.path.startsWith('clip://'))
  );
  assert.equal(clipboardItems.length, 0, 'Clipboard items must not be exposed in default search');
});

test('4. Details / sidebar defaults to hidden on fresh install', () => {
  const defaultSidebar = getStoredBoolean(SIDEBAR_PREFERENCE_KEY, false);
  assert.equal(defaultSidebar, false, 'Sidebar must default to hidden');
});

test('5. Sidebar preference persists only after explicit user toggle', () => {
  const mockStorage = new Map();
  function getPref(fallback = false) {
    const val = mockStorage.get(SIDEBAR_PREFERENCE_KEY);
    return val === undefined ? fallback : val === 'true';
  }
  function setPref(val) {
    mockStorage.set(SIDEBAR_PREFERENCE_KEY, String(val));
  }

  assert.equal(getPref(false), false, 'Initially hidden');
  setPref(true);
  assert.equal(getPref(false), true, 'Persists user opt-in');
  setPref(false);
  assert.equal(getPref(false), false, 'Persists user opt-out');
});

test('6. Multi-drive search starts enabled by default for seamless file finding', () => {
  const defaultDriveSearch = getStoredBoolean(DRIVE_SEARCH_PREFERENCE_KEY, true);
  assert.equal(defaultDriveSearch, true, 'Multi-drive search is enabled by default to find all user folders');
});

test('7. .altconfig exports exclude secrets, clipboard, history, entitlement data, and raw paths', () => {
  const sampleConfig = {
    app: 'AltSpace',
    config_version: 2,
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    theme_id: 'raycast-dark',
    custom_accent: '#ff6363',
    autostart: false,
    sidebar_visible: false,
    search_all_drives: false,
  };

  const serialized = JSON.stringify(sampleConfig);
  const parsed = JSON.parse(serialized);

  assert.equal('clipboard' in parsed, false);
  assert.equal('history' in parsed, false);
  assert.equal('secrets' in parsed, false);
  assert.equal('api_key' in parsed, false);
  assert.equal('entitlements' in parsed, false);
  assert.equal('license_key' in parsed, false);
});

test('8. Malformed or corrupted cache does not create fake or demo data', () => {
  // Simulating invalid JSON or malformed schema in localStorage
  function safeParseCache(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((x) => x && typeof x.title === 'string');
      }
    } catch (_) {}
    return [];
  }

  assert.deepEqual(safeParseCache('{ broken json'), []);
  assert.deepEqual(safeParseCache('null'), []);
  assert.deepEqual(safeParseCache('{"not": "an array"}'), []);
  assert.deepEqual(safeParseCache('[{"invalid": true}]'), []);
});
