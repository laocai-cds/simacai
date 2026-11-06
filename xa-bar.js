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
  var fmt = function (n) { return String(Math.round(n * 10) / 10).replace('.', ','); };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };

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

    out.push('📊 Đến nay ' + done.length + '/' + act.length + ' chi bộ hoàn thành; ' + paid + '/' + due +
      ' đảng viên đã nộp đảng phí (' + fmt(paid / due * 100) + '%).');

    var dl = 'hạn nộp đảng phí tháng ' + mon + ' là ngày ' + D + '/' + mon;
    if (left > 0) out.push('⏰ Còn ' + left + ' ngày đến ' + dl + '.');
    else if (left === 0) out.push('⏰ Hôm nay (' + D + '/' + mon + ') là hạn cuối nộp đảng phí tháng ' + mon + '.');
    else out.push('⏰ Đã quá hạn nộp đảng phí tháng ' + mon + ' (' + D + '/' + mon + ') ' + (-left) + ' ngày.');

    if (done.length) out.push('🎉 Chúc mừng ' + (done.length === act.length ? 'tất cả các chi bộ' : names(done, 3)) + ' đã nộp đủ 100%.');

    if (miss.length) {
      var who = names(miss, 5), pre;
      if (left > 7) pre = '🔔 Đề nghị các chi bộ chủ động nộp sớm: ';
      else if (left > 0) pre = '🔔 Sắp đến hạn, đề nghị đẩy nhanh việc nộp đảng phí: ';
      else if (left === 0) pre = '🔔 Hôm nay là hạn cuối, đề nghị hoàn tất ngay: ';
      else pre = '🔔 Đã quá hạn, đề nghị nộp bổ sung khẩn trương: ';
      out.push(pre + who + '.');
    }
    if (zero.length && left <= 7) out.push('📌 Chưa có đảng viên nào nộp: ' + names(zero, 5) + '.');
    return out.join(SEP);
  }

  function apply() {
    var t = document.getElementById('ntText');
    if (!t) return;
    var auto = safe(function () { return viewingPast() ? '' : build(); }, '');
    var custom = safe(function () { var m = (ntCfg.msg || '').trim(); return m && m !== NT_DEF.msg ? m : ''; }, '');
    var text = [custom, auto].filter(Boolean).join(SEP);
    if (!text) return false;
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
        new Date().toDateString() + '|' + safe(function () { return fcDl; }, 25) + '|' + safe(function () { return ntCfg.msg; }, '');
    }, '');
    if (s && s !== sig) { sig = s; apply(); }
  }
  tick();
  setInterval(tick, 3000);
  window.XaBar = { build: build, refresh: apply };
})();
