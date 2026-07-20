import type { LogLevel } from '@nestjs/common';

// Ordered most severe → most verbose. Selecting a level enables it and
// everything above it.
const ORDER: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

/**
 * Log level from the LOG_LEVEL env var, so verbosity can be changed on Railway
 * without a redeploy of new code.
 *
 * Defaults to `log` — which keeps the per-request HTTP lines but suppresses the
 * `debug`-level /health healthcheck spam.
 */
export function resolveLogLevels(): LogLevel[] {
  const requested = (process.env.LOG_LEVEL ?? 'log').toLowerCase() as LogLevel;
  const idx = ORDER.indexOf(requested);
  if (idx === -1) return ORDER.slice(0, ORDER.indexOf('log') + 1);
  return ORDER.slice(0, idx + 1);
}
