# Gawin reminders

An optional Cloudflare Worker + D1 backend for the existing Expo PWA. Task data
stays local. Only opted-in reminder schedules and push subscriptions are stored
here. Notification bodies are generic unless the user chooses to include titles.
No PIN, recovery code, or biometric data is sent to this service.

The frontend remains on Vercel. This service has its own deployment. Code and
local tests are complete without a Cloudflare account; real background delivery
requires deploying this Worker and connecting the PWA. Do not label reminders
scheduled until the API confirms them.

## Free-plan deployment

Use a **Workers Free** account. No paid services or automatic upgrades are needed.
The sender processes at most three notifications per minute, supports up to 100
active reminders per device, uses indexed queries, and prunes old records. These
limits target personal usage. Scheduled checks run every minute, so delivery is
not exact to the second. Push can also be delayed by connectivity and device
settings. Free-plan CPU limits must be checked against real usage after deployment;
local tests cannot prove Cloudflare's production CPU budget.

1. Sign into your free Cloudflare account:

   ```sh
   pnpm exec wrangler login
   pnpm exec wrangler d1 create gawin-reminders
   ```

2. Copy the returned database ID into `d1_databases[0].database_id` in
   `services/reminders/wrangler.jsonc`.

3. Generate keys once, using the exact origin of the installed PWA:

   ```sh
   pnpm reminders:keys --origin https://your-gawin.vercel.app --contact mailto:you@example.com
   ```

   This writes public settings into `wrangler.jsonc`. It writes private keys and
   a private connection code to gitignored files, with owner-only permissions.
   Preserve these keys across deployments. Changing the public VAPID key requires
   reconnecting subscriptions. Never use an `EXPO_PUBLIC_*` variable for secrets.

4. Create tables, deploy, and upload secrets:

   ```sh
   pnpm reminders:migrate
   pnpm reminders:deploy
   pnpm reminders:secrets
   ```

5. Set `EXPO_PUBLIC_REMINDER_API_URL` in Vercel to the Worker HTTPS URL, without a
   trailing slash. Rebuild/redeploy the PWA. No connection code goes into Vercel's
   public environment.

6. On your installed PWA, open **Settings → Task reminders**. Enter the connection
   code (`SETUP_CODE` in the private `secrets.json` file) and enable notifications.
   This is a one-time enrollment code for your private reminder service, protecting
   the free quota from public registrations. Each device gets a separate random
   bearer token; the database stores only its hash. Send a test notification before
   relying on reminders. On iPhone, use a Home Screen installation on iOS 16.4+.

## Development

```sh
pnpm reminders:keys --origin http://localhost:8081 --contact mailto:you@example.com
pnpm exec wrangler d1 migrations apply gawin-reminders --local --config services/reminders/wrangler.jsonc
pnpm reminders:dev
```

Use a separate local copy of the config/secrets when production is already set up;
do not rotate production keys to test locally. Set `EXPO_PUBLIC_REMINDER_API_URL`
in `.env.local` to the local Worker URL, then restart Expo. Production must use
HTTPS. The frontend provides a development service worker for local push testing.

## GitHub deployment

The optional `reminders.yml` workflow is off until repository variable
`REMINDERS_DEPLOY_ENABLED=true` is set. Configure these repository secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VAPID_PRIVATE_KEY`, and
`REMINDER_SETUP_CODE`. Scope the Cloudflare token to Worker deployment and the
reminder D1 database. Commit only public `wrangler.jsonc` configuration. PWA
deployments continue through the existing Vercel connection independently.

## Delivery and security

- CORS accepts only the configured PWA origin. Enrollment requires the connection
  code; all later device requests require that device's token.
- Full snapshots include increasing revisions. Stale writes are rejected. Missing
  reminders are cancelled; in-flight leases survive identical snapshots.
- A delivery ledger prevents resending the same task/time after successful dispatch.
  Notifications reuse tags. Network timeouts can still make delivery ambiguous;
  Web Push is not an exactly-once transport.
- Temporary failures retry at most twice. Expired subscriptions require reconnecting.
  Reminders expire after 15 minutes; notifications already dispatched cannot be recalled.
- Offline edits, completion, and deletion sync the next time Gawin is open and
  connected. An old server reminder can still arrive before cancellation reaches it.
- Subscription endpoints are restricted to known HTTPS push services, with no
  redirects. SQL parameters are bound. No titles, tokens, or endpoints are logged.
- Notification clicks open a local task only after App Lock permits the navigator.
  Foreground sound needs a user gesture and only operates while Gawin is active.
- Reminders for repeating tasks apply to that occurrence. Unopened future repeat
  occurrences are not generated/uploaded by this service.

## Verification

```sh
pnpm reminders:check
pnpm test
pnpm exec wrangler deploy --dry-run --config services/reminders/wrangler.jsonc
```

Tests use SQLite to exercise authentication, stale snapshots, cancellation,
concurrent delivery, leases, retry bounds and expiry. A separate receiver decrypts
the generated AES128GCM payload to check standards-compatible encryption.
Real iPhone locked/closed/offline delivery still needs device testing with a live service.
