import { describe, it, expect } from 'vitest';
import { VoicePipeline } from '../voice-pipeline';

const strategy: any = { type: 'cancel', systemPrompt: 'You are canceling a subscription.', tactics: [] };

describe('identity handling (edge cases)', () => {
  it('instructs the LLM to NEVER invent a name when no NOPE_NAME is set', () => {
    const p = new VoicePipeline({ language: 'en' });
    const sys = p.buildSystemPrompt(strategy, { company: 'Netflix', history: [] });
    expect(sys).toContain('NEVER invent one');
    expect(sys).toContain('deflect politely');
  });

  it('instructs in French to never invent a name', () => {
    const p = new VoicePipeline({ language: 'fr' });
    const sys = p.buildSystemPrompt(strategy, { company: 'Canal+', history: [] });
    expect(sys).toContain("ne l'invente JAMAIS");
    expect(sys).toContain('esquive poliment');
  });

  it('uses NOPE_NAME when configured', () => {
    process.env.NOPE_NAME = 'Emma Wilson';
    const p = new VoicePipeline({ language: 'en' });
    const sys = p.buildSystemPrompt(strategy, { company: 'Netflix', history: [] });
    expect(sys).toContain('YOUR NAME IS Emma Wilson');
    delete process.env.NOPE_NAME;
  });

  it('prompt covers the repeated-reason and price edge cases', () => {
    const p = new VoicePipeline({ language: 'en' });
    const sys = p.buildSystemPrompt(strategy, { company: 'Netflix', history: [] });
    expect(sys).toMatch(/price|date|condition/i);
    expect(sys).toMatch(/never the same|never repeat/i);
  });
});
