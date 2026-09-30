const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const assert = require('node:assert/strict')

async function prepare(browser, width, height, light = false, setup) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
  await page.routeWebSocket('**/social/ws**', () => {})
  // External font availability must not indefinitely block a local functional test.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    try { await route.fulfill({ response: await route.fetch({ timeout: 8000 }) }) } catch { await route.abort() }
  })
  await page.addInitScript(({ light }) => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({ access_token: 'qa', refresh_token: 'qa', token_type: 'bearer', expires_in: 3600 }))
    if (light) localStorage.setItem('studyhub.theme.v1', 'light')
  }, { light })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) body = { id: 'qa', full_name: 'Nguyễn Minh Anh', email: 'qa@example.edu', major: 'Y khoa', student_year: 2, university: null }
    if (path.endsWith('/social/messages/unread')) body = { total: 0, by_sender: {} }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const errors = []; page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE:', error.message) })
  page.on('console', (message) => { if (message.type() === 'error') console.error('BROWSER:', message.text()) })
  if (setup) await setup(page)
  await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(width <= 760 ? 'Mở thêm điều hướng' : 'Mở hồ sơ cá nhân', { exact: true }).waitFor()
  const initialHeavy = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => /AnatomyViewer|react-three|three\.js/.test(entry.name)).length)
  assert.equal(initialHeavy, 0, '3D dependencies should not load on the homepage')
  if (width <= 760) { await page.getByLabel('Mở thêm điều hướng').click(); await page.locator('.mobile-more').getByRole('button', { name: 'Giải phẫu 3D' }).click() }
  else await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Giải phẫu 3D' }).click()
  try { await page.locator('.anatomy-canvas-wrap canvas').waitFor({ timeout: 30000 }) } catch (error) { console.log(await page.locator('.anatomy-feature').innerText()); throw error }
  await page.waitForFunction(() => document.querySelector('.anatomy-canvas-wrap canvas')?.width > 0)
  if (light && await page.getByLabel('Chuyển sang giao diện ban ngày').count()) await page.getByLabel('Chuyển sang giao diện ban ngày').click()
  return { page, errors }
}
async function capture(browser, width, height, name, light = false) {
  const { page, errors } = await prepare(browser, width, height, light)
  const visibleSearch = width < 1280 ? page.locator('.anatomy-drawer').getByRole('searchbox') : page.locator('.anatomy-sidebar').getByRole('searchbox')
  if (width < 1280) await page.getByRole('button', { name: 'Hệ & lớp', exact: true }).click()
  await visibleSearch.fill('heart')
  const scope = page.locator(width < 1280 ? '.anatomy-drawer' : '.anatomy-sidebar')
  await scope.getByRole('button', { name: /^Tim Heart/ }).click()
  await page.getByRole('heading', { name: 'Tim', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Nhãn giải phẫu', exact: true }).click()
  await page.locator('.anatomy-label').first().waitFor()
  await page.getByRole('button', { name: 'Trong suốt / X-ray' }).click()
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click()
  await page.getByRole('button', { name: 'Đặt lại góc nhìn' }).click()
  await page.getByRole('button', { name: 'Cắt lớp', exact: true }).click()
  await page.getByLabel('Mặt cắt', { exact: true }).selectOption('axial')
  await page.getByLabel('Vị trí mặt cắt').fill('0.3')
  await page.getByRole('button', { name: 'Cắt lớp', exact: true }).click()
  await page.getByRole('button', { name: 'Trong suốt / X-ray' }).click()
  const model = page.getByLabel('Vùng mô hình 3D', { exact: true })
  await model.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Home')
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.anatomy-canvas-wrap canvas')?.getBoundingClientRect()
    const labels = Array.from(document.querySelectorAll('.anatomy-label'))
    return canvas && labels.length && labels.every((label) => { const box = label.getBoundingClientRect(); return box.left >= canvas.left && box.right <= canvas.right && box.top >= canvas.top && box.bottom <= canvas.bottom })
  })
  await page.getByRole('button', { name: 'Học bộ phận', exact: true }).click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal page overflow')
  assert.equal(await page.locator('.mobile-nav button').count(), 5)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true, animations: 'disabled' })
  await page.screenshot({ path: `.impeccable/review/${name}-preview.jpg`, fullPage: true, type: 'jpeg', quality: 60, animations: 'disabled' })
  if (width === 1440) {
    await page.getByRole('button', { name: 'Toàn màn hình', exact: true }).click()
    await page.getByRole('button', { name: 'Thoát toàn màn hình' }).waitFor()
    await page.getByRole('button', { name: 'Thoát toàn màn hình' }).click()
    // Deliberately lose WebGL to verify the error remains inside the feature.
    await page.locator('.anatomy-canvas-wrap canvas').evaluate((canvas) => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    await page.getByText('Không thể tải mô hình giải phẫu.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await page.locator('.anatomy-canvas-wrap canvas').waitFor()
  }
  assert.deepEqual(errors, [], 'No page errors')
  console.log(`${name}: WebGL, metadata, labels, layers, clipping, keyboard, navigation and overflow passed`)
  await page.close()
}
async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try { for (const args of [[1440, 1000, 'anatomy-desktop'], [1440, 1000, 'anatomy-light', true], [900, 1000, 'anatomy-tablet'], [360, 800, 'anatomy-mobile']]) { if (!process.env.QA_VIEWPORT || args[2] === process.env.QA_VIEWPORT) await capture(browser, ...args) } } finally { await browser.close() }
}
module.exports = { prepare }
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1 })
