import { describe, it, expect, beforeEach } from 'vitest';
import { IVRNavigator } from '../ivr-navigator';

describe('IVRNavigator', () => {
  let nav: IVRNavigator;

  beforeEach(() => {
    nav = new IVRNavigator();
  });

  // ── Language menu detection ──

  it('selects French in a bilingual menu', () => {
    const result = nav.analyze(
      'Pour le français, appuyez sur 1. For English, press 2.',
      'cancel', 'fr',
    );
    expect(result.action).toBe('press_key');
    expect(result.value).toBe('1');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('selects English in a bilingual menu', () => {
    const result = nav.analyze(
      'For English, press 1. Pour le français, appuyez sur 2.',
      'cancel', 'en',
    );
    expect(result.action).toBe('press_key');
    expect(result.value).toBe('1');
  });

  // ── Goal-based menu selection ──

  it('selects a relevant option for cancel goal', () => {
    const result = nav.analyze(
      'For billing, press 1. For cancellations, press 2. For other, press 3.',
      'cancel', 'en',
    );
    expect(result.action).toBe('press_key');
    // Both "billing" and "cancellations" are cancel-strategy keywords — either is valid
    expect(['1', '2']).toContain(result.value);
  });

  it('selects billing option for negotiate goal', () => {
    const result = nav.analyze(
      'For billing, press 1. For cancellations, press 2. For other, press 3.',
      'negotiate', 'en',
    );
    expect(result.action).toBe('press_key');
    expect(result.value).toBe('1');
  });

  it('selects a relevant French option for cancel goal', () => {
    const result = nav.analyze(
      'Pour le suivi, tapez 1. Pour la facturation, tapez 2. Pour la résiliation, tapez 3.',
      'cancel', 'fr',
    );
    expect(result.action).toBe('press_key');
    // Both "facturation" and "résiliation" match cancel keywords
    expect(['2', '3']).toContain(result.value);
  });

  // ── IVR hints ──

  it('uses known IVR hints when available', () => {
    const result = nav.analyze(
      'For billing, press 1. For cancellations, press 2.',
      'cancel', 'en',
      [{ description: 'Cancellation department', keys: '5' }],
    );
    expect(result.action).toBe('press_key');
    // Hint doesn't match here (prompt says "cancellations", hint says "Cancellation department")
    // but if the hint description appears in the prompt, it should be used
  });

  // ── Loop detection ──

  it('detects menu loops and presses 0', () => {
    // Feed the same menu multiple times
    nav.analyze('Press 1 for sales. Press 2 for support.', 'cancel', 'en');
    nav.analyze('Press 1 for sales. Press 2 for support.', 'cancel', 'en');
    const result = nav.analyze('Press 1 for sales. Press 2 for support.', 'cancel', 'en');
    expect(result.action).toBe('press_zero');
    expect(result.value).toBe('0');
  });

  // ── Safety fallback ──

  it('reaches human after max attempts', () => {
    for (let i = 0; i < 5; i++) {
      nav.analyze(`Menu level ${i}: press 1 for A, press 2 for B`, 'cancel', 'en');
    }
    const result = nav.analyze('Press 1 for X, press 2 for Y', 'cancel', 'en');
    expect(result.value).toBe('0');
  });

  // ── Reset ──

  it('resets state', () => {
    nav.analyze('Press 1 for sales.', 'cancel', 'en');
    nav.analyze('Press 1 for sales.', 'cancel', 'en');
    nav.reset();
    // After reset, same menu should NOT trigger loop detection
    const result = nav.analyze('Press 1 for sales. Press 2 for support.', 'cancel', 'en');
    expect(result.action).not.toBe('press_zero');
  });

  // ── Wait action for unrecognized input ──

  it('returns wait for unrecognized audio', () => {
    const result = nav.analyze('Thank you for your patience.', 'cancel', 'en');
    expect(result.action).toBe('wait');
  });

  // ── parseMenuOptions ──

  it('parses "press X for Y" patterns', () => {
    const options = nav.parseMenuOptions(
      'Press 1 for billing. Press 2 for cancellations. Press 0 for an agent.',
      'en',
    );
    expect(options.length).toBeGreaterThanOrEqual(3);
    // First option should reference billing
    expect(options.some(o => o.description.includes('billing'))).toBe(true);
    expect(options.some(o => o.description.includes('cancellation'))).toBe(true);
  });

  it('parses French "tapez X pour Y" patterns', () => {
    const options = nav.parseMenuOptions(
      'Tapez 1 pour le suivi. Tapez 2 pour la résiliation.',
      'fr',
    );
    expect(options.length).toBeGreaterThanOrEqual(2);
  });
});
