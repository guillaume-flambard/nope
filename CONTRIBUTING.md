# Contributing to NOPE.

First off — thank you for wanting to help. NOPE. is built by people who hate hold music, and we're glad you're one of us.

## Getting Started

```bash
git clone https://github.com/guillaume-flambard/nope.git
cd nope
bun install
cp .env.example .env
bun run simulate   # run a simulated call
bun run test       # run tests
```

No API keys are needed for simulation mode.

## What Can I Work On?

Check [open issues](https://github.com/guillaume-flambard/nope/issues) or pick from these areas:

### Add a Company

Edit `src/lookup/company-finder.ts` and add an entry to the directory:

```typescript
{ name: 'Acme Corp', phone: '+1-800-555-0100', country: 'US', category: 'telecom', language: 'en' }
```

Include IVR hints if you know the menu shortcuts. Only add **publicly available** customer service numbers.

### Add a Language

NOPE. currently supports: EN, FR, ES, DE, IT.

To add a new language:

1. Add the code to `Language` type in `src/core/types.ts`
2. Add detection patterns in `src/core/agent.ts` (`parseGoal`)
3. Add simulation dialogue in `src/core/caller.ts` (follow the `loc()` pattern)
4. Add LLM prompts in `src/core/voice-pipeline.ts` (`buildSystemPrompt`)
5. Add voice action patterns in `src/core/voice-pipeline.ts` (`detectAction`)
6. Add strategy localization in `src/core/strategy-engine.ts`

### Add a Strategy

Strategies live in `src/core/strategy-engine.ts`. Each strategy defines:
- System prompt for the LLM
- Opening line
- Tactics (list of negotiation techniques)
- Success criteria
- IVR target keywords

### Improve Tests

Tests are in `src/core/__tests__/` and `src/lookup/__tests__/`. We use Vitest. Run with:

```bash
bun run test
```

## Pull Request Guidelines

1. **One thing per PR** — don't mix a bug fix with a new feature
2. **Write tests** for new functionality
3. **Run `bun run test` and `bunx tsc --noEmit`** before pushing
4. **Keep the tone** — read the README and match the voice (irreverent, direct, human)
5. **No secrets** — never commit API keys, tokens, or credentials

## Code Style

- TypeScript strict mode
- `async/await` everywhere (no callbacks)
- Types go in `src/core/types.ts`
- One class per file
- English comments, structured with `// ── Section ──` blocks
- No `any` (except `NopeEvent.data`)

## Commit Messages

Keep them short and descriptive:

```
add Vodafone to company directory
fix IVR loop detection for German menus
```

## Questions?

Open an issue or start a discussion. We don't bite (but we might put you on hold).
