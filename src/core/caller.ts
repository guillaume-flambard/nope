// ═══════════════════════════════════════
// NOPE. — Twilio Call Manager + Simulator
// ═══════════════════════════════════════

import { CallTask, CallStatus, Language, Strategy } from './types';

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

  /** Localization helper — pick string by language */
  private loc<T>(lang: Language, options: Record<Language, T>): T {
    return options[lang] ?? options.en;
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
    onEvent: (event: SimEvent) => void,
    llm?: (agentTurn: string, history: Array<{ role: string; content: string }>) => Promise<string>
  ): Promise<SimResult> {
    const lang = task.language;
    const company = task.company || 'the company';

    // ── Phase 1: Dialing ──
    onEvent({
      speaker: 'system',
      text: this.loc(lang, {
        en: 'Dialing...', fr: 'Appel en cours...', es: 'Marcando...',
        de: 'Wähle...', it: 'Chiamata in corso...',
      }),
      statusChange: 'dialing',
    });
    await this.pause(1500);

    onEvent({
      speaker: 'system',
      text: this.loc(lang, {
        en: 'Connected', fr: 'Connexion établie', es: 'Conectado',
        de: 'Verbunden', it: 'Connesso',
      }),
      action: 'connected',
    });
    await this.pause(800);

    // ── Phase 2: IVR Navigation ──
    onEvent({ speaker: 'ivr', text: this.ivrGreeting(company, lang), statusChange: 'ivr' });
    await this.pause(2000);

    // Language selector (non-EN gets a prompt)
    if (lang !== 'en') {
      const langSelector = this.loc(lang, {
        en: '',
        fr: 'Pour le français, appuyez sur 1. For English, press 2.',
        es: 'Para español, presione 1. For English, press 2.',
        de: 'Für Deutsch, drücken Sie 1. For English, press 2.',
        it: 'Per italiano, prema 1. For English, press 2.',
      });
      onEvent({ speaker: 'ivr', text: langSelector });
      await this.pause(1000);
      onEvent({
        speaker: 'nope',
        text: this.loc(lang, {
          en: '', fr: '(Appui sur 1)', es: '(Presionando 1)',
          de: '(Drücke 1)', it: '(Premo 1)',
        }),
        action: 'pressed_1',
      });
      await this.pause(1500);
    }

    onEvent({ speaker: 'ivr', text: this.ivrMenu(task.strategy, lang) });
    await this.pause(1500);

    const menuKey = task.strategy === 'cancel' ? '3' : task.strategy === 'negotiate' ? '2' : '1';
    onEvent({
      speaker: 'nope',
      text: this.loc(lang, {
        en: `(Pressing ${menuKey})`, fr: `(Appui sur ${menuKey})`, es: `(Presionando ${menuKey})`,
        de: `(Drücke ${menuKey})`, it: `(Premo ${menuKey})`,
      }),
      action: `pressed_${menuKey}`,
    });
    await this.pause(1500);

    // ── Account number entry (real IVR scenario: "enter your subscriber number") ──
    const accountDigits = task.strategy === 'cancel' ? '48213760' : task.strategy === 'negotiate' ? '90318425' : '65120947';
    onEvent({
      speaker: 'ivr',
      text: this.loc(lang, {
        en: 'Please enter your subscriber number, followed by the pound key.',
        fr: 'Veuillez saisir votre numéro d\'abonné, suivi de la touche dièse.',
        es: 'Por favor, ingrese su número de suscriptor, seguido de la tecla de numeral.',
        de: 'Bitte geben Sie Ihre Abonnentennummer ein, gefolgt von der Raute-Taste.',
        it: 'Inserisca il suo numero di abbonato, seguito dal cancelletto.',
      }),
    });
    await this.pause(1500);
    onEvent({
      speaker: 'nope',
      text: this.loc(lang, {
        en: `(Entering ${accountDigits}#)`, fr: `(Saisie ${accountDigits}#)`, es: `(Ingresando ${accountDigits}#)`,
        de: `(Eingabe ${accountDigits}#)`, it: `(Inserendo ${accountDigits}#)`,
      }),
      action: 'enter_digits',
    });
    await this.pause(1800);
    onEvent({
      speaker: 'ivr',
      text: this.loc(lang, {
        en: 'Thank you. One moment while I pull up your account...',
        fr: 'Merci. Un instant pendant que je consulte votre compte...',
        es: 'Gracias. Un momento mientras reviso su cuenta...',
        de: 'Danke. Einen Moment, ich rufe Ihr Konto auf...',
        it: 'Grazie. Un attimo mentre recupero il suo conto...',
      }),
    });
    await this.pause(1500);

    // ── Phase 3: On Hold ──
    onEvent({
      speaker: 'ivr',
      text: this.loc(lang, {
        en: 'Your call is important to us. Please stay on the line...',
        fr: 'Votre appel est important. Un conseiller va prendre votre appel...',
        es: 'Su llamada es importante para nosotros. Por favor, permanezca en línea...',
        de: 'Ihr Anruf ist uns wichtig. Bitte bleiben Sie in der Leitung...',
        it: 'La sua chiamata è importante per noi. La preghiamo di restare in linea...',
      }),
      statusChange: 'holding',
    });
    await this.pause(3000);

    onEvent({
      speaker: 'system',
      text: this.loc(lang, {
        en: '♪ Hold music... (2min 15s)', fr: '♪ Musique d\'attente... (2min 15s)',
        es: '♪ Música de espera... (2min 15s)', de: '♪ Wartemusik... (2min 15s)',
        it: '♪ Musica d\'attesa... (2min 15s)',
      }),
      action: 'hold_music',
    });
    await this.pause(2000);

    // ── Phase 4: Human Agent ──
    const agentName = this.pickAgentName(lang);

    onEvent({
      speaker: 'agent',
      text: this.loc(lang, {
        en: `Hello, this is ${agentName} from ${company} customer service. How can I help you?`,
        fr: `Bonjour, ${agentName} du service client ${company}. Comment puis-je vous aider ?`,
        es: `Hola, le atiende ${agentName} del servicio al cliente de ${company}. ¿En qué puedo ayudarle?`,
        de: `Hallo, hier ist ${agentName} vom ${company}-Kundenservice. Wie kann ich Ihnen helfen?`,
        it: `Buongiorno, sono ${agentName} del servizio clienti ${company}. Come posso aiutarla?`,
      }),
      statusChange: 'talking',
    });
    await this.pause(1500);

    // ── Phase 5: Strategy Execution ──
    switch (task.strategy) {
      case 'cancel':
        return await this.simulateCancel(task, agentName, lang, onEvent, llm);
      case 'negotiate':
        return await this.simulateNegotiate(task, agentName, lang, onEvent);
      default:
        return await this.simulateGeneral(task, agentName, lang, onEvent);
    }
  }

  private async simulateCancel(
    task: CallTask, agent: string, lang: Language,
    emit: (e: SimEvent) => void,
    llm?: (agentTurn: string, history: Array<{ role: string; content: string }>) => Promise<string>
  ): Promise<SimResult> {
    const company = task.company || 'the service';
    const history: Array<{ role: string; content: string }> = [];

    /** Emit NOPE's spoken reply: LLM if available (natural, varied, responsive), else scripted fallback. */
    const nopeSay = async (fallback: string, agentTurn: string): Promise<void> => {
      // Push the agent's turn FIRST so the LLM answers the latest thing said.
      if (agentTurn) history.push({ role: 'user', content: agentTurn });
      let reply = fallback;
      if (llm) {
        try {
          const r = await llm(agentTurn, history);
          if (r && r.trim()) reply = r.trim();
        } catch (_) { /* fallback to scripted line */ }
      }
      history.push({ role: 'assistant', content: reply });
      emit({ speaker: 'nope', text: reply, statusChange: 'negotiating' });
    };

    // Opening
    await nopeSay(
      this.loc(lang, {
        en: `Hi ${agent}. I'm calling to cancel my ${company} subscription, please.`,
        fr: `Bonjour ${agent}. J'appelle pour résilier mon abonnement ${company}, s'il vous plaît.`,
        es: `Hola ${agent}. Llamo para cancelar mi suscripción de ${company}, por favor.`,
        de: `Hallo ${agent}. Ich rufe an, um mein ${company}-Abonnement zu kündigen, bitte.`,
        it: `Buongiorno ${agent}. Chiamo per disdire il mio abbonamento ${company}, per favore.`,
      }),
      ''
    );
    await this.pause(2000);

    // Retention attempt 1 — "why?"
    const whyTurn = this.loc(lang, {
      en: `I understand. May I ask why? We might have an offer that could interest you...`,
      fr: `Je comprends. Puis-je vous demander la raison ? Nous avons peut-être une offre qui pourrait vous intéresser...`,
      es: `Entiendo. ¿Puedo preguntarle el motivo? Quizás tengamos una oferta que pueda interesarle...`,
      de: `Ich verstehe. Darf ich nach dem Grund fragen? Vielleicht haben wir ein Angebot, das Sie interessieren könnte...`,
      it: `Capisco. Posso chiederle il motivo? Forse abbiamo un'offerta che potrebbe interessarla...`,
    });
    emit({ speaker: 'agent', text: whyTurn });
    await this.pause(2000);

    await nopeSay(
      this.loc(lang, {
        en: `Thank you, but my decision is final. It's for personal reasons. I just want to cancel.`,
        fr: `Merci, mais ma décision est prise. C'est pour des raisons personnelles. Je souhaite juste résilier.`,
        es: `Gracias, pero mi decisión es definitiva. Es por motivos personales. Solo quiero cancelar.`,
        de: `Danke, aber meine Entscheidung steht fest. Es sind persönliche Gründe. Ich möchte einfach kündigen.`,
        it: `Grazie, ma la mia decisione è definitiva. È per motivi personali. Desidero solo disdire.`,
      }),
      whyTurn
    );
    await this.pause(2000);

    // Retention attempt 2 — "50% off"
    const offerTurn = this.loc(lang, {
      en: `I understand. What if I offered you 50% off for 3 months?`,
      fr: `Je comprends. Et si je vous proposais 50% de réduction pendant 3 mois ?`,
      es: `Entiendo. ¿Y si le ofrezco un 50% de descuento durante 3 meses?`,
      de: `Ich verstehe. Was, wenn ich Ihnen 50% Rabatt für 3 Monate anbiete?`,
      it: `Capisco. E se le offrissi il 50% di sconto per 3 mesi?`,
    });
    emit({ speaker: 'agent', text: offerTurn });
    await this.pause(1500);

    await nopeSay(
      this.loc(lang, {
        en: `No thank you, that's kind but I really want to cancel my subscription today.`,
        fr: `Non merci, c'est gentil mais je souhaite vraiment résilier mon abonnement aujourd'hui.`,
        es: `No gracias, es amable pero realmente quiero cancelar mi suscripción hoy.`,
        de: `Nein danke, das ist nett, aber ich möchte mein Abonnement wirklich heute kündigen.`,
        it: `No grazie, è gentile ma desidero davvero disdire il mio abbonamento oggi.`,
      }),
      offerTurn
    );
    await this.pause(2000);

    // A real-agent question wave (only when LLM drives the call — tests true back-and-forth)
    const questionWave = this.loc(lang, {
      en: `Okay, sure. And just to confirm — is this the account ending in 2847, and is there anyone else on the plan I should be aware of?`,
      fr: `D'accord. Juste pour confirmer — c'est bien le compte se terminant par 2847, et y a-t-il d'autres personnes sur le forfait dont je devrais tenir compte ?`,
      es: `De acuerdo. Solo para confirmar — ¿es la cuenta que termina en 2847, y hay alguien más en el plan que deba tener en cuenta?`,
      de: `In Ordnung. Nur zur Bestätigung — ist das das Konto mit der Endung 2847, und gibt es noch jemanden im Tarif, den ich berücksichtigen sollte?`,
      it: `Va bene. Solo per confermare — è il conto che termina con 2847, e c'è qualcun altro nel piano di cui dovrei tenere conto?`,
    });
    emit({ speaker: 'agent', text: questionWave });
    await this.pause(1500);

    await nopeSay(
      this.loc(lang, {
        en: `Yes, that's the right account, and no, it's just me on the plan. Please go ahead and cancel it.`,
        fr: `Oui, c'est bien le bon compte, et non, je suis seul sur le forfait. Vous pouvez procéder à la résiliation.`,
        es: `Sí, es la cuenta correcta, y no, solo estoy yo en el plan. Puede proceder a cancelarla.`,
        de: `Ja, das ist das richtige Konto, und nein, ich bin allein im Tarif. Bitte kündigen Sie es.`,
        it: `Sì, è il conto giusto, e no, sono solo io nel piano. Può procedere con la disdetta.`,
      }),
      questionWave
    );
    await this.pause(2000);

    // Success
    const ref = this.randomRef();
    const successTurn = this.loc(lang, {
      en: `Alright, I'll process the cancellation. Your subscription will remain active until the end of your billing period. Your confirmation number is NP-${ref}.`,
      fr: `D'accord, je procède à la résiliation. Votre abonnement sera effectif jusqu'à la fin de votre période. Votre numéro de confirmation est NP-${ref}.`,
      es: `De acuerdo, procedo con la cancelación. Su suscripción seguirá activa hasta el final del período de facturación. Su número de confirmación es NP-${ref}.`,
      de: `In Ordnung, ich veranlasse die Kündigung. Ihr Abonnement bleibt bis zum Ende des Abrechnungszeitraums aktiv. Ihre Bestätigungsnummer ist NP-${ref}.`,
      it: `Va bene, procedo con la disdetta. Il suo abbonamento resterà attivo fino alla fine del periodo di fatturazione. Il suo numero di conferma è NP-${ref}.`,
    });
    emit({ speaker: 'agent', text: successTurn });
    await this.pause(1500);

    await nopeSay(
      this.loc(lang, {
        en: `Perfect, thank you very much ${agent}. Have a great day.`,
        fr: `Parfait, merci beaucoup ${agent}. Bonne journée.`,
        es: `Perfecto, muchas gracias ${agent}. Que tenga un buen día.`,
        de: `Perfekt, vielen Dank ${agent}. Einen schönen Tag noch.`,
        it: `Perfetto, grazie mille ${agent}. Buona giornata.`,
      }),
      successTurn
    );
    await this.pause(500);

    emit({
      speaker: 'system',
      text: this.loc(lang, {
        en: 'Call ended', fr: 'Appel terminé', es: 'Llamada finalizada',
        de: 'Anruf beendet', it: 'Chiamata terminata',
      }),
      statusChange: 'success',
    });

    return {
      success: true,
      summary: this.loc(lang, {
        en: `${company} cancellation confirmed. Ref: NP-${ref}. Effective end of billing period.`,
        fr: `Résiliation ${company} confirmée. Numéro: NP-${ref}. Effectif fin de période.`,
        es: `Cancelación de ${company} confirmada. Ref: NP-${ref}. Efectiva al final del período.`,
        de: `${company}-Kündigung bestätigt. Ref: NP-${ref}. Wirksam zum Ende des Abrechnungszeitraums.`,
        it: `Disdetta ${company} confermata. Rif: NP-${ref}. Effettiva a fine periodo.`,
      }),
    };
  }

  private async simulateNegotiate(
    task: CallTask, agent: string, lang: Language,
    emit: (e: SimEvent) => void
  ): Promise<SimResult> {
    const company = task.company || 'the service';
    const savingsAmount = Math.floor(Math.random() * 15 + 10);

    emit({
      speaker: 'nope',
      text: this.loc(lang, {
        en: `Hi ${agent}. I've been a loyal ${company} customer and my bill seems quite high. Are there any better deals available?`,
        fr: `Bonjour ${agent}. Je suis client ${company} depuis longtemps et je trouve ma facture un peu élevée. Y a-t-il des offres plus avantageuses ?`,
        es: `Hola ${agent}. Soy cliente fiel de ${company} y mi factura parece bastante alta. ¿Hay alguna oferta mejor disponible?`,
        de: `Hallo ${agent}. Ich bin langjähriger ${company}-Kunde und meine Rechnung scheint ziemlich hoch. Gibt es bessere Angebote?`,
        it: `Buongiorno ${agent}. Sono un cliente fedele di ${company} e la mia bolletta sembra piuttosto alta. Ci sono offerte migliori disponibili?`,
      }),
      statusChange: 'negotiating',
    });
    await this.pause(2000);

    emit({
      speaker: 'agent',
      text: this.loc(lang, {
        en: `Let me look at your account... You're currently on the standard plan. Unfortunately, that's already our best rate.`,
        fr: `Je vais regarder votre compte... Vous êtes actuellement sur le forfait standard. Malheureusement, c'est déjà notre meilleur tarif.`,
        es: `Déjeme revisar su cuenta... Actualmente tiene el plan estándar. Desafortunadamente, ya es nuestra mejor tarifa.`,
        de: `Lassen Sie mich Ihr Konto prüfen... Sie haben derzeit den Standardtarif. Leider ist das bereits unser bestes Angebot.`,
        it: `Mi lasci controllare il suo conto... Attualmente ha il piano standard. Purtroppo, è già la nostra tariffa migliore.`,
      }),
    });
    await this.pause(2000);

    // Competitor mention tactic
    emit({
      speaker: 'nope',
      text: this.loc(lang, {
        en: `That's a shame. I've noticed competitors are offering some attractive deals right now... I'm wondering if I should switch.`,
        fr: `Ah, c'est dommage. J'ai vu que la concurrence propose des offres intéressantes en ce moment... Je me demande si je ne devrais pas changer.`,
        es: `Qué lástima. He visto que la competencia ofrece ofertas atractivas ahora mismo... Me pregunto si debería cambiar.`,
        de: `Das ist schade. Mir ist aufgefallen, dass die Konkurrenz gerade attraktive Angebote hat... Ich überlege, ob ich wechseln sollte.`,
        it: `Che peccato. Ho notato che la concorrenza offre promozioni interessanti in questo momento... Mi chiedo se dovrei cambiare.`,
      }),
    });
    await this.pause(2500);

    // Agent offers deal
    emit({
      speaker: 'agent',
      text: this.loc(lang, {
        en: `Hold on, let me check... Actually, I can offer you a ${savingsAmount}% discount on your plan for 12 months. Would that work?`,
        fr: `Attendez, laissez-moi vérifier... En fait, je peux vous proposer une réduction de ${savingsAmount}% sur votre forfait pendant 12 mois. Ça vous conviendrait ?`,
        es: `Espere, déjeme verificar... De hecho, puedo ofrecerle un ${savingsAmount}% de descuento en su plan durante 12 meses. ¿Le parece bien?`,
        de: `Moment, lassen Sie mich nachsehen... Tatsächlich kann ich Ihnen ${savingsAmount}% Rabatt auf Ihren Tarif für 12 Monate anbieten. Wäre das in Ordnung?`,
        it: `Un momento, mi lasci verificare... In effetti, posso offrirle uno sconto del ${savingsAmount}% sul suo piano per 12 mesi. Le andrebbe bene?`,
      }),
    });
    await this.pause(1500);

    emit({
      speaker: 'nope',
      text: this.loc(lang, {
        en: `Yes, that works for me. Thank you for the effort!`,
        fr: `Oui, ça me convient. Merci beaucoup pour cet effort !`,
        es: `Sí, me parece bien. ¡Gracias por el esfuerzo!`,
        de: `Ja, das passt für mich. Vielen Dank für die Mühe!`,
        it: `Sì, va bene per me. Grazie per l'impegno!`,
      }),
    });
    await this.pause(1000);

    const ref = this.randomRef();
    emit({
      speaker: 'agent',
      text: this.loc(lang, {
        en: `Great, it's applied starting your next bill. Reference: NP-${ref}.`,
        fr: `Parfait, c'est appliqué à partir de votre prochaine facture. Référence: NP-${ref}.`,
        es: `Perfecto, se aplicará a partir de su próxima factura. Referencia: NP-${ref}.`,
        de: `Perfekt, es gilt ab Ihrer nächsten Rechnung. Referenz: NP-${ref}.`,
        it: `Perfetto, sarà applicato dalla prossima bolletta. Riferimento: NP-${ref}.`,
      }),
    });
    await this.pause(500);

    emit({
      speaker: 'system',
      text: this.loc(lang, {
        en: 'Call ended', fr: 'Appel terminé', es: 'Llamada finalizada',
        de: 'Anruf beendet', it: 'Chiamata terminata',
      }),
      statusChange: 'success',
    });

    return {
      success: true,
      summary: this.loc(lang, {
        en: `${company} negotiation successful: ${savingsAmount}% discount for 12 months.`,
        fr: `Négociation ${company} réussie : ${savingsAmount}% de réduction pendant 12 mois.`,
        es: `Negociación con ${company} exitosa: ${savingsAmount}% de descuento durante 12 meses.`,
        de: `${company}-Verhandlung erfolgreich: ${savingsAmount}% Rabatt für 12 Monate.`,
        it: `Negoziazione ${company} riuscita: ${savingsAmount}% di sconto per 12 mesi.`,
      }),
      savings: savingsAmount,
    };
  }

  private async simulateGeneral(
    task: CallTask, agent: string, lang: Language,
    emit: (e: SimEvent) => void
  ): Promise<SimResult> {
    emit({
      speaker: 'nope',
      text: this.loc(lang, {
        en: `Hi ${agent}. ${task.goal}`,
        fr: `Bonjour ${agent}. ${task.goal}`,
        es: `Hola ${agent}. ${task.goal}`,
        de: `Hallo ${agent}. ${task.goal}`,
        it: `Buongiorno ${agent}. ${task.goal}`,
      }),
    });
    await this.pause(2000);

    const ref = this.randomRef();
    emit({
      speaker: 'agent',
      text: this.loc(lang, {
        en: `Of course, I'll take care of that. Your request has been logged under reference NP-${ref}.`,
        fr: `Bien sûr, je vais m'en occuper. C'est noté, votre demande a été enregistrée sous la référence NP-${ref}.`,
        es: `Por supuesto, me encargo de ello. Su solicitud ha sido registrada con la referencia NP-${ref}.`,
        de: `Natürlich, ich kümmere mich darum. Ihre Anfrage wurde unter der Referenz NP-${ref} erfasst.`,
        it: `Certamente, me ne occupo io. La sua richiesta è stata registrata con il riferimento NP-${ref}.`,
      }),
    });
    await this.pause(1000);

    emit({
      speaker: 'system',
      text: this.loc(lang, {
        en: 'Call ended', fr: 'Appel terminé', es: 'Llamada finalizada',
        de: 'Anruf beendet', it: 'Chiamata terminata',
      }),
      statusChange: 'success',
    });

    return {
      success: true,
      summary: this.loc(lang, {
        en: `Request processed. Ref: NP-${ref}.`,
        fr: `Demande traitée. Référence: NP-${ref}.`,
        es: `Solicitud procesada. Ref: NP-${ref}.`,
        de: `Anfrage bearbeitet. Ref: NP-${ref}.`,
        it: `Richiesta elaborata. Rif: NP-${ref}.`,
      }),
    };
  }

  // ── Helpers ──

  private pickAgentName(lang: Language): string {
    const names: Record<Language, string[]> = {
      en: ['Sarah', 'James', 'Emma', 'David'],
      fr: ['Marie', 'Thomas', 'Sophie', 'Lucas'],
      es: ['María', 'Carlos', 'Sofía', 'Diego'],
      de: ['Anna', 'Markus', 'Lena', 'Felix'],
      it: ['Giulia', 'Marco', 'Sofia', 'Alessandro'],
    };
    const pool = names[lang] ?? names.en;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private ivrGreeting(company: string, lang: Language): string {
    return this.loc(lang, {
      en: `Welcome to ${company}. This call may be recorded for quality purposes.`,
      fr: `Bienvenue chez ${company}. Cet appel peut être enregistré à des fins de qualité.`,
      es: `Bienvenido a ${company}. Esta llamada puede ser grabada con fines de calidad.`,
      de: `Willkommen bei ${company}. Dieser Anruf kann zu Qualitätszwecken aufgezeichnet werden.`,
      it: `Benvenuto in ${company}. Questa chiamata potrebbe essere registrata a scopo di qualità.`,
    });
  }

  private ivrMenu(strategy: string, lang: Language): string {
    return this.loc(lang, {
      en: 'For order tracking, press 1. For billing, press 2. For cancellations, press 3. For an agent, press 0.',
      fr: 'Pour le suivi de commande, tapez 1. Pour la facturation, tapez 2. Pour la résiliation, tapez 3. Pour parler à un conseiller, tapez 0.',
      es: 'Para seguimiento de pedidos, presione 1. Para facturación, presione 2. Para cancelaciones, presione 3. Para un agente, presione 0.',
      de: 'Für Sendungsverfolgung drücken Sie 1. Für Rechnungen drücken Sie 2. Für Kündigungen drücken Sie 3. Für einen Berater drücken Sie 0.',
      it: 'Per il tracciamento ordini, prema 1. Per la fatturazione, prema 2. Per le disdette, prema 3. Per un operatore, prema 0.',
    });
  }

  private randomRef(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private pause(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
