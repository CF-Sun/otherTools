/* 路由與整體版面。各 views-*.js 以 App.route() 註冊頁面，DOMContentLoaded 後啟動。 */
(function () {
  const { h, icon } = window.Lib;
  const routes = [];
  let cleanups = [];

  const NAV = [
    { path: '/', icon: 'home', label: '首頁', match: (p) => p === '/' },
    { path: '/learn', icon: 'map', label: '考綱筆記', match: (p) => p.startsWith('/learn') || p.startsWith('/note') },
    { path: '/practice', icon: 'pencil', label: '題庫練習', match: (p) => p.startsWith('/practice') },
    { path: '/exam', icon: 'clock', label: '模擬考', match: (p) => p.startsWith('/exam') },
    { path: '/cards', icon: 'cards', label: '名詞卡', match: (p) => p.startsWith('/cards'), badge: 'cards' },
    { path: '/wrong', icon: 'alert', label: '錯題本', match: (p) => p.startsWith('/wrong'), badge: 'wrong' },
    { path: '/cheats', icon: 'sheet', label: '速查表', match: (p) => p.startsWith('/cheats') },
    { path: '/plan', icon: 'calendar', label: '學習計畫', match: (p) => p.startsWith('/plan') },
  ];

  const App = (window.App = {
    /** 註冊路由，例如 App.route('/note/:id', (params, query) => Node) */
    route(pattern, fn) {
      const keys = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
      routes.push({ re, keys, fn });
    },
    onLeave(fn) { cleanups.push(fn); },
    go(path) { if (location.hash === '#' + path) render(); else location.hash = '#' + path; },
    refreshNav,
  });

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path: decodeURI(path) || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  /* ---------- 版面 ---------- */
  let sideLinks = [], tabLinks = [];

  function navItem(n) {
    const badge = h('span', { class: 'nav-badge', hidden: true, 'data-badge': n.badge || '' });
    const a = h('a', { class: 'nav-link', href: '#' + n.path }, icon(n.icon), h('span', {}, n.label), n.badge ? badge : null);
    a._n = n;
    return a;
  }

  function applyTheme() {
    const t = window.Store.get().theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function buildLayout() {
    const root = document.getElementById('app');
    sideLinks = NAV.map(navItem);
    tabLinks = NAV.map(navItem);

    const side = h('aside', { class: 'side', 'aria-label': '主選單' },
      h('a', { class: 'brand', href: '#/' },
        h('span', { class: 'brand-mark' }, 'AI'),
        h('span', {}, 'AI 應用規劃師', h('small', {}, 'iPAS 中級 自學站'))),
      h('nav', { style: 'display:contents', 'aria-label': '功能' }, sideLinks),
      h('div', { class: 'side-foot' }, '考綱版本：' + window.IPAS.outlineVersion + ' 版', h('br'), '非官方教材，僅供自學輔助')
    );

    const search = h('input', { type: 'search', placeholder: '搜尋筆記、名詞、公式…', 'aria-label': '搜尋', id: 'q' });
    const form = h('form', { class: 'searchbox', role: 'search', onsubmit: (e) => {
      e.preventDefault();
      const v = search.value.trim();
      if (v) App.go('/search?q=' + encodeURIComponent(v));
    } }, icon('search'), search);

    const themeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': '切換亮暗色', title: '切換亮暗色', id: 'theme-btn', onclick: () => {
      const cur = document.documentElement.getAttribute('data-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      window.Store.set({ theme: cur === 'dark' ? 'light' : 'dark' });
      applyTheme();
    } }, icon('moon'));
    const gear = h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': '設定', title: '設定' }, icon('gear'));

    const main = h('div', { class: 'main' },
      h('header', { class: 'top' }, form, h('span', { class: 'grow' }), themeBtn, gear),
      h('main', { class: 'view', id: 'view', tabindex: '-1' })
    );
    const tabbar = h('nav', { class: 'tabbar', 'aria-label': '行動版選單' }, tabLinks);
    root.replaceChildren(side, main, tabbar);
  }

  function refreshNav() {
    const { path } = parseHash();
    const wrong = Object.keys(window.Store.get().answers).filter(window.Store.inWrongBook).length;
    const q = window.Store.cardQueue(window.Store.subjects());
    const counts = { wrong, cards: q.due.length + q.fresh.length };
    [...sideLinks, ...tabLinks].forEach((a) => {
      if (a._n.match(path)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      const b = a.querySelector('.nav-badge');
      if (b) { const n = counts[b.dataset.badge] || 0; b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
    });
  }

  /* ---------- 繪製 ---------- */
  function render() {
    cleanups.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    cleanups = [];
    const { path, query } = parseHash();
    const view = document.getElementById('view');
    view.replaceChildren();
    let node = null;
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        try { node = r.fn(params, query); }
        catch (err) { console.error(err); node = h('div', { class: 'card' }, h('h2', {}, '頁面發生錯誤'), h('p', { class: 'muted' }, String(err && err.message))); }
        break;
      }
    }
    if (!node) node = h('div', { class: 'card empty' }, h('h2', {}, '找不到頁面'), h('a', { class: 'btn primary', href: '#/' }, '回首頁'));
    if (node.nodeType) view.append(node);
    if (!window.Store.persistent) {
      view.prepend(h('div', { class: 'callout warn' }, '此瀏覽器無法儲存資料（可能是無痕模式或停用了儲存空間），進度只會在本次開啟期間保留。請到「設定」匯出備份。'));
    }
    window.scrollTo(0, 0);
    refreshNav();
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    buildLayout();
    render();
  });
  App.applyTheme = applyTheme;
})();
