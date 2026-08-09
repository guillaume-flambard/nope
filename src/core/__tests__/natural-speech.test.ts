import { describe, it, expect } from 'vitest';
import { getNaturalProfile, buildNaturalSpeechSection, naturalOpener } from '../natural-speech';

describe('natural-speech profiles', () => {
  it('has a full profile for every supported language', () => {
    for (const lang of ['en', 'fr', 'es', 'de', 'it'] as const) {
      const p = getNaturalProfile(lang);
      expect(p.fillers.length).toBeGreaterThan(3);
      expect(p.hedges.length).toBeGreaterThan(2);
      expect(p.disfluencies.length).toBeGreaterThan(1);
      expect(p.examples.length).toBeGreaterThanOrEqual(2);
      expect(p.cultural.length).toBeGreaterThan(20);
    }
  });

  it('builds a natural-speech section with per-language fillers and examples', () => {
    const en = buildNaturalSpeechSection('en', new Set());
    expect(en).toContain('NATURAL SPEECH (EN)');
    expect(en).toContain('EXAMPLES');
    expect(en).toMatch(/"[a-z]+"/i); // at least one quoted marker

    const fr = buildNaturalSpeechSection('fr', new Set());
    expect(fr).toContain('NATURAL SPEECH (FR)');
    expect(fr).toContain('EXAMPLES');
  });

  it('naturalOpener avoids repeating the same filler', () => {
    const used = new Set<string>();
    const first = naturalOpener('fr', used);
    const second = naturalOpener('fr', used);
    expect(used.has(first)).toBe(true);
    // two draws may be equal by randomness, but the pool must shrink
    expect(used.size).toBeGreaterThanOrEqual(2);
    expect(used.has(second)).toBe(true);
  });

  it('cultural notes are language-specific', () => {
    const de = getNaturalProfile('de').cultural;
    const fr = getNaturalProfile('fr').cultural;
    expect(de.toLowerCase()).toContain('direct');
    expect(fr.toLowerCase()).toContain('diplomatic');
  });
});
