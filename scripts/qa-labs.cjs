const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const assert = require('node:assert/strict')
const { prepare } = require('./qa-anatomy.cjs')

async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    for (const [width, height, name, light] of [[1440, 1000, 'labs-desktop', false], [1440, 1000, 'labs-light', true], [900, 1000, 'labs-tablet', false], [360, 800, 'labs-mobile', false]]) {
      const { page, errors } = await prepare(browser, width, height, light, undefined, async (hub) => {
        assert.equal(await hub.getByRole('button', { name: 'Tất cả', exact: true }).getAttribute('aria-pressed'), 'true')
        assert.equal(await hub.getByRole('button', { name: 'Giải phẫu 3D', exact: true }).count(), 0)
        await hub.locator('.lab-search input').fill('cong nghe thong tin')
        await hub.getByText('Công nghệ thông tin đang phát triển.', { exact: true }).waitFor()
        if (width === 1440 && !light || width === 360) {
          await hub.evaluate(() => window.scrollTo(0, 0))
          await hub.screenshot({ path: `.impeccable/review/${name}-field-search.png`, fullPage: true, animations: 'disabled' })
        }
        await hub.locator('.lab-search input').fill('')
        await hub.getByRole('button', { name: 'Công nghệ thông tin', exact: true }).click()
        await hub.getByText('Lĩnh vực này đang phát triển.', { exact: true }).waitFor()
        await hub.getByRole('button', { name: 'Xem tất cả lab', exact: true }).click()
        await hub.getByRole('button', { name: 'Y – Sinh', exact: true }).click()
        await hub.locator('.lab-search input').fill('giai phau')
        await hub.getByRole('article', { name: 'Giải phẫu người 3D' }).waitFor()
        await hub.locator('.lab-search input').fill('')
        await hub.getByRole('button', { name: 'Tất cả', exact: true }).click()
        assert.equal(await hub.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await hub.evaluate(() => window.scrollTo(0, 0))
        await hub.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true, animations: 'disabled' })
        await hub.screenshot({ path: `.impeccable/review/${name}-preview.jpg`, type: 'jpeg', quality: 65, fullPage: true, animations: 'disabled' })
      })
      await page.getByRole('navigation', { name: 'Vị trí trong Phòng Lab' }).getByText('Giải phẫu người 3D', { exact: true }).waitFor()
      assert.equal(await page.locator('.mobile-nav button').count(), 5)
      if (width === 360) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: '.impeccable/review/labs-anatomy-mobile.png', fullPage: true, animations: 'disabled' })
        await page.screenshot({ path: '.impeccable/review/labs-anatomy-mobile-preview.jpg', type: 'jpeg', quality: 65, fullPage: true, animations: 'disabled' })
      }
      await page.getByRole('button', { name: 'Quay lại Phòng Lab', exact: true }).click()
      await page.getByRole('heading', { name: 'Phòng Lab', exact: true }).waitFor()
      assert.equal(await page.locator('.anatomy-canvas-wrap canvas').count(), 0)
      assert.deepEqual(errors, [])
      console.log(`${name}: hub filtering/search, deferred 3D, existing Anatomy launch, breadcrumb/back and no overflow passed`)
      await page.close()
    }
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
