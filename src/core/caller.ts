// ═══════════════════════════════════════
// NOPE. — Twilio Call Manager + Simulator
// ═══════════════════════════════════════

import { CallTask, CallStatus, Strategy } from './types';

interface SimEvent {
  speaker: 'nope' | 'agent' | 'ivr' | 'system';
  text: string;
  action?: string;
  statusChange?: CallStatus;
}

interface SimResult {
  success: boolean;
  summary: string;
  savings?: number;
}

export class Caller {

  private getTwilioClient() {
    const twilio = require('twilio');
    return twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  private getBaseUrl(): string {
    return process.env.BASE_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '4000'}`;
  }

  /** Make a real call via Twilio */
  async call(phoneNumber: string, task: CallTask): Promise<string> {
    const client = this.getTwilioClient();
    const baseUrl = this.getBaseUrl();

    const call = await client.calls.create({
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: `${baseUrl}/api/twilio/voice?taskId=${task.id}`,
      statusCallback: `${baseUrl}/api/twilio/status?taskId=${task.id}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
    });

    return call.sid;
  }

  /** Send DTMF digits during a live call (causes WS stream restart) */
  async sendDTMF(callSid: string, digits: string, taskId: string, baseUrl: string): Promise<void> {
    const client = this.getTwilioClient();
    const wsUrl = baseUrl.replace(/^http/, 'ws');

    // Play DTMF digits then reconnect the media stream
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play digits="${digits}"/>
  <Pause length="1"/>
  <Connect>
    <Stream url="${wsUrl}/api/twilio/stream?taskId=${taskId}" />
  </Connect>
</Response>`;

    await client.calls(callSid).update({ twiml });
  }

  /** Hang up a live call */
  async hangup(callSid: string): Promise<void> {
    const client = this.getTwilioClient();
    await client.calls(callSid).update({ status: 'completed' });
  }

  /** Simulate a full call (no Twilio needed) */
  async simulate(
    task: CallTask,
    strategy: Strategy,
    onEvent: (event: SimEvent) => void
  ): Promise<SimResult> {
    const isFr = task.language === 'fr';
    const company = task.company || 'the company';

    // ── Phase 1: Dialing ──
    onEvent({ speaker: 'system', text: isFr ? 'Appel en cours...' : 'Dialing...', statusChange: 'dialing' });
    await this.pause(1500);

    onEvent({ speaker: 'system', text: isFr ? 'Connexion établie' : 'Connected', action: 'connected' });
    await this.pause(800);

    // ── Phase 2: IVR Navigation ──
    onEvent({ speaker: 'ivr', text: this.ivrGreeting(company, isFr), statusChange: 'ivr' });
    await this.pause(2000);

    if (isFr) {
      onEvent({ speaker: 'ivr', text: 'Pour le français, appuyez sur 1. For English, press 2.' });
      await this.pause(1000);
      onEvent({ speaker: 'nope', text: '(Appui sur 1)', action: 'pressed_1' });
      await this.pause(1500);
    }

    onEvent({ speaker: 'ivr', text: this.ivrMenu(task.strategy, isFr) });
    await this.pause(1500);

    const menuKey = task.strategy === 'cancel' ? '3' : task.strategy === 'negotiate' ? '2' : '1';
    onEvent({ speaker: 'nope', text: `(${isFr ? 'Appui sur' : 'Pressing'} ${menuKey})`, action: `pressed_${menuKey}` });
    await this.pause(1500);

    // ── Phase 3: On Hold ──
    onEvent({
      speaker: 'ivr',
      text: isFr
        ? 'Votre appel est important. Un conseiller va prendre votre appel...'
        : 'Your call is important to us. Please stay on the line...',
      statusChange: 'holding',
    });
    await this.pause(3000);

    onEvent({ speaker: 'system', text: isFr ? '♪ Musique d\'attente... (2min 15s)' : '♪ Hold music... (2min 15s)', action: 'hold_music' });
    await this.pause(2000);

    // ── Phase 4: Human Agent ──
    const agentName = isFr
      ? ['Marie', 'Thomas', 'Sophie', 'Lucas'][Math.floor(Math.random() * 4)]
      : ['Sarah', 'James', 'Emma', 'David'][Math.floor(Math.random() * 4)];

    onEvent({
      speaker: 'agent',
      text: isFr
        ? `Bonjour, ${agentName} du service client ${company}. Comment puis-je vous aider ?`
        : `Hello, this is ${agentName} from ${company} customer service. How can I help you?`,
      statusChange: 'talking',
    });
    await this.pause(1500);

    // ── Phase 5: Strategy Execution ──
    switch (task.strategy) {
      case 'cancel':
        return await this.simulateCancel(task, agentName, isFr, onEvent);
      case 'negotiate':
        return await this.simulateNegotiate(task, agentName, isFr, onEvent);
      default:
        return await this.simulateGeneral(task, agentName, isFr, onEvent);
    }
  }

  private async simulateCancel(
    task: CallTask, agent: string, fr: boolean,
    emit: (e: SimEvent) => void
  ): Promise<SimResult> {
    const company = task.company || 'the service';

    // Opening
    emit({
      speaker: 'nope',
      text: fr
        ? `Bonjour ${agent}. J'appelle pour résilier mon abonnement ${company}, s'il vous plaît.`
        : `Hi ${agent}. I'm calling to cancel my ${company} subscription, please.`,
      statusChange: 'negotiating',
    });
    await this.pause(2000);

    // Retention attempt 1
    emit({
      speaker: 'agent',
      text: fr
        ? `Je comprends. Puis-je vous demander la raison ? Nous avons peut-être une offre qui pourrait vous intéresser...`
        : `I understand. May I ask why? We might have an offer that could interest you...`,
    });
    await this.pause(2000);

    // Nope stays firm
    emit({
      speaker: 'nope',
      text: fr
        ? `Merci, mais ma décision est prise. C'est pour des raisons personnelles. Je souhaite juste résilier.`
        : `Thank you, but my decision is final. It's for personal reasons. I just want to cancel.`,
    });
    await this.pause(2000);

    // Retention attempt 2
    emit({
      speaker: 'agent',
      text: fr
        ? `Je comprends. Et si je vous proposais 50% de réduction pendant 3 mois ?`
        : `I understand. What if I offered you 50% off for 3 months?`,
    });
    await this.pause(1500);

    // Still firm
    emit({
      speaker: 'nope',
      text: fr
        ? `Non merci, c'est gentil mais je souhaite vraiment résilier mon abonnement aujourd'hui.`
        : `No thank you, that's kind but I really want to cancel my subscription today.`,
    });
    await this.pause(2000);

    // Success
    emit({
      speaker: 'agent',
      text: fr
        ? `D'accord, je procède à la résiliation. Votre abonnement sera effectif jusqu'à la fin de votre période. Votre numéro de confirmation est NP-${this.randomRef()}.`
        : `Alright, I'll process the cancellation. Your subscription will remain active until the end of your billing period. Your confirmation number is NP-${this.randomRef()}.`,
    });
    await this.pause(1500);

    emit({
      speaker: 'nope',
      text: fr
        ? `Parfait, merci beaucoup ${agent}. Bonne journée.`
        : `Perfect, thank you very much ${agent}. Have a great day.`,
    });
    await this.pause(500);

    emit({
      speaker: 'system',
      text: fr ? '📞 Appel terminé' : '📞 Call ended',
      statusChange: 'success',
    });

    return {
      success: true,
      summary: fr
        ? `Résiliation ${company} confirmée. Numéro: NP-${this.randomRef()}. Effectif fin de période.`
        : `${company} cancellation confirmed. Ref: NP-${this.randomRef()}. Effective end of billing period.`,
    };
  }

  private async simulateNegotiate(
    task: CallTask, agent: string, fr: boolean,
    emit: (e: SimEvent) => void
  ): Promise<SimResult> {
    const company = task.company || 'the service';
    const savingsAmount = Math.floor(Math.random() * 15 + 10);

    emit({
      speaker: 'nope',
      text: fr
        ? `Bonjour ${agent}. Je suis client ${company} depuis longtemps et je trouve ma facture un peu élevée. Y a-t-il des offres plus avantageuses ?`
        : `Hi ${agent}. I've been a loyal ${company} customer and my bill seems quite high. Are there any better deals available?`,
      statusChange: 'negotiating',
    });
    await this.pause(2000);

    emit({
      speaker: 'agent',
      text: fr
        ? `Je vais regarder votre compte... Vous êtes actuellement sur le forfait standard. Malheureusement, c'est déjà notre meilleur tarif.`
        : `Let me look at your account... You're currently on the standard plan. Unfortunately, that's already our best rate.`,
    });
    await this.pause(2000);

    // Competitor mention tactic
    emit({
      speaker: 'nope',
      text: fr
        ? `Ah, c'est dommage. J'ai vu que la concurrence propose des offres intéressantes en ce moment... Je me demande si je ne devrais pas changer.`
        : `That's a shame. I've noticed competitors are offering some attractive deals right now... I'm wondering if I should switch.`,
    });
    await this.pause(2500);

    // Strategic silence (agent fills it)
    emit({
      speaker: 'agent',
      text: fr
        ? `Attendez, laissez-moi vérifier... En fait, je peux vous proposer une réduction de ${savingsAmount}% sur votre forfait pendant 12 mois. Ça vous conviendrait ?`
        : `Hold on, let me check... Actually, I can offer you a ${savingsAmount}% discount on your plan for 12 months. Would that work?`,
    });
    await this.pause(1500);

    emit({
      speaker: 'nope',
      text: fr
        ? `Oui, ça me convient. Merci beaucoup pour cet effort !`
        : `Yes, that works for me. Thank you for the effort!`,
    });
    await this.pause(1000);

    emit({
      speaker: 'agent',
      text: fr
        ? `Parfait, c'est appliqué à partir de votre prochaine facture. Référence: NP-${this.randomRef()}.`
        : `Great, it's applied starting your next bill. Reference: NP-${this.randomRef()}.`,
    });
    await this.pause(500);

    emit({
      speaker: 'system',
      text: fr ? '📞 Appel terminé' : '📞 Call ended',
      statusChange: 'success',
    });

    return {
      success: true,
      summary: fr
        ? `Négociation ${company} réussie : ${savingsAmount}% de réduction pendant 12 mois.`
        : `${company} negotiation successful: ${savingsAmount}% discount for 12 months.`,
      savings: savingsAmount,
    };
  }

  private async simulateGeneral(
    task: CallTask, agent: string, fr: boolean,
    emit: (e: SimEvent) => void
  ): Promise<SimResult> {
    emit({
      speaker: 'nope',
      text: fr
        ? `Bonjour ${agent}. ${task.goal}`
        : `Hi ${agent}. ${task.goal}`,
    });
    await this.pause(2000);

    emit({
      speaker: 'agent',
      text: fr
        ? `Bien sûr, je vais m'en occuper. C'est noté, votre demande a été enregistrée sous la référence NP-${this.randomRef()}.`
        : `Of course, I'll take care of that. Your request has been logged under reference NP-${this.randomRef()}.`,
    });
    await this.pause(1000);

    emit({
      speaker: 'system',
      text: fr ? '📞 Appel terminé' : '📞 Call ended',
      statusChange: 'success',
    });

    return {
      success: true,
      summary: fr ? `Demande traitée. Référence: NP-${this.randomRef()}.` : `Request processed. Ref: NP-${this.randomRef()}.`,
    };
  }

  // ── Helpers ──

  private ivrGreeting(company: string, fr: boolean): string {
    return fr
      ? `Bienvenue chez ${company}. Cet appel peut être enregistré à des fins de qualité.`
      : `Welcome to ${company}. This call may be recorded for quality purposes.`;
  }

  private ivrMenu(strategy: string, fr: boolean): string {
    if (fr) {
      return 'Pour le suivi de commande, tapez 1. Pour la facturation, tapez 2. Pour la résiliation, tapez 3. Pour parler à un conseiller, tapez 0.';
    }
    return 'For order tracking, press 1. For billing, press 2. For cancellations, press 3. For an agent, press 0.';
  }

  private randomRef(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private pause(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
