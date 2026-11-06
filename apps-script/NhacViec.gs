/**
 * NHẮC VIỆC TỰ ĐỘNG – Đảng bộ xã Nghĩa Đô
 * Dán file này vào dự án Apps Script của xã (thêm file mới, ví dụ NhacViec.gs), rồi:
 *   1) Chạy hàm nvSetup() một lần (cấp quyền gửi mail) -> tạo bộ hẹn giờ chạy mỗi ngày.
 *   2) Chạy thử nvTest() để gửi 1 thư thử về chính tài khoản Google đang chạy.
 * Cài đặt lấy từ tab "Nhắc việc" (lưu bởi trang Quản trị của website).
 * Địa chỉ nhận lấy từ tab "Liên hệ nhắc việc": cột A Đơn vị, B Email, C Zalo, D Ghi chú.
 * Gmail thường gửi tối đa ~100 thư/ngày (Workspace ~1.500).
 */
const NV = {
  setTab: 'Nhắc việc', ctTab: 'Liên hệ nhắc việc', logTab: 'Nhật ký nhắc việc',
  org: 'Đảng ủy xã Nghĩa Đô', site: 'https://laocai-cds.github.io/nghiado/',
  tz: 'Asia/Ho_Chi_Minh', y0: 2026
};
const NV_COLS = { name: 'Tên đơn vị', members: 'Tổng sl đảng viên (1)', pending: 'Chưa duyệt (6)', paidCount: 'Đã duyệt, đã nộp (8)',
  unfiled: 'Số đảng viên chưa có hồ sơ (9)', exempt: 'Số lượng được miễn giảm ĐP (5)',
  moved: 'Số lượng ĐV đã chuyển sinh hoạt đảng tạm thời (4)', approved: 'Đã duyệt, chưa nộp (7)' };

function nvKey_(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
function nvNum_(x) {
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  const t = String(x == null ? '' : x).trim().replace(/\s/g, '').replace('%', '');
  if (!t) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^-?\d+,\d+$/.test(t)) return Number(t.replace(',', '.')) || 0;
  return Number(t) || 0;
}
function nvSettings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(NV.setTab);
  if (!sh || sh.getLastRow() < 2) return null;
  const r = sh.getRange(2, 1, 1, 6).getValues()[0];
  return {
    on: /^(có|co|1|true|bật|bat)$/i.test(String(r[0]).trim()),
    deadline: Math.min(31, Math.max(1, nvNum_(r[1]) || 25)),
    before: String(r[2]).split(/[,;\s]+/).filter(Boolean).map(Number).filter(n => !isNaN(n)),
    hour: Math.min(23, Math.max(0, nvNum_(r[3]) || 8)),
    cc: String(r[4] || '').trim()
  };
}
function nvContacts_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(NV.ctTab), m = {};
  if (!sh || sh.getLastRow() < 2) return m;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => {
    const e = String(r[1] || '').trim();
    if (r[0] && /@/.test(e)) m[nvKey_(r[0])] = e.split(/[,;\s]+/).filter(x => /@/.test(x)).join(',');
  });
  return m;
}
function nvLateUnits_(now) {
  const y = now.getFullYear(), mo = now.getMonth() + 1;
  const tab = 'Thang' + mo + (y === NV.y0 ? '' : '-' + y);
  const sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sh) throw new Error('Chưa có sheet ' + tab);
  const vals = sh.getDataRange().getValues();
  let hi = vals.findIndex(r => r.some(c => String(c).trim() === NV_COLS.name));
  if (hi < 0) throw new Error('Không thấy dòng tiêu đề "' + NV_COLS.name + '" trong ' + tab);
  const H = vals[hi].map(c => String(c).trim()), ix = k => H.indexOf(NV_COLS[k]);
  const out = [];
  vals.slice(hi + 1).forEach(r => {
    const name = String(r[ix('name')] || '').trim(); if (!name) return;
    const g = k => ix(k) < 0 ? 0 : nvNum_(r[ix(k)]);
    const due = Math.max(0, g('members') - g('exempt') - g('moved'));
    if (due <= 0) return;
    const noRecord = Math.max(0, g('unfiled') - g('exempt')), pending = g('pending'), approved = g('approved'), paid = g('paidCount');
    if (paid >= due) return;
    out.push({ name, due, paid, noRecord, pending, approved, rate: paid / due });
  });
  return out.sort((a, b) => (b.noRecord + b.pending + b.approved) - (a.noRecord + a.pending + a.approved));
}
function nvMail_(u, left, deadlineStr) {
  const when = left > 0 ? 'Còn ' + left + ' ngày đến hạn' : (left === 0 ? 'Hôm nay là hạn nộp' : 'Đã quá hạn ' + (-left) + ' ngày');
  const bits = [];
  if (u.noRecord) bits.push('<b>' + u.noRecord + '</b> đảng viên chưa có hồ sơ');
  if (u.pending) bits.push('<b>' + u.pending + '</b> hồ sơ chưa được duyệt');
  if (u.approved) bits.push('<b>' + u.approved + '</b> hồ sơ đã duyệt nhưng chưa nộp');
  const html = '<div style="font:14px/1.6 Arial,sans-serif;color:#1d2326">Kính gửi đồng chí Bí thư,<br><br>' +
    u.name + ' hiện còn: ' + bits.join('; ') + ' (tỷ lệ hoàn thành ' + (u.rate * 100).toFixed(1).replace('.', ',') + '%).<br>' +
    'Hạn nộp đảng phí: <b>' + deadlineStr + '</b> (' + when.toLowerCase() + ').<br><br>' +
    'Đề nghị đồng chí đôn đốc đảng viên hoàn thành đúng hạn.<br>Xem chi tiết: <a href="' + NV.site + '">' + NV.site + '</a><br><br>' +
    '<i style="color:#667">Thư tự động từ hệ thống theo dõi đảng phí – ' + NV.org + '.</i></div>';
  return { subject: '[Nhắc nộp đảng phí] ' + when + ' – ' + u.name, html };
}
function nvLog_(rows) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(NV.logTab);
  if (!sh) { sh = ss.insertSheet(NV.logTab); sh.appendRow(['Thời gian', 'Đơn vị', 'Người nhận', 'Kết quả']); }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}
/** Chạy mỗi ngày bởi bộ hẹn giờ. force=true: bỏ qua kiểm tra ngày nhắc. */
function nvRun(force) {
  const st = nvSettings_();
  if (!st || (!st.on && !force)) return 'Chưa bật nhắc việc';
  const now = new Date(), today = Number(Utilities.formatDate(now, NV.tz, 'd'));
  const left = st.deadline - today;
  if (!force && st.before.indexOf(left) < 0) return 'Hôm nay không phải ngày nhắc (còn ' + left + ' ngày)';
  const dl = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), st.deadline), NV.tz, 'dd/MM/yyyy');
  const ct = nvContacts_(), late = nvLateUnits_(now), logs = [], ts = Utilities.formatDate(now, NV.tz, 'dd/MM/yyyy HH:mm');
  let sent = 0, miss = 0;
  late.forEach(u => {
    const to = ct[nvKey_(u.name)];
    if (!to) { miss++; logs.push([ts, u.name, '', 'Chưa có email']); return; }
    if (MailApp.getRemainingDailyQuota() < 1) { logs.push([ts, u.name, to, 'Hết hạn mức gửi trong ngày']); return; }
    try {
      const m = nvMail_(u, left, dl);
      MailApp.sendEmail({ to, cc: st.cc || '', subject: m.subject, htmlBody: m.html, name: NV.org });
      sent++; logs.push([ts, u.name, to, 'Đã gửi']);
    } catch (e) { logs.push([ts, u.name, to, 'Lỗi: ' + e.message]); }
  });
  nvLog_(logs);
  return 'Đã gửi ' + sent + ' thư · ' + miss + ' đơn vị chưa có email · ' + late.length + ' đơn vị còn thiếu';
}
/** Gửi thử 1 thư (đơn vị thiếu nhiều nhất) về chính tài khoản đang chạy. */
function nvTest() {
  const now = new Date(), late = nvLateUnits_(now), st = nvSettings_() || { deadline: 25 };
  if (!late.length) return 'Không có đơn vị nào còn thiếu.';
  const left = st.deadline - Number(Utilities.formatDate(now, NV.tz, 'd'));
  const m = nvMail_(late[0], left, Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), st.deadline), NV.tz, 'dd/MM/yyyy'));
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: '[THỬ] ' + m.subject, htmlBody: m.html, name: NV.org });
  return 'Đã gửi thư thử tới ' + Session.getEffectiveUser().getEmail();
}
/** Chạy 1 lần: tạo bộ hẹn giờ hằng ngày theo "Giờ gửi" trong cài đặt. */
function nvSetup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'nvRun').forEach(t => ScriptApp.deleteTrigger(t));
  const st = nvSettings_() || { hour: 8 };
  ScriptApp.newTrigger('nvRun').timeBased().atHour(st.hour).nearMinute(0).everyDays(1).inTimezone(NV.tz).create();
  return 'Đã tạo bộ hẹn giờ lúc ' + st.hour + 'h mỗi ngày';
}
