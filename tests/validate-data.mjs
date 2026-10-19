// 資料驗證：檢查題庫／名詞卡／筆記／速查表的結構與品質。
// 用法：node tests/validate-data.mjs   （有錯誤時以非 0 結束）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 依 index.html 的載入順序，執行 js/data 下的檔案
const files = [...html.matchAll(/<script src="(js\/data\/[^"]+)"/g)].map((m) => m[1]);
const sandbox = { window: {}, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
const IPAS = sandbox.IPAS;

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

/* ---------- 考綱 ---------- */
const itemIds = Object.keys(IPAS.itemIndex);
const countBySubject = { L21: 0, L22: 0, L23: 0 };

/* ---------- 題庫 ---------- */
const seenId = new Set();
const seenStem = new Set();
const perItem = {};
const answerPos = [0, 0, 0, 0];
let longest = 0, nCode = 0;
const codeBySubject = { L21: 0, L22: 0, L23: 0 };

for (const q of IPAS.questions) {
  const tag = q.id;
  if (seenId.has(q.id)) err(`${tag} id 重複`);
  seenId.add(q.id);
  if (!IPAS.itemIndex[q.item]) { err(`${tag} 項目 ${q.item} 不在考綱中`); continue; }
  if (q.subject !== IPAS.itemIndex[q.item].subject.id) err(`${tag} 科目與項目不符`);
  if (![1, 2, 3].includes(q.level)) err(`${tag} level 無效：${q.level}`);
  if (!q.stem || !q.stem.trim()) err(`${tag} 題幹為空`);
  if (!Array.isArray(q.options) || q.options.length !== 4) err(`${tag} 選項必須為 4 個`);
  else {
    if (new Set(q.options.map((o) => o.trim())).size !== 4) err(`${tag} 選項有重複`);
    if (q.options.some((o) => !o.trim())) err(`${tag} 有空白選項`);
    if (q.options.some((o) => /以上(皆|都)(是|非|對|錯)|皆是|皆非|全部皆/.test(o))) warn(`${tag} 含「以上皆是／皆非」類選項（選項會被打亂，應避免）`);
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(`${tag} answer 超出範圍：${q.answer}`);
  else {
    answerPos[q.answer]++;
    const lens = q.options.map((o) => o.length);
    if (lens[q.answer] === Math.max(...lens) && lens.filter((l) => l === lens[q.answer]).length === 1) longest++;
  }
  if (!q.explain || q.explain.trim().length < 10) err(`${tag} 詳解過短或為空`);
  if (/選項\s*[A-Da-d]\b|[（(][A-D][)）]\s*(是|為|描述|敘述)/.test(q.explain || '')) err(`${tag} 詳解以字母指涉選項（選項會被隨機打亂）`);
  if (/選項\s*[A-D]/.test(q.stem)) err(`${tag} 題幹以字母指涉選項`);
  if (seenStem.has(q.stem + (q.code || ''))) err(`${tag} 題幹重複`);
  seenStem.add(q.stem + (q.code || ''));
  if ((q.stem + q.explain + q.options.join('')).includes('§') ) err(`${tag} 殘留 § 符號`);
  if (q.code) { nCode++; codeBySubject[q.subject]++; }
  perItem[q.item] = (perItem[q.item] || 0) + 1;
  countBySubject[q.subject]++;
}
for (const id of itemIds) {
  const n = perItem[id] || 0;
  if (n === 0) err(`項目 ${id} 沒有題目`);
  else if (n < 6) warn(`項目 ${id} 只有 ${n} 題（建議 ≥ 6）`);
}
const total = IPAS.questions.length;
answerPos.forEach((n, i) => { const p = n / total; if (p < 0.15 || p > 0.35) warn(`正確答案位置 ${'ABCD'[i]} 占 ${(p * 100).toFixed(0)}%（原始順序偏斜；作答時會隨機打亂，僅供參考）`); });
const longestPct = longest / total;

/* 猜題線索檢查：避免答題者不讀題就能靠表面特徵猜中答案 */
let farLonger = 0;
const ratios = [];
for (const q of IPAS.questions) {
  if (!Array.isArray(q.options) || q.options.length !== 4) continue;
  const L = q.options.map((o) => o.length);
  const c = L[q.answer];
  const others = L.filter((_, i) => i !== q.answer);
  ratios.push(c / (others.reduce((a, b) => a + b, 0) / 3));
  if (c > 14 && c / Math.max(...others) > 1.3) { farLonger++; if (farLonger <= 5) warn(`${q.id} 正確選項明顯比所有誘答長（>1.3 倍），建議把誘答寫得同樣詳細`); }
}
ratios.sort((a, b) => a - b);
const medianRatio = ratios[Math.floor(ratios.length / 2)];
if (medianRatio > 1.3) warn(`正確選項長度中位數是誘答平均的 ${medianRatio.toFixed(2)} 倍（> 1.3）：請把誘答寫得和正確選項一樣詳細，否則挑最長的選項就能猜中`);
if (farLonger / total > 0.1) warn(`有 ${farLonger} 題（${(farLonger / total * 100).toFixed(0)}%）的正確選項比最長誘答長 1.3 倍以上`);

const ABS = /一定|完全|永遠|只能|絕對|必然|必定|不需要任何|沒有任何|無須任何|任何|所有|皆|從不|一律|不會|不能|無法|不必/;
let dAbs = 0, dTot = 0, cAbs = 0;
for (const q of IPAS.questions) {
  q.options.forEach((o, i) => { if (i === q.answer) { if (ABS.test(o)) cAbs++; } else { dTot++; if (ABS.test(o)) dAbs++; } });
}
const dAbsRate = dAbs / dTot, cAbsRate = cAbs / total;
if (dAbsRate > 0.12 && dAbsRate > cAbsRate * 2) warn(`誘答含絕對語氣詞（一定／完全／只能…）的比例 ${(dAbsRate * 100).toFixed(0)}% 遠高於正確選項 ${(cAbsRate * 100).toFixed(0)}%：答題者可挑「不含絕對詞」的選項猜中`);

/* ---------- 名詞卡 ---------- */
const seenCard = new Set();
for (const c of IPAS.cards) {
  if (seenCard.has(c.id)) err(`卡片 ${c.id} id 重複`);
  seenCard.add(c.id);
  if (!IPAS.itemIndex[c.item]) err(`卡片 ${c.id} 項目不在考綱中`);
  if (!c.front.trim() || !c.back.trim()) err(`卡片 ${c.id} 正反面不可為空`);
}
const seenFront = new Set();
for (const c of IPAS.cards) { if (seenFront.has(c.front)) warn(`卡片正面重複：${c.front}`); seenFront.add(c.front); }

/* ---------- 速查表 ---------- */
const seenCheat = new Set();
for (const s of IPAS.cheats) {
  if (seenCheat.has(s.id)) err(`速查表 ${s.id} id 重複`);
  seenCheat.add(s.id);
  if (!s.subjects.every((x) => IPAS.subjectById[x])) err(`速查表 ${s.id} 科目無效`);
}

/* ---------- 筆記 ---------- */
function checkMd(label, md) {
  const lines = md.split('\n');
  let cols = null;
  lines.forEach((l, i) => {
    if (/^\|/.test(l)) {
      const n = l.split('|').length - 2;
      if (cols === null) cols = n;
      else if (n !== cols && !/^\|\s*:?-/.test(l)) err(`${label} 第 ${i + 1} 行表格欄位數不一致（預期 ${cols}，實際 ${n}）`);
    } else cols = null;
  });
  if ((md.match(/`/g) || []).length % 2) err(`${label} 反引號數量為奇數`);
  if ((md.match(/^```/gm) || []).length % 2) err(`${label} 程式區塊未閉合`);
  if (md.includes('§')) err(`${label} 殘留 § 符號`);
}
for (const id of itemIds) {
  if (!IPAS.notes[id]) err(`項目 ${id} 沒有筆記`);
  else checkMd('筆記 ' + id, IPAS.notes[id]);
}
for (const id of Object.keys(IPAS.notes)) if (!IPAS.itemIndex[id]) err(`筆記 ${id} 不在考綱中`);
for (const s of IPAS.cheats) checkMd('速查表 ' + s.id, s.md);

/* ---------- 報告 ---------- */
console.log(`考綱項目 ${itemIds.length}｜筆記 ${Object.keys(IPAS.notes).length}｜題目 ${total}（含程式碼 ${nCode}）｜名詞卡 ${IPAS.cards.length}｜速查表 ${IPAS.cheats.length}`);
console.log('各科題數：', Object.entries(countBySubject).map(([k, v]) => `${k}=${v}（程式題 ${codeBySubject[k]}）`).join('，'));
console.log('正確答案原始位置分佈（A/B/C/D）：', answerPos.map((n) => (n / total * 100).toFixed(0) + '%').join(' / '), `｜正確選項唯一最長：${(longestPct * 100).toFixed(0)}%`);
const lv = [1, 2, 3].map((l) => IPAS.questions.filter((q) => q.level === l).length);
console.log('難度分佈（基礎/進階/應用）：', lv.join(' / '));
const items = itemIds.map((id) => `${id}:${perItem[id] || 0}`).join('  ');
console.log('各項目題數：', items);
warns.forEach((w) => console.warn('⚠ ' + w));
errors.forEach((e) => console.error('✘ ' + e));
console.log(errors.length ? `\n失敗：${errors.length} 個錯誤、${warns.length} 個警告` : `\n通過：0 個錯誤、${warns.length} 個警告`);
process.exit(errors.length ? 1 : 0);
