import { tauriInvoke } from "./appStorage";
import type { StorePluginItem } from "../types";

export const COMMUNITY_PLUGINS: StorePluginItem[] = [
  {
    id: "dns-flusher",
    name: "Flush DNS Cache",
    description: "Instantly flushes and clears the Windows DNS resolver cache to fix network issues",
    keyword: ":dns",
    category: "Network",
    author: "Alex Rivera",
    authorGithub: "alexrivera",
    version: "1.2.0",
    downloads: 1420,
    rating: 4.9,
    royaltyPerSale: 1,
    icon: "globe",
    scriptFilename: "flush.ps1",
    scriptContent: `Clear-DnsClientCache
Write-Output "✅ Windows DNS Resolver Cache successfully flushed!"`,
    manifestJson: JSON.stringify({
      id: "dns-flusher",
      name: "Flush DNS Cache",
      description: "Instantly flushes Windows DNS cache",
      keyword: ":dns",
      script: "flush.ps1",
      icon: "globe",
    }, null, 2),
  },
  {
    id: "git-clean",
    name: "Git Branch Pruner",
    description: "Prunes dead remote tracking branches and removes merged local git branches",
    keyword: ":gitprune",
    category: "Dev Tools",
    author: "Sarah Chen",
    authorGithub: "sarahchen",
    version: "2.0.1",
    downloads: 2850,
    rating: 5.0,
    royaltyPerSale: 1,
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
    manifestJson: JSON.stringify({
      id: "git-clean",
      name: "Git Branch Pruner",
      description: "Prunes dead remote branches and cleans merged local branches",
      keyword: ":gitprune",
      script: "clean.ps1",
      icon: "git",
    }, null, 2),
  },
  {
    id: "jwt-decoder",
    name: "JWT Token Inspector",
    description: "Decodes and inspects JSON Web Tokens directly from clipboard or text",
    keyword: ":jwt",
    category: "Dev Tools",
    author: "Rajat Kapoor",
    authorGithub: "rajatkapoor",
    version: "1.0.4",
    downloads: 980,
    rating: 4.8,
    royaltyPerSale: 1,
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
    manifestJson: JSON.stringify({
      id: "jwt-decoder",
      name: "JWT Token Inspector",
      description: "Decodes JSON Web Tokens from clipboard or parameter",
      keyword: ":jwt",
      script: "jwt.ps1",
      icon: "code",
    }, null, 2),
  },
  {
    id: "wifi-passwords",
    name: "Wi-Fi Key Finder",
    description: "Lists all saved Wi-Fi networks and reveals saved security keys instantly",
    keyword: ":wifi",
    category: "Network",
    author: "Dan Kovacs",
    authorGithub: "dankovacs",
    version: "1.1.0",
    downloads: 3100,
    rating: 4.9,
    royaltyPerSale: 1,
    icon: "network",
    scriptFilename: "wifi.ps1",
    scriptContent: `netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object {
    $name = ($_ -split ":")[1].Trim()
    $passLine = (netsh wlan show profile name="$name" key=clear | Select-String "Key Content")
    $pass = if ($passLine) { ($passLine -split ":")[1].Trim() } else { "<None / Open>" }
    [PSCustomObject]@{ 'Network (SSID)' = $name; 'Security Key' = $pass }
} | Format-Table -AutoSize | Out-String`,
    manifestJson: JSON.stringify({
      id: "wifi-passwords",
      name: "Wi-Fi Key Finder",
      description: "Reveals saved Wi-Fi passwords for quick troubleshooting",
      keyword: ":wifi",
      script: "wifi.ps1",
      icon: "network",
    }, null, 2),
  },
  {
    id: "docker-clean",
    name: "Docker System Prune",
    description: "Reclaims gigabytes of disk space by removing dead containers, images and cache",
    keyword: ":dockerprune",
    category: "Dev Tools",
    author: "Elena Rostova",
    authorGithub: "elenarostova",
    version: "1.3.2",
    downloads: 1650,
    rating: 4.9,
    royaltyPerSale: 1,
    icon: "terminal",
    scriptFilename: "prune.ps1",
    scriptContent: `docker system prune -f
Write-Output "🐳 Stopped containers, untagged images, and build cache successfully purged!"`,
    manifestJson: JSON.stringify({
      id: "docker-clean",
      name: "Docker System Prune",
      description: "Purges stopped containers and dangling images to save disk space",
      keyword: ":dockerprune",
      script: "prune.ps1",
      icon: "terminal",
    }, null, 2),
  },
  {
    id: "ip-inspector",
    name: "Local Network & IP Inspector",
    description: "Inspects local IPv4/IPv6 addresses, active default gateway and DNS servers",
    keyword: ":ip",
    category: "System",
    author: "AltSpace Core",
    authorGithub: "altspace-dev",
    version: "1.0.0",
    downloads: 4200,
    rating: 5.0,
    royaltyPerSale: 1,
    icon: "globe",
    scriptFilename: "get_ip.ps1",
    scriptContent: `Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -Property IPAddress, InterfaceAlias | Format-Table -AutoSize | Out-String`,
    manifestJson: JSON.stringify({
      id: "ip-inspector",
      name: "Local Network & IP Inspector",
      description: "Inspects local IPv4/IPv6 addresses and active default gateway",
      keyword: ":ip",
      script: "get_ip.ps1",
      icon: "globe",
    }, null, 2),
  },
];

export async function installCommunityPlugin(plugin: StorePluginItem): Promise<void> {
  await tauriInvoke("install_plugin", {
    pluginId: plugin.id,
    manifestJson: plugin.manifestJson,
    scriptContent: plugin.scriptContent,
    scriptFilename: plugin.scriptFilename,
  });
}

export async function uninstallCommunityPlugin(pluginId: string): Promise<void> {
  await tauriInvoke("uninstall_plugin", {
    pluginId,
  });
}
