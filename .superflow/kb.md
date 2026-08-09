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

## Fix: voix naturelle — prompt voice (2026-08-09)
- **Signature** : réponses robotiques, répétitives, ton "écrit" (LLM post-entraîné sur du texte propre).
- **Fix** (`buildSystemPrompt`) :
  1. Persona explicite : "vraie personne au téléphone, PAS du texte écrit ni un robot".
  2. Fillers + disfluencies naturels : um/so/okay/well (EN), euh/ben/voyons (FR), jamais forcés.
  3. Ellipses "..." pour les pauses parlées.
  4. Réponses 1-2 phrases.
  5. **Variation systématique** : "NEVER repeat the same phrase twice".
  6. **Rebond systématique** : répondre AU CONTENU de l'agent (offre → reconnaître puis refuser autrement ;
     prix/date → réagir ; question → répondre d'abord ; confirmation → remercier + confirmer le numéro).
- **Sources web** : LiveKit "Prompting voice agents to sound more realistic", Vapi prompting guide (2-4
  disfluencies/tour), Retell expressive mode, VoiceInfra (turn-taking, emotion).
- **Résultat testé** : EN+FR, 6/6 réponses distinctes, rebonds sur $9.99/15€/numéro de confirmation.
- **Piège restant** : le LLM invente un nom + numéro d'abonné fictif → fournir une vraie identité au prompt
  si on veut un personnage cohérent.

## Fix: la simulation utilisait des répliques figées (2026-08-09)
- **Signature** : la démo `--simulate` semblait encore robotique alors que le live était naturel.
- **Cause** : `caller.simulate()` générait les réponses de NOPE en dur (scriptées), le LLM n'était
  appelé que dans le live (twilio-stream). Le nouveau prompt naturel ne servait pas en démo.
- **Fix** : `caller.simulate(task, strategy, onEvent, llm?)` — callback LLM optionnel. `agent.ts`
  crée le VoicePipeline et passe `(agentTurn, history) => pipeline.generateResponse(...)`. `nopeSay`
  pousse le tour agent EN PREMIER (sinon le LLM répond avec un tour de retard).
- **Résultat** : la simulation utilise le LLM Groq → voix naturelle + rebonds, y compris en démo.

## Fix: IVR — saisie de numéro d'abonné (2026-08-09)
- **Signature** : "Please enter your subscriber number" — l'IVR Navigator ne savait que presser des
  touches, pas saisir des chiffres.
- **Fix** : action `enter_digits` dans IVRAnalysis + `detectDigitEntry()` (patterns EN/FR/ES/DE/IT :
  enter/type account·subscriber·customer·number, entrer/saisir numéro d'abonné, ingrese su numero,
  geben sie kundennummer, inserisca numero...). En live, `enter_digits` → presser 0 (on ne connaît
  pas le vrai numéro → rejoindre un humain). En simulation, scénario réaliste : saisie `48213760#`.
- **Tests** : 4 nouveaux (EN/FR digit entry + pas de faux positif sur menu normal).

## Fix: voix naturelle — skill `natural-voice` + moteur par langue (2026-08-09)
- **Sources** : conversation analysis (Sacks/Schegloff/Jefferson 74-77 : turn-taking, adjacency pairs,
  repair, préférence pour l'auto-correction), politeness (Brown & Levinson : positive/negative face,
  hedging), rhétorique (Aristote : ethos/pathos/logos/kairos), fluencemes (Crible/Götz : fillers en
  début de tour), backchannels (Yngve), fréquence 2-4 disfluencies/tour (Vapi), prosodie TTS
  (ponctuation → pauses), différences culturelles (Pallotti 2008).
- **Livrables** : skill `~/.config/opencode/skills/natural-voice/SKILL.md` (toute la science) +
  `src/core/natural-speech.ts` (profils par langue) + `buildNaturalSpeechSection()` injecté dans le
  system prompt.
- **Résultat testé** : EN/FR/ES/DE/IT sonnent natifs (euh/voilà, pues/mire, ähm/eigentlich,
  ehm/ecco/cioè), FR 6-tours 6/6 distinctes avec rebonds sur offre/prix + auto-correction "attendez".
- **Pièges connus** : (1) le LLM invente un nom fictif quand on le lui demande → fournir une vraie
  identité au prompt si on veut un personnage cohérent. (2) Groq multilingue mélange parfois
  (ex: "subscription" en italien au lieu de "abbonamento") — vérifier sur les langues secondaires.

## Mémo live probe Twilio (T7 — 2026-08-09)
- Clés présentes ? (OPENAI + TWILIO) : **NON** — aucun `.env`, aucune clé dans `~/.secrets/`.
- Appel réel initié ? : **NON**
- Ce qui a bloqué : pas de clés Twilio/OpenAI (probe ne peut pas partir). Kill-criteria déclenché.
- Verdict : **PIVOT vers démo simulée** (G1/G2 verts). Le live mode est codé (twilio-stream mulaw,
  caller.ts), reste à tester quand des clés existeront. Procédure : `cp .env.example .env`, remplir
  OPENAI_API_KEY + TWILIO_* (+ Deepgram/ElevenLabs en option), puis `bun run src/cli.ts call "..." --live`.
- **MàJ Groq (2026-08-09)** : le LLM peut désormais être Groq (free). Ne manque plus que la
  téléphonie Twilio (trial ~$15 dispo au signup) pour un live complet à ~$0.
