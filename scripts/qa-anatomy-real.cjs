// Browser smoke test against the shipped BodyParts3D GLBs, not a synthetic fixture.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { prepare } = require('./qa-anatomy.cjs')

async function loaded(page, name) {
  await page.waitForFunction((file) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(`/models/anatomy/${file}.glb`) && entry.responseEnd > 0), name, { timeout: 45000 })
  await page.waitForTimeout(800)
}
async function run(browser, width, light) {
  const { page, errors } = await prepare(browser, width, width === 360 ? 800 : 1000, light)
  const mobile = width < 1280
  const scope = mobile ? page.locator('.anatomy-drawer') : page.locator('.anatomy-sidebar')
  try {
    await loaded(page, 'skeletal')
    assert.equal(await page.locator('.anatomy-demo-note').count(), 0)
    await page.screenshot({ path: `.impeccable/review/anatomy-real-${width}-${light ? 'light' : 'dark'}.png`, animations: 'disabled' })
    if (mobile) await page.getByRole('button', { name: 'Hệ & lớp', exact: true }).click()
    await scope.getByRole('searchbox').fill('hộp sọ')
    await scope.getByRole('button', { name: /Hộp sọ Skull/ }).click()
    await page.getByRole('heading', { name: 'Hộp sọ' }).waitFor()
    await page.getByRole('button', { name: 'Nhãn giải phẫu' }).click()
    await page.locator('.anatomy-label').getByText('Hộp sọ').waitFor()
    if (mobile) await page.getByRole('button', { name: 'Hệ & lớp', exact: true }).click()
    await scope.getByRole('searchbox').fill('brain')
    await scope.getByRole('button', { name: /Não Brain/ }).click()
    await page.getByRole('heading', { name: 'Não' }).waitFor()
    await loaded(page, 'nervous')
    await page.getByRole('button', { name: 'Tách riêng', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Bỏ tách riêng' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Trong suốt / X-ray' }).click()
    await page.getByRole('button', { name: 'Cắt lớp', exact: true }).click()
    await page.getByLabel('Mặt cắt', { exact: true }).selectOption('sagittal')
    await page.getByRole('button', { name: 'Cắt lớp', exact: true }).click()
    await page.getByRole('button', { name: 'Tự kiểm tra' }).click()
    await page.getByRole('heading', { name: 'Đây là bộ phận nào?' }).waitFor()
    await page.getByRole('region', { name: 'Tự kiểm tra giải phẫu' }).getByRole('button', { name: 'Hộp sọ' }).click()
    await page.getByText('Chính xác!', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Kết thúc' }).click()
    if (width === 1440 && !light) {
      await page.route('**/models/anatomy/respiratory.glb', (route) => route.abort())
      const presets = page.getByRole('group', { name: 'Chọn nhanh hệ cơ quan' })
      await presets.getByRole('button', { name: 'Hệ hô hấp' }).click()
      await page.getByRole('alert').getByText(/Không thể tải mô hình này: respiratory/).waitFor()
      await presets.getByRole('button', { name: 'Hệ xương' }).click()
      assert.equal(await page.locator('.anatomy-canvas-wrap canvas').count(), 1, 'Other models survive one failed group')
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    await page.getByRole('button', { name: 'Quay lại Phòng Lab' }).click()
    await page.getByRole('heading', { name: 'Phòng Lab', exact: true }).waitFor()
    console.log(`${width}px ${light ? 'light' : 'dark'}: real skeleton/brain, search, labels, isolate, X-ray, clipping, quiz, back and overflow passed`)
  } finally { await page.close() }
}
async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try { await run(browser, 1440, false); await run(browser, 1440, true); await run(browser, 360, false) } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
