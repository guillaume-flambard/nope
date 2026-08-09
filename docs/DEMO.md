# NOPE. — Démo (à recopier / présenter)

> Deux commandes suffisent, zéro clé API, coût $0.
> Vérifié le 2026-08-09 (bet `nope-ojin-demo`).

## Installer + lancer (30 secondes)

```bash
git clone https://github.com/guillaume-flambard/nope
cd nope && bun install

# Démo EN
bun run src/cli.ts call "Cancel my Netflix subscription" --simulate

# Démo FR
bun run src/cli.ts call "Résilie mon abonnement Canal+" --simulate

# Dashboard web (stream temps réel)
bun run src/web/server.ts   # http://localhost:4000
```

## Transcript EN (Netflix)

```
NOPE.  v0.2.0 — AI that calls companies so you don't have to.
Mode: Simulation (no real call)

  SYSTEM  Goal: "Cancel my Netflix subscription"
  SYSTEM  Found: Netflix — +1-844-505-2993
  SYSTEM  Strategy: cancel — 6 tactics loaded
  SYSTEM  Calling +1-844-505-2993...
  IVR     Welcome to Netflix. For cancellations, press 3.
  NOPE    (Pressing 3)
  IVR     Your call is important to us. Please stay on the line...
  SYSTEM  ♪ Hold music... (2min 15s)
  AGENT   Hello, this is Sarah from Netflix. How can I help you?
  NOPE    Hi Sarah. I'm calling to cancel my Netflix subscription, please.
  AGENT   May I ask why? We have an offer that could interest you...
  NOPE    Thank you, but my decision is final. Personal reasons.
  AGENT   What if I offered you 50% off for 3 months?
  NOPE    No thank you. I really want to cancel today.
  AGENT   Your confirmation number is NP-X7K2M9.

  ✓ Done. Netflix cancellation confirmed.
  Duration: 0m 25s · Cost: $0.035
```

## Transcript FR (Canal+)

```
  SYSTEM  Objectif: "Résilie mon abonnement Canal+"
  SYSTEM  Trouvé: Canal+ — +33-1-70-17-17-17
  SYSTEM  Stratégie: cancel — 6 tactiques chargées
  ...
  ✓ Done. Résiliation Canal+ confirmée.
  Duration: 0m 28s · Cost: $0.037
```

## Les 3 arguments (pour Ojin)

1. **Temps réel vocal, preuve pas blabla** : Twilio WebSocket stream (mulaw codec),
   STT → LLM → TTS, latence observée à l'écran. C'est exactement le domaine d'Ojin.
2. **Produit de bout en bout** : CLI + dashboard web + API SSE + répertoire 35+ entreprises
   (Netflix, Canal+, SFR, Orange, EDF) + multi-langue EN/FR/ES/DE.
3. **Industriel** : 88 tests verts, CI (lint/typecheck/test/build), compile strict, MIT.
