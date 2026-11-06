/**
 * GHI SỐ LIỆU MỖI NGÀY – phục vụ khối "Dự báo cuối tháng" của website.
 * Dán vào dự án Apps Script của xã (file mới, ví dụ DuBao.gs), rồi chạy hàm fcSetup() một lần (cấp quyền).
 * Mỗi ngày lúc 23h hàm fcSnapshot() chép số liệu của sheet tháng hiện tại vào tab "Lịch sử ngày":
 * Ngày | Đơn vị | Phải nộp | Đã nộp (đảng viên). Có thể chạy tay fcSnapshot() để ghi ngay hôm nay.
 */
const FC = { tab: 'Lịch sử ngày', tz: 'Asia/Ho_Chi_Minh', y0: 2026, hour: 23 };
const FC_COLS = { name: 'Tên đơn vị', members: 'Tổng sl đảng viên (1)', paidCount: 'Đã duyệt, đã nộp (8)',
  exempt: 'Số lượng được miễn giảm ĐP (5)', moved: 'Số lượng ĐV đã chuyển sinh hoạt đảng tạm thời (4)' };
function fcNum_(x) {
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  const t = String(x == null ? '' : x).trim().replace(/\s/g, '').replace('%', '');
  if (!t) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^-?\d+,\d+$/.test(t)) return Number(t.replace(',', '.')) || 0;
  return Number(t) || 0;
}
function fcSnapshot() {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth() + 1;
  const src = SpreadsheetApp.getActive().getSheetByName('Thang' + mo + (y === FC.y0 ? '' : '-' + y));
  if (!src) return 'Chưa có sheet tháng ' + mo;
  const vals = src.getDataRange().getValues();
  const hi = vals.findIndex(r => r.some(c => String(c).trim() === FC_COLS.name));
  if (hi < 0) return 'Không thấy dòng tiêu đề';
  const H = vals[hi].map(c => String(c).trim()), ix = k => H.indexOf(FC_COLS[k]);
  const day = Utilities.formatDate(now, FC.tz, 'yyyy-MM-dd'), rows = [];
  vals.slice(hi + 1).forEach(r => {
    const name = String(r[ix('name')] || '').trim(); if (!name) return;
    const g = k => ix(k) < 0 ? 0 : fcNum_(r[ix(k)]);
    const due = Math.max(0, g('members') - g('exempt') - g('moved'));
    if (due > 0) rows.push([day, name, due, g('paidCount')]);
  });
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(FC.tab);
  if (!sh) { sh = ss.insertSheet(FC.tab); sh.appendRow(['Ngày', 'Đơn vị', 'Phải nộp', 'Đã nộp']); sh.getRange('A:A').setNumberFormat('@'); }
  /* xóa dòng của hôm nay nếu đã ghi trước đó (chạy lại trong ngày) */
  const last = sh.getLastRow();
  if (last > 1) {
    const a = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = a.length - 1; i >= 0; i--) if (String(a[i][0]) === day) sh.deleteRow(i + 2);
  }
  if (rows.length) { const at = sh.getLastRow() + 1; sh.getRange(at, 1, rows.length, 1).setNumberFormat('@'); sh.getRange(at, 1, rows.length, 4).setValues(rows); }
  return 'Đã ghi ' + rows.length + ' đơn vị ngày ' + day;
}
function fcSetup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'fcSnapshot').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('fcSnapshot').timeBased().atHour(FC.hour).nearMinute(0).everyDays(1).inTimezone(FC.tz).create();
  return fcSnapshot();
}
