import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const repoRoot = path.resolve(import.meta.dirname, '..');
const installScript = path.join(repoRoot, 'install.ps1');

function getAuthenticodeFunctionSnippet() {
  const content = fs.readFileSync(installScript, 'utf-8');
  const match = content.match(/function Assert-Authenticode[\s\S]*?\n\}/);
  if (!match) {
    throw new Error('Could not extract Assert-Authenticode function from install.ps1');
  }
  return match[0];
}

function runPowerShellScript(scriptBody) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'altspace-ps-run-'));
  const scriptPath = path.join(tmpDir, 'test_runner.ps1');
  try {
    fs.writeFileSync(scriptPath, scriptBody, 'utf-8');
    let psCmd = 'powershell';
    try {
      const candidates = execSync('where pwsh 2>nul || where powershell', { stdio: 'pipe' })
        .toString()
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      if (candidates.length > 0) {
        psCmd = candidates[0];
      }
    } catch {
      // fallback to powershell
    }
    const out = execSync(`"${psCmd}" -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, { stdio: 'pipe' });
    return { stdout: out.toString(), stderr: '' };
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    return { error: err, stdout, stderr, message: err.message };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('Installer Trust - install.ps1 parses and defines Assert-Authenticode', () => {
  const content = fs.readFileSync(installScript, 'utf-8');
  assert.ok(content.includes('function Assert-Authenticode'), 'Must declare Assert-Authenticode function');
  assert.ok(content.includes('Get-AuthenticodeSignature'), 'Must use Get-AuthenticodeSignature');
  assert.ok(content.includes('NotSigned'), 'Must check NotSigned status');
  assert.ok(content.includes("$FallbackTag = 'v2.2.0'"), 'Fallback tag must be aligned to v2.2.0');
});

test('Installer Trust - Assert-Authenticode emits notice on unsigned binary and succeeds with SHA-256', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'altspace-trust-test-'));
  const dummyExe = path.join(tmpDir, 'unsigned_test.exe');
  fs.writeFileSync(dummyExe, 'MZ_DUMMY_BINARY_DATA');

  try {
    const fnDef = getAuthenticodeFunctionSnippet();
    const psScript = `
$ErrorActionPreference = 'Stop'
${fnDef}
Assert-Authenticode -FilePath "${dummyExe.replace(/\\/g, '\\\\')}"
`;
    const res = runPowerShellScript(psScript);
    assert.equal(res.error, undefined, `Assert-Authenticode should not throw on unsigned binary: ${res.stderr || res.message}`);
    assert.ok(
      res.stdout.includes('Notice:') && res.stdout.includes('not Authenticode signed'),
      `Output must include unsigned notice, got: ${res.stdout}`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Installer Trust - Assert-Authenticode fails closed when target file does not exist', () => {
  const fnDef = getAuthenticodeFunctionSnippet();
  const psScript = `
$ErrorActionPreference = 'Stop'
${fnDef}
Assert-Authenticode -FilePath "C:\\nonexistent_binary_for_test_123.exe"
`;
  const res = runPowerShellScript(psScript);
  assert.ok(res.error, 'Must throw when file does not exist');
  const errText = res.stderr + res.stdout + (res.message || '');
  assert.ok(errText.includes('not found') || errText.includes('Binary not found'), `Expected binary not found, got: ${errText}`);
});
