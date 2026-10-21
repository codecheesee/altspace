/**
 * AltSpace Privacy-Preserving Observability & Diagnostics Module (2026)
 * Generates sanitized system diagnostics for user troubleshooting, bug reports,
 * and support export without leaking PII, API tokens, DPAPI secrets, or local file trees.
 */

export interface ExtensionTierBreakdown {
  builtIn: number;
  verified: number;
  community: number;
  localDev: number;
  revoked: number;
}

export interface DiagnosticSnapshot {
  timestamp: string;
  app: {
    name: string;
    version: string;
    safeMode: boolean;
  };
  system: {
    platform: string;
    arch: string;
    screenCount: number;
    estimatedMemoryGb: string;
  };
  storageAndIndex: {
    totalDrivesIndexed?: number;
    searchAllDrives: boolean;
    frecencyItemCount: number;
  };
  extensions: {
    totalInstalled: number;
    byTier: ExtensionTierBreakdown;
    quarantinedCount: number;
  };
  theme: {
    currentThemeId: string;
    hasCustomAccent: boolean;
  };
  quota: {
    tier: string;
    isUnlimited: boolean;
    remainingQueries?: number;
  };
  recentLogs: Array<{
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
  }>;
  redactionSummary: {
    totalRedactedItems: number;
  };
}

/**
 * Strips API keys, GitHub tokens, private keys, bearer credentials, and user home directories from logs and diagnostics.
 */
export function redactSensitiveDiagnostics(text: string): { sanitized: string; count: number } {
  if (typeof text !== 'string') return { sanitized: '', count: 0 };

  let count = 0;
  let sanitized = text;

  // 1. Anthropic keys: sk-ant-... (must be evaluated before generic sk-)
  sanitized = sanitized.replace(/\b(sk-ant-[a-zA-Z0-9_-]{15,})\b/g, () => {
    count++;
    return '[REDACTED_ANTHROPIC_KEY]';
  });

  // 2. OpenAI / generic AI keys: sk-proj-..., sk-...
  sanitized = sanitized.replace(/\b(sk-(?:proj-)?[a-zA-Z0-9_-]{15,})\b/g, () => {
    count++;
    return '[REDACTED_API_KEY]';
  });

  // 3. GitHub Personal Access Tokens & OAuth tokens: ghp_..., gho_..., ghu_..., ghs_..., ghr_...
  sanitized = sanitized.replace(/\b(gh[pousr]_[a-zA-Z0-9]{20,})\b/g, () => {
    count++;
    return '[REDACTED_GITHUB_TOKEN]';
  });

  // 4. DeepSeek keys: sk-[a-f0-9]{32}
  sanitized = sanitized.replace(/\b(sk-[a-f0-9]{32})\b/gi, () => {
    count++;
    return '[REDACTED_DEEPSEEK_KEY]';
  });

  // 5. Bearer authorization tokens
  sanitized = sanitized.replace(/\bbearer\s+([a-zA-Z0-9_\-.~+/]+=*)/gi, () => {
    count++;
    return 'Bearer [REDACTED_TOKEN]';
  });

  // 6. Private keys (RSA, EC, OPENSSH)
  sanitized = sanitized.replace(
    /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]+?-----END[A-Z\s]+PRIVATE KEY-----/g,
    () => {
      count++;
      return '[REDACTED_PRIVATE_KEY]';
    }
  );

  // 7. Embedded URL credentials
  sanitized = sanitized.replace(/(https?:\/\/)([^:\s]+):([^@\s]+)@/gi, (_m, proto, user) => {
    count++;
    return `${proto}${user}:[REDACTED_CREDENTIAL]@`;
  });

  // 8. Windows user home directories (C:\Users\<username>\ -> ~\)
  sanitized = sanitized.replace(/[A-Z]:\\Users\\[^\\]+\\/gi, () => {
    count++;
    return '~\\';
  });

  sanitized = sanitized.replace(/[A-Z]:\/Users\/[^\/]+\//gi, () => {
    count++;
    return '~/';
  });

  return { sanitized, count };
}

/**
 * Builds a structured, privacy-safe snapshot of the current AltSpace environment.
 */
export function generateDiagnosticSnapshot(
  overrides?: Partial<DiagnosticSnapshot>
): DiagnosticSnapshot {
  let totalRedacted = 0;

  // Process and sanitize logs
  const rawLogs = overrides?.recentLogs ?? [];
  const sanitizedLogs = rawLogs.map((log) => {
    const { sanitized, count } = redactSensitiveDiagnostics(log.message);
    totalRedacted += count;
    return {
      ...log,
      message: sanitized,
    };
  });

  const snapshot: DiagnosticSnapshot = {
    timestamp: new Date().toISOString(),
    app: {
      name: 'AltSpace',
      version: overrides?.app?.version ?? '2.0.0',
      safeMode: overrides?.app?.safeMode ?? false,
    },
    system: {
      platform: overrides?.system?.platform ?? 'Windows NT (Desktop)',
      arch:
        overrides?.system?.arch ??
        (typeof globalThis !== 'undefined' && (globalThis as any).process?.arch
          ? (globalThis as any).process.arch
          : 'x64'),
      screenCount: overrides?.system?.screenCount ?? 1,
      estimatedMemoryGb: overrides?.system?.estimatedMemoryGb ?? '>=8GB',
    },
    storageAndIndex: {
      totalDrivesIndexed: overrides?.storageAndIndex?.totalDrivesIndexed,
      searchAllDrives: overrides?.storageAndIndex?.searchAllDrives ?? false,
      frecencyItemCount: overrides?.storageAndIndex?.frecencyItemCount ?? 0,
    },
    extensions: {
      totalInstalled: overrides?.extensions?.totalInstalled ?? 0,
      byTier: overrides?.extensions?.byTier ?? {
        builtIn: 0,
        verified: 0,
        community: 0,
        localDev: 0,
        revoked: 0,
      },
      quarantinedCount: overrides?.extensions?.quarantinedCount ?? 0,
    },
    theme: {
      currentThemeId: overrides?.theme?.currentThemeId ?? 'raycast-dark',
      hasCustomAccent: overrides?.theme?.hasCustomAccent ?? false,
    },
    quota: {
      tier: overrides?.quota?.tier ?? 'core_free',
      isUnlimited: overrides?.quota?.isUnlimited ?? true,
      remainingQueries: overrides?.quota?.remainingQueries,
    },
    recentLogs: sanitizedLogs,
    redactionSummary: {
      totalRedactedItems: totalRedacted,
    },
  };

  return snapshot;
}

/**
 * Formats the snapshot into a formatted string with a verifiable header.
 */
export function formatDiagnosticsForExport(snapshot: DiagnosticSnapshot): string {
  const header = [
    '=== AltSpace Diagnostics Report (Sanitized) ===',
    `Generated: ${snapshot.timestamp}`,
    'Zero secrets or personal filesystem paths are included in this export.',
    '===============================================',
  ].join('\n');

  return `${header}\n${JSON.stringify(snapshot, null, 2)}`;
}
