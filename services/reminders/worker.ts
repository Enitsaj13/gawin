import {
  buildPushPayload,
  type PushSubscription,
} from '@block65/webcrypto-web-push';
import type {
  D1Database,
  D1PreparedStatement,
} from '@cloudflare/workers-types';

export type Env = {
  DB: D1Database;
  APP_ORIGIN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  SETUP_CODE: string;
};
type Device = {
  id: string;
  token_hash: string;
  subscription: string;
  origin: string;
  last_revision: number;
  invalid: number;
  test_after: number;
};
type ReminderInput = {
  id: string;
  version: string;
  dueAt: number;
  body?: string;
};
type Due = {
  device_id: string;
  id: string;
  version: string;
  due_at: number;
  expires_at: number;
  body: string;
  attempts: number;
  subscription: string;
};
const GENERIC_BODY = 'You have an upcoming task.';
const GRACE = 15 * 60_000;
class ApiError extends Error {
  readonly status: number;
  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.status = status;
  }
}
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
function same(first: string, second: string) {
  let different = first.length ^ second.length;
  for (let index = 0; index < first.length; index++)
    different |= first.charCodeAt(index) ^ (second.charCodeAt(index) || 0);
  return different === 0;
}

export function validSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== 'object') return false;
  const sub = value as PushSubscription;
  try {
    const url = new URL(sub.endpoint);
    const allowed =
      url.hostname === 'fcm.googleapis.com' ||
      url.hostname.endsWith('.push.apple.com') ||
      url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.notify.windows.com');
    return (
      allowed &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      sub.endpoint.length <= 2048 &&
      /^[A-Za-z0-9_-]{87}$/.test(sub.keys?.p256dh) &&
      /^[A-Za-z0-9_-]{22}$/.test(sub.keys?.auth)
    );
  } catch {
    return false;
  }
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'JSON is required.');
  const text = await request.text();
  if (text.length > 65_536) throw new ApiError(413, 'Request is too large.');
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new ApiError(400, 'Invalid request.');
  }
}

export function validateReminders(
  value: unknown,
  now = Date.now(),
): ReminderInput[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new ApiError(
      400,
      'Up to 100 active reminders are supported per device.',
    );
  const ids = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !row.id.length || row.id.length > 200 || /[\u0000-\u001f\u007f]/.test(row.id) ||
      ids.has(row.id) ||
      typeof row.version !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.version) ||
      !Number.isSafeInteger(row.dueAt) ||
      row.dueAt < now - GRACE ||
      row.dueAt > now + 366 * 86400_000 ||
      (row.body !== undefined &&
        (typeof row.body !== 'string' || row.body.length > 80))
    )
      throw new ApiError(400, 'Invalid reminder schedule.');
    ids.add(row.id);
    return {
      id: row.id,
      version: row.version,
      dueAt: row.dueAt,
      body: row.body?.trim() || GENERIC_BODY,
    };
  });
}

async function push(
  env: Env,
  subscription: string,
  data: unknown,
  ttl: number,
) {
  const sub = JSON.parse(subscription) as PushSubscription;
  if (!validSubscription(sub)) throw new Error('Invalid stored subscription.');
  const payload = await buildPushPayload(
    { data: JSON.stringify(data), options: { ttl, urgency: 'high' } },
    sub,
    {
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    },
  );
  return fetch(sub.endpoint, {
    ...payload,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
}

async function route(request: Request, env: Env) {
  const url = new URL(request.url);
  if (url.pathname === '/v1/config' && request.method === 'GET') {
    if (
      !/^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY) ||
      !env.VAPID_PRIVATE_KEY ||
      !env.SETUP_CODE
    )
      throw new ApiError(503, 'Reminder service needs configuration.');
    return { publicKey: env.VAPID_PUBLIC_KEY, maxReminders: 100 };
  }
  const match = /^\/v1\/devices\/([a-f0-9]{32})(?:\/(reminders|test))?$/.exec(
    url.pathname,
  );
  if (!match) throw new ApiError(404, 'Not found.');
  const [, id, action] = match;
  const token =
    request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(401, 'Reconnect this device in Settings.');
  const tokenHash = await hash(token);
  let device = await env.DB.prepare('SELECT * FROM devices WHERE id = ?')
    .bind(id)
    .first<Device>();
  if (device && !same(device.token_hash, tokenHash))
    throw new ApiError(401, 'Reconnect this device in Settings.');
  if (!action && request.method === 'PUT') {
    if (!device) {
      const code = request.headers.get('x-setup-code') ?? '';
      if (
        !env.SETUP_CODE ||
        code.length > 256 ||
        !same(await hash(code), await hash(env.SETUP_CODE))
      )
        throw new ApiError(403, 'Check your connection code.');
    }
    const input = await body(request);
    if (!validSubscription(input.subscription))
      throw new ApiError(400, 'Unsupported push subscription.');
    await env.DB.prepare(
      `INSERT INTO devices (id, token_hash, subscription, origin, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription, updated_at=excluded.updated_at, invalid=0
      WHERE devices.token_hash=excluded.token_hash`,
    )
      .bind(
        id,
        tokenHash,
        JSON.stringify(input.subscription),
        env.APP_ORIGIN,
        Date.now(),
      )
      .run();
    if (device?.invalid) await env.DB.prepare(`UPDATE reminders SET status='queued',attempts=0,next_attempt=0,lease_until=0
      WHERE device_id=? AND status='failed' AND expires_at>?
      AND NOT EXISTS(SELECT 1 FROM deliveries d WHERE d.device_id=reminders.device_id AND d.reminder_id=reminders.id AND d.due_at=reminders.due_at)`).bind(id, Date.now()).run();
    return { connected: true };
  }
  if (!device) throw new ApiError(401, 'Reconnect this device in Settings.');
  if (!action && request.method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reminders WHERE device_id=?').bind(id),
      env.DB.prepare('DELETE FROM deliveries WHERE device_id=?').bind(id),
      env.DB.prepare('DELETE FROM devices WHERE id=?').bind(id),
    ]);
    return { disconnected: true };
  }
  if (device.invalid)
    throw new ApiError(
      410,
      'Notification permission changed. Reconnect this device.',
    );
  if (action === 'test' && request.method === 'POST') {
    const now = Date.now();
    const claimed = await env.DB.prepare(
      'UPDATE devices SET test_after=? WHERE id=? AND test_after<=?',
    )
      .bind(now + 60_000, id, now)
      .run();
    if (!claimed.meta.changes)
      throw new ApiError(429, 'Wait a minute before sending another test.');
    const response = await push(
      env,
      device.subscription,
      {
        type: 'test',
        title: 'Gawin',
        body: 'Reminders are connected on this device.',
        tag: 'gawin-test',
        url: '/settings',
      },
      60,
    );
    if (!response.ok)
      throw new ApiError(502, 'Test notification could not be sent.');
    return { sent: true };
  }
  if (action === 'reminders' && request.method === 'PUT') {
    const input = await body(request);
    const rows = validateReminders(input.reminders);
    const revision = input.revision;
    if (
      !Number.isSafeInteger(revision) ||
      Number(revision) <= device.last_revision
    )
      throw new ApiError(409, 'Schedule changed. Retry syncing.');
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(
        'UPDATE devices SET last_revision=?, updated_at=? WHERE id=? AND last_revision<?',
      ).bind(revision, Date.now(), id, revision),
      env.DB.prepare(
        `UPDATE reminders SET status='cancelled', body=? WHERE device_id=? AND id NOT IN (SELECT value FROM json_each(?)) AND (SELECT last_revision FROM devices WHERE id=?)=?`,
      ).bind(GENERIC_BODY, id, JSON.stringify(rows.map((row) => row.id)), id, revision),
    ];
    // One set-based insert keeps a full snapshot below Workers Free's D1 query limit.
    statements.push(
      env.DB.prepare(
        `INSERT INTO reminders (device_id,id,version,due_at,expires_at,body,status)
      SELECT ?,json_extract(j.value,'$.id'),json_extract(j.value,'$.version'),json_extract(j.value,'$.dueAt'),
      json_extract(j.value,'$.dueAt')+?,json_extract(j.value,'$.body'),
      CASE WHEN EXISTS(SELECT 1 FROM deliveries WHERE device_id=? AND reminder_id=json_extract(j.value,'$.id') AND due_at=json_extract(j.value,'$.dueAt')) THEN 'sent' ELSE 'queued' END
      FROM json_each(?) j
      WHERE (SELECT last_revision FROM devices WHERE id=?)=?
      ON CONFLICT(device_id,id) DO UPDATE SET version=excluded.version,due_at=excluded.due_at,expires_at=excluded.expires_at,body=excluded.body,
      status=CASE WHEN reminders.version=excluded.version AND reminders.status IN ('sent','sending','failed') THEN reminders.status ELSE excluded.status END,
      attempts=CASE WHEN reminders.version=excluded.version THEN reminders.attempts ELSE 0 END,
      next_attempt=CASE WHEN reminders.version=excluded.version THEN reminders.next_attempt ELSE 0 END,
      lease_until=CASE WHEN reminders.version=excluded.version AND reminders.status='sending' THEN reminders.lease_until ELSE 0 END`,
      ).bind(id, GRACE, id, JSON.stringify(rows), id, revision),
    );
    await env.DB.batch(statements);
    device = await env.DB.prepare('SELECT * FROM devices WHERE id=?')
      .bind(id)
      .first<Device>();
    if (device?.last_revision !== revision)
      throw new ApiError(409, 'Retry syncing the latest schedule.');
  } else if (!(action === 'reminders' && request.method === 'GET'))
    throw new ApiError(405, 'Method not allowed.');
  const result = await env.DB.prepare(
    `SELECT id,version,status,due_at AS dueAt FROM reminders WHERE device_id=? AND status!='cancelled'`,
  )
    .bind(id)
    .all();
  return { revision: device?.last_revision, reminders: result.results };
}

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin !== env.APP_ORIGIN)
    return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
  const headers = {
    'Access-Control-Allow-Origin': env.APP_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Setup-Code',
    'Access-Control-Max-Age': '3600',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  try {
    return Response.json(await route(request, env), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : 'Reminder service is temporarily unavailable.',
      },
      { status: error instanceof ApiError ? error.status : 503, headers },
    );
  }
}

export async function dispatchDue(env: Env, now = Date.now()) {
  const due = await env.DB.prepare(
    `SELECT r.*,d.subscription FROM reminders r JOIN devices d ON d.id=r.device_id
    WHERE d.invalid=0 AND r.due_at<=? AND r.expires_at>? AND r.next_attempt<=? AND
    (r.status='queued' OR (r.status='sending' AND r.lease_until<?)) ORDER BY r.due_at LIMIT 3`,
  )
    .bind(now, now, now, now)
    .all<Due>();
  for (const row of due.results) {
    const lease = now + 120_000;
    const claim = await env.DB.prepare(
      `UPDATE reminders SET status='sending',lease_until=? WHERE device_id=? AND id=? AND version=? AND
      (status='queued' OR (status='sending' AND lease_until<?))`,
    )
      .bind(lease, row.device_id, row.id, row.version, now)
      .run();
    if (!claim.meta.changes) continue;
    const current = await env.DB.prepare(
      `SELECT status,version FROM reminders WHERE device_id=? AND id=?`,
    )
      .bind(row.device_id, row.id)
      .first<{ status: string; version: string }>();
    if (current?.status !== 'sending' || current.version !== row.version)
      continue;
    let status = 0;
    try {
      const response = await push(
        env,
        row.subscription,
        {
          type: 'reminder',
          taskId: row.id,
          reminderAt: new Date(row.due_at).toISOString(),
          expiresAt: row.expires_at,
          title: 'Gawin',
          body: row.body,
          tag: `gawin-${row.id}`,
          url: `/?reminderTask=${encodeURIComponent(row.id)}`,
        },
        Math.max(1, Math.ceil((row.expires_at - now) / 1000)),
      );
      status = response.status;
    } catch {
      /* A bounded retry is safer than silently losing a reminder. */
    }
    if (status >= 200 && status < 300) {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT OR IGNORE INTO deliveries(device_id,reminder_id,due_at,sent_at) VALUES(?,?,?,?)',
        ).bind(row.device_id, row.id, row.due_at, now),
        env.DB.prepare(
          `UPDATE reminders SET status='sent' WHERE device_id=? AND id=? AND version=? AND lease_until=? AND status='sending'`,
        ).bind(row.device_id, row.id, row.version, lease),
      ]);
    } else {
      if (status === 404 || status === 410)
        await env.DB.prepare('UPDATE devices SET invalid=1 WHERE id=?')
          .bind(row.device_id)
          .run();
      const retry =
        (!status || status === 429 || status >= 500) && row.attempts < 2;
      await env.DB.prepare(
        "UPDATE reminders SET status=?,attempts=attempts+1,next_attempt=?,lease_until=0 WHERE device_id=? AND id=? AND version=? AND lease_until=? AND status='sending'",
      )
        .bind(
          retry ? 'queued' : 'failed',
          now + 60_000 * 2 ** row.attempts,
          row.device_id,
          row.id,
          row.version,
          lease,
        )
        .run();
    }
  }
  if (Math.floor(now / 60_000) % 60 === 0)
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reminders WHERE expires_at<?').bind(
        now - 86400_000,
      ),
      env.DB.prepare('DELETE FROM deliveries WHERE sent_at<?').bind(
        now - 2 * 86400_000,
      ),
      env.DB.prepare('DELETE FROM devices WHERE updated_at<?').bind(
        now - 90 * 86400_000,
      ),
    ]);
}

export default {
  fetch: handleRequest,
  scheduled: (_event: unknown, env: Env) => dispatchDue(env),
};
