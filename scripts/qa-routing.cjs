const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const profile = { id: 'qa', email: 'qa@example.edu', full_name: 'Nguyễn Minh Anh', avatar_url: null, university: null, major: 'Y khoa', student_year: 2, role: 'student' }

async function prepare(browser, width, authenticated = true) {
  const page = await browser.newPage({ viewport: { width, height: width === 360 ? 800 : 1000 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.stack || error.message}`))
  if (authenticated) await page.addInitScript(() => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({ access_token: 'qa', refresh_token: 'qa', token_type: 'bearer', expires_in: 3600 }))
  })
  await page.routeWebSocket('**/social/ws**', () => {})
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) body = profile
    else if (path.endsWith('/social/messages/unread')) body = { total: 0, by_sender: {} }
    else if (/\/courses\?/.test(route.request().url())) body = { items: [], page: 1, page_size: 100, total: 0 }
    else if (path.endsWith('/courses/summary/academic')) body = { gpa: null, completed_credits: 0, graded_credits: 0, degree_classification: 'Chưa đủ dữ liệu', grades: [], policy: { id: 'general', name: 'Khung quy đổi chung', source_url: 'https://example.org', is_school_specific: false, bands: [] } }
    else if (path.endsWith('/electives/availability')) body = { status: 'unsupported_university', elective_count: 0 }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { page, errors }
}

async function checkDirect(page, path, heading, title) {
  const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' })
  assert.equal(response.status(), 200, `${path} must receive the SPA entry point`)
  await page.getByRole('heading', { name: heading, exact: true }).first().waitFor({ timeout: 45000 })
  assert.equal(new URL(page.url()).pathname, path === '/' ? '/dashboard' : path)
  assert.equal(await page.title(), `${title} | Nexamin`)
  assert.equal(await page.getByRole('heading', { name: 'Không tìm thấy trang' }).count(), 0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: heading, exact: true }).first().waitFor({ timeout: 45000 })
  assert.equal(new URL(page.url()).pathname, path === '/' ? '/dashboard' : path)
}

async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    const { page, errors } = await prepare(browser, 1440)
    const routes = [
      ['/', 'Tiến độ học tập', 'Trang chủ'],
      ['/dashboard', 'Tiến độ học tập', 'Trang chủ'],
      ['/courses', 'Môn học của bạn', 'Học phần'],
      ['/schedule', 'Lịch học của bạn', 'Lịch học'],
      ['/labs', 'Phòng Lab', 'Phòng Lab'],
      ['/labs/anatomy', 'Giải phẫu 3D', 'Giải phẫu người 3D'],
      ['/assistant', 'Hỏi Emin AI', 'AI Assistant'],
      ['/settings', 'Cài đặt', 'Cài đặt'],
    ]
    for (const [path, heading, title] of routes) {
      await checkDirect(page, path, heading, title)
      assert.deepEqual(errors, [], `Unexpected page error on ${path}`)
      if (path === '/dashboard' || path === '/labs') {
        assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => /AnatomyViewer|models\/anatomy\//.test(entry.name))), false, `${path} must not preload anatomy`)
      }
      console.log(`direct + refresh passed: ${path}`)
    }
    await page.goto(`${base}/dashboard`)
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
    await nav.getByRole('button', { name: 'Phòng Lab' }).click()
    await page.getByRole('button', { name: 'Khám phá', exact: true }).click()
    assert.equal(new URL(page.url()).pathname, '/labs/anatomy')
    assert.equal(await nav.getByRole('button', { name: 'Phòng Lab' }).getAttribute('aria-current'), 'page')
    await page.goBack()
    assert.equal(new URL(page.url()).pathname, '/labs')
    await page.goBack()
    assert.equal(new URL(page.url()).pathname, '/dashboard')
    await page.goForward()
    assert.equal(new URL(page.url()).pathname, '/labs')
    await page.goto(`${base}/not-a-route`)
    await page.getByRole('heading', { name: 'Không tìm thấy trang' }).waitFor()
    await page.screenshot({ path: '.impeccable/review/routing-404-desktop.png', animations: 'disabled' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    await page.close()

    const mobile = await prepare(browser, 360)
    await checkDirect(mobile.page, '/labs/anatomy', 'Giải phẫu 3D', 'Giải phẫu người 3D')
    await mobile.page.locator('.anatomy-canvas-wrap canvas').waitFor({ timeout: 45000 })
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await mobile.page.getByLabel('Mở thêm điều hướng').click()
    assert.equal(await mobile.page.locator('.mobile-more').getByRole('button', { name: 'Phòng Lab' }).getAttribute('aria-current'), 'page')
    await mobile.page.screenshot({ path: '.impeccable/review/routing-mobile-menu.png', animations: 'disabled' })
    await mobile.page.locator('.mobile-more').getByRole('button', { name: 'Phòng Lab' }).click()
    assert.equal(new URL(mobile.page.url()).pathname, '/labs')
    assert.equal(await mobile.page.locator('.mobile-nav button').count(), 5)
    await mobile.page.goto(`${base}/not-a-route`)
    await mobile.page.getByRole('heading', { name: 'Không tìm thấy trang' }).waitFor()
    await mobile.page.screenshot({ path: '.impeccable/review/routing-404-mobile.png', animations: 'disabled' })
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(mobile.errors, [])
    await mobile.page.close()

    const guest = await prepare(browser, 1440, false)
    await guest.page.goto(`${base}/labs/anatomy`, { waitUntil: 'domcontentloaded' })
    await guest.page.getByRole('heading', { name: 'Tiếp tục buổi học' }).waitFor()
    assert.equal(new URL(guest.page.url()).pathname, '/labs/anatomy')
    await guest.page.close()
    console.log('browser routing, history, mobile, 404 and protected deep link passed')
  } finally { await browser.close() }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
