import { describe, it, expect } from 'vitest';
import { AgentVoice, accountEnding } from '../agent-voice';

describe('agent-voice', () => {
  it('produces a varied opening per language', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const av = new AgentVoice('en');
      seen.add(av.opening('Netflix', 'Sarah'));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('produces agent lines in every supported language', () => {
    for (const lang of ['en', 'fr', 'es', 'de', 'it'] as const) {
      const av = new AgentVoice(lang);
      expect(av.opening('Netflix', 'X').length).toBeGreaterThan(10);
      expect(av.askWhy().length).toBeGreaterThan(10);
      expect(av.offer().length).toBeGreaterThan(10);
      expect(av.confirm('NP-ABC123').length).toBeGreaterThan(10);
      expect(av.question('4821').length).toBeGreaterThan(10);
    }
  });

  it('substitutes variables in confirm/question lines', () => {
    const av = new AgentVoice('en');
    expect(av.confirm('NP-ABC123')).toContain('NP-ABC123');
    expect(av.question('4821')).toContain('4821');
  });

  it('accountEnding returns a 4-digit string', () => {
    for (let i = 0; i < 50; i++) {
      const e = accountEnding();
      expect(e).toMatch(/^\d{4}$/);
    }
  });
});
