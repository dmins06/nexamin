// Local bounded pattern scan; never prints matched credentials or uploads code.
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const rules = [
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['github-token', /\b(?:gh[pousr]_[0-9A-Za-z]{36,255}|github_pat_[0-9A-Za-z_]{60,255})\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['openai-style-token', /\bsk-(?:proj-)?[0-9A-Za-z_-]{32,255}\b/g],
]

export function scanText(path, text) {
  return rules.flatMap(([kind, pattern]) => [...text.matchAll(pattern)].map(match => ({
    path,
    kind,
    line: text.slice(0, match.index).split('\n').length,
    status: 'candidate',
  })))
}

function main() {
  const root = realpathSync(process.cwd())
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  }).split('\0').filter(Boolean)
  const findings = []
  let scanned = 0, skipped = 0
  for (const path of new Set(files)) {
    if (/^(?:migration-data\/|public\/runtimes\/|public\/models\/)/.test(path)) {
      skipped++; continue
    }
    try {
      const target = realpathSync(resolve(root, path))
      if (!target.startsWith(root + sep) || !statSync(target).isFile() || statSync(target).size > 4194304) {
        skipped++; continue
      }
      const buffer = readFileSync(target)
      if (buffer.includes(0)) { skipped++; continue }
      findings.push(...scanText(path, buffer.toString('utf8')))
      scanned++
    } catch {
      skipped++ // Includes pre-existing deleted tracked files; no data mutation.
    }
  }
  console.log(JSON.stringify({
    scanned, skipped, findings,
    scope: 'Tracked and non-ignored working-tree text; known provider/private-key patterns only. Not a history/entropy scan or proof that secrets are absent.',
  }, null, 2))
  if (findings.length) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
