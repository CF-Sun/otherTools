/* 題庫練習與錯題本 */
(function () {
  const { h, shuffle, pct } = window.Lib;
  const { questionCard, optionOrder, bindKeys, pickPos, pageHead, bar, subjectChip, levelName } = window.Comp;
  const IPAS = window.IPAS;
  const Store = window.Store;

  let session = null; // { title, qids, idx, results:{qid:{chosen,correct}}, orders:{qid:[]} }

  const qById = (id) => IPAS.questions.find((q) => q.id === id);

  function pool(f) {
    const mine = Store.subjects();
    return IPAS.questions.filter((q) => {
      if (f.subject === 'mine' ? !mine.includes(q.subject) : f.subject !== 'all' && q.subject !== f.subject) return false;
      if (f.item && f.item !== 'all' && q.item !== f.item) return false;
      if (f.level && f.level !== 'all' && String(q.level) !== String(f.level)) return false;
      const st = Store.stat(q.id);
      if (f.status === 'unanswered' && st) return false;
      if (f.status === 'wrong' && !Store.inWrongBook(q.id)) return false;
      if (f.status === 'todo' && st && st.l) return false;
      return true;
    });
  }

  function start(qids, title) {
    session = { title, qids, idx: 0, results: {}, orders: {} };
    App.go('/practice/run');
  }

  /* ---------- /practice：設定 ---------- */
  App.route('/practice', (_, query) => {
    // 以連結快速開始
    if (query.qid && qById(query.qid)) { setTimeout(() => start([query.qid], '單題檢視'), 0); return h('div', {}); }
    if (query.auto) {
      const f = { subject: query.subject || (query.item ? IPAS.itemIndex[query.item].subject.id : 'mine'), item: query.item || 'all', level: 'all', status: query.status || 'all' };
      let ids = shuffle(pool(f)).map((q) => q.id);
      if (query.n) ids = ids.slice(0, Number(query.n));
      else if (query.item) ids = ids.slice(0, 20);
      if (ids.length) { setTimeout(() => start(ids, query.item ? window.Comp.itemLabel(query.item) : '綜合練習'), 0); return h('div', {}); }
    }

    const f = { subject: 'mine', item: 'all', level: 'all', status: 'all', n: '20' };
    const selSubject = h('select', { id: 'f-subject' },
      h('option', { value: 'mine' }, '我的科目（科目一＋選考）'),
      IPAS.subjects.map((s) => h('option', { value: s.id }, `${s.label} ${s.short}`)),
      h('option', { value: 'all' }, '全部科目'));
    const selItem = h('select', { id: 'f-item' });
    const selLevel = h('select', { id: 'f-level' }, [['all', '全部難度'], ['1', '基礎'], ['2', '進階'], ['3', '應用（情境／計算／程式）']].map(([v, t]) => h('option', { value: v }, t)));
    const selStatus = h('select', { id: 'f-status' }, [['all', '全部題目'], ['unanswered', '尚未作答'], ['todo', '尚未掌握（未答或最近答錯）'], ['wrong', '錯題本']].map(([v, t]) => h('option', { value: v }, t)));
    const selN = h('select', { id: 'f-n' }, [['10', '10 題'], ['20', '20 題'], ['30', '30 題'], ['all', '全部']].map(([v, t]) => h('option', { value: v, selected: v === '20' }, t)));
    const info = h('p', { class: 'muted', role: 'status' });
    const go = h('button', { class: 'btn primary', type: 'button' }, '開始練習');

    const fillItems = () => {
      const subs = f.subject === 'mine' ? Store.subjects() : f.subject === 'all' ? IPAS.subjects.map((s) => s.id) : [f.subject];
      selItem.replaceChildren(h('option', { value: 'all' }, '全部單元'),
        ...subs.flatMap((sid) => IPAS.subjectById[sid].themes.map((t) =>
          h('optgroup', { label: `${t.id} ${t.name}` }, t.items.map((it) => h('option', { value: it.id }, `${it.id} ${it.name}`))))));
      f.item = 'all';
    };
    const refresh = () => {
      const n = pool(f).length;
      info.textContent = `符合條件的題目：${n} 題`;
      go.disabled = !n;
    };
    const bind = (el, key, extra) => el.addEventListener('change', () => { f[key] = el.value; if (extra) extra(); refresh(); });
    bind(selSubject, 'subject', fillItems); bind(selItem, 'item'); bind(selLevel, 'level'); bind(selStatus, 'status'); bind(selN, 'n');
    go.addEventListener('click', () => {
      let ids = shuffle(pool(f)).map((q) => q.id);
      if (f.n !== 'all') ids = ids.slice(0, Number(f.n));
      start(ids, '自選練習');
    });
    fillItems(); refresh();

    const field = (label, el, id) => h('div', { class: 'field' }, h('label', { for: id }, label), el);
    return h('div', {},
      pageHead('題庫練習', '每題作答後立即顯示詳解。答錯的題目會進入錯題本，連續答對 2 次後移出。'),
      h('div', { class: 'card' },
        h('div', { class: 'form-grid' },
          field('科目', selSubject, 'f-subject'), field('單元', selItem, 'f-item'), field('難度', selLevel, 'f-level'),
          field('狀態', selStatus, 'f-status'), field('題數', selN, 'f-n')),
        h('div', { class: 'row between mt1' }, info, go)),
      totalsCard());
  });

  function totalsCard() {
    const t = Store.totals();
    return h('div', { class: 'grid cols-3 mt1' },
      tile(t.q, '累計作答次數'), tile(t.q ? pct(t.c, t.q) + '%' : '—', '整體正確率'),
      tile(Object.keys(Store.get().answers).filter(Store.inWrongBook).length, '錯題本題數'));
  }
  const tile = (num, lbl) => h('div', { class: 'tile' }, h('div', { class: 'num' }, String(num)), h('div', { class: 'lbl' }, lbl));

  /* ---------- /practice/run：作答 ---------- */
  App.route('/practice/run', () => {
    if (!session) { setTimeout(() => App.go('/practice'), 0); return h('div', {}); }
    const s = session;
    const box = h('div', {});
    let revealed = false;

    const done = () => {
      const ids = Object.keys(s.results);
      const right = ids.filter((id) => s.results[id].correct).length;
      const wrongIds = ids.filter((id) => !s.results[id].correct);
      box.replaceChildren(
        pageHead('練習結算', s.title),
        h('div', { class: 'card center' },
          h('div', { class: 'score-big ' + (right / Math.max(1, s.qids.length) >= 0.7 ? 'pass' : 'fail') }, `${right} / ${s.qids.length}`),
          h('p', { class: 'muted' }, `正確率 ${pct(right, s.qids.length)}%・未作答 ${s.qids.length - ids.length} 題`),
          h('div', { class: 'row', style: 'justify-content:center' },
            wrongIds.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => start(wrongIds, '本次答錯題目重練') }, `重練答錯的 ${wrongIds.length} 題`) : null,
            h('a', { class: 'btn', href: '#/practice' }, '再練一輪'),
            h('a', { class: 'btn', href: '#/wrong' }, '前往錯題本'))),
        wrongIds.length ? h('h2', {}, '本次答錯') : null,
        wrongIds.map((id) => questionCard(qById(id), { order: s.orders[id], chosen: s.results[id].chosen, reveal: true })));
    };

    const show = () => {
      if (s.idx >= s.qids.length) return done();
      const q = qById(s.qids[s.idx]);
      revealed = false;
      const order = (s.orders[q.id] = s.orders[q.id] || optionOrder(q));
      const draw = (chosen) => {
        revealed = chosen != null;
        const card = questionCard(q, {
          order, chosen, reveal: revealed,
          onPick: revealed ? null : (orig) => {
            const correct = orig === q.answer;
            s.results[q.id] = { chosen: orig, correct };
            Store.recordAnswer(q.id, correct);
            App.refreshNav();
            draw(orig);
          },
        });
        const last = s.idx === s.qids.length - 1;
        const next = h('button', { class: 'btn primary', type: 'button', id: 'next', disabled: !revealed, onclick: () => { s.idx++; show(); } }, last ? '查看結果' : '下一題 →');
        box.replaceChildren(
          h('div', { class: 'row between', style: 'margin-bottom:10px' },
            h('strong', {}, `${s.title}・第 ${s.idx + 1} / ${s.qids.length} 題`),
            h('a', { class: 'btn sm', href: '#/practice', onclick: () => { session = null; } }, '結束')),
          bar(((s.idx + (revealed ? 1 : 0)) / s.qids.length) * 100),
          h('div', { style: 'margin-top:12px' }, card),
          h('div', { class: 'row between mt1' },
            h('span', { class: 'small muted' }, '快速鍵：1–4 或 A–D 選擇・Enter 下一題'), next));
        if (revealed) next.focus({ preventScroll: true });
      };
      draw(null);
    };

    show();
    App.onLeave(bindKeys((e) => {
      if (s.idx >= s.qids.length) return;
      if (!revealed) {
        const p = pickPos(e);
        if (p >= 0) { const b = box.querySelectorAll('.opt')[p]; if (b) { e.preventDefault(); b.click(); } }
      } else if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button,a')) {
        e.preventDefault();
        const n = box.querySelector('#next'); if (n) n.click();
      }
    }));
    return box;
  });

  /* ---------- /wrong：錯題本 ---------- */
  App.route('/wrong', () => {
    const wrong = IPAS.questions.filter((q) => Store.inWrongBook(q.id));
    const head = pageHead('錯題本', '答錯過、且尚未連續答對 2 次的題目。把它們清空，就是最有效率的複習。',
      wrong.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => start(shuffle(wrong).map((q) => q.id), '錯題訂正') }, `全部重練（${wrong.length}）`) : null);
    if (!wrong.length) return h('div', {}, head, h('div', { class: 'card empty' }, h('p', {}, '🎉 目前沒有錯題。'), h('a', { class: 'btn primary', href: '#/practice' }, '去做題')));

    const groups = IPAS.subjects.map((s) => ({ s, qs: wrong.filter((q) => q.subject === s.id) })).filter((g) => g.qs.length);
    return h('div', {}, head, groups.map((g) =>
      h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, `${g.s.label}・${g.s.short}（${g.qs.length}）`),
          h('button', { class: 'btn sm', type: 'button', onclick: () => start(shuffle(g.qs).map((q) => q.id), g.s.short + ' 錯題訂正') }, '只練這科')),
        g.qs.map((q) => {
          const st = Store.stat(q.id);
          return h('details', { style: 'border-top:1px solid var(--border);padding:8px 0', class: 'wrong-item' },
            h('summary', { style: 'cursor:pointer' }, h('span', { class: 'chip' }, q.item), ' ', q.stem.length > 70 ? q.stem.slice(0, 70) + '…' : q.stem,
              ' ', h('span', { class: 'chip bad' }, `答對 ${st.c}/${st.n}`)),
            h('div', { style: 'margin-top:10px' }, questionCard(q, { order: q.options.map((_, i) => i), chosen: null, reveal: true, neutral: true })));
        }))));
  });
})();
