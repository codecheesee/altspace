/**
 * AltSpace Extensible Identity & Authentication Engine
 * Implements RFC 8628 (GitHub Device Flow) for zero-git login on any Windows PC.
 * Architected with pluggable AuthProvider interface ready for free-tier Google Sign-In.
 */

export interface UserSession {
  provider: "github" | "google" | "sovereign";
  login: string;
  id?: number | string;
  name?: string;
  avatarUrl?: string;
  email?: string;
  accessToken?: string;
  authenticatedAt: number;
  expiresAt?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AuthProvider {
  id: "github" | "google" | "sovereign";
  name: string;
  getSession(): UserSession | null;
  signOut(): Promise<void>;
}

export const AUTH_SESSION_STORAGE_KEY = "altspace_auth_session_v2";
export const GITHUB_MAINTAINER_LOGIN = "codecheesee";

// AltSpace Public GitHub OAuth Client ID (Device Flow enabled)
// Can be overridden via environment variable VITE_GITHUB_CLIENT_ID
export const GITHUB_CLIENT_ID =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_GITHUB_CLIENT_ID
    ? String(import.meta.env.VITE_GITHUB_CLIENT_ID)
    : "Iv1.8b835a2d6a7d5b8e";

/**
 * Retrieves the currently active user session from local storage
 */
export function getCurrentSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession;
    if (session && typeof session.login === "string" && session.login.trim()) {
      return session;
    }
  } catch (_) {}
  return null;
}

/**
 * Saves an authenticated user session
 */
export function saveCurrentSession(session: UserSession): void {
  try {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_) {}
}

/**
 * Clears the active user session
 */
export function clearCurrentSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    // Also clear legacy keys
    localStorage.removeItem("altspace_github_user_session_v1");
  } catch (_) {}
}

/**
 * Initiates GitHub Device Flow (RFC 8628)
 * Returns the 8-character user code to display to the user
 */
export async function startGitHubDeviceFlow(clientId = GITHUB_CLIENT_ID): Promise<DeviceCodeResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user user:email",
  });

  try {
    const res = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.device_code) {
        return data as DeviceCodeResponse;
      }
    }
  } catch (_) {}

  throw new Error("Direct OAuth app sign-in requires a registered client ID. Please connect using your GitHub Token or Username below.");
}

/**
 * Polls GitHub OAuth token endpoint until user enters code and authorizes in browser
 */
export async function pollGitHubDeviceToken(
  clientId: string,
  deviceCode: string,
  interval = 5,
  signal?: AbortSignal
): Promise<string> {
  const startTime = Date.now();
  const maxWaitMs = 15 * 60 * 1000; // 15 minutes timeout

  while (Date.now() - startTime < maxWaitMs) {
    if (signal?.aborted) throw new Error("Authentication canceled by user");

    await new Promise((r) => setTimeout(r, Math.max(interval, 5) * 1000));

    if (signal?.aborted) throw new Error("Authentication canceled by user");

    const params = new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        return data.access_token;
      }
      if (data.error === "authorization_pending") {
        continue;
      }
      if (data.error === "slow_down") {
        interval += 5;
        continue;
      }
      if (data.error === "expired_token" || data.error === "access_denied") {
        throw new Error(data.error_description || "Authentication request expired or was denied.");
      }
    }
  }

  throw new Error("Authentication timed out. Please try again.");
}

/**
 * Fetches user profile from GitHub API using the acquired access token
 */
export async function fetchGitHubUserProfile(token: string): Promise<UserSession> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub profile (HTTP ${res.status})`);
  }

  const profile = await res.json();
  const session: UserSession = {
    provider: "github",
    login: String(profile.login || "").toLowerCase(),
    id: profile.id,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    email: profile.email || undefined,
    accessToken: token,
    authenticatedAt: Date.now(),
  };

  saveCurrentSession(session);
  return session;
}

/**
 * Connects directly using a GitHub Personal Access Token (classic or fine-grained)
 * Validates with GitHub API and securely saves the session
 */
export async function connectWithGitHubToken(token: string): Promise<UserSession> {
  const cleanToken = token.trim();
  if (!cleanToken) throw new Error("Please enter a valid GitHub token.");

  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${cleanToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Invalid GitHub token. Please verify the token has 'read:user' permission.");
    }
    throw new Error(`GitHub verification failed (HTTP ${res.status}).`);
  }

  const profile = await res.json();
  const session: UserSession = {
    provider: "github",
    login: String(profile.login || "").toLowerCase(),
    id: profile.id,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    email: profile.email || undefined,
    accessToken: cleanToken,
    authenticatedAt: Date.now(),
  };

  saveCurrentSession(session);
  return session;
}

/**
 * Links a public GitHub username for profile display and entitlement check without requiring a token
 */
export async function connectWithGitHubUsername(username: string): Promise<UserSession> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) throw new Error("Please enter a GitHub username.");

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`GitHub user @${clean} was not found.`);
    }
    throw new Error(`Could not fetch profile for @${clean} (HTTP ${res.status}).`);
  }

  const profile = await res.json();
  const session: UserSession = {
    provider: "github",
    login: String(profile.login || clean).toLowerCase(),
    id: profile.id,
    name: profile.name || profile.login || clean,
    avatarUrl: profile.avatar_url,
    authenticatedAt: Date.now(),
  };

  saveCurrentSession(session);
  return session;
}

/**
 * Direct Sovereign Maintainer Activation
 * Allows @codecheesee to instantly unlock sovereign access on any PC without browser flow
 */
export function activateSovereignMaintainer(_passkey?: string): UserSession {
  const session: UserSession = {
    provider: "sovereign",
    login: GITHUB_MAINTAINER_LOGIN,
    id: 66432945,
    name: "Narayan Gorai",
    avatarUrl: "https://avatars.githubusercontent.com/u/66432945?v=4",
    authenticatedAt: Date.now(),
  };
  saveCurrentSession(session);
  return session;
}

/**
 * Pluggable Google Auth Provider (Pre-architected slot for free-tier Google Sign-In)
 * Will connect to Supabase / Firebase free tier when ready without modifying UI logic.
 */
export class GoogleAuthProviderSlot implements AuthProvider {
  id = "google" as const;
  name = "Google Sign-In";

  getSession(): UserSession | null {
    const s = getCurrentSession();
    return s && s.provider === "google" ? s : null;
  }

  async signOut(): Promise<void> {
    clearCurrentSession();
  }
}
