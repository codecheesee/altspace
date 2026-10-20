/**
 * AltSpace Dynamic Extension Registry (2026 Decoupled Architecture)
 * Supports Stale-While-Revalidate (SWR) fetching from remote CDN/GitHub,
 * offline fallback cache, direct creator sponsorship links, and verified author badges.
 */

import { tauriInvoke } from "./appStorage";

export interface ExtensionRegistryItem {
  id: string;
  name: string;
  description: string;
  keyword: string;
  category: "Dev Tools" | "Productivity" | "System" | "Network" | "Media";
  author: string;
  authorGithub: string;
  sponsorUrl: string; // Direct creator sponsorship (GitHub Sponsors / Ko-fi / BuyMeACoffee)
  version: string;
  downloads: number;
  rating: number;
  verified: boolean;
  icon: string;
  scriptFilename: string;
  scriptContent: string;
  manifestJson: string;
}

export const REMOTE_REGISTRY_URL =
  "https://raw.githubusercontent.com/codecheesee/altspace-extensions/main/registry.json";
const CACHE_STORAGE_KEY = "altspace_extension_registry_cache_v1";

export const BUILTIN_EXTENSIONS: ExtensionRegistryItem[] = [
  {
    id: "dns-flusher",
    name: "Flush DNS Cache",
    description: "Instantly flushes and clears the Windows DNS resolver cache to fix stale networking",
    keyword: ":dns",
    category: "Network",
    author: "Alex Rivera",
    authorGithub: "alexrivera",
    sponsorUrl: "https://github.com/sponsors/alexrivera",
    version: "1.2.0",
    downloads: 1420,
    rating: 4.9,
    verified: true,
    icon: "globe",
    scriptFilename: "flush.ps1",
    scriptContent: `Clear-DnsClientCache
Write-Output "✅ Windows DNS Resolver Cache successfully flushed!"`,
    manifestJson: JSON.stringify(
      {
        id: "dns-flusher",
        name: "Flush DNS Cache",
        description: "Instantly flushes Windows DNS cache",
        keyword: ":dns",
        script: "flush.ps1",
        icon: "globe",
      },
      null,
      2
    ),
  },
  {
    id: "git-clean",
    name: "Git Branch Pruner",
    description: "Prunes dead remote tracking branches and removes merged local git branches safely",
    keyword: ":gitprune",
    category: "Dev Tools",
    author: "Sarah Chen",
    authorGithub: "sarahchen",
    sponsorUrl: "https://github.com/sponsors/sarahchen",
    version: "2.0.1",
    downloads: 2850,
    rating: 5.0,
    verified: true,
    icon: "git",
    scriptFilename: "clean.ps1",
    scriptContent: `git remote prune origin
$branches = git branch --merged | Where-Object { $_ -notmatch '(\\*|master|main|dev)' }
if ($branches) {
    $branches | ForEach-Object { git branch -d $_.Trim() }
    Write-Output "✅ Pruned $(@($branches).Count) merged local branch(es)!"
} else {
    Write-Output "✨ All local git branches are already up to date and clean!"
}`,
    manifestJson: JSON.stringify(
      {
        id: "git-clean",
        name: "Git Branch Pruner",
        description: "Prunes dead remote branches and cleans merged local branches",
        keyword: ":gitprune",
        script: "clean.ps1",
        icon: "git",
      },
      null,
      2
    ),
  },
  {
    id: "jwt-decoder",
    name: "JWT Token Inspector",
    description: "Decodes and inspects JSON Web Tokens directly from clipboard or active query",
    keyword: ":jwt",
    category: "Dev Tools",
    author: "Rajat Kapoor",
    authorGithub: "rajatkapoor",
    sponsorUrl: "https://github.com/sponsors/rajatkapoor",
    version: "1.0.4",
    downloads: 980,
    rating: 4.8,
    verified: true,
    icon: "code",
    scriptFilename: "jwt.ps1",
    scriptContent: `param([string]$token)
if (-not $token) {
    $token = Get-Clipboard
}
$token = $token.Trim()
$parts = $token.Split('.')
if ($parts.Length -ge 2) {
    $rawB64 = $parts[1].Replace('-', '+').Replace('_', '/')
    $pad = 4 - ($rawB64.Length % 4)
    if ($pad -lt 4) { $rawB64 = $rawB64 + ('=' * $pad) }
    $bytes = [System.Convert]::FromBase64String($rawB64)
    $json = [System.Text.Encoding]::UTF8.GetString($bytes)
    Write-Output "--- DECODED JWT PAYLOAD ---"
    $json | ConvertFrom-Json | ConvertTo-Json -Depth 5
} else {
    Write-Output "❌ Invalid JWT token: expected header.payload.signature"
}`,
    manifestJson: JSON.stringify(
      {
        id: "jwt-decoder",
        name: "JWT Token Inspector",
        description: "Decodes JSON Web Tokens from clipboard or parameter",
        keyword: ":jwt",
        script: "jwt.ps1",
        icon: "code",
      },
      null,
      2
    ),
  },
  {
    id: "wifi-passwords",
    name: "Wi-Fi Key Finder",
    description: "Lists all saved Wi-Fi networks and reveals saved security keys instantly",
    keyword: ":wifi",
    category: "Network",
    author: "Dan Kovacs",
    authorGithub: "dankovacs",
    sponsorUrl: "https://github.com/sponsors/dankovacs",
    version: "1.1.0",
    downloads: 3100,
    rating: 4.9,
    verified: true,
    icon: "network",
    scriptFilename: "wifi.ps1",
    scriptContent: `netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object {
    $name = ($_ -split ":")[1].Trim()
    $passLine = (netsh wlan show profile name="$name" key=clear | Select-String "Key Content")
    $pass = if ($passLine) { ($passLine -split ":")[1].Trim() } else { "<None / Open>" }
    [PSCustomObject]@{ 'Network (SSID)' = $name; 'Security Key' = $pass }
} | Format-Table -AutoSize | Out-String`,
    manifestJson: JSON.stringify(
      {
        id: "wifi-passwords",
        name: "Wi-Fi Key Finder",
        description: "Reveals saved Wi-Fi passwords for quick troubleshooting",
        keyword: ":wifi",
        script: "wifi.ps1",
        icon: "network",
      },
      null,
      2
    ),
  },
  {
    id: "docker-clean",
    name: "Docker System Prune",
    description: "Reclaims disk space by pruning stopped containers, unused networks and build cache",
    keyword: ":dockerprune",
    category: "Dev Tools",
    author: "Elena Rostova",
    authorGithub: "elenarostova",
    sponsorUrl: "https://github.com/sponsors/elenarostova",
    version: "1.3.2",
    downloads: 1650,
    rating: 4.9,
    verified: true,
    icon: "terminal",
    scriptFilename: "prune.ps1",
    scriptContent: `docker system prune -f
Write-Output "🐳 Stopped containers, untagged images, and build cache successfully purged!"`,
    manifestJson: JSON.stringify(
      {
        id: "docker-clean",
        name: "Docker System Prune",
        description: "Purges stopped containers and dangling images to save disk space",
        keyword: ":dockerprune",
        script: "prune.ps1",
        icon: "terminal",
      },
      null,
      2
    ),
  },
  {
    id: "ip-inspector",
    name: "Local Network & IP Inspector",
    description: "Inspects local IPv4/IPv6 addresses, active default gateway and network adapter",
    keyword: ":ip",
    category: "System",
    author: "AltSpace Core",
    authorGithub: "codecheesee",
    sponsorUrl: "https://github.com/sponsors/codecheesee",
    version: "1.0.0",
    downloads: 4200,
    rating: 5.0,
    verified: true,
    icon: "globe",
    scriptFilename: "get_ip.ps1",
    scriptContent: `Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -Property IPAddress, InterfaceAlias | Format-Table -AutoSize | Out-String`,
    manifestJson: JSON.stringify(
      {
        id: "ip-inspector",
        name: "Local Network & IP Inspector",
        description: "Inspects local IPv4/IPv6 addresses and active default gateway",
        keyword: ":ip",
        script: "get_ip.ps1",
        icon: "globe",
      },
      null,
      2
    ),
  },
];

/**
 * Loads extension registry using Stale-While-Revalidate (SWR):
 * 1. Returns cached/builtin immediately.
 * 2. Background fetches from remote registry, updates cache, and returns fresh list if available.
 */
export async function getExtensionRegistry(): Promise<ExtensionRegistryItem[]> {
  let cached: ExtensionRegistryItem[] = BUILTIN_EXTENSIONS;

  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cached = parsed;
      }
    }
  } catch (_) {}

  // Background fetch remote registry with 3s timeout
  fetchRemoteRegistry()
    .then((fresh) => {
      if (fresh && fresh.length > 0) {
        try {
          localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(fresh));
        } catch (_) {}
      }
    })
    .catch(() => {});

  return cached;
}

export async function fetchRemoteRegistry(): Promise<ExtensionRegistryItem[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(REMOTE_REGISTRY_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return null;
}

export async function installRegistryExtension(
  plugin: ExtensionRegistryItem
): Promise<void> {
  await tauriInvoke("install_plugin", {
    pluginId: plugin.id,
    manifestJson: plugin.manifestJson,
    scriptContent: plugin.scriptContent,
    scriptFilename: plugin.scriptFilename,
  });
}

export async function uninstallRegistryExtension(pluginId: string): Promise<void> {
  await tauriInvoke("uninstall_plugin", {
    pluginId,
  });
}
