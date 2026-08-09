# Tasks — nope, bet `nope-ojin-demo`

> 15-45 min par tâche · chaque tâche a un `Verify:` explicite · appetite 2026-08-12

## T1 — Réparer lint (eslint) · P0
- [ ] Ajouter `eslint` en devDep + config `eslint.config.js` compatible avec le code existant.
- [ ] `bun run lint` doit passer sans erreur (ou erreurs triées).
- Verify: `bun run lint` → exit 0.

## T2 — Mettre à jour le CI · P0
- [ ] Vérifier que le workflow `ci.yml` couvre build + test + typecheck (déjà le cas).
- [ ] Ajouter un job `lint` au workflow.
- Verify: le workflow YAML est valide, pas de dépendance manquante.

## T3 — Packager la démo simulation · P0
- [ ] `bun run simulate` (Netflix) : vérifier le flux complet et la sortie propre.
- [ ] Vérifier que le mode FR marche (`Résilie mon abonnement Canal+`).
- Verify: G1 du SPEC — `bun run simulate` se termine par `✓ Done.`.

## T4 — Dashboard web · P0
- [ ] `bun run server` → `GET /` 200, dashboard charge, `GET /api/health` OK.
- [ ] Appel simulé via l'UI : stream SSE en temps réel visible.
- Verify: G2 du SPEC.

## T5 — Screencast démo 30s · P1
- [ ] Enregistrer un screencast 30s de la simulation (terminal + dashboard).
- [ ] Le déposer dans `docs/` et le référencer dans le README.
- Verify: fichier vidéo présent, < 30s, lisible.

## T6 — README + repo public · P1
- [ ] Aligner le README sur la réalité : remote `guillaume-flambard/nope`, version 0.2.0,
      badges CI réels, section démo avec screencast.
- [ ] Vérifier zéro secret dans l'historique git (scan complet).
- [ ] Push sur GitHub, confirmer CI vert.
- Verify: G3 du SPEC — clone public → build + test passent, CI vert.

## T7 — Live Twilio probe (complex) · P2 — timeboxé
- [ ] Vérifier présence de clés Twilio/OpenAI dans `.env` (si absent → PIVOT, documenter).
- [ ] Test d'appel réel minimal : initier un appel, observer STT→LLM→TTS.
- Verify: G4 — appel réel initié OU message clair de blocage (kill-criteria).

## T8 — Audit + gates · P2
- [ ] `preflight` (static/AppSec/business/visual/perf) sur le repo.
- [ ] `a11y-audit` sur le dashboard web.
- [ ] Scan deps (npm audit / bun audit) + gitleaks sur l'historique.
- Verify: G5 — lint + test + build verts ; rapport d'audit dans `run-log.md`.

## T9 — Connaissance (flywheel) · P0
- [ ] Remplir `kb.md` : fix lint, mémo live probe (succès/échec + pourquoi), lessons voice-loop.
- [ ] Note Vault `01-Projects/nope.md` à jour (statut final).
- [ ] `run-log.md` : gates par tâche, verdicts.
- Verify: kb.md non vide, note Vault cohérente, run-log à jour.
