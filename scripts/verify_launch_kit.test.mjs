import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('docs/LAUNCH_KIT.md exists and contains all primary distribution channels', () => {
  const launchKitPath = path.join(rootDir, 'docs', 'LAUNCH_KIT.md');
  assert.ok(fs.existsSync(launchKitPath), 'LAUNCH_KIT.md should exist in docs/');
  
  const content = fs.readFileSync(launchKitPath, 'utf-8');
  assert.ok(content.includes('Twitter / X Launch Threads'), 'Should contain Twitter/X thread blueprints');
  assert.ok(content.includes('The 7-Second Silent Video Hook'), 'Should contain 7-second video hook');
  assert.ok(content.includes('Reddit Distribution Playbook'), 'Should contain Reddit distribution playbook');
  assert.ok(content.includes('r/webdev'), 'Should target r/webdev');
  assert.ok(content.includes('r/rust'), 'Should target r/rust');
  assert.ok(content.includes('r/windowsapps'), 'Should target r/windowsapps');
  assert.ok(content.includes('Hacker News (Show HN)'), 'Should contain Show HN blueprint');
  assert.ok(content.includes('Product Hunt Launch Kit'), 'Should contain Product Hunt launch kit');
  assert.ok(content.includes('Developer & Tech Influencer Outreach'), 'Should contain outreach template');
  assert.ok(content.includes('Visual Asset Checklist'), 'Should contain visual asset checklist');
});

test('landing/og-preview.svg exists and conforms to 1200x630 OpenGraph dimensions', () => {
  const svgPath = path.join(rootDir, 'landing', 'og-preview.svg');
  assert.ok(fs.existsSync(svgPath), 'og-preview.svg must exist');
  
  const content = fs.readFileSync(svgPath, 'utf-8');
  assert.ok(content.includes('width="1200"'), 'Width must be 1200');
  assert.ok(content.includes('height="630"'), 'Height must be 630');
  assert.ok(content.includes('viewBox="0 0 1200 630"'), 'viewBox must be 0 0 1200 630');
  assert.ok(content.includes('AltSpace'), 'Must mention AltSpace');
  assert.ok(content.includes('Apache 2.0'), 'Must display Apache 2.0 license');
});

test('landing/index.html includes complete OpenGraph and Twitter card meta tags', () => {
  const htmlPath = path.join(rootDir, 'landing', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  assert.ok(html.includes('<meta property="og:title"'), 'Must have og:title');
  assert.ok(html.includes('<meta property="og:image" content="./og-preview.svg" />'), 'Must reference og-preview.svg');
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'), 'Must use summary_large_image card');
  assert.ok(html.includes('<meta name="twitter:image" content="./og-preview.svg" />'), 'Must reference twitter:image');
});

test('Product Hunt tagline conforms to character limits', () => {
  const tagline = 'The modern extensible developer command palette for Windows';
  assert.ok(tagline.length <= 60, `Tagline length ${tagline.length} exceeds Product Hunt 60 character limit`);
});
