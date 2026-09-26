const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')

const profile = {
  id: 'qa-user', email: 'qa@example.edu', full_name: 'Nguyễn Minh Anh',
  university: { id: 'uth', name: 'Trường Đại học Giao thông vận tải TP.HCM', short_name: 'UTH' },
  major: 'Công nghệ thông tin', student_year: 3,
}
const curriculum = {
  id: 'qa-curriculum', program_id: 'qa-program', major: 'Công nghệ thông tin',
  specialization: 'Công nghệ thông tin', cohort: 2024, source_file: 'CTDT-UTH.pdf',
  source_url: 'https://ut.edu.vn/ctdt.pdf', imported_at: '2026-09-26T00:00:00Z', elective_count: 24,
}
const career = { code: 'ai_engineer', label: 'AI Engineer', skills: ['Python', 'Machine Learning'] }
const plan = {
  curriculum, career, status: 'valid_known_rules', selected_credits: 3, required_credits: 3,
  courses: [{
    catalog_course_id: 'qa-course', curriculum_course_id: 'qa-membership', code: 'CT001',
    name: 'Lập trình Python', credits: 3, group: 'TC01 (chọn 3 TC)',
    semester: null, academic_year: null, prerequisite: null, relevance_score: 0.25,
    matched_skills: ['Python'], reasons: ['Môn có trong đúng chương trình.', 'Tên môn liên quan đến Python.'],
    source_url: curriculum.source_url,
  }],
  groups: [{ name: 'TC01 (chọn 3 TC)', required_credits: 3, selected_credits: 3, status: 'satisfied' }],
  skill_coverage: { Python: 100, 'Machine Learning': 0 },
  warnings: ['Tài liệu nguồn không cung cấp học kỳ; cần đối chiếu với nhà trường.'],
  explanation: 'Kế hoạch dùng các quy tắc đã biết trong CTĐT UTH. Điểm phù hợp là ước tính từ tên môn.',
}

async function capture(browser, width, height, name) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.addInitScript(() => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'qa', refresh_token: 'qa', token_type: 'bearer', expires_in: 3600,
    }))
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) body = profile
    else if (path.endsWith('/social/messages/unread')) body = { total: 0, by_sender: {} }
    else if (path.endsWith('/electives/availability')) body = { status: 'supported', university_code: 'UTH', message: 'Sẵn sàng.' }
    else if (path.endsWith('/electives/curricula')) body = [curriculum]
    else if (path.endsWith('/electives/careers')) body = [career]
    else if (path.endsWith('/electives/recommend')) body = plan
    else if (path.endsWith('/practice/subjects')) body = []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  if (width <= 760) {
    await page.getByLabel('Mở thêm điều hướng').click()
    await page.locator('.mobile-more').getByRole('button', { name: 'Môn tự chọn' }).click()
  } else {
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Môn tự chọn' }).click()
  }
  await page.getByRole('button', { name: /Xem gợi ý/ }).click()
  await page.getByRole('heading', { name: 'Môn được gợi ý' }).waitFor()
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true, animations: 'disabled' })
  await page.screenshot({ path: `.impeccable/review/${name}-preview.jpg`, type: 'jpeg', quality: 35, animations: 'disabled' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${name}: horizontal overflow ${overflow}px`)
  await page.close()
}

async function capturePractice(browser, width, height, name) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.addInitScript(() => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'qa', refresh_token: 'qa', token_type: 'bearer', expires_in: 3600,
    }))
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) body = profile
    else if (path.endsWith('/social/messages/unread')) body = { total: 0, by_sender: {} }
    else if (path.endsWith('/practice/subjects')) body = [{ id: 'qa-subject', name: 'Cấu trúc dữ liệu', code: 'CTDL', question_count: 1, exam_count: 1, completed_exams: 1, latest_score: 0, best_score: 0 }]
    else if (path.endsWith('/practice/history')) body = [{ attempt_id: 'qa-attempt', exam_id: 'qa-exam', subject_id: 'qa-subject', exam_title: 'Đề cơ bản', score: 0, submitted_at: '2026-09-26T00:00:00Z' }]
    else if (path.endsWith('/practice/attempts/qa-attempt/result')) body = {
      attempt_id: 'qa-attempt', exam_id: 'qa-exam', subject_id: 'qa-subject',
      score: 0, correct: 0, incorrect: 1, unanswered: 0, accuracy: 0,
      duration_seconds: 180, submitted_at: '2026-09-26T00:00:00Z',
      questions: [{ id: 'qa-question', question_id: 'qa-bank-question', text: 'Cây nhị phân có tối đa bao nhiêu nút con?', selected_keys: ['B'], correct_keys: ['A'], options: [{ key: 'A', text: 'Hai' }, { key: 'B', text: 'Ba' }], is_correct: false, explanation: 'Theo định nghĩa, mỗi nút có tối đa hai nút con.', source_name: 'Tài liệu được duyệt', source_url: null, topic: 'Cây nhị phân' }],
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  if (width <= 760) {
    await page.getByLabel('Mở thêm điều hướng').click()
    await page.locator('.mobile-more').getByRole('button', { name: 'Luyện đề' }).click()
  } else {
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Luyện đề' }).click()
  }
  await page.getByRole('button', { name: 'Xem lại' }).click()
  await page.getByRole('heading', { name: 'Kết quả bài làm' }).waitFor()
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true, animations: 'disabled' })
  await page.screenshot({ path: `.impeccable/review/${name}-preview.jpg`, type: 'jpeg', quality: 35, animations: 'disabled' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${name}: horizontal overflow ${overflow}px`)
  await page.close()
}

async function main() {
  mkdirSync('.impeccable/review', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    await capture(browser, 1440, 900, 'desktop')
    await capture(browser, 390, 844, 'mobile')
    await capturePractice(browser, 1440, 900, 'practice-desktop')
    await capturePractice(browser, 390, 844, 'practice-mobile')
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
