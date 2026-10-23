import { tauriInvoke } from "./appStorage";

export type FeatureId =
  | "ports_advanced"
  | "developer_transforms"
  | "secret_vault"
  | "docker_wsl"
  | "local_copilot";

export interface FeatureMetadata {
  id: FeatureId;
  name: string;
  description: string;
  category: "Dev Tools" | "Security" | "Environment";
  isPro: boolean;
  defaultEnabled: boolean;
  keywords: string[];
}

export interface FeatureHealth {
  status: "healthy" | "healed" | "error";
  lastError?: string;
  errorCount: number;
  lastHealedAt?: number;
}

export interface FeatureState {
  enabled: boolean;
  health: FeatureHealth;
}

export type FeatureMatrixMap = Record<FeatureId, FeatureState>;

export const FEATURE_REGISTRY: Record<FeatureId, FeatureMetadata> = {
  ports_advanced: {
    id: "ports_advanced",
    name: "Intelligent Port & Process Recovery",
    description: "Deep process ancestry inspection, project detection, and safe port release.",
    category: "Dev Tools",
    isPro: true,
    defaultEnabled: true,
    keywords: ["port", "ports", "kill", "process", "pid", "5173", "3000", "8080", "eaddrinuse"],
  },
  developer_transforms: {
    id: "developer_transforms",
    name: "Native Developer Transforms",
    description: "Zero-network JWT inspector, JSON/YAML converter, regex lab, and hash toolkit.",
    category: "Dev Tools",
    isPro: true,
    defaultEnabled: true,
    keywords: ["jwt", "json", "yaml", "regex", "hash", "sha256", "base64", "decode", "encode"],
  },
  secret_vault: {
    id: "secret_vault",
    name: "DPAPI Secret & Environment Switcher",
    description: "Hardware-bound encrypted environment profiles with transient shell injection.",
    category: "Security",
    isPro: true,
    defaultEnabled: true,
    keywords: ["vault", "secret", "env", "staging", "dpapi", "credentials", "apikey"],
  },
  docker_wsl: {
    id: "docker_wsl",
    name: "Docker + WSL2 Cockpit",
    description: "Native Windows control plane for Compose services, container logs, and WSL memory.",
    category: "Environment",
    isPro: true,
    defaultEnabled: true,
    keywords: ["docker", "wsl", "container", "compose", "vmmem", "distro"],
  },
  local_copilot: {
    id: "local_copilot",
    name: "Private Local Copilot & Actions",
    description: "Approved multi-step developer recipes running 100% locally on Ollama.",
    category: "Dev Tools",
    isPro: true,
    defaultEnabled: true,
    keywords: ["ai", "copilot", "ollama", "explain", "recipe", "mcp"],
  },
};

const STORAGE_KEY = "altspace_feature_matrix_v2";

function getInitialState(): FeatureMatrixMap {
  const initial: Partial<FeatureMatrixMap> = {};
  for (const key of Object.keys(FEATURE_REGISTRY) as FeatureId[]) {
    initial[key] = {
      enabled: FEATURE_REGISTRY[key].defaultEnabled,
      health: {
        status: "healthy",
        errorCount: 0,
      },
    };
  }

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const key of Object.keys(FEATURE_REGISTRY) as FeatureId[]) {
          if (parsed[key] && typeof parsed[key].enabled === "boolean") {
            initial[key] = {
              enabled: parsed[key].enabled,
              health: parsed[key].health || { status: "healthy", errorCount: 0 },
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load feature matrix from storage, using defaults", e);
  }

  return initial as FeatureMatrixMap;
}

// Runtime in-memory reactive state
let currentState: FeatureMatrixMap = getInitialState();
const listeners = new Set<(state: FeatureMatrixMap) => void>();

function persistAndBroadcast() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    }
  } catch (e) {
    console.error("Failed to persist feature matrix:", e);
  }

  // Sync to Rust backend if Tauri is available
  if (tauriInvoke) {
    const flags: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(currentState)) {
      flags[k] = v.enabled;
    }
    tauriInvoke("set_feature_flags", { flags }).catch((err) => {
      console.warn("Could not sync feature flags with Tauri backend:", err);
    });
  }

  listeners.forEach((fn) => {
    try {
      fn({ ...currentState });
    } catch (e) {
      console.error("Listener error in featureMatrix:", e);
    }
  });
}

// Initial sync with backend on boot
if (typeof window !== "undefined") {
  setTimeout(() => {
    persistAndBroadcast();
  }, 100);
}

export function getFeatureMatrix(): FeatureMatrixMap {
  return { ...currentState };
}

export function isFeatureEnabled(id: FeatureId): boolean {
  return currentState[id]?.enabled ?? true;
}

export function setFeatureEnabled(id: FeatureId, enabled: boolean): void {
  if (!currentState[id]) return;
  currentState = {
    ...currentState,
    [id]: {
      ...currentState[id],
      enabled,
    },
  };
  persistAndBroadcast();
}

export function toggleFeature(id: FeatureId): boolean {
  if (!currentState[id]) return false;
  const next = !currentState[id].enabled;
  setFeatureEnabled(id, next);
  return next;
}

/**
 * Auto-healing Circuit Breaker:
 * Records an error on a feature. If errors accumulate, it marks status as "healed",
 * cleans state, and resets gracefully to prevent application crashes.
 */
export function recordFeatureError(id: FeatureId, errorMsg: string): void {
  const current = currentState[id];
  if (!current) return;

  const newCount = (current.health.errorCount || 0) + 1;
  const isHealed = newCount >= 3; // Auto-heal trigger threshold

  currentState = {
    ...currentState,
    [id]: {
      ...current,
      health: {
        status: isHealed ? "healed" : "error",
        lastError: errorMsg,
        errorCount: isHealed ? 0 : newCount,
        lastHealedAt: isHealed ? Date.now() : current.health.lastHealedAt,
      },
    },
  };
  persistAndBroadcast();
}

export function resetFeatureHealth(id: FeatureId): void {
  const current = currentState[id];
  if (!current) return;

  currentState = {
    ...currentState,
    [id]: {
      ...current,
      health: {
        status: "healthy",
        errorCount: 0,
        lastError: undefined,
      },
    },
  };
  persistAndBroadcast();
}

export function subscribeFeatureMatrix(callback: (state: FeatureMatrixMap) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
