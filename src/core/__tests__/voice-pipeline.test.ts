import { describe, it, expect } from 'vitest';
import { VoicePipeline } from '../voice-pipeline';

const pipeline = new VoicePipeline({ language: 'en' });

describe('VoicePipeline.detectAction', () => {
  // ── Hold detection ──

  it('detects "your call is important"', () => {
    expect(pipeline.detectAction('Your call is important to us')).toBe('hold_message');
  });

  it('detects "please hold"', () => {
    expect(pipeline.detectAction('Please hold while we connect you')).toBe('hold_message');
  });

  it('detects French hold message', () => {
    expect(pipeline.detectAction('Veuillez patienter, un conseiller va prendre votre appel')).toBe('hold_message');
  });

  it('detects estimated wait', () => {
    expect(pipeline.detectAction('Estimated wait time is 5 minutes')).toBe('hold_message');
  });

  // ── IVR menu detection ──

  it('detects "press 1 for..."', () => {
    expect(pipeline.detectAction('Press 1 for billing')).toBe('ivr_menu');
  });

  it('detects "for X, press Y"', () => {
    expect(pipeline.detectAction('For cancellations, press 3')).toBe('ivr_menu');
  });

  it('detects French IVR', () => {
    expect(pipeline.detectAction('Appuyez sur 2 pour la facturation')).toBe('ivr_menu');
  });

  // ── Transfer detection ──

  it('detects transfer', () => {
    expect(pipeline.detectAction('Transferring your call to billing')).toBe('transfer');
  });

  it('detects French transfer', () => {
    expect(pipeline.detectAction('Je vous transfère au service concerné')).toBe('transfer');
  });

  // ── Success detection ──

  it('detects cancellation confirmed', () => {
    expect(pipeline.detectAction('Your cancellation has been confirmed')).toBe('success');
  });

  it('detects confirmation number', () => {
    expect(pipeline.detectAction('Your confirmation number is NP-12345')).toBe('success');
  });

  it('detects French cancellation', () => {
    expect(pipeline.detectAction('Votre résiliation a été confirmée')).toBe('success');
  });

  // ── Human agent detection ──

  it('detects human agent greeting', () => {
    expect(pipeline.detectAction('My name is Sarah, how can I help you today?')).toBe('human_agent');
  });

  it('detects French agent greeting', () => {
    expect(pipeline.detectAction('Bonjour, je suis Marie du service client')).toBe('human_agent');
  });

  // ── No action ──

  it('returns undefined for normal speech', () => {
    expect(pipeline.detectAction('What is your account number?')).toBeUndefined();
  });

  it('returns undefined for random text', () => {
    expect(pipeline.detectAction('The weather is nice today')).toBeUndefined();
  });
});

describe('VoicePipeline.buildSystemPrompt', () => {
  it('includes company name', () => {
    const prompt = pipeline.buildSystemPrompt(
      { type: 'cancel', systemPrompt: 'Cancel test', openingLine: '', tactics: ['be firm'], successCriteria: [], failureHandling: '', ivrTarget: [], maxAttempts: 3 },
      { company: 'Netflix', history: [] },
    );
    expect(prompt).toContain('Netflix');
    expect(prompt).toContain('be firm');
  });

  it('includes rules for English', () => {
    const prompt = pipeline.buildSystemPrompt(
      { type: 'cancel', systemPrompt: '', openingLine: '', tactics: [], successCriteria: [], failureHandling: '', ivrTarget: [], maxAttempts: 3 },
      { company: 'Test', history: [] },
    );
    expect(prompt).toContain('NEVER reveal you are an AI');
  });
});
