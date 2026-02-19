// ═══════════════════════════════════════
// NOPE. — Express Server + SSE Streaming
// ═══════════════════════════════════════

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { NopeAgent } from '../core/agent';
import { CompanyFinder } from '../lookup/company-finder';
import { NopeEvent } from '../core/types';
import { getStream } from '../core/twilio-stream';
import { logger } from '../core/logger';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ──

const MAX_CONCURRENT_CALLS = parseInt(process.env.MAX_CONCURRENT_CALLS || '5');
const MAX_CALLS_PER_IP_PER_MIN = 3;
const ipCallCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; reason?: string } {
  // Global concurrent limit
  if (activeCalls.size >= MAX_CONCURRENT_CALLS) {
    return { allowed: false, reason: `Max concurrent calls reached (${MAX_CONCURRENT_CALLS})` };
  }

  // Per-IP rate limit
  const now = Date.now();
  const entry = ipCallCounts.get(ip);
  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_CALLS_PER_IP_PER_MIN) {
      return { allowed: false, reason: 'Too many requests — try again in a minute' };
    }
    entry.count++;
  } else {
    ipCallCounts.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  return { allowed: true };
}

// In-memory store for active calls
const activeCalls = new Map<string, {
  events: NopeEvent[];
  listeners: Set<express.Response>;
}>();

/** POST /api/call — Start a new call */
app.post('/api/call', async (req, res) => {
  const { goal, simulate } = req.body;

  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ error: 'Missing "goal" in request body' });
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    logger.warn({ clientIp, reason: rateCheck.reason }, 'Rate limited');
    return res.status(429).json({ error: rateCheck.reason });
  }

  const agent = new NopeAgent();
  const callId = Math.random().toString(36).substring(2, 10);

  // Set up event tracking
  activeCalls.set(callId, { events: [], listeners: new Set() });

  agent.on((event: NopeEvent) => {
    const callData = activeCalls.get(callId);
    if (!callData) return;

    callData.events.push(event);

    // Send to all SSE listeners
    for (const listener of callData.listeners) {
      try {
        listener.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (_) {
        callData.listeners.delete(listener);
      }
    }
  });

  // Return callId immediately, execute in background
  logger.info({ callId, goal, simulate }, 'Call started');
  res.json({ callId, status: 'started' });

  // Execute the call
  try {
    const result = await agent.execute(goal, {
      simulate: simulate !== false, // Default to simulation
    });

    // Send final result
    const callData = activeCalls.get(callId);
    if (callData) {
      const doneEvent: NopeEvent = {
        type: 'result',
        timestamp: new Date(),
        taskId: callId,
        data: result,
      };
      for (const listener of callData.listeners) {
        try {
          listener.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
        } catch (_) {}
      }
    }
  } catch (err: any) {
    logger.error({ callId, err: err.message }, 'Call failed');
    const callData = activeCalls.get(callId);
    if (callData) {
      const errorEvent: NopeEvent = {
        type: 'error',
        timestamp: new Date(),
        taskId: callId,
        data: { message: err.message },
      };
      for (const listener of callData.listeners) {
        try {
          listener.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        } catch (_) {}
      }
    }
  }
});

/** GET /api/call/:id/stream — SSE event stream */
app.get('/api/call/:id/stream', (req, res) => {
  const callId = req.params.id;
  const callData = activeCalls.get(callId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  if (!callData) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Call not found' } })}\n\n`);
    return res.end();
  }

  // Send existing events first (replay)
  for (const event of callData.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Register as listener for new events
  callData.listeners.add(res);

  req.on('close', () => {
    callData.listeners.delete(res);
  });
});

/** GET /api/call/:id — Get call status */
app.get('/api/call/:id', (req, res) => {
  const callData = activeCalls.get(req.params.id);
  if (!callData) {
    return res.status(404).json({ error: 'Call not found' });
  }

  const lastStatus = [...callData.events]
    .reverse()
    .find(e => e.type === 'status');

  const result = [...callData.events]
    .reverse()
    .find(e => e.type === 'result');

  res.json({
    callId: req.params.id,
    status: lastStatus?.data?.status || 'unknown',
    events: callData.events.length,
    result: result?.data || null,
  });
});

/** GET /api/companies — List known companies */
app.get('/api/companies', (_req, res) => {
  const finder = new CompanyFinder();
  res.json({ companies: finder.list() });
});

/** GET /api/health — Health check */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'NOPE.',
    version: '0.1.0',
    mode: process.env.SIMULATE === 'true' ? 'simulation' : 'live',
    providers: {
      openai: !!process.env.OPENAI_API_KEY,
      twilio: !!process.env.TWILIO_ACCOUNT_SID,
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
  });
});

/** POST /api/twilio/voice — Twilio webhook for live calls */
app.post('/api/twilio/voice', (req, res) => {
  const taskId = req.query.taskId as string;
  const baseUrl = process.env.BASE_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '4000'}`;
  const wsUrl = baseUrl.replace(/^http/, 'ws');

  // Return TwiML to connect WebSocket for audio streaming
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/api/twilio/stream?taskId=${taskId}" />
  </Connect>
</Response>`);
});

/** POST /api/twilio/status — Twilio call status callback */
app.post('/api/twilio/status', (req, res) => {
  const taskId = req.query.taskId as string;
  const { CallStatus, CallSid, CallDuration } = req.body;

  logger.info({ taskId, CallStatus, CallSid, CallDuration }, 'Twilio status callback');
  const handler = getStream(taskId);
  if (handler) {
    handler.handleStatusCallback(CallStatus, CallSid, parseInt(CallDuration || '0', 10));
  }

  res.sendStatus(200);
});

/** Serve the UI */
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ──
export function startServer(): void {
  const port = parseInt(process.env.PORT || '4000');
  const host = process.env.HOST || 'localhost';

  const server = createServer(app);

  // ── WebSocket server for Twilio Media Streams ──
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    if (url.pathname === '/api/twilio/stream') {
      const taskId = url.searchParams.get('taskId');
      if (!taskId) {
        socket.destroy();
        return;
      }

      const handler = getStream(taskId);
      if (!handler) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const isReconnect = (handler as any).pendingReconnect;
        logger.info({ taskId, isReconnect }, 'Twilio WS connected');
        if (isReconnect) {
          handler.acceptReconnection(ws);
        } else {
          handler.handleConnection(ws);
        }
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    logger.info({ host, port }, 'NOPE. server running');
    // Keep the ASCII banner for dev UX (CLI output)
    console.log('');
    console.log('  ╔══════════════════════════════════╗');
    console.log('  ║                                  ║');
    console.log('  ║   \x1b[32mNOPE.\x1b[0m is running              ║');
    console.log(`  ║   http://${host}:${port}          ║`);
    console.log('  ║                                  ║');
    console.log('  ╚══════════════════════════════════╝');
    console.log('');
  });
}

// Run directly
if (require.main === module) {
  require('dotenv').config();
  startServer();
}
