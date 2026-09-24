import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const baseUrl = process.env.NEXAMIN_PREVIEW_URL ?? 'http://127.0.0.1:5174'
const reviewDir = '.impeccable/review'
await mkdir(reviewDir, { recursive: true })

const profile = { id: 'qa-user', email: 'qa@example.com', full_name: 'Nguyễn Minh Anh', avatar_url: null, university: null, major: 'Công nghệ thông tin', student_year: 2 }
const course = { id: 'qa-course', name: 'Khai thác dữ liệu', code: 'DATA101', description: 'Nội dung học tập', semester: 'HK1', academic_year: '2026', credits: 3, final_score: 8.5, is_completed: true, completed_at: null, color: '#5265e8', visibility: 'private' }
const summary = { policy: { id: 'qa-policy', name: 'Khung tín chỉ', source_url: 'https://example.com', is_school_specific: false, bands: [] }, gpa: 4, completed_credits: 3, graded_credits: 3, degree_classification: 'Xuất sắc', grades: [{ course_id: course.id, score10: 8.5, grade4: 4, letter: 'A', passed: true, credits: 3 }] }
const browser = await chromium.launch({ headless: true })
const results = []

for (const theme of ['dark', 'light']) {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: theme })
    await context.addInitScript((selectedTheme) => {
      localStorage.setItem('studyhub.theme.v1', selectedTheme)
      sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({ access_token: 'qa-access', refresh_token: 'qa-refresh', token_type: 'bearer', expires_in: 900 }))
    }, theme)
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const body = path.includes('/auth/me') || path.includes('/users/me') ? profile
        : path.includes('/messages/unread') ? { total: 0, by_sender: {} }
        : path.includes('/friendships') || path.includes('/calendar') ? []
        : path.includes('/courses/summary/academic') ? summary
        : path.includes('/courses') ? { items: [course], page: 1, page_size: 100, total: 1 }
        : { items: [], total: 0 }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Học phần|Môn học/ }).first().click()
    await page.getByText('Khai thác dữ liệu').waitFor()
    await page.getByRole('button', { name: 'Kết quả' }).click()
    if (viewport.name === 'mobile') await page.locator('.mobile-more summary').click()
    const inspected = await page.evaluate(() => {
      const css = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const style = getComputedStyle(element)
        const bounds = element.getBoundingClientRect()
        return { x: Math.round(bounds.x), right: Math.round(bounds.right), color: style.color, background: style.backgroundColor, filter: style.filter, width: Math.round(bounds.width), height: Math.round(bounds.height) }
      }
      return {
        title: document.title,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        logo: css(window.innerWidth <= 760 ? '.mobile-brand .nexamin-mark' : '.sidebar .nexamin-mark'),
        scoreInput: css('.grade-form input[name="finalScore"]'),
        gradeForm: css('.grade-form'),
        mobileMenu: css('.mobile-more > div'),
      }
    })
    await page.screenshot({ path: `${reviewDir}/nexamin-${theme}-${viewport.name}.png`, fullPage: true })
    results.push({ theme, viewport: viewport.name, ...inspected, pageErrors })
    await context.close()
  }
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
