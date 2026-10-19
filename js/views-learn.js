/* 考綱地圖、筆記閱讀、速查表、全站搜尋 */
(function () {
  const { h, md, esc } = window.Lib;
  const { subjectChip, bar, pageHead } = window.Comp;
  const IPAS = window.IPAS;
  const Store = window.Store;

  /* ---------- /learn：考綱地圖 ---------- */
  App.route('/learn', (_, query) => {
    const sid = IPAS.subjectById[query.s] ? query.s : 'L21';
    const subj = IPAS.subjectById[sid];
    const st = Store.subjectStats(sid);
    const track = Store.get().track;

    const tabs = h('div', { class: 'tabs', role: 'tablist' },
      IPAS.subjects.map((s) => h('button', {
        class: 'tab', role: 'tab', 'aria-selected': String(s.id === sid), type: 'button',
        onclick: () => App.go('/learn?s=' + s.id),
      }, s.label + '・' + s.short + (s.id === 'L21' ? '（必考）' : s.id === track ? '（我的選考）' : '')))
    );

    const head = h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('div', {}, h('h2', { style: 'margin:0' }, `${subj.id} ${subj.name}`), h('p', { class: 'muted small', style: 'margin:.3em 0 0' }, subj.desc)),
        subj.required ? h('span', { class: 'chip primary' }, '必考') :
          h('button', { class: 'btn sm' + (track === sid ? '' : ' primary'), type: 'button', disabled: track === sid, onclick: () => { Store.set({ track: sid }); App.go('/learn?s=' + sid); } },
            track === sid ? '✔ 已設為我的選考科目' : '設為我的選考科目')),
      h('div', { class: 'grid cols-3 mt1' },
        stat('筆記已讀', `${st.read} / ${st.items}`, bar((st.read / st.items) * 100)),
        stat('題目已作答', `${st.answered} / ${st.total}`, bar(st.total ? (st.answered / st.total) * 100 : 0)),
        stat('最近一次答對', `${st.mastered} / ${st.total}`, bar(st.total ? (st.mastered / st.total) * 100 : 0, 'good')))
    );

    const themes = subj.themes.map((t) =>
      h('div', { class: 'card theme' },
        h('h3', {}, h('span', { class: 'chip primary' }, t.id), t.name),
        t.items.map((it) => itemRow(it)))
    );

    return h('div', {},
      pageHead('考綱地圖', `依據官方《評鑑內容範圍參考》${IPAS.outlineVersion} 版。實際考題不限於所列內容，請搭配官方學習指引。`),
      tabs, head, themes);
  });

  function stat(label, value, barNode) {
    return h('div', {}, h('div', { class: 'small muted' }, label), h('div', { style: 'font-weight:800;font-size:1.15rem;margin-bottom:4px' }, value), barNode);
  }

  function itemRow(it) {
    const s = Store.itemStats(it.id);
    const read = Store.isRead(it.id);
    const hasNote = !!IPAS.notes[it.id];
    return h('div', { class: 'item-row' },
      h('div', {},
        h('div', { class: 'name' }, read ? '✅ ' : '', `${it.id} ${it.name}`),
        it.hint ? h('div', { class: 'pts' }, '官方備註：' + it.hint) : null),
      h('div', {},
        h('div', { class: 'small muted' }, s.total ? `掌握 ${s.mastered}/${s.total} 題` : '尚無題目'),
        bar(s.total ? (s.mastered / s.total) * 100 : 0, 'good')),
      h('div', { class: 'row' },
        h('a', { class: 'btn sm' + (read ? '' : ' primary'), href: '#/note/' + it.id }, hasNote ? '筆記' : '筆記（撰寫中）'),
        h('a', { class: 'btn sm', href: '#/practice?item=' + it.id + '&auto=1' }, '練習')));
  }

  /* ---------- /note/:id：筆記 ---------- */
  App.route('/note/:id', ({ id }) => {
    const it = IPAS.itemIndex[id];
    if (!it) return h('div', { class: 'card empty' }, '找不到此單元');
    const all = IPAS.itemsOf(it.subject.id);
    const idx = all.findIndex((x) => x.id === id);
    const prev = all[idx - 1], next = all[idx + 1];
    const nQ = IPAS.questions.filter((q) => q.item === id).length;
    const nC = IPAS.cards.filter((c) => c.item === id).length;
    const read = Store.isRead(id);

    const readBtn = h('button', { class: 'btn' + (read ? '' : ' primary'), type: 'button', onclick: () => {
      Store.setRead(id, !Store.isRead(id));
      App.go('/note/' + id);
    } }, read ? '✔ 已讀（點擊取消）' : '標記為已讀');

    return h('div', {},
      h('div', { class: 'crumbs' }, h('a', { href: '#/learn?s=' + it.subject.id }, `${it.subject.label}・${it.subject.short}`), ' › ', `${it.theme.id} ${it.theme.name}`),
      h('div', { class: 'card' },
        h('h1', {}, `${it.id} ${it.name}`),
        it.hint ? h('div', { class: 'callout exam' }, h('div', { class: 'co-title' }, '🎯 官方評鑑備註'), h('p', {}, it.hint)) : null,
        IPAS.notes[id]
          ? h('div', { class: 'prose', html: md(IPAS.notes[id]) })
          : h('div', { class: 'empty' }, '此單元的筆記尚在撰寫中。'),
        h('div', { class: 'row mt2' }, readBtn,
          nQ ? h('a', { class: 'btn', href: '#/practice?item=' + id + '&auto=1' }, `練習本單元（${nQ} 題）`) : null,
          nC ? h('a', { class: 'btn', href: '#/cards?item=' + id }, `名詞卡（${nC} 張）`) : null)),
      h('div', { class: 'row between mt1' },
        prev ? h('a', { class: 'btn', href: '#/note/' + prev.id }, '← ' + prev.name) : h('span'),
        next ? h('a', { class: 'btn', href: '#/note/' + next.id }, next.name + ' →') : h('span')));
  });

  /* ---------- /cheats：速查表 ---------- */
  App.route('/cheats', (_, query) => {
    const mine = Store.subjects();
    let filter = query.s || 'mine';
    const box = h('div', {});
    const input = h('input', { type: 'text', placeholder: '篩選速查表…', 'aria-label': '篩選速查表', style: 'padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:var(--surface);min-width:200px' });

    const draw = () => {
      const kw = input.value.trim().toLowerCase();
      const list = IPAS.cheats.filter((c) => {
        const inSubj = filter === 'all' ? true : filter === 'mine' ? c.subjects.some((s) => mine.includes(s)) : c.subjects.includes(filter);
        return inSubj && (!kw || (c.title + c.md).toLowerCase().includes(kw));
      });
      box.replaceChildren(...(list.length ? list.map((c) =>
        h('details', { class: 'card', open: !!kw || list.length <= 2 },
          h('summary', { style: 'cursor:pointer;font-weight:800;font-size:1.05rem' }, c.title, ' ', c.subjects.map((s) => subjectChip(s))),
          h('div', { class: 'prose', html: md(c.md) }))
      ) : [h('div', { class: 'card empty' }, '沒有符合的速查表')]));
    };
    input.addEventListener('input', draw);

    const opts = [['mine', '我的科目'], ['all', '全部'], ['L21', '科目一'], ['L22', '科目二'], ['L23', '科目三']];
    const tabs = h('div', { class: 'tabs' }, opts.map(([k, label]) => h('button', {
      class: 'tab', type: 'button', 'aria-selected': String(filter === k), onclick: (e) => {
        filter = k;
        e.currentTarget.parentNode.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', 'false'));
        e.currentTarget.setAttribute('aria-selected', 'true');
        draw();
      },
    }, label)), input);
    draw();
    return h('div', {}, pageHead('公式與比較速查表', '考前最後衝刺用：公式、比較表、決策規則。'), tabs, box);
  });

  /* ---------- /search?q= ---------- */
  function snippet(text, kw) {
    const i = text.toLowerCase().indexOf(kw);
    if (i < 0) return '';
    const a = Math.max(0, i - 24), b = Math.min(text.length, i + kw.length + 60);
    const raw = (a ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ') + (b < text.length ? '…' : '');
    return esc(raw).replace(new RegExp(esc(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => '<mark>' + m + '</mark>');
  }
  App.route('/search', (_, query) => {
    const kw = (query.q || '').trim().toLowerCase();
    const res = [];
    if (kw) {
      IPAS.subjects.forEach((s) => s.themes.forEach((t) => t.items.forEach((it) => {
        const txt = (IPAS.notes[it.id] || '').replace(/[`*#|>=]/g, ' ');
        if ((it.name + ' ' + it.id).toLowerCase().includes(kw) || txt.toLowerCase().includes(kw))
          res.push({ kind: '筆記', title: `${it.id} ${it.name}`, href: '#/note/' + it.id, body: snippet(txt, kw) });
      })));
      IPAS.cheats.forEach((c) => { if ((c.title + c.md).toLowerCase().includes(kw)) res.push({ kind: '速查', title: c.title, href: '#/cheats?s=all', body: snippet(c.md.replace(/[`*#|>=]/g, ' '), kw) }); });
      IPAS.cards.forEach((c) => { if ((c.front + c.back).toLowerCase().includes(kw)) res.push({ kind: '名詞卡', title: c.front, href: '#/note/' + c.item, body: snippet(c.back, kw) }); });
      IPAS.questions.forEach((q) => { if ((q.stem + q.options.join('')).toLowerCase().includes(kw)) res.push({ kind: '題目', title: q.id, href: '#/practice?qid=' + q.id, body: snippet(q.stem, kw) }); });
    }
    return h('div', {},
      pageHead('搜尋結果', kw ? `「${query.q}」共 ${res.length} 筆` : '請輸入關鍵字'),
      res.slice(0, 80).map((r) => h('a', { class: 'card', href: r.href, style: 'display:block;color:inherit' },
        h('div', { class: 'row' }, h('span', { class: 'chip primary' }, r.kind), h('strong', {}, r.title)),
        r.body ? h('div', { class: 'small muted', html: r.body }) : null)),
      kw && !res.length ? h('div', { class: 'card empty' }, '沒有找到相符內容') : null);
  });
})();
