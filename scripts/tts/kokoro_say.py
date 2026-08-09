#!/usr/bin/env python3
"""Kokoro TTS helper — synth one line to a WAV file (open-source, local, MPS).
Usage: kokoro_say.py <voice> <text> <out.wav> [lang]
Voices: af_heart, af_bella, am_michael, am_fenrir, bf_emma, bm_george, ...
"""
import sys, os
sys.path.insert(0, '/tmp/tts-sota/lib/python3.14/site-packages')

voice, text, out = sys.argv[1], sys.argv[2], sys.argv[3]
lang = sys.argv[4] if len(sys.argv) > 4 else 'a'
# Map language: a=EN(US), b=EN(UK), e=ES, f=FR, h=HI, i=IT, p=PT, j=JA, z=ZH
LANG_MAP = {'en': 'a', 'fr': 'f', 'es': 'e', 'de': 'd', 'it': 'i'}

import torch, numpy as np, soundfile as sf
from kokoro import KPipeline

p = KPipeline(lang_code=lang)
parts = []
for result in p(text, voice=voice, speed=1.0):
    parts.append(result.audio)
if not parts:
    sys.exit('no audio')
audio = np.concatenate(parts)
sf.write(out, audio, 24000)
print('ok')
