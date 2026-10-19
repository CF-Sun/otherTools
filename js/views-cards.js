/* 名詞卡：Leitner 間隔重複 + 自由瀏覽模式 */
(function () {
  const { h, shuffle, inline } = window.Lib;
  const { pageHead, bar, bindKeys, subjectChip } = window.Comp;
  const IPAS = window.IPAS;
  const Store = window.Store;

  App.route('/cards', (_, query) => {
    const subjects = Store.subjects();
    const free = !!query.item || query.mode === 'free';
    const info = Store.cardQueue(subjects);
    let queue;
    if (query.item) queue = shuffle(IPAS.cards.filter((c) => c.item === query.item));
    else if (free) queue = shuffle(IPAS.cards.filter((c) => subjects.includes(c.subject)));
    else queue = shuffle([...info.due, ...info.fresh]);
    const startLen = queue.length;

    const box = h('div', {});
    let i = 0, flipped = false;

    const modeTabs = h('div', { class: 'tabs' },
      h('a', { class: 'tab', href: '#/cards', 'aria-selected': String(!free), style: 'text-decoration:none' }, `今日複習（到期 ${info.due.length}・新卡 ${info.fresh.length}）`),
      h('a', { class: 'tab', href: '#/cards?mode=free', 'aria-selected': String(free && !query.item), style: 'text-decoration:none' }, '自由瀏覽（不計排程）'));

    const finish = () => {
      box.replaceChildren(h('div', { class: 'card empty' },
        h('h2', {}, startLen ? '🎉 這一輪完成了' : '今天沒有需要複習的卡片'),
        h('p', {}, free ? '想再來一輪可以重新整理。' : `已學 ${Store.cardQueue(subjects).learned} / ${info.total} 張。明天會有新的到期卡片。`),
        h('div', { class: 'row', style: 'justify-content:center' },
          h('a', { class: 'btn primary', href: '#/cards?mode=free' }, '自由瀏覽全部卡片'),
          h('a', { class: 'btn', href: '#/practice' }, '去做題'))));
      App.refreshNav();
    };

    const rate = (r) => {
      const c = queue[i];
      if (!free && !c._re) Store.review(c.id, r);
      if (!free && r === 'again' && !c._re) queue.push(Object.assign({}, c, { _re: true }));
      i++; flipped = false; draw(); App.refreshNav();
    };

    const draw = () => {
      if (i >= queue.length) return finish();
      const c = queue[i];
      const it = IPAS.itemIndex[c.item];
      const st = Store.cardState(c.id);
      const face = h('div', { class: 'card flash', tabindex: '0', role: 'button', 'aria-label': flipped ? '卡片背面，點擊翻回正面' : '卡片正面，點擊翻面', onclick: () => { flipped = !flipped; draw(); } },
        h('div', {},
          h('span', { class: 'tag' }, `${c.item} ${it.name}`, st ? `・第 ${st.box} 盒` : '・新卡'),
          flipped ? h('div', { class: 'back-body', html: inline(c.back) }) : h('div', { class: 'face', html: inline(c.front) })));
      box.replaceChildren(
        h('div', { class: 'row between', style: 'margin-bottom:8px' },
          h('span', { class: 'muted small' }, `${Math.min(i + 1, queue.length)} / ${queue.length}`), subjectChip(c.subject)),
        bar((i / queue.length) * 100),
        h('div', { style: 'margin-top:12px' }, face),
        flipped
          ? (free
              ? h('div', { class: 'row mt1', style: 'justify-content:center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => rate('good') }, '下一張 →'))
              : h('div', { class: 'rate' },
                  h('button', { class: 'btn danger', type: 'button', onclick: () => rate('again') }, '忘了', h('small', {}, '1・明天再看')),
                  h('button', { class: 'btn', type: 'button', onclick: () => rate('hard') }, '有點模糊', h('small', {}, '2・縮短間隔')),
                  h('button', { class: 'btn primary', type: 'button', onclick: () => rate('good') }, '記得', h('small', {}, '3・拉長間隔'))))
          : h('div', { class: 'row mt1', style: 'justify-content:center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { flipped = true; draw(); } }, '翻面（空白鍵）')),
        h('p', { class: 'small muted center' }, '先在心裡回想答案再翻面，記憶效果最好。'));
    };

    draw();
    App.onLeave(bindKeys((e) => {
      if (i >= queue.length) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target.closest('a,button') && !e.target.classList.contains('flash')) return;
        e.preventDefault();
        if (!flipped) { flipped = true; draw(); } else if (free) rate('good');
      } else if (flipped && !free) {
        if (e.key === '1') rate('again'); else if (e.key === '2') rate('hard'); else if (e.key === '3') rate('good');
      }
    }));

    return h('div', {},
      pageHead(query.item ? '單元名詞卡' : '名詞卡', query.item ? window.Comp.itemLabel(query.item) : '用間隔重複記住定義、公式與易混淆概念。'),
      query.item ? null : modeTabs, box);
  });
})();
