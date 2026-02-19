# NOPE. — Plan d'exécution pour Claude Code

## Comment utiliser ce fichier

Ouvre ce projet dans ton éditeur avec Claude Code. Donne-lui les instructions suivantes selon ce que tu veux faire. Chaque section est un prompt autonome que tu peux copier-coller.

---

## Phase 1 : Faire tourner le projet ✨

### Tâche 1.1 — Fix compilation TypeScript

```
Fais compiler le projet TypeScript sans erreur.

Le projet est dans le dossier courant. Lance `npm install` puis `npm run build`.
Corrige toutes les erreurs de compilation :
- Ajoute les @types/* manquants dans devDependencies
- Ajoute des déclarations de modules si des types ne sont pas disponibles
- Corrige les erreurs de typage dans les fichiers src/

La commande `npm run build` doit se terminer sans erreur.
Ne change pas la logique métier, seulement les types et imports.
```

### Tâche 1.2 — Tester le mode simulation CLI

```
Lance `npm run simulate` et vérifie que la simulation fonctionne.
Si ça plante, corrige les erreurs.

Le résultat attendu :
1. Le banner NOPE. s'affiche
2. Un appel simulé se déroule avec des messages IVR, hold, agent
3. Le résultat final (succès/échec) s'affiche avec durée et coût
4. Le process se termine proprement (exit code 0)

Teste aussi avec un goal en français :
`npx ts-node src/cli.ts "Résilie mon abonnement Canal+"`
```

### Tâche 1.3 — Tester le serveur web

```
Lance `npm run server` et vérifie que le dashboard web fonctionne.

1. Le serveur doit démarrer sur http://localhost:4000
2. La page d'accueil doit afficher le dashboard NOPE.
3. GET /api/health doit retourner un JSON valide
4. GET /api/companies doit lister les entreprises
5. POST /api/call avec {"goal": "Cancel Netflix", "simulate": true} doit démarrer un appel
6. GET /api/call/:id/stream doit streamer les événements SSE

Si quelque chose ne fonctionne pas, corrige-le.
```

---

## Phase 2 : Rendre le mode live fonctionnel 🔥

### Tâche 2.1 — WebSocket Twilio bidirectionnel

```
Implémente la connexion WebSocket bidirectionnelle avec Twilio dans le serveur.

Dans src/web/server.ts, ajoute un handler WebSocket sur le path /api/twilio/stream.
Twilio envoie des messages JSON avec :
- event: "connected" → log connection
- event: "start" → stocker le streamSid
- event: "media" → audio base64 (mulaw 8kHz mono)
- event: "stop" → cleanup

Le handler doit :
1. Accumuler les chunks audio entrants
2. Tous les 300ms, envoyer le buffer accumulé à VoicePipeline.processAudio()
3. Récupérer l'audio de réponse et l'envoyer à Twilio via le même WebSocket :
   { "event": "media", "streamSid": "...", "media": { "payload": "<base64>" } }

Utilise la bibliothèque 'ws' déjà dans les dépendances.
Réfère-toi à la doc Twilio Media Streams pour le format exact des messages.
```

### Tâche 2.2 — Envoi de DTMF

```
Ajoute une méthode sendDTMF(callSid, digits) dans src/core/caller.ts.

Utilise l'API Twilio pour envoyer des tonalités DTMF pendant un appel actif :
client.calls(callSid).update({ twiml: '<Response><Play digits="2"/></Response>' })

Intègre ceci dans le flux de l'IVRNavigator : quand analyze() retourne
action: "press_key", le caller doit envoyer le DTMF correspondant.
```

### Tâche 2.3 — Pipeline audio complet

```
Connecte le pipeline audio de bout en bout :

1. Audio Twilio WebSocket (base64 mulaw) → décode en PCM
2. PCM → STT (Deepgram streaming API préféré, fallback OpenAI Whisper)
3. Texte STT → detectAction() dans VoicePipeline
4. Si IVR → IVRNavigator → envoi DTMF
5. Si humain → LLM génère réponse → TTS → encode en mulaw → envoi vers Twilio

Pour Deepgram streaming, utilise leur SDK Node.js avec live transcription.
Pour le STT, accumule au moins 300ms d'audio avant d'envoyer.
Pour le TTS, streame l'audio en chunks pour réduire la latence.
```

---

## Phase 3 : Robustesse 🛡️

### Tâche 3.1 — Tests unitaires

```
Crée des tests unitaires avec Vitest (ou Jest) pour les modules suivants :

1. agent.ts — parseGoal() :
   - "Cancel my Netflix" → { strategy: 'cancel', language: 'en', company: 'Netflix' }
   - "Résilie mon abonnement Canal+" → { strategy: 'cancel', language: 'fr', company: 'Canal+' }
   - "Negotiate my Comcast bill" → { strategy: 'negotiate', language: 'en', company: 'Comcast' }
   - "Baisse ma facture SFR" → { strategy: 'negotiate', language: 'fr', company: 'SFR' }

2. ivr-navigator.ts — analyze() :
   - "Press 1 for billing, press 2 for cancellation" + cancel → key "2"
   - "Pour le français appuyez sur 1" + lang=fr → key "1"
   - Menu loop detection (même prompt 3 fois) → press_zero

3. company-finder.ts — find() :
   - "Netflix" → match exact
   - "netflx" → match fuzzy (Levenshtein ≤ 2)
   - Entreprise inconnue → undefined (sans appel web)

4. strategy-engine.ts — getStrategy() :
   - cancel + fr → contient "résili" dans ivrTarget
   - negotiate + en → contient tactiques d'ancrage

Place les tests dans src/__tests__/ ou tests/.
Ajoute le script "test" dans package.json.
```

### Tâche 3.2 — Gestion d'erreurs et timeouts

```
Ajoute une gestion d'erreurs robuste :

1. Dans caller.ts (mode live) :
   - Timeout de 120s max par appel
   - Retry 1x si Twilio retourne une erreur transitoire
   - Gestion du cas "numéro occupé" ou "pas de réponse"

2. Dans voice-pipeline.ts :
   - Timeout de 10s sur les appels STT/LLM/TTS
   - Fallback : si Deepgram échoue → essayer OpenAI Whisper
   - Si le LLM ne répond pas → envoyer un "Excusez-moi, pouvez-vous répéter ?"

3. Dans le serveur :
   - Rate limiting : max 5 appels simultanés
   - Cleanup automatique des appels terminés après 5min
   - Validation stricte des inputs (goal non vide, pas de XSS)
```

### Tâche 3.3 — Logging structuré

```
Remplace tous les console.log par un logger structuré.

Utilise pino (léger et rapide) :
- Niveau info pour les événements normaux
- Niveau debug pour les détails de parsing, IVR, etc.
- Niveau error pour les erreurs
- Niveau warn pour les timeouts et retries

Chaque log doit inclure : taskId, timestamp, component (agent/ivr/caller/voice).
Le CLI doit rester avec les outputs colorés (chalk) — le logger structuré
est pour les fichiers de log et le mode serveur.
```

---

## Phase 4 : Préparation lancement GitHub 🚀

### Tâche 4.1 — npx support

```
Configure le projet pour que `npx nope-ai "Cancel my Netflix"` fonctionne.

1. Vérifie que le champ "bin" dans package.json pointe vers dist/cli.js
2. Ajoute un shebang #!/usr/bin/env node en haut de dist/cli.js
3. Ajoute un script "prepublish" qui build le TypeScript
4. Le mode simulation doit être le défaut quand pas de .env
5. Teste localement avec `npm link` puis `nope "Cancel my Netflix"`
```

### Tâche 4.2 — Docker

```
Crée un Dockerfile et docker-compose.yml pour le projet.

Dockerfile :
- Base: node:20-alpine
- Copie package.json, install deps
- Copie src, build TypeScript
- Expose port 4000
- CMD: node dist/web/server.js

docker-compose.yml :
- Service nope avec build context
- Variables d'env depuis .env
- Port mapping 4000:4000
- Volume pour la config

Ajoute les instructions Docker dans le README.
```

### Tâche 4.3 — GitHub CI

```
Crée .github/workflows/ci.yml :

- Trigger sur push et PR vers main
- Matrix : Node 18, 20, 22
- Steps : checkout, install, build, test, lint
- Badge à ajouter dans le README

Crée aussi :
- .github/ISSUE_TEMPLATE/bug_report.md
- .github/ISSUE_TEMPLATE/feature_request.md
- .github/PULL_REQUEST_TEMPLATE.md
- CONTRIBUTING.md avec les guidelines de contribution
```

### Tâche 4.4 — Vidéo démo (asciinema)

```
Installe asciinema et enregistre une démo terminal de 30 secondes.

Le scénario :
1. $ npx nope "Cancel my Netflix subscription"
2. La simulation se déroule avec les outputs colorés
3. Le résultat s'affiche : succès, durée, coût

Sauvegarde le fichier .cast et ajoute-le au README avec un lien asciinema.
Alternative : utilise svg-term-cli pour générer un SVG animé pour le README.
```

---

## Prompts utiles (copier-coller dans Claude Code)

### Pour debug rapidement

```
Lis CLAUDE.md, puis lance npm run simulate et corrige toutes les erreurs jusqu'à ce que ça marche.
```

### Pour ajouter une entreprise

```
Ajoute l'entreprise [NOM] au répertoire dans src/lookup/company-finder.ts.
Numéro service client : [NUMERO]
Pays : [FR/US/...]
Catégorie : [streaming/telecom/energy/...]
Tips IVR : [TIPS si connus]
```

### Pour ajouter une langue

```
Ajoute le support de la langue [LANGUE] dans :
1. src/core/agent.ts — detectLanguage() et detectStrategy()
2. src/core/strategy-engine.ts — toutes les stratégies
3. src/core/ivr-navigator.ts — patterns IVR
4. src/core/voice-pipeline.ts — detectAction() patterns

Suis le modèle exact du français (fr) pour la nouvelle langue.
```

### Pour améliorer une stratégie

```
Améliore la stratégie de [cancel/negotiate/complain] dans src/core/strategy-engine.ts.
Ajoute des tactiques plus sophistiquées, basées sur les techniques de négociation professionnelle.
Garde le ton poli mais ferme. Ne jamais mentir ou menacer.
```
