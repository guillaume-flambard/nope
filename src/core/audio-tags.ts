// ═══════════════════════════════════════
// NOPE. — Audio Tags Engine
// Reverse-engineers the ElevenLabs "performance cue" system:
// the LLM emits [tag] instructions in square brackets that the TTS
// interprets as emotion/delivery/sound cues. This module makes NOPE's
// LLM emit such cues naturally, and translates them into concrete
// prosodic controls for whatever TTS is active (ElevenLabs native,
// Piper, Edge, or Orpheus).
//
// Sources: ElevenLabs v3 audio-tag docs, expressive-mode guide,
// voice-settings reference (stability/similarity/style/speed).
// ═══════════════════════════════════════

import { Language } from './types';

/** Which cue categories are safe/calibrated for a polite phone call. */
export interface CuePolicy {
  emotions: string[];
  deliveries: string[];
  reactions: string[];
  pauses: string[];
}

// Calibrated cue vocabulary for a customer-service call in each language.
// Sparse on purpose: over-tagging sounds theatrical, not human.
const CUES: Record<Language, CuePolicy> = {
  en: {
    emotions: ['[slightly hesitant]', '[firm but polite]', '[calm]', '[a little awkward]'],
    deliveries: ['[speaking softly]', '[normal voice]'],
    reactions: ['[sighs]', '[clears throat]', '[short pause]', '[exhales]'],
    pauses: ['[short pause]', '[long pause]'],
  },
  fr: {
    emotions: ['[légèrement hésitant]', '[ferme mais poli]', '[calme]', '[un peu gêné]'],
    deliveries: ['[à voix basse]', '[voix normale]'],
    reactions: ['[soupir]', '[s\'éclaircit la gorge]', '[courte pause]', '[expire]'],
    pauses: ['[courte pause]', '[pause]'],
  },
  es: {
    emotions: ['[ligeramente vacilante]', '[firme pero cortés]', '[tranquilo]', '[un poco incómodo]'],
    deliveries: ['[en voz baja]', '[voz normal]'],
    reactions: ['[suspira]', '[se aclara la garganta]', '[pausa corta]', '[exhala]'],
    pauses: ['[pausa corta]', '[pausa]'],
  },
  de: {
    emotions: ['[leicht zögernd]', '[fest aber höflich]', '[ruhig]', '[etwas unbehaglich]'],
    deliveries: ['[leise sprechend]', '[normale Stimme]'],
    reactions: ['[seufzt]', '[räuspert sich]', '[kurze Pause]', '[atmet aus]'],
    pauses: ['[kurze Pause]', '[Pause]'],
  },
  it: {
    emotions: ['[leggermente esitante]', '[fermo ma educato]', '[calmo]', '[un po\' a disagio]'],
    deliveries: ['[a bassa voce]', '[voce normale]'],
    reactions: ['[sospira]', '[si schiarisce la gola]', '[breve pausa]', '[espira]'],
    pauses: ['[breve pausa]', '[pausa]'],
  },
};

/** Strip audio tags from a string (used when the TTS can't render them). */
export function stripAudioTags(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Keep only tag names in an array, ignoring plain text. */
export function extractTags(text: string): string[] {
  const matches = text.match(/\[([^\]]*)\]/g);
  return matches ? matches : [];
}

/** Count how many audible cues a turn carries (for dosage checks). */
export function cueCount(text: string): number {
  return extractTags(text).length;
}

/**
 * Translate tags to prosodic markers a given TTS understands.
 * - ElevenLabs: pass tags through (it natively understands them).
 * - Orpheus/Piper/Edge: convert [pause] to "..." and drop the rest
 *   (their engines can't render emotional tags, but pause markers work).
 */
export function renderTagsForTTS(text: string, provider: string): string {
  if (provider === 'elevenlabs') return text; // native support
  // Non-ElevenLabs: keep pauses as spoken ellipses, drop emotional cues.
  return text
    .replace(/\[(?:courte pause|short pause|breve pausa|kurze Pause|pause)\]/gi, '... ')
    .replace(/\[(?:long pause|pause|pausa)\]/gi, ' ... ... ')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Prompt block that tells the LLM to emit sparse, natural audio tags.
 * Calibrated: ~1 tag per turn, only where a real person would hesitate/react.
 */
export function buildAudioTagRule(lang: Language): string {
  const c = CUES[lang] || CUES.en;
  return [
    `SPARSE AUDIO CUES (${lang.toUpperCase()}):`,
    `- At most ONE cue per turn, and only where it feels natural. Never theatrical.`,
    `- Allowed emotion cues: ${c.emotions.join(', ')}`,
    `- Allowed reactions/pauses: ${c.reactions.join(', ')}`,
    `- Place the cue in square brackets exactly where the feeling occurs, e.g.`,
    lang === 'fr'
      ? `  "Oh, c'est gentil, mais... [courte pause] je préfère résilier quand même."`
      : `  "Oh, that's nice of you, but... [short pause] I'd still like to cancel."`,
    `- If a turn is neutral, emit NO cue at all.`,
  ].join('\n');
}
