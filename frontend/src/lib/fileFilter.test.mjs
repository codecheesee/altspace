import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExtensionFilterConfig,
  isExtensionBlocked,
  toggleExtensionState,
  toggleMasterFilter,
  addCustomBlockedExtension,
  removeCustomBlockedExtension,
  resetExtensionFilterToDefault,
} from './fileFilter.ts';

// Mock localStorage for Node test runner
const localStorageStore = new Map();
global.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, val) => localStorageStore.set(key, String(val)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
};

beforeEach(() => {
  localStorageStore.clear();
});

test('1. Default configuration is enabled with standard noise extensions', () => {
  const config = getExtensionFilterConfig();
  assert.equal(config.filterEnabled, true);
  assert.ok(config.blockedExtensions.includes('.ini'));
  assert.ok(config.blockedExtensions.includes('.tmp'));
  assert.ok(config.blockedExtensions.includes('.log'));
  assert.ok(config.blockedExtensions.includes('.dll'));
  assert.ok(config.blockedExtensions.includes('.ink'));
  assert.ok(config.blockedExtensions.includes('.bak'));
  assert.ok(config.blockedExtensions.includes('.dmp'));
});

test('2. Blocks noisy extensions by default', () => {
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini'), true);
  assert.equal(isExtensionBlocked('D:\\Games\\gta 5_fsr.ini'), true);
  assert.equal(isExtensionBlocked('C:\\Windows\\System32\\kernel.sys'), true);
  assert.equal(isExtensionBlocked('C:\\app\\install.log'), true);
  assert.equal(isExtensionBlocked('C:\\temp\\scratch.tmp'), true);
  assert.equal(isExtensionBlocked('C:\\drawings\\sketch.ink'), true);
  assert.equal(isExtensionBlocked('C:\\build\\app.pdb'), true);
});

test('3. Allows user documents, media, and applications through filter', () => {
  assert.equal(isExtensionBlocked('C:\\docs\\report.pdf'), false);
  assert.equal(isExtensionBlocked('C:\\docs\\notes.txt'), false);
  assert.equal(isExtensionBlocked('C:\\photos\\vacation.png'), false);
  assert.equal(isExtensionBlocked('C:\\projects\\index.html'), false);
  assert.equal(isExtensionBlocked('D:\\Games\\GTA5.exe'), false);
});

test('4. Gracefully permits file if user query explicitly mentions the extension', () => {
  // If user explicitly types "desktop.ini" or ".ini", allow it
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini', 'desktop.ini'), false);
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini', '.ini'), false);
  assert.equal(isExtensionBlocked('C:\\app\\error.log', 'error.log'), false);
});

test('5. Toggling an extension allows user to unblock it', () => {
  // Unblock .ini
  toggleExtensionState('.ini', false);
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini'), false);

  // Re-block .ini
  toggleExtensionState('.ini', true);
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini'), true);
});

test('6. Disabling master filter permits all extensions', () => {
  toggleMasterFilter(false);
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini'), false);
  assert.equal(isExtensionBlocked('C:\\app\\install.log'), false);
  assert.equal(isExtensionBlocked('C:\\drawings\\sketch.ink'), false);

  toggleMasterFilter(true);
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini'), true);
});

test('7. Supports custom user-defined blocked extensions', () => {
  addCustomBlockedExtension('.customjunk');
  assert.equal(isExtensionBlocked('C:\\files\\data.customjunk'), true);

  removeCustomBlockedExtension('.customjunk');
  assert.equal(isExtensionBlocked('C:\\files\\data.customjunk'), false);
});

test('8. Reset to default restores original noise filter set', () => {
  toggleExtensionState('.ini', false);
  addCustomBlockedExtension('.foo');

  const restored = resetExtensionFilterToDefault();
  assert.equal(restored.filterEnabled, true);
  assert.ok(restored.blockedExtensions.includes('.ini'));
  assert.equal(restored.customBlockedExtensions.length, 0);
  assert.equal(isExtensionBlocked('C:\\Users\\user\\desktop.ini'), true);
});
