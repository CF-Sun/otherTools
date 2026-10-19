/* 共用工具：DOM 建構、迷你 Markdown、日期、亂數 */
(function () {
  const L = (window.Lib = {});

  /* ---------- DOM ---------- */
  L.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) return c.forEach(add);
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  };

  L.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- 迷你 Markdown ----------
   * 支援：## ###、清單（可巢狀）、表格、```程式碼```、> [!tip|warn|exam|trap] 提示框、**粗體**、`code`、==重點== */
  const PY_KW = 'def|class|return|import|from|as|if|elif|else|for|while|in|not|and|or|is|None|True|False|lambda|with|try|except|raise|pass|break|continue|yield|print';
  const PY_RE = new RegExp(
    '(#.*$)|("""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|f?"(?:\\\\.|[^"\\\\\\n])*"|f?\'(?:\\\\.|[^\'\\\\\\n])*\')|\\b(\\d+(?:\\.\\d+)?(?:e-?\\d+)?)\\b|\\b(' + PY_KW + ')\\b',
    'gm'
  );
  L.highlight = function (code, lang) {
    if (lang !== 'python' && lang !== 'py') return L.esc(code);
    let out = '', last = 0, m;
    PY_RE.lastIndex = 0;
    while ((m = PY_RE.exec(code))) {
      out += L.esc(code.slice(last, m.index));
      const cls = m[1] ? 'tk-com' : m[2] ? 'tk-str' : m[3] ? 'tk-num' : 'tk-kw';
      out += '<span class="' + cls + '">' + L.esc(m[0]) + '</span>';
      last = m.index + m[0].length;
      if (m[0].length === 0) PY_RE.lastIndex++;
    }
    return out + L.esc(code.slice(last));
  };
  L.codeBlock = (code, lang) => '<pre class="code"><code>' + L.highlight(code, lang || 'python') + '</code></pre>';

  function inline(s) {
    return s
      .split(/(`[^`]+`)/)
      .map((p, i) =>
        i % 2
          ? '<code>' + L.esc(p.slice(1, -1)) + '</code>'
          : L.esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/==(.+?)==/g, '<mark>$1</mark>')
      )
      .join('');
  }
  L.inline = inline;

  const CALLOUT = { tip: ['💡', '記憶技巧'], warn: ['⚠️', '注意'], exam: ['🎯', '考點'], trap: ['🚫', '易錯陷阱'], note: ['📝', '補充'] };

  L.md = function md(src) {
    const lines = src.replace(/\r/g, '').split('\n');
    let html = '', i = 0;
    const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || '');
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      // fenced code
      const fence = line.match(/^```(\w*)/);
      if (fence) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html += L.codeBlock(buf.join('\n'), fence[1] || 'python');
        continue;
      }
      // heading
      const hd = line.match(/^(#{2,4})\s+(.*)/);
      if (hd) { html += '<h' + hd[1].length + '>' + inline(hd[2]) + '</h' + hd[1].length + '>'; i++; continue; }
      // table
      if (line.trim().startsWith('|') && isTableSep(lines[i + 1])) {
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
        html += '<div class="tbl-wrap"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
        continue;
      }
      // callout / quote
      if (line.startsWith('>')) {
        const buf = [];
        while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
        let kind = 'note', title = '';
        const m = buf[0].match(/^\[!(\w+)\]\s*(.*)/);
        if (m) { kind = CALLOUT[m[1]] ? m[1] : 'note'; title = m[2]; buf.shift(); }
        const [ico, label] = CALLOUT[kind];
        html += '<div class="callout ' + kind + '"><div class="co-title">' + ico + ' ' + L.esc(title || label) + '</div>' + md(buf.join('\n')) + '</div>';
        continue;
      }
      // list
      if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
          items.push({ depth: Math.floor(m[1].length / 2), ordered: /\d/.test(m[2]), text: m[3] });
          i++;
        }
        html += renderList(items);
        continue;
      }
      // paragraph
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(```|#{2,4}\s|>|\s*([-*]|\d+\.)\s+)/.test(lines[i]) &&
             !(lines[i].trim().startsWith('|') && isTableSep(lines[i + 1]))) buf.push(lines[i++]);
      html += '<p>' + buf.map(inline).join('<br>') + '</p>';
    }
    return html;
  };

  function renderList(items) {
    let out = '';
    const stack = [];
    const open = (ordered) => { out += ordered ? '<ol>' : '<ul>'; stack.push(ordered); };
    const close = () => { out += stack.pop() ? '</ol>' : '</ul>'; };
    items.forEach((it) => {
      // 頂層清單類型（有序／無序）改變時，關閉整串清單再重開
      if (it.depth === 0 && stack.length && stack[0] !== it.ordered) { while (stack.length) { out += '</li>'; close(); } }
      const depth = Math.min(it.depth, stack.length); // 避免跳級
      while (stack.length > depth + 1) { out += '</li>'; close(); }
      if (stack.length === depth + 1) out += '</li>';
      else open(it.ordered);
      out += '<li>' + inline(it.text);
    });
    while (stack.length) { out += '</li>'; close(); }
    return out;
  }

  /* ---------- 日期（一律使用本機時區） ---------- */
  const p2 = (n) => String(n).padStart(2, '0');
  L.dateStr = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  L.today = () => L.dateStr(new Date());
  L.parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  L.addDays = (s, n) => { const d = L.parseDate(s); d.setDate(d.getDate() + n); return L.dateStr(d); };
  L.daysBetween = (a, b) => Math.round((L.parseDate(b) - L.parseDate(a)) / 86400000);
  L.fmtDur = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60); return p2(m) + ':' + p2(sec % 60); };
  L.weekday = (s) => '日一二三四五六'[L.parseDate(s).getDay()];

  /* ---------- 亂數 ---------- */
  L.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  L.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  /* ---------- 圖示（簡化的線條圖示） ---------- */
  const ICONS = {
    home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
    map: 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13l-6 2.5L9 4zM9 4v13M15 6.5v13',
    pencil: 'M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14 7l3 3',
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    cards: 'M7 4h10a2 2 0 0 1 2 2v9H5V6a2 2 0 0 1 2-2zM5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2',
    alert: 'M12 4 2.5 20h19L12 4zM12 10v4M12 17v.5',
    sheet: 'M6 3h9l4 4v14H6V3zM14 3v5h5M9 12h7M9 16h7',
    calendar: 'M4 6h16v14H4V6zM4 10h16M8 3v4M16 3v4',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1.2-2-3.4-2.3.8a7 7 0 0 0-1.7-1L14.5 4h-4l-.5 3.2a7 7 0 0 0-1.7 1l-2.3-.8-2 3.4L5.9 12l-2 1.2 2 3.4 2.3-.8a7 7 0 0 0 1.7 1l.5 3.2h4l.5-3.2a7 7 0 0 0 1.7-1l2.3.8 2-3.4L19 12z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  };
  L.icon = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name] || ICONS.home);
    s.appendChild(p);
    return s;
  };
})();
