# NOPE. — Spécification Technique Complète

## 1. Vue d'ensemble

NOPE. est un agent IA qui passe des appels téléphoniques à la place de l'utilisateur. Il gère automatiquement les menus téléphoniques (IVR), l'attente, et la conversation avec les agents humains pour résilier des abonnements, négocier des factures, ou déposer des réclamations.

### Positionnement

Alternative open-source et gratuite à Pine AI (19pine.ai) et Vibrato (getvibrato.com), qui sont des services payants et propriétaires.

### Différenciateurs

| Axe | NOPE. | Concurrents |
|-----|-------|------------|
| Prix | Gratuit (MIT) | Payant / % des économies |
| Code | Open source | Propriétaire |
| Données | 100% local | Cloud |
| Langues | EN, FR, ES, DE | EN seulement |
| Extensibilité | Communauté peut ajouter entreprises, stratégies, langues | Fixe |

---

## 2. Flux d'exécution détaillé

### 2.1 Parsing du goal

```
Input: "Résilie mon abonnement Canal+"
                │
                ▼
        ┌───────────────┐
        │ detectLanguage │ → "fr" (basé sur mots-clés fr/en/es/de)
        └───────┬───────┘
                │
        ┌───────────────┐
        │ detectStrategy │ → "cancel" (match sur "résilie")
        └───────┬───────┘
                │
        ┌────────────────┐
        │ extractCompany  │ → "Canal+" (match dictionnaire known companies)
        └───────┬────────┘
                │
                ▼
        CallTask {
          id: "a7f3b2c1",
          goal: "Résilie mon abonnement Canal+",
          company: "Canal+",
          strategy: "cancel",
          language: "fr",
          createdAt: Date
        }
```

**Algorithme de détection de langue :**
- Score chaque langue par nombre de mots-clés détectés
- Mots FR : "mon", "ma", "résilie", "abonnement", "facture"...
- Mots EN : "my", "cancel", "subscription", "bill"...
- Fallback : anglais

**Algorithme d'extraction d'entreprise :**
1. Match exact dans la liste des 40+ entreprises connues (case-insensitive)
2. Match partiel (la requête contient le nom)
3. Fallback : premier mot capitalisé qui n'est pas un stop-word

### 2.2 Recherche du numéro

```
CompanyFinder.find("Canal+")
        │
        ├─ 1. Match exact dans DIRECTORY[] → ✅ Found
        │     Retourne { name: "Canal+", phone: "+33-890-090-900", ... }
        │
        ├─ 2. Match fuzzy (Levenshtein ≤ 2) → si pas d'exact
        │
        └─ 3. Recherche web Google → si pas dans le répertoire
              Parse HTML, extrait regex téléphone, retourne le premier valide
```

### 2.3 Sélection de stratégie

Chaque `StrategyType` génère un objet `Strategy` contenant :
- `systemPrompt` — Instructions pour le LLM (persona, règles)
- `openingLine` — Première phrase à dire à l'agent humain
- `tactics` — Liste de tactiques (ancrage, concurrence, silence...)
- `successCriteria` — Patterns regex pour détecter le succès
- `failureHandling` — Quoi faire si ça échoue
- `ivrTarget` — Mots-clés pour naviguer le menu IVR vers le bon service

### 2.4 Appel (mode simulation)

```
Caller.simulate(task, strategy, onEvent)
        │
        ├─ Phase 1: Dialing (1.5s pause)
        │   emit: status=dialing
        │
        ├─ Phase 2: IVR (3-5s)
        │   emit: status=ivr
        │   - Message d'accueil
        │   - Menu langue (si FR → appui 1)
        │   - Menu principal → appui sur la touche correspondant à la strategy
        │
        ├─ Phase 3: Hold (5s)
        │   emit: status=holding
        │   - Message "votre appel est important"
        │   - Musique d'attente simulée
        │
        ├─ Phase 4: Agent humain
        │   emit: status=talking → negotiating
        │   - L'agent se présente
        │   - NOPE expose le goal
        │   - L'agent tente la rétention (cancel) ou refuse la remise (negotiate)
        │   - NOPE applique les tactiques de la strategy
        │   - Résolution
        │
        └─ Phase 5: Résultat
            emit: status=success/failed
            return: { success, summary, savings? }
```

### 2.5 Appel (mode live — Twilio)

```
Caller.call(phoneNumber, task)
        │
        ▼
Twilio API: calls.create({
  to: phoneNumber,
  from: TWILIO_PHONE_NUMBER,
  url: "/api/twilio/voice",           ← Webhook TwiML
  statusCallback: "/api/twilio/status" ← Status updates
})
        │
        ▼
Twilio appelle le numéro, puis requête POST vers /api/twilio/voice
        │
        ▼
Serveur retourne TwiML avec <Connect><Stream> vers WebSocket
        │
        ▼
WebSocket bidirectionnel :
  Twilio → audio entrant (base64 mulaw) → STT → texte
  texte → LLM (avec strategy prompt) → réponse texte
  réponse texte → TTS → audio sortant → Twilio
        │
        ▼
En parallèle : IVRNavigator analyse le texte STT
  Si menu détecté → envoie DTMF via Twilio API
  Si hold détecté → attend silencieusement
  Si humain détecté → active la strategy conversation
```

---

## 3. API HTTP

### POST /api/call

Démarre un appel.

```json
// Request
{
  "goal": "Cancel my Netflix subscription",
  "simulate": true
}

// Response
{
  "callId": "a7f3b2c1",
  "status": "started"
}
```

### GET /api/call/:id/stream

Server-Sent Events (SSE). Chaque événement :

```
data: {"type":"status","timestamp":"...","taskId":"a7f3b2c1","data":{"status":"dialing"}}

data: {"type":"transcript","timestamp":"...","taskId":"a7f3b2c1","data":{"speaker":"ivr","text":"Welcome to Netflix..."}}

data: {"type":"result","timestamp":"...","taskId":"a7f3b2c1","data":{"status":"success","summary":"...","duration":263,"cost":{"total":0.032}}}
```

### GET /api/call/:id

Retourne l'état actuel d'un appel.

### GET /api/companies

Retourne la liste complète du répertoire.

### GET /api/health

Health check avec info providers.

---

## 4. Navigation IVR — Algorithme détaillé

L'`IVRNavigator` utilise cette logique :

```
analyze(prompt, goalType, language, hints?)
    │
    ├─ 1. Check known hints (shortcuts fournis par CompanyInfo)
    │     Si match → press_key avec confidence 0.95
    │
    ├─ 2. Detect language menu ("pour le français, appuyez sur 1")
    │     Si match → press_key pour la langue cible
    │
    ├─ 3. Parse menu options (regex "press X for Y" / "tapez X pour Y")
    │     Score chaque option selon keywords de la strategy
    │     Si best score > 0 → press_key
    │
    ├─ 4. Detect menu loop (string similarity > 0.8 avec 2 derniers menus)
    │     Si loop → press_zero (opérateur)
    │
    ├─ 5. Max attempts atteint (5) ?
    │     Si oui → press_zero (opérateur)
    │
    └─ 6. Default → wait (écouter plus d'options)
```

---

## 5. Pipeline Voice — Flux audio

```
Audio entrant (Twilio WebSocket, mulaw 8kHz)
    │
    ▼
Buffer accumulation (300ms chunks)
    │
    ▼
STT Provider (Deepgram streaming ou OpenAI Whisper batch)
    │
    ▼
Texte transcrit
    │
    ├─ detectAction() → hold_music? ivr_menu? transfer? success? human_agent?
    │     │
    │     ├─ hold_music/hold_message → ne rien dire, attendre
    │     ├─ ivr_menu → IVRNavigator.analyze() → envoyer DTMF
    │     ├─ transfer → attendre le nouvel agent
    │     ├─ success → marquer comme succès
    │     └─ human_agent → activer conversation strategy
    │
    ▼
LLM reasoning (GPT-4o-mini ou Claude)
    System prompt = buildSystemPrompt(strategy, context)
    Messages = conversation history
    Max tokens = 150 (réponses courtes !)
    │
    ▼
Texte de réponse
    │
    ▼
TTS Provider (OpenAI TTS-1 ou ElevenLabs multilingual v2)
    │
    ▼
Audio sortant → Twilio WebSocket → téléphone
```

---

## 6. Stratégies de conversation

### Cancel (Résiliation)

- **Persona** : Client déterminé, poli mais ferme
- **Opening** : "Je souhaite résilier mon abonnement"
- **Tactiques** :
  1. Rester poli mais inébranlable
  2. Offre de rétention → "Non merci, ma décision est prise"
  3. Insistance → "Raisons personnelles"
  4. Transfert → accepter et recommencer
  5. Toujours demander un numéro de confirmation
- **Succès** : "résiliation confirmée", "numéro de confirmation"
- **Échec** : Après 3 tentatives → demander un superviseur

### Negotiate (Négociation)

- **Persona** : Client fidèle qui explore ses options
- **Opening** : "Ma facture semble élevée, y a-t-il de meilleures offres ?"
- **Tactiques** :
  1. Ancrage : mentionner un tarif 30% plus bas
  2. Concurrence : "J'ai vu que [concurrent] propose..."
  3. Loyauté : "Je suis client depuis X ans"
  4. Silence stratégique : pause après leur offre
  5. Objectif minimum : 15% de réduction
- **Succès** : "nouveau tarif", "réduction appliquée"
- **Échec** : Mentionner un possible départ

### Complain (Réclamation)

- **Persona** : Client factuel et assertif
- **Opening** : "J'ai un problème avec mon service"
- **Tactiques** :
  1. Décrire le problème factuellement
  2. Mentionner dates et références
  3. Demander compensation
  4. Si refus → superviseur
  5. Mentionner droits consommateur si nécessaire
- **Succès** : "remboursement", "dossier ouvert"

---

## 7. Répertoire d'entreprises

35+ entreprises pré-enregistrées dans les catégories :

- **Streaming** : Netflix, Spotify, Disney+, Canal+, OCS, Hulu, HBO Max, Apple TV+, YouTube Premium, Deezer
- **Telecom FR** : SFR, Orange, Free, Bouygues
- **Telecom US** : Comcast, Xfinity, AT&T, Verizon, T-Mobile
- **Énergie FR** : EDF, Engie, TotalEnergies
- **Assurance** : AXA, Allianz, MAIF, Groupama
- **Software** : Adobe, Microsoft, Dropbox
- **Fitness** : Planet Fitness, Basic Fit
- **Livraison** : Uber Eats, Deliveroo, DoorDash

Chaque entrée contient : `name, phone, country, category, language, ivrHints?, tips?`

Fallback : recherche Google pour les entreprises non répertoriées.

---

## 8. Coûts estimés (mode live)

| Composant | Fournisseur | Coût |
|-----------|-------------|------|
| Téléphonie | Twilio | ~$0.015/min |
| STT | OpenAI Whisper | ~$0.006/min |
| STT | Deepgram Nova-2 | ~$0.0043/min |
| LLM | GPT-4o-mini | ~$0.001/appel |
| LLM | Claude Sonnet | ~$0.003/appel |
| TTS | OpenAI TTS-1 | ~$0.015/min |
| TTS | ElevenLabs | ~$0.018/min |

**Appel moyen (4 min)** : $0.12 — $0.18

---

## 9. Sécurité & Éthique

- L'IA ne ment jamais sur sa nature si directement interrogée ("Êtes-vous un robot ?")
- Les stratégies de négociation sont éthiques : pas de menaces, pas de fausses déclarations
- Les données de l'utilisateur restent 100% locales
- Aucune donnée n'est envoyée à des tiers (sauf les providers API choisis par l'utilisateur)
- Les transcriptions ne sont stockées qu'en mémoire pendant la session (pas de persistance par défaut)
- Les numéros de téléphone dans le répertoire sont tous des numéros de service client publics
