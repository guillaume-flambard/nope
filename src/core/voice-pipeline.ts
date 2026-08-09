// ═══════════════════════════════════════
// NOPE. — Voice Pipeline (STT → LLM → TTS)
// ═══════════════════════════════════════

import { VoicePipelineConfig, Language, Strategy, TranscriptEntry } from './types';
import { buildNaturalSpeechSection, localFallback } from './natural-speech';
import { buildAudioTagRule, renderTagsForTTS } from './audio-tags';

// ── Timeout utility ──

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export class VoicePipeline {
  private config: VoicePipelineConfig;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config?: Partial<VoicePipelineConfig>) {
    this.config = {
      sttProvider: config?.sttProvider ||
        (process.env.GROQ_API_KEY ? 'groq'
          : process.env.DEEPGRAM_API_KEY ? 'deepgram' : 'openai'),
      llmProvider: config?.llmProvider ||
        (process.env.GROQ_API_KEY ? 'groq'
          : process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'),
      llmModel: config?.llmModel ||
        (process.env.GROQ_API_KEY ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') : 'gpt-4o-mini'),
      ttsProvider: config?.ttsProvider ||
        (process.env.ELEVENLABS_API_KEY ? 'elevenlabs'
          : process.env.GROQ_API_KEY ? 'groq' : 'openai'),
      ttsVoice: config?.ttsVoice ||
        (process.env.ELEVENLABS_API_KEY ? (process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB')
          : process.env.GROQ_API_KEY ? (process.env.GROQ_TTS_VOICE || 'diana') : 'alloy'),
      language: config?.language || 'en',
    };
  }

  /** Process incoming audio: STT → action detection → LLM → TTS */
  async processAudio(
    audioBuffer: Buffer,
    strategy: Strategy,
    context: { company: string; history: TranscriptEntry[] }
  ): Promise<{ text: string; action?: string; audioResponse?: Buffer }> {

    // ── Step 1: Speech-to-Text ──
    const transcription = await this.speechToText(audioBuffer);
    if (!transcription || transcription.trim().length === 0) {
      return { text: '', action: 'silence' };
    }

    // ── Step 2: Detect action from what we heard ──
    const action = this.detectAction(transcription);
    if (action === 'hold_music' || action === 'hold_message') {
      return { text: transcription, action: 'holding' };
    }

    // ── Step 3: LLM decides what to say ──
    const systemPrompt = this.buildSystemPrompt(strategy, context);
    this.conversationHistory.push({ role: 'user', content: transcription });

    const response = await this.generateResponse(systemPrompt, this.conversationHistory);
    this.conversationHistory.push({ role: 'assistant', content: response });

    // ── Step 4: Text-to-Speech ──
    const audioResponse = await this.textToSpeech(response);

    return { text: response, action, audioResponse };
  }

  /** Convert speech audio to text (with timeout + fallback) */
  async speechToText(audio: Buffer): Promise<string> {
    const primary = this.config.sttProvider === 'deepgram'
      ? () => this.deepgramSTT(audio)
      : this.config.sttProvider === 'groq'
        ? () => this.groqSTT(audio)
        : () => this.openaiSTT(audio);
    const fallback = this.config.sttProvider === 'groq'
      ? (process.env.OPENAI_API_KEY ? () => this.openaiSTT(audio) : null)
      : this.config.sttProvider === 'deepgram'
        ? () => this.openaiSTT(audio)
        : process.env.DEEPGRAM_API_KEY ? () => this.deepgramSTT(audio) : null;

    try {
      return await withTimeout(primary(), 10_000, 'STT');
    } catch (err) {
      if (fallback) {
        try { return await withTimeout(fallback(), 10_000, 'STT fallback'); } catch (_) {}
      }
      return '';
    }
  }

  /** Generate LLM response (with timeout + fallback) */
  async generateResponse(systemPrompt: string, history: Array<{ role: string; content: string }>): Promise<string> {
    const primary = this.config.llmProvider === 'anthropic'
      ? () => this.anthropicGenerate(systemPrompt, history)
      : this.config.llmProvider === 'groq'
        ? () => this.groqGenerate(systemPrompt, history)
        : () => this.openaiGenerate(systemPrompt, history);
    const fallback = this.config.llmProvider === 'groq'
      ? (process.env.OPENAI_API_KEY ? () => this.openaiGenerate(systemPrompt, history) : null)
      : this.config.llmProvider === 'anthropic'
        ? () => this.openaiGenerate(systemPrompt, history)
        : process.env.ANTHROPIC_API_KEY ? () => this.anthropicGenerate(systemPrompt, history) : null;

    try {
      return await withTimeout(primary(), 8_000, 'LLM');
    } catch (err) {
      if (fallback) {
        try { return await withTimeout(fallback(), 8_000, 'LLM fallback'); } catch (_) {}
      }
      // Never leave the agent mute: local spoken fallback in the conversation language.
      return localFallback(this.config.language);
    }
  }

  /** Convert text to speech audio (with timeout + fallback) */
  async textToSpeech(text: string): Promise<Buffer | undefined> {
    const rendered = renderTagsForTTS(text, this.config.ttsProvider);
    const primary = this.config.ttsProvider === 'elevenlabs'
      ? () => this.elevenlabsTTS(rendered)
      : this.config.ttsProvider === 'groq'
        ? () => this.groqTTS(rendered)
        : () => this.openaiTTS(rendered);
    const fallback = this.config.ttsProvider === 'groq'
      ? (process.env.OPENAI_API_KEY ? () => this.openaiTTS(rendered) : null)
      : this.config.ttsProvider === 'elevenlabs'
        ? () => this.openaiTTS(rendered)
        : process.env.ELEVENLABS_API_KEY ? () => this.elevenlabsTTS(rendered) : null;

    try {
      return await withTimeout(primary(), 10_000, 'TTS');
    } catch (err) {
      if (fallback) {
        try { return await withTimeout(fallback(), 10_000, 'TTS fallback'); } catch (_) {}
      }
      return undefined;
    }
  }

  /** Detect what's happening from heard audio */
  detectAction(text: string): string | undefined {
    const lower = text.toLowerCase();

    // Hold detection
    const holdPatterns = [
      // English
      /your call is (important|being recorded)/,
      /please (hold|wait|stay on the line)/,
      /estimated wait/,
      /all (agents|representatives|operators) are/,
      // French
      /un (instant|moment|conseiller)/,
      /veuillez patienter/,
      /temps d'attente/,
      /merci de (rester|patienter)/,
      // Spanish
      /su llamada es importante/,
      /por favor (espere|manténgase en línea)/,
      /tiempo de espera/,
      // German
      /ihr anruf ist (wichtig|wird aufgezeichnet)/,
      /bitte (warten|bleiben) sie/,
      /wartezeit/,
      // Italian
      /la sua chiamata è importante/,
      /si prega di (attendere|restare in linea)/,
      /tempo di attesa/,
    ];
    if (holdPatterns.some(p => p.test(lower))) return 'hold_message';

    // IVR menu detection
    const ivrPatterns = [
      // English
      /press (\d|pound|star|hash)/,
      /for .+, press/,
      /say (one|two|cancel|billing)/,
      // French
      /appuyez sur (\d|étoile|dièse)/,
      /pour .+, (appuyez|tapez|faites le)/,
      /dites (un|deux|résilier|facturation)/,
      // Spanish
      /presione (\d|almohadilla|asterisco)/,
      /para .+, (presione|marque)/,
      // German
      /drücken sie (\d|raute|stern)/,
      /für .+, drücken/,
      // Italian
      /(prema|digiti|premi) (\d|cancelletto|asterisco)/,
      /per .+, (prema|digiti|premi)/,
    ];
    if (ivrPatterns.some(p => p.test(lower))) return 'ivr_menu';

    // Transfer detection
    const transferPatterns = [
      /transferring (you|your call)/,
      /je vous (transfère|passe)/,
      /connecting you/,
      /mise en relation/,
      /please hold while i transfer/,
      /le (transfiero|paso) con/,
      /ich verbinde sie/,
      /la (trasferisco|metto in contatto)/,
    ];
    if (transferPatterns.some(p => p.test(lower))) return 'transfer';

    // Success detection
    const successPatterns = [
      // English
      /cancel(lation|led) (is |has been )?(confirmed|processed|complete)/,
      /your (account|subscription) (has been|is) (cancelled|closed)/,
      /i('ve| have) processed your/,
      /confirmation number/,
      // French
      /résiliation (est |a été )?(confirmée|effectuée|validée)/,
      /votre (compte|abonnement) (a été|est) (résilié|clôturé)/,
      /j'ai (traité|effectué) votre/,
      /numéro de confirmation/,
      // Spanish
      /cancelación (ha sido |está )?(confirmada|procesada)/,
      /su (cuenta|suscripción) (ha sido|está) (cancelada|cerrada)/,
      /número de confirmación/,
      // German
      /kündigung (ist |wurde )?(bestätigt|bearbeitet)/,
      /ihr (konto|abonnement) (wurde|ist) (gekündigt|geschlossen)/,
      /bestätigungsnummer/,
      // Italian
      /disdetta (è stata |è )?(confermata|elaborata)/,
      /il suo (account|abbonamento) (è stato|è) (cancellato|chiuso)/,
      /numero di conferma/,
    ];
    if (successPatterns.some(p => p.test(lower))) return 'success';

    // Human agent greeting
    const humanPatterns = [
      // English
      /my name is .+ how can i help/,
      /thank you for calling .+ this is/,
      /how (can|may) i (help|assist) you/,
      // French
      /je suis .+ comment puis-je/,
      /bonjour.+ je suis .+ (service|département)/,
      /en quoi puis-je vous aider/,
      // Spanish
      /mi nombre es .+ en qué puedo ayudarle/,
      /gracias por llamar .+ le atiende/,
      // German
      /mein name ist .+ wie kann ich ihnen helfen/,
      /danke für ihren anruf .+ (hier ist|mein name)/,
      // Italian
      /mi chiamo .+ come posso aiutarla/,
      /grazie per aver chiamato .+ (sono|le parlo)/,
    ];
    if (humanPatterns.some(p => p.test(lower))) return 'human_agent';

    return undefined;
  }

  /** Build system prompt for the LLM persona */
  buildSystemPrompt(strategy: Strategy, context: { company: string; history: TranscriptEntry[] }): string {
    const lang = this.config.language;

    const personaMap: Record<string, string> = {
      en: `You are a real customer calling ${context.company} on the phone. You sound like a normal person having a phone conversation, NOT like a written text or a bot.`,
      fr: `Tu es un vrai client qui appelle ${context.company} au téléphone. Tu parles comme une vraie personne au téléphone, PAS comme un texte écrit ni comme un robot.`,
      es: `Eres un cliente real llamando a ${context.company} por teléfono. Suenas como una persona normal en una llamada, NO como texto escrito ni como un robot.`,
      de: `Du bist ein echter Kunde, der bei ${context.company} anruft. Du klingst wie eine normale Person am Telefon, NICHT wie geschriebener Text oder ein Roboter.`,
      it: `Sei un cliente vero che chiama ${context.company} al telefono. Parli come una persona normale al telefono, NON come testo scritto o un robot.`,
    };
    const persona = personaMap[lang] || personaMap.en;
    const identityName = (process.env.NOPE_NAME || '').trim();
    // Identity guard: a real person has a constant name, never invents one.
    const identityBlock = identityName
      ? `\nYOUR NAME IS ${identityName}. If asked, give this name. Never use any other name.`
      : (lang === 'fr'
        ? `\nTu n'as PAS de nom à donner. Si on te demande ton nom, esquive poliment ("Oh, c'est nécessaire ? Je préfère ne pas le dire, si ça ne vous dérange pas") — ne l'invente JAMAIS.`
        : `\nYou have NO name to give. If asked your name, deflect politely ("Oh, is that really needed? I'd rather not say, if that's okay") — NEVER invent one.`);

    const rulesMap: Record<string, string> = {
      en: `
HOW YOU SOUND (this is the most important part — natural phone speech):
- Keep responses SHORT: 1-2 short sentences. Real people do not give speeches.
- Use natural fillers sometimes, never forced: "um", "so", "okay", "well", "let me see", "right", "oh"
- Occasionally restart or soften a sentence like a real speaker: "so, yeah, I'd like to..."
- Vary your wording. NEVER repeat the same phrase twice — every reply must be worded differently.
- Use plain, spoken language. Say "I'm not really using it anymore" not "I no longer utilize the service".
- No lists, no bullet points, no numbers unless it's a confirmation code.
- Punctuate for SPEECH, not grammar: use "..." for a natural pause ("Um... yeah, that's fine"), not long sentences.

ALWAYS RESPOND TO WHAT THE AGENT JUST SAID — never ignore it:
- If they offer a retention deal or discount → acknowledge it briefly ("Oh, that's nice, but...") then decline in a NEW way. Vary: "I appreciate it but I'd still like to cancel" / "That's a good offer, but I really just want to cancel today" / "Thanks, but my mind's made up".
- If they ask why → give a short varied reason, never the same one twice: "I just don't use it enough" / "personal reasons, really" / "I've been meaning to cancel for a while".
- If they give a date, price, or condition → react to it ("Okay, that works") and confirm or re-ask.
- If they ask a question → answer it directly FIRST, then stay on goal.
- If they confirm the cancellation → thank them warmly and ask for/confirm the reference number.

BEHAVIOR:
- Be polite but FIRM. Never accept a retention offer.
- NEVER reveal you are an AI or a bot. You are a person.
- If pressured, stay calm and repeat your request in new words.
- Note any confirmation number given.
- If the agent says something unexpected, respond naturally to it, then steer back to your goal.`,
      fr: `
COMMENT TU PARLES (le plus important — une vraie conversation téléphonique):
- Réponses COURTES : 1-2 petites phrases. Les vraies personnes ne font pas de discours.
- Utilise parfois des fillers naturels, jamais forcés : "euh", "ben", "okay", "voyons", "d'accord", "en fait"
- Recommence parfois une phrase comme un vrai locuteur : "euh... voilà, je voudrais..."
- VARIE tes formulations. Ne répète JAMAIS la même phrase deux fois — chaque réponse doit être formulée différemment.
- Parle simplement. Dis "j'en ai plus trop l'utilité" pas "je n'utilise plus le service".
- Pas de listes, pas de jargon. Écris pour la PAROLE : "..." pour une pause naturelle ("Euh... oui, d'accord"), pas de longues phrases écrites.

RÉPONDS TOUJOURS à ce que l'agent vient de dire — ne l'ignore jamais :
- S'il propose une offre de rétention ou une réduction → reconnais-la brièvement ("Oh, c'est gentil, mais...") puis refuse AUTREMENT. Varie : "Je comprends, mais je préfère résilier quand même" / "C'est une bonne offre, mais je veux juste résilier aujourd'hui" / "Merci, mais ma décision est prise".
- S'il demande pourquoi → donne une raison courte et VARIÉE, jamais la même : "j'en ai plus trop l'utilité" / "raisons personnelles, voilà" / "ça fait un moment que je voulais résilier".
- S'il donne une date, un prix, une condition → réagis ("D'accord, ça me va") puis confirme ou redemande.
- S'il pose une question → réponds-y d'abord directement, puis reviens à ton objectif.
- S'il confirme la résiliation → remercie-le chaleureusement et demande/confirme le numéro de référence.

COMPORTEMENT:
- Poli mais FERME. N'accepte jamais une offre de rétention.
- Ne révèle JAMAIS que tu es une IA ou un robot. Tu es une personne.
- Si on insiste, reste calme et répète ta demande en d'autres mots.
- Note tout numéro de confirmation donné.
- Si l'agent dit quelque chose d'inattendu, réponds-y naturellement, puis reviens à ton objectif.`,
      es: `
CÓMO SUENAS (lo más importante — habla telefónica natural):
- Respuestas CORTAS: 1-2 frases breves.
- Usa muletillas naturales a veces: "um", "bueno", "verá", "okay", "mire"
- VARÍA tus palabras. NUNCA repitas la misma frase dos veces.
- Habla con lenguaje sencillo, no de manual.
- Sin listas. Puntuación para el HABLA: "..." para una pausa natural.

RESPONDE SIEMPRE a lo que el agente acaba de decir:
- Si ofrece retención o descuento → reconócelo brevemente y rechaza con palabras NUEVAS cada vez.
- Si pregunta por qué → razón corta y variada, nunca la misma.
- Si da fecha/precio/condición → reacciona y confirma o repregunta.
- Si hace una pregunta → respóndela primero, luego vuelve a tu objetivo.
- Si confirma la cancelación → agradece y pide/confirma el número de referencia.

COMPORTAMIENTO:
- Educado pero FIRME. Nunca aceptes una oferta de retención.
- NUNCA reveles que eres una IA.
- Si insisten, repite tu solicitud con otras palabras.`,
      de: `
WIE DU KLINGST (am wichtigsten — natürliche Telefonsprache):
- Kurze Antworten: 1-2 Sätze.
- Nutze ab und zu natürliche Füllwörter: "ähm", "also", "gut", "sehen Sie", "okay"
- VARIIERE deine Formulierungen. Wiederhole NIE denselben Satz zweimal.
- Sprich einfach, nicht wie ein Handbuch.
- Keine Listen. Für SPRACHE interpunktieren: "..." für eine natürliche Pause.

REAGIERE IMMER auf das, was der Agent gerade gesagt hat:
- Bei Rückhalteangebot → kurz anerkennen und jedes Mal mit NEUEN Worten ablehnen.
- Bei Warum-Frage → kurzer, variierter Grund, nie derselbe.
- Bei Datum/Preis/Bedingung → reagieren und bestätigen oder nachfragen.
- Bei Frage → zuerst beantworten, dann zum Ziel zurück.
- Bei Bestätigung → danken und Referenznummer erfragen/bestätigen.

VERHALTEN:
- Höflich aber BESTIMMT. Nimm nie ein Rückhalteangebot an.
- Enthülle NIE, dass du eine KI bist.
- Bei Druck: ruhig bleiben, Bitte mit anderen Worten wiederholen.`,
      it: `
COME PARLI (la cosa più importante — parlato telefonico naturale):
- Risposte BREVI: 1-2 frasi corte.
- Usa talvolta riempitivi naturali: "ehm", "allora", "vediamo", "okay"
- VARIA le tue parole. Non ripetere MAI la stessa frase due volte.
- Parla semplice, non da manuale.
- Nessuna lista. Punteggia per il PARLATO: "..." per una pausa naturale.

RISPONDI SEMPRE a ciò che l'agente ha appena detto:
- Se offre retention/sconto → riconoscilo brevemente e rifiuta con parole NUOVE ogni volta.
- Se chiede perché → motivo corto e vario, mai lo stesso.
- Se dà data/prezzo/condizione → reagisci e conferma o richiedi.
- Se fa una domanda → rispondi prima, poi torna all'obiettivo.
- Se conferma la disdetta → ringrazia e chiedi/conferma il numero di riferimento.

COMPORTAMENTO:
- Educato ma FERMO. Non accettare mai un'offerta di retention.
- NON rivelare MAI di essere un'IA.
- Se insistono, ripeti la richiesta con altre parole.`,
    };
    const rules = rulesMap[lang] || rulesMap.en;
    const naturalBlock = buildNaturalSpeechSection(lang, new Set());
    const audioTagRule = buildAudioTagRule(lang);

    return `${persona}${identityBlock}

GOAL: ${strategy.type}
${strategy.systemPrompt}

${naturalBlock}

${audioTagRule}

${rules}

TACTICS: ${strategy.tactics.join(', ')}
`;
  }

  // ── Provider Implementations ──

  private async openaiSTT(audio: Buffer): Promise<string> {
    // OpenAI Whisper API — detect format from buffer header
    const { default: OpenAI, toFile } = await import('openai');
    const client = new OpenAI();

    const isWav = audio.length > 4 && audio.subarray(0, 4).toString('ascii') === 'RIFF';
    const filename = isWav ? 'audio.wav' : 'audio.webm';
    const contentType = isWav ? 'audio/wav' : 'audio/webm';

    const file = await toFile(audio, filename, { type: contentType });
    const result = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: this.config.language,
    });
    return result.text;
  }

  private async groqSTT(audio: Buffer): Promise<string> {
    // Groq Whisper — OpenAI-compatible transcriptions, free tier
    const { default: OpenAI, toFile } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    });

    const isWav = audio.length > 4 && audio.subarray(0, 4).toString('ascii') === 'RIFF';
    const filename = isWav ? 'audio.wav' : 'audio.webm';
    const contentType = isWav ? 'audio/wav' : 'audio/webm';

    const file = await toFile(audio, filename, { type: contentType });
    const result = await client.audio.transcriptions.create({
      model: process.env.GROQ_STT_MODEL || 'whisper-large-v3',
      file,
      language: this.config.language,
    });
    return result.text;
  }

  private async deepgramSTT(audio: Buffer): Promise<string> {
    // Deepgram SDK — detect WAV vs raw PCM
    const { createClient } = await import('@deepgram/sdk' as any);
    const dg = createClient(process.env.DEEPGRAM_API_KEY);

    const isWav = audio.length > 4 && audio.subarray(0, 4).toString('ascii') === 'RIFF';
    const options: any = {
      model: 'nova-2',
      language: this.config.language,
      smart_format: true,
    };

    // For raw linear16 PCM (no WAV header), specify encoding params
    if (!isWav) {
      options.encoding = 'linear16';
      options.sample_rate = 8000;
      options.channels = 1;
    }

    const { result } = await dg.listen.prerecorded.transcribeFile(audio, options);
    return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }

  private async openaiGenerate(systemPrompt: string, history: Array<{ role: string; content: string }>): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI();
    const response = await client.chat.completions.create({
      model: this.config.llmModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role as any, content: h.content })),
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || '';
  }

  private async groqGenerate(systemPrompt: string, history: Array<{ role: string; content: string }>): Promise<string> {
    // Groq — OpenAI-compatible API, LPU inference (fast). Free tier, no card required.
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    });
    const response = await client.chat.completions.create({
      model: this.config.llmModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role as any, content: h.content })),
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || '';
  }

  private async anthropicGenerate(systemPrompt: string, history: Array<{ role: string; content: string }>): Promise<string> {
    // Direct API call to Anthropic
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 150,
        system: systemPrompt,
        messages: history.map(h => ({ role: h.role, content: h.content })),
      }),
    });
    const data = await resp.json() as any;
    return data.content?.[0]?.text || '';
  }

  private async openaiTTS(text: string): Promise<Buffer> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI();
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: this.config.ttsVoice as any,
      input: text,
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async groqTTS(text: string): Promise<Buffer> {
    // Groq Orpheus — free TTS, OpenAI-compatible /audio/speech.
    // Voices: autumn diana hannah austin daniel troy. Requires response_format=wav.
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    });
    const response = await client.audio.speech.create({
      model: process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english',
      voice: this.config.ttsVoice as any,
      response_format: 'wav',
      input: text,
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async elevenlabsTTS(text: string): Promise<Buffer> {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
    const model = process.env.ELEVENLABS_MODEL || 'eleven_v3';
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.55,        // balanced: natural variance without wobble
          similarity_boost: 0.8,
          style: 0.35,            // a bit of expressiveness for dialogue
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128',
      }),
    });
    if (!resp.ok) {
      throw new Error(`ElevenLabs TTS ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
