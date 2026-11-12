-- Daily counters are shared across Cloudflare locations. No raw IP addresses.
CREATE TABLE service_limits (
  key TEXT PRIMARY KEY,
  used INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX service_limits_expiry ON service_limits(expires_at);
CREATE INDEX devices_updated ON devices(updated_at);
CREATE INDEX devices_endpoint ON devices(json_extract(subscription, '$.endpoint'));
