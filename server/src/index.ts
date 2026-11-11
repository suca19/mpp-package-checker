import { config } from 'dotenv'
import { serve } from '@hono/node-server'
import { Hono, type MiddlewareHandler } from 'hono'
import { Credential, Receipt } from 'mppx'
import { Mppx, discovery, tempo } from 'mppx/hono'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { livePage } from './live.js'
import { agentPage } from './agent-page.js'
import { agentAvailable, agentWallet, runAgent } from './agent.js'
import { streamSSE } from 'hono/streaming'
import { BadRequest, checkPackage, type CheckResult, type Ecosystem } from './checks.js'

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })

const recipient = process.env.MPP_RECIPIENT as `0x${string}` | undefined
if (!recipient || !process.env.MPP_SECRET_KEY) {
  throw new Error('MPP_RECIPIENT and MPP_SECRET_KEY must be set in server/.env (see .env.example)')
}

const PRICE = '0.01'

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY,
  // Tempo testnet ("Moderato"): test stablecoins only, no real money.
  methods: [tempo.charge({ testnet: true, recipient })],
})

// npm and PyPI naming rules (npm: lowercase, optional @scope/; PyPI: letters, digits, . _ -)
const NPM_NAME = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/
const PYPI_NAME = /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/
const QuerySchema = z
  .object({
    ecosystem: z.enum(['npm', 'pypi']),
    name: z.string().min(1).max(214),
    version: z.string().regex(/^[A-Za-z0-9.+_-]{1,64}$/, 'invalid version').optional(),
  })
  .refine((q) => (q.ecosystem === 'npm' ? NPM_NAME : PYPI_NAME).test(q.name), {
    message: 'invalid package name for this ecosystem',
    path: ['name'],
  })

type Query = z.infer<typeof QuerySchema>
type Env = { Variables: { query: Query; result: CheckResult } }
const app = new Hono<Env>()

// One log line per request, so you can watch agents use the service.
app.use('*', async (c, next) => {
  const start = Date.now()
  const paid = (c.req.header('authorization') ?? '').startsWith('Payment ')
  await next()
  if (c.req.path === '/health') return
  const r = c.get('result')
  const note =
    c.res.status === 402 ? '💳 payment required (price tag sent)'
    : r ? `${paid ? '✅ paid' : 'free'} → ${r.ecosystem}/${r.name} ${r.verdict}`
    : c.res.status === 400 ? '❌ bad input (no charge)'
    : ''
  console.log(`${new Date().toLocaleTimeString('en-IE')}  ${c.req.method} ${c.req.path} → ${c.res.status} ${note} (${Date.now() - start} ms)`)
})

/** Checks the query BEFORE payment, so a bad request is never charged.
 *  Without a payment credential nothing can be charged, so we let the payment middleware
 *  answer 402 with the price tag (payment scanners call paid routes with no input and expect 402). */
const validate: MiddlewareHandler<Env> = async (c, next) => {
  const hasCredential = /^Payment\s/i.test(c.req.header('authorization') ?? '')
  const parsed = QuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    if (!hasCredential) return next()
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`).join('; ')
    return c.json({ error: `Invalid request: ${msg}. Example: /check?ecosystem=npm&name=lodash` }, 400)
  }
  c.set('query', parsed.data)
  await next()
}

// ── Payment log: the last paid checks, shown on /live. In memory only (resets when the server restarts). ──
interface Payment {
  time: string
  package: string
  verdict: string
  amount: string
  token: string
  payer: string | null
  agent: string | null
  tx: string | null
}
const payments: Payment[] = []
let totalPaid = 0
const TOKEN_NAMES: Record<string, string> = {
  '0x20c0000000000000000000006a37da5c996874be': 'OUSD',
  '0x20c0000000000000000000000000000000000000': 'pathUSD',
}

/** Runs around the payment middleware: after a paid 200, read the receipt (tx hash) and the payer's wallet. */
const recordPayment: MiddlewareHandler<Env> = async (c, next) => {
  await next()
  const result = c.get('result')
  if (c.res.status !== 200 || !result) return
  let tx: string | null = null
  let token = 'OUSD'
  let payer: string | null = null
  try {
    const r = Receipt.fromResponse(c.res) as { reference?: string; fundingCurrency?: string }
    tx = r.reference ?? null
    if (r.fundingCurrency) token = TOKEN_NAMES[r.fundingCurrency.toLowerCase()] ?? token
  } catch {}
  try {
    // source looks like "did:pkh:eip155:42431:0xABC…": the last part is the payer's wallet address
    payer = Credential.fromRequest(c.req.raw).source?.split(':').pop() ?? null
  } catch {}
  // Optional self-declared agent name (e.g. "Gemini agent"); only letters, digits, spaces, dashes.
  const agent = (c.req.header('x-agent-name') ?? '').replace(/[^\w -]/g, '').slice(0, 30) || null
  totalPaid++
  payments.unshift({
    time: new Date().toISOString(),
    package: `${result.ecosystem}/${result.name}${result.version ? `@${result.version}` : ''}`,
    verdict: result.verdict,
    amount: PRICE,
    token,
    payer,
    agent,
    tx,
  })
  payments.length = Math.min(payments.length, 50)
}

app.get('/health', (c) => c.json({ ok: true }))
app.get('/favicon.ico', (c) => c.body(null, 204))

app.get('/payments.json', (c) =>
  c.json({ recipient, total_paid_checks: totalPaid, total_earned: (totalPaid * Number(PRICE)).toFixed(2), payments }),
)

app.get(
  '/check',
  validate,
  recordPayment,
  mppx.charge({ amount: PRICE, description: 'Package safety check (npm or PyPI): SAFE / CAUTION / BLOCK with reasons' }),
  async (c) => {
    const q = c.get('query')
    if (!q) return c.json({ error: 'Invalid request. Example: /check?ecosystem=npm&name=lodash' }, 400)
    try {
      const result = await checkPackage(q.ecosystem as Ecosystem, q.name, q.version)
      c.set('result', result)
      return c.json(result)
    } catch (err) {
      if (err instanceof BadRequest) return c.json({ error: err.message }, 400)
      console.error('[check] upstream error:', (err as Error).message)
      return c.json({ error: 'A package registry did not answer. Please retry.' }, 502)
    }
  },
)

// ── Gemini agent demo: Gemini decides which packages to check and pays /check with its own testnet wallet. ──
// Rate limits protect the Gemini free tier and the test wallet: 4 runs per minute per visitor, 60 per hour overall.
const hits = new Map<string, number[]>()
let hourly: number[] = []
function allowRun(ip: string): boolean {
  const now = Date.now()
  const mine = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  hourly = hourly.filter((t) => now - t < 3_600_000)
  if (mine.length >= 4 || hourly.length >= 60) return false
  mine.push(now)
  hourly.push(now)
  hits.set(ip, mine)
  return true
}

app.get('/agent', (c) => c.html(agentPage(PRICE, recipient, agentWallet(), agentAvailable())))

app.get('/api/agent', (c) => {
  const prompt = (c.req.query('prompt') ?? '').trim().slice(0, 400)
  if (!prompt) return c.json({ error: 'prompt is required' }, 400)
  if (!agentAvailable()) return c.json({ error: 'The Gemini agent is not configured on this server.' }, 503)
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (!allowRun(ip)) return c.json({ error: 'Too many agent runs. Please wait a minute.' }, 429)
  // The agent pays this same server over loopback, exactly like an outside agent would over the internet.
  const selfUrl = `http://127.0.0.1:${port}`
  return streamSSE(c, async (stream) => {
    // Write events in order and wait for the last one before the stream closes.
    let writes: Promise<unknown> = Promise.resolve()
    await runAgent(prompt, selfUrl, (e) => {
      writes = writes.then(() => stream.writeSSE({ data: JSON.stringify(e) }))
    })
    await writes
  })
})

app.get('/live', (c) => c.html(livePage(new URL(c.req.url).origin, recipient, PRICE)))

app.get('/llms.txt', (c) => {
  const base = new URL(c.req.url).origin
  return c.text(`# Package Checker

> Paid API for AI coding agents: ask "is this package safe to install?" before running npm install or pip install.
> Payment: Machine Payments Protocol (MPP), HTTP 402. Tempo testnet, test stablecoins, no real funds.

## Price
- GET ${base}/check?ecosystem=npm|pypi&name=<package>[&version=<version>]: ${PRICE} per check.

## What is checked (one call)
- Does the package exist? Non-existent names are often invented by AI assistants and later registered by attackers ("slopsquatting").
- Malware reports (OSV.dev) and registry "security holding" placeholders.
- Lookalike names of popular packages (typosquatting), e.g. lodahs vs lodash.
- Age (brand-new packages), weekly downloads (almost no users).
- Install-time code: npm preinstall/install/postinstall scripts, PyPI source-only releases (setup.py runs).
- Known security holes in that version (OSV.dev), deprecated or yanked versions.

## Response
verdict (SAFE | CAUTION | BLOCK), summary, signals [{ id, level: block|caution|info, message, source }], facts, disclaimer.
Agent rule of thumb: BLOCK → do not install; CAUTION → tell the user and ask; SAFE → install.

## How to pay
1. GET the URL. You get 402 Payment Required with a WWW-Authenticate: Payment challenge.
2. Pay with any MPP client, e.g. \`npx mppx "${base}/check?ecosystem=npm&name=lodahs" --network testnet\`, and retry with Authorization: Payment <credential>.
3. You get 200 with the result and a Payment-Receipt header.
Invalid requests get 400 before any payment is taken.

## Discovery
- OpenAPI with payment info: ${base}/openapi.json
`)
})

app.get('/', (c) => {
  const base = new URL(c.req.url).origin
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Package Checker</title>
<style>:root{color-scheme:light dark}body{margin:0;font-family:system-ui,sans-serif;line-height:1.5;background:#0f1720;color:#e8edf3}
main{max-width:760px;margin:0 auto;padding:40px 16px}h1{margin:0}a{color:#7cc4ff}code,pre{font-family:ui-monospace,monospace}
pre{background:#1a2532;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all}.b{color:#ff7b72}.c{color:#f2cc60}.s{color:#7ee787}</style></head>
<body><main><h1>🛡️ Package Checker</h1>
<p>A paid API for AI coding agents. Before installing an npm or PyPI package, the agent pays <b>${PRICE}</b> over the <a href="https://mpp.dev">Machine Payments Protocol</a> (HTTP 402) and gets
<b class="s">SAFE</b>, <b class="c">CAUTION</b> or <b class="b">BLOCK</b> with reasons: malware reports, lookalike names, AI-invented names, brand-new packages, install-time code and known security holes.</p>
<pre>npx mppx "${base}/check?ecosystem=npm&name=lodahs" --network testnet</pre>
<p>See the price tag without paying: <code>curl -i "${base}/check?ecosystem=npm&name=lodahs"</code> → 402</p>
<p><b><a href="${base}/agent">🤖 Watch a Gemini agent pay for checks</a></b> · <b><a href="${base}/live">▶ All payments, live</a></b></p>
<p><a href="${base}/llms.txt">/llms.txt</a> · <a href="${base}/openapi.json">/openapi.json</a> · <a href="${base}/health">/health</a></p>
<p style="opacity:.7">Prototype on Tempo testnet: no real money. Automated signals from public data, not a guarantee.</p>
</main></body></html>`)
})

// Serves GET /openapi.json so agents (and `npx mppx validate`) can find the paid route and its price.
discovery(app, mppx, { auto: true, info: { title: 'Package Checker', version: '0.1.0' } })

const port = Number(process.env.PORT ?? 3000)
// Locally: only this laptop can reach it. On Railway (RAILWAY_ENVIRONMENT is set by Railway) or with
// PUBLIC_DEPLOY=1: listen on all interfaces so the platform can route traffic in.
const isPublic = Boolean(process.env.PUBLIC_DEPLOY || process.env.RAILWAY_ENVIRONMENT)
const hostname = process.env.HOST ?? (isPublic ? '0.0.0.0' : '127.0.0.1')
serve({ fetch: app.fetch, port, hostname }, () => console.log(`Package Checker on http://${hostname}:${port}`))
