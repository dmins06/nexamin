const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { prepare } = require('./qa-anatomy.cjs')

// Synthetic triangle fixture, created in memory for loader tests, never shipped as anatomy.
function fixtureGlb() {
  const positions = new Float32Array([-0.4, -0.4, 0, 0.4, -0.4, 0, 0, 0.4, 0])
  const binary = Buffer.from(positions.buffer)
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Heart', mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.8, 0.2, 0.2, 1], metallicFactor: 0, roughnessFactor: 0.7 } }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.4, -0.4, 0], max: [0.4, 0.4, 0] }], bufferViews: [{ buffer: 0, byteLength: binary.length, target: 34962 }], buffers: [{ byteLength: binary.length }] }))
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)])
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + binary.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, padded, binHeader, binary])
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    const { page, errors } = await prepare(browser, 1440, 1000, false, async (page) => {
      await page.route('**/models/anatomy/manifest.json', (route) => route.fulfill({ json: { version: 1, models: [{ id: 'fixture', url: '/models/anatomy/test-fixture.glb', license: 'Test only', attribution: 'Synthetic QA fixture', scale: 1, position: [0, 0, 0] }] } }))
      await page.route('**/models/anatomy/test-fixture.glb', (route) => route.fulfill({ contentType: 'model/gltf-binary', body: fixtureGlb() }))
    })
    const canvas = page.locator('.anatomy-canvas-wrap canvas')
    for (let attempt = 0; attempt < 3; attempt++) {
      await canvas.click()
      try { await page.getByRole('heading', { name: 'Tim', exact: true }).waitFor({ timeout: 2000 }); break } catch (error) { if (attempt === 2) throw error }
    }
    assert.equal(await page.locator('.anatomy-demo-note').count(), 0)
    await page.getByRole('button', { name: 'Tách riêng', exact: true }).click()
    await canvas.click()
    assert.equal(await page.getByRole('button', { name: 'Bỏ tách riêng' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Ẩn bộ phận' }).click()
    await page.getByRole('button', { name: 'Hiện bộ phận' }).click()
    await page.getByRole('button', { name: 'Nhãn giải phẫu' }).click()
    await page.locator('.anatomy-label').getByText('Tim', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('GLB loader: mapped object picking, isolation, hide/reveal and bounds-based labels passed')
    await page.close()

    const result = await prepare(browser, 1440, 1000, false, async (page) => {
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname
        let body = []
        if (path.endsWith('/auth/me') || path.endsWith('/users/me')) body = { id: 'qa', full_name: 'QA Admin', email: 'qa@example.edu', university: null, role: 'admin', student_year: 2 }
        else if (path.endsWith('/courses') || path.endsWith('/documents')) body = { items: [], total: 0, page: 1, page_size: 20 }
        else if (path.endsWith('/courses/summary/academic')) body = { gpa: null, completed_credits: 0, degree_classification: null, grades: [], policy: { bands: [] } }
        else if (path.endsWith('/social/messages/unread')) body = { total: 0, by_sender: {} }
        else if (path.endsWith('/electives/availability')) body = { status: 'unsupported', message: 'QA account without curriculum' }
        else if (path.endsWith('/admin/capabilities')) body = { mail_enabled: false }
        await route.fulfill({ json: body })
      })
    })
    const nav = result.page.getByRole('navigation', { name: 'Điều hướng chính' })
    for (const name of ['Trang chủ', 'Lịch học', 'Học phần', 'Kế hoạch', 'Luyện đề', 'Môn tự chọn', 'Ghi chú', 'AI Assistant', 'Cộng đồng', 'Tin nhắn', 'Cài đặt', 'Quản trị']) {
      await nav.getByRole('button', { name, exact: true }).click()
      await result.page.locator('.view-stage').waitFor()
      await result.page.waitForLoadState('networkidle')
      assert.ok((await result.page.locator('.view-stage').innerText()).trim().length > 0, `${name} has content`)
    }
    await result.page.getByLabel('Mở hồ sơ cá nhân', { exact: true }).click()
    await result.page.waitForLoadState('networkidle')
    assert.deepEqual(result.errors, [])
    console.log('Existing views: home, schedule, courses, progress, practice, electives, notes, AI, community, messages, settings, admin and profile rendered without page errors (mock APIs)')
    await result.page.close()
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
