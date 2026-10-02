const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')
const { prepare, open } = require('./qa-it.cjs')
const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4173').replace(
  /\/$/,
  '',
)
const views = [
  ['computer', 'Computer Architecture'],
  ['os', 'Operating System'],
  ['database', 'Database Lab'],
  ['network', 'Network Lab'],
  ['ai', 'AI / Machine Learning'],
  ['security', 'Security Lab'],
]
async function finishSteps(page) {
  const next = page.getByRole('button', { name: 'Bước tiếp', exact: true })
  for (let i = 0; i < 160 && (await next.isEnabled()); i++) await next.click()
  assert.equal(await next.isDisabled(), true, 'finite trace must finish')
}
async function query(page, sql, expectError = false) {
  await page.getByLabel('SQL editor').fill(sql)
  await page.getByRole('button', { name: 'Chạy SQL', exact: true }).click()
  await page.getByRole('button', { name: 'Chạy SQL', exact: true }).waitFor()
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'Chạy SQL',
      )
      return b instanceof HTMLButtonElement && !b.disabled
    },
    null,
    { timeout: 25000 },
  )
  if (expectError) await page.getByRole('alert').waitFor()
  else assert.equal(await page.getByRole('alert').count(), 0)
}
async function overflow(page, id) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `${id} page overflow`,
  )
}
async function functional(browser) {
  const { page, errors, requests } = await prepare(browser)
  await open(page, '/labs/it', 'CNTT Lab')
  assert.equal(
    await page.getByRole('link', { name: 'Mở lab', exact: true }).count(),
    8,
  )
  assert.equal(
    requests.some((u) =>
      /ComputerLab-|OSLab-|DatabaseLab-|NetworkLab-|MLLab-|SecurityLab-|sql-wasm/.test(
        u,
      ),
    ),
    false,
    'Hub must not load lab engines',
  )
  await open(page, '/labs/it/computer', 'Computer Architecture')
  await finishSteps(page)
  assert.match(await page.locator('.it-operation').textContent(), /HALT|Dừng/)
  const ram = page.locator('.it-memory-grid').nth(1)
  assert.equal(
    await ram.locator('div').nth(2).locator('strong').textContent(),
    '12',
  )
  await page.getByLabel('Lệnh CPU').fill('LOAD R0 99')
  await page.getByRole('alert').waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Phát', exact: true }).isDisabled(),
    true,
  )
  await page.getByRole('button', { name: 'Dữ liệu mẫu', exact: true }).click()
  await page.reload()
  await page.getByLabel('Lệnh CPU').waitFor()
  assert.match(await page.getByLabel('Lệnh CPU').inputValue(), /STORE R2 2/)
  await open(page, '/labs/it/os', 'Operating System')
  for (const policy of ['fcfs', 'sjf', 'srtf', 'round-robin', 'priority']) {
    await page.getByLabel('Chính sách').selectOption(policy)
    assert.equal(await page.locator('.it-data-table tbody tr').count(), 3)
    assert.equal(await page.getByRole('alert').count(), 0)
  }
  await page.getByRole('button', { name: 'Cấp phát RAM', exact: true }).click()
  for (const fit of ['first', 'best', 'worst']) {
    await page.getByLabel('Chọn khối').selectOption(fit)
    assert.equal(
      (await page.locator('.it-memory-blocks div').count()) > 0,
      true,
    )
  }
  await page.getByRole('button', { name: 'Deadlock', exact: true }).click()
  assert.match(await page.getByRole('status').textContent(), /Có deadlock/)
  await page.getByLabel('Cạnh yêu cầu hoặc cấp phát').fill('P1 -> R1\nR1 -> P2')
  assert.match(
    await page.getByRole('status').textContent(),
    /Không có chu trình/,
  )
  await open(page, '/labs/it/database', 'Database Lab')
  await query(
    page,
    "INSERT INTO students VALUES(4,'Practice'); SELECT COUNT(*) AS learners FROM students;",
  )
  assert.equal(
    await page.getByRole('cell', { name: '4', exact: true }).count(),
    1,
  )
  await page.reload()
  await page.getByLabel('SQL editor').waitFor()
  await query(page, 'SELECT COUNT(*) AS learners FROM students;')
  assert.equal(
    await page.getByRole('cell', { name: '4', exact: true }).count(),
    1,
    'snapshot survives reload',
  )
  await query(
    page,
    "UPDATE students SET name='Changed' WHERE id=4;SELECT nope FROM missing;",
    true,
  )
  await query(page, 'SELECT name FROM students WHERE id=4;')
  assert.equal(
    await page.getByRole('cell', { name: 'Practice', exact: true }).count(),
    1,
    'failed batch does not persist writes',
  )
  await page.getByLabel('Ví dụ').selectOption('index')
  await page.getByRole('button', { name: 'Chạy SQL', exact: true }).click()
  await page
    .getByRole('cell', { name: /idx_course/ })
    .waitFor({ timeout: 25000 })
  await page.getByRole('button', { name: 'ERD & Index', exact: true }).click()
  await page
    .getByRole('heading', {
      name: 'Schema / ERD từ database thực hành',
      exact: true,
    })
    .waitFor()
  assert.match(await page.locator('pre').first().textContent(), /CREATE TABLE/)
  await page
    .getByRole('button', { name: 'JOIN Visualizer', exact: true })
    .click()
  for (const kind of ['inner', 'left', 'right', 'full']) {
    await page.getByLabel('Kiểu JOIN').selectOption(kind)
    const expected = { inner: 3, left: 4, right: 4, full: 5 }[kind]
    assert.equal(
      await page.locator('.it-data-table tbody tr').count(),
      expected,
    )
  }
  await page
    .getByRole('button', { name: 'SQL Playground', exact: true })
    .click()
  if (!process.env.QA_SMOKE_ONLY) {
    assert.equal(
      new URL(base).hostname,
      '127.0.0.1',
      'Resource/isolation probes are localhost-only',
    )
    await query(
      page,
      "SELECT '<script>window.demoInjected=1</script>' AS text;",
    )
    assert.equal(await page.locator('.it-data-table script').count(), 0)
    assert.equal(await page.evaluate(() => window.demoInjected), undefined)
    await query(
      page,
      'WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT SUM(x) FROM n;',
      true,
    )
    assert.match(await page.getByRole('alert').textContent(), /3 giây/)
    await query(page, 'SELECT COUNT(*) AS learners FROM students;')
    assert.equal(
      await page.getByRole('cell', { name: '4', exact: true }).count(),
      1,
    )
    await page
      .getByLabel('SQL editor')
      .fill(
        'WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT SUM(x) FROM n;',
      )
    await page.getByRole('button', { name: 'Chạy SQL', exact: true }).click()
    await page.getByRole('button', { name: 'Dừng SQL', exact: true }).click()
    assert.equal(
      await page
        .getByRole('button', { name: 'Chạy SQL', exact: true })
        .isEnabled(),
      true,
    )
    await query(page, 'SELECT 1;'.repeat(21), true)
    assert.match(await page.getByRole('alert').textContent(), /20/)
    await query(page, "SELECT printf('%100000s','x')", true)
    assert.match(await page.getByRole('alert').textContent(), /64 KiB/)
  }
  page.once('dialog', (d) => d.dismiss())
  await page
    .getByRole('button', { name: 'Khôi phục dữ liệu mẫu', exact: true })
    .click()
  await query(page, 'SELECT COUNT(*) AS learners FROM students;')
  assert.equal(
    await page.getByRole('cell', { name: '4', exact: true }).count(),
    1,
  )
  page.once('dialog', (d) => d.accept())
  await page
    .getByRole('button', { name: 'Khôi phục dữ liệu mẫu', exact: true })
    .click()
  await query(page, 'SELECT COUNT(*) AS learners FROM students;')
  assert.equal(
    await page.getByRole('cell', { name: '3', exact: true }).count(),
    1,
  )
  console.log(
    'Actual SQLite CRUD, snapshot/reload, atomic save, query plans, JOIN, reset and bounds passed',
  )
  await open(page, '/labs/it/network', 'Network Lab')
  await finishSteps(page)
  assert.match(await page.getByRole('status').textContent(), /Đã đến đích/)
  await page.getByLabel('Link: ID đầu ID cuối').fill('')
  assert.match(await page.getByRole('status').textContent(), /Unreachable/)
  await page
    .getByRole('button', { name: 'Hai subnet mẫu', exact: true })
    .click()
  await finishSteps(page)
  assert.match(await page.getByRole('status').textContent(), /Đã đến đích/)
  await page
    .getByLabel('Thiết bị: ID kind IP mask gateway')
    .fill(
      'PC1 pc 10.0.1.2 255.255.255.0 -\nSRV1 server 10.0.2.2 255.255.255.0 -',
    )
  await page.getByLabel('Link: ID đầu ID cuối').fill('PC1 SRV1')
  assert.match(await page.getByRole('status').textContent(), /Missing gateway/)
  await page.getByRole('button', { name: 'Mạng mẫu', exact: true }).click()
  await open(page, '/labs/it/ai', 'AI / Machine Learning')
  for (const model of [
    'linear-regression',
    'knn',
    'kmeans',
    'decision-tree',
    'neural-network',
  ]) {
    await page.getByLabel('Mô hình').selectOption(model)
    assert.equal(await page.getByRole('alert').count(), 0)
    const start = await page.getByText(/^Vòng:/).textContent()
    await finishSteps(page)
    const end = await page.getByText(/^Vòng:/).textContent()
    if (model === 'linear-regression' || model === 'neural-network') {
      const loss = (text) => Number(text.match(/Loss: ([0-9.]+)/)?.[1])
      assert.equal(
        loss(end) < loss(start),
        true,
        `${model} loss must actually decrease`,
      )
    }
    assert.match(end, /Query: -?\d+/)
  }
  await page.getByLabel('Dữ liệu: x y nhãn (0/1)').fill('wrong')
  await page.getByRole('alert').waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Phát', exact: true }).isDisabled(),
    true,
  )
  await page.getByRole('button', { name: 'Dữ liệu mẫu', exact: true }).click()
  await open(page, '/labs/it/security', 'Security Lab')
  await page.getByLabel('Chuỗi minh họa').fill('abc')
  await page.getByRole('button', { name: 'Tính SHA-256', exact: true }).click()
  await page
    .locator('pre[role=status]')
    .filter({ hasText: 'ba7816bf8f01cfea' })
    .waitFor()
  await page
    .getByRole('button', { name: 'Tạo salt & PBKDF2', exact: true })
    .click()
  await page
    .locator('pre[role=status]')
    .filter({ hasText: '600000 iterations' })
    .waitFor()
  await page.getByRole('button', { name: 'AES-GCM', exact: true }).click()
  await page
    .getByRole('button', { name: 'Mã hóa AES-GCM', exact: true })
    .click()
  await page
    .locator('pre[role=status]')
    .filter({ hasText: 'authentication tag' })
    .waitFor()
  await page.getByRole('button', { name: 'Giải mã', exact: true }).click()
  await page.locator('pre[role=status]').filter({ hasText: 'abc' }).waitFor()
  await page
    .getByRole('button', { name: 'Thử sửa ciphertext', exact: true })
    .click()
  await page.getByRole('alert').filter({ hasText: 'từ chối' }).waitFor()
  const saved = await page.evaluate(() =>
    localStorage.getItem('nexamin.it.security-lesson.v1'),
  )
  assert.equal(saved.includes('abc'), false)
  await page
    .getByRole('button', {
      name: 'Authentication / Authorization',
      exact: true,
    })
    .click()
  await page.getByLabel('Role giả lập').selectOption('admin')
  await page.getByLabel('Hành động').selectOption('password')
  assert.match(await page.getByRole('status').textContent(), /Từ chối/)
  await page.getByLabel('Hành động').selectOption('reset')
  assert.match(await page.getByRole('status').textContent(), /Cho phép/)
  assert.equal(
    requests.some((u) =>
      /\/api\/.*(?:code\/execute|sql\/execute|admin\/)/.test(u),
    ),
    false,
  )
  assert.deepEqual(errors, [])
  for (const width of [360, 760, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [id, title] of views) {
      await open(page, `/labs/it/${id}`, title)
      await overflow(page, `${id}/${width}`)
    }
  }
  await page.close()
  console.log(
    'CPU, all OS policies/memory/deadlock, network routes/errors, five actual ML models and Web Crypto passed; widths 360–1600 passed',
  )
}
async function captures(browser) {
  for (const width of [1440, 360])
    for (const theme of ['dark', 'light']) {
      const { page, errors } = await prepare(browser, width, theme)
      await page.unroute(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//)
      for (const [id, title] of views) {
        await open(page, `/labs/it/${id}`, title)
        if (id === 'database')
          await query(
            page,
            'SELECT s.name,c.title,e.score FROM students s JOIN enrollments e ON s.id=e.student_id JOIN courses c ON c.id=e.course_id ORDER BY s.id,c.id;',
          )
        if (id === 'computer' || id === 'network' || id === 'ai')
          await page
            .getByRole('button', { name: 'Bước tiếp', exact: true })
            .click()
        if (id === 'security') {
          await page
            .getByRole('button', { name: 'Tính SHA-256', exact: true })
            .click()
          await page.locator('pre[role=status]').waitFor()
        }
        await page.evaluate(() => {
          document.activeElement?.blur()
          window.scrollTo(0, 0)
        })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(200)
        await overflow(page, `${id}/${width}/${theme}`)
        await page.screenshot({
          path: `.impeccable/review/it23-${id}-${width === 360 ? 'mobile' : 'desktop'}-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        })
      }
      assert.deepEqual(errors, [])
      await page.close()
    }
  console.log('24 real-state desktop/mobile dark/light captures saved')
}
async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    if (!process.env.QA_CAPTURE_ONLY) await functional(browser)
    if (!process.env.QA_FUNCTIONAL_ONLY) await captures(browser)
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
