CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  subscription TEXT NOT NULL,
  origin TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  last_revision INTEGER NOT NULL DEFAULT 0,
  invalid INTEGER NOT NULL DEFAULT 0,
  test_after INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE reminders (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(device_id, id)
);
CREATE INDEX reminders_due ON reminders(status, next_attempt, due_at);
CREATE TABLE deliveries (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY(device_id, reminder_id, due_at)
);
