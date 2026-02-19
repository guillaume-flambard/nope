import { describe, it, expect } from 'vitest';
import {
  mulawToLinear16, linear16ToMulaw, pcmToWav, audioToMulaw8k,
  registerStream, getStream, removeStream, TwilioStreamHandler,
} from '../twilio-stream';

describe('Mulaw Codec', () => {
  it('doubles buffer size on decode', () => {
    const mulaw = Buffer.alloc(160, 0x80);
    expect(mulawToLinear16(mulaw).length).toBe(320);
  });

  it('halves buffer size on encode', () => {
    const pcm = Buffer.alloc(320);
    expect(linear16ToMulaw(pcm).length).toBe(160);
  });

  it('roundtrips all 256 values (±zero ambiguity)', () => {
    let ok = 0;
    for (let i = 0; i < 256; i++) {
      const buf = Buffer.from([i]);
      const pcm = mulawToLinear16(buf);
      const back = linear16ToMulaw(pcm);
      // 0x7F and 0xFF both decode to ~0 and re-encode to 0xFF
      if (buf[0] === back[0] || (buf[0] === 0x7F && back[0] === 0xFF)) ok++;
    }
    expect(ok).toBe(256);
  });

  it('decodes silence correctly', () => {
    const silence = Buffer.from([0xFF]);
    const pcm = mulawToLinear16(silence);
    expect(Math.abs(pcm.readInt16LE(0))).toBeLessThan(10);
  });

  it('decodes loud signal', () => {
    const loud = Buffer.from([0x00]);
    const pcm = mulawToLinear16(loud);
    expect(Math.abs(pcm.readInt16LE(0))).toBeGreaterThan(8000);
  });

  it('handles empty buffers', () => {
    expect(mulawToLinear16(Buffer.alloc(0)).length).toBe(0);
    expect(linear16ToMulaw(Buffer.alloc(0)).length).toBe(0);
  });
});

describe('pcmToWav', () => {
  const pcm = Buffer.alloc(16000);
  const wav = pcmToWav(pcm, 8000, 1, 16);

  it('starts with RIFF header', () => {
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });

  it('contains WAVE marker', () => {
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  it('has correct total size', () => {
    expect(wav.length).toBe(44 + pcm.length);
  });

  it('encodes sample rate', () => {
    expect(wav.readUInt32LE(24)).toBe(8000);
  });

  it('encodes channels', () => {
    expect(wav.readUInt16LE(22)).toBe(1);
  });

  it('encodes bits per sample', () => {
    expect(wav.readUInt16LE(34)).toBe(16);
  });

  it('encodes data chunk size', () => {
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
  });
});

describe('audioToMulaw8k', () => {
  it('converts WAV to mulaw via ffmpeg', async () => {
    // Create a minimal valid WAV (1s of silence at 8kHz 16-bit mono)
    const pcm = Buffer.alloc(16000);
    const wav = pcmToWav(pcm, 8000, 1, 16);
    const mulaw = await audioToMulaw8k(wav);
    // Should produce ~8000 bytes (1s at 8kHz, 1 byte/sample)
    expect(mulaw.length).toBeGreaterThan(7000);
    expect(mulaw.length).toBeLessThan(9000);
  });
});

describe('Session Registry', () => {
  it('returns undefined for unknown taskId', () => {
    expect(getStream('nonexistent')).toBeUndefined();
  });

  it('registers and retrieves a handler', () => {
    const mock = {} as TwilioStreamHandler;
    registerStream('test-1', mock);
    expect(getStream('test-1')).toBe(mock);
    removeStream('test-1');
  });

  it('removes a handler', () => {
    const mock = {} as TwilioStreamHandler;
    registerStream('test-2', mock);
    removeStream('test-2');
    expect(getStream('test-2')).toBeUndefined();
  });
});
