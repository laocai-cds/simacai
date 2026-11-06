/* xa-bar.js — Tự động tạo nội dung cho thanh "Thông báo" chạy chữ của trang xã.
   Dùng chung cho 7 xã. Chỉ cần nạp file này SAU script chính của trang:
   <script src="xa-bar.js"></script>   (đặt ngay trước </body>)
   - Tự lấy số liệu từ biến `units` của trang (đúng số liệu đang hiển thị).
   - Hạn nộp lấy từ cài đặt "Nhắc việc" (biến fcDl), mặc định ngày 25.
   - Nếu quản trị đã nhập thông báo riêng, thông báo đó chạy trước, nội dung tự động chạy sau.
   - Tắt tự động: thêm window.XA_BAR_OFF=true trước khi nạp file. */
(function () {
  'use strict';
  if (window.XA_BAR_OFF || window.__xaBar) return;
  window.__xaBar = true;
  var SEP = '   ✦   ';
  var CK = 'xa_bar_cfg', CTAB = 'Thông báo tự động';
  var SEGS = [['tq', '📊 Tổng quan tiến độ'], ['han', '⏰ Số ngày đến hạn'], ['chuc', '🎉 Chúc mừng chi bộ đạt 100%'],
              ['nhac', '🔔 Nhắc chi bộ còn thiếu'], ['chua', '📌 Chi bộ chưa có người nộp']];
  var cfg = { auto: true, speak: true, autoread: true, seg: { tq: 1, han: 1, chuc: 1, nhac: 1, chua: 1 } };
  function mergeCfg(o) {
    if (!o || typeof o !== 'object') return;
    if ('auto' in o) cfg.auto = !!o.auto;
    if ('speak' in o) cfg.speak = !!o.speak;
    if ('autoread' in o) cfg.autoread = !!o.autoread;
    if (o.seg) SEGS.forEach(function (g) { if (g[0] in o.seg) cfg.seg[g[0]] = o.seg[g[0]] ? 1 : 0; });
  }
  safe(function () { mergeCfg(JSON.parse(localStorage.getItem(CK) || '{}')); });

  function fmt(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
  function safe(f, d) { try { return f(); } catch (e) { return d; } }

  function deadlineDay(now) {
    var d = safe(function () { return +fcDl; }, 25);
    if (!(d >= 1 && d <= 31)) d = 25;
    return Math.min(d, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  }
  function names(list, max) {
    var n = list.slice(0, max).map(function (r) { return nm(r); });
    return n.join(', ') + (list.length > max ? ' và ' + (list.length - max) + ' chi bộ khác' : '');
  }
  function build() {
    var U = safe(function () { return units; }, []);
    var act = U.filter(function (r) { return v(r, 'due') > 0; });
    if (!act.length) return '';
    var now = new Date(), D = deadlineDay(now), left = D - now.getDate(), mon = now.getMonth() + 1;
    var due = 0, paid = 0;
    act.forEach(function (r) { due += v(r, 'due'); paid += v(r, 'paidCount'); });
    var done = act.filter(function (r) { return cls(r) === 'complete'; });
    var miss = act.filter(function (r) { return cls(r) !== 'complete'; })
      .sort(function (a, b) { return (v(b, 'due') - v(b, 'paidCount')) - (v(a, 'due') - v(a, 'paidCount')); });
    var zero = act.filter(function (r) { return v(r, 'paidCount') === 0; });
    var out = [];

    if (cfg.seg.tq) out.push('📊 Đến nay ' + done.length + '/' + act.length + ' chi bộ hoàn thành; ' + paid + '/' + due +
      ' đảng viên đã nộp đảng phí (' + fmt(paid / due * 100) + '%).');

    var dl = 'hạn nộp đảng phí tháng ' + mon + ' là ngày ' + D + '/' + mon;
    if (!cfg.seg.han) { /* bỏ qua */ } else if (left > 0) out.push('⏰ Còn ' + left + ' ngày đến ' + dl + '.');
    else if (left === 0) out.push('⏰ Hôm nay (' + D + '/' + mon + ') là hạn cuối nộp đảng phí tháng ' + mon + '.');
    else out.push('⏰ Đã quá hạn nộp đảng phí tháng ' + mon + ' (' + D + '/' + mon + ') ' + (-left) + ' ngày.');

    if (cfg.seg.chuc && done.length) out.push('🎉 Chúc mừng ' + (done.length === act.length ? 'tất cả các chi bộ' : names(done, 3)) + ' đã nộp đủ 100%.');

    if (cfg.seg.nhac && miss.length) {
      var who = names(miss, 5), pre;
      if (left > 7) pre = '🔔 Đề nghị các chi bộ chủ động nộp sớm: ';
      else if (left > 0) pre = '🔔 Sắp đến hạn, đề nghị đẩy nhanh việc nộp đảng phí: ';
      else if (left === 0) pre = '🔔 Hôm nay là hạn cuối, đề nghị hoàn tất ngay: ';
      else pre = '🔔 Đã quá hạn, đề nghị nộp bổ sung khẩn trương: ';
      out.push(pre + who + '.');
    }
    if (cfg.seg.chua && zero.length && left <= 7) out.push('📌 Chưa có đảng viên nào nộp: ' + names(zero, 5) + '.');
    return out.join(SEP);
  }

  function apply() {
    var t = document.getElementById('ntText');
    if (!t) return;
    var auto = safe(function () { return !cfg.auto || viewingPast() ? '' : build(); }, '');
    var custom = safe(function () { var m = (ntCfg.msg || '').trim(); return m && m !== NT_DEF.msg ? m : ''; }, '');
    var text = [custom, auto].filter(Boolean).join(SEP);
    if (!text) { text = safe(function () { return NT_DEF.msg; }, ''); }
    t.textContent = text;
    safe(function () { t.style.color = ntCfg.color; t.style.fontSize = ntCfg.size + 'px'; });
    var w = (document.getElementById('ntTrack') || {}).clientWidth || 800;
    requestAnimationFrame(function () {
      var sp = safe(function () { return +ntCfg.speed; }, 90) || 90;
      var d = Math.max(12, (t.scrollWidth + w) / sp) + 's';
      t.parentNode.style.setProperty('--nt-d', d);
      t.style.setProperty('--nt-d', d);
    });
    return true;
  }

  /* Thay hàm vẽ thanh gốc để mọi lần trang tự vẽ lại vẫn giữ nội dung tự động */
  var orig = window.ntApply;
  window.ntApply = function () {
    if (typeof orig === 'function') orig.apply(this, arguments);
    apply();
  };

  /* Cập nhật khi số liệu đổi (đọc xong Google Sheet, đổi tháng, qua nửa đêm) */
  var sig = '';
  function tick() {
    var s = safe(function () {
      return units.map(function (r) { return v(r, 'paidCount') + '/' + v(r, 'due'); }).join(',') + '|' +
        new Date().toDateString() + '|' + safe(function () { return fcDl; }, 25) + '|' + safe(function () { return ntCfg.msg; }, '') + JSON.stringify(cfg);
    }, '');
    if (s && s !== sig) { sig = s; apply(); }
  }
  tick();
  setInterval(tick, 3000);

  /* ===== Đọc to (nút loa trên thanh, ai cũng dùng được) ===== */
  var speaking = false, lastAuto = false, holdPill = false;
  var session = 0, audio = null, refMeta = null;
  var synth = window.speechSynthesis;
  /* Làm sạch chữ để máy đọc đúng: bỏ biểu tượng, đọc số, phần trăm, tiền, ngày */
  function plain() {
    var t = document.getElementById('ntText');
    return (t ? t.textContent : '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, ' ')
      .replace(/\s*✦\s*/g, '. ')
      .replace(/\((\d{1,2})\/(\d{1,2})\)/g, 'ngày $1 tháng $2')
      .replace(/ngày\s+(\d{1,2})\/(\d{1,2})/gi, 'ngày $1 tháng $2')
      .replace(/(\d+)\/(\d+)/g, '$1 trên $2')
      .replace(/(\d+),(\d+)\s*%/g, '$1 phẩy $2 phần trăm').replace(/(\d)\s*%/g, '$1 phần trăm')
      .replace(/(\d)\s*(đ|₫)(?![a-zà-ỹ])/gi, '$1 đồng')
      .replace(/\s+/g, ' ').trim();
  }
  function chunks(t) {
    var out = [];
    t.split(/(?<=[.!?;:])\s+|(?<=\),)\s+/).forEach(function (s) {
      while (s.length > 180) {
        var k = s.lastIndexOf(',', 180); if (k < 60) k = s.lastIndexOf(' ', 180); if (k < 1) k = 180;
        out.push(s.slice(0, k + 1).trim()); s = s.slice(k + 1).trim();
      }
      if (s) out.push(s);
    });
    return out;
  }
  function viVoice() {
    var all = synth ? (synth.getVoices() || []) : [];
    var vi = all.filter(function (x) { return /^vi([-_]|$)/i.test(x.lang) || /vietnam|tiếng việt/i.test(x.name); });
    vi.sort(function (a, b) { var f = function (v) { return /natural|online|google/i.test(v.name) ? 0 : 1; }; return f(a) - f(b); });
    return vi[0] || null;
  }
  function noRef(v) {
    if (v && !refMeta) { refMeta = document.createElement('meta'); refMeta.name = 'referrer'; refMeta.content = 'no-referrer'; document.head.appendChild(refMeta); }
    else if (!v && refMeta) { refMeta.remove(); refMeta = null; }
  }
  function stop() {
    session++;
    safe(function () { synth && synth.cancel(); });
    if (audio) { safe(function () { audio.pause(); }); audio.src = ''; audio = null; }
    noRef(false); speaking = false; paintSpk();
  }
  /* Giọng trực tuyến (Google): chạy trên mọi trình duyệt, cần Internet */
  function ttsUrl(t) { return 'https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&ttsspeed=1&q=' + encodeURIComponent(t); }
  function playOnline(parts, my) {
    return new Promise(function (resolve) {
      noRef(true);
      var i = 0, next = null;
      function make(k) { var a = new Audio(); a.preload = 'auto'; a.src = ttsUrl(parts[k]); return a; }
      function step() {
        if (my !== session) return resolve(true);
        if (i >= parts.length) { noRef(false); return resolve(true); }
        var a = next || make(i); next = i + 1 < parts.length ? make(i + 1) : null; audio = a;
        var started = false;
        a.onplaying = function () { started = true; };
        a.onended = function () { i++; step(); };
        a.onerror = function () { if (my !== session) return resolve(true); noRef(false); resolve(i === 0 && !started ? false : true); };
        var p = a.play();
        if (p && p.catch) p.catch(function (err) {
          if (my === session) { noRef(false); resolve(i === 0 ? (err && err.name === 'NotAllowedError' ? 'blocked' : false) : true); }
        });
      }
      step();
    });
  }
  /* Giọng có sẵn trong máy (nếu có giọng tiếng Việt) */
  function playLocal(parts, my, voice) {
    return new Promise(function (resolve) {
      if (!synth || !window.SpeechSynthesisUtterance || !voice) return resolve(false);
      synth.cancel();
      parts.forEach(function (t, k) {
        var u = new SpeechSynthesisUtterance(t); u.voice = voice; u.lang = voice.lang;
        if (k === parts.length - 1) u.onend = function () { resolve(true); };
        u.onerror = function () { resolve(true); };
        if (my === session) synth.speak(u);
      });
    });
  }
  async function speak(auto) {
    auto = auto === true;
    if (speaking) { if (!auto) stop(); return; }
    var text = plain();
    if (!text) return;
    var my = ++session, parts = chunks('Thông báo. ' + text);
    speaking = true; paintSpk();
    var ok = await playLocal(parts, my, viVoice());
    if (my !== session) return;
    if (!ok) ok = await playOnline(parts, my);
    if (my !== session) return;
    if (ok === 'blocked') {
      speaking = false; noRef(false); paintSpk();
      if (auto) { safe(function () { sessionStorage.removeItem(AR); }); armGesture(); }
      else safe(function () { toast('Trình duyệt đang chặn phát âm thanh. Hãy bấm lại vào loa.'); });
      return;
    }
    if (!ok && !auto) safe(function () { toast('Không phát được giọng đọc: cần kết nối Internet hoặc cài giọng tiếng Việt cho máy.'); });
    speaking = false; noRef(false); paintSpk();
  }

  var IN_ON = '<path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>';
  var IN_OFF = '<path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M3 3l18 18" stroke="#fff" stroke-width="2.6"/>';
  function injectCss() {
    if (document.getElementById('xaCss')) return;
    var st = document.createElement('style'); st.id = 'xaCss';
    st.textContent =
      '@keyframes xaShake{0%,100%{transform:rotate(0) scale(1)}15%{transform:rotate(-14deg) scale(1.18)}30%{transform:rotate(12deg) scale(1.22)}45%{transform:rotate(-10deg) scale(1.18)}60%{transform:rotate(8deg) scale(1.2)}75%{transform:rotate(-5deg) scale(1.12)}}' +
      '.nt-badge svg{width:24px!important;height:24px!important;flex:none}' +
      '@keyframes xaWave{0%,100%{opacity:.25}50%{opacity:1}}' +
      '.nt-badge svg{transition:transform .25s ease}.nt-badge.xa-talk svg{transform:scale(1.25);animation:xaShake .7s ease-in-out infinite;transform-origin:50% 50%}' +
      '.nt-badge.xa-talk svg path:nth-of-type(2){animation:xaWave .7s ease-in-out infinite}' +
      '@media (prefers-reduced-motion:reduce){.nt-badge.xa-talk svg,.nt-badge.xa-talk svg path{animation:none}}';
    document.head.appendChild(st);
  }
  function pill() { /* đã thay bằng nút loa bật/tắt trên thanh */ }
  function paintSpk() {
    var b = document.querySelector('#notice .nt-badge'); if (!b) return;
    injectCss();
    b.classList.toggle('xa-talk', !!speaking);
    var on = cfg.speak, muted = noAuto();
    b.style.cursor = on ? 'pointer' : '';
    var svg = b.querySelector('svg');
    if (svg) { svg.innerHTML = muted ? IN_OFF : IN_ON; svg.setAttribute('viewBox', '0 0 24 24'); }
    if (on) {
      b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0'); b.setAttribute('aria-pressed', muted ? 'false' : 'true');
      b.title = muted ? 'Đang tắt tự đọc. Bấm để bật và nghe đọc'
        : (speaking ? 'Đang đọc. Bấm để tắt loa' : 'Tự đọc đang bật. Bấm để tắt loa');
      b.setAttribute('aria-label', b.title);
    } else {
      ['role', 'tabindex', 'title', 'aria-label', 'aria-pressed'].forEach(function (k) { b.removeAttribute(k); });
    }
    var sp = b.querySelector('span');
    if (sp) { if (!sp.dataset.o) sp.dataset.o = sp.textContent; sp.textContent = speaking ? 'Đang đọc…' : sp.dataset.o; }
    ['xaSpk', 'xaMute', 'xaPill'].forEach(function (id) { var o = document.getElementById(id); if (o) o.remove(); });
  }
  /* ===== Tự động đọc khi mở trang ===== */
  var AR = 'xa_bar_read', armed = false, tried = false;
  function readDone() { safe(function () { sessionStorage.setItem(AR, '1'); }); }
  function noAuto() { return safe(function () { return localStorage.getItem('xa_bar_noauto') === '1'; }, false); }
  function readSeen() { return safe(function () { return sessionStorage.getItem(AR) === '1'; }, false); }
  function armGesture() {
    if (armed) return; armed = true;
    var h = function (e) {
      ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.removeEventListener(t, h, true); });
      if (e.target && e.target.closest && e.target.closest('#notice .nt-badge')) { readDone(); return; }
      if (cfg.autoread && !noAuto() && !readSeen()) { readDone(); speak(true); }
    };
    ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.addEventListener(t, h, true); });
  }
  function autoRead() {
    if (tried || noAuto() || !cfg.autoread || !cfg.speak || readSeen()) return;
    tried = true; readDone();
    speak(true);
  }
  var waitN = 0, waitT = setInterval(function () {
    waitN++;
    var ready = safe(function () { return units.length > 0; }, false);
    if (ready || waitN > 20) { clearInterval(waitT); setTimeout(autoRead, 800); }
  }, 500);

  function mountSpk() {
    var b = document.querySelector('#notice .nt-badge');
    if (!b || b.dataset.xa) return;
    b.dataset.xa = '1';
    var go = function () {
      if (!cfg.speak) return;
      if (noAuto()) {
        safe(function () { localStorage.removeItem('xa_bar_noauto'); });
        paintSpk(); speak();
      } else {
        safe(function () { localStorage.setItem('xa_bar_noauto', '1'); });
        stop();
      }
    };
    b.addEventListener('click', go);
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    paintSpk();
  }

  /* ===== Điều khiển trong hộp "Cài đặt thông báo" (chỉ quản trị mở được) ===== */
  function mountAdmin() {
    var m = document.querySelector('#ntModal .modal');
    if (!m || document.getElementById('xaAdm')) return;
    var box = document.createElement('div');
    box.id = 'xaAdm';
    box.style.cssText = 'margin:14px 0 6px;padding:12px;border:1px solid #dbe5f3;border-radius:10px;background:#f6f9fd';
    box.innerHTML = '<div style="font-weight:700;margin-bottom:8px">Thông báo tự động theo số liệu</div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="xaAuto"> Bật nội dung tự động (chạy sau thông báo riêng ở trên)</label>' +
      '<div id="xaSegs" style="margin:6px 0 6px 22px;display:grid;gap:3px">' +
      SEGS.map(function (g) { return '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-seg="' + g[0] + '"> ' + g[1] + '</label>'; }).join('') + '</div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:8px 0 4px"><input type="checkbox" id="xaSpeak"> Bấm vào biểu tượng loa ở nhãn “Thông báo” để bật/tắt tự đọc</label>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:4px 0 4px 22px"><input type="checkbox" id="xaAr"> Tự động đọc khi mở trang (mỗi lần mở một lượt; nếu trình duyệt chặn thì đọc sau cú bấm đầu tiên)</label>' +
      '<div style="font-size:12px;color:#556;margin:4px 0 8px">Hạn nộp lấy từ cài đặt “Nhắc việc” (mặc định ngày 25).</div>' +
      '<button class="btn" id="xaTry" type="button">🔊 Nghe thử</button> ' +
      '<button class="btn solid" id="xaSave" type="button">Lưu cài đặt tự động</button>' +
      '<p class="fieldmsg" id="xaMsg" role="status"></p>';
    var macts = m.querySelector('.macts');
    m.insertBefore(box, macts);
    box.querySelector('#xaTry').onclick = function () { readForm(); apply(); paintSpk(); speak(); };
    box.querySelector('#xaSave').onclick = save;
    document.getElementById('ntSet').addEventListener('click', fillForm);
  }
  function fillForm() {
    var q = function (s) { return document.querySelector(s); };
    if (!q('#xaAuto')) return;
    q('#xaAuto').checked = cfg.auto; q('#xaSpeak').checked = cfg.speak; q('#xaAr').checked = cfg.autoread;
    document.querySelectorAll('#xaSegs [data-seg]').forEach(function (i) { i.checked = !!cfg.seg[i.dataset.seg]; });
    q('#xaMsg').textContent = ''; q('#xaMsg').className = 'fieldmsg';
  }
  function readForm() {
    cfg.auto = document.getElementById('xaAuto').checked;
    cfg.speak = document.getElementById('xaSpeak').checked;
    cfg.autoread = document.getElementById('xaAr').checked;
    document.querySelectorAll('#xaSegs [data-seg]').forEach(function (i) { cfg.seg[i.dataset.seg] = i.checked ? 1 : 0; });
  }
  async function save() {
    var msg = document.getElementById('xaMsg'), btn = document.getElementById('xaSave');
    var say = function (t, bad) { msg.textContent = t; msg.className = 'fieldmsg' + (bad ? ' bad' : ''); };
    readForm();
    safe(function () { localStorage.setItem(CK, JSON.stringify(cfg)); });
    apply(); paintSpk();
    var ep = safe(function () { return sheetEndpoint(); }, null);
    var tk = (document.getElementById('ntToken') || {}).value;
    tk = (tk || '').trim();
    if (!ep || !tk) { say('Đã lưu trên máy này. Nhập “Mã đồng bộ” ở trên rồi bấm lại để lưu lên Google Sheet cho mọi máy.'); return; }
    btn.disabled = true; say('Đang gửi lên Google Sheet...');
    var json = JSON.stringify(cfg), ok = false;
    try {
      fetch(ep, { method: 'POST', mode: 'no-cors', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ tab: CTAB, headers: ['Cấu hình', 'Cập nhật'], rows: [[json, new Date().toLocaleString('vi-VN', { hour12: false })]],
          token: tk, idToken: safe(function () { return AUTH.t(); }, ''), source: 'website-auto-notice' }) });
    } catch (e) {}
    for (var i = 0; i < 4 && !ok; i++) {
      await new Promise(function (r) { setTimeout(r, i ? 1800 : 2200); });
      try {
        var d = await jsonp(ep + '?action=read&tab=' + encodeURIComponent(CTAB), 9000);
        var r = d && d.ok && d.rows && d.rows[0];
        ok = !!(r && String(r[0]) === json);
      } catch (e) {}
    }
    btn.disabled = false;
    if (ok) say('Đã lưu lên Google Sheet, mọi máy sẽ dùng cài đặt này.');
    else say('Đã lưu trên máy này nhưng chưa lên được Google Sheet (kiểm tra mã đồng bộ, hoặc Apps Script chưa nhận tab mới).', true);
  }
  async function loadCloud() {
    var ep = safe(function () { return sheetEndpoint(); }, null);
    if (!ep) return;
    try {
      var d = await jsonp(ep + '?action=read&tab=' + encodeURIComponent(CTAB), 9000);
      var r = d && d.ok && d.rows && d.rows[0];
      if (r && r[0]) { mergeCfg(JSON.parse(r[0])); safe(function () { localStorage.setItem(CK, JSON.stringify(cfg)); }); apply(); paintSpk(); }
    } catch (e) {}
  }
  function mount() { mountSpk(); mountAdmin(); }
  mount(); setTimeout(mount, 1500);
  setTimeout(loadCloud, 2500);
  if (window.speechSynthesis) safe(function () { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () {}; });
  window.XaBar = { build: build, refresh: apply, speak: speak };
})();
