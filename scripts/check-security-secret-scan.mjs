import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scanText } from './security-secret-scan.mjs'

test('findings contain location only, never matched synthetic credentials', () => {
  const fake = 'AIza' + 'A'.repeat(35)
  const findings = scanText('fixture.ts', 'first line\n' + fake)
  assert.deepEqual(findings, [{ path: 'fixture.ts', kind: 'google-api-key', line: 2, status: 'candidate' }])
  assert.equal(JSON.stringify(findings).includes(fake), false)
})

test('detect private-key and GitHub token markers without printing them', () => {
  const text = '-----BEGIN ' + 'PRIVATE KEY-----\n' + 'ghp_' + 'A'.repeat(36)
  assert.deepEqual(scanText('fixture.txt', text).map(x => x.kind).sort(), ['github-token', 'private-key'])
})

test('ordinary environment references and synthetic test strings are not credentials', () => {
  assert.deepEqual(scanText('fixture.ts', 'process.env.GEMINI_API_KEY; synthetic-test-key'), [])
})
