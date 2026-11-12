import type { D1Database } from '@cloudflare/workers-types';

const DAY = 86400_000;
// These are shared service allowances, not per-user hosting entitlements.
export const SERVICE_LIMITS = {
  requestsPerDay: 15_000,
  registrationsPerDay: 100,
  registrationsPerNetworkPerDay: 25,
  registeredDevices: 500,
  snapshotWritesPerDay: 35_000,
  notificationsPerDay: 2_000,
  notificationsPerDevicePerDay: 30,
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter: number;
  constructor(status: number, message: string, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function reserveDaily(
  db: D1Database,
  scope: string,
  allowance: number,
  cost = 1,
  now = Date.now(),
) {
  const day = Math.floor(now / DAY);
  const result = await db.prepare(`
    INSERT INTO service_limits (key,used,expires_at) SELECT ?,?,? WHERE ?<=?
    ON CONFLICT(key) DO UPDATE SET used=service_limits.used+excluded.used
    WHERE service_limits.used+excluded.used<=?
  `).bind(`${scope}:${day}`, cost, (day + 1) * DAY, cost, allowance, allowance).run();
  return Boolean(result.meta.changes);
}

export async function requireDaily(
  db: D1Database,
  scope: string,
  allowance: number,
  message: string,
  cost = 1,
) {
  if (!await reserveDaily(db, scope, allowance, cost)) {
    throw new ApiError(429, message, Math.ceil((DAY - Date.now() % DAY) / 1000));
  }
}
