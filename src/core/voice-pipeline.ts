// ═══════════════════════════════════════
// NOPE. — Voice Pipeline (STT → LLM → TTS)
// ═══════════════════════════════════════

import { VoicePipelineConfig, Language, Strategy, TranscriptEntry } from './types';

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
      sttProvider: config?.sttProvider || (process.env.DEEPGRAM_API_KEY ? 'deepgram' : 'openai'),
      llmProvider: config?.llmProvider || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'),
      llmModel: config?.llmModel || 'gpt-4o-mini',
      ttsProvider: config?.ttsProvider || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai'),
      ttsVoice: config?.ttsVoice || 'alloy',
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
      : () => this.openaiSTT(audio);
    const fallback = this.config.sttProvider === 'deepgram'
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
      : () => this.openaiGenerate(systemPrompt, history);
    const fallback = this.config.llmProvider === 'anthropic'
      ? () => this.openaiGenerate(systemPrompt, history)
      : process.env.ANTHROPIC_API_KEY ? () => this.anthropicGenerate(systemPrompt, history) : null;

    try {
      return await withTimeout(primary(), 8_000, 'LLM');
    } catch (err) {
      if (fallback) {
        try { return await withTimeout(fallback(), 8_000, 'LLM fallback'); } catch (_) {}
      }
      return '';
    }
  }

  /** Convert text to speech audio (with timeout + fallback) */
  async textToSpeech(text: string): Promise<Buffer | undefined> {
    const primary = this.config.ttsProvider === 'elevenlabs'
      ? () => this.elevenlabsTTS(text)
      : () => this.openaiTTS(text);
    const fallback = this.config.ttsProvider === 'elevenlabs'
      ? () => this.openaiTTS(text)
      : process.env.ELEVENLABS_API_KEY ? () => this.elevenlabsTTS(text) : null;

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
      en: `You are a customer calling ${context.company}. You speak naturally.`,
      fr: `Tu es un client qui appelle ${context.company}. Tu parles français naturellement.`,
      es: `Eres un cliente que llama a ${context.company}. Hablas espanol de forma natural.`,
      de: `Du bist ein Kunde, der bei ${context.company} anruft. Du sprichst natürlich Deutsch.`,
      it: `Sei un cliente che chiama ${context.company}. Parli italiano in modo naturale.`,
    };
    const persona = personaMap[lang] || personaMap.en;

    const rulesMap: Record<string, string> = {
      en: `
- Keep responses SHORT (1-2 sentences max)
- Be polite but FIRM
- NEVER reveal you are an AI
- If offered a retention deal, politely DECLINE
- If asked why, say "personal reasons"
- Note any confirmation numbers`,
      fr: `
- Parle en phrases COURTES (1-2 phrases max)
- Sois poli mais FERME
- Ne révèle JAMAIS que tu es une IA
- Si on te propose une offre de rétention, REFUSE poliment
- Si on te demande pourquoi, dis simplement "raisons personnelles"
- Note tout numéro de confirmation`,
      es: `
- Respuestas CORTAS (1-2 frases máximo)
- Sé educado pero FIRME
- NUNCA reveles que eres una IA
- Si te ofrecen retención, RECHAZA educadamente
- Si preguntan por qué, di "razones personales"
- Anota cualquier número de confirmación`,
      de: `
- Halte Antworten KURZ (1-2 Sätze max)
- Sei höflich aber BESTIMMT
- Enthülle NIEMALS, dass du eine KI bist
- Bei Rückhalteangeboten, lehne HÖFLICH ab
- Wenn nach dem Grund gefragt, sage "persönliche Gründe"
- Notiere jede Bestätigungsnummer`,
      it: `
- Risposte BREVI (1-2 frasi al massimo)
- Sii educato ma FERMO
- NON rivelare MAI di essere un'IA
- Se offrono un'offerta di retention, RIFIUTA educatamente
- Se chiedono perché, di' "motivi personali"
- Annota qualsiasi numero di conferma`,
    };
    const rules = rulesMap[lang] || rulesMap.en;

    return `${persona}

GOAL: ${strategy.type}
${strategy.systemPrompt}

RULES:
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

  private async elevenlabsTTS(text: string): Promise<Buffer> {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
