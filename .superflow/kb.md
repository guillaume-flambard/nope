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

## Mémo live probe Twilio (T7 — 2026-08-09)
- Clés présentes ? (OPENAI + TWILIO) : **NON** — aucun `.env`, aucune clé dans `~/.secrets/`.
- Appel réel initié ? : **NON**
- Ce qui a bloqué : pas de clés Twilio/OpenAI (probe ne peut pas partir). Kill-criteria déclenché.
- Verdict : **PIVOT vers démo simulée** (G1/G2 verts). Le live mode est codé (twilio-stream mulaw,
  caller.ts), reste à tester quand des clés existeront. Procédure : `cp .env.example .env`, remplir
  OPENAI_API_KEY + TWILIO_* (+ Deepgram/ElevenLabs en option), puis `bun run src/cli.ts call "..." --live`.
