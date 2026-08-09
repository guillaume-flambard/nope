// ═══════════════════════════════════════
// NOPE. — Main Agent Orchestrator
// ═══════════════════════════════════════

import {
  CallTask, CallResult, CallStatus, NopeEvent,
  NopeEventHandler, StrategyType, Language,
  TranscriptEntry, CallCost
} from './types';
import { CompanyFinder } from '../lookup/company-finder';
import { StrategyEngine } from './strategy-engine';
import { IVRNavigator } from './ivr-navigator';
import { VoicePipeline } from './voice-pipeline';
import { Caller } from './caller';
import { TwilioStreamHandler, registerStream, removeStream } from './twilio-stream';
import { CallRecorder } from './recorder';
import { NopePlugin } from './plugin';
import { randomUUID } from 'crypto';

export class NopeAgent {
  private handlers: NopeEventHandler[] = [];
  private companyFinder: CompanyFinder;
  private strategyEngine: StrategyEngine;
  private ivrNavigator: IVRNavigator;
  private recorder: CallRecorder;

  constructor() {
    this.companyFinder = new CompanyFinder();
    this.strategyEngine = new StrategyEngine();
    this.ivrNavigator = new IVRNavigator();
    this.recorder = new CallRecorder();
  }

  /** Register a plugin (adds custom strategies and companies) */
  registerPlugin(plugin: NopePlugin): void {
    // Register custom strategies
    if (plugin.strategies) {
      for (const [type, factory] of Object.entries(plugin.strategies)) {
        this.strategyEngine.registerStrategy(type, factory);
      }
    }

    // Register custom companies
    if (plugin.companies) {
      this.companyFinder.registerCompanies(plugin.companies);
    }
  }

  /** Register an event handler */
  on(handler: NopeEventHandler): void {
    this.handlers.push(handler);
  }

  /** Emit an event to all handlers */
  private emit(event: NopeEvent): void {
    for (const handler of this.handlers) {
      try { handler(event); } catch (_) {}
    }
  }

  /** Main entry point — execute a goal */
  async execute(goal: string, options?: { simulate?: boolean }): Promise<CallResult> {
    const task = this.parseGoal(goal);
    const simulate = options?.simulate ?? (process.env.SIMULATE === 'true');
    const transcript: TranscriptEntry[] = [];
    const startTime = Date.now();

    this.emitStatus(task.id, 'preparing');
    this.emitTranscript(task.id, 'system', `Goal: "${goal}"`);

    // ── Step 1: Find company phone number ──
    if (!task.phoneNumber) {
      this.emitTranscript(task.id, 'system', `Looking up ${task.company || 'company'}...`);
      const company = await this.companyFinder.find(task.company || goal);
      if (company) {
        task.phoneNumber = company.phone;
        task.company = company.name;
        this.emitTranscript(task.id, 'system', `Found: ${company.name} — ${company.phone}`);
        if (company.tips) {
          this.emitTranscript(task.id, 'system', `Tip: ${company.tips}`);
        }
      } else {
        this.emitTranscript(task.id, 'system', `Could not find phone number for "${task.company}"`);
        return this.buildResult(task, 'failed', 'Company not found', transcript, startTime);
      }
    }

    // ── Step 2: Get strategy ──
    const strategy = this.strategyEngine.getStrategy(task.strategy, task.language, task.company);
    this.emitTranscript(task.id, 'system', `Strategy: ${task.strategy} — ${strategy.tactics.length} tactics loaded`);

    // ── Step 3: Make the call ──
    this.emitStatus(task.id, 'dialing');
    this.emitTranscript(task.id, 'system', `Calling ${task.phoneNumber}...`);

    const caller = new Caller();

    let result: CallResult;

    if (simulate) {
      // ── Simulation Mode ──
      result = await this.simulateCall(task, strategy, transcript, startTime, caller);
    } else {
      // ── Live Mode (Twilio) ──
      result = await this.liveCall(task, strategy, transcript, startTime, caller);
    }

    // ── Persist call record ──
    try {
      await this.recorder.save(result, task);
    } catch (_) {
      // Recording is best-effort — don't break the call flow
    }

    return result;
  }

  /** Simulate a complete call */
  private async simulateCall(
    task: CallTask, strategy: any, transcript: TranscriptEntry[],
    startTime: number, caller: Caller
  ): Promise<CallResult> {
    // ── Voice pipeline for natural, LLM-driven replies in simulation ──
    const pipeline = new VoicePipeline({ language: task.language });

    // LLM callback: reply naturally to the agent's turn, using the conversation history.
    const llmReply = async (
      agentTurn: string,
      history: Array<{ role: string; content: string }>
    ): Promise<string> => {
      if (!agentTurn) return '';
      const systemPrompt = pipeline.buildSystemPrompt(strategy as any, {
        company: task.company || 'the service',
        history: [],
      });
      return pipeline.generateResponse(systemPrompt, history);
    };

    const result = await caller.simulate(task, strategy, (event) => {
      transcript.push({
        timestamp: new Date(),
        speaker: event.speaker,
        text: event.text,
        action: event.action,
      });
      this.emitTranscript(task.id, event.speaker, event.text, event.action);
      if (event.statusChange) {
        this.emitStatus(task.id, event.statusChange);
      }
    }, llmReply);

    const duration = (Date.now() - startTime) / 1000;
    const callResult = this.buildResult(
      task,
      result.success ? 'success' : 'failed',
      result.summary,
      transcript,
      startTime,
      result.savings
    );

    this.emitStatus(task.id, result.success ? 'success' : 'failed');
    this.emit({
      type: 'result',
      timestamp: new Date(),
      taskId: task.id,
      data: callResult,
    });

    return callResult;
  }

  /** Live call via Twilio with bidirectional audio streaming */
  private async liveCall(
    task: CallTask, strategy: any, transcript: TranscriptEntry[],
    startTime: number, caller: Caller
  ): Promise<CallResult> {
    const baseUrl = process.env.BASE_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '4000'}`;

    // ── 1. Create voice pipeline ──
    const pipeline = new VoicePipeline({ language: task.language });

    // ── 2. Reset IVR navigator ──
    this.ivrNavigator.reset();

    // ── 3. Look up company info for IVR hints ──
    const companyInfo = task.company ? await this.companyFinder.find(task.company) : undefined;

    // ── 4. Create and register stream handler ──
    const streamHandler = new TwilioStreamHandler({
      task,
      strategy,
      pipeline,
      ivrNavigator: this.ivrNavigator,
      caller,
      companyInfo: companyInfo || undefined,
      baseUrl,
    });

    // Relay stream events to agent handlers
    streamHandler.on((event: NopeEvent) => {
      this.emit(event);
      // Also accumulate transcript entries
      if (event.type === 'transcript' && event.data) {
        transcript.push({
          timestamp: event.timestamp,
          speaker: event.data.speaker,
          text: event.data.text,
          action: event.data.action,
        });
      }
    });

    registerStream(task.id, streamHandler);

    try {
      // ── 5. Initiate the Twilio call ──
      const callSid = await caller.call(task.phoneNumber!, task);
      this.emitTranscript(task.id, 'system', `Call initiated — SID: ${callSid}`);
      this.emitTranscript(task.id, 'system', 'Voice pipeline active. Listening...');

      // ── 6. Wait for call to complete ──
      const streamResult = await streamHandler.waitForCompletion();

      // ── 7. Build final result ──
      this.emitStatus(task.id, streamResult.status === 'success' ? 'success' : 'failed');
      const callResult = this.buildResult(
        task,
        streamResult.status,
        streamResult.summary,
        transcript,
        startTime,
        streamResult.savings,
      );

      this.emit({
        type: 'result',
        timestamp: new Date(),
        taskId: task.id,
        data: callResult,
      });

      return callResult;
    } catch (err: any) {
      this.emitTranscript(task.id, 'system', `Call failed: ${err.message}`);
      return this.buildResult(task, 'failed', err.message, transcript, startTime);
    } finally {
      removeStream(task.id);
    }
  }

  /** Parse natural language goal into a CallTask */
  parseGoal(goal: string): CallTask {
    const language = this.detectLanguage(goal);
    const strategy = this.detectStrategy(goal, language);
    const company = this.extractCompany(goal, language);

    return {
      id: randomUUID().slice(0, 8),
      goal,
      company,
      strategy,
      language,
      createdAt: new Date(),
    };
  }

  /** Detect language from text */
  private detectLanguage(text: string): Language {
    const lower = text.toLowerCase();
    const frWords = ['mon', 'ma', 'mes', 'le', 'la', 'les', 'je', 'résilie', 'annule', 'abonnement', 'facture', 'négoci'];
    const esWords = ['mi', 'cancelar', 'suscripción', 'factura', 'negociar', 'quiero'];
    const deWords = ['mein', 'kündigen', 'abonnement', 'rechnung', 'verhandeln'];
    const itWords = ['mio', 'mia', 'disdire', 'abbonamento', 'fattura', 'annullare', 'voglio', 'contratto'];

    const frScore = frWords.filter(w => lower.includes(w)).length;
    const esScore = esWords.filter(w => lower.includes(w)).length;
    const deScore = deWords.filter(w => lower.includes(w)).length;
    const itScore = itWords.filter(w => lower.includes(w)).length;

    if (frScore > esScore && frScore > deScore && frScore > itScore && frScore > 0) return 'fr';
    if (esScore > frScore && esScore > deScore && esScore > itScore && esScore > 0) return 'es';
    if (deScore > frScore && deScore > esScore && deScore > itScore && deScore > 0) return 'de';
    if (itScore > frScore && itScore > esScore && itScore > deScore && itScore > 0) return 'it';
    return 'en';
  }

  /** Detect what strategy to use */
  private detectStrategy(text: string, lang: Language): StrategyType {
    const lower = text.toLowerCase();

    const cancelWords: Record<Language, string[]> = {
      en: ['cancel', 'unsubscribe', 'terminate', 'end', 'stop', 'close'],
      fr: ['résili', 'annul', 'arrêt', 'stop', 'suppr', 'ferme', 'clôtur'],
      es: ['cancelar', 'anular', 'terminar', 'cerrar'],
      de: ['kündigen', 'stornieren', 'beenden', 'abbestellen'],
      it: ['cancellare', 'disdire', 'annullare', 'terminare', 'chiudere'],
    };

    const negotiateWords: Record<Language, string[]> = {
      en: ['negotiate', 'lower', 'reduce', 'discount', 'deal', 'cheaper', 'bill'],
      fr: ['négoci', 'baisser', 'réduire', 'remise', 'facture', 'moins cher', 'tarif'],
      es: ['negociar', 'reducir', 'descuento', 'factura', 'barato'],
      de: ['verhandeln', 'reduzieren', 'rabatt', 'rechnung', 'günstiger'],
      it: ['negoziare', 'ridurre', 'sconto', 'bolletta', 'conveniente'],
    };

    const appointmentWords: Record<Language, string[]> = {
      en: ['appointment', 'schedule', 'book', 'reserve', 'meeting'],
      fr: ['rendez-vous', 'rdv', 'réserv', 'planifi'],
      es: ['cita', 'reservar', 'programar'],
      de: ['termin', 'reservieren', 'buchen'],
      it: ['appuntamento', 'prenotare', 'riservare', 'fissare'],
    };

    const complainWords: Record<Language, string[]> = {
      en: ['complain', 'complaint', 'issue', 'problem', 'refund', 'dispute'],
      fr: ['réclam', 'plainte', 'problème', 'rembours', 'litige', 'contest'],
      es: ['queja', 'reclamo', 'problema', 'reembolso'],
      de: ['beschwerde', 'reklamation', 'problem', 'erstattung'],
      it: ['reclamo', 'lamentela', 'problema', 'rimborso', 'controversia'],
    };

    if (cancelWords[lang].some(w => lower.includes(w))) return 'cancel';
    if (negotiateWords[lang].some(w => lower.includes(w))) return 'negotiate';
    if (appointmentWords[lang].some(w => lower.includes(w))) return 'appointment';
    if (complainWords[lang].some(w => lower.includes(w))) return 'complain';
    return 'inquiry';
  }

  /** Extract company name from goal text */
  private extractCompany(text: string, lang: Language): string | undefined {
    // Known companies (quick match)
    const known = [
      'Netflix', 'Spotify', 'Amazon Prime', 'Disney+', 'Disney Plus',
      'Canal+', 'Canal Plus', 'OCS', 'Apple TV', 'HBO Max', 'Hulu',
      'SFR', 'Orange', 'Free', 'Bouygues', 'Comcast', 'Xfinity', 'AT&T',
      'Verizon', 'T-Mobile', 'Vodafone', 'Deutsche Telekom',
      'EDF', 'Engie', 'TotalEnergies', 'Direct Energie',
      'AXA', 'Allianz', 'MAIF', 'Groupama', 'Matmut',
      'Adobe', 'Microsoft', 'Dropbox', 'Notion', 'Slack',
      'YouTube Premium', 'YouTube', 'Deezer', 'Tidal',
      'Planet Fitness', 'Anytime Fitness', 'Basic Fit',
      'Uber Eats', 'Deliveroo', 'DoorDash', 'Just Eat',
      // UK
      'Sky UK', 'Sky', 'BT', 'Virgin Media', 'EE', 'Three',
      // DE
      '1&1', 'O2', 'Check24',
      // ES
      'Movistar', 'Jazztel', 'Endesa',
      // IT
      'TIM', 'WindTre', 'Fastweb', 'Enel',
    ];

    for (const name of known) {
      if (text.toLowerCase().includes(name.toLowerCase())) {
        return name;
      }
    }

    // Fallback: find capitalized word that's likely a company
    const words = text.split(/\s+/);
    const stopWords = new Set([
      'Cancel', 'My', 'Mon', 'Ma', 'Mes', 'The', 'Le', 'La', 'Les',
      'I', 'Je', 'Want', 'Veux', 'Please', 'Call', 'Appelle', 'Negotiate',
      'With', 'Avec', 'For', 'Pour', 'Subscription', 'Abonnement',
    ]);

    for (const word of words) {
      if (word.length > 2 && /^[A-Z]/.test(word) && !stopWords.has(word)) {
        return word;
      }
    }

    return undefined;
  }

  // ── Helpers ──

  private emitStatus(taskId: string, status: CallStatus): void {
    this.emit({ type: 'status', timestamp: new Date(), taskId, data: { status } });
  }

  private emitTranscript(taskId: string, speaker: string, text: string, action?: string): void {
    this.emit({ type: 'transcript', timestamp: new Date(), taskId, data: { speaker, text, action } });
  }

  private buildResult(
    task: CallTask, status: 'success' | 'partial' | 'failed',
    summary: string, transcript: TranscriptEntry[],
    startTime: number, savings?: number
  ): CallResult {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const cost: CallCost = {
      twilio: duration * 0.015 / 60,  // ~$0.015/min
      llm: 0.02,                       // estimated
      stt: duration * 0.006 / 60,     // ~$0.006/min
      tts: duration * 0.015 / 60,     // ~$0.015/min
      total: 0,
    };
    cost.total = cost.twilio + cost.llm + cost.stt + cost.tts;

    return { taskId: task.id, status, summary, transcript, duration, savings, cost };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
