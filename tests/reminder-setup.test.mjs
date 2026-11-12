import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, copyFile, readFile, writeFile, stat, rm, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createECDH } from 'node:crypto';
import { parse } from 'jsonc-parser';

async function setupFixture(t, text) {
  const dir = await mkdtemp(join(tmpdir(), 'gawin-reminder-setup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await copyFile(new URL('../services/reminders/setup.mjs', import.meta.url), join(dir, 'setup.mjs'));
  await symlink(new URL('../node_modules', import.meta.url), join(dir, 'node_modules'), 'dir');
  await writeFile(join(dir, 'wrangler.jsonc'), text);
  const args = [join(dir, 'setup.mjs'), '--origin', 'https://gawin.example', '--contact', 'mailto:owner@example.com'];
  return { dir, run: () => spawnSync(process.execPath, args, { encoding: 'utf8' }) };
}

test('setup creates matching keys privately and refuses to rotate them accidentally', async (t) => {
  const { dir, run } = await setupFixture(t, JSON.stringify({ vars: {} }));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const secrets = JSON.parse(await readFile(join(dir, 'secrets.json'), 'utf8'));
  const config = JSON.parse(await readFile(join(dir, 'wrangler.jsonc'), 'utf8'));
  assert.match(secrets.SETUP_CODE, /^[a-f0-9]{64}$/);
  const key = createECDH('prime256v1'); key.setPrivateKey(Buffer.from(secrets.VAPID_PRIVATE_KEY, 'base64url'));
  assert.equal(key.getPublicKey().toString('base64url'), config.vars.VAPID_PUBLIC_KEY);
  assert.equal((await stat(join(dir, 'secrets.json'))).mode & 0o777, 0o600);
  assert.ok(!result.stdout.includes(secrets.SETUP_CODE));
  assert.ok(!result.stdout.includes(secrets.VAPID_PRIVATE_KEY));
  assert.equal(run().status, 1);
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'secrets.json'), 'utf8')), secrets);
});

test('setup accepts JSONC and preserves comments, trailing commas, and the database binding', async (t) => {
  const original = `{
  // Keep this deployment configuration.
  "vars": {
    "VAPID_SUBJECT": "mailto:old@example.com",
  },
  "d1_databases": [{ "binding": "DB", "database_id": "existing-database", }],
}
// Setup command: https://gawin.example
`;
  const { dir, run } = await setupFixture(t, original);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const updated = await readFile(join(dir, 'wrangler.jsonc'), 'utf8');
  const errors = [];
  const config = parse(updated, errors, { allowTrailingComma: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(config.d1_databases, parse(original, [], { allowTrailingComma: true }).d1_databases);
  assert.ok(updated.includes('// Keep this deployment configuration.'));
  assert.ok(updated.includes('// Setup command: https://gawin.example'));
  assert.equal(config.vars.APP_ORIGIN, 'https://gawin.example');
  assert.equal(config.vars.VAPID_SUBJECT, 'mailto:owner@example.com');
  assert.match(config.vars.VAPID_PUBLIC_KEY, /^[A-Za-z0-9_-]{87}$/);
});

test('invalid configuration fails clearly before creating credentials', async (t) => {
  const original = '{\n  "vars": { "APP_ORIGIN": }\n}';
  const { dir, run } = await setupFixture(t, original);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /wrangler\.jsonc:2:\d+: ValueExpected/);
  assert.ok(!result.stderr.includes('SyntaxError'));
  assert.equal(await readFile(join(dir, 'wrangler.jsonc'), 'utf8'), original);
  for (const file of ['secrets.json', '.dev.vars']) {
    await assert.rejects(access(join(dir, file)), { code: 'ENOENT' });
  }
});
