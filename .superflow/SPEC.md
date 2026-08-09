# SPEC — nope, bet `nope-ojin-demo`

> Version 1.0 · 2026-08-09 · appetite: **2026-08-12** (veille de l'entretien Ojin 13/08)
> Mode: **ordered** (démo/repo/audit) + **complex-probe** (live Twilio réel, timeboxé)

## Problem + evidence
- **Ojin** (entretien 13/08, Product Engineer) est très intéressé par Nope : agent IA vocal
  temps réel = preuve vivante du domaine d'Ojin (real-time voice, latence) + comble leurs
  "nice to have" WebRTC/WebSockets.
- Nope fonctionne déjà (compile, 88 tests, simulation end-to-end, serveur web, twilio-stream
  mulaw). Mais : repo non public, lint cassé (eslint absent), run-log T3 obsolète, démo non
  packagée, live Twilio jamais testé en réel.

## Scope
1. **Démo irréprochable** : simulation + dashboard web polis, screencast 30s, README à jour.
2. **Repo public GitHub** : pousser vers `github.com/guillaume-flambard/nope` (vérif secrets,
   licence MIT, README, CI vert).
3. **Live mode Twilio réel** (complex-probe) : 1 test d'appel réel STT→LLM→TTS, timeboxé,
   kill-criteria = pas de ligne Twilio active / clés absentes → PIVOT vers démo simulée.
4. **Audit + gates** : lint réparé, tests, a11y du dashboard, perf, scan deps.

## Acceptance (Given-When-Then)
- G1 **Démo** : Given un poste avec npm/bun, When `bun run simulate`, Then affiche le flux
  complet (IVR→hold→négo→confirmation) et se termine par `✓ Done.`.
- G2 **Dashboard** : Given le serveur lancé, When `GET /` → 200 et le dashboard charge ;
  When `GET /api/health` → `{status:ok}`.
- G3 **Repo public** : Given le repo poussé sur GitHub, When je clone l'URL publique, Then
  build + test passent (CI vert), aucun secret dans l'historique.
- G4 **Live probe** : Given clés Twilio+OpenAI dans `.env`, When `nope call --live`, Then un
  appel réel est initié OU un message clair explique pourquoi c'est bloqué (kill-criteria).
- G5 **Gates** : Given le dépôt, When `bun run lint` + `bun run test` + `bun run build`,
  Then tout passe.

## Constraints
- Ne jamais committer `.env` ni secrets. Pas de clé dans les notes.
- Live Twilio timeboxé : si > 1h sans résultat, PIVOT démo simulée.
- Repo public : le remote reste `guillaume-flambard/nope` (le README pointe `nope-ai/nope` →
  aligner sur la réalité).

## Rationale (log des changements)
- v1.0 : contrat initial.
