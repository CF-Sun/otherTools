/* 共用 UI 元件 */
(function () {
  const { h, md, inline, codeBlock, shuffle } = window.Lib;
  const C = (window.Comp = {});

  const LEVEL = { 1: '基礎', 2: '進階', 3: '應用' };
  const SUBJ_CLASS = { L21: 'primary', L22: 'warn', L23: 'good' };
  C.levelName = (n) => LEVEL[n] || '';
  C.subjectChip = (sid) => h('span', { class: 'chip ' + (SUBJ_CLASS[sid] || '') }, window.IPAS.subjectById[sid].label);
  C.itemLabel = (id) => id + ' ' + window.IPAS.itemIndex[id].name;

  C.bar = (pct, cls) => h('div', { class: 'bar ' + (cls || ''), role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + Math.max(0, Math.min(100, pct)) + '%' }));
  C.ring = (pct, label) => h('div', { class: 'ring', style: '--p:' + pct, 'data-label': label != null ? label : pct + '%', role: 'img', 'aria-label': '完成度 ' + pct + '%' });

  C.toast = function (msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2200);
  };

  /* 選項顯示順序（原始索引陣列）。fixed 的題目或使用者關閉洗牌時維持原順序。 */
  C.optionOrder = (q) => {
    const idx = q.options.map((_, i) => i);
    return q.fixed || !window.Store.get().shuffle ? idx : shuffle(idx);
  };

  /* 題目卡
   * o: { order, chosen, reveal, onPick(origIdx), tag(額外標籤節點), result(顯示對錯) } */
  C.questionCard = function (q, o) {
    const keys = 'ABCD';
    const optList = h('ul', { class: 'opts', role: 'list' },
      o.order.map((orig, pos) => {
        let cls = 'opt';
        if (o.reveal) { if (orig === q.answer) cls += ' ok'; else if (orig === o.chosen) cls += ' no'; }
        else if (orig === o.chosen) cls += ' sel';
        const btn = h('button', {
          class: cls, type: 'button', disabled: o.reveal || !o.onPick,
          'data-pos': pos, 'aria-pressed': !o.reveal && orig === o.chosen ? 'true' : 'false',
          onclick: () => o.onPick && o.onPick(orig),
        }, h('span', { class: 'key' }, keys[pos]), h('span', { html: inline(q.options[orig]) }));
        return h('li', {}, btn);
      })
    );

    const card = h('div', { class: 'card qcard' },
      h('div', { class: 'qmeta' },
        C.subjectChip(q.subject),
        h('span', { class: 'chip' }, q.item),
        h('span', { class: 'chip' }, C.levelName(q.level)),
        o.tag || null
      ),
      h('div', { class: 'qstem', html: inline(q.stem) }),
      q.code ? h('div', { html: codeBlock(q.code, 'python') }) : null,
      optList
    );

    if (o.reveal) {
      const ok = o.chosen === q.answer;
      const pos = o.order.indexOf(q.answer);
      card.append(h('div', { class: 'explain', 'aria-live': 'polite' },
        h('div', { class: 'verdict ' + (o.chosen == null ? '' : ok ? 'ok' : 'no') },
          o.neutral ? '' : o.chosen == null ? '未作答 ・ ' : ok ? '✔ 答對了 ・ ' : '✘ 答錯了 ・ ',
          '正確答案：', keys[pos]),
        h('div', { class: 'prose', html: md(q.explain) })
      ));
    }
    return card;
  };

  /* 鍵盤：1-4 / A-D 選擇、Enter 確認／下一題。回傳解除函式。 */
  C.bindKeys = function (handler) {
    const fn = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      handler(e);
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  };
  C.pickPos = (e) => {
    const k = e.key.toLowerCase();
    if ('1234'.includes(k) && k.length === 1) return Number(k) - 1;
    if ('abcd'.includes(k) && k.length === 1) return 'abcd'.indexOf(k);
    return -1;
  };

  /* 頁首 */
  C.pageHead = (title, sub, right) =>
    h('div', { class: 'row between', style: 'margin-bottom:14px' },
      h('div', {}, h('h1', { style: 'margin-bottom:2px' }, title), sub ? h('div', { class: 'muted' }, sub) : null),
      right || null);
})();
