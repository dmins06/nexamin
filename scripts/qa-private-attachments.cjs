// Synthetic local UI checks only. No production requests, credentials or files.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:14173'
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Localhost QA only')
const own = '11111111-1111-4111-8111-111111111111'
const friendId = '22222222-2222-4222-8222-222222222222'
const friend = { id: friendId, full_name: 'Người nhận thử nghiệm', university: null, major: null,
  avatar_url: null, friendship_id: 'fixture-friend', friendship_status: 'accepted', request_incoming: false }
const filename = 'Tài_liệu_' + 'A'.repeat(180) + '.txt'

async function check(browser, width, theme) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
  const errors = []
  let requests = 0
  let includeImage = false
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(theme => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({ access_token: 'synthetic-file-access',
      refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 900 }))
    localStorage.setItem('studyhub.theme.v1', theme)
  }, theme)
  await page.routeWebSocket('**/social/ws**', () => {})
  await page.route('https://never-follow.invalid/**', () => { throw new Error('Must not follow public attachment URL') })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/attachment')) {
      assert.equal(route.request().headers().authorization, 'Bearer synthetic-file-access')
      requests++
      return route.fulfill(requests === 1 ? { status: 403, contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Bạn không có quyền xem file.' } }) }
        : { status: 200, contentType: 'text/plain', body: 'SYNTHETIC_ONLY' })
    }
    let body = []
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) body = {
      id: own, email: 'synthetic@example.edu', full_name: 'Tài khoản thử nghiệm', avatar_url: null,
      university: null, major: null, student_year: 1, role: 'student',
    }
    else if (path.endsWith('/social/friendships')) body = [{ id: 'fixture-friend', status: 'accepted', request_incoming: false, profile: friend }]
    else if (path.endsWith('/social/messages/unread')) body = { total: 0, by_sender: {} }
    else if (path.endsWith(`/social/messages/${friendId}`)) body = [{
      id: '33333333-3333-4333-8333-333333333333', sender_id: friendId, recipient_id: own,
      content: JSON.stringify({ text: 'File riêng tư thử nghiệm', attachment: {
        url: 'https://never-follow.invalid/synthetic.txt', name: filename, mime_type: 'text/plain',
      } }), created_at: '2026-10-03T00:00:00Z', read_at: null,
    }, ...(includeImage ? [imageMessage] : [])]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/messages', { waitUntil: 'domcontentloaded' })
  assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
  await page.getByRole('button', { name: /Người nhận thử nghiệm/ }).click()
  const download = page.getByRole('button', { name: /Tải file/ })
  await download.waitFor()
  assert((await download.boundingBox()).height >= 44, 'touch target must be at least 44px')
  assert.equal(requests, 0, 'non-image files must not preload')
  await download.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('alert').filter({ hasText: 'không có quyền' }).waitFor()
  const retry = page.getByRole('button', { name: 'Thử tải lại file' })
  await retry.focus()
  await page.keyboard.press('Enter')
  const link = page.getByRole('link', { name: filename, exact: true })
  await link.waitFor()
  assert.match(await link.getAttribute('href'), /^blob:/)
  assert.equal(await link.getAttribute('download'), filename)
  assert((await link.boundingBox()).height >= 44, 'download link must be at least 44px')
  assert.deepEqual(errors, [])
  if (width === 360 || width === 1440) await page.screenshot({
    path: `.impeccable/review/private-files-${width}-${theme}.png`, fullPage: true, animations: 'disabled',
  })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  const imageMessage = {
    id: '44444444-4444-4444-8444-444444444444', sender_id: friendId, recipient_id: own,
    content: JSON.stringify({ text: 'Ảnh thử nghiệm', attachment: {
      url: 'https://never-follow.invalid/synthetic.png', name: 'synthetic.png', mime_type: 'image/png',
    } }), created_at: '2026-10-03T00:00:00Z', read_at: null,
  }
  await page.route('**/social/messages/44444444-4444-4444-8444-444444444444/attachment', route => {
    assert.equal(route.request().headers().authorization, 'Bearer synthetic-file-access')
    return route.fulfill({ status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAkwAAAAASUVORK5CYII=', 'base64') })
  })
  includeImage = true
  await page.evaluate(message => window.dispatchEvent(new CustomEvent('studyhub:message', { detail: message })), imageMessage)
  const image = page.getByRole('img', { name: 'synthetic.png' })
  await image.waitFor()
  await image.evaluate(element => element.decode())
  assert.equal(await image.evaluate(element => element.naturalWidth), 1)
  assert.match(await image.getAttribute('src'), /^blob:/)
  console.log(JSON.stringify({ width, theme, requests, overflow, errors }))
  await page.close()
  return overflow
}

async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const failures = []
    for (const width of [360, 900, 1440, 1600]) {
      for (const theme of ['dark', 'light']) if (await check(browser, width, theme)) failures.push({ width, theme })
    }
    assert.deepEqual(failures, [], 'No horizontal overflow')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
