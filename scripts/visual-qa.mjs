import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const baseUrl = process.env.STUDYHUB_PREVIEW_URL ?? 'http://127.0.0.1:4173'
const reviewDir = '.impeccable/review'
await mkdir(reviewDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/v1/universities**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], page: 1, page_size: 30, total: 0 }) }))
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Tạo tài khoản' }).click()
  await page.getByLabel('Trường đại học đang học').fill('BKA')
  await page.getByRole('option', { name: /ĐẠI HỌC BÁCH KHOA HÀ NỘI/ }).click()
  await page.getByLabel('Ngành học').fill('IT1')
  await page.getByRole('option', { name: /IT1.*Khoa học Máy tính/ }).waitFor()

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heading: document.querySelector('h1')?.textContent ?? '',
    visibleLogos: document.querySelectorAll('img.university-logo').length,
    visibleMajors: document.querySelectorAll('.major-results [role="option"]').length,
  }))
  await page.screenshot({ path: `${reviewDir}/${viewport.name}.png`, fullPage: true })
  results.push({ viewport: viewport.name, ...dimensions, errors })
  await context.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
