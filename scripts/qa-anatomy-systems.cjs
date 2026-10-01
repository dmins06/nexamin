// Exercise each shipped system with its actual GLB in one browser session.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { prepare } = require('./qa-anatomy.cjs')

const groups = [
  ['skeletal', 'Hệ xương'], ['muscular', 'Hệ cơ'], ['circulatory', 'Hệ tuần hoàn'],
  ['respiratory', 'Hệ hô hấp'], ['digestive', 'Hệ tiêu hóa'], ['nervous', 'Hệ thần kinh'],
  ['urinary', 'Hệ tiết niệu'], ['lymphatic', 'Hệ bạch huyết'], ['integumentary', 'Da và mô liên kết'],
]
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    const { page, errors } = await prepare(browser, 1440, 1000)
    const sidebar = page.locator('.anatomy-sidebar')
    for (const [id, label] of groups) {
      await sidebar.getByRole('button', { name: label, exact: true }).click()
      await page.waitForFunction((file) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(`/models/anatomy/${file}.glb`) && entry.responseEnd > 0), id, { timeout: 45000 })
      await page.waitForTimeout(700)
      assert.equal(await page.locator('.anatomy-model-failure').count(), 0, `${id} failed to load`)
      assert.equal(await page.locator('.anatomy-demo-note').count(), 0, `${id} fell back to demo`)
      console.log(`${id}: actual GLB loaded`)
    }
    assert.deepEqual(errors, [])
    await page.close()
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
