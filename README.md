# 🛡️ Package Checker

A paid API for AI coding agents. Before running `npm install` or `pip install`, the agent pays **0.01** over the
[Machine Payments Protocol](https://mpp.dev) (HTTP 402, Tempo testnet) and gets **SAFE / CAUTION / BLOCK** with reasons.

**Live:** https://mpp-package-checker-production.up.railway.app (Railway, Tempo testnet)

```bash
npx mppx "https://mpp-package-checker-production.up.railway.app/check?ecosystem=npm&name=lodahs" --network testnet
```

**Watch agents pay live:** https://mpp-package-checker-production.up.railway.app/live (each paid check with verdict, payer wallet and a link to the payment on the Tempo explorer).

## Watch a Gemini agent pay (`/agent`)
Type a request ("pip install reqeusts please"). A Gemini coding agent (`server/src/agent.ts`, function calling) decides which
packages to check and pays `/check` with its own testnet wallet before recommending anything. The page shows Gemini's answer
and one **payment receipt** per check (amount, from/to wallets, transaction link). **▶ Show how it was done** replays the
process slide by slide between four actors (You · Gemini agent · Package Checker · Tempo blockchain): ① visit → ② 402 price
tag → signs → ③ retry with payment → ④ payment confirmed on-chain → check runs → ⑤ 200 + verdict → answer. Paid checks also appear on `/live`,
labelled "Gemini agent". Limits: 5 paid checks per request, 4 runs/minute per visitor, 60 runs/hour overall.
Needs `GEMINI_API_KEY` and the agent wallet (`AGENT_PRIVATE_KEY`, or `MPPX_PRIVATE_KEY` in `.env.payer` locally).

Tested 2026-11-11 (locally): lodahs → BLOCK; huggingface-cli → BLOCK, suggests huggingface_hub; reqeusts → BLOCK, then Gemini
paid for a second check of requests → SAFE; express + dotenv → SAFE, SAFE. About 5 s per request.

## Claude Code pays by itself (MCP tool)
`mcp/server.ts` gives Claude Code a `check_package` tool, registered in `.mcp.json`. When Claude Code is about to install a
package, it calls the tool; the tool pays 0.01 from the test wallet in `.env.payer` (the key never reaches the model) and
returns the verdict, the receipt and an explorer link. Safety: testnet only, max 25 paid checks per session, only talks to
localhost or this project's Railway URL.
```bash
npm install --prefix mcp                     # once
claude                                       # in this folder; approve the "package-checker" MCP server
> install lodahs for me                      # Claude checks first, pays, gets BLOCK and refuses
```

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

Verified 2026-11-11: paid flow on Tempo testnet works (402 → pay → 200 + `Payment-Receipt`), `mppx validate` 29 passed / 0 failed, both locally and on the live Railway URL.

## Limits
Prototype on testnet (no real money). The popular-package list for lookalike detection is hand-picked (~100 per ecosystem).
Signals come from public data; SAFE means "no red flags found", not a guarantee.
