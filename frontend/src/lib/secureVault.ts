import { tauriInvoke } from "./appStorage";

/**
 * Windows DPAPI-backed secure secret vault.
 * Tokens and sensitive credentials are encrypted using CryptProtectData
 * bound to the current Windows user and machine.
 */
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
