/**
 * AltSpace Configuration Schema Validator & Dry-Run Diff Engine (2026)
 * Validates .altconfig transfer bundles, guarantees rejection of sensitive
 * credentials and prototype pollution, and computes non-destructive diff previews.
 */

export const FORBIDDEN_CONFIG_KEYS = [
  'api_key',
  'apikey',
  'secret',
  'token',
  'auth',
  'password',
  'key',
  'private_key',
  'license',
  'vault',
  'clipboard',
  'session',
  'credential',
  '__proto__',
  'constructor',
  'prototype',
];

export interface ValidatedAltConfig {
  app?: string;
  config_version: number;
  version?: string;
  exported_at?: string;
  theme_id?: string;
  custom_accent?: string;
  autostart?: boolean;
  sidebar_visible?: boolean;
  search_all_drives?: boolean;
}

export interface ConfigDiffItem {
  key: string;
  currentValue: any;
  incomingValue: any;
  status: 'changed' | 'unchanged' | 'added' | 'removed';
}

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates that an imported object conforms strictly to the safe .altconfig schema
 * and contains no sensitive credentials or prototype pollution attacks.
 */
export function validateAltConfig(raw: unknown): {
  valid: boolean;
  config?: ValidatedAltConfig;
  error?: string;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Configuration must be a valid JSON object' };
  }

  const obj = raw as Record<string, unknown>;

  // Check for forbidden keys (exact and lowercase match)
  const allKeys = Object.keys(obj);
  for (const k of allKeys) {
    const lower = k.toLowerCase();
    for (const forbidden of FORBIDDEN_CONFIG_KEYS) {
      if (lower === forbidden || lower.includes(forbidden)) {
        return {
          valid: false,
          error: `Config contains forbidden sensitive property: '${k}'. AltSpace strictly prohibits importing secrets or credentials via .altconfig.`,
        };
      }
    }
  }

  // Prototype pollution check:
  // 1. Check if internal prototype was modified
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    return { valid: false, error: 'Malicious prototype properties detected in configuration payload' };
  }

  // 2. Check getOwnPropertyNames (includes non-enumerable properties like constructor or __proto__)
  const ownProps = Object.getOwnPropertyNames(obj);
  if (
    ownProps.includes('__proto__') ||
    ownProps.includes('prototype') ||
    ownProps.includes('constructor')
  ) {
    return { valid: false, error: 'Malicious prototype properties detected in configuration payload' };
  }

  // Validate version
  if (typeof obj.config_version !== 'number' || obj.config_version < 1) {
    return { valid: false, error: 'Missing or invalid config_version (must be a positive number)' };
  }

  const cleanConfig: ValidatedAltConfig = {
    config_version: obj.config_version,
  };

  if (typeof obj.app === 'string') cleanConfig.app = obj.app.slice(0, 32);
  if (typeof obj.version === 'string') cleanConfig.version = obj.version.slice(0, 32);
  if (typeof obj.exported_at === 'string') cleanConfig.exported_at = obj.exported_at;

  // Validate theme_id
  if (obj.theme_id !== undefined) {
    if (typeof obj.theme_id !== 'string' || !SAFE_IDENTIFIER_REGEX.test(obj.theme_id)) {
      return { valid: false, error: 'theme_id must be a valid alphanumeric identifier' };
    }
    cleanConfig.theme_id = obj.theme_id;
  }

  // Validate custom_accent
  if (obj.custom_accent !== undefined) {
    if (typeof obj.custom_accent !== 'string' || !HEX_COLOR_REGEX.test(obj.custom_accent)) {
      return { valid: false, error: 'custom_accent must be a valid hex color code (e.g. #38bdf8)' };
    }
    cleanConfig.custom_accent = obj.custom_accent;
  }

  // Validate autostart
  if (obj.autostart !== undefined) {
    if (typeof obj.autostart !== 'boolean') {
      return { valid: false, error: 'autostart must be a boolean' };
    }
    cleanConfig.autostart = obj.autostart;
  }

  // Validate sidebar_visible
  if (obj.sidebar_visible !== undefined) {
    if (typeof obj.sidebar_visible !== 'boolean') {
      return { valid: false, error: 'sidebar_visible must be a boolean' };
    }
    cleanConfig.sidebar_visible = obj.sidebar_visible;
  }

  // Validate search_all_drives
  if (obj.search_all_drives !== undefined) {
    if (typeof obj.search_all_drives !== 'boolean') {
      return { valid: false, error: 'search_all_drives must be a boolean' };
    }
    cleanConfig.search_all_drives = obj.search_all_drives;
  }

  return { valid: true, config: cleanConfig };
}

/**
 * Computes a human-readable diff comparing current configuration with incoming configuration.
 */
export function computeConfigDiff(
  current: Record<string, any>,
  incoming: Record<string, any>
): ConfigDiffItem[] {
  const diffs: ConfigDiffItem[] = [];
  const inspectKeys = ['theme_id', 'custom_accent', 'autostart', 'sidebar_visible', 'search_all_drives'];

  for (const key of inspectKeys) {
    const curVal = current[key];
    const incVal = incoming[key];

    if (incVal === undefined) continue;

    if (curVal === undefined) {
      diffs.push({
        key,
        currentValue: undefined,
        incomingValue: incVal,
        status: 'added',
      });
    } else if (curVal !== incVal) {
      diffs.push({
        key,
        currentValue: curVal,
        incomingValue: incVal,
        status: 'changed',
      });
    } else {
      diffs.push({
        key,
        currentValue: curVal,
        incomingValue: incVal,
        status: 'unchanged',
      });
    }
  }

  return diffs;
}
