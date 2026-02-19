# CLAUDE.md — Instructions pour Claude Code

## Projet

**NOPE.** — IA open-source qui appelle les entreprises à ta place. Résiliation, négociation, réclamation — mains libres.

Repo : `nope-ai/nope`
Licence : MIT
Stack : TypeScript, Node.js ≥ 18, Express, Twilio, OpenAI, Deepgram, ElevenLabs

## Structure

```
nope/
├── src/
│   ├── cli.ts                  # Point d'entrée CLI (chalk + ora)
│   ├── core/
│   │   ├── types.ts            # Système de types complet
│   │   ├── agent.ts            # Orchestrateur principal (NopeAgent)
│   │   ├── voice-pipeline.ts   # Pipeline STT → LLM → TTS
│   │   ├── ivr-navigator.ts    # Navigation menus téléphoniques
│   │   ├── caller.ts           # Twilio + mode simulation
│   │   └── strategy-engine.ts  # Stratégies de conversation
│   ├── lookup/
│   │   └── company-finder.ts   # Répertoire entreprises + recherche web
│   └── web/
│       ├── server.ts           # Express + SSE temps réel
│       └── public/
│           └── index.html      # Dashboard web (UI NOPE.)
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── CLAUDE.md                   # Ce fichier
```

## Commandes

```bash
npm install              # Installer les dépendances
npm run build            # Compiler TypeScript → dist/
npm run dev              # Lancer en dev (ts-node)
npm run simulate         # Lancer un appel simulé
npm run server           # Lancer le serveur web (http://localhost:4000)
npm run lint             # Linter
npm run clean            # Nettoyer dist/
```

## Conventions de code

- TypeScript strict mode activé
- Target ES2022, module CommonJS
- Imports : chemins relatifs, pas d'alias
- Types : tous dans `src/core/types.ts`, exportés nommés (pas de `default`)
- Classes : une classe par fichier, nom = nom du fichier en PascalCase
- Async/await partout (pas de callbacks)
- Gestion d'erreurs : try/catch dans les méthodes publiques, propagation propre
- Pas de `any` sauf dans les types d'événements génériques (`NopeEvent.data`)
- Commentaires : en anglais, blocs `// ── Section ──` pour structurer
- Console output : toujours via chalk dans le CLI, jamais de console.log nu

## Architecture

### Flux d'un appel

```
User goal (string)
    │
    ▼
NopeAgent.execute(goal)
    │
    ├─ 1. parseGoal() → CallTask (language, strategy, company)
    │
    ├─ 2. CompanyFinder.find() → phone number
    │
    ├─ 3. StrategyEngine.getStrategy() → Strategy object
    │
    ├─ 4. Caller.simulate() ou Caller.call()
    │     │
    │     ├─ IVR phase → IVRNavigator.analyze()
    │     ├─ Hold phase → wait
    │     └─ Talk phase → VoicePipeline.processAudio()
    │
    └─ 5. Return CallResult (status, transcript, cost, savings)
```

### Événements (SSE)

L'agent émet des `NopeEvent` via `agent.on(handler)`. Types :
- `status` → changement d'état (preparing, dialing, ivr, holding, talking, negotiating, success, failed)
- `transcript` → nouvelle ligne de conversation (speaker + text + action)
- `result` → résultat final (CallResult)
- `error` → erreur
- `cost` → mise à jour des coûts

### Providers

Le projet supporte plusieurs providers pour chaque composant :

| Composant | Provider par défaut | Alternatives |
|-----------|-------------------|-------------|
| STT | OpenAI Whisper | Deepgram Nova-2 |
| LLM | GPT-4o-mini | Claude (Anthropic) |
| TTS | OpenAI TTS-1 | ElevenLabs |
| Téléphonie | Twilio | (simulation intégrée) |

La sélection est automatique selon les clés API présentes dans `.env`.

## Branding / DA

### Couleurs
- `--green: #B5FF4A` — Nope Green (accent principal)
- `--rose: #FF4A6E` — Kill Rose (actions destructives)
- `--cyan: #4AF0FF` — Signal Cyan (info)
- `--black: #09090B` — Void Black (background)
- `--surface: #18181B` — Surface (cards)

### Typography
- Logo + Headings : JetBrains Mono 800
- Body : Inter
- Code / Terminal : JetBrains Mono 400

### Ton
- Irrévérencieux, confiant, "on your side"
- Pas corporate, pas d'enterprise jargon
- Exemples : "Life's too short for hold music.", "Just say nope."

## Ce qui fonctionne déjà

- ✅ Système de types complet
- ✅ Orchestrateur avec parsing NLP (langue, intention, entreprise)
- ✅ Mode simulation réaliste (IVR → hold → agent → négociation)
- ✅ Répertoire 35+ entreprises avec numéros vérifiés
- ✅ Stratégies cancel, negotiate, complain, appointment, inquiry
- ✅ Navigation IVR intelligente (parsing menus, détection boucles)
- ✅ Pipeline voice multi-provider (STT, LLM, TTS)
- ✅ Serveur Express avec API REST + SSE
- ✅ Dashboard web avec DA NOPE.
- ✅ CLI avec output coloré
- ✅ README GitHub-ready

## Ce qui reste à faire (par priorité)

### P0 — Faire tourner le projet proprement

1. **Faire compiler le TypeScript sans erreur** — Résoudre les erreurs de types liées aux imports de modules externes (twilio, express, etc.). Ajouter les `@types/*` nécessaires ou des déclarations de modules.
2. **Tester le mode simulation end-to-end** — `npm run simulate` doit fonctionner et afficher une simulation complète dans le terminal.
3. **Tester le serveur web** — `npm run server` doit servir le dashboard sur localhost:4000, et un appel simulé via l'UI doit streamer les événements en temps réel.

### P1 — Rendre le live mode fonctionnel

4. **Intégrer le WebSocket Twilio** — Dans `caller.ts`, implémenter la connexion WebSocket bidirectionnelle pour l'audio en temps réel. Twilio envoie l'audio de l'appel via WebSocket, il faut le router vers `VoicePipeline`.
5. **Pipeline audio complet** — Connecter le flux : Twilio WebSocket audio → Deepgram/Whisper STT → LLM reasoning → TTS → renvoi audio vers Twilio.
6. **Gestion DTMF** — Envoyer des tonalités DTMF via l'API Twilio quand l'IVR Navigator décide d'appuyer sur une touche.
7. **Détection fin d'appel** — Gérer les événements Twilio statusCallback (completed, busy, failed, no-answer).

### P2 — Robustesse

8. **Gestion d'erreurs exhaustive** — Timeouts, reconnexions, fallbacks si un provider est down.
9. **Tests unitaires** — Au minimum pour : `parseGoal()`, `IVRNavigator.analyze()`, `CompanyFinder.find()`, `StrategyEngine.getStrategy()`. Utiliser Jest ou Vitest.
10. **Logging structuré** — Remplacer les console.log par un logger (winston ou pino) avec niveaux de log.
11. **Rate limiting** — Limiter le nombre d'appels simultanés côté API.

### P3 — Features pour le lancement

12. **Enregistrement des appels** — Sauvegarder les transcriptions et résultats dans un fichier local (JSON ou SQLite).
13. **npx support** — S'assurer que `npx nope-ai "Cancel my Netflix"` fonctionne directement sans installation globale.
14. **Docker** — Ajouter un Dockerfile pour faciliter le self-hosting.
15. **GitHub Actions CI** — Build + test automatiques sur chaque PR.
16. **Vidéo démo** — Enregistrer un screencast de 30 secondes montrant la simulation (pour le README et le tweet de lancement).

### P4 — Croissance communautaire

17. **CONTRIBUTING.md** — Guide de contribution détaillé.
18. **Templates GitHub** — Issue templates et PR templates.
19. **Ajouter plus d'entreprises** — Élargir le répertoire (UK, DE, ES, IT).
20. **Plugin system** — Permettre d'ajouter des strategies custom sans modifier le code source.

## Variables d'environnement

```env
# Requis
OPENAI_API_KEY=sk-...

# Requis pour les vrais appels
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Optionnels (améliorent la qualité)
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ANTHROPIC_API_KEY=sk-ant-...

# Config
PORT=4000
HOST=localhost
SIMULATE=true
```

## Notes importantes

- Le mode simulation (`SIMULATE=true` ou `--simulate`) ne fait AUCUN appel réel et ne nécessite AUCUNE clé API. C'est le mode par défaut.
- Le répertoire d'entreprises dans `company-finder.ts` contient des numéros de service client PUBLICS. Ce ne sont pas des données sensibles.
- Le projet est en MIT. Aucune restriction sur l'utilisation commerciale.
- Les stratégies de négociation sont éthiques : on négocie poliment, on ne ment pas, on ne menace pas.
