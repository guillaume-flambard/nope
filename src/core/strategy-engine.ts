// ═══════════════════════════════════════
// NOPE. — Conversation Strategy Engine
// ═══════════════════════════════════════

import { Strategy, StrategyType, Language } from './types';

/** Factory function type for creating a Strategy */
export type StrategyFactory = (lang: Language, company?: string) => Strategy;

export class StrategyEngine {
  private customStrategies = new Map<string, StrategyFactory>();

  /** Register a custom strategy factory (takes priority over built-in) */
  registerStrategy(type: string, factory: StrategyFactory): void {
    this.customStrategies.set(type, factory);
  }

  /** Get the appropriate strategy for a task */
  getStrategy(type: StrategyType | string, lang: Language, company?: string): Strategy {
    // Check custom strategies first (plugin priority)
    const custom = this.customStrategies.get(type);
    if (custom) {
      return custom(lang, company);
    }

    switch (type) {
      case 'cancel': return this.cancelStrategy(lang, company);
      case 'negotiate': return this.negotiateStrategy(lang, company);
      case 'appointment': return this.appointmentStrategy(lang);
      case 'complain': return this.complainStrategy(lang, company);
      default: return this.inquiryStrategy(lang);
    }
  }

  // ── Language helper ──

  private localize<T>(lang: Language, options: Partial<Record<Language, T>> & { en: T }): T {
    return options[lang] ?? options.en;
  }

  private cancelStrategy(lang: Language, company?: string): Strategy {
    const companyName = company || this.localize(lang, {
      en: 'this company',
      fr: 'cette entreprise',
      es: 'esta empresa',
      de: 'dieses Unternehmen',
      it: 'questa azienda',
    });

    return {
      type: 'cancel',
      systemPrompt: this.localize(lang, {
        en: `You are calling ${companyName} to CANCEL your subscription/service. You are determined. No offer will change your mind.`,
        fr: `Tu appelles ${companyName} pour RÉSILIER ton abonnement/contrat. Tu es déterminé. Aucune offre ne te fera changer d'avis.`,
        es: `Estás llamando a ${companyName} para CANCELAR tu suscripción/servicio. Estás decidido. Ninguna oferta te hará cambiar de opinión.`,
        de: `Du rufst bei ${companyName} an, um dein Abonnement/deinen Vertrag zu KÜNDIGEN. Du bist entschlossen. Kein Angebot wird dich umstimmen.`,
        it: `Stai chiamando ${companyName} per DISDIRE il tuo abbonamento/contratto. Sei determinato. Nessuna offerta ti farà cambiare idea.`,
      }),
      openingLine: this.localize(lang, {
        en: `Hi, I'm calling to cancel my ${company || ''} subscription, please.`,
        fr: `Bonjour, j'appelle pour résilier mon abonnement ${company || ''}, s'il vous plaît.`,
        es: `Hola, llamo para cancelar mi suscripción de ${company || ''}, por favor.`,
        de: `Hallo, ich rufe an, um mein ${company || ''} Abonnement zu kündigen, bitte.`,
        it: `Buongiorno, chiamo per disdire il mio abbonamento ${company || ''}, per favore.`,
      }),
      tactics: this.localize(lang, {
        en: [
          'Stay polite but unwavering',
          'If retention offer → "No thank you, my decision is final"',
          'If pressed → "Personal reasons, I just want to cancel"',
          'If transferred → accept and restart your request',
          'Always ask for a confirmation number',
          'If asked why → "I no longer use the service"',
        ],
        fr: [
          'Reste poli mais inébranlable',
          'Si offre de rétention → "Non merci, ma décision est prise"',
          'Si insistance → "Raisons personnelles, je souhaite simplement résilier"',
          'Si transfert → accepte et recommence la demande',
          'Demande toujours un numéro de confirmation',
          'Si on demande une raison → "Je n\'utilise plus le service"',
        ],
        es: [
          'Mantente educado pero firme',
          'Si oferta de retención → "No gracias, mi decisión es definitiva"',
          'Si insisten → "Razones personales, solo quiero cancelar"',
          'Si te transfieren → acepta y repite tu solicitud',
          'Siempre pide un número de confirmación',
          'Si preguntan por qué → "Ya no uso el servicio"',
        ],
        de: [
          'Bleib höflich aber bestimmt',
          'Bei Rückhalteangebot → "Nein danke, meine Entscheidung steht fest"',
          'Bei Nachfrage → "Persönliche Gründe, ich möchte einfach kündigen"',
          'Bei Weiterleitung → akzeptieren und Anfrage wiederholen',
          'Immer nach einer Bestätigungsnummer fragen',
          'Wenn nach dem Grund gefragt → "Ich nutze den Service nicht mehr"',
        ],
        it: [
          'Resta educato ma irremovibile',
          'Se offerta di retention → "No grazie, la mia decisione è definitiva"',
          'Se insistono → "Motivi personali, voglio semplicemente disdire"',
          'Se trasferiscono → accetta e ripeti la richiesta',
          'Chiedi sempre un numero di conferma',
          'Se chiedono perché → "Non utilizzo più il servizio"',
        ],
      }),
      successCriteria: this.localize(lang, {
        en: ['cancellation confirmed', 'confirmation number', 'account closed', 'effective date'],
        fr: ['résiliation confirmée', 'numéro de confirmation', 'compte clôturé', 'effectif le'],
        es: ['cancelación confirmada', 'número de confirmación', 'cuenta cerrada', 'fecha efectiva'],
        de: ['Kündigung bestätigt', 'Bestätigungsnummer', 'Konto geschlossen', 'Wirksamkeitsdatum'],
        it: ['disdetta confermata', 'numero di conferma', 'account chiuso', 'data effettiva'],
      }),
      failureHandling: this.localize(lang, {
        en: 'If failed after 3 attempts, ask to speak to a supervisor.',
        fr: 'Si échec après 3 tentatives, demande à parler à un superviseur.',
        es: 'Si falla después de 3 intentos, pide hablar con un supervisor.',
        de: 'Nach 3 Fehlversuchen, bitte um ein Gespräch mit einem Vorgesetzten.',
        it: 'Se fallisce dopo 3 tentativi, chiedi di parlare con un supervisore.',
      }),
      ivrTarget: this.localize(lang, {
        en: ['cancel', 'close', 'terminate', 'account', 'subscription'],
        fr: ['résiliation', 'fermeture', 'annulation', 'compte', 'abonnement'],
        es: ['cancelar', 'cerrar', 'cuenta', 'suscripción'],
        de: ['kündigen', 'schließen', 'konto', 'abonnement'],
        it: ['disdire', 'chiudere', 'account', 'abbonamento', 'cancellare'],
      }),
      maxAttempts: 3,
    };
  }

  private negotiateStrategy(lang: Language, company?: string): Strategy {
    const companyName = company || this.localize(lang, {
      en: 'this company',
      fr: 'cette entreprise',
      es: 'esta empresa',
      de: 'dieses Unternehmen',
      it: 'questa azienda',
    });

    return {
      type: 'negotiate',
      systemPrompt: this.localize(lang, {
        en: `You are calling ${companyName} to NEGOTIATE your bill. You want a discount or better rate.`,
        fr: `Tu appelles ${companyName} pour NÉGOCIER ta facture. Tu veux une réduction ou un meilleur tarif.`,
        es: `Estás llamando a ${companyName} para NEGOCIAR tu factura. Quieres un descuento o mejor tarifa.`,
        de: `Du rufst bei ${companyName} an, um deine Rechnung zu VERHANDELN. Du willst einen Rabatt oder besseren Tarif.`,
        it: `Stai chiamando ${companyName} per NEGOZIARE la tua bolletta. Vuoi uno sconto o una tariffa migliore.`,
      }),
      openingLine: this.localize(lang, {
        en: `Hi, I've been a loyal customer and I noticed my bill seems high. I was wondering if there are any better deals available?`,
        fr: `Bonjour, je suis client depuis longtemps et je trouve ma facture un peu élevée. Je me demandais s'il y avait des offres plus avantageuses ?`,
        es: `Hola, soy cliente fiel desde hace tiempo y mi factura parece alta. Me preguntaba si hay ofertas mejores disponibles.`,
        de: `Hallo, ich bin langjähriger Kunde und meine Rechnung scheint hoch. Gibt es vielleicht bessere Angebote?`,
        it: `Buongiorno, sono cliente da molto tempo e la mia bolletta mi sembra alta. Mi chiedevo se ci fossero offerte migliori disponibili.`,
      }),
      tactics: this.localize(lang, {
        en: [
          'Anchoring: mention a rate 30% lower than current',
          'Competition: "I noticed [competitor] is offering $X/month"',
          'Loyalty: "I\'ve been a customer for X years"',
          'Strategic silence: pause after their offer',
          'If good offer → accept, if bad → "I\'ll think about it"',
          'Minimum goal: 15% reduction',
        ],
        fr: [
          'Ancrage: mentionne un tarif 30% plus bas que le tien',
          'Concurrence: "J\'ai vu que [concurrent] propose X€/mois"',
          'Loyauté: "Je suis client depuis X ans"',
          'Silence stratégique: laisse un blanc après leur offre',
          'Si bonne offre → accepte, si mauvaise → "je vais réfléchir"',
          'Objectif minimum: 15% de réduction',
        ],
        es: [
          'Anclaje: menciona una tarifa 30% más baja',
          'Competencia: "Vi que [competidor] ofrece X€/mes"',
          'Lealtad: "Soy cliente desde hace X años"',
          'Silencio estratégico: pausa después de su oferta',
          'Si buena oferta → acepta, si mala → "lo pensaré"',
          'Objetivo mínimo: 15% de reducción',
        ],
        de: [
          'Anker: erwähne einen Tarif 30% unter dem aktuellen',
          'Konkurrenz: "Ich habe gesehen, dass [Konkurrent] X€/Monat anbietet"',
          'Treue: "Ich bin seit X Jahren Kunde"',
          'Strategische Stille: Pause nach ihrem Angebot',
          'Bei gutem Angebot → akzeptieren, bei schlechtem → "Ich denke darüber nach"',
          'Mindestziel: 15% Reduktion',
        ],
        it: [
          'Ancoraggio: menziona una tariffa 30% più bassa',
          'Concorrenza: "Ho visto che [concorrente] offre X€/mese"',
          'Fedeltà: "Sono cliente da X anni"',
          'Silenzio strategico: pausa dopo la loro offerta',
          'Se buona offerta → accetta, se cattiva → "ci penserò"',
          'Obiettivo minimo: 15% di riduzione',
        ],
      }),
      successCriteria: this.localize(lang, {
        en: ['new rate', 'discount', 'credit', 'applied', 'savings', 'reduced'],
        fr: ['nouveau tarif', 'réduction', 'crédit', 'remise appliquée', 'économie'],
        es: ['nueva tarifa', 'descuento', 'crédito', 'aplicado', 'ahorro'],
        de: ['neuer Tarif', 'Rabatt', 'Gutschrift', 'angewendet', 'Ersparnis'],
        it: ['nuova tariffa', 'sconto', 'credito', 'applicato', 'risparmio', 'ridotto'],
      }),
      failureHandling: this.localize(lang, {
        en: 'If no discount offered, mention you are considering switching.',
        fr: 'Si pas de réduction, mentionne que tu envisages de partir.',
        es: 'Si no ofrecen descuento, menciona que estás considerando cambiar.',
        de: 'Wenn kein Rabatt angeboten wird, erwähne, dass du einen Wechsel in Betracht ziehst.',
        it: 'Se non offrono sconti, menziona che stai considerando di cambiare operatore.',
      }),
      ivrTarget: this.localize(lang, {
        en: ['billing', 'account', 'plans', 'pricing', 'payment'],
        fr: ['facturation', 'compte', 'tarif', 'offre', 'paiement'],
        es: ['facturación', 'cuenta', 'tarifa', 'oferta', 'pago'],
        de: ['Rechnung', 'Konto', 'Tarif', 'Angebot', 'Zahlung'],
        it: ['fatturazione', 'conto', 'tariffa', 'offerta', 'pagamento'],
      }),
      maxAttempts: 3,
    };
  }

  private appointmentStrategy(lang: Language): Strategy {
    return {
      type: 'appointment',
      systemPrompt: this.localize(lang, {
        en: `You are calling to schedule an appointment. Be specific about preferred date and time.`,
        fr: `Tu appelles pour prendre un rendez-vous. Sois précis sur la date et l'heure souhaitées.`,
        es: `Estás llamando para programar una cita. Sé específico sobre la fecha y hora preferidas.`,
        de: `Du rufst an, um einen Termin zu vereinbaren. Sei spezifisch bezüglich Datum und Uhrzeit.`,
        it: `Stai chiamando per fissare un appuntamento. Sii preciso sulla data e l'ora preferite.`,
      }),
      openingLine: this.localize(lang, {
        en: `Hi, I'd like to schedule an appointment, please.`,
        fr: `Bonjour, je souhaiterais prendre un rendez-vous, s'il vous plaît.`,
        es: `Hola, me gustaría programar una cita, por favor.`,
        de: `Hallo, ich möchte gerne einen Termin vereinbaren, bitte.`,
        it: `Buongiorno, vorrei fissare un appuntamento, per favore.`,
      }),
      tactics: this.localize(lang, {
        en: [
          'Suggest 2-3 time slots that work for you',
          'Confirm all details (date, time, location)',
          'Ask if any documents needed',
          'Note the confirmation number',
        ],
        fr: [
          'Propose 2-3 créneaux qui te conviennent',
          'Confirme tous les détails (date, heure, lieu)',
          'Demande s\'il y a des documents à apporter',
          'Note le numéro de confirmation',
        ],
        es: [
          'Sugiere 2-3 horarios que te convengan',
          'Confirma todos los detalles (fecha, hora, lugar)',
          'Pregunta si se necesitan documentos',
          'Anota el número de confirmación',
        ],
        de: [
          'Schlage 2-3 Zeitfenster vor, die dir passen',
          'Bestätige alle Details (Datum, Uhrzeit, Ort)',
          'Frage, ob Dokumente benötigt werden',
          'Notiere die Bestätigungsnummer',
        ],
        it: [
          'Suggerisci 2-3 fasce orarie che ti vanno bene',
          'Conferma tutti i dettagli (data, ora, luogo)',
          'Chiedi se servono documenti',
          'Annota il numero di conferma',
        ],
      }),
      successCriteria: this.localize(lang, {
        en: ['appointment confirmed', 'confirmation', 'date set', 'see you'],
        fr: ['rendez-vous confirmé', 'confirmation', 'date fixée', 'à bientôt'],
        es: ['cita confirmada', 'confirmación', 'fecha fijada', 'nos vemos'],
        de: ['Termin bestätigt', 'Bestätigung', 'Datum festgelegt', 'bis dann'],
        it: ['appuntamento confermato', 'conferma', 'data fissata', 'a presto'],
      }),
      failureHandling: this.localize(lang, {
        en: 'If no slots available, ask for the next available date.',
        fr: 'Si aucun créneau disponible, demande la prochaine disponibilité.',
        es: 'Si no hay horarios disponibles, pregunta por la próxima fecha disponible.',
        de: 'Wenn keine Termine verfügbar sind, frage nach dem nächsten verfügbaren Datum.',
        it: 'Se non ci sono slot disponibili, chiedi la prossima data disponibile.',
      }),
      ivrTarget: this.localize(lang, {
        en: ['appointment', 'schedule', 'booking', 'reserve'],
        fr: ['rendez-vous', 'planning', 'réservation', 'prise de rdv'],
        es: ['cita', 'agenda', 'reserva', 'programar'],
        de: ['Termin', 'Planung', 'Reservierung', 'Buchung'],
        it: ['appuntamento', 'prenotazione', 'agenda', 'fissare'],
      }),
      maxAttempts: 2,
    };
  }

  private complainStrategy(lang: Language, company?: string): Strategy {
    const companyName = company || this.localize(lang, {
      en: 'this company',
      fr: 'cette entreprise',
      es: 'esta empresa',
      de: 'dieses Unternehmen',
      it: 'questa azienda',
    });

    return {
      type: 'complain',
      systemPrompt: this.localize(lang, {
        en: `You are calling ${companyName} to file a complaint. You want a refund or resolution.`,
        fr: `Tu appelles ${companyName} pour formuler une réclamation. Tu veux un remboursement ou une résolution.`,
        es: `Estás llamando a ${companyName} para presentar una queja. Quieres un reembolso o una resolución.`,
        de: `Du rufst bei ${companyName} an, um eine Beschwerde einzureichen. Du willst eine Erstattung oder Lösung.`,
        it: `Stai chiamando ${companyName} per presentare un reclamo. Vuoi un rimborso o una risoluzione.`,
      }),
      openingLine: this.localize(lang, {
        en: `Hi, I'm calling because I have an issue with my service that I'd like resolved.`,
        fr: `Bonjour, je vous appelle car j'ai un problème avec mon service et j'aimerais le résoudre.`,
        es: `Hola, llamo porque tengo un problema con mi servicio que me gustaría resolver.`,
        de: `Hallo, ich rufe an, weil ich ein Problem mit meinem Service habe, das ich gerne gelöst hätte.`,
        it: `Buongiorno, chiamo perché ho un problema con il mio servizio che vorrei risolvere.`,
      }),
      tactics: this.localize(lang, {
        en: [
          'Describe the issue clearly and factually',
          'Mention dates and references',
          'Request compensation or refund',
          'If refused → ask for a supervisor',
          'Note the case/ticket number',
          'Mention consumer rights if necessary',
        ],
        fr: [
          'Décris le problème clairement et factuellement',
          'Mentionne les dates et références',
          'Demande un geste commercial ou remboursement',
          'Si refus → demande un superviseur',
          'Note le numéro de dossier',
          'Mentionne tes droits de consommateur si nécessaire',
        ],
        es: [
          'Describe el problema clara y objetivamente',
          'Menciona fechas y referencias',
          'Solicita compensación o reembolso',
          'Si rechazan → pide un supervisor',
          'Anota el número de caso',
          'Menciona derechos del consumidor si es necesario',
        ],
        de: [
          'Beschreibe das Problem klar und sachlich',
          'Erwähne Daten und Referenzen',
          'Fordere Entschädigung oder Erstattung',
          'Bei Ablehnung → bitte um einen Vorgesetzten',
          'Notiere die Fallnummer',
          'Erwähne Verbraucherrechte wenn nötig',
        ],
        it: [
          'Descrivi il problema in modo chiaro e fattuale',
          'Menziona date e riferimenti',
          'Richiedi un risarcimento o rimborso',
          'Se rifiutano → chiedi un supervisore',
          'Annota il numero di pratica',
          'Menziona i diritti del consumatore se necessario',
        ],
      }),
      successCriteria: this.localize(lang, {
        en: ['refund', 'credit', 'case opened', 'resolved', 'compensation'],
        fr: ['remboursement', 'crédit', 'dossier ouvert', 'résolu', 'geste commercial'],
        es: ['reembolso', 'crédito', 'caso abierto', 'resuelto', 'compensación'],
        de: ['Erstattung', 'Gutschrift', 'Fall eröffnet', 'gelöst', 'Entschädigung'],
        it: ['rimborso', 'credito', 'pratica aperta', 'risolto', 'risarcimento'],
      }),
      failureHandling: this.localize(lang, {
        en: 'Note agent name and case number for escalation.',
        fr: 'Note le nom de l\'agent et le numéro de dossier pour escalader.',
        es: 'Anota el nombre del agente y número de caso para escalar.',
        de: 'Notiere den Namen des Agenten und die Fallnummer für die Eskalation.',
        it: 'Annota il nome dell\'operatore e il numero di pratica per l\'escalation.',
      }),
      ivrTarget: this.localize(lang, {
        en: ['complaint', 'dispute', 'problem', 'support', 'customer service'],
        fr: ['réclamation', 'plainte', 'problème', 'support', 'service client'],
        es: ['queja', 'reclamo', 'problema', 'soporte', 'atención al cliente'],
        de: ['Beschwerde', 'Reklamation', 'Problem', 'Support', 'Kundenservice'],
        it: ['reclamo', 'controversia', 'problema', 'supporto', 'servizio clienti'],
      }),
      maxAttempts: 3,
    };
  }

  private inquiryStrategy(lang: Language): Strategy {
    return {
      type: 'inquiry',
      systemPrompt: this.localize(lang, {
        en: `You are calling to get information. Ask clear questions and note the answers.`,
        fr: `Tu appelles pour obtenir des informations. Pose des questions claires et note les réponses.`,
        es: `Estás llamando para obtener información. Haz preguntas claras y anota las respuestas.`,
        de: `Du rufst an, um Informationen zu erhalten. Stelle klare Fragen und notiere die Antworten.`,
        it: `Stai chiamando per ottenere informazioni. Fai domande chiare e annota le risposte.`,
      }),
      openingLine: this.localize(lang, {
        en: `Hi, I have a question about my account, please.`,
        fr: `Bonjour, j'aurais une question concernant mon compte, s'il vous plaît.`,
        es: `Hola, tengo una pregunta sobre mi cuenta, por favor.`,
        de: `Hallo, ich habe eine Frage zu meinem Konto, bitte.`,
        it: `Buongiorno, avrei una domanda riguardo il mio conto, per favore.`,
      }),
      tactics: this.localize(lang, {
        en: ['Ask questions one at a time', 'Confirm information received'],
        fr: ['Pose tes questions une par une', 'Demande confirmation des informations reçues'],
        es: ['Haz las preguntas una a una', 'Confirma la información recibida'],
        de: ['Stelle Fragen einzeln', 'Bestätige erhaltene Informationen'],
        it: ['Fai le domande una alla volta', 'Conferma le informazioni ricevute'],
      }),
      successCriteria: this.localize(lang, {
        en: ['here is the information', 'noted', 'anything else'],
        fr: ['voici les informations', 'c\'est noté', 'avez-vous d\'autres questions'],
        es: ['aquí está la información', 'anotado', 'algo más'],
        de: ['hier sind die Informationen', 'notiert', 'noch etwas'],
        it: ['ecco le informazioni', 'annotato', 'altro'],
      }),
      failureHandling: this.localize(lang, {
        en: 'Ask to be called back or receive info by email.',
        fr: 'Demande à être rappelé ou à recevoir les infos par email.',
        es: 'Pide que te llamen o te envíen la información por email.',
        de: 'Bitte um Rückruf oder Infos per E-Mail.',
        it: 'Chiedi di essere richiamato o di ricevere le informazioni via email.',
      }),
      ivrTarget: this.localize(lang, {
        en: ['information', 'inquiry', 'question', 'help'],
        fr: ['information', 'renseignement', 'question', 'aide'],
        es: ['información', 'consulta', 'pregunta', 'ayuda'],
        de: ['Information', 'Anfrage', 'Frage', 'Hilfe'],
        it: ['informazione', 'richiesta', 'domanda', 'aiuto'],
      }),
      maxAttempts: 2,
    };
  }
}
