#!/usr/bin/env python3
"""Chatterbox TTS helper (Resemble AI, 0.5B, open-source) — synth one line to WAV.
Usage: chatterbox_say.py <lang> <text> <out.wav>
Lang: fr, en, es, de, it, pt, hi, ...
Note: model ~1GB, loaded once per process. Voice is multilingual default.
"""
import sys, os
sys.path.insert(0, '/tmp/tts-sota/lib/python3.14/site-packages')

lang, text, out = sys.argv[1], sys.argv[2], sys.argv[3]

import torch, soundfile as sf
# Chatterbox weights were saved with CUDA tensors; force map_location=cpu so
# they load on machines without CUDA (then move to MPS).
_orig_load = torch.load
def _load(*a, **k):
    k.setdefault('map_location', 'cpu')
    return _orig_load(*a, **k)
torch.load = _load

from chatterbox import ChatterboxMultilingualTTS

device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
m = ChatterboxMultilingualTTS.from_pretrained(device=device)

out_t = m.generate(text, language_id=lang)
audio = out_t[0].detach().cpu().numpy()
sf.write(out, audio, 24000)
print('ok')
