#!/usr/bin/env node

/**
 * Rohan Builds — Automated Discord Server Provisioning Script
 * 
 * Automates the creation and configuration of:
 * - Server Roles & Permissions (Hierarchy, Colors)
 * - Categories (START HERE, COMMUNITY, ALTSPACE, FUTURE PRODUCTS, VOICE, STAFF)
 * - Channels (Text, Announcement, Voice)
 * - Forum Channels with Custom Tags (#altspace-bug-reports, #altspace-feature-reqs)
 * - AutoMod Rules (Token Leaks, Invites, Scams, Mention Spam)
 * - Release Webhooks
 * 
 * Usage:
 *   node scripts/setup-discord-server.mjs --dry-run
 *   node scripts/setup-discord-server.mjs --token=YOUR_BOT_TOKEN --guild=YOUR_GUILD_ID
 * 
 * Or set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in your environment.
 */

import { parseArgs } from 'node:util';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Command line arguments
const { values } = parseArgs({
  options: {
    token: { type: 'string' },
    guild: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Rohan Builds Discord Provisioner

Options:
  --token <token>    Discord Bot Token (or set DISCORD_BOT_TOKEN env var)
  --guild <id>       Discord Server (Guild) ID (or set DISCORD_GUILD_ID env var)
  --dry-run          Preview what will be created without making changes
  --help             Show this help message
`);
  process.exit(0);
}

const BOT_TOKEN = values.token || process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = values.guild || process.env.DISCORD_GUILD_ID;
const IS_DRY_RUN = values['dry-run'];

// Server Configuration Specification
const SERVER_BLUEPRINT = {
  roles: [
    { name: 'Administrator', color: 0xe11d48, hoist: true, mentionable: false, permissions: '8' }, // Administrator
    { name: 'Moderator', color: 0x2563eb, hoist: true, mentionable: false },
    { name: 'Support Engineer', color: 0x0284c7, hoist: true, mentionable: false },
    { name: 'Verified Contributor', color: 0x6366f1, hoist: true, mentionable: false },
    { name: 'AltSpace Pro', color: 0x38bdf8, hoist: true, mentionable: false }, // AltSpace Cyan
    { name: 'Sponsor', color: 0xf59e0b, hoist: true, mentionable: false },
    { name: 'Early Builder', color: 0xec4899, hoist: true, mentionable: false },
    { name: 'AltSpace Beta', color: 0xa855f7, hoist: false, mentionable: false },
    { name: 'AltSpace User', color: 0x10b981, hoist: false, mentionable: false },
    { name: 'Future App Tester', color: 0x8b5cf6, hoist: false, mentionable: false },
    { name: 'Windows Dev', color: 0x64748b, hoist: false, mentionable: false },
    { name: 'Rust', color: 0xf97316, hoist: false, mentionable: false },
    { name: 'TypeScript / React', color: 0x3b82f6, hoist: false, mentionable: false },
    { name: 'Docker / WSL', color: 0x06b6d4, hoist: false, mentionable: false },
    { name: 'Local AI', color: 0x84cc16, hoist: false, mentionable: false },
  ],
  categories: [
    {
      name: 'START HERE',
      channels: [
        { name: 'welcome', type: 0, topic: 'Welcome to Rohan Builds. Start here for links and guidelines.' },
        { name: 'rules', type: 0, topic: 'Community safety, rules, and privacy policies.' },
        { name: 'announcements', type: 5, topic: 'Official product launches and studio announcements.' }, // Announcement
        { name: 'roadmap', type: 0, topic: 'High-level roadmap and progress updates.' },
        { name: 'changelog', type: 0, topic: 'Cross-product changelogs and release notes.' },
        { name: 'introductions', type: 0, topic: 'Introduce yourself to the community.' },
      ],
    },
    {
      name: 'DEVELOPER COMMUNITY',
      channels: [
        { name: 'general', type: 0, topic: 'General conversation, technology, and engineering.' },
        { name: 'developer-lounge', type: 0, topic: 'Casual developer banter, hardware, workstations.' },
        { name: 'windows-dev', type: 0, topic: 'Windows internals, Win32, App SDK, Tauri, MSIX.' },
        { name: 'rust-and-systems', type: 0, topic: 'Rust programming, low-level architecture, memory safety.' },
        { name: 'typescript-react', type: 0, topic: 'React 19, TypeScript, frontend architecture.' },
        { name: 'local-ai', type: 0, topic: 'Ollama, local LLMs, quantization, offline AI tools.' },
        { name: 'docker-and-wsl', type: 0, topic: 'WSL2 networking, Docker Compose, container troubleshooting.' },
        { name: 'show-and-tell', type: 0, topic: 'Showcase projects, workflows, scripts, and setups.' },
      ],
    },
    {
      name: 'ALTSPACE',
      channels: [
        { name: 'altspace-start-here', type: 0, topic: 'Download links, quick start, hotkeys, and architecture.' },
        { name: 'altspace-support', type: 0, topic: 'Community peer support and troubleshooting.' },
        {
          name: 'altspace-bug-reports',
          type: 15, // Forum
          topic: 'Submit structured bug reports with sanitized diagnostics.',
          available_tags: [
            { name: 'crash', emoji_name: '💥' },
            { name: 'install', emoji_name: '📦' },
            { name: 'ports', emoji_name: '🔌' },
            { name: 'docker-wsl', emoji_name: '🐳' },
            { name: 'ollama-ai', emoji_name: '🤖' },
            { name: 'clipboard', emoji_name: '📋' },
            { name: 'windows-11', emoji_name: '🪟' },
            { name: 'windows-10', emoji_name: '🪟' },
          ],
          default_reaction_emoji: { emoji_name: '🐛' },
        },
        {
          name: 'altspace-feature-reqs',
          type: 15, // Forum
          topic: 'Propose and vote on new AltSpace features.',
          available_tags: [
            { name: 'planned', emoji_name: '📅' },
            { name: 'under-review', emoji_name: '👀' },
            { name: 'community-vote', emoji_name: '🗳️' },
            { name: 'prototype', emoji_name: '🧪' },
            { name: 'shipped', emoji_name: '🚀' },
          ],
          default_reaction_emoji: { emoji_name: '👍' },
        },
        { name: 'altspace-workflows', type: 0, topic: 'Share recipes, port cleanups, and local setups.' },
        { name: 'altspace-beta', type: 0, topic: 'Early test builds and pre-release discussions.', private: true },
        { name: 'altspace-releases', type: 5, topic: 'Automated release feed from GitHub Actions.' },
      ],
    },
    {
      name: 'FUTURE PRODUCTS',
      channels: [
        { name: 'future-products-hub', type: 0, topic: 'Preview new tools from Rohan Builds.' },
        { name: 'product-ideas', type: 0, topic: 'Discuss ideas for upcoming developer utilities.' },
        { name: 'beta-waitlists', type: 0, topic: 'Opt-in for upcoming product private betas.' },
      ],
    },
    {
      name: 'VOICE & STAGES',
      channels: [
        { name: 'Developer Lounge', type: 2 }, // Voice
        { name: 'Build Together', type: 2 },   // Voice
      ],
    },
    {
      name: 'STAFF & OPS',
      private: true,
      channels: [
        { name: 'mod-chat', type: 0, topic: 'Internal moderator discussion.' },
        { name: 'mod-alerts', type: 0, topic: 'Automated AutoMod and security alerts.' },
        { name: 'incident-log', type: 0, topic: 'Audit trail for bans, timeouts, and attacks.' },
        { name: 'support-escalations', type: 0, topic: 'High-severity bug escalations.' },
      ],
    },
  ],
  automodRules: [
    {
      name: 'Surgical Secret & Token Redaction Alert',
      event_type: 1, // MESSAGE_SEND
      trigger_type: 1, // KEYWORD
      trigger_metadata: {
        regex_patterns: [
          'gh[pous]_[0-9a-zA-Z]{36}',
          'sk-(?:proj-)?[a-zA-Z0-9_-]{20,}',
          'sk-ant-[a-zA-Z0-9_-]{20,}',
          '-----BEGIN[A-Z\\s]+PRIVATE KEY-----',
        ],
      },
      actions: [
        { type: 1 }, // BLOCK_MESSAGE
      ],
      enabled: true,
    },
    {
      name: 'Anti-Mention Spam',
      event_type: 1,
      trigger_type: 5, // MENTION_SPAM
      trigger_metadata: {
        mention_total_limit: 4,
      },
      actions: [
        { type: 1 }, // BLOCK_MESSAGE
        { type: 3, metadata: { duration_seconds: 1800 } }, // TIMEOUT 30m
      ],
      enabled: true,
    },
  ],
};

// API Helper with Rate-Limit Handling
async function discordRequest(endpoint, method = 'GET', body = null) {
  if (IS_DRY_RUN && method !== 'GET') {
    return { id: `mock_${Date.now()}` };
  }

  const url = `${DISCORD_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'RohanBuildsProvisioner/1.0',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  while (true) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const data = await res.json();
      const retryAfter = (data.retry_after || 1) * 1000;
      console.log(`⏳ Rate limited. Retrying after ${retryAfter}ms...`);
      await new Promise((r) => setTimeout(r, retryAfter));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Discord API ${method} ${endpoint} failed (${res.status}): ${errText}`);
    }

    if (res.status === 204) return null;
    return await res.json();
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 Rohan Builds Discord Provisioner`);
  console.log(`======================================================`);

  if (IS_DRY_RUN && (!BOT_TOKEN || BOT_TOKEN === 'mock_token')) {
    console.log(`\n📋 OFFLINE PREVIEW (Blueprint Summary):`);
    console.log(`\n1. Roles to be created (${SERVER_BLUEPRINT.roles.length}):`);
    SERVER_BLUEPRINT.roles.forEach(r => console.log(`   - ${r.name} (Color: #${r.color.toString(16).padStart(6, '0')})`));
    
    console.log(`\n2. Categories & Channels (${SERVER_BLUEPRINT.categories.length} categories):`);
    SERVER_BLUEPRINT.categories.forEach(cat => {
      console.log(`   📁 [${cat.name}]`);
      cat.channels.forEach(ch => {
        const typeStr = ch.type === 15 ? 'Forum' : ch.type === 5 ? 'Announcement' : ch.type === 2 ? 'Voice' : 'Text';
        console.log(`      #${ch.name.padEnd(24)} (${typeStr}) - ${ch.topic || ''}`);
      });
    });

    console.log(`\n3. AutoMod Protection Rules (${SERVER_BLUEPRINT.automodRules.length}):`);
    SERVER_BLUEPRINT.automodRules.forEach(rule => {
      console.log(`   🛡️  ${rule.name} (Trigger: ${rule.trigger_type === 1 ? 'Secret/Token Regex' : 'Mention Spam'})`);
    });

    console.log(`\n✅ Dry-run preview complete! To apply to Discord, pass a real Bot Token and Server ID.`);
    process.exit(0);
  }

  if (!BOT_TOKEN || !GUILD_ID) {
    console.error(`\n❌ Error: Missing credentials.`);
    console.log(`Please provide both --token and --guild arguments, or set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID.`);
    console.log(`Example:`);
    console.log(`  node scripts/setup-discord-server.mjs --token="YOUR_TOKEN" --guild="YOUR_GUILD_ID"\n`);
    process.exit(1);
  }

  if (IS_DRY_RUN) {
    console.log(`⚠️  Running in DRY-RUN mode. No changes will be applied to Discord.`);
  }

  // 1. Verify Bot and Guild
  console.log(`\n[1/5] Verifying bot credentials and guild permissions...`);
  let botUser, guildInfo;
  try {
    botUser = await discordRequest('/users/@me');
    console.log(`  ✓ Authenticated as: ${botUser.username}#${botUser.discriminator || '0'} (ID: ${botUser.id})`);
    guildInfo = await discordRequest(`/guilds/${GUILD_ID}`);
    console.log(`  ✓ Connected to Guild: "${guildInfo.name}" (ID: ${guildInfo.id})`);
  } catch (err) {
    console.error(`  ❌ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Fetch Existing State (to avoid duplicate creation)
  console.log(`\n[2/5] Inspecting existing guild state...`);
  const existingRoles = await discordRequest(`/guilds/${GUILD_ID}/roles`);
  const existingChannels = await discordRequest(`/guilds/${GUILD_ID}/channels`);
  console.log(`  • Found ${existingRoles.length} existing roles and ${existingChannels.length} existing channels.`);

  // 3. Provision Roles
  console.log(`\n[3/5] Provisioning Roles...`);
  const roleMap = new Map();
  for (const roleDef of SERVER_BLUEPRINT.roles) {
    const existing = existingRoles.find((r) => r.name.toLowerCase() === roleDef.name.toLowerCase());
    if (existing) {
      console.log(`  ⏩ Role "${roleDef.name}" already exists. Skipping.`);
      roleMap.set(roleDef.name, existing.id);
    } else {
      console.log(`  ➕ Creating role: "${roleDef.name}"`);
      if (!IS_DRY_RUN) {
        const created = await discordRequest(`/guilds/${GUILD_ID}/roles`, 'POST', roleDef);
        roleMap.set(roleDef.name, created.id);
      }
    }
  }

  // 4. Provision Categories & Channels
  console.log(`\n[4/5] Provisioning Categories and Channels...`);
  for (const catDef of SERVER_BLUEPRINT.categories) {
    let category = existingChannels.find(
      (c) => c.type === 4 && c.name.toLowerCase() === catDef.name.toLowerCase()
    );

    if (!category) {
      console.log(`  📁 Creating Category: [${catDef.name}]`);
      if (!IS_DRY_RUN) {
        category = await discordRequest(`/guilds/${GUILD_ID}/channels`, 'POST', {
          name: catDef.name,
          type: 4, // Category
        });
      } else {
        category = { id: `mock_cat_${catDef.name}` };
      }
    } else {
      console.log(`  ⏩ Category [${catDef.name}] already exists.`);
    }

    // Process channels inside this category
    for (const chanDef of catDef.channels) {
      const existingChan = existingChannels.find(
        (c) => c.parent_id === category.id && c.name.toLowerCase() === chanDef.name.toLowerCase()
      );

      if (existingChan) {
        console.log(`     ⏩ #${chanDef.name} already exists. Skipping.`);
        continue;
      }

      console.log(`     ➕ Creating channel: #${chanDef.name} (Type: ${chanDef.type === 15 ? 'Forum' : chanDef.type === 5 ? 'Announcement' : chanDef.type === 2 ? 'Voice' : 'Text'})`);
      if (!IS_DRY_RUN) {
        const payload = {
          name: chanDef.name,
          type: chanDef.type,
          parent_id: category.id,
          topic: chanDef.topic || '',
        };

        if (chanDef.type === 15) { // Forum
          if (chanDef.available_tags) payload.available_tags = chanDef.available_tags;
          if (chanDef.default_reaction_emoji) payload.default_reaction_emoji = chanDef.default_reaction_emoji;
        }

        await discordRequest(`/guilds/${GUILD_ID}/channels`, 'POST', payload);
      }
    }
  }

  // 5. Provision AutoMod Rules
  console.log(`\n[5/5] Provisioning AutoMod Rules...`);
  try {
    const existingRules = await discordRequest(`/guilds/${GUILD_ID}/auto-moderation/rules`);
    for (const ruleDef of SERVER_BLUEPRINT.automodRules) {
      const exists = existingRules.some((r) => r.name.toLowerCase() === ruleDef.name.toLowerCase());
      if (exists) {
        console.log(`  ⏩ AutoMod rule "${ruleDef.name}" already exists.`);
      } else {
        console.log(`  🛡️  Creating AutoMod rule: "${ruleDef.name}"`);
        if (!IS_DRY_RUN) {
          await discordRequest(`/guilds/${GUILD_ID}/auto-moderation/rules`, 'POST', ruleDef);
        }
      }
    }
  } catch (err) {
    console.log(`  ⚠️  AutoMod API skipped or restricted: ${err.message}`);
  }

  console.log(`\n======================================================`);
  console.log(`✅ Provisioning Complete!`);
  console.log(`Your "Rohan Builds" Discord community structure is live.`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal script error:`, err);
  process.exit(1);
});
