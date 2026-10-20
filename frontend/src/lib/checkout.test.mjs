import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pure logic under test
function detectUserCurrency(timeZone, languages) {
  try {
    const tz = timeZone || '';
    if (
      tz.includes('Calcutta') ||
      tz.includes('Kolkata') ||
      tz.includes('Asia/Colombo') ||
      tz.includes('IST')
    ) {
      return 'INR';
    }

    const langs = languages || [];
    for (const lang of langs) {
      if (lang && lang.toLowerCase().endsWith('-in')) {
        return 'INR';
      }
    }
  } catch (_) {}

  return 'USD';
}

function getRegionalPricing(forcedCurrency, detectedCurrency = 'USD') {
  const currency = forcedCurrency || detectedCurrency;

  if (currency === 'INR') {
    const price = 299;
    const treasury = Math.round(price * 0.2);
    return {
      currency: 'INR',
      symbol: '₹',
      price,
      formattedPrice: '₹299',
      monthlyEquivalent: '~₹25/mo',
      treasuryAmount: treasury,
      formattedTreasury: '₹60',
      checkoutUrl: 'https://polar.sh/codecheesee/subscriptions/altspace-supporter-inr',
    };
  }

  const price = 12;
  const treasury = Number((price * 0.2).toFixed(2));
  return {
    currency: 'USD',
    symbol: '$',
    price,
    formattedPrice: '$12',
    monthlyEquivalent: '$1/mo',
    treasuryAmount: treasury,
    formattedTreasury: '$2.40',
    checkoutUrl: 'https://polar.sh/codecheesee/subscriptions/altspace-supporter-usd',
  };
}

test('detectUserCurrency recognizes Indian timezones as INR', () => {
  assert.equal(detectUserCurrency('Asia/Kolkata', []), 'INR');
  assert.equal(detectUserCurrency('Asia/Calcutta', []), 'INR');
});

test('detectUserCurrency recognizes Indian locale in languages list as INR', () => {
  assert.equal(detectUserCurrency('UTC', ['en-IN', 'en-US']), 'INR');
});

test('detectUserCurrency defaults to USD for non-Indian regions', () => {
  assert.equal(detectUserCurrency('America/New_York', ['en-US']), 'USD');
  assert.equal(detectUserCurrency('Europe/London', ['en-GB']), 'USD');
});

test('getRegionalPricing INR tier has correct pricing and 20% treasury allocation', () => {
  const pricing = getRegionalPricing('INR');
  assert.equal(pricing.currency, 'INR');
  assert.equal(pricing.price, 299);
  assert.equal(pricing.treasuryAmount, 60);
  assert.equal(pricing.formattedPrice, '₹299');
  assert.equal(pricing.formattedTreasury, '₹60');
  assert.match(pricing.checkoutUrl, /supporter-inr/);
});

test('getRegionalPricing USD tier has correct pricing and 20% treasury allocation', () => {
  const pricing = getRegionalPricing('USD');
  assert.equal(pricing.currency, 'USD');
  assert.equal(pricing.price, 12);
  assert.equal(pricing.treasuryAmount, 2.4);
  assert.equal(pricing.formattedPrice, '$12');
  assert.equal(pricing.formattedTreasury, '$2.40');
  assert.match(pricing.checkoutUrl, /supporter-usd/);
});
