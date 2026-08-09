// ═══════════════════════════════════════
// NOPE. — Demo Dialogue Generator
// Produces a complete 2-voice human-like call (agent + NOPE) and
// writes it to a single WAV. Stable: falls back to scripted lines
// if the LLM or TTS fails, so the output is never broken.
//
// Usage:
//   bun run scripts/demo-dialogue.ts --lang en --company Netflix --goal "Cancel my Netflix subscription"
//   afplay /tmp/nope-demo-en.wav
// ═══════════════════════════════════════

import { config } from 'dotenv';
config();

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VoicePipeline } from '../src/core/voice-pipeline';
import { AgentVoice, accountEnding } from '../src/core/agent-voice';
import type { Language } from '../src/core/types';

// ── Edge TTS (Microsoft neural voices) as reliable natural fallback.
// Free, no key, high quality. Path to the venv that has edge-tts installed.
const EDGE_TTS = process.env.EDGE_TTS_BIN || '/tmp/edge-venv/bin/edge-tts';

const args = process.argv.slice(2);
const val = (flag: string, dflt: string): string => {
  const eq = args.find(a => a.startsWith(`${flag}=`))?.split('=')[1];
  if (eq) return eq;
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : dflt;
};
const lang = val('--lang', 'en') as Language;
const company = val('--company', 'Netflix');
const goal = val('--goal', 'Cancel my Netflix subscription');
const out = val('--out', `/tmp/nope-demo-${val('--lang', 'en')}.wav`);

// ── Pipeline: NOPE's LLM + TTS. Agent TTS uses a different voice. ──
// If ELEVENLABS_API_KEY is set, both use ElevenLabs (best quality) with distinct voices.
const hasEleven = !!process.env.ELEVENLABS_API_KEY;
const nopePipeline = new VoicePipeline({
  language: lang,
  ...(hasEleven
    ? { ttsProvider: 'elevenlabs' as const, ttsVoice: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB' }
    : {}),
});
const agentPipeline = new VoicePipeline({
  language: lang,
  ...(hasEleven
    ? { ttsProvider: 'elevenlabs' as const, ttsVoice: process.env.ELEVENLABS_AGENT_VOICE || 'jBpfuIE2ffCO9mMExCc1' }
    : { ttsProvider: 'groq' as const, ttsVoice: 'austin' }),
});

const strategy: any = {
  type: 'cancel',
  systemPrompt: lang === 'fr' ? 'Vous résiliez un abonnement.' : 'You are canceling a subscription.',
  tactics: [],
};

const agent = new AgentVoice(lang);
const agentName = (lang === 'fr' ? ['Marie', 'Thomas', 'Sophie', 'Lucas']
  : ['Sarah', 'James', 'Emma', 'David'])[Math.floor(Math.random() * 4)];

const history: Array<{ role: string; content: string }> = [];

async function nopeReply(agentTurn: string): Promise<string> {
  if (agentTurn) history.push({ role: 'user', content: agentTurn });
  const sys = nopePipeline.buildSystemPrompt(strategy, { company, history: [] });
  const r = await nopePipeline.generateResponse(sys, history).catch((e) => {
    console.error('  ⚠ LLM failed:', e.message);
    return '';
  });
  if (r && r.trim()) return r.trim();
  return (lang === 'fr'
    ? "Euh... voilà, je voudrais résilier, s'il vous plaît."
    : "Um, I'd like to cancel my subscription, please.");
}

async function edgeTTS(voice: string, text: string, wavPath: string): Promise<boolean> {
  try {
    const mp3 = wavPath.replace(/\.wav$/, '.mp3');
    execFileSync(EDGE_TTS, ['--voice', voice, '--text', text, '--write-media', mp3], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-i', mp3, '-ar', '24000', '-ac', '1', wavPath], { stdio: 'ignore' });
    fs.unlinkSync(mp3);
    return fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000;
  } catch (_) {
    return false;
  }
}

// Piper (local neural VITS) — free, unlimited, high quality. Best primary voice.
const PIPER_BIN = process.env.PIPER_BIN || '/tmp/kokoro-venv/bin/python';
const PIPER_SCRIPT = process.env.PIPER_SCRIPT || '/Users/memo/projects/nope/scripts/tts/piper_say.py';
const PIPER_VOICES_DIR = process.env.PIPER_VOICES_DIR || '/tmp/piper-voices';

// Per-language Piper voices (agent = male, nope = female).
const PIPER_VOICES: Record<Language, { agent: string; nope: string }> = {
  en: { agent: 'en_US-ryan-medium.onnx', nope: 'en_US-amy-medium.onnx' },
  fr: { agent: 'fr_FR-upmc-medium.onnx', nope: 'fr_FR-upmc-medium.onnx' },
  es: { agent: 'es_ES-davefx-medium.onnx', nope: 'es_ES-davefx-medium.onnx' },
  de: { agent: 'de_DE-thorsten-medium.onnx', nope: 'de_DE-thorsten-medium.onnx' },
  it: { agent: 'it_IT-paola-medium.onnx', nope: 'it_IT-paola-medium.onnx' },
};

async function piperTTS(voice: string, text: string, wavPath: string): Promise<boolean> {
  try {
    execFileSync(PIPER_BIN, [PIPER_SCRIPT, `${PIPER_VOICES_DIR}/${voice}`, text, wavPath], { stdio: 'ignore' });
    return fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000;
  } catch (_) {
    return false;
  }
}

async function say(speaker: string, text: string, idx: number): Promise<string> {
  const f = `/tmp/nope-demo-part-${String(idx).padStart(2, '0')}-${speaker}.wav`;

  // 1) Primary: Piper (local neural, unlimited).
  const pv = PIPER_VOICES[lang] || PIPER_VOICES.en;
  const voice = speaker === 'agent' ? pv.agent : pv.nope;
  if (await piperTTS(voice, text, f)) {
    console.log(`[${speaker}] ${text}  (piper ${voice})`);
    return f;
  }

  // 2) Fallback: Groq Orpheus (best quality, but rate-limited).
  const p = speaker === 'agent' ? agentPipeline : nopePipeline;
  const buf = await p.textToSpeech(text).catch(() => undefined);
  if (buf && buf.length > 100) {
    // ElevenLabs returns MP3; Piper/Orpheus return WAV. Normalize to WAV via ffmpeg.
    fs.writeFileSync(f, buf);
    const isMp3 = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
    if (isMp3) {
      const mp3 = f.replace(/\.wav$/, '.mp3');
      fs.writeFileSync(mp3, buf);
      execFileSync('ffmpeg', ['-y', '-i', mp3, '-ar', '24000', '-ac', '1', f], { stdio: 'ignore' });
      fs.unlinkSync(mp3);
    }
    console.log(`[${speaker}] ${text}  (pipeline TTS)`);
    return f;
  }

  // 3) Last resort: Edge TTS.
  const ev = EDGE_VOICES[lang] || EDGE_VOICES.en;
  const eVoice = speaker === 'agent' ? ev.agent : ev.nope;
  if (await edgeTTS(eVoice, text, f)) {
    console.log(`[${speaker}] ${text}  (edge-tts ${eVoice})`);
    return f;
  }
  console.log(`[${speaker}] ${text}  (⚠ no audio)`);
  return '';
}

async function main(): Promise<void> {
  const parts: string[] = [];
  let i = 0;

  // 1. Agent opens
  const opening = agent.opening(company, agentName);
  parts.push(await say('agent', opening, i++));
  await naturalPause('nope');

  // 2. NOPE states goal
  const goalLine = lang === 'fr'
    ? `Euh... bonjour ${agentName}, voilà, je voudrais résilier mon abonnement ${company}, s'il vous plaît.`
    : `Hi ${agentName}, so I'd like to cancel my ${company} subscription, please.`;
  history.push({ role: 'user', content: opening });
  history.push({ role: 'assistant', content: goalLine });
  parts.push(await say('nope', goalLine, i++));
  await naturalPause('agent');

  // 3. Agent asks why
  const why = agent.askWhy();
  parts.push(await say('agent', why, i++));
  await naturalPause('nope');

  // 4. NOPE answers why (LLM-driven, varies)
  const whyReply = await nopeReply(why);
  history.push({ role: 'assistant', content: whyReply });
  parts.push(await say('nope', whyReply, i++));
  await naturalPause('agent');

  // 5. Agent offers a deal
  const offer = agent.offer();
  parts.push(await say('agent', offer, i++));
  await naturalPause('nope');

  // 6. NOPE declines (LLM-driven, varies)
  const declineReply = await nopeReply(offer);
  history.push({ role: 'assistant', content: declineReply });
  parts.push(await say('nope', declineReply, i++));
  await naturalPause('agent');

  // 7. Agent asks an account question
  const question = agent.question(accountEnding());
  parts.push(await say('agent', question, i++));
  await naturalPause('nope');

  // 8. NOPE answers (LLM-driven)
  const answerReply = await nopeReply(question);
  history.push({ role: 'assistant', content: answerReply });
  parts.push(await say('nope', answerReply, i++));
  await naturalPause('agent');

  // 9. Agent confirms
  const ref = 'NP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const confirm = agent.confirm(ref);
  parts.push(await say('agent', confirm, i++));
  await naturalPause('nope');

  // 10. NOPE closes
  const close = lang === 'fr'
    ? `D'accord, merci beaucoup ${agentName}, bonne journée !`
    : `Okay, that works... thanks so much, ${agentName}, have a great day!`;
  history.push({ role: 'user', content: confirm });
  history.push({ role: 'assistant', content: close });
  parts.push(await say('nope', close, i++));

  // ── Concatenate all audio parts into one WAV ──
  const withAudio = parts.filter(p => p.length > 0);
  if (withAudio.length === 0) {
    console.error('No audio generated — check GROQ_API_KEY and Orpheus terms acceptance.');
    process.exit(1);
  }
  const list = withAudio.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync('/tmp/nope-demo-list.txt', list);
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', '/tmp/nope-demo-list.txt', '-c', 'copy', out], { stdio: 'ignore' });

  console.log('\n=== DIALOGUE DONE ===');
  console.log(`File: ${out}`);
  console.log(`Turns: ${withAudio.length} audio parts`);
  console.log(`Play: afplay ${out}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Natural variable pause — humans don't reply on a fixed 300ms metronome. */
function naturalPause(speaker: string): Promise<void> {
  // After NOPE replies, the agent "reads/checks" (longer). After the agent,
  // NOPE replies quickly but not instantly (small planning pause).
  const [min, max] = speaker === 'nope' ? [250, 600] : [500, 900];
  const ms = min + Math.floor(Math.random() * (max - min));
  return sleep(ms);
}

main().catch(e => { console.error('demo failed:', e.message); process.exit(1); });
