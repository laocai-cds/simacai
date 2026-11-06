// Đếm "Đang online" và "Tổng truy cập" bằng Cloudflare D1 (binding: DB).
// POST /api/stats  {sid, hit}  -> ghi nhịp online của phiên, hit=true thì cộng 1 lượt truy cập
// GET  /api/stats              -> chỉ đọc số liệu
const ONLINE_WINDOW = 90; // giây: coi là đang online nếu có nhịp trong 90 giây gần nhất
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
  });

async function read(db, now) {
  const [o, v] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM presence WHERE ts > ?').bind(now - ONLINE_WINDOW),
    db.prepare("SELECT n FROM counters WHERE name = 'visits'"),
  ]);
  return { online: Math.max(1, (o.results[0] && o.results[0].n) || 0), total: (v.results[0] && v.results[0].n) || 0 };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.DB) return json({ ok: false, error: 'no-db' }, 500);
  const now = Math.floor(Date.now() / 1000);
  try {
    if (request.method === 'POST') {
      let b = {};
      try { b = await request.json(); } catch (_) {}
      const sid = String(b.sid || '');
      if (!/^[a-z0-9]{6,40}$/i.test(sid)) return json({ ok: false, error: 'bad-sid' }, 400);
      const stmts = [
        env.DB.prepare('INSERT INTO presence(sid, ts) VALUES(?, ?) ON CONFLICT(sid) DO UPDATE SET ts = excluded.ts').bind(sid, now),
      ];
      if (b.hit === true) {
        stmts.push(env.DB.prepare("UPDATE counters SET n = n + 1 WHERE name = 'visits'"));
      }
      if (Math.random() < 0.05) {
        stmts.push(env.DB.prepare('DELETE FROM presence WHERE ts < ?').bind(now - 600));
      }
      await env.DB.batch(stmts);
    } else if (request.method !== 'GET') {
      return json({ ok: false, error: 'method' }, 405);
    }
    return json({ ok: true, ...(await read(env.DB, now)) });
  } catch (e) {
    return json({ ok: false, error: 'db-error' }, 500);
  }
}
