// ═══════════════════════════════════════
// NOPE. — Company Phone Number Finder
// ═══════════════════════════════════════

import { CompanyInfo, Language } from '../core/types';

/** Directory of known companies with customer service numbers */
const DIRECTORY: CompanyInfo[] = [
  // ── Streaming ──
  { name: 'Netflix', phone: '+1-844-505-2993', country: 'US', category: 'streaming', language: 'en', tips: 'Say "cancel" to skip the IVR' },
  { name: 'Netflix', phone: '+33-805-220-512', country: 'FR', category: 'streaming', language: 'fr', tips: 'Gratuit depuis un fixe' },
  { name: 'Spotify', phone: '+1-800-952-5210', country: 'US', category: 'streaming', language: 'en' },
  { name: 'Disney+', phone: '+1-888-905-7888', country: 'US', category: 'streaming', language: 'en' },
  { name: 'Canal+', phone: '+33-890-090-900', country: 'FR', category: 'streaming', language: 'fr', tips: 'Tapez 2 puis 3 pour résiliation' },
  { name: 'OCS', phone: '+33-1-76-49-93-63', country: 'FR', category: 'streaming', language: 'fr' },
  { name: 'Hulu', phone: '+1-888-265-6650', country: 'US', category: 'streaming', language: 'en' },
  { name: 'HBO Max', phone: '+1-855-442-6629', country: 'US', category: 'streaming', language: 'en' },
  { name: 'Apple TV+', phone: '+1-800-275-2273', country: 'US', category: 'streaming', language: 'en' },
  { name: 'YouTube Premium', phone: '+1-855-836-3987', country: 'US', category: 'streaming', language: 'en' },
  { name: 'Deezer', phone: '+33-1-55-80-69-00', country: 'FR', category: 'streaming', language: 'fr' },

  // ── Telecom (FR) ──
  { name: 'SFR', phone: '+33-1023', country: 'FR', category: 'telecom', language: 'fr', tips: 'Tapez 4 puis 2 pour résiliation' },
  { name: 'Orange', phone: '+33-3900', country: 'FR', category: 'telecom', language: 'fr', tips: 'Dites "résilier" au serveur vocal' },
  { name: 'Free', phone: '+33-3244', country: 'FR', category: 'telecom', language: 'fr' },
  { name: 'Bouygues', phone: '+33-1064', country: 'FR', category: 'telecom', language: 'fr' },

  // ── Telecom (US) ──
  { name: 'Comcast', phone: '+1-800-934-6489', country: 'US', category: 'telecom', language: 'en', tips: 'Say "cancel service" immediately' },
  { name: 'Xfinity', phone: '+1-800-934-6489', country: 'US', category: 'telecom', language: 'en' },
  { name: 'AT&T', phone: '+1-800-288-2020', country: 'US', category: 'telecom', language: 'en' },
  { name: 'Verizon', phone: '+1-800-922-0204', country: 'US', category: 'telecom', language: 'en' },
  { name: 'T-Mobile', phone: '+1-800-937-8997', country: 'US', category: 'telecom', language: 'en' },

  // ── Telecom (UK) ──
  { name: 'Sky UK', phone: '+44-333-759-1018', country: 'UK', category: 'telecom', language: 'en', tips: 'Say "cancel" to reach retention' },
  { name: 'BT', phone: '+44-800-800-150', country: 'UK', category: 'telecom', language: 'en' },
  { name: 'Virgin Media', phone: '+44-345-454-1111', country: 'UK', category: 'telecom', language: 'en' },
  { name: 'EE', phone: '+44-800-956-6000', country: 'UK', category: 'telecom', language: 'en' },
  { name: 'Three', phone: '+44-333-338-1001', country: 'UK', category: 'telecom', language: 'en' },

  // ── Telecom (DE) ──
  { name: 'Deutsche Telekom', phone: '+49-800-330-1000', country: 'DE', category: 'telecom', language: 'de', tips: 'Sagen Sie "Kündigung" im Sprachmenü' },
  { name: 'Vodafone', phone: '+49-800-172-1212', country: 'DE', category: 'telecom', language: 'de' },
  { name: 'O2', phone: '+49-176-888-55222', country: 'DE', category: 'telecom', language: 'de' },
  { name: '1&1', phone: '+49-721-9600', country: 'DE', category: 'telecom', language: 'de' },

  // ── Telecom (ES) ──
  { name: 'Movistar', phone: '+34-1004', country: 'ES', category: 'telecom', language: 'es', tips: 'Diga "baja" para llegar a retención' },
  { name: 'Vodafone', phone: '+34-607-100-700', country: 'ES', category: 'telecom', language: 'es' },
  { name: 'Orange', phone: '+34-900-901-901', country: 'ES', category: 'telecom', language: 'es' },
  { name: 'Jazztel', phone: '+34-1566', country: 'ES', category: 'telecom', language: 'es' },

  // ── Telecom (IT) ──
  { name: 'TIM', phone: '+39-187', country: 'IT', category: 'telecom', language: 'it', tips: 'Premere 2 per assistenza commerciale' },
  { name: 'Vodafone', phone: '+39-190', country: 'IT', category: 'telecom', language: 'it' },
  { name: 'WindTre', phone: '+39-159', country: 'IT', category: 'telecom', language: 'it' },
  { name: 'Fastweb', phone: '+39-192-193', country: 'IT', category: 'telecom', language: 'it' },

  // ── Energy (FR) ──
  { name: 'EDF', phone: '+33-3004', country: 'FR', category: 'energy', language: 'fr' },
  { name: 'Engie', phone: '+33-969-324-324', country: 'FR', category: 'energy', language: 'fr' },
  { name: 'TotalEnergies', phone: '+33-969-391-781', country: 'FR', category: 'energy', language: 'fr' },

  // ── Energy (ES) ──
  { name: 'Endesa', phone: '+34-800-760-909', country: 'ES', category: 'energy', language: 'es' },

  // ── Energy (IT) ──
  { name: 'Enel', phone: '+39-800-900-860', country: 'IT', category: 'energy', language: 'it' },

  // ── Insurance (FR) ──
  { name: 'AXA', phone: '+33-969-390-390', country: 'FR', category: 'insurance', language: 'fr' },
  { name: 'Allianz', phone: '+33-1-58-85-00-00', country: 'FR', category: 'insurance', language: 'fr' },
  { name: 'MAIF', phone: '+33-969-397-397', country: 'FR', category: 'insurance', language: 'fr' },
  { name: 'Groupama', phone: '+33-800-106-800', country: 'FR', category: 'insurance', language: 'fr' },

  // ── Insurance (DE) ──
  { name: 'Check24', phone: '+49-89-2000-47050', country: 'DE', category: 'insurance', language: 'de' },

  // ── Software ──
  { name: 'Adobe', phone: '+1-800-833-6687', country: 'US', category: 'software', language: 'en', tips: 'Press 3 for subscription, then 2 for cancel' },
  { name: 'Microsoft', phone: '+1-800-642-7676', country: 'US', category: 'software', language: 'en' },
  { name: 'Dropbox', phone: '+1-415-986-7057', country: 'US', category: 'software', language: 'en' },

  // ── Fitness ──
  { name: 'Planet Fitness', phone: '+1-844-880-7180', country: 'US', category: 'fitness', language: 'en' },
  { name: 'Basic Fit', phone: '+33-1-46-10-14-14', country: 'FR', category: 'fitness', language: 'fr' },

  // ── Food Delivery ──
  { name: 'Uber Eats', phone: '+1-800-253-9377', country: 'US', category: 'delivery', language: 'en' },
  { name: 'Deliveroo', phone: '+33-9-70-83-19-00', country: 'FR', category: 'delivery', language: 'fr' },
  { name: 'DoorDash', phone: '+1-855-973-1040', country: 'US', category: 'delivery', language: 'en' },
];

export class CompanyFinder {
  private extraCompanies: CompanyInfo[] = [];

  /** Register additional companies (from plugins) */
  registerCompanies(companies: CompanyInfo[]): void {
    this.extraCompanies.push(...companies);
  }

  /** Get the full search pool (plugin companies + directory) */
  private getSearchPool(): CompanyInfo[] {
    // Plugin companies come first so they take priority
    return [...this.extraCompanies, ...DIRECTORY];
  }

  /** Find a company by name */
  async find(query: string, preferredCountry?: string): Promise<CompanyInfo | undefined> {
    const lower = query.toLowerCase();
    const pool = this.getSearchPool();

    // ── Exact match ──
    let match = pool.find(c =>
      c.name.toLowerCase() === lower ||
      lower.includes(c.name.toLowerCase())
    );

    if (match) {
      // Prefer matching country if multiple entries
      if (preferredCountry) {
        const countryMatch = pool.find(c =>
          c.name.toLowerCase() === match!.name.toLowerCase() &&
          c.country === preferredCountry
        );
        if (countryMatch) return countryMatch;
      }
      return match;
    }

    // ── Fuzzy match ──
    match = pool.find(c => {
      const name = c.name.toLowerCase();
      return lower.includes(name) || name.includes(lower) ||
             this.levenshtein(lower, name) <= 2;
    });

    if (match) return match;

    // ── Web search fallback ──
    return await this.searchWeb(query);
  }

  /** Search the web for a company's phone number */
  private async searchWeb(query: string): Promise<CompanyInfo | undefined> {
    try {
      const cheerio = await import('cheerio');
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' customer service phone number')}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const html = await response.text();
      const $ = cheerio.load(html);
      const text = $('body').text();

      // Extract phone numbers from results
      const phoneRegex = /(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;
      const phones = text.match(phoneRegex);

      if (phones && phones.length > 0) {
        // Filter for likely customer service numbers
        const validPhone = phones.find(p => p.replace(/\D/g, '').length >= 10);
        if (validPhone) {
          return {
            name: query,
            phone: validPhone,
            country: validPhone.startsWith('+33') ? 'FR' : 'US',
            category: 'unknown',
            language: validPhone.startsWith('+33') ? 'fr' : 'en',
          };
        }
      }
    } catch (err) {
      // Search failed — return undefined
    }

    return undefined;
  }

  /** List all companies in directory (including plugin companies) */
  list(): CompanyInfo[] {
    return [...this.getSearchPool()];
  }

  /** Get unique company names */
  listNames(): string[] {
    return [...new Set(this.getSearchPool().map(c => c.name))].sort();
  }

  /** Simple Levenshtein distance */
  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  }
}
