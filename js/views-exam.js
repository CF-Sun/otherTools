/* 模擬考：設定、作答（計時、標記、題號導覽）、成績與檢討 */
(function () {
  const { h, shuffle, pct, fmtDur } = window.Lib;
  const { questionCard, optionOrder, bindKeys, pickPos, pageHead, bar, subjectChip } = window.Comp;
  const IPAS = window.IPAS;
  const Store = window.Store;
  const PASS = 70;
  const MIN_PER_Q = 1.8; // 以 90 分鐘 / 50 題等比換算
  const qById = (id) => IPAS.questions.find((q) => q.id === id);

  function sparkline(scores) {
    if (scores.length < 2) return null;
    const w = 220, ht = 56, pad = 6;
    const pts = scores.map((s, i) => [pad + (i * (w - 2 * pad)) / (scores.length - 1), ht - pad - (s / 100) * (ht - 2 * pad)]);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${ht}`); svg.setAttribute('width', w); svg.setAttribute('height', ht);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '近期模擬考分數趨勢：' + scores.join('、'));
    const y70 = ht - pad - (PASS / 100) * (ht - 2 * pad);
    svg.innerHTML = `<line x1="${pad}" x2="${w - pad}" y1="${y70}" y2="${y70}" stroke="var(--good)" stroke-dasharray="4 3" opacity=".7"/>` +
      `<polyline fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((p) => p.join(',')).join(' ')}"/>` +
      pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--primary)"/>`).join('');
    return svg;
  }

  /* ---------- /exam：設定 ---------- */
  App.route('/exam', () => {
    const st = Store.get();
    const resume = st.activeExam;
    const mine = Store.subjects();
    const f = { subject: mine[0], n: 'full' };

    const subjSel = h('select', { id: 'e-subj' }, IPAS.subjects.map((s) =>
      h('option', { value: s.id, selected: s.id === f.subject }, `${s.label} ${s.short}${s.id === 'L21' ? '（必考）' : mine.includes(s.id) ? '（我的選考）' : ''}`)));
    const nSel = h('select', { id: 'e-n' });
    const info = h('p', { class: 'muted', role: 'status' });
    const startBtn = h('button', { class: 'btn primary', type: 'button' }, '開始考試');

    const sizes = () => {
      const have = IPAS.questions.filter((q) => q.subject === f.subject).length;
      const opts = [['full', Math.min(50, have)], ['30', Math.min(30, have)], ['20', Math.min(20, have)]];
      nSel.replaceChildren(...opts.map(([k, n]) => h('option', { value: k }, `${k === 'full' ? '全真模擬' : k === '30' ? '半場' : '快速'}：${n} 題・${Math.ceil(n * MIN_PER_Q)} 分鐘`)));
      f.n = 'full';
      info.textContent = have ? `此科題庫共 ${have} 題。作答中不顯示答案，交卷後才會公布，及格線 ${PASS} 分。` : '此科目尚無題目。';
      startBtn.disabled = !have;
    };
    subjSel.addEventListener('change', () => { f.subject = subjSel.value; sizes(); });
    nSel.addEventListener('change', () => { f.n = nSel.value; });
    startBtn.addEventListener('click', () => {
      const have = IPAS.questions.filter((q) => q.subject === f.subject);
      const n = Math.min(have.length, f.n === 'full' ? 50 : Number(f.n));
      const picked = shuffle(have).slice(0, n);
      const orders = {};
      picked.forEach((q) => (orders[q.id] = optionOrder(q)));
      Store.set({ activeExam: { id: 'e' + Date.now(), subject: f.subject, qids: picked.map((q) => q.id), orders, answers: {}, flags: {}, start: Date.now(), limitSec: Math.ceil(n * MIN_PER_Q) * 60, idx: 0 } });
      App.go('/exam/run');
    });
    sizes();

    const hist = st.exams;
    const resumeCard = resume ? h('div', { class: 'card', style: 'border-color:var(--primary)' },
      h('div', { class: 'row between' },
        h('div', {}, h('strong', {}, '有一場進行中的考試'), h('div', { class: 'muted small' }, `${IPAS.subjectById[resume.subject].short}・${resume.qids.length} 題・已作答 ${Object.keys(resume.answers).length} 題`)),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: '#/exam/run' }, '繼續作答'),
          h('button', { class: 'btn danger', type: 'button', onclick: () => { Store.set({ activeExam: null }); App.go('/exam'); } }, '放棄')))) : null;

    return h('div', {},
      pageHead('模擬考', '用接近正式考試的節奏檢驗實力：單選題、限時、交卷後才看答案。'),
      resumeCard,
      h('div', { class: 'card' },
        h('div', { class: 'form-grid' },
          h('div', { class: 'field' }, h('label', { for: 'e-subj' }, '科目'), subjSel),
          h('div', { class: 'field' }, h('label', { for: 'e-n' }, '場次'), nSel)),
        h('div', { class: 'row between mt1' }, info, startBtn),
        h('p', { class: 'small muted' }, '正式考試的題數與時間以官方簡章為準；本站以每題 1.8 分鐘等比換算作答時間。題庫為原創練習題，非歷屆考古題。')),
      IPAS.subjects.map((s) => {
        const list = hist.filter((e) => e.subject === s.id);
        if (!list.length) return null;
        const scores = list.slice(0, 10).reverse().map((e) => e.score);
        return h('div', { class: 'card' },
          h('div', { class: 'row between' }, h('h3', { style: 'margin:0' }, `${s.label}・${s.short}`), sparkline(scores)),
          list.slice(0, 5).map((e) => h('a', { class: 'row between', href: '#/exam/result/' + e.id, style: 'padding:8px 0;border-top:1px solid var(--border);color:inherit' },
            h('span', {}, new Date(e.ts).toLocaleString('zh-TW', { hour12: false }), ` ・ ${e.correct}/${e.total} 題・${fmtDur(e.secs)}`),
            h('span', { class: 'chip ' + (e.score >= PASS ? 'good' : 'bad') }, `${e.score} 分 ${e.score >= PASS ? '及格' : '未達'}`))));
      }));
  });

  /* ---------- /exam/run：作答 ---------- */
  App.route('/exam/run', () => {
    const ex = Store.get().activeExam;
    if (!ex) { setTimeout(() => App.go('/exam'), 0); return h('div', {}); }
    const total = ex.qids.length;
    const box = h('div', {});
    let confirming = false;
    let timerEl;

    const left = () => Math.max(0, ex.limitSec - Math.round((Date.now() - ex.start) / 1000));
    const persist = () => Store.set({ activeExam: ex });

    const submit = () => {
      let correct = 0;
      const byItem = {};
      const items = ex.qids.map((id) => {
        const q = qById(id);
        const chosen = ex.answers[id];
        const ok = chosen === q.answer;
        if (chosen != null) Store.recordAnswer(id, ok);
        if (ok) correct++;
        byItem[q.item] = byItem[q.item] || [0, 0];
        byItem[q.item][1]++; if (ok) byItem[q.item][0]++;
        return { id, chosen: chosen == null ? null : chosen, order: ex.orders[id], flag: !!ex.flags[id] };
      });
      const rec = { id: ex.id, ts: Date.now(), subject: ex.subject, total, correct, score: Math.round((correct / total) * 100),
        secs: Math.min(ex.limitSec, Math.round((Date.now() - ex.start) / 1000)), byItem, items };
      Store.addExam(rec);
      Store.set({ activeExam: null });
      App.go('/exam/result/' + rec.id);
    };

    const draw = () => {
      const q = qById(ex.qids[ex.idx]);
      const chosen = ex.answers[q.id];
      const card = questionCard(q, {
        order: ex.orders[q.id], chosen, reveal: false,
        tag: h('span', { class: 'chip warn' }, `第 ${ex.idx + 1} 題`),
        onPick: (orig) => { ex.answers[q.id] = orig; persist(); draw(); },
      });
      const nav = h('div', { class: 'qnav' }, ex.qids.map((id, i) =>
        h('button', { type: 'button', 'aria-label': `第 ${i + 1} 題`, class: [ex.answers[id] != null ? 'answered' : '', i === ex.idx ? 'current' : '', ex.flags[id] ? 'flag' : ''].join(' ').trim(), onclick: () => { ex.idx = i; persist(); draw(); } }, String(i + 1))));
      const unanswered = total - Object.keys(ex.answers).length;

      timerEl = h('span', { class: 'timer' }, fmtDur(left()));
      const side = h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('span', { class: 'muted small' }, '剩餘時間'), timerEl),
        h('div', { class: 'small muted', style: 'margin:6px 0 10px' }, `已作答 ${total - unanswered} / ${total}`),
        nav,
        confirming
          ? h('div', { class: 'callout warn mt1' }, h('div', {}, unanswered ? `還有 ${unanswered} 題未作答，確定交卷？` : '確定交卷？'),
              h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn primary sm', type: 'button', onclick: submit }, '確定交卷'), h('button', { class: 'btn sm', type: 'button', onclick: () => { confirming = false; draw(); } }, '繼續作答')))
          : h('button', { class: 'btn primary mt1', style: 'width:100%', type: 'button', onclick: () => { confirming = true; draw(); } }, '交卷'));

      box.replaceChildren(h('div', { class: 'exam-layout' },
        h('div', {}, card,
          h('div', { class: 'row between mt1' },
            h('button', { class: 'btn', type: 'button', disabled: ex.idx === 0, onclick: () => { ex.idx--; persist(); draw(); } }, '← 上一題'),
            h('button', { class: 'btn', type: 'button', 'aria-pressed': String(!!ex.flags[q.id]), onclick: () => { if (ex.flags[q.id]) delete ex.flags[q.id]; else ex.flags[q.id] = 1; persist(); draw(); } }, ex.flags[q.id] ? '⚑ 取消標記' : '⚐ 標記待檢查'),
            h('button', { class: 'btn', type: 'button', disabled: ex.idx === total - 1, onclick: () => { ex.idx++; persist(); draw(); } }, '下一題 →')),
          h('p', { class: 'small muted' }, '快速鍵：1–4 / A–D 選擇・← → 切換題目')),
        side));
    };

    draw();
    const tick = setInterval(() => {
      const l = left();
      if (timerEl) { timerEl.textContent = fmtDur(l); timerEl.classList.toggle('low', l <= 300); }
      if (l <= 0) { clearInterval(tick); submit(); }
    }, 1000);
    App.onLeave(() => clearInterval(tick));
    App.onLeave(bindKeys((e) => {
      const p = pickPos(e);
      if (p >= 0) { const b = box.querySelectorAll('.opt')[p]; if (b) { e.preventDefault(); b.click(); } }
      else if (e.key === 'ArrowRight' && ex.idx < total - 1) { ex.idx++; persist(); draw(); }
      else if (e.key === 'ArrowLeft' && ex.idx > 0) { ex.idx--; persist(); draw(); }
    }));
    return box;
  });

  /* ---------- /exam/result/:id：成績 ---------- */
  App.route('/exam/result/:id', ({ id }) => {
    const e = Store.get().exams.find((x) => x.id === id);
    if (!e) return h('div', { class: 'card empty' }, '找不到此成績紀錄', h('div', {}, h('a', { class: 'btn primary', href: '#/exam' }, '回模擬考')));
    const pass = e.score >= PASS;
    const subj = IPAS.subjectById[e.subject];

    // 以「評鑑主題」彙總
    const byTheme = {};
    Object.entries(e.byItem).forEach(([item, [c, t]]) => {
      const th = IPAS.itemIndex[item].theme;
      byTheme[th.id] = byTheme[th.id] || { name: th.name, c: 0, t: 0 };
      byTheme[th.id].c += c; byTheme[th.id].t += t;
    });
    const weak = Object.entries(e.byItem).filter(([, [c, t]]) => c < t).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).slice(0, 5);

    let filter = 'wrong';
    const review = h('div', {});
    const drawReview = () => {
      const list = e.items.filter((it) => {
        const q = qById(it.id);
        if (filter === 'wrong') return it.chosen !== q.answer;
        if (filter === 'flag') return it.flag;
        return true;
      });
      review.replaceChildren(...(list.length ? list.map((it) => questionCard(qById(it.id), { order: it.order, chosen: it.chosen, reveal: true, tag: it.flag ? h('span', { class: 'chip warn' }, '⚑ 標記') : null })) : [h('div', { class: 'card empty' }, '沒有符合條件的題目 👍')]));
    };

    const tabs = h('div', { class: 'tabs' }, [['wrong', '答錯／未答'], ['flag', '標記'], ['all', '全部']].map(([k, t]) => h('button', {
      class: 'tab', type: 'button', 'aria-selected': String(filter === k), onclick: (ev) => {
        filter = k; ev.currentTarget.parentNode.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', 'false'));
        ev.currentTarget.setAttribute('aria-selected', 'true'); drawReview();
      } }, t)));
    drawReview();

    return h('div', {},
      pageHead('模擬考成績', `${subj.label}・${subj.short}・${new Date(e.ts).toLocaleString('zh-TW', { hour12: false })}`),
      h('div', { class: 'card center' },
        h('div', { class: 'score-big ' + (pass ? 'pass' : 'fail') }, e.score),
        h('p', { style: 'margin:.4em 0' }, pass ? `🎉 達到及格線（${PASS} 分）` : `距離及格線（${PASS} 分）還差 ${PASS - e.score} 分`),
        h('p', { class: 'muted small' }, `答對 ${e.correct} / ${e.total} 題・用時 ${fmtDur(e.secs)}`),
        h('div', { class: 'row', style: 'justify-content:center' }, h('a', { class: 'btn primary', href: '#/exam' }, '再考一場'), h('a', { class: 'btn', href: '#/wrong' }, '前往錯題本'))),
      h('div', { class: 'card' }, h('h3', {}, '各評鑑主題表現'),
        Object.entries(byTheme).map(([tid, v]) => h('div', { style: 'margin:10px 0' },
          h('div', { class: 'row between small' }, h('span', {}, `${tid} ${v.name}`), h('strong', {}, `${v.c}/${v.t}（${pct(v.c, v.t)}%）`)),
          bar(pct(v.c, v.t), pct(v.c, v.t) >= PASS ? 'good' : '')))),
      weak.length ? h('div', { class: 'card' }, h('h3', {}, '建議優先複習'),
        weak.map(([item, [c, t]]) => h('div', { class: 'row between', style: 'padding:6px 0;border-top:1px solid var(--border)' },
          h('span', {}, `${item} ${IPAS.itemIndex[item].name}`, ' ', h('span', { class: 'chip bad' }, `${c}/${t}`)),
          h('span', { class: 'row' }, h('a', { class: 'btn sm', href: '#/note/' + item }, '筆記'), h('a', { class: 'btn sm', href: '#/practice?item=' + item + '&auto=1' }, '練習'))))) : null,
      h('h2', {}, '逐題檢討'), tabs, review);
  });
})();
