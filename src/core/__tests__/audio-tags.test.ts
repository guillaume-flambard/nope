import { describe, it, expect } from 'vitest';
import { stripAudioTags, extractTags, cueCount, renderTagsForTTS, buildAudioTagRule } from '../audio-tags';
import { VoicePipeline } from '../voice-pipeline';

describe('audio-tags engine (ElevenLabs cue reverse-engineering)', () => {
  it('extracts tags from text', () => {
    expect(extractTags('Oh [sighs], I see [pause].')).toEqual(['[sighs]', '[pause]']);
  });

  it('counts cues for dosage checks', () => {
    expect(cueCount('Oh [sighs], well [pause] okay.')).toBe(2);
    expect(cueCount('Just a normal sentence.')).toBe(0);
  });

  it('strips tags cleanly', () => {
    expect(stripAudioTags('Oh [sighs], I see [short pause].')).toBe('Oh, I see.');
  });

  it('passes tags through for ElevenLabs (native support)', () => {
    const t = 'Oh, that is nice of you, but... [short pause] I would still like to cancel.';
    expect(renderTagsForTTS(t, 'elevenlabs')).toBe(t);
  });

  it('converts pauses to ellipses for non-ElevenLabs TTS', () => {
    const out = renderTagsForTTS('Oh [short pause] I see.', 'groq');
    expect(out).not.toContain('[');
    expect(out).toContain('...');
  });

  it('builds a language-specific sparse-cue rule', () => {
    const fr = buildAudioTagRule('fr');
    expect(fr).toContain('SPARSE AUDIO CUES (FR)');
    expect(fr).toContain('ONE cue');
    const en = buildAudioTagRule('en');
    expect(en).toContain('SPARSE AUDIO CUES (EN)');
    expect(en).toContain('[short pause]');
  });

  it('includes breath cues (physiology: a natural voice breathes)', () => {
    expect(extractTags('Okay [soft breath] I see.')).toEqual(['[soft breath]']);
    expect(renderTagsForTTS('Okay [soft breath] I see.', 'groq')).not.toContain('[');
    const fr = buildAudioTagRule('fr');
    expect(fr.toLowerCase()).toContain('souffle');
  });

  it('renders a (beat) as a micro-pause (Stanislavski)', () => {
    const out = renderTagsForTTS('Oh... (beat) I see.', 'groq');
    expect(out).toContain('...');
    expect(out).not.toContain('(beat)');
  });

  it('prompt includes the acting/subtext block', () => {
    const p = new VoicePipeline({ language: 'en' });
    const sys = p.buildSystemPrompt({ type: 'cancel', systemPrompt: 'x', tactics: [] }, { company: 'Netflix', history: [] });
    expect(sys).toContain('SUBTEXT');
    expect(sys).toContain('WRITE FOR THE BREATH');
  });
});
