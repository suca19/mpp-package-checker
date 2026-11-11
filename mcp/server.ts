// MCP server (stdio) for Package Checker.
//
// Gives an AI coding agent such as Claude Code ONE tool, `check_package`. The tool holds the agent's
// testnet wallet: when the agent calls it, the tool calls the paid Package Checker API, gets the
// HTTP 402 price tag, pays it via MPP (mppx client, Tempo testnet) and returns the verdict with the
// payment receipt and an explorer link. The model never sees the key: it stays in ../.env.payer.
//
// Safety: testnet only (refuses any chain but 42431), at most PKG_MAX_PAID_CALLS paid calls per run,
// and only talks to localhost or the project's own Railway URL.
// IMPORTANT: stdout is the MCP protocol channel. Log ONLY with console.error.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Receipt } from 'mppx'
import { Mppx, tempo } from 'mppx/client'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'

const HERE = dirname(fileURLToPath(import.meta.url))
const API = (process.env.PKG_API_URL ?? 'https://mpp-package-checker-production.up.railway.app').replace(/\/$/, '')
const TEMPO_TESTNET = 42431
const MAX_PAID_CALLS = Number(process.env.PKG_MAX_PAID_CALLS ?? 25)
const EXPLORER = 'https://explore.testnet.tempo.xyz/'
const TOKEN_NAMES: Record<string, string> = {
  '0x20c0000000000000000000006a37da5c996874be': 'OUSD',
  '0x20c0000000000000000000000000000000000000': 'pathUSD',
}

if (!/^(https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?|https:\/\/mpp-package-checker-production\.up\.railway\.app)$/.test(API)) {
  console.error(`[mcp] refusing unknown API URL ${API}: only localhost or the project's Railway URL`)
  process.exit(1)
}

// Wallet: read MPPX_PRIVATE_KEY from ../.env.payer without printing it.
function readPayerKey(): `0x${string}` | null {
  try {
    const m = readFileSync(resolve(HERE, '..', '.env.payer'), 'utf8').match(/^MPPX_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m)
    return m ? (m[1] as `0x${string}`) : null
  } catch {
    return null
  }
}
const key = process.env.MPPX_PRIVATE_KEY ?? readPayerKey()
if (!key) {
  console.error('[mcp] no payer wallet: put MPPX_PRIVATE_KEY in ../.env.payer')
  process.exit(1)
}
const account = privateKeyToAccount(key as `0x${string}`)

// Record the 402 price tag so we can tell the agent exactly what it paid.
let lastChallenge: { amount: string; token: string; recipient: string } | null = null
const recordingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  if (res.status === 402) {
    const first = (res.headers.get('www-authenticate') ?? '').split(/,\s*(?=Payment\s)/i)[0] ?? ''
    try {
      const r = JSON.parse(Buffer.from(first.match(/request="([^"]+)"/)?.[1] ?? '', 'base64url').toString('utf8'))
      lastChallenge = {
        amount: String(Number(r.amount) / 1e6),
        token: TOKEN_NAMES[String(r.currency ?? '').toLowerCase()] ?? String(r.currency ?? '?'),
        recipient: String(r.recipient ?? '?'),
      }
    } catch {
      lastChallenge = null
    }
  }
  return res
}

const mppx = Mppx.create({
  polyfill: false,
  fetch: recordingFetch,
  methods: [tempo({ account, expectedChainId: TEMPO_TESTNET })],
})

let paidCalls = 0
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a)

const server = new McpServer({ name: 'package-checker', version: '0.1.0' })

server.registerTool(
  'check_package',
  {
    title: 'Check if a package is safe to install (paid via MPP)',
    description:
      'Call this BEFORE installing any npm or PyPI package (npm install, pnpm add, yarn add, pip install, uv add, poetry add). ' +
      'Returns SAFE, CAUTION or BLOCK with reasons: package does not exist (an AI-invented name attackers can register), ' +
      'reported malware, lookalike of a popular package (typosquat), brand new or almost unused, runs code on install, ' +
      'known security holes in that version. Rule: BLOCK = do not install and tell the user why; CAUTION = tell the user and ask; ' +
      'SAFE = go ahead. Each call is PAID automatically (0.01) via the Machine Payments Protocol on Tempo TESTNET (test money); ' +
      'the response includes the payment receipt and a blockchain explorer link. Check one package per call.',
    inputSchema: {
      ecosystem: z.enum(['npm', 'pypi']).describe('"npm" for JavaScript/TypeScript, "pypi" for Python'),
      name: z.string().min(1).max(214).describe('Exact package name, e.g. "lodash", "@types/node", "requests"'),
      version: z.string().max(64).optional().describe('Specific version, if the user asked for one'),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async ({ ecosystem, name, version }) => {
    if (paidCalls >= MAX_PAID_CALLS) {
      return { isError: true, content: [{ type: 'text', text: `Spending limit reached: ${MAX_PAID_CALLS} paid checks this session.` }] }
    }
    const url = new URL(`${API}/check`)
    url.searchParams.set('ecosystem', ecosystem)
    url.searchParams.set('name', name)
    if (version) url.searchParams.set('version', version)

    lastChallenge = null
    const t0 = Date.now()
    let res: Response
    try {
      res = await mppx.fetch(url.toString(), { headers: { accept: 'application/json' } })
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `Could not reach Package Checker at ${API}: ${(err as Error).message}` }] }
    }
    const text = await res.text()
    if (!res.ok) return { isError: true, content: [{ type: 'text', text: `Package Checker error HTTP ${res.status}: ${text.slice(0, 500)}` }] }
    paidCalls++

    let tx = ''
    try {
      tx = Receipt.fromResponse(res).reference ?? ''
    } catch {}
    const r = JSON.parse(text) as {
      verdict: string
      summary: string
      signals: { level: string; message: string; source: string }[]
      facts: { weekly_downloads?: number | null; age_days?: number; latest_version?: string }
      disclaimer: string
    }
    const c = lastChallenge as { amount: string; token: string; recipient: string } | null
    const lines = [
      `VERDICT: ${r.verdict} for ${ecosystem} package "${name}"${r.facts.latest_version ? ` (version ${r.facts.latest_version})` : ''}`,
      r.summary,
      'Signals:',
      ...(r.signals.length ? r.signals.map((s) => `- [${s.level}] ${s.message} (source: ${s.source})`) : ['- none']),
      r.facts.weekly_downloads != null ? `Weekly downloads: ${r.facts.weekly_downloads.toLocaleString('en')}` : '',
      r.disclaimer,
      '',
      'PAYMENT (Machine Payments Protocol, Tempo testnet, test money):',
      `1. GET /check → 402 Payment Required: ${c ? `${c.amount} ${c.token} to ${short(c.recipient)}` : '0.01'}`,
      `2. Signed the payment with agent wallet ${short(account.address)} and retried with Authorization: Payment`,
      `3. 200 OK + Payment-Receipt${tx ? `, transaction ${tx}` : ''}`,
      /^0x[0-9a-fA-F]{64}$/.test(tx) ? `Proof on the blockchain: ${EXPLORER}tx/${tx}` : '',
      `Live payments page: ${API}/live`,
      `Paid checks this session: ${paidCalls}/${MAX_PAID_CALLS} · ${Date.now() - t0} ms`,
    ].filter((l) => l !== '')

    console.error(`[mcp] paid for ${ecosystem}/${name} → ${r.verdict} (tx ${short(tx)})`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

await server.connect(new StdioServerTransport())
console.error(`[mcp] package-checker ready · API ${API} · agent wallet ${short(account.address)} · testnet only · max ${MAX_PAID_CALLS} paid calls`)
