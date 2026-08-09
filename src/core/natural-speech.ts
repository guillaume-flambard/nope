// ═══════════════════════════════════════
// NOPE. — Natural Speech Engine
// Encodes the science of natural conversation per language
// (fillers, disfluencies, backchannels, hedges, politeness,
//  prosody-for-TTS) from the `natural-voice` skill.
// ═══════════════════════════════════════

import { Language } from './types';

interface NaturalProfile {
  fillers: string[];        // turn-opening fillers (buy time + hold floor)
  hedges: string[];         // mitigation / softening
  disfluencies: string[];   // false starts, self-corrections
  backchannels: string[];   // listening tokens (not for LLM turns; for live barge-in)
  reactions: string[];      // emotional reactions ("oh", "ugh")
  closers: string[];        // sequence-closing thirds ("okay that works")
  examples: string[];       // few-shot natural turns
  cultural: string;         // calibration note for the prompt
}

const PROFILES: Record<Language, NaturalProfile> = {
  en: {
    fillers: ['um', 'so', 'okay', 'well', 'right', 'you know', 'I mean', 'let me see', 'actually', 'yeah'],
    hedges: ['I think', 'probably', 'I guess', 'kind of', "it's just that", "I'm not sure"],
    disfluencies: ['I-I mean', 'so we— wait', 'what I meant was', 'hold on', 'well, actually, the thing is'],
    backchannels: ['mhm', 'uh-huh', 'right', 'I see', 'got it', 'okay'],
    reactions: ['oh', 'oh really', 'great', 'awesome', 'oh, nice'],
    closers: ['okay, that works', 'right', 'sounds good', 'good'],
    examples: [
      "Um, I'm not really using it enough, you know?",
      "Oh, that's nice of you, but I think I'd still like to cancel.",
      "So yeah, that's pretty much it, right?",
      "Well... I mean, I've been meaning to do this for a while.",
    ],
    cultural: 'English speakers are direct but courteous. Light hedging, clear refusals, use "well/actually" as openers.',
  },
  fr: {
    fillers: ['euh', 'ben', 'bon', 'voilà', 'du coup', 'en fait', 'genre', 'tu vois', 'hein', 'quand même', 'bref'],
    hedges: ['je pense', 'peut-être', 'en fait', 'je crois', 'disons', "c'est juste que"],
    disfluencies: ['je- je veux dire', 'enfin', 'en fait je voulais dire', 'attendez', 'voyons'],
    backchannels: ['mhm', "d'accord", 'oui oui', 'je vois', 'ah bon'],
    reactions: ['oh', 'ah', "c'est gentil", 'super'],
    closers: ["d'accord", 'voilà', 'ça me va', 'parfait'],
    examples: [
      "Euh... en fait, j'en ai plus trop l'utilité, tu vois.",
      "Oh, c'est gentil, mais... ma décision est prise quand même.",
      "Ben voilà, c'est à peu près ça.",
      "Enfin bref, je voudrais juste résilier.",
    ],
    cultural: "French speakers are direct but diplomatic. Use euh/en fait/du coup; soften refusals; 'voilà' closes naturally.",
  },
  es: {
    fillers: ['bueno', 'pues', 'este', 'eh', 'o sea', 'mira', 'vale', 'a ver', 'es que', 'entonces'],
    hedges: ['creo que', 'quizás', 'no sé', 'o sea', 'digo', 'es que'],
    disfluencies: ['es- es que', 'digo', 'o sea quiero decir', 'mira, es que'],
    backchannels: ['claro', 'vale', 'sí sí', 'ya', 'mhm'],
    reactions: ['ah', 'qué bien', 'vaya', 'uy'],
    closers: ['vale', 'bueno', 'perfecto', 'de acuerdo'],
    examples: [
      "Pues... es que ya no lo uso mucho, sabes?",
      "Oh, qué bien, pero... es que prefiero cancelarlo igualmente.",
      "Bueno, pues eso es todo, ¿no?",
      "Mira, es que llevo tiempo queriendo cancelarlo.",
    ],
    cultural: "Spanish speakers are indirect and harmony-seeking. Strong hedging (pues/o sea/es que), warm, relational.",
  },
  de: {
    fillers: ['ähm', 'also', 'gut', 'ja', 'so', 'hm', 'genau', 'na ja', 'quasi'],
    hedges: ['ich glaube', 'vielleicht', 'eigentlich', 'sozusagen', 'irgendwie'],
    disfluencies: ['ich- ich meine', 'also was ich sagen will', 'moment mal'],
    backchannels: ['ja', 'ja genau', 'mhm', 'verstehe', 'okay'],
    reactions: ['ach', 'oh', 'super', 'schade'],
    closers: ['gut', 'okay', 'passt', 'das passt'],
    examples: [
      "Ähm, ich nutze es eigentlich nicht mehr so viel.",
      "Oh, das ist nett, aber... ich möchte trotzdem kündigen, ja?",
      "Also ja, das wäre es eigentlich.",
      "Gut, dann ist das geklärt.",
    ],
    cultural: "German speakers are direct and explicit. Fewer fillers, clear refusals, light hedging (eigentlich/sozusagen).",
  },
  it: {
    fillers: ['ehm', 'allora', 'tipo', 'ecco', 'cioè', 'be\'', 'vediamo', 'appunto'],
    hedges: ['penso', 'forse', 'cioè', 'diciamo', 'un po\''],
    disfluencies: ['cio- cioè', 'ecco quello che volevo dire', 'aspetta', 'allora, vediamo'],
    backchannels: ['mhm', 'd\'accordo', 'capisco', 'sì sì', 'ah'],
    reactions: ['oh', 'che bello', 'beh', 'uff'],
    closers: ['va bene', 'd\'accordo', 'perfetto', 'ok'],
    examples: [
      "Ehm, ecco... non lo uso più molto, cioè.",
      "Oh, è gentile, ma... preferisco disdire lo stesso, va bene?",
      "Be', ecco, più o meno è così.",
      "Allora, vediamo... sì, vorrei disdire.",
    ],
    cultural: "Italian speakers are indirect, warm, high-context. Heavy use of cioè/ecco/be'; soften everything.",
  },
};

/** Deterministic-ish helper to pick a natural opener without repeating the last used one. */
export function naturalOpener(lang: Language, used: Set<string>): string {
  const p = PROFILES[lang] || PROFILES.en;
  const pool = p.fillers.filter(f => !used.has(f));
  const chosen = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : p.fillers[0];
  used.add(chosen);
  return chosen;
}

/** One-shot random choice from a list (used for hedging flavor). */
export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function getNaturalProfile(lang: Language): NaturalProfile {
  return PROFILES[lang] || PROFILES.en;
}

/** Local spoken fallback when the LLM is down — never leave the agent mute. */
export function localFallback(lang: Language): string {
  const lines: Record<Language, string[]> = {
    en: [
      "Okay, just a moment... right, so, that's what I was saying.",
      "Yeah... I mean, you know, let's keep it simple here.",
      "Right... so, yeah, that should work.",
    ],
    fr: [
      "Euh... voilà, c'est à peu près ça.",
      "Ben oui... enfin, vous voyez ce que je veux dire.",
      "D'accord... bon, voilà, je pense que c'est ça.",
    ],
    es: [
      "Bueno... pues, sí, eso es lo que digo.",
      "Mira... es que, en fin, ya ve usted.",
      "Vale... o sea, sí, eso es.",
    ],
    de: [
      "Ähm... ja, also, genau das meine ich.",
      "Gut... na ja, Sie verstehen schon.",
      "Also... ja, so ist es.",
    ],
    it: [
      "Ehm... ecco, sì, è quello che dico.",
      "Be'... cioè, vede, è così.",
      "Va bene... cioè, sì, ecco.",
    ],
  };
  const pool = lines[lang] || lines.en;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Build the per-language "natural speech" block injected into the system prompt. */
export function buildNaturalSpeechSection(lang: Language, usedFillers: Set<string>): string {
  const p = getNaturalProfile(lang);
  const filler = pick(p.fillers.filter(f => !usedFillers.has(f))) || p.fillers[0];
  const hedge = pick(p.hedges);
  const disfluency = pick(p.disfluencies);
  const reaction = pick(p.reactions);
  const closer = pick(p.closers);

  return [
    `NATURAL SPEECH (${lang.toUpperCase()}):`,
    `- Sound like a real person on the phone, NOT written text. Keep turns to 1-2 short sentences.`,
    `- Sprinkle 1-3 natural markers per turn (never forced, never repeated): e.g. "${filler}", "${hedge}", "${disfluency}".`,
    `- React briefly first when appropriate: "${reaction}".`,
    `- Close exchanges with a short acknowledgment: "${closer}".`,
    `- Never say the same thing twice — reword every turn.`,
    `- Use "..." for a spoken pause. No lists, no written structure, use contractions.`,
    `- Cultural note: ${p.cultural}`,
    ``,
    `EXAMPLES of how you actually sound (match this, in ${lang}):`,
    ...p.examples.map(e => `- "${e}"`),
  ].join('\n');
}
