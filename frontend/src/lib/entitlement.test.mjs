import { test } from 'node:test';
import assert from 'node:assert/strict';

function isUnlimitedTier(status) {
  if (!status) return false;
  return status.tier === 'Maintainer' || status.isMaintainer === true;
}

test('recognizes maintainer tier as unlimited lifetime access', () => {
  const maintainer = {
    isSupporter: true,
    isMaintainer: true,
    tier: 'Maintainer',
    login: 'codecheesee',
  };
  assert.equal(isUnlimitedTier(maintainer), true);
});

test('standard free and supporter users are not unlimited maintainer', () => {
  const freeUser = { isSupporter: false, tier: 'Free' };
  assert.equal(isUnlimitedTier(freeUser), false);

  const supporter = { isSupporter: true, tier: 'Supporter' };
  assert.equal(isUnlimitedTier(supporter), false);
});
