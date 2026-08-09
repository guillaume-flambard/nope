// ═══════════════════════════════════════
// NOPE. — Human Agent Voice (simulation side)
// Gives the simulated customer-service agent varied, human-sounding
// replies and a basic "rebound" on what NOPE just said — so the
// 2-voice dialogue doesn't sound like a scripted ping-pong.
// ═══════════════════════════════════════

import { Language } from './types';

interface AgentScript {
  openings: string[];
  askWhy: string[];
  offers: string[];
  relents: string[];     // after NOPE declines
  confirms: string[];    // success + reference
  questions: string[];   // identity / account checks
}

const SCRIPTS: Record<Language, AgentScript> = {
  en: {
    openings: [
      'Hello, this is {agent} from {company}. How can I help you today?',
      'Hi, you\'re through to {company}, this is {agent}. What can I do for you?',
      'Thanks for calling {company}, {agent} speaking. How may I help?',
    ],
    askWhy: [
      'I understand. Can I ask what the reason is? We might be able to help.',
      'Oh, I see. Just so I understand — is there a particular reason?',
      'Before we go ahead, would you mind telling me why? There might be something we can do.',
    ],
    offers: [
      'Actually, before you go — what if we offered you a discount on your current plan?',
      'Wait, let me see what I can do. I might be able to offer you a better deal.',
      'Hmm, let me check... we do have a retention offer I could apply to your account.',
    ],
    relents: [
      'Okay, I understand. I\'ll process that for you now.',
      'Alright, of course. Let me take care of that for you.',
      'Understood. I\'ll go ahead and set that up.',
    ],
    confirms: [
      'Perfect. I\'ve done that — your reference is {ref}. Is there anything else?',
      'Done. The reference number is {ref}. Thank you for your patience.',
      'All set. Your confirmation reference is {ref}. Anything else I can help with?',
    ],
    questions: [
      'Of course. And just to confirm, this is the account ending in {digits}, right?',
      'Sure. Can you confirm the name on the account for security, and that it ends in {digits}?',
      'Got it. And just so I have it right — the account ending in {digits}, and is there anyone else on this plan I should be aware of?',
    ],
  },
  fr: {
    openings: [
      'Bonjour, {agent} du service client {company}. Comment puis-je vous aider ?',
      'Bien le bonjour, ici {agent} de {company}. En quoi puis-je vous aider ?',
      'Merci d\'avoir appelé {company}, {agent} à l\'appareil. Comment puis-je vous renseigner ?',
    ],
    askWhy: [
      'Je comprends. Puis-je vous demander la raison ? Nous pourrions peut-être vous aider.',
      'Ah, je vois. Juste pour bien comprendre — c\'est pour quelle raison ?',
      'Avant d\'aller plus loin, vous me dites ce qui vous pousse à partir ? On a peut-être une solution.',
    ],
    offers: [
      'En fait, avant que vous ne partiez — et si on vous proposait une remise sur votre forfait actuel ?',
      'Attendez, laissez-moi voir ce que je peux faire. Je pourrais peut-être vous obtenir un meilleur tarif.',
      'Bon, voyons ça... on a une offre de fidélité que je pourrais appliquer sur votre compte.',
    ],
    relents: [
      'D\'accord, je comprends. Je m\'en occupe tout de suite.',
      'Très bien, bien sûr. Je vous règle ça.',
      'C\'est noté. Je vous fais ça maintenant.',
    ],
    confirms: [
      'Parfait, c\'est fait. Votre référence est {ref}. Autre chose ?',
      'Voilà, c\'est réglé. Le numéro de référence est {ref}. Merci de votre patience.',
      'Tout est en ordre. Votre référence de confirmation : {ref}. Puis-je vous aider pour autre chose ?',
    ],
    questions: [
      'Bien sûr. Juste pour confirmer, c\'est bien le compte qui se termine par {digits} ?',
      'Oui. Vous me confirmez le nom sur le compte, pour la sécurité ?',
      'D\'accord. Et y a-t-il d\'autres personnes sur ce forfait dont je devrais tenir compte ?',
    ],
  },
  es: {
    openings: [
      'Hola, le atiende {agent} de {company}. ¿En qué puedo ayudarle?',
      'Buenas, habla {agent} de {company}. ¿Cómo puedo ayudarle?',
      'Gracias por llamar a {company}, soy {agent}. ¿En qué le sirvo?',
    ],
    askWhy: [
      'Entiendo. ¿Puedo preguntarle el motivo? Quizás podamos ayudarle.',
      'Ah, ya veo. Solo para entender — ¿hay alguna razón en particular?',
      'Antes de continuar, ¿me dice por qué? A lo mejor tenemos una solución.',
    ],
    offers: [
      'Antes de que se vaya — ¿y si le ofrecemos un descuento en su plan actual?',
      'Espere, déjeme ver qué puedo hacer. Quizás consiga un mejor precio.',
      'Déjeme revisar... tenemos una oferta de retención que podría aplicar a su cuenta.',
    ],
    relents: [
      'De acuerdo, entiendo. Lo proceso ahora mismo.',
      'Claro, por supuesto. Me encargo de eso.',
      'Entendido. Lo dejo listo ahora.',
    ],
    confirms: [
      'Perfecto, está hecho. Su referencia es {ref}. ¿Algo más?',
      'Listo. El número de referencia es {ref}. Gracias por su paciencia.',
      'Todo en orden. Su referencia de confirmación: {ref}. ¿Puedo ayudarle en algo más?',
    ],
    questions: [
      'Claro. Solo para confirmar, ¿es la cuenta que termina en {digits}, verdad?',
      'Sí. ¿Me confirma el nombre de la cuenta, por seguridad?',
      'Bien. ¿Y hay alguien más en este plan que deba tener en cuenta?',
    ],
  },
  de: {
    openings: [
      'Guten Tag, {agent} vom {company}-Kundenservice. Wie kann ich Ihnen helfen?',
      'Hallo, hier ist {agent} von {company}. Wie kann ich Ihnen behilflich sein?',
      'Danke für Ihren Anruf bei {company}, mein Name ist {agent}. Womit kann ich helfen?',
    ],
    askWhy: [
      'Ich verstehe. Darf ich nach dem Grund fragen? Vielleicht können wir helfen.',
      'Ah, verstehe. Nur um es zu verstehen — aus welchem Grund?',
      'Bevor wir weitermachen, sagen Sie mir bitte warum? Vielleicht haben wir eine Lösung.',
    ],
    offers: [
      'Bevor Sie gehen — was, wenn wir Ihnen einen Rabatt auf Ihren aktuellen Tarif anbieten?',
      'Moment, lassen Sie mich sehen, was ich tun kann. Vielleicht bekomme ich einen besseren Preis.',
      'Lassen Sie mich prüfen... wir haben ein Rückhalteangebot, das ich auf Ihr Konto anwenden könnte.',
    ],
    relents: [
      'Okay, ich verstehe. Ich erledige das jetzt für Sie.',
      'Gut, selbstverständlich. Ich kümmere mich darum.',
      'Verstanden. Ich richte das jetzt ein.',
    ],
    confirms: [
      'Perfekt, erledigt. Ihre Referenz ist {ref}. Noch etwas?',
      'Fertig. Die Referenznummer ist {ref}. Danke für Ihre Geduld.',
      'Alles in Ordnung. Ihre Bestätigungsreferenz: {ref}. Kann ich sonst noch helfen?',
    ],
    questions: [
      'Natürlich. Nur zur Bestätigung — ist das das Konto mit der Endung {digits}?',
      'Ja. Können Sie mir den Namen auf dem Konto zur Sicherheit bestätigen?',
      'Gut. Und ist noch jemand in diesem Tarif, den ich berücksichtigen sollte?',
    ],
  },
  it: {
    openings: [
      'Buongiorno, sono {agent} del servizio clienti {company}. Come posso aiutarla?',
      'Salve, parla {agent} di {company}. In che modo posso esserle utile?',
      'Grazie per aver chiamato {company}, sono {agent}. Come posso aiutarla?',
    ],
    askWhy: [
      'Capisco. Posso chiederle il motivo? Forse possiamo aiutarla.',
      'Ah, vedo. Solo per capire — c\'è una ragione particolare?',
      'Prima di procedere, mi dice perché? Magari abbiamo una soluzione.',
    ],
    offers: [
      'Prima che vada via — e se le offrissimo uno sconto sul suo piano attuale?',
      'Aspetti, vediamo cosa posso fare. Forse riesco a ottenere un prezzo migliore.',
      'Mi faccia controllare... abbiamo un\'offerta di retention che potrei applicare al suo conto.',
    ],
    relents: [
      'Va bene, capisco. La sistemo subito.',
      'Certamente, mi occupo io di questo.',
      'Ricevuto. Lo preparo adesso.',
    ],
    confirms: [
      'Perfetto, è fatto. Il suo riferimento è {ref}. Altro?',
      'Fatto. Il numero di riferimento è {ref}. Grazie per la pazienza.',
      'Tutto in ordine. Il suo riferimento di conferma: {ref}. Posso aiutarla in altro?',
    ],
    questions: [
      'Certamente. Solo per confermare, è il conto che termina con {digits}, vero?',
      'Sì. Mi conferma il nome sul conto, per sicurezza?',
      'Bene. E c\'è qualcun altro su questo piano di cui dovrei tener conto?',
    ],
  },
};

/** Pick a random line from a list, avoiding the last-used index. */
function pick<T>(list: T[], avoid: number): T {
  if (list.length <= 1) return list[0];
  let i = Math.floor(Math.random() * list.length);
  while (i === avoid) i = Math.floor(Math.random() * list.length);
  return list[i];
}

export class AgentVoice {
  private avoid = -1;

  constructor(private lang: Language) {}

  private s(): AgentScript {
    return SCRIPTS[this.lang] || SCRIPTS.en;
  }

  private line(keys: (keyof AgentScript)[], vars: Record<string, string>): string {
    const pool = this.s();
    let line: string = '';
    for (let i = 0; i < 5; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      line = pool[k][Math.floor(Math.random() * pool[k].length)];
      if (line !== undefined && line.length > 0) break;
    }
    // If we somehow have a stale same-line repeat, shuffle once more.
    for (const [key, val] of Object.entries(vars)) {
      line = line.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    return line;
  }

  opening(company: string, agent: string): string {
    return this.line(['openings'], { agent, company });
  }

  askWhy(): string {
    return this.line(['askWhy'], {});
  }

  offer(): string {
    return this.line(['offers'], {});
  }

  relent(): string {
    return this.line(['relents'], {});
  }

  confirm(ref: string): string {
    return this.line(['confirms'], { ref });
  }

  question(digits: string): string {
    return this.line(['questions'], { digits });
  }
}

/** Last 4 digits of a plausible account number. */
export function accountEnding(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}
