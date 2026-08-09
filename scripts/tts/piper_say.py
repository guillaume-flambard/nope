#!/usr/bin/env python3
"""Piper TTS helper — synth one line to a WAV file.
Usage: piper_say.py <voice.onnx> <text> <out.wav>
"""
import sys, wave
sys.path.insert(0, '/tmp/kokoro-venv/lib/python3.14/site-packages')
from piper import PiperVoice

voice, text, out = sys.argv[1], sys.argv[2], sys.argv[3]
v = PiperVoice.load(voice)
w = wave.open(out, 'wb')
w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
v.synthesize_wav(text, w)
w.close()
print('ok')
