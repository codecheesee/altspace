/**
 * File Extension Noise Filter Engine
 * Automatically filters out least-used, temporary, cache, build artifacts, and system clutter
 * from search results while providing full user customizability in Settings.
 */

export interface BlockedExtensionInfo {
  ext: string;
  category: "System & Config" | "Temp & Cache" | "Build Artifacts" | "Obscure Formats";
  description: string;
  defaultBlocked: boolean;
}

export const KNOWN_NOISE_EXTENSIONS: BlockedExtensionInfo[] = [
  // System & Config
  { ext: ".ini", category: "System & Config", description: "Configuration & initialization files (e.g. desktop.ini)", defaultBlocked: true },
  { ext: ".sys", category: "System & Config", description: "Windows system files and kernel drivers", defaultBlocked: true },
  { ext: ".dll", category: "System & Config", description: "Dynamic-link library binaries", defaultBlocked: true },
  { ext: ".drv", category: "System & Config", description: "Hardware device drivers", defaultBlocked: true },
  { ext: ".inf", category: "System & Config", description: "Device driver setup scripts", defaultBlocked: true },
  { ext: ".reg", category: "System & Config", description: "Windows Registry script exports", defaultBlocked: true },
  { ext: ".cat", category: "System & Config", description: "Windows security catalog signatures", defaultBlocked: true },
  { ext: ".dat", category: "System & Config", description: "Application raw data files", defaultBlocked: true },
  { ext: ".cur", category: "System & Config", description: "Static mouse cursor resources", defaultBlocked: true },
  { ext: ".ani", category: "System & Config", description: "Animated mouse cursor resources", defaultBlocked: true },

  // Temp, Cache & Junk
  { ext: ".tmp", category: "Temp & Cache", description: "Temporary scratch files", defaultBlocked: true },
  { ext: ".temp", category: "Temp & Cache", description: "Temporary cache files", defaultBlocked: true },
  { ext: ".bak", category: "Temp & Cache", description: "Backup duplicate copies", defaultBlocked: true },
  { ext: ".backup", category: "Temp & Cache", description: "Archive backup copies", defaultBlocked: true },
  { ext: ".old", category: "Temp & Cache", description: "Deprecated version backups", defaultBlocked: true },
  { ext: ".log", category: "Temp & Cache", description: "Diagnostic, install, and debug logs", defaultBlocked: true },
  { ext: ".cache", category: "Temp & Cache", description: "Application cache databases", defaultBlocked: true },
  { ext: ".dmp", category: "Temp & Cache", description: "Windows crash memory dumps", defaultBlocked: true },
  { ext: ".chk", category: "Temp & Cache", description: "Recovered Scandisk / Chkdsk fragments", defaultBlocked: true },
  { ext: ".part", category: "Temp & Cache", description: "Incomplete partial downloads", defaultBlocked: true },
  { ext: ".crdownload", category: "Temp & Cache", description: "Incomplete Chromium downloads", defaultBlocked: true },
  { ext: ".swp", category: "Temp & Cache", description: "Editor buffer swap files", defaultBlocked: true },

  // Build & Compiler Artifacts
  { ext: ".pdb", category: "Build Artifacts", description: "Program database debug symbol files", defaultBlocked: true },
  { ext: ".obj", category: "Build Artifacts", description: "Intermediate compiled object files", defaultBlocked: true },
  { ext: ".o", category: "Build Artifacts", description: "C/C++ compiled object binaries", defaultBlocked: true },
  { ext: ".lib", category: "Build Artifacts", description: "Static library archives", defaultBlocked: true },
  { ext: ".exp", category: "Build Artifacts", description: "Linker export symbols", defaultBlocked: true },
  { ext: ".ilk", category: "Build Artifacts", description: "Incremental linker databases", defaultBlocked: true },
  { ext: ".idb", category: "Build Artifacts", description: "Visual Studio compiler state", defaultBlocked: true },
  { ext: ".pyc", category: "Build Artifacts", description: "Python compiled bytecode", defaultBlocked: true },
  { ext: ".class", category: "Build Artifacts", description: "Java compiled bytecode", defaultBlocked: true },
  { ext: ".map", category: "Build Artifacts", description: "JavaScript source maps and linker maps", defaultBlocked: true },

  // Obscure Formats
  { ext: ".ink", category: "Obscure Formats", description: "Windows Tablet PC digital ink stroke files", defaultBlocked: true },
  { ext: ".lnk", category: "Obscure Formats", description: "Raw shortcut files in file search", defaultBlocked: true },
];

export const DEFAULT_BLOCKED_SET: string[] = KNOWN_NOISE_EXTENSIONS
  .filter((e) => e.defaultBlocked)
  .map((e) => e.ext.toLowerCase());

export interface ExtensionFilterConfig {
  filterEnabled: boolean; // default: true
  blockedExtensions: string[]; // active blocked extensions (e.g. [".ini", ".tmp", ...])
  customBlockedExtensions: string[]; // user-added extensions
}

const STORAGE_KEY = "altspace_extension_filter_config_v1";

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  } catch (_) {}
  return null;
}

/**
 * Retrieve active extension filter configuration from localStorage with safe defaults
 */
export function getExtensionFilterConfig(): ExtensionFilterConfig {
  try {
    const storage = getStorage();
    const raw = storage ? storage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.filterEnabled === "boolean" && Array.isArray(parsed.blockedExtensions)) {
        return {
          filterEnabled: parsed.filterEnabled,
          blockedExtensions: parsed.blockedExtensions.map((e: string) => e.toLowerCase()),
          customBlockedExtensions: Array.isArray(parsed.customBlockedExtensions)
            ? parsed.customBlockedExtensions.map((e: string) => e.toLowerCase())
            : [],
        };
      }
    }
  } catch (_) {}

  // Safe default: enabled with all standard noise extensions blocked
  return {
    filterEnabled: true,
    blockedExtensions: [...DEFAULT_BLOCKED_SET],
    customBlockedExtensions: [],
  };
}

/**
 * Persist extension filter configuration to localStorage
 */
export function saveExtensionFilterConfig(config: ExtensionFilterConfig): void {
  try {
    const storage = getStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  } catch (_) {}
}

/**
 * Check whether a file or path has an extension that is currently blocked.
 * If the user's search query specifically mentions or ends with that extension (e.g. searching "desktop.ini" or ".log"),
 * the filter gracefully permits it so explicit queries are never blocked!
 */
export function isExtensionBlocked(
  pathOrName: string,
  query?: string,
  config?: ExtensionFilterConfig
): boolean {
  const cfg = config || getExtensionFilterConfig();
  if (!cfg.filterEnabled) return false;

  const lastDot = pathOrName.lastIndexOf(".");
  if (lastDot === -1) return false;

  const ext = pathOrName.slice(lastDot).toLowerCase();
  if (!ext || ext.length <= 1) return false;

  // If user explicitly typed this extension in their query (e.g. query is "desktop.ini" or ends with ".ini"), do not block
  if (query) {
    const qLower = query.toLowerCase().trim();
    if (qLower.includes(ext) || qLower.endsWith(ext.replace(".", ""))) {
      return false;
    }
  }

  const allBlocked = new Set([
    ...cfg.blockedExtensions,
    ...cfg.customBlockedExtensions,
  ]);

  return allBlocked.has(ext);
}

/**
 * Toggle a specific extension between blocked and allowed
 */
export function toggleExtensionState(ext: string, shouldBlock: boolean): ExtensionFilterConfig {
  const normExt = (ext.startsWith(".") ? ext : `.${ext}`).toLowerCase();
  const cfg = getExtensionFilterConfig();

  const currentSet = new Set(cfg.blockedExtensions);
  if (shouldBlock) {
    currentSet.add(normExt);
  } else {
    currentSet.delete(normExt);
  }

  const updated: ExtensionFilterConfig = {
    ...cfg,
    blockedExtensions: Array.from(currentSet),
  };
  saveExtensionFilterConfig(updated);
  return updated;
}

/**
 * Toggle master noise filter on/off
 */
export function toggleMasterFilter(enabled: boolean): ExtensionFilterConfig {
  const cfg = getExtensionFilterConfig();
  const updated: ExtensionFilterConfig = {
    ...cfg,
    filterEnabled: enabled,
  };
  saveExtensionFilterConfig(updated);
  return updated;
}

/**
 * Add a custom extension to block
 */
export function addCustomBlockedExtension(ext: string): ExtensionFilterConfig {
  const normExt = (ext.startsWith(".") ? ext : `.${ext}`).toLowerCase().trim();
  if (normExt.length <= 1) return getExtensionFilterConfig();

  const cfg = getExtensionFilterConfig();
  const customSet = new Set(cfg.customBlockedExtensions);
  customSet.add(normExt);

  const blockedSet = new Set(cfg.blockedExtensions);
  blockedSet.add(normExt);

  const updated: ExtensionFilterConfig = {
    ...cfg,
    blockedExtensions: Array.from(blockedSet),
    customBlockedExtensions: Array.from(customSet),
  };
  saveExtensionFilterConfig(updated);
  return updated;
}

/**
 * Remove a custom blocked extension
 */
export function removeCustomBlockedExtension(ext: string): ExtensionFilterConfig {
  const normExt = (ext.startsWith(".") ? ext : `.${ext}`).toLowerCase().trim();
  const cfg = getExtensionFilterConfig();

  const customSet = new Set(cfg.customBlockedExtensions);
  customSet.delete(normExt);

  const blockedSet = new Set(cfg.blockedExtensions);
  blockedSet.delete(normExt);

  const updated: ExtensionFilterConfig = {
    ...cfg,
    blockedExtensions: Array.from(blockedSet),
    customBlockedExtensions: Array.from(customSet),
  };
  saveExtensionFilterConfig(updated);
  return updated;
}

/**
 * Reset extension filter to clean factory defaults
 */
export function resetExtensionFilterToDefault(): ExtensionFilterConfig {
  const defaults: ExtensionFilterConfig = {
    filterEnabled: true,
    blockedExtensions: [...DEFAULT_BLOCKED_SET],
    customBlockedExtensions: [],
  };
  saveExtensionFilterConfig(defaults);
  return defaults;
}
