const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')
const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4173').replace(
  /\/$/,
  '',
)
async function prepare(browser, width = 1440, theme = 'dark') {
  const page = await browser.newPage({
      viewport: { width, height: width === 360 ? 800 : 1000 },
      reducedMotion: 'reduce',
    }),
    errors = [],
    requests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  await page.addInitScript((theme) => {
    if (window !== window.top) return
    localStorage.setItem('studyhub.theme.v1', theme)
    sessionStorage.setItem(
      'studyhub.auth.v1',
      JSON.stringify({
        access_token: 'qa',
        refresh_token: 'qa',
        token_type: 'bearer',
        expires_in: 3600,
      }),
    )
  }, theme)
  await page.routeWebSocket('**/social/ws**', () => {})
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.abort(),
  )
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path.endsWith('/auth/me') || path.endsWith('/users/me'))
      body = {
        id: 'qa',
        email: 'qa@example.edu',
        full_name: 'Nguyễn Minh Anh',
        avatar_url: null,
        university: null,
        major: 'CNTT',
        student_year: 2,
        role: 'student',
      }
    else if (path.endsWith('/social/messages/unread'))
      body = { total: 0, by_sender: {} }
    else if (path.endsWith('/electives/availability'))
      body = { status: 'unsupported_university', elective_count: 0 }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  return { page, errors, requests }
}
async function open(page, path, heading) {
  const response = await page.goto(base + path, {
    waitUntil: 'domcontentloaded',
  })
  assert.equal(response.status(), 200)
  await page
    .getByRole('heading', { name: heading, exact: true })
    .waitFor({ timeout: 45000 })
}
async function run(page, expected, status = 'Chạy thành công') {
  await page.getByRole('button', { name: 'Chạy', exact: true }).click()
  await page.waitForFunction(
    () => {
      const button = document.querySelector('.it-code-toolbar button.primary')
      return button instanceof HTMLButtonElement && !button.disabled
    },
    null,
    { timeout: 125000 },
  )
  const actual = await page.locator('.it-output [role="status"]').textContent()
  assert.equal(
    actual,
    status,
    await page.getByLabel('stderr', { exact: true }).textContent(),
  )
  if (expected !== null)
    assert.equal(
      (await page.getByLabel('stdout', { exact: true }).textContent()).trim(),
      expected,
    )
}
async function source(page, text) {
  await page.getByLabel('Trình soạn thảo code').fill(text)
}
async function capture(page, path) {
  await page.evaluate(() => {
    document.activeElement?.blur()
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(150)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
}
async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    if (!process.env.QA_CAPTURE_ONLY) {
      const { page, errors, requests } = await prepare(browser)
      await open(page, '/labs/it', 'CNTT Lab')
      assert.equal(await page.getByRole('article').count(), 8)
      assert.equal(
        requests.some((url) =>
          /CodeLab-|wasi.worker|runtimes\/code|AlgorithmLab-|AnatomyViewer/.test(
            url,
          ),
        ),
        false,
        'Hub must not download editors, runners or simulations',
      )
      await page.screenshot({
        path: '.impeccable/review/it-functional-hub.png',
        fullPage: true,
        animations: 'disabled',
      })
      await open(page, '/labs/it/code', 'Code Lab')
      await page.getByLabel('Trình soạn thảo code').waitFor()
      await page.getByLabel('Bài tập').selectOption('sum')
      for (const language of ['python', 'c', 'cpp', 'java', 'javascript']) {
        await page.getByLabel('Ngôn ngữ').selectOption(language)
        await run(page, '7')
        console.log(`real stdin/stdout passed: ${language}`)
      }
      await page.getByLabel('Ngôn ngữ').selectOption('python')
      await page.getByRole('button', { name: 'Kiểm tra bài' }).click()
      await page
        .getByText('3 / 3 đạt · đã chạy 3 test', { exact: true })
        .waitFor({ timeout: 45000 })
      await page.screenshot({
        path: '.impeccable/review/it-functional-code.png',
        fullPage: true,
        animations: 'disabled',
      })
      if (!process.env.QA_SMOKE_ONLY) {
        assert.equal(
          new URL(base).hostname,
          '127.0.0.1',
          'Isolation probes are localhost-only; use QA_SMOKE_ONLY on production',
        )
        await source(page, 'print("<script>alert(1)</script>")')
        await run(page, '<script>alert(1)</script>')
        assert.equal(await page.locator('.it-output script').count(), 0)
        await source(page, 'raise ValueError("exercise error")')
        await run(page, null, 'Lỗi khi chạy')
        assert.match(
          await page.getByLabel('stderr', { exact: true }).textContent(),
          /ValueError/,
        )
        await source(page, 'while True: pass')
        await page.getByRole('button', { name: 'Chạy', exact: true }).click()
        await page.getByText('Đang chạy…', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Dừng', exact: true }).click()
        await page.getByText('Đã dừng', { exact: true }).waitFor()
        assert.equal(
          await page
            .getByRole('button', { name: 'Chạy', exact: true })
            .isEnabled(),
          true,
        )
        await run(page, null, 'Quá thời gian')
        await source(page, 'print("x" * 70000)')
        await run(page, null, 'Vượt giới hạn')
        await page.getByLabel('Ngôn ngữ').selectOption('c')
        await source(page, 'int main( {')
        await run(page, null, 'Lỗi biên dịch')
        await page.getByLabel('Ngôn ngữ').selectOption('java')
        await source(
          page,
          'public class Main { public static void main(String[] args) throws Exception { System.out.println(Class.forName("doppio.JavaScript").getMethod("eval", String.class).invoke(null, "1 + 1")); }}',
        )
        await run(page, null, 'Lỗi khi chạy')
        assert.match(
          await page.getByLabel('stderr', { exact: true }).textContent(),
          /SecurityException|bridge disabled/,
        )
        await source(
          page,
          'import java.util.Scanner; public class Main { public static void main(String[] args) {Scanner s=new Scanner(System.in);int total=0;while(s.hasNextInt()) total+=s.nextInt();System.out.println(total);}}',
        )
        await run(page, '7')
        // Network isolation: ordinary local probe only, never attacks an external target.
        await page.getByLabel('Ngôn ngữ').selectOption('python')
        await source(
          page,
          'import socket\nsocket.create_connection(("127.0.0.1", 8010), 1)',
        )
        await run(page, null, 'Lỗi khi chạy')
        assert.equal(
          requests.some((url) => url.includes('example.org')),
          false,
        )
      }
      await page.getByLabel('Bài tập').selectOption('hello')
      await page.getByLabel('Ngôn ngữ').selectOption('python')
      await source(page, 'print("Hello World")')
      await open(page, '/labs/it/algorithms', 'Algorithm Lab')
      for (const algorithm of [
        'bubble',
        'selection',
        'insertion',
        'merge',
        'quick',
        'linear',
        'binary',
        'bfs',
        'dfs',
        'dijkstra',
      ]) {
        await page.getByLabel('Thuật toán').selectOption(algorithm)
        await page
          .getByRole('button', { name: 'Bước tiếp', exact: true })
          .click()
        assert.equal(
          await page.locator('.it-pseudocode li[aria-current="step"]').count(),
          1,
        )
        await page
          .getByRole('button', { name: 'Bắt đầu lại', exact: true })
          .click()
        assert.equal(
          await page
            .getByRole('button', { name: 'Bước trước', exact: true })
            .isDisabled(),
          true,
        )
      }
      await page.getByLabel('Thuật toán').selectOption('bubble')
      await page.getByLabel('Tốc độ', { exact: true }).selectOption('2')
      await page.getByRole('button', { name: 'Phát', exact: true }).click()
      await page
        .getByRole('button', { name: 'Tạm dừng', exact: true })
        .waitFor()
      await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
      const paused = await page.locator('.it-operation').textContent()
      await page.waitForTimeout(600)
      assert.equal(await page.locator('.it-operation').textContent(), paused)
      await page.getByRole('button', { name: 'Phát', exact: true }).click()
      await page
        .getByText('Hoàn tất: dãy tăng dần', { exact: true })
        .waitFor({ timeout: 15000 })
      assert.equal(
        await page
          .getByRole('button', { name: 'Bước tiếp', exact: true })
          .isDisabled(),
        true,
      )
      await page.getByLabel('Thuật toán').selectOption('dijkstra')
      await page.getByRole('button', { name: 'Bước tiếp', exact: true }).click()
      await page.screenshot({
        path: '.impeccable/review/it-functional-algorithms.png',
        fullPage: true,
        animations: 'disabled',
      })
      await page.getByLabel('Cạnh: đầu cuối trọng số').fill('0 1 -2')
      await page.getByRole('alert').waitFor()
      assert.equal(
        await page
          .getByRole('button', { name: 'Phát', exact: true })
          .isDisabled(),
        true,
      )
      for (const id of [
        'computer',
        'network',
        'os',
        'database',
        'ai',
        'security',
      ]) {
        await page.goto(`${base}/labs/it/${id}`)
        await page
          .getByText(
            'Trang này mới có cấu trúc và phạm vi; chưa có mô phỏng hoạt động.',
          )
          .waitFor()
      }
      assert.deepEqual(errors, [])
      await page.close()
    }
    if (!process.env.QA_FUNCTIONAL_ONLY)
      for (const width of [1440, 360])
        for (const theme of ['dark', 'light']) {
          const { page, errors } = await prepare(browser, width, theme)
          for (const [path, heading, name] of [
            ['/labs/it', 'CNTT Lab', 'hub'],
            ['/labs/it/code', 'Code Lab', 'code'],
            ['/labs/it/algorithms', 'Algorithm Lab', 'algorithms'],
          ]) {
            await open(page, path, heading)
            if (name === 'code')
              await page.getByLabel('Trình soạn thảo code').waitFor()
            if (name === 'algorithms') {
              await page.getByLabel('Thuật toán').selectOption('dijkstra')
              await page.getByRole('button', { name: 'Bước tiếp' }).click()
            }
            await capture(
              page,
              `.impeccable/review/it-${name}-${width === 360 ? 'mobile' : 'desktop'}-${theme}.png`,
            )
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              ),
              false,
              `${name} ${width} ${theme} overflow`,
            )
          }
          assert.deepEqual(errors, [])
          await page.close()
        }
    console.log(
      process.env.QA_CAPTURE_ONLY
        ? '12 responsive dark/light captures passed'
        : 'IT routes, 5 real languages, local security probes, tests and algorithms passed',
    )
  } finally {
    await browser.close()
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
module.exports = { prepare, open, run, source }
