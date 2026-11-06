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
  function plain() {
    var t = document.getElementById('ntText');
    return (t ? t.textContent : '').replace(/✦/g, '. ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
  }
  function viVoice() {
    var all = (window.speechSynthesis.getVoices() || []);
    var vi = all.filter(function (x) { return /^vi([-_]|$)/i.test(x.lang) || /vietnam|tiếng việt/i.test(x.name); });
    /* ưu tiên giọng Natural/Google/Online (nghe tự nhiên hơn) */
    vi.sort(function (a, b) { var f = function (v) { return /natural|online|google/i.test(v.name) ? 0 : 1; }; return f(a) - f(b); });
    return { all: all, v: vi[0] || null };
  }
  function speak(auto) {
    var ss = window.speechSynthesis;
    if (auto === true && (!ss || ss.speaking)) return;
    if (!ss) { safe(function () { toast('Trình duyệt này không hỗ trợ đọc to.'); }); return; }
    if (speaking || ss.speaking) { ss.cancel(); speaking = false; paintSpk(); return; }
    var r = viVoice();
    /* Có danh sách giọng mà không có giọng tiếng Việt: không đọc (sẽ bị đọc bằng giọng Anh) */
    if (r.all.length && !r.v) {
      if (auto === true) return;
      safe(function () { toast('Máy này chưa có giọng đọc tiếng Việt. Dùng Chrome/Edge trên Android hoặc Windows, hoặc cài giọng tiếng Việt trong cài đặt hệ thống.'); });
      return;
    }
    lastAuto = auto === true;
    var u = new SpeechSynthesisUtterance(plain());
    u.lang = 'vi-VN'; u.rate = 0.95;
    if (r.v) u.voice = r.v;
    u.onend = function () { speaking = false; paintSpk(); };
    u.onerror = function (e) {
      speaking = false; paintSpk();
      /* trình duyệt chặn đọc khi chưa có thao tác: chờ cú bấm/chạm đầu tiên rồi đọc */
      if (auto === true && e && /not-allowed/i.test(e.error || '')) armGesture();
    };
    speaking = true; paintSpk(); ss.cancel(); ss.speak(u);
  }
  function injectCss() {
    if (document.getElementById('xaCss')) return;
    var st = document.createElement('style'); st.id = 'xaCss';
    st.textContent =
      '@keyframes xaShake{0%,100%{transform:rotate(0) scale(1)}15%{transform:rotate(-14deg) scale(1.18)}30%{transform:rotate(12deg) scale(1.22)}45%{transform:rotate(-10deg) scale(1.18)}60%{transform:rotate(8deg) scale(1.2)}75%{transform:rotate(-5deg) scale(1.12)}}' +
      '@keyframes xaWave{0%,100%{opacity:.25}50%{opacity:1}}' +
      '.nt-badge.xa-talk svg{animation:xaShake .7s ease-in-out infinite;transform-origin:50% 50%}' +
      '.nt-badge.xa-talk svg path:nth-of-type(2){animation:xaWave .7s ease-in-out infinite}' +
      '@media (prefers-reduced-motion:reduce){.nt-badge.xa-talk svg,.nt-badge.xa-talk svg path{animation:none}}';
    document.head.appendChild(st);
  }
  function pill(show, msg) {
    var el = document.getElementById('xaPill');
    if (!show) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'xaPill'; el.setAttribute('role', 'status');
      el.style.cssText = 'width:calc(100% - 56px);max-width:calc(var(--wrap,1100px) - 56px);margin:6px auto 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:7px 12px;border-radius:10px;background:#12335c;color:#fff;font:600 13px/1.35 system-ui,sans-serif;box-shadow:0 2px 8px -4px #12335c88';
      var n = document.getElementById('notice');
      if (n && n.parentNode) n.parentNode.insertBefore(el, n.nextSibling); else document.body.appendChild(el);
    }
    var btn = 'border:0;border-radius:9px;padding:6px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;';
    el.innerHTML = '<span id="xaPillT" style="flex:1;min-width:140px"></span>' +
      '<button type="button" id="xaStop" style="' + btn + 'background:#fff;color:#12335c">⏹ Tắt loa</button>' +
      '<button type="button" id="xaNever" style="' + btn + 'background:transparent;color:#fff;border:1px solid #ffffff88">Không tự đọc nữa</button>';
    el.querySelector('#xaPillT').textContent = msg;
    el.hidden = false;
    el.querySelector('#xaStop').onclick = function () { safe(function () { speechSynthesis.cancel(); }); speaking = false; paintSpk(); };
    el.querySelector('#xaNever').onclick = function () {
      safe(function () { localStorage.setItem('xa_bar_noauto', '1'); });
      safe(function () { speechSynthesis.cancel(); }); speaking = false;
      holdPill = true; paintSpk();
      pill(true, 'Đã tắt tự đọc trên máy này. Bấm vào loa “Thông báo” khi muốn nghe.');
      el.querySelectorAll('button').forEach(function (x) { x.remove(); });
      setTimeout(function () { holdPill = false; pill(false); }, 4500);
    };
  }
  function paintSpk() {
    var b = document.querySelector('#notice .nt-badge'); if (!b) return;
    injectCss();
    b.classList.toggle('xa-talk', !!speaking);
    if (speaking) pill(true, 'Đang đọc thông báo bằng loa.'); else if (!holdPill) pill(false);
    var on = cfg.speak && !!window.speechSynthesis;
    b.style.cursor = on ? 'pointer' : '';
    b.style.opacity = speaking ? '.85' : '';
    if (on) {
      b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0');
      b.title = speaking ? 'Bấm để dừng đọc' : 'Bấm để nghe đọc thông báo';
      b.setAttribute('aria-label', b.title);
    } else {
      ['role', 'tabindex', 'title', 'aria-label'].forEach(function (k) { b.removeAttribute(k); });
    }
    var sp = b.querySelector('span');
    if (sp) { if (!sp.dataset.o) sp.dataset.o = sp.textContent; sp.textContent = speaking ? 'Đang đọc…' : sp.dataset.o; }
    var old = document.getElementById('xaSpk'); if (old) old.remove();
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
    if (tried || noAuto() || !cfg.autoread || !cfg.speak || !window.speechSynthesis || readSeen()) return;
    tried = true; readDone();
    speak(true);
    /* nếu chưa phát được thì bắt cú bấm đầu tiên */
    setTimeout(function () {
      if (!speaking && !window.speechSynthesis.speaking) { safe(function () { sessionStorage.removeItem(AR); }); armGesture(); }
    }, 1500);
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
    var go = function () { if (cfg.speak && window.speechSynthesis) speak(); };
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
      '<label style="display:flex;gap:8px;align-items:center;margin:8px 0 4px"><input type="checkbox" id="xaSpeak"> Bấm vào biểu tượng loa “Thông báo” để nghe đọc to</label>' +
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
