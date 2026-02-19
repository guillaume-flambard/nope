import { describe, it, expect } from 'vitest';
import { CompanyFinder } from '../company-finder';

const finder = new CompanyFinder();

describe('CompanyFinder', () => {
  // ── Exact name lookup ──

  it('finds Netflix', async () => {
    const result = await finder.find('Netflix');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Netflix');
    expect(result!.phone).toBeTruthy();
  });

  it('finds Spotify', async () => {
    const result = await finder.find('Spotify');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Spotify');
  });

  it('finds Canal+', async () => {
    const result = await finder.find('Canal+');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Canal+');
    expect(result!.language).toBe('fr');
  });

  // ── Case insensitive ──

  it('finds companies case-insensitively', async () => {
    const result = await finder.find('netflix');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Netflix');
  });

  // ── Partial match / natural language ──

  it('finds from natural language query', async () => {
    const result = await finder.find('cancel my Netflix subscription');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Netflix');
  });

  // ── Country preference ──

  it('returns French Netflix for FR context', async () => {
    const result = await finder.find('Netflix', 'FR');
    expect(result).toBeDefined();
    expect(result!.country).toBe('FR');
    expect(result!.language).toBe('fr');
  });

  it('returns US Netflix by default', async () => {
    const result = await finder.find('Netflix');
    expect(result).toBeDefined();
    expect(result!.country).toBe('US');
  });

  // ── Tips ──

  it('returns IVR tips when available', async () => {
    const result = await finder.find('Netflix');
    expect(result!.tips).toBeDefined();
  });

  // ── Not found ──

  it('returns result with "unknown" category for non-directory companies', async () => {
    // CompanyFinder falls back to web search, so it may return a result
    const result = await finder.find('TotallyFakeCompany12345');
    if (result) {
      expect(result.category).toBe('unknown');
    }
    // Either undefined or a web-scraped result is acceptable
  });

  // ── List ──

  it('lists all companies', () => {
    const list = finder.list();
    expect(list.length).toBeGreaterThan(20);
    expect(list.some(c => c.name === 'Netflix')).toBe(true);
  });
});
