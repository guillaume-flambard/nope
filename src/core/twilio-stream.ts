// ═══════════════════════════════════════
// NOPE. — Twilio Media Stream Handler
// ═══════════════════════════════════════

import { spawn } from 'child_process';
import {
  CallPhase, CallTask, Strategy, StreamResult,
  TranscriptEntry, TwilioStreamMessage, NopeEvent,
  NopeEventHandler, CompanyInfo,
} from './types';
import { VoicePipeline } from './voice-pipeline';
import { IVRNavigator } from './ivr-navigator';
import { Caller } from './caller';
import { taskLogger } from './logger';

// ── Mulaw <-> Linear16 codec ──

const MULAW_DECODE_TABLE = new Int16Array(256);
const LINEAR_ENCODE_TABLE = new Uint8Array(65536);

(function buildTables() {
  // Build mulaw → linear16 decode table
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xFF;
    const sign = mu & 0x80;
    mu &= 0x7F;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0F;
    let sample = ((mantissa << 1) + 33) << (exponent + 2);
    sample -= 0x84;
    MULAW_DECODE_TABLE[i] = sign ? -sample : sample;
  }

  // Build linear16 → mulaw encode table
  for (let i = 0; i < 65536; i++) {
    const sample = (i < 32768) ? i : i - 65536;
    LINEAR_ENCODE_TABLE[i] = encodeOneMulaw(sample);
  }
})();

function encodeOneMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  const sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;

  // Find exponent via bit-shift (avoids floating-point Math.log2 drift)
  let exp = 7;
  for (let expMask = 0x4000; exp > 0; exp--, expMask >>= 1) {
    if (sample & expMask) break;
  }
  const mantissa = (sample >> (exp + 3)) & 0x0F;
  const mulaw = ~(sign | (exp << 4) | mantissa) & 0xFF;
  return mulaw;
}

export function mulawToLinear16(buf: Buffer): Buffer {
  const out = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const sample = MULAW_DECODE_TABLE[buf[i]];
    out.writeInt16LE(sample, i * 2);
  }
  return out;
}

export function linear16ToMulaw(buf: Buffer): Buffer {
  const out = Buffer.alloc(buf.length / 2);
  for (let i = 0; i < out.length; i++) {
    const sample = buf.readInt16LE(i * 2);
    out[i] = LINEAR_ENCODE_TABLE[(sample + 65536) & 0xFFFF];
  }
  return out;
}

// ── WAV header utilities ──

export function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // PCM chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

// ── TTS output → mulaw 8kHz conversion (via ffmpeg) ──

export async function audioToMulaw8k(input: Buffer): Promise<Buffer> {
  const FFMPEG_TIMEOUT_MS = 10_000;

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-ar', '8000',
      '-ac', '1',
      '-f', 'mulaw',
      '-acodec', 'pcm_mulaw',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill('SIGKILL');
        reject(new Error('ffmpeg timed out'));
      }
    }, FFMPEG_TIMEOUT_MS);

    const chunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', () => {}); // suppress ffmpeg logs
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`ffmpeg not found — install with: brew install ffmpeg (${err.message})`));
    });
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

// ── VAD (Voice Activity Detection) ──

interface VADState {
  isSpeaking: boolean;
  silenceStart: number;
  speechStart: number;
  lastEnergy: number;
}

function computeRMS(pcm: Buffer): number {
  let sum = 0;
  const samples = pcm.length / 2;
  for (let i = 0; i < samples; i++) {
    const s = pcm.readInt16LE(i * 2);
    sum += s * s;
  }
  return Math.sqrt(sum / samples);
}

// ── Session Registry ──

const streamRegistry = new Map<string, TwilioStreamHandler>();

export function registerStream(taskId: string, handler: TwilioStreamHandler): void {
  streamRegistry.set(taskId, handler);
}

export function getStream(taskId: string): TwilioStreamHandler | undefined {
  return streamRegistry.get(taskId);
}

export function removeStream(taskId: string): void {
  streamRegistry.delete(taskId);
}

// ── TwilioStreamHandler ──

interface StreamHandlerConfig {
  task: CallTask;
  strategy: Strategy;
  pipeline: VoicePipeline;
  ivrNavigator: IVRNavigator;
  caller: Caller;
  companyInfo?: CompanyInfo;
  baseUrl: string;
}

export class TwilioStreamHandler {
  private config: StreamHandlerConfig;
  private ws: any = null;       // WebSocket instance
  private streamSid: string = '';
  private callSid: string = '';

  // ── Audio buffer ──
  private audioBuffer: Buffer[] = [];
  private bufferByteCount = 0;

  // ── VAD state ──
  private vad: VADState = {
    isSpeaking: false,
    silenceStart: 0,
    speechStart: 0,
    lastEnergy: 0,
  };
  private static readonly SILENCE_THRESHOLD = 500;
  private static readonly SILENCE_DURATION_MS = 800;
  private static readonly MIN_SPEECH_MS = 1000;
  private static readonly MAX_BUFFER_MS = 15000;
  private static readonly SAMPLES_PER_MS_8K = 8; // 8000 Hz / 1000

  // ── Call state ──
  private phase: CallPhase = 'connecting';
  private transcript: TranscriptEntry[] = [];
  private startTime = Date.now();
  private processing = false;

  // ── DTMF reconnect handling ──
  private pendingReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Timeouts ──
  private static readonly CONNECTION_TIMEOUT_MS = 30_000;
  private static readonly DTMF_RECONNECT_TIMEOUT_MS = 15_000;
  private static readonly MAX_CALL_DURATION_MS = 15 * 60_000; // 15 minutes
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private callTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ──
  private completionResolve: ((result: StreamResult) => void) | null = null;
  private endReason: StreamResult['endReason'] = 'completed';
  private handlers: NopeEventHandler[] = [];

  private log;

  constructor(config: StreamHandlerConfig) {
    this.config = config;
    this.log = taskLogger(config.task.id);
  }

  /** Register event handler */
  on(handler: NopeEventHandler): void {
    this.handlers.push(handler);
  }

  private emit(event: NopeEvent): void {
    for (const handler of this.handlers) {
      try { handler(event); } catch (_) {}
    }
  }

  private emitStatus(status: string): void {
    this.emit({
      type: 'status',
      timestamp: new Date(),
      taskId: this.config.task.id,
      data: { status },
    });
  }

  private emitTranscript(speaker: TranscriptEntry['speaker'], text: string, action?: string): void {
    const entry: TranscriptEntry = { timestamp: new Date(), speaker, text, action };
    this.transcript.push(entry);
    this.emit({
      type: 'transcript',
      timestamp: new Date(),
      taskId: this.config.task.id,
      data: { speaker, text, action },
    });
  }

  /** Accept a new WebSocket connection from Twilio */
  handleConnection(ws: any): void {
    this.ws = ws;

    // Clear any pending connection/reconnect timers
    if (this.connectionTimer) { clearTimeout(this.connectionTimer); this.connectionTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

    // Start max call duration timer (once, on first connection)
    if (!this.callTimer) {
      this.callTimer = setTimeout(() => {
        this.emitTranscript('system', 'Max call duration reached — terminating');
        this.endReason = 'hangup';
        this.terminate();
      }, TwilioStreamHandler.MAX_CALL_DURATION_MS);
    }

    // Connection timeout: if we don't get 'start' within 30s, something is wrong
    this.connectionTimer = setTimeout(() => {
      if (this.phase === 'connecting') {
        this.emitTranscript('system', 'Connection timeout — no stream start received');
        this.endReason = 'error';
        this.resolveCompletion();
      }
    }, TwilioStreamHandler.CONNECTION_TIMEOUT_MS);

    ws.on('message', (data: string) => {
      try {
        const msg: TwilioStreamMessage = JSON.parse(data);
        switch (msg.event) {
          case 'connected':
            this.emitTranscript('system', 'Twilio stream connected');
            break;

          case 'start':
            if (this.connectionTimer) { clearTimeout(this.connectionTimer); this.connectionTimer = null; }
            this.streamSid = msg.start.streamSid;
            this.callSid = msg.start.callSid;
            this.log.info({ streamSid: this.streamSid, callSid: this.callSid }, 'Stream started');
            if (this.phase === 'connecting') {
              this.phase = 'ivr';
              this.emitStatus('ivr');
              this.emitTranscript('system', `Stream started — SID: ${this.streamSid}`);
            }
            break;

          case 'media':
            this.handleMedia(msg.media.payload, parseInt(msg.media.timestamp, 10));
            break;

          case 'stop':
            this.handleStop();
            break;
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      if (!this.pendingReconnect) {
        this.resolveCompletion();
      }
    });

    ws.on('error', () => {
      this.endReason = 'error';
      this.resolveCompletion();
    });
  }

  /** Handle incoming audio chunk from Twilio */
  private handleMedia(base64Payload: string, timestamp: number): void {
    // Skip audio processing during hold phase (hold music spams STT)
    if (this.phase === 'holding') return;

    const mulaw = Buffer.from(base64Payload, 'base64');
    const pcm = mulawToLinear16(mulaw);

    // VAD: compute energy
    const rms = computeRMS(pcm);
    const now = Date.now();

    if (rms > TwilioStreamHandler.SILENCE_THRESHOLD) {
      // Speech detected
      if (!this.vad.isSpeaking) {
        this.vad.isSpeaking = true;
        this.vad.speechStart = now;
      }
      this.vad.silenceStart = 0;
    } else {
      // Silence
      if (this.vad.isSpeaking && this.vad.silenceStart === 0) {
        this.vad.silenceStart = now;
      }
    }

    this.vad.lastEnergy = rms;

    // Accumulate audio
    this.audioBuffer.push(mulaw);
    this.bufferByteCount += mulaw.length;

    // Check VAD trigger conditions
    const bufferDurationMs = (this.bufferByteCount / TwilioStreamHandler.SAMPLES_PER_MS_8K);
    const silenceDuration = this.vad.silenceStart > 0 ? now - this.vad.silenceStart : 0;
    const speechDuration = this.vad.isSpeaking ? now - this.vad.speechStart : 0;

    const shouldProcess =
      (this.vad.isSpeaking && silenceDuration >= TwilioStreamHandler.SILENCE_DURATION_MS && speechDuration >= TwilioStreamHandler.MIN_SPEECH_MS) ||
      (bufferDurationMs >= TwilioStreamHandler.MAX_BUFFER_MS);

    if (shouldProcess && !this.processing) {
      this.processBuffer();
    }
  }

  /** Process accumulated audio buffer through the pipeline */
  private async processBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0 || this.processing) return;
    this.processing = true;

    // Grab buffer and reset
    const mulawData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    this.bufferByteCount = 0;
    this.vad.isSpeaking = false;
    this.vad.silenceStart = 0;

    try {
      // Convert mulaw → linear16 PCM → WAV
      const pcm = mulawToLinear16(mulawData);
      const wav = pcmToWav(pcm, 8000, 1, 16);

      // Route based on current phase
      if (this.phase === 'ivr') {
        await this.processIVR(wav);
      } else {
        await this.processConversation(wav);
      }
    } catch (err: any) {
      this.log.error({ err: err.message, phase: this.phase }, 'Pipeline error');
      this.emitTranscript('system', `Pipeline error: ${err.message}`);
    } finally {
      this.processing = false;
    }
  }

  /** Process audio during IVR phase */
  private async processIVR(wav: Buffer): Promise<void> {
    const text = await this.config.pipeline.speechToText(wav);
    if (!text || text.trim().length === 0) return;

    this.emitTranscript('ivr', text);

    // Check if a human agent is speaking
    const action = this.config.pipeline.detectAction(text);
    if (action === 'human_agent') {
      this.phase = 'talking';
      this.emitStatus('talking');
      this.emitTranscript('system', 'Human agent detected — switching to conversation mode');
      await this.processConversation(wav);
      return;
    }

    if (action === 'hold_message') {
      this.phase = 'holding';
      this.emitStatus('holding');
      this.emitTranscript('system', 'On hold — waiting for agent');
      // Set a timer to re-enable listening after a period
      setTimeout(() => {
        if (this.phase === 'holding') {
          this.phase = 'ivr';
        }
      }, 30000);
      return;
    }

    if (action === 'transfer') {
      this.emitTranscript('system', 'Being transferred...');
      return;
    }

    // Analyze IVR menu
    const analysis = this.config.ivrNavigator.analyze(
      text,
      this.config.task.strategy,
      this.config.task.language,
      this.config.companyInfo?.ivrHints,
    );

    this.emitTranscript('system', `IVR: ${analysis.reason} (confidence: ${analysis.confidence})`);

    if (analysis.action === 'press_key' || analysis.action === 'press_zero') {
      await this.sendDTMF(analysis.value);
    } else if (analysis.action === 'enter_digits') {
      // We don't know the subscriber number: press 0 to reach a human instead of looping.
      await this.sendDTMF('0');
      this.emitTranscript('system', 'IVR requested a subscriber number — pressing 0 for a human agent');
    }
    // 'wait' and 'speak' actions: do nothing special, keep listening
  }

  /** Process audio during conversation with human agent */
  private async processConversation(wav: Buffer): Promise<void> {
    const result = await this.config.pipeline.processAudio(wav, this.config.strategy, {
      company: this.config.task.company || 'the company',
      history: this.transcript,
    });

    if (!result.text || result.text.trim().length === 0) return;

    // Log what the agent said
    this.emitTranscript('agent', result.text, result.action);

    // Check for success/completion
    if (result.action === 'success') {
      this.phase = 'ending';
      this.emitStatus('success');
    }

    // Check if we should transition to negotiating
    if (this.phase === 'talking' && result.action !== 'holding') {
      this.phase = 'negotiating';
      this.emitStatus('negotiating');
    }

    // If pipeline generated a response, send TTS audio back
    if (result.audioResponse) {
      const responseText = this.config.pipeline['conversationHistory']?.slice(-1)?.[0]?.content || '';
      if (responseText) {
        this.emitTranscript('nope', responseText);
      }
      await this.sendTTSAudio(result.audioResponse);
    }
  }

  /** Convert TTS audio to mulaw and send over WebSocket */
  private async sendTTSAudio(ttsBuffer: Buffer): Promise<void> {
    try {
      const mulaw = await audioToMulaw8k(ttsBuffer);
      this.sendAudio(mulaw);
    } catch (err: any) {
      this.emitTranscript('system', `TTS send error: ${err.message}`);
    }
  }

  /** Send mulaw audio back to Twilio in 20ms chunks */
  sendAudio(mulawBuffer: Buffer): void {
    if (!this.ws || this.ws.readyState !== 1) return; // WebSocket.OPEN = 1

    const CHUNK_SIZE = 160; // 20ms at 8kHz mulaw (8000 * 0.020)
    for (let offset = 0; offset < mulawBuffer.length; offset += CHUNK_SIZE) {
      const chunk = mulawBuffer.subarray(offset, offset + CHUNK_SIZE);
      const msg = JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: chunk.toString('base64'),
        },
      });
      this.ws.send(msg);
    }

    // Send a mark to know when playback completes
    this.ws.send(JSON.stringify({
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name: `nope_${Date.now()}` },
    }));
  }

  /** Send DTMF digits via Twilio REST API (causes WS reconnect) */
  async sendDTMF(digits: string): Promise<void> {
    if (!this.callSid) return;

    this.log.info({ digits, callSid: this.callSid }, 'Sending DTMF');
    this.emitTranscript('nope', `(Pressing ${digits})`, `pressed_${digits}`);
    this.pendingReconnect = true;

    try {
      await this.config.caller.sendDTMF(
        this.callSid,
        digits,
        this.config.task.id,
        this.config.baseUrl,
      );
      // Twilio will close current WS and open a new one after playing digits
      // handleConnection() will be called again with the new WS

      // Safety: if reconnect doesn't happen within timeout, stop waiting
      this.reconnectTimer = setTimeout(() => {
        if (this.pendingReconnect) {
          this.pendingReconnect = false;
          this.emitTranscript('system', 'DTMF reconnect timeout — stream did not reconnect');
          this.endReason = 'error';
          this.resolveCompletion();
        }
      }, TwilioStreamHandler.DTMF_RECONNECT_TIMEOUT_MS);
    } catch (err: any) {
      this.pendingReconnect = false;
      this.emitTranscript('system', `DTMF failed: ${err.message}`);
    }
  }

  /** Accept a reconnected WebSocket (after DTMF) */
  acceptReconnection(ws: any): void {
    this.pendingReconnect = false;
    this.audioBuffer = [];
    this.bufferByteCount = 0;
    this.vad.isSpeaking = false;
    this.vad.silenceStart = 0;
    this.handleConnection(ws);
  }

  /** Handle Twilio status callback */
  handleStatusCallback(status: string, callSid: string, duration?: number): void {
    switch (status) {
      case 'completed':
        this.endReason = 'completed';
        this.resolveCompletion();
        break;
      case 'busy':
        this.endReason = 'busy';
        this.emitTranscript('system', 'Line busy');
        this.resolveCompletion();
        break;
      case 'failed':
        this.endReason = 'failed';
        this.emitTranscript('system', 'Call failed');
        this.resolveCompletion();
        break;
      case 'no-answer':
        this.endReason = 'no-answer';
        this.emitTranscript('system', 'No answer');
        this.resolveCompletion();
        break;
    }
  }

  /** Handle stream stop event */
  private handleStop(): void {
    if (!this.pendingReconnect) {
      this.resolveCompletion();
    }
  }

  /** Returns a Promise that resolves when the call ends */
  waitForCompletion(): Promise<StreamResult> {
    return new Promise((resolve) => {
      this.completionResolve = resolve;
    });
  }

  /** Manually terminate the call */
  async terminate(): Promise<void> {
    if (this.callSid) {
      this.endReason = 'hangup';
      try {
        await this.config.caller.hangup(this.callSid);
      } catch (_) {}
    }
    this.resolveCompletion();
  }

  /** Resolve the completion promise */
  private resolveCompletion(): void {
    if (!this.completionResolve) return;

    // Clear all timers
    if (this.connectionTimer) { clearTimeout(this.connectionTimer); this.connectionTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.callTimer) { clearTimeout(this.callTimer); this.callTimer = null; }

    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const successActions = this.transcript.filter(t => t.action === 'success');

    const result: StreamResult = {
      status: successActions.length > 0 ? 'success' : (this.transcript.length > 2 ? 'partial' : 'failed'),
      summary: this.buildSummary(),
      transcript: this.transcript,
      duration,
      twilioCallSid: this.callSid,
      endReason: this.endReason,
    };

    this.log.info({ status: result.status, endReason: result.endReason, duration, transcriptLines: this.transcript.length }, 'Call completed');

    const resolve = this.completionResolve;
    this.completionResolve = null;
    resolve(result);

    // Cleanup WS
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }

  /** Build a summary from the transcript */
  private buildSummary(): string {
    const agentLines = this.transcript.filter(t => t.speaker === 'agent');
    const nopeLines = this.transcript.filter(t => t.speaker === 'nope');

    if (agentLines.length === 0) {
      return `Call ended (${this.endReason}) — no agent interaction`;
    }

    // Look for confirmation numbers in agent speech
    const confirmationPattern = /(?:confirmation|reference|ref|numéro)[:\s]*([A-Z0-9-]+)/i;
    for (const line of agentLines) {
      const match = line.text.match(confirmationPattern);
      if (match) {
        return `${this.config.task.strategy} completed — ref: ${match[1]}`;
      }
    }

    // Use last meaningful exchange
    const lastAgent = agentLines[agentLines.length - 1]?.text || '';
    return `${this.config.task.strategy} call — ${this.endReason}. Last: "${lastAgent.substring(0, 80)}"`;
  }
}
