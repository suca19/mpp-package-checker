import { findLookalike } from './similarity.js'

export type Ecosystem = 'npm' | 'pypi'
export type Verdict = 'SAFE' | 'CAUTION' | 'BLOCK'
export type Level = 'block' | 'caution' | 'info'

export interface Signal {
  id: string
  level: Level
  message: string
  source: string
}

export interface CheckResult {
  ecosystem: Ecosystem
  name: string
  version: string | null
  verdict: Verdict
  summary: string
  signals: Signal[]
  facts: {
    exists: boolean
    latest_version?: string
    created?: string
    age_days?: number
    weekly_downloads?: number | null
    install_scripts?: string[]
    known_vulnerabilities?: string[]
  }
  checked_at: string
  disclaimer: string
}

const TIMEOUT_MS = 6000
const UA = 'package-checker/0.1 (hackathon prototype)'

async function getJson(url: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = res.ok ? await res.json() : null
  return { status: res.status, body }
}

/** Facts about one package version, gathered from the public registry. */
interface RegistryInfo {
  exists: boolean
  version?: string
  created?: Date
  weeklyDownloads: number | null
  installScripts: string[]
  deprecated?: string
  securityHolding: boolean
  sdistOnly: boolean
}

async function npmInfo(name: string, version?: string): Promise<RegistryInfo> {
  const enc = name.replace('/', '%2f')
  const empty: RegistryInfo = { exists: false, weeklyDownloads: null, installScripts: [], securityHolding: false, sdistOnly: false }
  const [manifest, dl] = await Promise.all([
    getJson(`https://registry.npmjs.org/${enc}/${encodeURIComponent(version ?? 'latest')}`),
    getJson(`https://api.npmjs.org/downloads/point/last-week/${name}`).catch(() => ({ status: 0, body: null })),
  ])
  if (manifest.status === 404) {
    // The package may exist even if this version does not: check the package itself.
    if (version) {
      const pkg = await getJson(`https://registry.npmjs.org/${enc}/latest`)
      if (pkg.status === 200) throw new BadRequest(`npm package "${name}" exists but has no version "${version}"`)
    }
    return empty
  }
  if (manifest.status !== 200) throw new Error(`npm registry answered ${manifest.status}`)
  const m = manifest.body
  const weeklyDownloads = typeof dl.body?.downloads === 'number' ? dl.body.downloads : null
  const scripts = Object.keys(m.scripts ?? {}).filter((s) => ['preinstall', 'install', 'postinstall'].includes(s))

  // Creation date: the full document can be huge for big packages, so only fetch it for small ones.
  let created: Date | undefined
  if (weeklyDownloads === null || weeklyDownloads < 50_000) {
    const full = await getJson(`https://registry.npmjs.org/${enc}`).catch(() => ({ status: 0, body: null }))
    if (full.body?.time?.created) created = new Date(full.body.time.created)
  }
  return {
    exists: true,
    version: m.version,
    created,
    weeklyDownloads,
    installScripts: scripts.map((s) => `${s}: ${String(m.scripts[s]).slice(0, 120)}`),
    deprecated: typeof m.deprecated === 'string' ? m.deprecated : undefined,
    securityHolding: /-security$/.test(m.version ?? '') || m.description === 'security holding package',
    sdistOnly: false,
  }
}

async function pypiInfo(name: string, version?: string): Promise<RegistryInfo> {
  const empty: RegistryInfo = { exists: false, weeklyDownloads: null, installScripts: [], securityHolding: false, sdistOnly: false }
  const [pkg, stats] = await Promise.all([
    getJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`),
    getJson(`https://pypistats.org/api/packages/${encodeURIComponent(name.toLowerCase())}/recent`).catch(() => ({ status: 0, body: null })),
  ])
  if (pkg.status === 404) return empty
  if (pkg.status !== 200) throw new Error(`PyPI answered ${pkg.status}`)
  const info = pkg.body.info
  const releases: Record<string, Array<{ upload_time_iso_8601: string; packagetype: string; yanked?: boolean }>> = pkg.body.releases ?? {}
  const v = version ?? info.version
  if (version && !releases[version]) throw new BadRequest(`PyPI package "${name}" exists but has no version "${version}"`)

  let created: Date | undefined
  for (const files of Object.values(releases)) {
    for (const f of files) {
      const t = new Date(f.upload_time_iso_8601)
      if (!created || t < created) created = t
    }
  }
  const files = releases[v] ?? []
  return {
    exists: true,
    version: v,
    created,
    weeklyDownloads: typeof stats.body?.data?.last_week === 'number' ? stats.body.data.last_week : null,
    installScripts: [],
    deprecated: files.length > 0 && files.every((f) => f.yanked) ? 'this version was yanked' : undefined,
    securityHolding: false,
    // No wheel means pip builds from source, which runs the package's setup.py on install.
    sdistOnly: files.length > 0 && files.every((f) => f.packagetype === 'sdist'),
  }
}

interface OsvVuln { id: string; summary?: string; details?: string; aliases?: string[] }

async function osvVulns(ecosystem: Ecosystem, name: string, version?: string): Promise<OsvVuln[]> {
  const body: Record<string, unknown> = { package: { name, ecosystem: ecosystem === 'npm' ? 'npm' : 'PyPI' } }
  if (version) body.version = version
  const res = await getJson('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status !== 200) throw new Error(`OSV answered ${res.status}`)
  return res.body?.vulns ?? []
}

// Malware = OSV's MAL- reports, or an advisory whose summary says the package itself is malicious.
// (Normal advisories often say "malicious input/URLs", so the details text is not used.)
const isMalware = (v: OsvVuln) =>
  v.id.startsWith('MAL-') || /\bmalware\b|malicious (code|package|version|release)/i.test(v.summary ?? '')

export class BadRequest extends Error {}

export async function checkPackage(ecosystem: Ecosystem, name: string, version?: string): Promise<CheckResult> {
  const signals: Signal[] = []
  const add = (id: string, level: Level, message: string, source: string) => signals.push({ id, level, message, source })

  const reg = await (ecosystem === 'npm' ? npmInfo(name, version) : pypiInfo(name, version))
  const lookalike = findLookalike(ecosystem, name)
  const registry = ecosystem === 'npm' ? 'npm registry' : 'PyPI'

  // Malware reports: checked for all versions, since malicious packages are usually bad in every version.
  const allVulns = await osvVulns(ecosystem, name).catch(() => null)
  const malware = (allVulns ?? []).filter(isMalware)
  if (malware.length > 0) {
    add('malware', 'block', `Reported as malware (${malware.map((v) => v.id).join(', ')}): ${malware[0].summary ?? 'malicious package'}`, 'OSV.dev')
  }

  if (!reg.exists) {
    add(
      'does_not_exist',
      'block',
      `"${name}" does not exist on ${registry}. AI assistants sometimes invent package names, and attackers register those names with malware ("slopsquatting"). Do not install it if it appears later without checking again.`,
      registry,
    )
    if (lookalike) add('lookalike', 'info', `Did you mean "${lookalike.target}"? (${lookalike.reason})`, 'name comparison')
    return finish(ecosystem, name, version ?? null, signals, { exists: false }, allVulns === null)
  }

  if (reg.securityHolding) {
    add('security_holding', 'block', `The registry replaced this package with a "security holding" placeholder: the original was removed for being malicious.`, registry)
  }

  const downloads = reg.weeklyDownloads
  if (lookalike) {
    const popularEnough = downloads !== null && downloads >= 100_000
    add(
      'lookalike',
      popularEnough ? 'info' : 'block',
      popularEnough
        ? `Name is close to "${lookalike.target}" (${lookalike.reason}), but it is widely used itself.`
        : `Possible typosquat: name is ${lookalike.reason}, and it has few users. Did you mean "${lookalike.target}"?`,
      'name comparison',
    )
  }

  const ageDays = reg.created ? Math.floor((Date.now() - reg.created.getTime()) / 86_400_000) : undefined
  if (ageDays !== undefined && ageDays < 30) {
    add('new_package', 'caution', `First published ${ageDays} day${ageDays === 1 ? '' : 's'} ago. Most malicious packages are brand new.`, registry)
  }

  if (downloads !== null && downloads < 100 && !reg.securityHolding) {
    add('few_users', 'caution', `Only ${downloads} downloads last week: almost nobody uses it.`, ecosystem === 'npm' ? 'npm downloads API' : 'pypistats.org')
  }

  if (reg.installScripts.length > 0) {
    const widelyUsed = downloads !== null && downloads >= 1_000_000
    add(
      'install_scripts',
      widelyUsed ? 'info' : 'caution',
      `Runs code automatically when installed (${reg.installScripts.join('; ')}).${widelyUsed ? ' Common for widely used packages with native builds.' : ' This is how most npm malware runs.'}`,
      registry,
    )
  }
  if (reg.sdistOnly) {
    add('runs_setup_py', 'caution', 'No pre-built wheel for this version: pip will run the package\'s setup.py code during install.', registry)
  }

  if (reg.deprecated) add('deprecated', 'caution', `Deprecated: ${reg.deprecated.slice(0, 200)}`, registry)

  // Known security holes in the exact version being installed.
  const versionVulns = reg.version ? await osvVulns(ecosystem, name, reg.version).catch(() => null) : []
  const holes = (versionVulns ?? []).filter((v) => !isMalware(v))
  if (holes.length > 0) {
    const ids = holes.map((v) => v.aliases?.find((a) => a.startsWith('CVE-')) ?? v.id)
    add('known_vulnerabilities', 'caution', `Version ${reg.version} has ${holes.length} known security hole${holes.length === 1 ? '' : 's'}: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''}. Use a newer version.`, 'OSV.dev')
  }

  return finish(
    ecosystem,
    name,
    reg.version ?? null,
    signals,
    {
      exists: true,
      latest_version: reg.version,
      created: reg.created?.toISOString(),
      age_days: ageDays,
      weekly_downloads: downloads,
      install_scripts: reg.installScripts,
      known_vulnerabilities: holes.map((v) => v.id),
    },
    allVulns === null || versionVulns === null,
  )
}

function finish(
  ecosystem: Ecosystem,
  name: string,
  version: string | null,
  signals: Signal[],
  facts: CheckResult['facts'],
  osvFailed: boolean,
): CheckResult {
  if (osvFailed) signals.push({ id: 'osv_unavailable', level: 'caution', message: 'The vulnerability database (OSV.dev) did not answer, so known holes and malware reports were not checked.', source: 'OSV.dev' })
  const verdict: Verdict = signals.some((s) => s.level === 'block') ? 'BLOCK' : signals.some((s) => s.level === 'caution') ? 'CAUTION' : 'SAFE'
  const top = signals.find((s) => s.level === 'block') ?? signals.find((s) => s.level === 'caution')
  const summary =
    verdict === 'SAFE'
      ? `No red flags found for ${name}${version ? `@${version}` : ''}.`
      : `${verdict}: ${top!.message}`
  return {
    ecosystem,
    name,
    version,
    verdict,
    summary,
    signals,
    facts,
    checked_at: new Date().toISOString(),
    disclaimer: 'Automated signals from public data (registry, OSV.dev, download stats). A SAFE verdict means no red flags were found, not a guarantee.',
  }
}
