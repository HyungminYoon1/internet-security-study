import { chromium, firefox } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WEEK_NUMBERS, buildCatalog } from '../dist/src/domain/content.js';
import { initialState, makeBackup, parseBackup } from '../dist/src/domain/backup.js';
import { newExam, finishExam } from '../dist/src/domain/learning.js';
import { STORAGE_KEY } from '../dist/src/storage.js';

const data = buildCatalog(await Promise.all(WEEK_NUMBERS.map(n => readFile(new URL(`../dist/content/week-${String(n).padStart(2,'0')}.json`, import.meta.url), 'utf8').then(JSON.parse))));
const output = resolve('output/playwright'); await mkdir(output, { recursive: true });
const browserName = process.argv.find(a => a.startsWith('--engine='))?.slice(9) ?? 'chromium';
assert(['chromium', 'firefox'].includes(browserName), 'Supported verification engines: chromium, firefox');
let server, browser;
let base = process.argv.find(a => a.startsWith('--base='))?.slice(7);
if (!base) {
  server = spawn(process.execPath, ['tools/serve.mjs', '0'], { stdio: ['ignore','pipe','pipe'], windowsHide: true });
  base = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview server startup timeout')), 10000);
    server.stdout.on('data', buffer => { const match = buffer.toString().match(/Local: (http:\/\/127\.0\.0\.1:\d+\/)/); if (match) { clearTimeout(timeout); done(match[1]); } });
    server.once('error', reject);
  });
}
assert(/^(http:\/\/127\.0\.0\.1:\d+\/|https:\/\/hyungminyoon1\.github\.io\/internet-security-study\/)$/.test(base), 'Only intended app targets are allowed');
const results = [], contexts = [];
const errors = [];
async function fresh({ state, raw, mobile = false, init } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'ko-KR' });
  contexts.push(context);
  if (raw !== undefined || state) await context.addInitScript(({ key, value }) => { if (!sessionStorage.getItem('fixture-installed')) { localStorage.setItem(key, value); localStorage.setItem('another-app-fixture', 'preserve'); sessionStorage.setItem('fixture-installed', 'yes'); } }, { key: STORAGE_KEY, value: raw ?? JSON.stringify(state) });
  if (init) await context.addInitScript(init);
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.getByRole('heading', { name: '오늘의 학습', exact: true }).waitFor();
  return { context, page };
}
async function readState(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY); }
async function goto(page, hash) { await page.goto(`${base}#${hash}`); await page.locator('#view h1').waitFor(); }
async function check(name, fn) {
  const firstContext = contexts.length;
  try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) {
    results.push({ name, status: 'FAIL', message: error.message }); console.error(`FAIL ${name}: ${error.message}`);
    const page = contexts[firstContext]?.pages()[0];
    if (page) await page.screenshot({ path: resolve(output, `failure-${browserName}-${results.length}.png`), timeout: 3000 }).catch(() => {});
  }
  finally { for (const context of contexts.splice(firstContext)) await context.close(); }
}
try {
  browser = await ({ chromium, firefox }[browserName]).launch({ headless: true });
  await check('guided concept/example/retrieval/application flow and persisted step', async () => {
    const { page } = await fresh();
    await page.getByRole('link', { name: '첫 개념 시작하기 →' }).click();
    await page.getByRole('button', { name: 'STEP 02 풀이 예제' }).click();
    assert(await page.locator('.worked-steps li').count() >= 2);
    await page.getByRole('button', { name: 'STEP 03 스스로 설명' }).click();
    await page.getByText('생각한 뒤 해설 보기', { exact: true }).click();
    assert(await page.locator('.retrieval details').getAttribute('open') !== null);
    await page.getByRole('button', { name: 'STEP 04 문제 적용' }).click();
    const before = await readState(page); assert.equal(before.read.length, 1);
    await page.reload(); await page.getByRole('button', { name: '개념 적용 문제 풀기 →' }).waitFor();
    assert.equal((await readState(page)).settings.lessonStep, 3);
  });
  await check('practice grading preserves correct option IDs, confidence, hints and a single attempt', async () => {
    const { page } = await fresh();
    await page.getByRole('button', { name: '오늘의 10문제 풀기', exact: true }).click();
    const prompt = await page.locator('#question-title').innerText(), q = data.questions.find(q => q.prompt === prompt);
    await page.getByRole('radio', { name: q.options.find(o => o.id === q.answerId).text, exact: true }).check();
    await page.getByRole('button', { name: '확실해요', exact: true }).click();
    await page.getByRole('button', { name: '정답 확인', exact: true }).click();
    await page.locator('#feedback').waitFor();
    const saved = await readState(page); assert.equal(saved.attempts.length, 1); assert.equal(saved.attempts[0].correct, true); assert.equal(saved.attempts[0].confidence, 'sure');
    assert.equal(await page.locator('.rationale').count(), 4);
    await page.getByRole('button', { name: '다음 문제 →', exact: true }).click();
    await page.getByText('개념 힌트', { exact: true }).click();
    await page.getByRole('radio').first().check(); await page.getByRole('button', { name: '정답 확인', exact: true }).click();
    assert.equal((await readState(page)).attempts.at(-1).hinted, true);
  });
  await check('live exam answer count updates immediately', async () => {
    const { page } = await fresh(); await goto(page, 'exam');
    await page.locator('#mock-count').selectOption('20'); await page.getByRole('button', { name: '60분 모의고사 시작 →' }).click();
    await page.getByRole('radio').first().check();
    assert.match(await page.locator('.exam-aside').innerText(), /1\/20문항 응답/);
  });
  await check('exam reload keeps deadline, selected answer and flags; timeout auto-submits', async () => {
    const { page } = await fresh({ init: () => { const actualNow = Date.now.bind(Date); window.testClockShift = 0; Date.now = () => actualNow() + window.testClockShift; } });
    await goto(page, 'exam'); await page.locator('#mock-count').selectOption('20'); await page.getByRole('button', { name: '60분 모의고사 시작 →' }).click();
    await page.getByRole('radio').first().check(); await page.getByRole('button', { name: '다시 볼 문제', exact: true }).click();
    const before = (await readState(page)).activeExam;
    await page.reload(); await page.locator('#exam-time').waitFor();
    assert.deepEqual((await readState(page)).activeExam, before);
    await page.evaluate(() => { window.testClockShift = 3600001; document.dispatchEvent(new Event('visibilitychange')); });
    await page.getByRole('heading', { name: '모의고사 결과', exact: true }).waitFor();
    const after = await readState(page); assert.equal(after.activeExam, null); assert.equal(after.examHistory.length, 1); assert.equal(after.examHistory[0].unanswered, 19);
  });
  await check('results produce unique IDs for every question and option', async () => {
    const exam = newExam(data.questions, { exam: 'midterm', count: 20, seed: 'result-fixture', id: 'fixture-exam', now: Date.now() - 600000 });
    const state = { ...initialState(), examHistory: [finishExam(exam, data.questions)] };
    const { page } = await fresh({ state }); await goto(page, 'results/fixture-exam');
    const duplicate = await page.locator('[id]').evaluateAll(nodes => { const seen = new Set(); return nodes.map(n => n.id).filter(id => seen.has(id) || !seen.add(id)); });
    assert.deepEqual(duplicate, []);
  });
  await check('skip link preserves the current learning route', async () => {
    const { page } = await fresh(); await goto(page, `lesson/${data.objectives[0].id}`);
    const url = page.url(); await page.locator('.skip').focus(); await page.keyboard.press('Enter');
    assert.equal(page.url(), url); assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  });
  await check('backup validation rejects broken data without altering existing records; restore works', async () => {
    const state = { ...initialState(), read: [data.objectives[0].id] }, { page } = await fresh({ state });
    await goto(page, 'records'); const before = await readState(page);
    await page.locator('#backup-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
    await page.locator('#toast').waitFor();
    assert.deepEqual(await readState(page), before);
    const replacement = { ...initialState(), read: [data.objectives[1].id] };
    await page.locator('#backup-file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(makeBackup(replacement)) });
    await page.getByRole('button', { name: '검사한 백업으로 복원' }).click(); await page.locator('#confirm-yes').click();
    await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).read.includes(id), { key: STORAGE_KEY, id: data.objectives[1].id });
    assert.deepEqual((await readState(page)).read, replacement.read);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '현재 기록 내려받기' }).click()]);
    const path = resolve(output, 'synthetic-backup.json'); await download.saveAs(path);
    assert.deepEqual(parseBackup(await readFile(path, 'utf8'), data).read, replacement.read);
    assert.equal(await page.evaluate(() => localStorage.getItem('another-app-fixture')), 'preserve');
  });
  await check('malformed storage remains byte-for-byte intact during memory-only learning', async () => {
    const { page } = await fresh({ raw: '{broken-store' });
    assert(await page.locator('#storage-notice').isVisible());
    await page.getByRole('button', { name: '기말 9–14주', exact: true }).click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), '{broken-store');
  });
  await check('quota failure is visible and does not replace previous data', async () => {
    const { page } = await fresh({ state: initialState() });
    await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'internet-security-study-v1') throw new DOMException('Quota exceeded', 'QuotaExceededError'); return original.call(this, key, value); }; });
    const before = await readState(page); await page.getByRole('button', { name: '기말 9–14주', exact: true }).click();
    assert(await page.locator('#storage-notice').isVisible()); assert.deepEqual(await readState(page), before);
  });
  await check('two tabs detect stale storage rather than silently overwrite', async () => {
    const { context, page: first } = await fresh(); const second = await context.newPage();
    await second.goto(base); await second.getByRole('heading', { name: '오늘의 학습', exact: true }).waitFor();
    await first.getByRole('button', { name: '기말 9–14주', exact: true }).click();
    await second.locator('#storage-notice').waitFor();
    const before = await readState(second); await second.getByRole('button', { name: '중간 1–7주', exact: true }).click();
    assert.deepEqual(await readState(second), before);
  });
  await check('all main routes and long content fit 390px and 320px mobile viewports', async () => {
    const { page } = await fresh({ mobile: true });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['home', 'learn', `lesson/${data.objectives[0].id}`, 'practice', 'review', 'cases', 'case/firewall', 'case/logs', 'case/response', 'exam', 'scope', 'records']) {
        await goto(page, route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${route}, ${width}px`);
      }
    }
    await goto(page, 'home'); await page.screenshot({ path: resolve(output, 'home-mobile.png'), fullPage: true });
  });
  await check('incident activities reveal evidence and explain choices without network actions', async () => {
    const { page } = await fresh(); await goto(page, 'case/firewall');
    await page.getByRole('button', { name: '차단된다', exact: true }).click(); await page.locator('#case-feedback').waitFor();
    await page.locator('#rule-order').selectOption('allow-first'); assert.equal(await page.locator('#case-feedback').count(), 0);
    await goto(page, 'case/logs'); await page.getByRole('button', { name: '추가 증거 확인하기 →' }).click();
    await page.getByRole('button', { name: '정상 점검을 공격으로 분류한 오탐', exact: true }).click(); await page.locator('#case-feedback').waitFor();
    await goto(page, 'case/response'); for (let i = 0; i < 4; i++) { await page.locator('.options button').first().click(); await page.locator('#case-feedback').waitFor(); await page.getByRole('button', { name: '다음 단계 →' }).click(); }
    await page.getByRole('heading', { name: '대응 과정을 마쳤습니다.', exact: true }).waitFor();
  });
  await check('reset cancellation and confirmation preserve unrelated keys', async () => {
    const { page } = await fresh({ state: initialState() }); await goto(page, 'records');
    const before = await readState(page); await page.getByRole('button', { name: '이 앱의 기록 초기화' }).click(); await page.locator('#confirm-no').click();
    assert.deepEqual(await readState(page), before);
    await page.getByRole('button', { name: '이 앱의 기록 초기화' }).click(); await page.locator('#confirm-yes').click();
    await page.waitForFunction(key => localStorage.getItem(key) === null, STORAGE_KEY);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('another-app-fixture')), 'preserve');
  });
  await check('question content is rendered as text, never interpreted as HTML', async () => {
    const { page } = await fresh(); const original = JSON.parse(await readFile(new URL('../dist/content/week-01.json', import.meta.url), 'utf8'));
    original.questions[0].prompt = '보안 테스트 태그 <img src=x onerror=window.injected=1> 는 무엇인가요?';
    original.questions[0].context = '<script>window.injected=1</script>';
    await page.route('**/content/week-01.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(original) }));
    await page.reload(); await page.getByRole('heading', { name: '오늘의 학습', exact: true }).waitFor();
    await goto(page, 'practice'); await page.locator('#question-search').fill('보안 테스트 태그'); await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.getByRole('button', { name: '이 문제 풀기', exact: true }).click();
    assert.equal(await page.evaluate(() => window.injected), undefined); assert.equal(await page.locator('.question img, .question script').count(), 0);
    assert.match(await page.locator('.question-context').innerText(), /<script>/);
  });
  await check('content load failure offers retry without touching existing storage', async () => {
    const context = await browser.newContext(); contexts.push(context); const page = await context.newPage();
    await page.route('**/content/week-14.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto(base); await page.getByRole('heading', { name: '학습 자료를 불러오지 못했습니다.', exact: true }).waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
  });
  await check('a later backup selection invalidates an older slow file read', async () => {
    const { page } = await fresh(); await goto(page, 'records');
    await page.evaluate(() => { const original = File.prototype.text; File.prototype.text = async function() { if (this.name === 'slow.json') await new Promise(resolve => setTimeout(resolve, 450)); return original.call(this); }; });
    await page.locator('#backup-file').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(makeBackup(initialState())) });
    await page.locator('#backup-file').setInputFiles({ name: 'later-invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
    await page.waitForTimeout(650);
    assert.equal(await page.getByRole('button', { name: '검사한 백업으로 복원' }).count(), 0);
  });
  await check('corrupt originals stay intact until a valid explicit restore is confirmed', async () => {
    const raw = '{corrupt recoverable original', { page } = await fresh({ raw }); await goto(page, 'records');
    const replacement = { ...initialState(), read: [data.objectives[0].id] };
    await page.locator('#backup-file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(makeBackup(replacement)) });
    await page.getByRole('button', { name: '검사한 백업으로 복원' }).click(); await page.locator('#confirm-no').click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), raw);
    await page.getByRole('button', { name: '검사한 백업으로 복원' }).click(); await page.locator('#confirm-yes').click();
    await page.waitForFunction(({ key, id }) => { try { return JSON.parse(localStorage.getItem(key)).read.includes(id); } catch { return false; } }, { key: STORAGE_KEY, id: data.objectives[0].id });
    assert.equal(await page.locator('#storage-notice').isVisible(), false);
  });
  await check('guided routes link prerequisites and diagnostic respects the selected exam scope', async () => {
    const { page } = await fresh(); await goto(page, 'learn');
    assert.equal(await page.locator('.concept-chain').count(), 3);
    await page.getByRole('button', { name: '시작점 찾기', exact: true }).click();
    assert.match(await page.locator('.practice-top').innerText(), /1 \/ 14/);
    await page.getByRole('button', { name: '기말 9–14주', exact: true }).click(); await goto(page, 'learn');
    await page.getByRole('button', { name: '시작점 찾기', exact: true }).click();
    assert.match(await page.locator('.practice-top').innerText(), /1 \/ 12/);
    await goto(page, 'lesson/w12-sql-boundary');
    assert.match(await page.locator('.lesson-side').innerText(), /먼저 보면 좋아요/);
  });
  await check('past mock-exam results can be reopened from records', async () => {
    const exam = newExam(data.questions, { exam: 'midterm', count: 20, seed: 'history', id: 'history-fixture', now: Date.now() - 100000 });
    const { page } = await fresh({ state: { ...initialState(), examHistory: [finishExam(exam, data.questions)] } });
    await goto(page, 'records'); await page.getByRole('link', { name: /중간.*20문항.*0점.*결과 보기/ }).click();
    await page.getByRole('heading', { name: '모의고사 결과', exact: true }).waitFor();
  });
  await check('out-of-range date input cannot poison the in-memory learning plan', async () => {
    const { page } = await fresh({ state: initialState() }); await goto(page, 'records');
    await page.locator('#exam-date').evaluate(input => { input.value = '10000-01-01'; input.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal((await readState(page)).settings.examDate, '');
    await page.getByRole('link', { name: '오늘의 학습', exact: true }).click();
    await page.getByRole('heading', { name: '오늘의 학습', exact: true }).waitFor();
  });
  await check('clean desktop screenshot and no unhandled page errors', async () => {
    const { page } = await fresh(); await page.screenshot({ path: resolve(output, 'home-desktop.png'), fullPage: true });
    await page.screenshot({ path: resolve(output, 'catalog-preview.jpg'), type: 'jpeg', quality: 88 });
    assert.deepEqual(errors, []);
  });
} finally {
  for (const context of contexts) await context.close();
  if (browser) await browser.close();
  if (server) server.kill();
  await writeFile(resolve(output, `browser-results-${browserName}.json`), JSON.stringify({ engine: browserName, target: base, checkedAt: new Date().toISOString(), results }, null, 2), 'utf8');
}
if (results.some(r => r.status !== 'PASS')) process.exitCode = 1;
console.log(`${results.filter(r => r.status === 'PASS').length}/${results.length} browser scenarios passed.`);
