/* 學習計畫（依考試日期自動排程）與設定 */
(function () {
  const { h, today, addDays, daysBetween, weekday, pct } = window.Lib;
  const { pageHead, bar, toast } = window.Comp;
  const IPAS = window.IPAS;
  const Store = window.Store;

  /* ---------- 計畫引擎 ---------- */
  /* 把 arr 精確切成 parts 份（餘數平均分給前幾份），呼叫端須保證 1 <= parts <= arr.length */
  const chunk = (arr, parts) => {
    const out = [];
    let at = 0;
    for (let i = 0; i < parts; i++) {
      const size = Math.floor(arr.length / parts) + (i < arr.length % parts ? 1 : 0);
      out.push(arr.slice(at, at + size));
      at += size;
    }
    return out;
  };

  function build(start, exam, track) {
    const N = Math.max(1, daysBetween(start, exam)); // 考試日之前的天數
    const items = [...IPAS.itemsOf('L21'), ...IPAS.itemsOf(track)];
    const mine = ['L21', track];
    let learn, practice;
    if (N >= 21) { learn = Math.round(N * 0.45); practice = Math.round(N * 0.3); }
    else if (N >= 7) { learn = Math.round(N * 0.5); practice = Math.round(N * 0.25); }
    else { learn = Math.max(1, Math.round(N * 0.34)); practice = Math.round(N * 0.33); }
    // 學習／練習天數不超過單元數（每天至少 1 個單元），多出來的天數全部給衝刺（更多模擬考）
    learn = Math.min(learn, items.length);
    practice = Math.min(practice, items.length);
    let sprint = N - learn - practice;
    if (sprint < 1) { sprint = 1; if (practice > 0) practice--; else learn--; }

    const days = [];
    const push = (phase, tasks) => days.push({ date: addDays(start, days.length), phase, tasks });
    const note = (it) => ({ label: `閱讀筆記：${it.id} ${it.name}`, href: '#/note/' + it.id });
    const drill = (it) => ({ label: `練習：${it.id} ${it.name}（目標正確率 ≥ 80%）`, href: '#/practice?item=' + it.id + '&auto=1' });
    const cards = { label: '名詞卡：完成今日複習', href: '#/cards' };
    const wrong = { label: '清空錯題本（連續答對 2 次才會移出）', href: '#/wrong' };

    if (learn > 0) chunk(items, learn).forEach((c) => push('學習', [...c.map(note), cards]));
    if (practice > 0) chunk(items, practice).forEach((c) => push('練習', [...c.map(drill), wrong, cards]));
    for (let i = 0; i < sprint; i++) {
      const last = i === sprint - 1;
      if (last && sprint >= 2) push('衝刺', [{ label: '輕鬆複習：速查表（公式、比較表）', href: '#/cheats' }, wrong, cards, { label: '早點休息，不要熬夜新學', href: null }]);
      else {
        const sid = mine[i % mine.length];
        push('衝刺', [{ label: `模擬考：${IPAS.subjectById[sid].label}・${IPAS.subjectById[sid].short}（檢討每一題）`, href: '#/exam' }, wrong, cards]);
      }
    }
    days.push({ date: exam, phase: '考試日', tasks: [{ label: '出門前快速瀏覽速查表；確認准考證／證件與考場', href: '#/cheats' }, { label: '放輕鬆：題目不會就先標記，最後再回頭檢查', href: null }] });
    return days;
  }

  /* 確保計畫錨點存在；考試日或選考科目變動時重新排程 */
  function ensure() {
    const s = Store.get();
    const key = s.examDate + '|' + s.track;
    if (!s.planStart || s.planKey !== key) Store.set({ planStart: today(), planKey: key, plan: {} });
    return build(Store.get().planStart, s.examDate, s.track);
  }
  window.Plan = { ensure, build };

  /* ---------- /plan ---------- */
  App.route('/plan', () => {
    const s = Store.get();
    const left = daysBetween(today(), s.examDate);
    if (left < 0) {
      return h('div', {}, pageHead('學習計畫'),
        h('div', { class: 'card empty' }, h('p', {}, `設定的考試日期（${s.examDate}）已經過了。`), h('a', { class: 'btn primary', href: '#/settings' }, '設定下一次考試日期')));
    }
    const days = ensure();
    const t = today();
    let total = 0, done = 0;
    days.forEach((d, di) => d.tasks.forEach((_, ti) => { total++; if (Store.planDone(di + '-' + ti)) done++; }));
    const overdue = days.reduce((n, d, di) => n + (d.date < t ? d.tasks.filter((_, ti) => !Store.planDone(di + '-' + ti)).length : 0), 0);

    const redo = h('button', { class: 'btn', type: 'button', onclick: () => { Store.set({ planStart: today(), plan: {} }); App.go('/plan'); } }, '從今天重新排程');
    const blocks = [];
    let lastPhase = null;
    days.forEach((d, di) => {
      if (d.phase !== lastPhase) { blocks.push(h('div', { class: 'phase-h' }, h('h2', { style: 'margin:0' }, d.phase === '考試日' ? '考試日' : d.phase + '階段'), h('span', { class: 'muted small' }, phaseHint(d.phase)))); lastPhase = d.phase; }
      const isToday = d.date === t;
      blocks.push(h('div', { class: 'day' + (isToday ? ' today' : ''), id: isToday ? 'today' : null },
        h('div', { class: 'dlabel' }, d.date.slice(5).replace('-', '/'), h('small', {}, `週${weekday(d.date)}${isToday ? '・今天' : ''}`)),
        h('ul', { class: 'todo' }, d.tasks.map((task, ti) => {
          const k = di + '-' + ti; const on = Store.planDone(k);
          const cb = h('input', { type: 'checkbox', checked: on, 'aria-label': task.label, onchange: () => { Store.setPlanDone(k, cb.checked); li.classList.toggle('done', cb.checked); } });
          const li = h('li', { class: on ? 'done' : '' }, cb, h('span', { class: 't' }, task.href ? h('a', { href: task.href }, task.label) : task.label));
          return li;
        }))));
    });

    return h('div', {},
      pageHead('學習計畫', `考試日 ${s.examDate}（還有 ${left} 天）・選考：${IPAS.subjectById[s.track].short}`, redo),
      h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('strong', {}, `完成進度 ${done} / ${total}`), overdue ? h('span', { class: 'chip warn' }, `${overdue} 項已逾期`) : h('span', { class: 'chip good' }, '進度正常')),
        bar(pct(done, total), 'good'),
        left < 7 ? h('p', { class: 'small muted' }, '距離考試不到一週，計畫已壓縮：以速查表、錯題本與模擬考為主，不建議再追新內容。') : null,
        overdue ? h('p', { class: 'small muted' }, '有逾期項目時，可按右上角「從今天重新排程」把剩餘天數重新分配。') : null),
      h('div', { class: 'card' }, blocks));
  });
  const phaseHint = (p) => ({ 學習: '讀完每個單元的筆記，建立整體架構', 練習: '按單元刷題，把弱項補起來', 衝刺: '全真模擬＋檢討，熟悉節奏與時間分配', 考試日: '' }[p] || '');

  /* ---------- /settings ---------- */
  App.route('/settings', () => {
    const s = Store.get();
    const row = (label, ctrl, hint) => h('div', { class: 'field', style: 'margin:12px 0' }, h('label', {}, label), ctrl, hint ? h('span', { class: 'small muted' }, hint) : null);

    const track = h('select', { 'aria-label': '選考科目' }, [['L22', '科目二：大數據處理分析與應用'], ['L23', '科目三：機器學習技術與應用']].map(([v, t]) => h('option', { value: v, selected: s.track === v }, t)));
    track.addEventListener('change', () => { Store.set({ track: track.value }); toast('已更新選考科目，學習計畫會重新排程'); App.refreshNav(); });
    const date = h('input', { type: 'date', value: s.examDate, 'aria-label': '考試日期' });
    date.addEventListener('change', () => { if (date.value) { Store.set({ examDate: date.value }); toast('已更新考試日期'); } });
    const newCards = h('input', { type: 'number', min: '0', max: '200', value: String(s.newCardsPerDay), 'aria-label': '每日新卡上限' });
    newCards.addEventListener('change', () => { Store.set({ newCardsPerDay: Math.max(0, Math.min(200, Number(newCards.value) || 0)) }); App.refreshNav(); });
    const shuffleSel = h('select', { 'aria-label': '選項順序' }, [[true, '每次隨機打亂（建議，避免背位置）'], [false, '維持原始順序']].map(([v, t]) => h('option', { value: String(v), selected: s.shuffle === v }, t)));
    shuffleSel.addEventListener('change', () => Store.set({ shuffle: shuffleSel.value === 'true' }));
    const theme = h('select', { 'aria-label': '主題' }, [['auto', '跟隨系統'], ['light', '亮色'], ['dark', '暗色']].map(([v, t]) => h('option', { value: v, selected: s.theme === v }, t)));
    theme.addEventListener('change', () => { Store.set({ theme: theme.value }); App.applyTheme(); });

    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    file.addEventListener('change', async () => {
      try { Store.importJSON(await file.files[0].text()); toast('匯入成功'); App.go('/'); }
      catch (e) { toast('匯入失敗：' + e.message); }
    });

    return h('div', {},
      pageHead('設定'),
      h('div', { class: 'card' }, h('h3', {}, '應考設定'),
        row('選考科目（科目一必考）', track, '科目二與科目三擇一報考；兩科都通過可取得兩張證書，依官方簡章。'),
        row('考試日期', date, '用來產生倒數與學習計畫。梯次與日期請以 iPAS 官網公告為準。'),
        row('每日新名詞卡上限', newCards)),
      h('div', { class: 'card' }, h('h3', {}, '作答偏好'), row('選項順序', shuffleSel), row('外觀', theme)),
      h('div', { class: 'card' }, h('h3', {}, '資料備份'),
        h('p', { class: 'muted small' }, '進度只存在這個瀏覽器（localStorage）。換裝置、清除網站資料前，請先匯出備份。'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `ipas-ai-progress-${today()}.json` });
            document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          } }, '匯出進度'),
          h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, '匯入進度'), file,
          h('button', { class: 'btn danger', type: 'button', onclick: () => { if (confirm('確定要清除所有學習進度嗎？此動作無法復原。')) { Store.reset(); App.applyTheme(); toast('已重置'); App.go('/'); } } }, '重置所有進度'))),
      h('div', { class: 'card' }, h('h3', {}, '關於本站'),
        h('p', {}, `考綱依據 iPAS《AI 應用規劃師能力鑑定 評鑑內容範圍參考》${IPAS.outlineVersion} 版。筆記與題目為自學輔助用的原創內容，並非官方教材或歷屆考古題，也不保證與實際考題一致；官方亦說明實際考題不限於所列範圍。`),
        h('p', {}, '請務必搭配官方資源：', h('a', { href: 'https://www.ipas.org.tw/certification/AIAP/exam-info', target: '_blank', rel: 'noopener' }, 'iPAS 考試資訊'), '、',
          h('a', { href: 'https://ipd.nat.gov.tw/ipas/certification/AIAP/learning-resources', target: '_blank', rel: 'noopener' }, '學習資源（學習指引與公告試題）'), '。'),
        h('p', { class: 'small muted' }, `題庫 ${IPAS.questions.length} 題・名詞卡 ${IPAS.cards.length} 張・速查表 ${IPAS.cheats.length} 份`)));
  });
})();
