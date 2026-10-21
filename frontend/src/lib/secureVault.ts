import { tauriInvoke } from "./appStorage";
import { isFeatureEnabled } from "./featureMatrix";

/**
 * Windows DPAPI-backed secure secret vault.
 * Tokens and environment variables are encrypted at rest using CryptProtectData
 * bound to the current Windows user and machine.
 */

export interface EnvVariableEntry {
  key: string;
  value: string;
}

export interface EnvProfileSummary {
  name: string;
  var_count: number;
  updated_at: number;
  redacted_keys: string[];
  description?: string;
}

export interface EnvProfilePayload {
  name: string;
  description?: string;
  updated_at?: number;
  variables: EnvVariableEntry[];
}

export async function storeSecret(key: string, value: string): Promise<boolean> {
  try {
    const res = await tauriInvoke<void>("vault_store_secret", { key, value });
    return res !== null;
  } catch (err) {
    console.warn(`[Vault] Failed to encrypt secret for key ${key} via DPAPI:`, err);
    return false;
  }
}

export async function retrieveSecret(key: string): Promise<string | null> {
  try {
    return await tauriInvoke<string | null>("vault_retrieve_secret", { key });
  } catch (err) {
    console.warn(`[Vault] Failed to decrypt secret for key ${key} via DPAPI:`, err);
    return null;
  }
}

export async function deleteSecret(key: string): Promise<boolean> {
  try {
    const res = await tauriInvoke<boolean>("vault_delete_secret", { key });
    return res === true;
  } catch (err) {
    console.warn(`[Vault] Failed to delete secret for key ${key} via DPAPI:`, err);
    return false;
  }
}

export async function listEnvProfiles(): Promise<EnvProfileSummary[]> {
  if (!isFeatureEnabled("secret_vault")) {
    return [];
  }
  if (!tauriInvoke) {
    // Mock profiles in web dev mode
    try {
      const raw = localStorage.getItem("altspace_mock_profiles_v1");
      return raw ? JSON.parse(raw) : [
        {
          name: "staging",
          var_count: 3,
          updated_at: Date.now(),
          redacted_keys: ["DATABASE_URL (postg***)", "STRIPE_KEY (sk_t***)", "API_SECRET (sec_***)"],
          description: "Staging cluster credentials & database",
        },
        {
          name: "local-docker",
          var_count: 2,
          updated_at: Date.now(),
          redacted_keys: ["REDIS_PORT (63***)", "JWT_SECRET (loca***)"],
          description: "Local Compose environment variables",
        }
      ];
    } catch {
      return [];
    }
  }

  try {
    const list = await tauriInvoke<EnvProfileSummary[]>("vault_list_profiles");
    return list || [];
  } catch (err) {
    console.warn("[Vault] Failed to list encrypted profiles:", err);
    return [];
  }
}

export async function saveEnvProfile(profile: EnvProfilePayload): Promise<boolean> {
  if (!tauriInvoke) {
    // Mock save in web dev mode
    try {
      const existing = await listEnvProfiles();
      const updated = existing.filter((p) => p.name !== profile.name);
      updated.push({
        name: profile.name,
        var_count: profile.variables.length,
        updated_at: Date.now(),
        redacted_keys: profile.variables.slice(0, 5).map((v) => `${v.key} (****)`),
        description: profile.description,
      });
      localStorage.setItem("altspace_mock_profiles_v1", JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }

  try {
    await tauriInvoke("vault_save_profile", { profile });
    return true;
  } catch (err) {
    console.warn("[Vault] Failed to save encrypted profile:", err);
    throw err;
  }
}

export async function getEnvProfile(name: string): Promise<EnvProfilePayload | null> {
  if (!tauriInvoke) return null;
  try {
    return await tauriInvoke<EnvProfilePayload>("vault_get_profile", { name });
  } catch (err) {
    console.warn(`[Vault] Failed to get profile ${name}:`, err);
    return null;
  }
}

export async function deleteEnvProfile(name: string): Promise<boolean> {
  if (!tauriInvoke) {
    try {
      const existing = await listEnvProfiles();
      const updated = existing.filter((p) => p.name !== name);
      localStorage.setItem("altspace_mock_profiles_v1", JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }

  try {
    return (await tauriInvoke<boolean>("vault_delete_profile", { name })) ?? false;
  } catch (err) {
    console.warn(`[Vault] Failed to delete profile ${name}:`, err);
    return false;
  }
}

export async function launchEnvProfile(
  name: string,
  target: "wt" | "powershell" | "code" = "wt"
): Promise<string> {
  if (!tauriInvoke) {
    return `[Mock] Launched ${target} with '${name}' environment`;
  }
  try {
    const res = await tauriInvoke<string>("vault_launch_profile", { name, target });
    return res || `Launched ${target} with ${name}`;
  } catch (err: any) {
    throw new Error(err?.toString() || "Failed to launch process with environment");
  }
}
