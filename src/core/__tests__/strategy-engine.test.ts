import { describe, it, expect } from 'vitest';
import { StrategyEngine } from '../strategy-engine';

const engine = new StrategyEngine();

describe('StrategyEngine', () => {
  // ── Strategy types ──

  it('returns cancel strategy', () => {
    const s = engine.getStrategy('cancel', 'en', 'Netflix');
    expect(s.type).toBe('cancel');
    expect(s.systemPrompt).toContain('CANCEL');
    expect(s.tactics.length).toBeGreaterThan(0);
    expect(s.maxAttempts).toBeGreaterThan(0);
  });

  it('returns negotiate strategy', () => {
    const s = engine.getStrategy('negotiate', 'en', 'Comcast');
    expect(s.type).toBe('negotiate');
    expect(s.systemPrompt).toContain('NEGOTIATE');
  });

  it('returns appointment strategy', () => {
    const s = engine.getStrategy('appointment', 'en');
    expect(s.type).toBe('appointment');
  });

  it('returns complain strategy', () => {
    const s = engine.getStrategy('complain', 'en', 'Adobe');
    expect(s.type).toBe('complain');
  });

  it('returns inquiry strategy for unknown types', () => {
    const s = engine.getStrategy('inquiry', 'en');
    expect(s.type).toBe('inquiry');
  });

  // ── Language support ──

  it('generates French cancel strategy', () => {
    const s = engine.getStrategy('cancel', 'fr', 'Netflix');
    expect(s.systemPrompt).toContain('RÉSILIER');
    expect(s.openingLine).toContain('résilier');
  });

  it('generates English cancel strategy', () => {
    const s = engine.getStrategy('cancel', 'en', 'Netflix');
    expect(s.openingLine).toContain('cancel');
  });

  // ── Company name in prompt ──

  it('includes company name in system prompt', () => {
    const s = engine.getStrategy('cancel', 'en', 'Netflix');
    expect(s.systemPrompt).toContain('Netflix');
  });

  it('uses fallback when no company provided', () => {
    const s = engine.getStrategy('cancel', 'en');
    expect(s.systemPrompt).toContain('this company');
  });

  // ── Strategy structure ──

  it('has all required fields', () => {
    const s = engine.getStrategy('cancel', 'en');
    expect(s.type).toBeDefined();
    expect(s.systemPrompt).toBeDefined();
    expect(s.openingLine).toBeDefined();
    expect(s.tactics).toBeInstanceOf(Array);
    expect(s.successCriteria).toBeInstanceOf(Array);
    expect(s.failureHandling).toBeDefined();
    expect(s.ivrTarget).toBeInstanceOf(Array);
    expect(typeof s.maxAttempts).toBe('number');
  });

  it('has IVR targets for goal routing', () => {
    const s = engine.getStrategy('cancel', 'en');
    expect(s.ivrTarget.length).toBeGreaterThan(0);
    expect(s.ivrTarget.some(t => t.includes('cancel'))).toBe(true);
  });
});
