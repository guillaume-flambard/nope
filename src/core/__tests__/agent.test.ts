import { describe, it, expect } from 'vitest';
import { NopeAgent } from '../agent';

const agent = new NopeAgent();

describe('parseGoal', () => {
  // ── Language detection ──

  it('detects English', () => {
    const task = agent.parseGoal('Cancel my Netflix subscription');
    expect(task.language).toBe('en');
  });

  it('detects French', () => {
    const task = agent.parseGoal('Résilie mon abonnement Netflix');
    expect(task.language).toBe('fr');
  });

  it('detects Spanish', () => {
    const task = agent.parseGoal('Cancelar mi suscripción de Netflix');
    expect(task.language).toBe('es');
  });

  it('detects German', () => {
    const task = agent.parseGoal('Mein Netflix Abonnement kündigen');
    expect(task.language).toBe('de');
  });

  it('defaults to English for ambiguous text', () => {
    const task = agent.parseGoal('Netflix');
    expect(task.language).toBe('en');
  });

  // ── Strategy detection ──

  it('detects cancel strategy', () => {
    const task = agent.parseGoal('Cancel my Netflix subscription');
    expect(task.strategy).toBe('cancel');
  });

  it('detects negotiate strategy', () => {
    const task = agent.parseGoal('Negotiate my Comcast bill');
    expect(task.strategy).toBe('negotiate');
  });

  it('detects negotiate from "lower"', () => {
    const task = agent.parseGoal('Lower my phone bill');
    expect(task.strategy).toBe('negotiate');
  });

  it('detects complain strategy', () => {
    const task = agent.parseGoal('I want a refund from Adobe');
    expect(task.strategy).toBe('complain');
  });

  it('detects appointment strategy', () => {
    const task = agent.parseGoal('Book an appointment with my doctor');
    expect(task.strategy).toBe('appointment');
  });

  it('defaults to inquiry for generic requests', () => {
    const task = agent.parseGoal('What are the hours for Netflix support?');
    expect(task.strategy).toBe('inquiry');
  });

  it('detects French cancel', () => {
    const task = agent.parseGoal('Je veux résilier mon abonnement Canal+');
    expect(task.strategy).toBe('cancel');
  });

  it('detects French negotiate', () => {
    const task = agent.parseGoal('Je veux baisser ma facture SFR');
    expect(task.strategy).toBe('negotiate');
  });

  // ── Company extraction ──

  it('extracts known company names', () => {
    const task = agent.parseGoal('Cancel my Netflix subscription');
    expect(task.company).toBe('Netflix');
  });

  it('extracts multi-word companies', () => {
    const task = agent.parseGoal('Cancel my Disney+ membership');
    expect(task.company).toBe('Disney+');
  });

  it('extracts Canal+', () => {
    const task = agent.parseGoal('Résilie mon abonnement Canal+');
    expect(task.company).toBe('Canal+');
  });

  it('extracts AT&T', () => {
    const task = agent.parseGoal('Negotiate my AT&T bill');
    expect(task.company).toBe('AT&T');
  });

  // ── Task structure ──

  it('generates an id', () => {
    const task = agent.parseGoal('Cancel Netflix');
    expect(task.id).toBeTruthy();
    expect(task.id.length).toBe(8);
  });

  it('stores the original goal', () => {
    const task = agent.parseGoal('Cancel my Netflix subscription');
    expect(task.goal).toBe('Cancel my Netflix subscription');
  });

  it('sets createdAt', () => {
    const task = agent.parseGoal('Cancel Netflix');
    expect(task.createdAt).toBeInstanceOf(Date);
  });
});
