// ═══════════════════════════════════════
// NOPE. — IVR Phone Menu Navigator
// ═══════════════════════════════════════

import { IVRHint, Language, StrategyType } from './types';

interface MenuOption {
  key: string;       // "1", "2", "0", "#"
  description: string;
}

interface IVRAnalysis {
  action: 'press_key' | 'speak' | 'wait' | 'press_zero';
  value: string;     // Key to press or words to say
  confidence: number;
  reason: string;
}

export class IVRNavigator {
  private menuHistory: string[] = [];
  private attemptCount = 0;
  private maxAttempts = 5;

  /** Analyze IVR prompt and decide what to do */
  analyze(
    prompt: string,
    goalType: StrategyType,
    language: Language,
    hints?: IVRHint[]
  ): IVRAnalysis {
    this.attemptCount++;
    this.menuHistory.push(prompt);

    // Check for known hints first
    if (hints && hints.length > 0) {
      const hintMatch = this.matchHint(prompt, hints);
      if (hintMatch) {
        return {
          action: 'press_key',
          value: hintMatch.keys,
          confidence: 0.95,
          reason: `Known shortcut: ${hintMatch.description}`,
        };
      }
    }

    // Detect language selection menu
    const langMenu = this.detectLanguageMenu(prompt, language);
    if (langMenu) return langMenu;

    // Parse menu options
    const options = this.parseMenuOptions(prompt, language);

    if (options.length > 0) {
      // Find best option for our goal
      const best = this.selectBestOption(options, goalType, language);
      if (best) {
        return {
          action: 'press_key',
          value: best.key,
          confidence: 0.8,
          reason: `Selected: "${best.description}"`,
        };
      }
    }

    // Detect menu loop (same menu repeated)
    if (this.detectRepeatMenu(prompt)) {
      return {
        action: 'press_zero',
        value: '0',
        confidence: 0.7,
        reason: 'Menu loop detected — pressing 0 for operator',
      };
    }

    // Safety: too many attempts, try to reach human
    if (this.attemptCount >= this.maxAttempts) {
      return this.reachHuman();
    }

    // Default: wait and listen
    return {
      action: 'wait',
      value: '',
      confidence: 0.5,
      reason: 'Listening for more options...',
    };
  }

  /** Match against known IVR hints */
  private matchHint(prompt: string, hints: IVRHint[]): IVRHint | undefined {
    const lower = prompt.toLowerCase();
    return hints.find(h =>
      lower.includes(h.description.toLowerCase()) ||
      h.description.toLowerCase().split(' ').every(w => lower.includes(w))
    );
  }

  /** Detect language selection menus */
  private detectLanguageMenu(prompt: string, targetLang: Language): IVRAnalysis | null {
    const lower = prompt.toLowerCase();

    const langPatterns: Record<Language, RegExp[]> = {
      fr: [
        /pour (le )?fran[cç]ais.+?(appuyez sur |tapez |faites le )(\d)/,
        /french.+?press (\d)/,
        /fran[cç]ais.+?(\d)/,
      ],
      en: [
        /for english.+?press (\d)/,
        /english.+?press (\d)/,
        /pour (l')?anglais.+?(\d)/,
      ],
      es: [
        /para espa[nñ]ol.+?(oprima|presione|marque) (\d)/,
        /spanish.+?press (\d)/,
      ],
      de: [
        /für deutsch.+?drücken sie (\d)/,
        /german.+?press (\d)/,
      ],
      it: [
        /per (l')?italiano.+?(prema|digiti) (\d)/,
        /italian.+?press (\d)/,
      ],
    };

    for (const pattern of (langPatterns[targetLang] || [])) {
      const match = lower.match(pattern);
      if (match) {
        const key = match[match.length - 1]; // Last capture group is the digit
        return {
          action: 'press_key',
          value: key,
          confidence: 0.95,
          reason: `Language menu — selecting ${targetLang}`,
        };
      }
    }

    return null;
  }

  /** Parse "Press X for Y" patterns */
  parseMenuOptions(prompt: string, language: Language): MenuOption[] {
    const options: MenuOption[] = [];
    const lower = prompt.toLowerCase();

    // English patterns
    const enPatterns = [
      /(?:press|dial|type)\s+(\d+|pound|star|hash)\s+(?:for|to)\s+(.+?)(?:\.|,|$)/gi,
      /for\s+(.+?),?\s+(?:press|dial|type)\s+(\d+|pound|star|hash)/gi,
    ];

    // French patterns
    const frPatterns = [
      /(?:appuyez|tapez|faites le)\s+(?:sur\s+)?(?:la touche\s+)?(\d+|étoile|dièse)\s+(?:pour|si)\s+(.+?)(?:\.|,|$)/gi,
      /pour\s+(.+?),?\s+(?:appuyez|tapez|faites le)\s+(?:sur\s+)?(\d+|étoile|dièse)/gi,
    ];

    // Italian patterns
    const itPatterns = [
      /(?:prema|digiti|premi)\s+(?:il\s+)?(\d+|cancelletto|asterisco)\s+(?:per)\s+(.+?)(?:\.|,|$)/gi,
      /per\s+(.+?),?\s+(?:prema|digiti|premi)\s+(?:il\s+)?(\d+|cancelletto|asterisco)/gi,
    ];

    // Spanish patterns
    const esPatterns = [
      /(?:presione|marque|oprima)\s+(?:el\s+)?(\d+|almohadilla|asterisco)\s+(?:para)\s+(.+?)(?:\.|,|$)/gi,
      /para\s+(.+?),?\s+(?:presione|marque|oprima)\s+(?:el\s+)?(\d+|almohadilla|asterisco)/gi,
    ];

    // German patterns
    const dePatterns = [
      /(?:drücken sie|wählen sie|drücke)\s+(?:die\s+)?(\d+|raute|stern)\s+(?:für)\s+(.+?)(?:\.|,|$)/gi,
      /für\s+(.+?),?\s+(?:drücken sie|wählen sie|drücke)\s+(?:die\s+)?(\d+|raute|stern)/gi,
    ];

    const patternMap: Record<Language, RegExp[]> = {
      en: enPatterns,
      fr: frPatterns,
      es: esPatterns,
      de: dePatterns,
      it: itPatterns,
    };
    const patterns = patternMap[language] || enPatterns;

    // Prepositions meaning "for" in each language (used for prefix detection)
    const forPrepositions = ['for', 'pour', 'per', 'para', 'für'];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        // Handle both "press X for Y" and "for Y press X" patterns
        const startsWithFor = forPrepositions.some(p => match![0].toLowerCase().startsWith(p));
        if (startsWithFor) {
          options.push({ key: match[2], description: match[1].trim() });
        } else {
          options.push({ key: match[1], description: match[2].trim() });
        }
      }
    }

    return options;
  }

  /** Select the best menu option for our goal */
  private selectBestOption(options: MenuOption[], goalType: StrategyType, lang: Language): MenuOption | undefined {
    const keywords: Record<StrategyType, Record<Language, string[]>> = {
      cancel: {
        en: ['cancel', 'close', 'terminate', 'end', 'account', 'subscription', 'billing'],
        fr: ['résili', 'annul', 'clôtur', 'ferme', 'compte', 'abonnement', 'factur'],
        es: ['cancelar', 'anular', 'cerrar', 'cuenta', 'suscripción'],
        de: ['kündigen', 'stornieren', 'konto', 'abonnement'],
        it: ['cancellare', 'disdire', 'chiudere', 'account', 'abbonamento', 'fattura'],
      },
      negotiate: {
        en: ['billing', 'account', 'payment', 'invoice', 'plans', 'pricing'],
        fr: ['factur', 'paiement', 'compte', 'tarif', 'forfait', 'offre'],
        es: ['factura', 'pago', 'cuenta', 'tarifa', 'plan'],
        de: ['rechnung', 'zahlung', 'konto', 'tarif'],
        it: ['fattura', 'pagamento', 'conto', 'tariffa', 'piano', 'offerta'],
      },
      appointment: {
        en: ['appointment', 'schedule', 'booking', 'service', 'visit'],
        fr: ['rendez-vous', 'rdv', 'planifi', 'réserv', 'visite'],
        es: ['cita', 'reserva', 'servicio', 'visita'],
        de: ['termin', 'reservierung', 'service', 'besuch'],
        it: ['appuntamento', 'prenotazione', 'servizio', 'visita'],
      },
      inquiry: {
        en: ['information', 'question', 'other', 'general', 'support', 'help'],
        fr: ['information', 'question', 'autre', 'général', 'aide', 'renseignement'],
        es: ['información', 'pregunta', 'otro', 'general', 'ayuda'],
        de: ['information', 'frage', 'andere', 'allgemein', 'hilfe'],
        it: ['informazione', 'domanda', 'altro', 'generale', 'supporto', 'aiuto'],
      },
      complain: {
        en: ['complaint', 'dispute', 'refund', 'problem', 'issue', 'support'],
        fr: ['réclam', 'litige', 'rembours', 'problème', 'plainte', 'support'],
        es: ['queja', 'reclamo', 'reembolso', 'problema', 'soporte'],
        de: ['beschwerde', 'reklamation', 'erstattung', 'problem', 'support'],
        it: ['reclamo', 'controversia', 'rimborso', 'problema', 'supporto'],
      },
    };

    const goalKeywords = keywords[goalType][lang] || keywords[goalType].en;

    // Score each option
    let bestScore = 0;
    let bestOption: MenuOption | undefined;

    for (const option of options) {
      const desc = option.description.toLowerCase();
      let score = 0;

      for (const keyword of goalKeywords) {
        if (desc.includes(keyword)) score += 10;
      }

      // Boost "other" or "agent" options slightly
      if (desc.includes('other') || desc.includes('autre') || desc.includes('agent')) {
        score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    return bestOption;
  }

  /** Detect if we're stuck in a menu loop */
  private detectRepeatMenu(prompt: string): boolean {
    if (this.menuHistory.length < 3) return false;

    const current = prompt.toLowerCase().trim();
    const previous = this.menuHistory.slice(-3, -1);

    // Check similarity with recent menus
    return previous.some(prev => {
      const similarity = this.stringSimilarity(current, prev.toLowerCase().trim());
      return similarity > 0.8;
    });
  }

  /** Simple string similarity (Jaccard on words) */
  private stringSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /** Emergency: try to reach a human operator */
  reachHuman(): IVRAnalysis {
    return {
      action: 'press_zero',
      value: '0',
      confidence: 0.6,
      reason: 'Attempting to reach human operator (press 0)',
    };
  }

  /** Reset state for a new call */
  reset(): void {
    this.menuHistory = [];
    this.attemptCount = 0;
  }
}
