// ═══════════════════════════════════════
// NOPE. — Structured Logger
// ═══════════════════════════════════════

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});

export function taskLogger(taskId: string) {
  return logger.child({ taskId });
}
