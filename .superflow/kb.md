# KB — fixes et procédures Nope (self-healing)

> Chaque fix qui a marché est noté ici avec sa signature d'erreur. Ne raisonne jamais deux fois
> depuis les principes : applique la checklist.

## Fix: eslint absent → lint casse (exit 127)
- **Signature** : `bun run lint` → `eslint: command not found`, exit 127.
- **Cause** : `eslint` déclaré dans le script package.json mais absent des devDependencies.
- **Fix** : `bun add -d eslint @eslint/js` + config `eslint.config.js` (flat config, tsc-pas
  nécessaire). Si le code est en TS, utiliser `typescript-eslint`.
- **Checklist** : (1) ajouter eslint + config, (2) `bun run lint` → exit 0, (3) ajouter job
  lint au CI.

## Fix: formulaire React ignore le clic synthétique → utiliser requestSubmit()
- **Signature** : clic `element.click()` sur un bouton submit ne déclenche rien (aucune requête
  réseau), alors que le bouton n'est pas disabled.
- **Cause** : handler JS (Vue/React) qui attend un submit natif ; le clic synthétique ne passe
  pas par la validation du formulaire.
- **Fix** : `form.requestSubmit()` (déclenche validation + submit natif). Vu sur Free-Work
  (`POST /api/applications` → 201).
- **Note** : même pattern probable sur d'autres SPAs (Vue 3, Nuxt) — tester requestSubmit d'abord.

## Fix: LLM gratuit pour le live mode — Groq (2026-08-09)
- **Signature** : pas de clé OpenAI → live mode sans LLM. OpenAI coûte $.
- **Solution** : Groq — API compatible OpenAI, LPU ultra-rapide, free tier sans carte.
  `GROQ_API_KEY` + `baseURL=https://api.groq.com/openai/v1`. Modèle : `llama-3.3-70b-versatile`
  (bon) ou `llama-3.1-8b-instant` (plus généreux en quota, qualité moindre).
- **Intégration Nope** : `voice-pipeline.ts` — si `GROQ_API_KEY` set → llmProvider='groq',
  `groqGenerate()` via SDK OpenAI avec baseURL Groq. Fallback OpenAI/Anthropic.
- **Clé** : `gsk_...` dans `~/projects/weave/.env` (exposée dans un transcript le 06/07 —
  à régénérer si le repo weave devient public). Réutilisable pour Nope sans copie (lecture directe).
- **Checklist** : (1) mettre GROQ_API_KEY dans .env, (2) vérifier `bun run src/cli.ts ... --simulate`
  utilise bien groq, (3) le live mode STT/TTS peut aussi passer par Groq (whisper-large-v3, Orpheus).
- **STT** : `whisper-large-v3` (free). **TTS** : `canopylabs/orpheus-v1-english` — exige (a) acceptation
  des termes dans la console Groq (playground?model=canopylabs/orpheus...) et (b) `voice` ∈
  `[autumn diana hannah austin daniel troy]` + `response_format: 'wav'`. Le voice 'alloy' (OpenAI) est rejeté.
- **E2E testé 2026-08-09** : STT→LLM→TTS 100% Groq, flux complet (caller parle → entend → raisonne → répond). $0.

## Mémo live probe Twilio (T7 — 2026-08-09)
- Clés présentes ? (OPENAI + TWILIO) : **NON** — aucun `.env`, aucune clé dans `~/.secrets/`.
- Appel réel initié ? : **NON**
- Ce qui a bloqué : pas de clés Twilio/OpenAI (probe ne peut pas partir). Kill-criteria déclenché.
- Verdict : **PIVOT vers démo simulée** (G1/G2 verts). Le live mode est codé (twilio-stream mulaw,
  caller.ts), reste à tester quand des clés existeront. Procédure : `cp .env.example .env`, remplir
  OPENAI_API_KEY + TWILIO_* (+ Deepgram/ElevenLabs en option), puis `bun run src/cli.ts call "..." --live`.
- **MàJ Groq (2026-08-09)** : le LLM peut désormais être Groq (free). Ne manque plus que la
  téléphonie Twilio (trial ~$15 dispo au signup) pour un live complet à ~$0.
