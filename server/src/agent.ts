// The Gemini agent: a coding assistant that PAYS this service (via MPP) before it recommends any package.
//
// Flow for one request: Gemini reads the user's request → decides to call check_package(...) → this file
// pays GET /check with the agent's own testnet wallet (mppx client: 402 → sign → retry → receipt) →
// the verdict goes back to Gemini → Gemini answers. Every step is sent to the browser as it happens.
// The agent wallet key stays on the server (AGENT_PRIVATE_KEY or ../.env.payer). Testnet only.
import { Receipt } from 'mppx'
import { Mppx, tempo } from 'mppx/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

const TEMPO_TESTNET = 42431
const MAX_CHECKS_PER_RUN = 5
const MAX_TURNS = 6
const TOKEN_NAMES: Record<string, string> = {
  '0x20c0000000000000000000006a37da5c996874be': 'OUSD',
  '0x20c0000000000000000000000000000000000000': 'pathUSD',
}

export type AgentEvent =
  | { type: 'start'; model: string; wallet: string }
  | { type: 'thinking'; turn: number }
  | { type: 'tool_call'; ecosystem: string; name: string; version?: string }
  | { type: 'request'; name: string; path: string }
  | { type: 'payment_required'; name: string; amount: string; token: string; recipient: string }
  | { type: 'sending_payment'; name: string; wallet: string }
  | { type: 'paid'; name: string; tx: string | null; verdict: string; summary: string; ms: number }
  | { type: 'check_failed'; name: string; error: string }
  | { type: 'answer'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done'; checks: number; spent: string }

function loadAgentAccount(): PrivateKeyAccount | null {
  // Same key as MPPX_PRIVATE_KEY in .env.payer; either variable name works on the host.
  let key = process.env.AGENT_PRIVATE_KEY ?? process.env.MPPX_PRIVATE_KEY
  if (!key) {
    try {
      const text = readFileSync(fileURLToPath(new URL('../../.env.payer', import.meta.url)), 'utf8')
      key = text.match(/^MPPX_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m)?.[1]
    } catch {}
  }
  return key && /^0x[0-9a-fA-F]{64}$/.test(key) ? privateKeyToAccount(key as `0x${string}`) : null
}
const account = loadAgentAccount()

export const agentAvailable = () => Boolean(account && process.env.GEMINI_API_KEY)
export const agentWallet = () => account?.address ?? null

const SYSTEM = `You are a coding assistant inside a developer's terminal. The developer asks for libraries or asks you to install packages.
Rules:
- Before you recommend or install ANY npm or PyPI package, call check_package for it. One call per package, at most ${MAX_CHECKS_PER_RUN} calls.
- Each check costs 0.01 (test money), paid automatically from your wallet. Do not check the same package twice.
- Use the exact package name the developer wrote, even if it looks misspelled: the check will tell you if it is unsafe.
- BLOCK: do not install it; say why in one sentence and suggest the safe alternative if the check names one (then check that one too).
- CAUTION: mention the risk and ask the developer. SAFE: say it is fine and give the install command.
- Final answer: short, plain text, at most 6 lines, no markdown headings.`

const TOOL = {
  functionDeclarations: [
    {
      name: 'check_package',
      description:
        'Paid safety check (0.01 per call) for one npm or PyPI package before installing it. Returns SAFE, CAUTION or BLOCK with reasons.',
      parameters: {
        type: 'object',
        properties: {
          ecosystem: { type: 'string', enum: ['npm', 'pypi'], description: 'npm for JavaScript/TypeScript, pypi for Python' },
          name: { type: 'string', description: 'Exact package name' },
          version: { type: 'string', description: 'Optional specific version' },
        },
        required: ['ecosystem', 'name'],
      },
    },
  ],
}

type Part = { text?: string; thought?: boolean; functionCall?: { name: string; args: Record<string, unknown> }; [k: string]: unknown }
type Content = { role: 'user' | 'model'; parts: Part[] }

async function gemini(model: string, contents: Content[]): Promise<Content> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      tools: [TOOL],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const err = new Error(`Gemini answered HTTP ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const body = (await res.json()) as { candidates?: { content?: Content }[] }
  const content = body.candidates?.[0]?.content
  if (!content?.parts?.length) {
    const err = new Error('Gemini returned no answer') as Error & { status?: number }
    err.status = 204 // empty reply: worth one retry
    throw err
  }
  return { role: 'model', parts: content.parts }
}

/** Pays this server's own /check endpoint with the agent wallet, like any outside agent would. */
async function payForCheck(
  selfUrl: string,
  args: { ecosystem: string; name: string; version?: string },
  emit: (e: AgentEvent) => void,
): Promise<Record<string, unknown>> {
  const recordingFetch: typeof fetch = async (input, init) => {
    // First visit has no payment proof; the retry carries "Authorization: Payment …" (the signed payment).
    const auth = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('authorization') ?? ''
    if (/^Payment\s/i.test(auth)) emit({ type: 'sending_payment', name: args.name, wallet: account!.address })
    else {
      const u = new URL(input instanceof Request ? input.url : String(input))
      emit({ type: 'request', name: args.name, path: `${u.pathname}${u.search}` })
    }
    const res = await fetch(input, init)
    if (res.status === 402) {
      const first = (res.headers.get('www-authenticate') ?? '').split(/,\s*(?=Payment\s)/i)[0] ?? ''
      try {
        const r = JSON.parse(Buffer.from(first.match(/request="([^"]+)"/)?.[1] ?? '', 'base64url').toString('utf8'))
        emit({
          type: 'payment_required',
          name: args.name,
          amount: String(Number(r.amount) / 1e6),
          token: TOKEN_NAMES[String(r.currency ?? '').toLowerCase()] ?? 'test token',
          recipient: String(r.recipient ?? ''),
        })
      } catch {}
    }
    return res
  }
  const mppx = Mppx.create({ polyfill: false, fetch: recordingFetch, methods: [tempo({ account: account!, expectedChainId: TEMPO_TESTNET })] })
  const url = new URL('/check', selfUrl)
  url.searchParams.set('ecosystem', args.ecosystem)
  url.searchParams.set('name', args.name)
  if (args.version) url.searchParams.set('version', args.version)

  const t0 = Date.now()
  const res = await mppx.fetch(url.toString(), { headers: { accept: 'application/json', 'x-agent-name': 'Gemini agent' } })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const error = String(body.error ?? `HTTP ${res.status}`)
    emit({ type: 'check_failed', name: args.name, error })
    return { error }
  }
  let tx: string | null = null
  try {
    tx = Receipt.fromResponse(res).reference ?? null
  } catch {}
  emit({ type: 'paid', name: args.name, tx, verdict: String(body.verdict), summary: String(body.summary), ms: Date.now() - t0 })
  // Give Gemini only what it needs to decide (keeps the conversation small).
  return { verdict: body.verdict, summary: body.summary, signals: body.signals }
}

export async function runAgent(prompt: string, selfUrl: string, emit: (e: AgentEvent) => void): Promise<void> {
  if (!account) return emit({ type: 'error', message: 'No agent wallet configured on the server.' })
  let model = process.env.AGENT_MODEL ?? 'gemini-2.5-flash'
  emit({ type: 'start', model, wallet: account.address })

  const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }]
  const checked = new Set<string>()
  const verdicts: { name: string; verdict: string; summary: string }[] = []
  let checks = 0
  let answered = false
  let retried = false

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    emit({ type: 'thinking', turn })
    let reply: Content
    try {
      reply = await gemini(model, contents)
    } catch (err) {
      // Empty reply, quota hit (429) or Gemini overloaded (500/503): retry once with the lighter model.
      if ([204, 429, 500, 503].includes((err as { status?: number }).status ?? 0) && !retried) {
        retried = true
        model = 'gemini-2.5-flash-lite'
        turn--
        continue
      }
      emit({ type: 'error', message: (err as Error).message })
      break
    }
    contents.push(reply)

    const calls = reply.parts.filter((p) => p.functionCall?.name === 'check_package')
    if (calls.length === 0) {
      const text = reply.parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim()
      if (text) {
        emit({ type: 'answer', text })
        answered = true
      }
      break
    }

    const responses: Part[] = []
    for (const call of calls) {
      const a = call.functionCall!.args as { ecosystem?: string; name?: string; version?: string }
      const args = { ecosystem: String(a.ecosystem ?? ''), name: String(a.name ?? '').trim(), version: a.version ? String(a.version) : undefined }
      const key = `${args.ecosystem}/${args.name}@${args.version ?? ''}`
      let result: Record<string, unknown>
      if (!['npm', 'pypi'].includes(args.ecosystem) || !args.name) {
        result = { error: 'ecosystem must be npm or pypi and name is required' }
      } else if (checked.has(key)) {
        result = { error: 'already checked this package in this conversation' }
      } else if (checks >= MAX_CHECKS_PER_RUN) {
        result = { error: `spending limit reached (${MAX_CHECKS_PER_RUN} checks per request)` }
      } else {
        checked.add(key)
        checks++
        emit({ type: 'tool_call', ...args })
        try {
          result = await payForCheck(selfUrl, args, emit)
          if (result.verdict) verdicts.push({ name: args.name, verdict: String(result.verdict), summary: String(result.summary) })
        } catch (err) {
          const error = `payment or check failed: ${(err as Error).message}`
          emit({ type: 'check_failed', name: args.name, error })
          result = { error }
        }
      }
      responses.push({ functionResponse: { name: 'check_package', response: result } })
    }
    contents.push({ role: 'user', parts: responses })
    if (turn === MAX_TURNS) emit({ type: 'error', message: 'The agent took too many steps and was stopped.' })
  }
  // If Gemini never wrote a final answer, answer from the paid verdicts so the user is never left with nothing.
  if (!answered && verdicts.length > 0) {
    const lines = verdicts.map((v) =>
      v.verdict === 'BLOCK' ? `Do not install ${v.name}. ${v.summary}` : v.verdict === 'CAUTION' ? `Be careful with ${v.name}. ${v.summary}` : `${v.name} looks safe to install.`,
    )
    emit({ type: 'answer', text: `${lines.join('\n')}\n(Summary written from the paid checks: Gemini did not reply.)` })
  }
  emit({ type: 'done', checks, spent: (checks * 0.01).toFixed(2) })
}
