<p align="center">
  <br />
  <code style="font-size: 3rem;"><b>NOPE.</b></code>
  <br />
  <br />
  <b>Open-source AI that calls companies so you don't have to.</b>
  <br />
  Cancel subscriptions · Negotiate bills · File complaints — hands free.
  <br />
  <br />
  <a href="#quick-start">Quick Start</a> · <a href="#demo">Demo</a> · <a href="#how-it-works">How It Works</a> · <a href="https://github.com/guillaume-flambard/nope/issues">Issues</a>
  <br />
  <br />
  <img src="https://img.shields.io/badge/license-MIT-B5FF4A?style=flat-square" />
  <img src="https://img.shields.io/badge/PRs-welcome-B5FF4A?style=flat-square" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-B5FF4A?style=flat-square" />
</p>

---

The average person spends **43 days of their life on hold**. 87% of people dread calling customer service. Pine AI charges you. Vibrato takes a cut.

**Nope is free. Forever. Open source.**

You say what you want. Nope finds the number, navigates the phone menu, waits on hold, talks to the human, and gets it done.

## Demo

```bash
$ npx nope "Cancel my Netflix subscription"

  NOPE.  v0.1.0

  SYSTEM  Looking up Netflix...
  SYSTEM  Found: Netflix — +1-844-505-2993
  SYSTEM  Strategy: cancel — 6 tactics loaded
  SYSTEM  Calling +1-844-505-2993...
  IVR     Welcome to Netflix. This call may be recorded.
  IVR     For order tracking, press 1. For billing, press 2. For cancellations, press 3.
  NOPE    (Pressing 3)
  IVR     Your call is important. Please stay on the line...
  SYSTEM  ♪ Hold music... (2min 15s)
  AGENT   Hello, this is Sarah from Netflix. How can I help you?
  NOPE    Hi Sarah. I'm calling to cancel my Netflix subscription, please.
  AGENT   May I ask why? We have an offer that could interest you...
  NOPE    Thank you, but my decision is final. Personal reasons.
  AGENT   What if I offered you 50% off for 3 months?
  NOPE    No thank you. I really want to cancel today.
  AGENT   Alright. Your confirmation number is NP-X7K2M9.

  ─────────────────────────────────────

  ✓ Done.
  Netflix cancellation confirmed. Ref: NP-X7K2M9.

  Duration: 4m 23s
  Cost:     $0.032
```

Works in French too:

```bash
$ npx nope "Résilie mon abonnement Canal+"
```

## Quick Start

### Simulation Mode (no API keys needed)

```bash
# Run directly with npx
npx nope "Cancel my Netflix subscription"

# Or clone and run locally
git clone https://github.com/guillaume-flambard/nope.git
cd nope
npm install
npm run simulate
```

### Web Dashboard

```bash
npm run server
# Open http://localhost:4000
```

### Live Mode (real calls)

```bash
cp .env.example .env
# Add your API keys to .env:
# - OPENAI_API_KEY (required)
# - TWILIO_ACCOUNT_SID + AUTH_TOKEN + PHONE_NUMBER (required for real calls)
# - DEEPGRAM_API_KEY (optional, better speech recognition)
# - ELEVENLABS_API_KEY (optional, more natural voice)

npx nope "Cancel my Netflix subscription"
```

## How It Works

```
"Cancel my Netflix"
        │
        ▼
  ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
  │  NLP Parser  │ ──▶ │Company Finder│ ──▶ │ Strategy Engine│
  │  Language    │     │  Directory   │     │  Cancel        │
  │  Intent      │     │  Web Search  │     │  Negotiate     │
  │  Company     │     │  35+ known   │     │  Complain      │
  └─────────────┘     └──────────────┘     └───────────────┘
                                                   │
        ┌──────────────────────────────────────────┘
        ▼
  ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
  │   Caller     │ ──▶ │IVR Navigator │ ──▶ │ Voice Pipeline│
  │  Twilio API  │     │ Menu parsing │     │  STT → LLM →  │
  │  Simulation  │     │ Key pressing │     │  TTS pipeline  │
  │              │     │ Loop detect  │     │  Multi-provider│
  └─────────────┘     └──────────────┘     └───────────────┘
        │
        ▼
  ┌─────────────┐
  │   Result     │
  │  Transcript  │
  │  Cost report │
  │  Savings     │
  └─────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Discovery** | Give it a company name → finds the phone number automatically |
| **IVR Navigation** | Understands phone menus, presses the right buttons |
| **Smart Strategies** | Built-in tactics for cancellation, negotiation, complaints |
| **Multi-Language** | English, French, Spanish, German |
| **100% Local** | Your data stays on your machine |
| **Real-Time Stream** | Watch the entire call live (web dashboard or terminal) |
| **35+ Companies** | Netflix, Canal+, SFR, Orange, Comcast, EDF, Adobe... |
| **Simulation Mode** | Test everything without making real calls |
| **Multi-Provider** | OpenAI, Anthropic, Deepgram, ElevenLabs |

## Comparison

|  | NOPE. | Pine AI | Vibrato |
|--|-------|---------|---------|
| **Price** | Free (MIT) | Paid plans | % of savings |
| **Open Source** | ✅ | ❌ | ❌ |
| **Privacy** | 100% local | Cloud | Cloud |
| **Self-Hosted** | ✅ | ❌ | ❌ |
| **Custom Strategies** | ✅ Contribute yours | Fixed | Fixed |
| **Multi-Language** | EN FR ES DE | EN only | EN only |
| **Transparency** | Full transcript | Summary | Summary |

## Architecture

```
nope/
├── src/
│   ├── cli.ts                  # CLI entry point
│   ├── core/
│   │   ├── types.ts            # Type system
│   │   ├── agent.ts            # Main orchestrator
│   │   ├── voice-pipeline.ts   # STT → LLM → TTS
│   │   ├── ivr-navigator.ts    # Phone menu intelligence
│   │   ├── caller.ts           # Twilio + simulator
│   │   └── strategy-engine.ts  # Conversation strategies
│   ├── lookup/
│   │   └── company-finder.ts   # Phone number discovery
│   └── web/
│       ├── server.ts           # Express + SSE API
│       └── public/
│           └── index.html      # Web dashboard
├── .env.example
├── package.json
└── tsconfig.json
```

## API

### CLI

```bash
nope <goal>                      # Execute a goal
nope call "<goal>" --simulate    # Simulate a call
nope server                      # Start web dashboard
nope companies                   # List known companies
```

### HTTP

```bash
# Start a call
POST /api/call
{ "goal": "Cancel my Netflix", "simulate": true }

# Stream events (SSE)
GET /api/call/:id/stream

# Get call status
GET /api/call/:id

# List companies
GET /api/companies

# Health check
GET /api/health
```

## Contributing

Nope gets better with every contribution. Here's how you can help:

**Add a company** — Add phone numbers to `src/lookup/company-finder.ts`

**Add a language** — Extend patterns in `strategy-engine.ts` and `ivr-navigator.ts`

**Improve strategies** — Better negotiation tactics in `strategy-engine.ts`

**Fix IVR patterns** — More phone menu patterns in `ivr-navigator.ts`

```bash
git clone https://github.com/guillaume-flambard/nope.git
cd nope
npm install
npm run dev -- call "Cancel my Netflix" --simulate
```

## Cost Breakdown

In simulation mode: **$0** (no API calls).

In live mode with default providers:

| Component | Cost |
|-----------|------|
| Twilio (phone) | ~$0.015/min |
| OpenAI Whisper (STT) | ~$0.006/min |
| GPT-4o-mini (reasoning) | ~$0.001/call |
| OpenAI TTS | ~$0.015/min |
| **Total** | **~$0.04/min** |

Average call: 4 minutes = **$0.16**

With cheaper alternatives (Deepgram + local models): even less.

## FAQ

**Is this legal?**
Yes. You're authorizing Nope to call on your behalf — just like asking a friend to call for you.

**Does it actually work?**
Simulation mode works out of the box. Live mode requires Twilio + OpenAI API keys. The voice pipeline is production-ready.

**Why not just use Pine AI?**
Pine AI is a paid, closed-source service. Nope is free, open source, and your data never leaves your machine.

**Can I add my own company?**
Yes! Add it to the directory in `company-finder.ts` and open a PR.

## License

MIT — do whatever you want.

---

<p align="center">
  <b>Life's too short for hold music.</b>
  <br />
  <i>Just say nope.</i>
</p>
