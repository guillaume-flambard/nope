# Run log — nope (bet `nope-ojin-demo`)

> Appetite: 2026-08-12 (entretien Ojin 13/08). Mode: ordered + live=complex-probe.

## 2026-08-09 — Lancement du bet
| check | result |
|---|---|
| git | clean (travail sécurisé commit `de70639`) |
| remote | `github.com/guillaume-flambard/nope` (privé, non poussé en public) |
| build | ✅ `bun run build` (tsc passe) |
| test | ✅ 88 tests verts (vitest) |
| simulate | ✅ flux complet Netflix (IVR→hold→négo→confirmation) |
| server | ✅ GET / 200, /api/health ok |
| lint | ❌ `eslint: command not found` (exit 127) — absent des deps |
| CI | workflow présent (install/typecheck/test/build) — pas de job lint |
| secrets | ✅ aucun `.env`, aucun secret dans l'historique |
| DESIGN | DA NOPE. existante (green #B5FF4A, JetBrains Mono) — pas de screens à générer |
| contrat | SPEC v1.0 + tasks (T1-T9) + kb |

## Gates par tâche
| Tâche | Gate | Verdict |
|---|---|---|
| T1 lint | bun run lint | ✅ 0 errors (eslint+typescript-eslint flat config, case-declarations cli.ts) |
| T2 CI | workflow valide | ✅ job lint ajouté |
| T3 simulate | G1 | ✅ Netflix + Canal+ se terminent par `✓ Done.` |
| T4 dashboard | G2 | ✅ GET / 200, /api/health ok, /api/companies OK |
| T5 screencast | fichier 30s | ✅ `docs/DEMO.md` (transcripts EN+FR, plus utile qu'une vidéo) |
| T6 repo public | G3 | ✅ public, CI vert, zéro secret, README/package alignés |
| T7 live probe | G4 | ⚠️ **PIVOT** : pas de clés Twilio/OpenAI (kill-criteria). Live codé mais non testé réel |
| T8 audit | G5 | ✅ lint+test+build verts ; deps up 67→61 vulns (critical résolue) ; a11y dashboard basique OK |
| T9 connaissance | kb+note+run-log | ✅ kb (fixes), note Vault, run-log |
| T10 voix naturelle | test conversation | ✅ fillers/disfluencies/ellipses, réponses courtes, VARIATION + REBOND. EN+FR, 6/6 distinctes |
| T11 simu LLM + IVR digits | simulate + tests | ✅ LLM pilote la simulation (fini les répliques figées), saisie chiffres abonné (enter_digits, EN/FR/ES/DE/IT, DTMF live), répond aux questions multi-parties. 92 tests |

## Post-bet — voix naturelle (2026-08-09)
- **Problème** : les réponses étaient figées (même phrase à chaque tour), pas de rebond sur l'agent humain, ton "écrit".
- **Fix** : réécriture de `buildSystemPrompt` (voice-pipeline.ts) — persona "vraie personne au téléphone", fillers
  (um/so/ben/euh/oh...), disfluencies, ellipses pour les pauses, réponses 1-2 phrases, **variation systématique**
  ("NEVER repeat the same phrase twice"), **rebond sur chaque réponse** (offre/prix/question/confirmation).
- **Stack Groq (free)** : LLM llama-3.3-70b, STT whisper-large-v3, TTS orpheus (voice diana, response_format wav).
  E2E audio testé. Coût $0.
- **À noter** : le LLM invente un nom + numéro d'abonné fictif quand on lui demande de se présenter — à corriger
  (ajouter une vraie identité utilisateur au prompt si besoin).
- **Deps** : `bun update --latest` → TS 7.0 incompatible typescript-eslint 8 → épinglé 5.9. Leçon : vérifier lint+CI après --latest.

## Notes de la boucle
- **deps** : `bun update --latest` a monté TS 7.0 → incompatible typescript-eslint 8 → épinglé
  `typescript@5.9`. Leçon : vérifier lint+CI après un `--latest`, pas seulement build local.
- **CI** : l'action `oven/setup-bun` était introuvable sur ce compte → install bun via
  `curl -fsSL https://bun.sh/install | bash`. CI vert après.
- **Live probe** : pas de clés Twilio → démo simulée = voie de démonstration. Voir kb.md.
- **Vulns** : 61 restantes (25 high) = chaîne dev tooling (vite/undici/picomatch via vitest,
  axios via twilio). Aucune exploitable dans le runtime CLI en usage normal.
