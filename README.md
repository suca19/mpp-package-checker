# 🛡️ Package Checker

A paid API for AI coding agents. Before running `npm install` or `pip install`, the agent pays **0.01** over the
[Machine Payments Protocol](https://mpp.dev) (HTTP 402, Tempo testnet) and gets **SAFE / CAUTION / BLOCK** with reasons.

## What one check covers
| Signal | Level | Source |
|---|---|---|
| Package does not exist (AI-invented name, "slopsquatting" risk) | BLOCK | npm registry / PyPI |
| Reported as malware, or replaced by a registry "security holding" placeholder | BLOCK | OSV.dev, npm |
| Lookalike of a popular package with few users (typosquat, e.g. `lodahs` vs `lodash`) | BLOCK | name comparison |
| Brand new (< 30 days) or almost no downloads (< 100/week) | CAUTION | registry, download stats |
| Runs code on install (npm install scripts, PyPI source-only release) | CAUTION | registry |
| Known security holes in that version, deprecated or yanked | CAUTION | OSV.dev, registry |

## Run it
```bash
cp .env.example server/.env        # fill in MPP_SECRET_KEY and MPP_RECIPIENT
npm run build && npm start         # http://127.0.0.1:3000
```

## Try it
```bash
curl -i "http://localhost:3000/check?ecosystem=npm&name=lodahs"          # 402: the price tag
set -a && . ./.env.payer && set +a                                        # load the test payer wallet
npx mppx "http://localhost:3000/check?ecosystem=npm&name=lodahs" --network testnet
npx mppx validate http://localhost:3000 --query ecosystem=npm --query name=lodash
```

| Demo | Verdict | Why |
|---|---|---|
| `npm/lodahs` | BLOCK | real malware (crypto-wallet stealer), now a security placeholder; lookalike of lodash |
| `npm/expresss` | BLOCK | lookalike of express with few users |
| `pypi/huggingface-cli` | BLOCK | does not exist: a name AI assistants invent |
| `npm/lodash@4.17.15` | CAUTION | 5 known security holes in that version |
| `pypi/requests`, `npm/lodash` | SAFE | no red flags |

Verified 2026-11-11: paid flow on Tempo testnet works (402 → pay → 200 + `Payment-Receipt`), `mppx validate` 29 passed / 0 failed.

## Limits
Prototype on testnet (no real money). The popular-package list for lookalike detection is hand-picked (~100 per ecosystem).
Signals come from public data; SAFE means "no red flags found", not a guarantee.
