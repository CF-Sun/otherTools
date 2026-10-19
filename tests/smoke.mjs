// 瀏覽器煙霧測試：走過每個頁面與主要互動，確認沒有 console 錯誤。
// 用法：node tests/smoke.mjs [截圖輸出資料夾]
// 需要 Playwright（npm i -D playwright）與已安裝的 Chromium。
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
for (const base of [undefined, '/opt/node22/lib/node_modules/', '/opt/node-tools/node_modules/']) {
  try { pw = base ? createRequire(base)('playwright') : require('playwright'); break; } catch { /* try next */ }
}
if (!pw) { console.error('找不到 playwright'); process.exit(2); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const shotDir = process.argv[2];
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const errors = [];
let failed = 0;
const check = (cond, msg) => { if (!cond) { failed++; console.error('✘ ' + msg); } else console.log('✔ ' + msg); };

const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function newPage(viewport, scheme = 'light') {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, locale: 'zh-TW' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return page;
}
const go = async (page, hash) => { await page.goto(url + '#' + hash); await page.waitForSelector('#view > *'); };
const shot = async (page, name) => { if (shotDir) await page.screenshot({ path: path.join(shotDir, name + '.png'), fullPage: true }); };

/* ---------- 桌機 ---------- */
const page = await newPage({ width: 1280, height: 900 });
await page.goto(url);
await page.waitForSelector('#view > *');
check((await page.title()).includes('AI 應用規劃師'), '首頁載入');
await shot(page, 'home');

for (const r of ['/learn', '/learn?s=L22', '/learn?s=L23', '/note/L21101', '/cheats', '/plan', '/settings', '/wrong', '/exam', '/cards', '/search?q=NLP']) {
  await go(page, r);
  const text = await page.locator('#view').innerText();
  check(text.length > 20 && !text.includes('頁面發生錯誤') && !text.includes('找不到頁面'), `頁面 ${r}`);
  await shot(page, 'route' + r.replace(/[^\w]/g, '_'));
}

/* 練習：作答 → 詳解 → 下一題 → 結算 */
await go(page, '/practice');
await page.click('button:has-text("開始練習")');
await page.waitForSelector('.qcard .opt');
await page.locator('.qcard .opt').first().click();
check(await page.locator('.explain').count() === 1, '練習：作答後顯示詳解');
await shot(page, 'practice_reveal');
await page.keyboard.press('Enter');
await page.waitForTimeout(100);

/* 模擬考：作答 → 交卷 → 成績 */
await go(page, '/exam');
await page.click('button:has-text("開始考試")');
await page.waitForSelector('.exam-layout');
await page.locator('.qcard .opt').first().click();
await page.keyboard.press('2');
await shot(page, 'exam_run');
await page.reload(); await page.waitForSelector('.exam-layout');
check(await page.locator('.qnav button.answered').count() >= 1, '模擬考：重新整理後保留作答');
await page.click('button:has-text("交卷")');
await page.click('button:has-text("確定交卷")');
await page.waitForSelector('.score-big');
check(true, '模擬考：交卷後顯示成績');
await shot(page, 'exam_result');

/* 名詞卡：翻面 → 評分 */
await go(page, '/cards');
await page.keyboard.press('Space');
await page.waitForSelector('.rate');
await page.keyboard.press('3');
check(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ipas-ai-mid-v1')).cards).length) >= 1, '名詞卡：評分後寫入排程');
await shot(page, 'cards');

/* 筆記：標記已讀 */
await go(page, '/note/L21101');
await page.click('button:has-text("標記為已讀")');
await page.waitForSelector('button:has-text("已讀")');
check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('ipas-ai-mid-v1')).notesRead.L21101), '筆記：已讀狀態保存');

/* 暗色 */
await page.click('#theme-btn');
await go(page, '/');
await shot(page, 'home_dark');
await page.context().close();

/* ---------- 手機 ---------- */
const mobile = await newPage({ width: 390, height: 844 }, 'dark');
for (const r of ['/', '/learn', '/note/L21101', '/practice', '/exam', '/cards', '/plan']) {
  await go(mobile, r);
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, `手機版無橫向捲動 ${r}`);
  await shot(mobile, 'mobile' + r.replace(/[^\w]/g, '_'));
}
await browser.close();

check(errors.length === 0, 'console 無錯誤' + (errors.length ? '：\n  ' + errors.join('\n  ') : ''));
process.exit(failed ? 1 : 0);
