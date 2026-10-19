/* 首頁儀表板 */
(function () {
  const { h, today, daysBetween, pct } = window.Lib;
  const { bar, ring } = window.Comp;
  const IPAS = window.IPAS;
  const Store = window.Store;

  const tile = (num, lbl, href) => h(href ? 'a' : 'div', { class: 'tile', href, style: href ? 'color:inherit;text-decoration:none;display:block' : null },
    h('div', { class: 'num' }, String(num)), h('div', { class: 'lbl' }, lbl));

  App.route('/', () => {
    const s = Store.get();
    const t = today();
    const left = daysBetween(t, s.examDate);
    const mine = Store.subjects();
    const tot = Store.totals();
    const tr = Store.todayRec();
    const cq = Store.cardQueue(mine);
    const wrongN = Object.keys(s.answers).filter(Store.inWrongBook).length;

    /* 倒數 + 今日任務 */
    let todoCard;
    if (left < 0) {
      todoCard = h('div', { class: 'card' }, h('h3', {}, '今日任務'), h('p', { class: 'muted' }, '設定的考試日期已過。'), h('a', { class: 'btn primary', href: '#/settings' }, '設定下一次考試日期'));
    } else {
      const days = window.Plan.ensure();
      const di = days.findIndex((d) => d.date === t);
      const day = days[di];
      todoCard = h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('h3', { style: 'margin:0' }, '今日任務'), h('a', { class: 'small', href: '#/plan' }, '完整計畫 →')),
        day ? h('ul', { class: 'todo', style: 'margin-top:8px' }, day.tasks.map((task, ti) => {
          const k = di + '-' + ti; const on = Store.planDone(k);
          const cb = h('input', { type: 'checkbox', checked: on, 'aria-label': task.label, onchange: () => { Store.setPlanDone(k, cb.checked); li.classList.toggle('done', cb.checked); } });
          const li = h('li', { class: on ? 'done' : '' }, cb, h('span', { class: 't' }, task.href ? h('a', { href: task.href }, task.label) : task.label));
          return li;
        })) : h('p', { class: 'muted' }, '今天不在計畫範圍內，可以到「學習計畫」重新排程。'));
    }

    const countdown = h('div', { class: 'card' },
      h('div', { class: 'muted small' }, `考試日 ${s.examDate}`),
      left >= 0
        ? h('div', { class: 'countdown' }, h('span', { class: 'big' }, String(left)), h('span', {}, left === 0 ? '天（就是今天！）' : '天後應考'))
        : h('div', { class: 'countdown' }, h('span', { class: 'big', style: 'font-size:1.8rem' }, '已過期')),
      h('p', { class: 'muted small', style: 'margin-bottom:0' }, `科目一（必考）＋ ${IPAS.subjectById[s.track].label}（${IPAS.subjectById[s.track].short}）`),
      h('div', { class: 'row mt1' },
        h('a', { class: 'btn sm', href: '#/settings' }, '調整日期／選考科目'),
        h('a', { class: 'btn sm', href: '#/learn' }, '看考綱')));

    /* 統計 */
    const stats = h('div', { class: 'grid cols-4 mt1' },
      tile(Store.streak() + ' 天', '連續學習'),
      tile(tr.q, '今日作答題數'),
      tile(tot.q ? pct(tot.c, tot.q) + '%' : '—', `整體正確率（${tot.q} 次）`),
      tile(cq.due.length + cq.fresh.length, '今日名詞卡', '#/cards'));

    /* 各科進度 */
    const subjCards = mine.map((sid) => {
      const sj = IPAS.subjectById[sid];
      const st = Store.subjectStats(sid);
      const last = s.exams.find((e) => e.subject === sid);
      const score = Math.round((pct(st.read, st.items) + pct(st.mastered, st.total)) / 2);
      const next = IPAS.itemsOf(sid).find((it) => !Store.isRead(it.id));
      return h('div', { class: 'card' },
        h('div', { class: 'row', style: 'gap:14px;align-items:center' },
          ring(score),
          h('div', { style: 'flex:1;min-width:0' },
            h('strong', {}, `${sj.label}・${sj.short}`),
            h('div', { class: 'small muted' }, `筆記 ${st.read}/${st.items}・答對 ${st.mastered}/${st.total} 題`),
            h('div', { class: 'small muted' }, last ? `最近模擬考 ${last.score} 分${last.score >= 70 ? '（及格）' : ''}` : '尚未模擬考'))),
        h('div', { class: 'row mt1' },
          next ? h('a', { class: 'btn sm primary', href: '#/note/' + next.id }, '繼續：' + next.name) : h('span', { class: 'chip good' }, '筆記全部讀完'),
          h('a', { class: 'btn sm', href: '#/learn?s=' + sid }, '考綱'),
          h('a', { class: 'btn sm', href: '#/exam' }, '模擬考')));
    });

    /* 弱項：作答 ≥3 次且正確率 < 70% */
    const weak = mine.flatMap((sid) => IPAS.itemsOf(sid)).map((it) => ({ it, st: Store.itemStats(it.id) }))
      .filter((x) => x.st.attempts >= 3 && x.st.accuracy < 0.7).sort((a, b) => a.st.accuracy - b.st.accuracy).slice(0, 4);

    const actions = h('div', { class: 'grid cols-3 mt1' },
      h('a', { class: 'card', href: '#/practice?subject=mine&n=10&auto=1', style: 'color:inherit;text-decoration:none' }, h('strong', {}, '⚡ 隨機 10 題'), h('div', { class: 'small muted' }, '從我的科目快速熱身')),
      h('a', { class: 'card', href: '#/wrong', style: 'color:inherit;text-decoration:none' }, h('strong', {}, `📕 錯題本（${wrongN}）`), h('div', { class: 'small muted' }, wrongN ? '把錯過的題目清空' : '目前沒有錯題')),
      h('a', { class: 'card', href: '#/exam', style: 'color:inherit;text-decoration:none' }, h('strong', {}, '⏱ 模擬考'), h('div', { class: 'small muted' }, '限時、交卷後才看答案')));

    const facts = h('details', { class: 'card' },
      h('summary', { style: 'cursor:pointer;font-weight:700' }, '考試資訊速覽（請以官方簡章為準）'),
      h('ul', { class: 'prose' },
        h('li', {}, '中級科目：L21 人工智慧技術應用與規劃（必考）；L22 大數據處理分析與應用、L23 機器學習技術與應用（二擇一，或都考）。'),
        h('li', {}, '題型：單選題、電腦化測驗；每科 100 分，通常 70 分及格。各科作答約 90 分鐘。'),
        h('li', {}, 'L22、L23 試題含 Python 程式題（基本語法、程式邏輯判斷、程式片段解析），請務必練習讀程式。'),
        h('li', {}, `評鑑範圍依官方《評鑑內容範圍參考》${IPAS.outlineVersion} 版；官方說明實際考題不僅限於所列舉內容。`)));

    return h('div', {},
      h('div', { class: 'hero' }, countdown, todoCard),
      stats,
      h('h2', {}, '學習進度'), h('div', { class: 'grid cols-2' }, subjCards),
      weak.length ? h('div', { class: 'card mt1' }, h('h3', {}, '需要加強的單元'),
        weak.map(({ it, st }) => h('div', { class: 'row between', style: 'padding:8px 0;border-top:1px solid var(--border)' },
          h('span', {}, `${it.id} ${it.name}`, ' ', h('span', { class: 'chip bad' }, `正確率 ${Math.round(st.accuracy * 100)}%`)),
          h('span', { class: 'row' }, h('a', { class: 'btn sm', href: '#/note/' + it.id }, '複習筆記'), h('a', { class: 'btn sm primary', href: '#/practice?item=' + it.id + '&auto=1' }, '針對練習'))))) : null,
      actions, h('div', { class: 'mt1' }, facts));
  });
})();
