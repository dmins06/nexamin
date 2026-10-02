// Real shipped models and bundled Meshopt decoder; only auth/API are fixtures.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { prepare } = require('./qa-anatomy.cjs')
const manifest = JSON.parse(readFileSync('public/models/anatomy/manifest.json', 'utf8'))
const samples = [
  ['skeletal', 'Hệ xương', 'Xương vai', 'scapulae'],
  ['muscular', 'Hệ cơ', 'Cơ tam đầu cánh tay', 'triceps'],
  ['respiratory', 'Hệ hô hấp', 'Khí quản', 'trachea'],
  ['digestive', 'Hệ tiêu hóa', 'Tụy', 'pancreas'],
  ['urinary', 'Hệ tiết niệu', 'Niệu quản', 'ureters'],
  ['reproductive', 'Hệ sinh dục', 'Tuyến tiền liệt', 'prostate'],
  ['endocrine', 'Hệ nội tiết', 'Tuyến yên', 'pituitary'],
  ['lymphatic', 'Hệ bạch huyết', 'Tuyến ức', 'thymus'],
  ['nervous', 'Hệ thần kinh', 'Nhãn cầu', 'eyeballs'],
  ['circulatory', 'Hệ tuần hoàn', 'Tim', 'heart'],
  ['integumentary', 'Da và mô liên kết', 'Da', 'skin'],
]
async function loaded(page, group) {
  const url = manifest.models.find((model) => model.id === group).url
  await page.waitForFunction((path) => performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === path && entry.responseEnd > 0), url, { timeout: 60000 })
  await page.locator('.anatomy-model-loading').waitFor({ state: 'hidden', timeout: 45000 })
  await page.waitForTimeout(650)
  assert.equal(await page.locator('.anatomy-model-failure').count(), 0, `${group}: decode/render succeeded`)
  assert.equal(await page.getByText('Không thể tải mô hình giải phẫu.', { exact: true }).count(), 0)
}
async function run(browser, width, light, comprehensive, report) {
  const { page, errors } = await prepare(browser, width, width === 360 ? 800 : 1000, light)
  const mobile = width < 1280, theme = light ? 'light' : 'dark'
  const scope = page.locator(mobile ? '.anatomy-drawer' : '.anatomy-sidebar')
  const captures = []
  async function openFilters() { if (mobile && !await scope.evaluate((dialog) => dialog.open)) await page.getByRole('button', { name: 'Hệ & lớp', exact: true }).click() }
  async function capture(state) {
    if (process.env.QA_SMOKE_ONLY) return
    const path = `.impeccable/review/anatomy-expanded-${width}-${theme}-${state}.png`
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path, fullPage: true, animations: 'disabled' }); captures.push(path)
  }
  try {
    await loaded(page, 'skeletal')
    await page.getByText('Atlas nam trưởng thành · 84 cấu trúc thuộc 11 hệ.').waitFor()
    assert.equal(await page.locator('.anatomy-demo-note').count(), 0)
    const initial = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => /\/models\/anatomy\/.*\.glb/.test(entry.name)).map((entry) => new URL(entry.name).pathname))
    assert.deepEqual(initial, ['/models/anatomy/skeletal.glb'], 'Only the default system downloads initially')
    await capture('default')
    if (comprehensive) for (const [group, label, name] of samples) {
      await openFilters(); await scope.getByRole('searchbox').fill('')
      if (!await scope.getByRole('button', { name: label, exact: true }).isVisible()) await scope.getByText('Hệ cơ quan', { exact: true }).click()
      await scope.getByRole('button', { name: label, exact: true }).click()
      if (mobile) await scope.getByRole('button', { name: 'Đóng bộ lọc' }).click()
      await loaded(page, group)
      if (group === 'muscular') await capture('muscular')
      await openFilters(); await scope.getByRole('searchbox').fill(name)
      await scope.locator('.anatomy-entities button').filter({ hasText: name }).first().click()
      await page.getByRole('heading', { name, exact: true }).waitFor()
      await page.waitForTimeout(700)
      if (['reproductive', 'endocrine'].includes(group)) {
        await page.getByRole('button', { name: 'Tách riêng', exact: true }).click()
        await page.waitForTimeout(400)
        await capture(group)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    // Reproduce the hidden-organ regression on the actual viewer.
    if (comprehensive) {
      await openFilters(); await scope.getByRole('searchbox').fill('')
      await scope.getByText('Lớp giải phẫu', { exact: true }).click()
      const organs = scope.getByRole('checkbox', { name: 'Nội tạng', exact: true })
      if (await organs.isChecked()) await organs.uncheck()
      if (!await scope.getByRole('button', { name: 'Hệ tiết niệu', exact: true }).isVisible()) await scope.getByText('Hệ cơ quan', { exact: true }).click()
      await scope.getByRole('button', { name: 'Hệ tiết niệu', exact: true }).click()
      assert.equal(await organs.isChecked(), true)
      if (mobile) await scope.getByRole('button', { name: 'Đóng bộ lọc' }).click()
      await loaded(page, 'urinary')
      assert.equal(await page.getByText('Tất cả bộ phận đang ẩn.', { exact: true }).count(), 0)
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => /\/models\/anatomy\/.*\.glb/.test(entry.name)).map((entry) => ({ file: new URL(entry.name).pathname, durationMs: Math.round(entry.duration), encodedBytes: entry.encodedBodySize })))
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => /gstatic.*draco|meshopt.*\.wasm|cdn.*meshopt/i.test(entry.name))), false, 'No decoder CDN')
    report.push({ width, theme, comprehensive, captures, resources, errors })
    console.log(`${width}px ${theme}: ${comprehensive ? 'all 11 real systems, new selections, layer recovery' : 'real default model'}, no overflow/errors; ${captures.length} captures`)
  } finally { await page.close() }
}
async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const report = []
  try {
    await run(browser, 1440, false, true, report)
    await run(browser, 1440, true, false, report)
    await run(browser, 360, false, true, report)
    await run(browser, 360, true, false, report)
    await run(browser, 900, false, false, report)
    await run(browser, 1600, true, false, report)
    if (!process.env.QA_SMOKE_ONLY) writeFileSync('.impeccable/review/anatomy-expanded-qa.json', JSON.stringify({ base: process.env.QA_BASE_URL || 'http://127.0.0.1:5173', report }, null, 2))
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
