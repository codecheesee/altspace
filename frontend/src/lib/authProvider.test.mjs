import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for node environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const AUTH_SESSION_STORAGE_KEY = 'altspace_auth_session_v2';

function getCurrentSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && typeof session.login === 'string' && session.login.trim()) {
      if ('accessToken' in session) {
        delete session.accessToken;
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
      }
      return session;
    }
  } catch (_) {}
  return null;
}

function saveCurrentSession(session) {
  try {
    const clean = { ...session };
    delete clean.accessToken;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
}

function clearCurrentSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem('altspace_github_user_session_v1');
    localStorage.removeItem('altspace_entitlement_token');
  } catch (_) {}
}

beforeEach(() => {
  storage.clear();
});

test('1. saveCurrentSession strips any accessToken before persisting to localStorage', () => {
  const sessionWithToken = {
    provider: 'github',
    login: 'testuser',
    id: 12345,
    name: 'Test User',
    accessToken: 'gho_secretAccessTokenShouldNotBePersisted',
    authenticatedAt: Date.now(),
  };

  saveCurrentSession(sessionWithToken);

  const rawStored = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  assert.equal(rawStored.includes('gho_secretAccessTokenShouldNotBePersisted'), false);
  assert.equal(rawStored.includes('accessToken'), false);

  const parsed = JSON.parse(rawStored);
  assert.equal(parsed.login, 'testuser');
  assert.equal(parsed.accessToken, undefined);
});

test('2. getCurrentSession purges legacy accessToken if found in localStorage', () => {
  // Simulate legacy session with plaintext token
  const legacySession = {
    provider: 'github',
    login: 'legacyuser',
    id: 54321,
    accessToken: 'ghp_legacyToken1234567890abcdef',
    authenticatedAt: Date.now(),
  };
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(legacySession));

  const session = getCurrentSession();
  assert.equal(session.login, 'legacyuser');
  assert.equal(session.accessToken, undefined);

  // Assert localStorage has been scrubbed
  const updatedStored = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  assert.equal(updatedStored.includes('ghp_legacyToken'), false);
  assert.equal(updatedStored.includes('accessToken'), false);
});

test('3. clearCurrentSession removes auth session and legacy entitlement tokens', () => {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ login: 'alice' }));
  localStorage.setItem('altspace_github_user_session_v1', 'legacy-data');
  localStorage.setItem('altspace_entitlement_token', 'PRO-123');

  clearCurrentSession();

  assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  assert.equal(localStorage.getItem('altspace_github_user_session_v1'), null);
  assert.equal(localStorage.getItem('altspace_entitlement_token'), null);
});
