import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSearchQuery,
  expandTokensWithSynonyms,
  isQueryMatchForGame,
  resolveGameHeroCard,
} from './searchNormalizer.ts';

test('1. Normalizes whitespace, literal word "space", and delimiters', () => {
  assert.equal(normalizeSearchQuery('GTA space 5'), 'gta 5');
  assert.equal(normalizeSearchQuery('gta   5'), 'gta 5');
  assert.equal(normalizeSearchQuery('gta_5'), 'gta 5');
  assert.equal(normalizeSearchQuery('gta-5'), 'gta 5');
  assert.equal(normalizeSearchQuery('gta.v'), 'gta v');
});

test('2. De-concatenates fused alphanumeric tokens and game acronyms', () => {
  assert.equal(normalizeSearchQuery('gta5'), 'gta 5');
  assert.equal(normalizeSearchQuery('gtav'), 'gta v');
  assert.equal(normalizeSearchQuery('cs2'), 'cs 2');
  assert.equal(normalizeSearchQuery('rdr2'), 'rdr 2');
});

test('3. Expands numeral and Roman numeral synonyms', () => {
  const fiveExpanded = expandTokensWithSynonyms(['gta', '5']);
  assert.equal(fiveExpanded[0][0], 'gta');
  assert.ok(fiveExpanded[1].includes('5'));
  assert.ok(fiveExpanded[1].includes('v'));
  assert.ok(fiveExpanded[1].includes('five'));

  const vExpanded = expandTokensWithSynonyms(['gta', 'v']);
  assert.ok(vExpanded[1].includes('v'));
  assert.ok(vExpanded[1].includes('5'));
  assert.ok(vExpanded[1].includes('five'));
});

test('4. Correctly matches Grand Theft Auto V across all variants', () => {
  const gtaAliases = [
    'gta 5',
    'gta v',
    'gta five',
    'gta5',
    'gtav',
    'grand theft auto 5',
    'grand theft auto v',
    'grand theft auto five',
    'gta',
  ];

  const variants = [
    'gta 5',
    'gta v',
    'gta five',
    'GTA 5',
    'GTA V',
    'GTA five',
    'gta5',
    'gtav',
    'gta space 5',
    'Grand Theft Auto 5',
    'Grand Theft Auto V',
    'Grand Theft Auto Five',
    'gta',
  ];

  for (const variant of variants) {
    const res = isQueryMatchForGame(variant, 'Grand Theft Auto V', gtaAliases);
    assert.ok(res.isMatch, `Expected variant "${variant}" to match "Grand Theft Auto V"`);
    assert.ok(res.score > 0);
  }
});

test('5. Rejects unrelated queries from matching Grand Theft Auto V', () => {
  const gtaAliases = ['gta 5', 'gta v', 'gta five', 'gta'];
  const res1 = isQueryMatchForGame('github desktop', 'Grand Theft Auto V', gtaAliases);
  assert.equal(res1.isMatch, false);

  const res2 = isQueryMatchForGame('chrome browser', 'Grand Theft Auto V', gtaAliases);
  assert.equal(res2.isMatch, false);

  const res3 = isQueryMatchForGame('code', 'Grand Theft Auto V', gtaAliases);
  assert.equal(res3.isMatch, false);
});

test('6. Resolves installed game over catalog metadata', () => {
  const mockInstalled = [
    {
      id: 'local-grand-theft-auto-v',
      title: 'Grand Theft Auto V',
      platform: 'Rockstar / PC',
      install_path: 'D:\\Games\\Grand Theft Auto V',
      executable_path: 'D:\\Games\\Grand Theft Auto V\\GTA5.exe',
      launch_uri: 'D:\\Games\\Grand Theft Auto V\\GTA5.exe',
      size_gb: 109.8,
    },
  ];

  const heroCard = resolveGameHeroCard('GTA 5', mockInstalled);
  assert.ok(heroCard !== null);
  assert.equal(heroCard.title, 'Grand Theft Auto V');
  assert.equal(heroCard.is_installed, true);
  assert.equal(heroCard.executable_path, 'D:\\Games\\Grand Theft Auto V\\GTA5.exe');
  assert.equal(heroCard.install_path, 'D:\\Games\\Grand Theft Auto V');
  assert.ok(heroCard.banner_url?.includes('271590'));

  const heroCardSpace = resolveGameHeroCard('GTA space 5', mockInstalled);
  assert.ok(heroCardSpace !== null);
  assert.equal(heroCardSpace.title, 'Grand Theft Auto V');
  assert.equal(heroCardSpace.is_installed, true);
});

test('7. Resolves catalog match when game is not installed', () => {
  const heroCard = resolveGameHeroCard('Cyberpunk 2077', []);
  assert.ok(heroCard !== null);
  assert.equal(heroCard.title, 'Cyberpunk 2077');
  assert.equal(heroCard.is_installed, false);
  assert.ok(heroCard.banner_url?.includes('1091500'));
});

test('8. Prevents false positive matching between Call of Duty and GTA V', () => {
  const mockInstalled = [
    {
      id: 'lnk-call-of-duty-4-modern-warfare',
      title: 'Call of Duty 4 Modern Warfare',
      platform: 'PC Game',
      install_path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Call of Duty 4 Modern Warfare\\Call of Duty 4 Modern Warfare.lnk',
      executable_path: null,
      launch_uri: 'C:\\ProgramData\\...lnk',
      size_gb: null,
    },
    {
      id: 'local-grand-theft-auto-v',
      title: 'Grand Theft Auto V',
      platform: 'Rockstar / PC',
      install_path: 'D:\\Games\\Grand Theft Auto V',
      executable_path: 'D:\\Games\\Grand Theft Auto V\\GTA5.exe',
      launch_uri: 'D:\\Games\\Grand Theft Auto V\\GTA5.exe',
      size_gb: 109.8,
    },
  ];

  const gtaVResult = resolveGameHeroCard('gta v', mockInstalled);
  assert.ok(gtaVResult !== null);
  assert.equal(gtaVResult.title, 'Grand Theft Auto V');
  assert.notEqual(gtaVResult.title, 'Call of Duty 4 Modern Warfare');
  assert.equal(gtaVResult.is_installed, true);
  assert.equal(gtaVResult.executable_path, 'D:\\Games\\Grand Theft Auto V\\GTA5.exe');
  assert.equal(gtaVResult.install_path, 'D:\\Games\\Grand Theft Auto V');

  const gta5Result = resolveGameHeroCard('gta 5', mockInstalled);
  assert.ok(gta5Result !== null);
  assert.equal(gta5Result.title, 'Grand Theft Auto V');
  assert.notEqual(gta5Result.title, 'Call of Duty 4 Modern Warfare');

  const codResult = resolveGameHeroCard('call of duty', mockInstalled);
  assert.ok(codResult !== null);
  assert.ok(codResult.title.toLowerCase().includes('call of duty'));
  assert.notEqual(codResult.title, 'Grand Theft Auto V');
});

