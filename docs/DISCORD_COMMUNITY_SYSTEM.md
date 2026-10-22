# Codecheesee Builds — Discord Community Architecture & Operational Blueprint

> **Creator-Led Community System for AltSpace and Future Product Areas**  
> *Author: Rohan (@codecheesee) / Community & Security Engineering*  
> *Standard: Discord Community v2 (2026) • Zero-Client-Secret Architecture*

---

## 1. Executive Architecture Recommendation

### The Creator-Led Model
A common failure in indie software is creating an isolated Discord server for every app. This fragments attention, forces community members to join multiple servers, multiplies moderation overhead, and leaves new products launching to an empty audience.

Instead, we deploy a **creator-led product studio community** under the umbrella **`Codecheesee Builds`**. 
- **The Trust Layer**: Rohan as the creator and systems developer building fast, private developer tools for Windows and beyond.
- **The Discovery Layer**: Individual product areas (`AltSpace`, followed by future developer utilities).
- **The Operational Boundary**: The desktop application (`AltSpace`) and the Discord server remain decoupled. AltSpace works 100% offline with zero Discord dependency. Discord roles provide community recognition and beta channels, but **never** act as the cryptographic licensing authority.

```
Codecheesee Builds (Creator Umbrella Server)
├── 📢 START HERE            (Rules, announcements, global roadmap, intros)
├── 💬 DEVELOPER COMMUNITY   (Windows, Rust, Local AI, Docker/WSL, lounge)
├── 🚀 ALTSPACE              (Start here, support, bug forums, feature forums, releases)
├── 🔮 FUTURE PRODUCTS       (Prototypes, beta waitlists, product registry expansion)
├── 🎙️ VOICE & STAGES        (Office hours, build-in-public sessions, debugging)
└── 🛡️ STAFF & OPS           (Private incident logs, alerts, escalations)
```

---

## 2. Server Naming Recommendation

| Candidate Name | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **`Codecheesee Builds`** | Active, personal, developer-focused, implies continuous creation and craftsmanship. | Less corporate. | **Selected & Recommended** |
| **`Rohan's Lab`** | Strong R&D/experimental vibe, great for open-source exploration. | Can feel informal or non-commercial. | Strong alternative |
| **`Rohan Labs`** | Sound like an established software studio. | Slightly generic; creates expectation of a larger firm. | Corporate fallback |

### Public Server Positioning
> **Server Name**: `Codecheesee Builds`  
> **Server Tagline**: *Fast, private developer tools for Windows and beyond.*  
> **Server Description**:  
> "A developer community for fast, private Windows tools built by Rohan. Get support for AltSpace, explore local AI and systems engineering, join beta tests, share workflows, and help shape the roadmap."

---

## 3. Complete Channel & Category Plan

```
================================================================================
CATEGORY: START HERE (Visible by default)
================================================================================
#welcome               [Read-only] Server mission, community guidelines, where to go.
#rules                 [Read-only] Official rules screened before new members can post.
#announcements         [Announcement Channel] Major releases, security updates, launches.
#roadmap               [Forum/Read-only] High-level studio roadmap with status tags.
#changelog             [Read-only] Concise cross-product changelogs.
#introductions         [Chat] Formatted intro prompt for new members.

================================================================================
CATEGORY: DEVELOPER COMMUNITY (Visible based on onboarding interest)
================================================================================
#general               [Chat] General tech, development, and studio conversation.
#developer-lounge      [Chat] Relaxed developer banter, workstations, hardware.
#windows-dev           [Chat] Windows 10/11 internals, Win32, App SDK, Tauri, MSIX.
#rust-and-systems      [Chat] Rust, systems programming, performance, memory safety.
#typescript-react      [Chat] React 19, TypeScript, UI architecture, Tailwind.
#local-ai              [Chat] Ollama, local LLMs, llama.cpp, quantization, agents.
#docker-and-wsl        [Chat] WSL2 networking, container recovery, port forwarding.
#show-and-tell         [Chat] Share projects, tools, scripts, and workflows.

================================================================================
CATEGORY: ALTSPACE (Dedicated Product Area)
================================================================================
#altspace-start-here   [Read-only] Download links, quick start, hotkeys, security model.
#altspace-support      [Chat] User troubleshooting and community peer support.
#altspace-bug-reports  [Forum Channel] Structured bug submissions with tags and templates.
#altspace-feature-reqs [Forum Channel] Upvoted feature proposals with status tracking.
#altspace-workflows    [Chat] User recipes: port cleanups, Ollama setups, WSL workflows.
#altspace-beta         [Private Channel] Role-gated for @AltSpace Beta testers.
#altspace-releases     [Announcement Channel] GitHub Actions webhook feed (read-only).

================================================================================
CATEGORY: FUTURE PRODUCTS (Minimal Studio Growth Hub)
================================================================================
#future-products-hub   [Read-only] Registry of planned tools and experimental prototypes.
#product-ideas         [Forum Channel] Community suggestions for new Windows developer utilities.
#beta-waitlists        [Chat/Bot] Self-serve role opt-in for upcoming product testing.

================================================================================
CATEGORY: VOICE & STAGES
================================================================================
🔊 Developer Lounge    [Voice] Casual audio hangout while coding.
🔊 Build Together      [Voice] Co-working, screen sharing, pair debugging.
🎙️ Office Hours        [Stage Channel] Monthly roadmap AMAs and live product walkthroughs.

================================================================================
CATEGORY: STAFF & MODERATION (Role-gated: Admin & Moderator only)
================================================================================
#mod-chat              [Private Chat] Internal discussion and moderation decisions.
#mod-alerts            [Private Feed] AutoMod alerts, join spikes, raid warnings.
#incident-log          [Private Feed] Audit trail of bans, warnings, leaked token alerts.
#support-escalations   [Private Chat] Severe bug escalations and security notices.
#content-calendar      [Private Chat] Scheduled releases, announcements, blog drafts.
```

### Forum Channel Specifications

#### 1. `#altspace-bug-reports`
- **Default Reaction**: 🐛
- **Tags**:
  - `[Subsystem]`: `install`, `search`, `tcp-ports`, `docker-wsl`, `clipboard`, `ollama-ai`, `dpapi-vault`
  - `[Severity]`: `crash`, `performance`, `regression`, `security`
  - `[OS]`: `windows-10`, `windows-11`, `wsl2`
- **Post Guidelines & Template**:
```markdown
## Environment
- AltSpace Version: (e.g. 2.2.0)
- Windows Build: (Run `winver`, e.g. Windows 11 23H2 Build 22631)
- Architecture: (x64 / arm64)
- Subsystems involved: [ ] Docker  [ ] WSL2  [ ] Ollama  [ ] None

## Description of the Issue
A concise explanation of what went wrong.

## Reproduction Steps
1. Open AltSpace with `Alt + Space`
2. Run command `...`
3. Click on `...`

## Expected vs Actual Behavior
- Expected:
- Actual:

## Sanitized Diagnostics
*(Paste output from AltSpace Settings -> Copy Sanitized Diagnostics)*
> ⚠️ Never paste API keys, private tokens, passwords, or full local file paths.
```

#### 2. `#altspace-feature-reqs`
- **Default Reaction**: 👍
- **Tags**: `under-review`, `planned`, `prototype`, `community-vote`, `not-now`, `shipped`
- **Post Guidelines**:
  - One feature proposal per thread.
  - Search existing threads before posting to avoid duplicates.
  - Detail the developer use case and workflow impact, not just a bare button request.

---

## 4. Role Hierarchy & Permission Matrix

Discord roles are evaluated from top to bottom. Bots must stay below human administrators.

```
[Hierarchy Level] Role Name         Type          Channel Access & Purpose
--------------------------------------------------------------------------------
100               Owner             Staff         Full server ownership.
90                Administrator     Staff         Management, AutoMod, Bot config.
80                Moderator         Staff         Timeout, kick, ban, manage threads.
70                Support Engineer  Staff         Manage forum tags, resolve issues.
65                Rohan (Creator)   Identity      Verified creator badge.
60                Studio Bot        System        Slash commands, announcements, webhooks.
50                Verified Contrib  Recognition   GitHub code/docs contributors.
40                AltSpace Pro      Commercial    Access to #altspace-beta & Pro flair.
35                Sponsor           Recognition   GitHub / Lemon Squeezy patrons.
30                Early Builder     Recognition   Founding 100 members.
25                AltSpace Beta     Product       Access to #altspace-beta channel.
20                AltSpace User     Product       Access to AltSpace product category.
15                Future App Tester Product       Access to future test categories.
10                [Interest Roles]  Topics        Unlocks topic channels (Rust, WSL, AI).
0                 @everyone         Base          Read Start Here, verify rules screening.
```

### Permission Matrix

| Role | View Channels | Send Messages | Attach Files | Add Reactions | Mention @everyone | Manage Threads | Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Owner / Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Moderator** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Support Engineer** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Studio Bot** | ✅ | ✅ | ✅ | ✅ | ❌ (Allowed Mentions) | ✅ | ❌ |
| **Verified Member** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **@everyone** | Limited | Limited | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 5. Community Onboarding Design

Using native **Discord Community Onboarding** ensures new members only see channels relevant to their stack, avoiding the "empty mall" or "overwhelming channel dump".

### Onboarding Flow Questions

#### Question 1: What brings you to Codecheesee Builds? *(Multi-select)*
- `[ ]` I am using AltSpace on Windows *(Assigns `@AltSpace User`, reveals `#altspace-*`)*
- `[ ]` I want to test pre-release builds *(Assigns `@AltSpace Beta`, reveals `#altspace-beta`)*
- `[ ]` I am an open-source contributor *(Assigns `@Verified Contributor` review queue)*
- `[ ]` I want to follow future developer tools *(Assigns `@Future App Tester`)*
- `[ ]` I just want developer discussions *(Unlocks `#developer-community`)*

#### Question 2: Which technologies are in your daily workflow? *(Multi-select)*
- `[ ]` Windows Internals / Win32 / Tauri *(Assigns `@Windows Dev`, reveals `#windows-dev`)*
- `[ ]` Rust & Systems Programming *(Assigns `@Rust`, reveals `#rust-and-systems`)*
- `[ ]` TypeScript & React *(Assigns `@React Dev`, reveals `#typescript-react`)*
- `[ ]` Docker & WSL2 *(Assigns `@Docker/WSL`, reveals `#docker-and-wsl`)*
- `[ ]` Ollama & Local AI *(Assigns `@Local AI`, reveals `#local-ai`)*

#### Question 3: How do you prefer to participate? *(Multi-select)*
- `[ ]` Get help and troubleshoot problems
- `[ ]` Suggest features and vote on roadmaps
- `[ ]` Share developer workflows and setups
- `[ ]` Attend monthly voice office hours and demos
- `[ ]` Read release announcements only

#### Question 4: What is your primary operating system? *(Single-select)*
- `( )` Windows 11
- `( )` Windows 10
- `( )` Linux / WSL2 primary
- `( )` macOS (cross-platform developer)

---

## 6. Rules, Safety & Privacy Policy

### Server Rules Copy (Rules Screening)

1. **Be Constructive and Respectful**: Treat fellow builders with dignity. Harassment, condescension, discrimination, or hate speech will result in an immediate ban.
2. **Never Post Secrets or Unsanitized Data**: Do not post API keys (`sk-...`, `ghp_...`), private keys, passwords, `.env` files, DPAPI tokens, machine paths with personal names, or unredacted terminal logs. Staff will never ask for your passwords or private tokens.
3. **Keep Support in Public Forums**: Use `#altspace-bug-reports` and `#altspace-support`. Do not DM Rohan or staff members directly for technical support.
4. **No Spam, Piracy, or Unsolicited Promotion**: No warez, cracked software, unauthorized affiliate links, crypto pump schemes, or unsolicited direct messaging of members.
5. **Responsible Security Disclosure**: If you discover a security vulnerability in AltSpace or any studio tool, **do not post it publicly**. Email `security@altspace.dev` or file a private GitHub Security Advisory.
6. **One Feature Request Per Thread**: Keep feature proposals focused and use the search bar before submitting duplicate topics.
7. **Moderator Discretion**: Staff enforce rules according to their intent. Attempts to lawyer edge cases will not be entertained.

### Free vs. Pro Community Policy
> **Community First**: The `Codecheesee Builds` server is a public engineering space. Free and open-source users have full access to general support, bug reporting, feature voting, and public releases. `AltSpace Pro` is a financial and operational license that unlocks cosmetic recognition (`@AltSpace Pro`), access to early development previews (`#altspace-beta`), and expedited triage—it **never** paywalls essential troubleshooting or community knowledge.

---

## 7. AutoMod & Raid Protection Configuration

### AutoMod Rules Configuration

```json
{
  "rules": [
    {
      "name": "Block Malicious Invites",
      "eventType": "MESSAGE_SEND",
      "triggerType": "KEYWORD",
      "triggerMetadata": {
        "regexPatterns": [
          "(?:https?://)?(?:www\\.)?(?:discord\\.(?:gg|io|me|li)|discordapp\\.com/invite)/[a-zA-Z0-9]+"
        ],
        "allowList": [
          "https://discord.gg/codecheesee",
          "https://discord.gg/altspace"
        ]
      },
      "actions": [{ "type": "BLOCK_MESSAGE" }, { "type": "SEND_ALERT_MESSAGE", "channelId": "mod-alerts" }]
    },
    {
      "name": "Surgical Secret & Token Redaction Alert",
      "eventType": "MESSAGE_SEND",
      "triggerType": "KEYWORD",
      "triggerMetadata": {
        "regexPatterns": [
          "gh[pous]_[0-9a-zA-Z]{36}",
          "sk-(?:proj-)?[a-zA-Z0-9_-]{20,}",
          "sk-ant-[a-zA-Z0-9_-]{20,}",
          "-----BEGIN[A-Z\\s]+PRIVATE KEY-----",
          "ey[A-Za-z0-9-_=]+\\.ey[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*"
        ]
      },
      "actions": [
        { "type": "BLOCK_MESSAGE" },
        { "type": "SEND_ALERT_MESSAGE", "channelId": "mod-alerts" }
      ]
    },
    {
      "name": "Scam & Phishing Block",
      "eventType": "MESSAGE_SEND",
      "triggerType": "KEYWORD",
      "triggerMetadata": {
        "keywordFilter": [
          "*free nitro*",
          "*steam gift*",
          "*airdrop*",
          "*dm me for activation*",
          "*cracked altspace*",
          "*telegram t.me/*"
        ]
      },
      "actions": [
        { "type": "BLOCK_MESSAGE" },
        { "type": "TIMEOUT", "durationSeconds": 3600 },
        { "type": "SEND_ALERT_MESSAGE", "channelId": "mod-alerts" }
      ]
    },
    {
      "name": "Anti-Mention Spam",
      "eventType": "MESSAGE_SEND",
      "triggerType": "MENTION_SPAM",
      "triggerMetadata": {
        "mentionTotalLimit": 4
      },
      "actions": [
        { "type": "BLOCK_MESSAGE" },
        { "type": "TIMEOUT", "durationSeconds": 1800 },
        { "type": "SEND_ALERT_MESSAGE", "channelId": "mod-alerts" }
      ]
    }
  ]
}
```

*Note on False Positive Prevention*: Generic keywords such as `token`, `password`, `secret`, `hash`, or `dpapi` are **never** blocked globally, as this breaks normal technical discussions in `#windows-dev` and `#rust-and-systems`. Only strict cryptographic patterns (e.g., GitHub PAT prefixes, PEM blocks) trigger message rejection.

### Raid Protection & Verification Settings
- **Verification Level**: **Medium** (Registered on Discord for > 5 minutes). Escalated to **High** during incident response.
- **Explicit Media Content Filter**: Scan media content from all members.
- **2FA Requirement for Moderation**: Enforced on all Staff/Admin roles.

---

## 8. Discord Bot Command Specification

The umbrella bot is titled **`Codecheesee Builds Community`**. It runs via **Discord Interactions (Slash Commands)** over HTTPS, avoiding privileged Gateway Intents (0 message content intent required).

```
/help                     -> Displays command overview and official resources.
/community                -> Shows community mission, guidelines, and GitHub links.
/altspace
  ├── docs [topic]        -> Search or display documentation links.
  ├── support [topic]     -> Ephemeral troubleshooting guide & forum link.
  ├── roadmap             -> Current sprint status, planned features, and voting link.
  ├── release [version]   -> Details and download link for latest/specified version.
  ├── beta                -> Instructions for enrolling in beta releases.
  └── report              -> Ephemeral guide with pre-filled bug report template.
/product
  ├── list                -> Shows all studio products (AltSpace, Future Tools).
  └── status [slug]       -> Live status, version, and operational telemetry.
```

### Command Behavior & Ephemeral Flows
When a user calls `/altspace report` or `/altspace support`, the bot responds with an **ephemeral message** (visible only to the caller). This prevents sensitive diagnostic information from being pasted into public channels and directs them to `#altspace-bug-reports` with the sanitized markdown template ready.

---

## 9. Product Registry Schema

To ensure future applications can be added without modifying the core bot or redeploying server infrastructure, products are registered via a structured configuration file.

### JSON Schema (`products.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "StudioProductRegistry",
  "type": "object",
  "required": ["version", "products"],
  "properties": {
    "version": { "type": "integer" },
    "products": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "slug",
          "name",
          "tagline",
          "websiteUrl",
          "docsUrl",
          "downloadUrl",
          "githubRepo",
          "discordCategoryName",
          "status",
          "enabled"
        ],
        "properties": {
          "slug": { "type": "string" },
          "name": { "type": "string" },
          "tagline": { "type": "string" },
          "description": { "type": "string" },
          "currentVersion": { "type": "string" },
          "websiteUrl": { "type": "string", "format": "uri" },
          "docsUrl": { "type": "string", "format": "uri" },
          "downloadUrl": { "type": "string", "format": "uri" },
          "githubRepo": { "type": "string" },
          "discordCategoryName": { "type": "string" },
          "supportChannelId": { "type": "string" },
          "bugForumChannelId": { "type": "string" },
          "featureForumChannelId": { "type": "string" },
          "releaseChannelId": { "type": "string" },
          "userRoleId": { "type": "string" },
          "betaRoleId": { "type": "string" },
          "proRoleId": { "type": "string" },
          "status": { "type": "string", "enum": ["concept", "alpha", "beta", "active", "deprecated"] },
          "enabled": { "type": "boolean" }
        }
      }
    }
  }
}
```

### Default Registry (`products.json`)
```json
{
  "version": 1,
  "products": [
    {
      "slug": "altspace",
      "name": "AltSpace",
      "tagline": "Native Windows developer control plane",
      "description": "Fast file search, port inspection, Docker/WSL utilities, DPAPI vault, and local Ollama AI.",
      "currentVersion": "2.2.0",
      "websiteUrl": "https://altspace.dev",
      "docsUrl": "https://docs.altspace.dev",
      "downloadUrl": "https://github.com/codecheesee/altspace/releases/latest",
      "githubRepo": "codecheesee/altspace",
      "discordCategoryName": "ALTSPACE",
      "supportChannelId": "123456789012345678",
      "bugForumChannelId": "123456789012345679",
      "featureForumChannelId": "123456789012345680",
      "releaseChannelId": "123456789012345681",
      "userRoleId": "123456789012345682",
      "betaRoleId": "123456789012345683",
      "proRoleId": "123456789012345684",
      "status": "active",
      "enabled": true
    }
  ]
}
```

---

## 10. OAuth2 & Account-Linking Architecture

Account linking connects a user's Discord profile with their purchase/sponsor entitlement so the bot can assign the `@AltSpace Pro` or `@Sponsor` role.

### Security Boundary
- The desktop app **never** handles Discord OAuth secrets.
- Flow is initiated from the studio website (`https://account.codecheesee.dev/connect/discord`).
- CSRF protection uses an encrypted, short-lived `state` parameter containing a cryptographically random nonce and customer ID.

```
+----------------+      1. Click "Link Discord"     +--------------------+
|  User Browser  | -------------------------------> |  Studio Web Server |
+----------------+                                  +--------------------+
        |                                                      |
        | 2. Redirect to Discord OAuth2 with state             | 3. Generate state
        v                                                      v
+----------------+                                    (Store state in DB)
|  Discord Auth  |
+----------------+
        |
        | 4. User Approves -> Redirects to /callback?code=...&state=...
        v
+--------------------+
|  Studio Backend    |
+--------------------+
        | 5. Validate state & exchange code for access_token
        | 6. Fetch Discord User ID via GET /users/@me
        | 7. Query Entitlement DB for Pro/Sponsor status
        | 8. Call Discord REST API: PUT /guilds/{id}/members/{id}/roles/{pro_role_id}
        v
+--------------------+
| Return Success UI  |
+--------------------+
```

---

## 11. GitHub-to-Discord Release Webhook Architecture

Automated release broadcasts post to `#altspace-releases` whenever a release tag is published on GitHub.

### Security Controls
- Webhook endpoints run in the serverless backend, not client-side.
- The webhook payload specifies `allowed_mentions: { parse: [] }` so rogue text in release notes can never trigger `@everyone` or `@here`.
- Embeds are formatted cleanly with markdown changelog parsing.

```typescript
// Webhook Payload Format
export interface DiscordReleaseEmbed {
  title: string;
  url: string;
  color: number; // 0x38bdf8 (AltSpace Cyan)
  description: string;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
}

export function buildReleasePayload(tag: string, name: string, body: string, htmlUrl: string) {
  return {
    username: "AltSpace Release Bot",
    avatar_url: "https://raw.githubusercontent.com/codecheesee/altspace/main/brand_assets/logo.png",
    allowed_mentions: { parse: [] }, // Strict mention suppression
    embeds: [
      {
        title: `🚀 AltSpace ${name || tag} Released`,
        url: htmlUrl,
        color: 0x38bdf8,
        description: body.length > 2000 ? `${body.slice(0, 1950)}...\n\n*(Full changelog on GitHub)*` : body,
        fields: [
          { name: "Platform", value: "Windows 10 / 11 (x64, arm64)", inline: true },
          { name: "Download", value: `[Direct Installer](${htmlUrl})`, inline: true },
        ],
        footer: { text: "Codecheesee Builds • Verified Release Feed" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
```

---

## 12. AltSpace Desktop Integration Specification

AltSpace integrates with the community using safe, static command palette hooks.

### Command Palette Action Map
Inside AltSpace (`Alt + Space`), typing `:community` reveals quick action items:

| Command | Action | Executed Operation |
| :--- | :--- | :--- |
| `:community` | Join the Community | Opens `https://discord.gg/codecheesee` via default browser |
| `:community support` | Get Help | Opens `https://discord.com/channels/.../#altspace-support` |
| `:community report-bug` | Report a Bug | Opens `#altspace-bug-reports` forum or GitHub Issues |
| `:community feature-request` | Request a Feature | Opens `#altspace-feature-reqs` forum |
| `:community roadmap` | View Public Roadmap | Opens public roadmap board |
| `:community releases` | View Latest Release | Opens GitHub releases page |

### Security Safeguards
- All links are executed using Tauri's `@tauri-apps/plugin-opener` or `shell::open`.
- Strict URL scheme validation: only `https://` protocols targeting explicit whitelisted hostnames (`discord.gg`, `discord.com`, `github.com`, `altspace.dev`) are accepted.
- Zero Discord tokens or webhook URLs are present in the frontend client.

---

## 13. Sanitized Support Bundle Schema

When a user clicks **"Copy Sanitized Diagnostics"** in AltSpace Settings, the app compiles an anonymous diagnostic payload designed to prevent accidental leakage of sensitive developer data.

### Schema (`SupportBundle`)
```typescript
export interface SanitizedSupportBundle {
  schemaVersion: "1.0.0";
  generatedAt: string; // ISO 8601
  client: {
    appVersion: string;
    appBuild: string;
    safeMode: boolean;
    channel: "stable" | "beta";
  };
  system: {
    osPlatform: "windows";
    osRelease: string; // e.g. "10.0.22631"
    osBuildNumber: number;
    arch: "x64" | "arm64";
    memoryGbEstimated: string;
    screenCount: number;
  };
  subsystems: {
    dockerInstalled: boolean;
    dockerRunning: boolean;
    wslInstalled: boolean;
    wslDefaultDistro: string | null;
    ollamaEndpointReachable: boolean;
    ollamaLoadedModels: string[]; // Model names only (no local model file paths)
    activeIndexedPortCount: number;
  };
  extensions: {
    totalInstalled: number;
    quarantinedCount: number;
  };
  redactionMetrics: {
    sanitizedSecretsCount: number;
    sanitizedPathsCount: number;
  };
  sanitizedRecentLogs: Array<{
    level: "info" | "warn" | "error";
    message: string;
    timestamp: string;
  }>;
}
```

### Explicit Exclusion Rules
The support bundle strictly strips:
- Clipboard history and current clipboard contents.
- Environment variable values (`.env` files, process env maps).
- API keys (`sk-...`, `ghp_...`, `Bearer ...`).
- DPAPI encrypted payloads and local master keys.
- User home directory names (replaces `C:\Users\<Name>\` with `~\`).
- Git repository URLs containing embedded personal access tokens.

---

## 14. Entitlement & Pro Role Synchronization

### Licensing & Entitlement Flow
AltSpace uses a **fail-closed, local-first** licensing model.

```
[ Lemon Squeezy / GitHub Sponsors ]
                 |
                 v (HMAC-SHA256 Webhook)
      [ Entitlement Service ]
                 |
                 +-----------------------------------------+
                 |                                         |
                 v                                         v
   [ AltSpace Desktop Client ]              [ Discord Role Worker ]
   (Verifies signed JWT payload)            (Calls Discord REST API)
   - If offline/unreachable:                - Assigns @AltSpace Pro
     fails closed to Free tier              - Revokes upon refund
   - Local actions remain 100% unblocked    - Discord role is purely social
```

### Security Invariants
1. **Discord is not the License Authority**: A Discord role presence never activates Pro features in the desktop app. Only a signed JWT from the entitlement service is accepted by the app.
2. **Fail-Closed Isolation**: If the entitlement service is unreachable, AltSpace defaults to the Free tier. Core local capabilities (file search, port inspection, calculator, local clipboard) are never gated or disabled.
3. **Lifetime Pro Scope**: AltSpace Pro provides unmetered local features and operational control planes. It explicitly does **not** bundle lifetime unlimited cloud LLM tokens or hosted storage.

---

## 15. Future Product Expansion Model

When launching Product #2 (e.g., `PortPulse` or `LocalVault`):

1. **Update Registry**: Add an entry to `products.json` with the new slug and URLs.
2. **Run Bot Provisioning**: Run `npm run studio:provision --slug=newproduct`. The script automatically:
   - Creates Discord category `NEWPRODUCT`.
   - Generates `#newproduct-start-here`, `#newproduct-support`, `#newproduct-bug-reports` (Forum), and `#newproduct-releases` (Announcement).
   - Generates roles `@NewProduct User` and `@NewProduct Beta`.
   - Updates Community Onboarding options dynamically.
3. **Configure Webhook**: Link the GitHub release workflow of the new repository to the existing webhook dispatcher.

---

## 16. Launch Checklist

### Pre-Launch (T-7 to T-1)
- [ ] Create Discord server `Codecheesee Builds`.
- [ ] Enable **Community Server** settings.
- [ ] Configure **Rules Screening** with the copy from Section 6.
- [ ] Configure **AutoMod** rules with surgical secret regexes.
- [ ] Create category structure and channel list.
- [ ] Set up `#altspace-bug-reports` forum with tags and template.
- [ ] Set up `#altspace-feature-reqs` forum with tags and guidelines.
- [ ] Create roles and hierarchy order.
- [ ] Configure **Community Onboarding** questions and preview new-member view.
- [ ] Enable 2FA on server owner and moderator accounts.
- [ ] Test release webhook in a private test channel.
- [ ] Verify AltSpace `:community` commands open correct links.

### Launch Day (Day 0)
- [ ] Publish `#announcements` welcome post.
- [ ] Merge AltSpace in-app `:community` action updates.
- [ ] Update AltSpace `README.md` with official community badge.
- [ ] Announce on Twitter/X, GitHub Discussions, and personal channels.

---

## 17. First 30-Day Community Plan

- **Week 1 (Soft Launch)**: Invite founding 25 developers, contributors, and active testers. Validate onboarding flow and forum tagging.
- **Week 2 (Public Rollout)**: Public release alongside AltSpace v2.0 announcement. Focus on rapid support turnaround in `#altspace-support`.
- **Week 3 (Community Rituals)**: Host the first **"Show Your Setup"** event in `#altspace-workflows` and announce the first live voice office hours.
- **Week 4 (Triage & Roadmap Update)**: Publish the monthly public roadmap update in `#roadmap`, crediting the first community-reported bug fixes in the changelog.

---

## 18. Threat Model & Security Controls

| Threat Vector | Potential Impact | Enforced Mitigation |
| :--- | :--- | :--- |
| **Spam / Raid Attack** | Server flood, invite spam | AutoMod mention limiter (>4 mentions = 30m timeout), invite link regex blocker, Medium verification level. |
| **Accidental Token Leak** | Compromised user credentials | Surgical AutoMod regex for PATs, private keys, and API tokens. Immediate block + alert in `#mod-alerts`. |
| **Impersonation Scams** | Fraudulent DMs targeting users | Anti-impersonation rule, verified staff roles, explicit server banner stating staff will never DM for keys or passwords. |
| **Malicious Attachments** | Malware distribution | Discord native virus scanning enabled, executable file types banned in non-staff channels. |
| **Client Compromise** | Desktop app security breach | Zero Discord secrets stored in Tauri client; all community actions are sandboxed browser links. |

---

## 19. Database Schema & Backend API Endpoints

```sql
-- SQLite / PostgreSQL Schema
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE,
    github_username TEXT,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entitlements (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    product_slug TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('free', 'supporter', 'pro', 'contributor', 'maintainer')),
    status TEXT NOT NULL CHECK(status IN ('active', 'cancelled', 'refunded', 'expired')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY,
    user_id TEXT,
    redirect_uri TEXT,
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Backend Endpoints
- `GET /health` — Service health check.
- `POST /interactions` — Discord HTTP Interaction webhook (verified via ed25519 signature).
- `GET /auth/discord/login` — Initiates OAuth2 authorization code flow with CSRF state.
- `GET /auth/discord/callback` — Handles OAuth2 callback, links Discord ID, triggers role sync.
- `POST /webhooks/lemonsqueezy` — Validates HMAC-SHA256 signature, updates entitlements, queues Discord role sync.
- `POST /webhooks/github/release` — Validates GitHub HMAC signature, publishes formatted release embed to Discord.

---

## 20. Environment Variables & Secret Management

```bash
# Server & Runtime
NODE_ENV=production
PORT=3000
DATABASE_URL="postgres://..."

# Discord Credentials (Server-side ONLY - NEVER in Tauri client)
DISCORD_APPLICATION_ID="123456789..."
DISCORD_PUBLIC_KEY="ed25519_public_key_hex..."
DISCORD_BOT_TOKEN="Bot.Token..."
DISCORD_CLIENT_SECRET="oauth_secret..."
DISCORD_GUILD_ID="987654321..."

# Payment & Webhooks
LEMON_SQUEEZY_WEBHOOK_SECRET="high_entropy_secret_hex..."
GITHUB_WEBHOOK_SECRET="github_hmac_secret_hex..."
JWT_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

---

## 21. Verification & Test Plan

1. **AutoMod Verification**: Send mock test messages in a private sandbox channel to confirm:
   - `ghp_123456789012345678901234567890123456` triggers instant block and alert.
   - Normal discussions containing the word `token` or `password` pass without interruption.
2. **Interaction Verification**: Verify ed25519 request signature validation rejects unsigned or spoofed HTTP POSTs to `/interactions`.
3. **Diagnostic Sanitization Test**: Execute `diagnostics.test.mjs` to assert zero user paths, DPAPI keys, or OpenAI tokens survive the export pipeline.
4. **Offline Desktop Test**: Disconnect network on test machine; verify AltSpace boots cleanly into the Free tier without lag, crashes, or lockouts.

---

## 22. Deployment Plan

- **Backend Runtime**: Deploy backend service as a containerized Node.js service (Fly.io, Railway, or AWS ECS) or Cloudflare Workers.
- **Database**: Managed PostgreSQL or Turso SQLite with encrypted backups.
- **SSL/TLS**: Automated certificate management via Cloudflare / Let's Encrypt.
- **Health Monitoring**: Uptime probe checking `GET /health` every 60 seconds.

---

## 23. Rollback Plan

- **Webhook Failure**: If release webhooks fail, payloads are buffered in a dead-letter queue (DLQ) with exponential backoff retries.
- **Bot Interaction Failure**: If the bot interactions endpoint is down, Discord gracefully informs the user that the application did not respond; core desktop apps and Discord chatting are completely unaffected.
- **Entitlement Service Incident**: Desktop clients automatically fall back into safe Free mode. No local developer actions are interrupted.

---

## 24. Maintainer Operations Runbook

### Adding a Moderator
1. Ensure the user has active 2FA enabled on their Discord account.
2. Assign the `@Moderator` role via Discord Server Settings.
3. Add the user to `#mod-chat` and provide the incident escalation guidelines.

### Rotating a Compromised Webhook
1. Go to Discord Server Settings -> Integrations -> Webhooks.
2. Delete the affected webhook immediately.
3. Generate a new webhook, update the secret in GitHub Actions Secrets or backend environment, and trigger a release test.

### Emergency Raid Mitigation
1. Run `/mod raid on` or manually set Discord Verification Level to **High**.
2. Enable 5-minute slowmode on `#general` and `#introductions`.
3. Review AutoMod alert logs in `#mod-alerts` and batch-kick flagged spambots.

---

## 25. Exact Files & Modules to Create or Modify

### Inside AltSpace Codebase (`c:\Users\rohan\.gemini\antigravity\scratch\altspace`):
1. [NEW] `distribution/product-registry.json` — The master product registry configuration.
2. [NEW] `docs/DISCORD_COMMUNITY_SYSTEM.md` — This complete operational specification.
3. [UPDATE] `frontend/src/feedbackConfig.ts` — Remove placeholder webhook references and wire safe community URLs.
4. [UPDATE] `frontend/src/lib/diagnostics.ts` — Expand support bundle exporter with complete environment snapshot.
5. [UPDATE] `README.md` — Add official Discord community badge and link.

### Inside Future Studio Backend Service (`rohan-builds-backend`):
1. `src/server.ts` — Fastify/Express HTTP server with ed25519 interaction verification.
2. `src/commands/` — Slash command handler modules (`/altspace`, `/product`, `/help`).
3. `src/webhooks/github.ts` — Release event consumer and Discord embed publisher.
4. `src/webhooks/lemonsqueezy.ts` — Entitlement event listener.
5. `src/services/discordRoleSync.ts` — Guild member role synchronization worker.
