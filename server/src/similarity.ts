import { POPULAR_NPM, POPULAR_PYPI } from './popular.js'
import type { Ecosystem } from './checks.js'

/** Edit distance with adjacent swaps counted as 1 (so "lodahs" vs "lodash" = 1). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** Folds tricks attackers use: separators (- _ .), lookalike characters (0→o, 1→l, rn→m), "py"/"js" affixes. */
function fold(name: string): string {
  return name
    .toLowerCase()
    .replace(/^@[^/]+\//, '')
    .replace(/[-_.]/g, '')
    .replace(/0/g, 'o')
    .replace(/[1|]/g, 'l')
    .replace(/rn/g, 'm')
    .replace(/^(py|python|node)/, '')
    .replace(/(js|py|python)$/, '')
}

/** Returns the popular package this name imitates, or null. Exact matches of popular names are not lookalikes. */
export function findLookalike(ecosystem: Ecosystem, name: string): { target: string; reason: string } | null {
  const list = ecosystem === 'npm' ? POPULAR_NPM : POPULAR_PYPI
  const lower = name.toLowerCase()
  if (list.includes(lower)) return null

  let best: { target: string; reason: string; dist: number } | null = null
  for (const target of list) {
    const dist = editDistance(lower, target)
    const limit = target.length <= 4 ? 1 : 2
    if (target.length >= 4 && dist <= limit && (!best || dist < best.dist)) {
      best = { target, dist, reason: `${dist} character${dist === 1 ? '' : 's'} away from "${target}"` }
    }
    const folded = fold(lower)
    if (!best && folded.length >= 4 && folded === fold(target)) {
      best = { target, dist: 1, reason: `same as "${target}" after removing separators/lookalike characters` }
    }
  }
  return best ? { target: best.target, reason: best.reason } : null
}
