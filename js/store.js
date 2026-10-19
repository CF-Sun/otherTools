/* 進度儲存：localStorage（失敗時退回記憶體，頁面關閉即消失並提示使用者） */
(function () {
  const KEY = 'ipas-ai-mid-v1';
  const { today, addDays } = window.Lib;
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // Leitner 各盒間隔（天）

  const defaults = () => ({
    v: 1,
    track: 'L22',                 // 選考科目：L22 或 L23（L21 必考）
    examDate: window.IPAS.defaultExamDate,
    theme: 'auto',
    shuffle: true,
    newCardsPerDay: 20,
    notesRead: {},                // itemId -> timestamp
    answers: {},                  // qid -> {n, c, l(最近一次是否答對), s(連續答對), t}
    cards: {},                    // cardId -> {box, due}
    exams: [],                    // 模擬考紀錄
    daily: {},                    // 日期 -> {q, c, cards, newCards}
    plan: {},                     // 計畫任務勾選（key = 第幾天-第幾項）
    planStart: null,              // 計畫起始日（固定錨點，避免每天重新排程）
    planKey: null,                // 產生計畫時的 考試日期|選考科目，變動時重新排程
    activeExam: null,
  });

  let state = defaults();
  let persistent = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { persistent = false; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); persistent = true; }
    catch (e) { persistent = false; }
  }
  load();

  const dayRec = () => (state.daily[today()] = state.daily[today()] || { q: 0, c: 0, cards: 0, newCards: 0 });

  const S = (window.Store = {
    get: () => state,
    save,
    get persistent() { return persistent; },
    set(patch) { Object.assign(state, patch); save(); },

    /* 目前應考的科目 id：L21 + 選考科 */
    subjects: () => ['L21', state.track],

    /* ---- 筆記 ---- */
    isRead: (id) => !!state.notesRead[id],
    setRead(id, on) { if (on) state.notesRead[id] = Date.now(); else delete state.notesRead[id]; save(); },

    /* ---- 題目作答 ---- */
    stat: (qid) => state.answers[qid],
    recordAnswer(qid, correct) {
      const a = state.answers[qid] || { n: 0, c: 0, l: false, s: 0, w: false, t: 0 };
      a.n++; if (correct) a.c++;
      a.l = correct; a.s = correct ? a.s + 1 : 0; if (!correct) a.w = true; a.t = Date.now();
      state.answers[qid] = a;
      const d = dayRec(); d.q++; if (correct) d.c++;
      save();
    },
    /* 錯題本：曾經答錯，且尚未連續答對 2 次 */
    inWrongBook: (qid) => { const a = state.answers[qid]; return !!a && a.w && a.s < 2; },

    /* 項目統計：{total, answered, mastered, accuracy} */
    itemStats(itemId) {
      const qs = window.IPAS.questions.filter((q) => q.item === itemId);
      let answered = 0, mastered = 0, n = 0, c = 0;
      qs.forEach((q) => {
        const a = state.answers[q.id];
        if (a) { answered++; n += a.n; c += a.c; if (a.l) mastered++; }
      });
      return { total: qs.length, answered, mastered, attempts: n, accuracy: n ? c / n : null };
    },
    subjectStats(sid) {
      const items = window.IPAS.itemsOf(sid);
      let total = 0, answered = 0, mastered = 0, read = 0;
      items.forEach((it) => {
        const st = S.itemStats(it.id);
        total += st.total; answered += st.answered; mastered += st.mastered;
        if (S.isRead(it.id)) read++;
      });
      return { items: items.length, read, total, answered, mastered };
    },

    /* ---- 名詞卡（Leitner） ---- */
    cardState: (id) => state.cards[id],
    review(id, rating) {
      const cur = state.cards[id];
      const isNew = !cur;
      let box = cur ? cur.box : 0;
      if (rating === 'again') box = 1;
      else if (rating === 'hard') box = Math.max(1, box);
      else box = Math.min(5, box + 1);
      const gap = rating === 'hard' ? Math.max(1, Math.round(INTERVALS[box] / 2)) : INTERVALS[box];
      state.cards[id] = { box, due: addDays(today(), Math.max(1, gap)) };
      const d = dayRec(); d.cards++; if (isNew) d.newCards++;
      save();
    },
    /* 回傳今日要複習的卡：到期卡 + 當日剩餘額度內的新卡 */
    cardQueue(subjects) {
      const t = today();
      const pool = window.IPAS.cards.filter((c) => subjects.includes(c.subject));
      const due = pool.filter((c) => state.cards[c.id] && state.cards[c.id].due <= t);
      const left = Math.max(0, state.newCardsPerDay - (state.daily[t] ? state.daily[t].newCards : 0));
      const fresh = pool.filter((c) => !state.cards[c.id]).slice(0, left);
      return { due, fresh, total: pool.length, learned: pool.filter((c) => state.cards[c.id]).length };
    },

    /* ---- 活動與連續天數 ---- */
    todayRec: () => state.daily[today()] || { q: 0, c: 0, cards: 0, newCards: 0 },
    streak() {
      let n = 0, d = today();
      const active = (k) => { const r = state.daily[k]; return r && (r.q > 0 || r.cards > 0); };
      if (!active(d)) d = addDays(d, -1); // 今天還沒練習不中斷連續天數
      while (active(d)) { n++; d = addDays(d, -1); }
      return n;
    },
    totals() {
      let q = 0, c = 0;
      Object.values(state.answers).forEach((a) => { q += a.n; c += a.c; });
      return { q, c };
    },

    /* ---- 模擬考 ---- */
    addExam(rec) { state.exams.unshift(rec); state.exams = state.exams.slice(0, 60); save(); },

    /* ---- 計畫 ---- */
    planDone: (k) => !!state.plan[k],
    setPlanDone(k, on) { if (on) state.plan[k] = 1; else delete state.plan[k]; save(); },

    /* ---- 備份 ---- */
    exportJSON: () => JSON.stringify(state, null, 1),
    importJSON(text) {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object' || obj.v !== 1) throw new Error('格式不符');
      state = Object.assign(defaults(), obj);
      save();
    },
    reset() { state = defaults(); save(); },
  });
})();
