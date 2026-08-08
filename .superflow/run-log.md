# Run log — nope (superflow T3 baseline, 2026-08-08)
| check | result |
|---|---|
| git | yes |
| last commit | 2026-02-19 |
| working tree | 12 uncommitted (.github issue/PR templates + ci.yml A, CONTRIBUTING A, src/* M) · node_modules ignored: yes |
| tooling | test:`test` lint:`lint` typecheck:n/a build:`build` (also dev, start, server, simulate, clean, prepublishOnly) |
| deps | bun.lock present · deps NOT installed (no `node_modules`) |
| gates run | none (no deps) |
| verdict | pending |
| debt | 12 uncommitted files (CI + contrib docs + src changes uncommitted); bun deps not installed, would need `bun install`. |
