// ═══════════════════════════════════════
// NOPE. — Plugin System
// ═══════════════════════════════════════

import { CompanyInfo, Language, Strategy } from './types';

/** A NOPE plugin can extend strategies and companies */
export interface NopePlugin {
  name: string;
  version: string;
  strategies?: Record<string, (lang: Language, company?: string) => Strategy>;
  companies?: CompanyInfo[];
}
