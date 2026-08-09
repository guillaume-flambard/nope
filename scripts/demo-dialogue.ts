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

// ── Pipeline: NOPE's LLM + TTS (voice diana). Agent TTS uses a different voice. ──
const nopePipeline = new VoicePipeline({ language: lang });
const agentPipeline = new VoicePipeline({ language: lang, ttsProvider: 'groq', ttsVoice: 'austin' });

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

// Per-language agent / NOPE neural voices (Edge TTS).
const EDGE_VOICES: Record<Language, { agent: string; nope: string }> = {
  en: { agent: 'en-US-AndrewMultilingualNeural', nope: 'en-US-AvaMultilingualNeural' },
  fr: { agent: 'fr-FR-HenriNeural', nope: 'fr-FR-DeniseNeural' },
  es: { agent: 'es-ES-AlvaroNeural', nope: 'es-ES-ElviraNeural' },
  de: { agent: 'de-DE-ConradNeural', nope: 'de-DE-KatjaNeural' },
  it: { agent: 'it-IT-DiegoNeural', nope: 'it-IT-ElsaNeural' },
};

async function say(speaker: string, text: string, idx: number): Promise<string> {
  const p = speaker === 'agent' ? agentPipeline : nopePipeline;
  const buf = await p.textToSpeech(text).catch(() => undefined);
  const f = `/tmp/nope-demo-part-${String(idx).padStart(2, '0')}-${speaker}.wav`;
  if (buf && buf.length > 100) {
    fs.writeFileSync(f, buf);
    console.log(`[${speaker}] ${text}`);
    return f;
  }
  // Groq quota exhausted → fall back to Edge TTS (natural neural voice).
  const voices = EDGE_VOICES[lang] || EDGE_VOICES.en;
  const voice = speaker === 'agent' ? voices.agent : voices.nope;
  if (await edgeTTS(voice, text, f)) {
    console.log(`[${speaker}] ${text}  (edge-tts ${voice})`);
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
  await sleep(300);

  // 2. NOPE states goal
  const goalLine = lang === 'fr'
    ? `Euh... bonjour ${agentName}, voilà, je voudrais résilier mon abonnement ${company}, s'il vous plaît.`
    : `Hi ${agentName}, so I'd like to cancel my ${company} subscription, please.`;
  history.push({ role: 'user', content: opening });
  history.push({ role: 'assistant', content: goalLine });
  parts.push(await say('nope', goalLine, i++));
  await sleep(300);

  // 3. Agent asks why
  const why = agent.askWhy();
  parts.push(await say('agent', why, i++));
  await sleep(300);

  // 4. NOPE answers why (LLM-driven, varies)
  const whyReply = await nopeReply(why);
  history.push({ role: 'assistant', content: whyReply });
  parts.push(await say('nope', whyReply, i++));
  await sleep(300);

  // 5. Agent offers a deal
  const offer = agent.offer();
  parts.push(await say('agent', offer, i++));
  await sleep(300);

  // 6. NOPE declines (LLM-driven, varies)
  const declineReply = await nopeReply(offer);
  history.push({ role: 'assistant', content: declineReply });
  parts.push(await say('nope', declineReply, i++));
  await sleep(300);

  // 7. Agent asks an account question
  const question = agent.question(accountEnding());
  parts.push(await say('agent', question, i++));
  await sleep(300);

  // 8. NOPE answers (LLM-driven)
  const answerReply = await nopeReply(question);
  history.push({ role: 'assistant', content: answerReply });
  parts.push(await say('nope', answerReply, i++));
  await sleep(300);

  // 9. Agent confirms
  const ref = 'NP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const confirm = agent.confirm(ref);
  parts.push(await say('agent', confirm, i++));
  await sleep(300);

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

main().catch(e => { console.error('demo failed:', e.message); process.exit(1); });
