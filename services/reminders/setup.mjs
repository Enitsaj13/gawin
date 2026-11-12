import { randomBytes, webcrypto } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { applyEdits, modify, parse, printParseErrorCode } from 'jsonc-parser';

const args = process.argv.slice(2);
const argument = (name) => args[args.indexOf(name) + 1];
const originArg = args.includes('--origin') ? argument('--origin') : '';
const contact = args.includes('--contact') ? argument('--contact') : '';
let origin;
try {
  const url = new URL(originArg);
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    throw new Error();
  origin = url.origin;
} catch {
  console.error(
    'Provide --origin with your PWA URL (HTTPS, or localhost for development).',
  );
  process.exit(1);
}
if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
  console.error(
    'Provide --contact mailto:your-email@example.com for the push service.',
  );
  process.exit(1);
}
const secretsPath = new URL('./secrets.json', import.meta.url);
for (const file of [secretsPath, new URL('./.dev.vars', import.meta.url)]) {
  try {
    await access(file);
    console.error(
      'Existing keys were preserved. Use the saved secrets and public key; do not regenerate them for each deployment.',
    );
    process.exit(1);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const configPath = new URL('./wrangler.jsonc', import.meta.url);
let configText = await readFile(configPath, 'utf8');
const errors = [];
const config = parse(configText, errors, { allowTrailingComma: true });
if (errors.length) {
  const error = errors[0];
  const lines = configText.slice(0, error.offset).split(/\r\n|\r|\n/);
  console.error(
    `wrangler.jsonc:${lines.length}:${lines.at(-1).length + 1}: ${printParseErrorCode(error.error)}. Check the configuration before generating keys.`,
  );
  process.exit(1);
}
if (
  !config || typeof config !== 'object' || Array.isArray(config) ||
  (config.vars !== undefined && (!config.vars || typeof config.vars !== 'object' || Array.isArray(config.vars)))
) {
  console.error('wrangler.jsonc must contain an object, with vars as an object if present.');
  process.exit(1);
}
const keys = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const publicKey = Buffer.from(
  await webcrypto.subtle.exportKey('raw', keys.publicKey),
).toString('base64url');
const privateKey = (await webcrypto.subtle.exportKey('jwk', keys.privateKey)).d;
const secrets = {
  VAPID_PRIVATE_KEY: privateKey,
  SETUP_CODE: randomBytes(32).toString('hex'),
};
for (const [name, value] of Object.entries({
  APP_ORIGIN: origin,
  VAPID_PUBLIC_KEY: publicKey,
  VAPID_SUBJECT: contact,
})) {
  configText = applyEdits(configText, modify(configText, ['vars', name], value, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: configText.includes('\r\n') ? '\r\n' : '\n' },
  }));
}
await writeFile(secretsPath, JSON.stringify(secrets, null, 2) + '\n', {
  mode: 0o600,
  flag: 'wx',
});
await writeFile(
  new URL('./.dev.vars', import.meta.url),
  Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n',
  { mode: 0o600, flag: 'wx' },
);
await writeFile(configPath, configText);
console.log(
  'Public configuration updated. Private keys and your device connection code are in services/reminders/secrets.json (gitignored). Keep this file private and backed up.',
);
