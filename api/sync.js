// Recall sync: progress saved under a short code, so it can be loaded on another device. No accounts, no emails.
// Storage is Upstash Redis over its REST API (add it in Vercel: Storage > Upstash for Redis > connect to this project).
//   GET  /api/sync?code=ABCD-EFGH        -> { data, at }        load
//   POST /api/sync { data }              -> { code, at }        first save: makes a new code
//   POST /api/sync { code, data }        -> { at }              later saves (the code must already exist)
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ALPHA = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // no 0/O, 1/I/L or U, so codes are easy to read out and type
const MAX_BYTES = 900 * 1024; // Upstash's free plan takes requests up to 1 MB
const TTL = 60 * 60 * 24 * 400; // a code unused for about 13 months is dropped; every save resets the clock
const PER_MIN = 120; // requests per minute per address (a whole club on one wifi stays well under it)

async function redis(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'storage error ' + r.status);
  return j.result;
}
const cleanCode = c => {
  const s = String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return s.length === 8 && [...s].every(ch => ALPHA.includes(ch)) ? s : null;
};
const newCode = () => Array.from({ length: 8 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const show = c => c.slice(0, 4) + '-' + c.slice(4);

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!raw) { const parts = []; for await (const ch of req) parts.push(ch); raw = Buffer.concat(parts).toString('utf8'); }
  if (Buffer.byteLength(raw) > MAX_BYTES) { const e = new Error('Progress is too large to sync'); e.status = 413; throw e; }
  try { return JSON.parse(raw || '{}'); } catch (e) { const x = new Error('Bad request'); x.status = 400; throw x; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  if (!URL_ || !TOKEN) return send(503, { error: 'Sync is not set up on this site yet' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
    const rk = 'recall:rl:' + ip + ':' + Math.floor(Date.now() / 60000);
    const n = await redis('INCR', rk);
    if (n === 1) await redis('EXPIRE', rk, 70);
    if (n > PER_MIN) return send(429, { error: 'Too many sync requests, try again in a minute' });

    if (req.method === 'GET') {
      const q = new URL(req.url, 'http://x').searchParams, code = cleanCode(q.get('code'));
      if (!code) return send(400, { error: 'That is not a sync code' });
      const v = await redis('GET', 'recall:sync:' + code);
      if (!v) return send(404, { error: 'No progress is saved under that code' });
      await redis('EXPIRE', 'recall:sync:' + code, TTL);
      return send(200, JSON.parse(v));
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!b.data || typeof b.data !== 'object' || b.data.app !== 'alg-trainer') return send(400, { error: 'Bad request' });
      const at = Date.now(), val = JSON.stringify({ data: b.data, at });
      if (Buffer.byteLength(val) > MAX_BYTES) return send(413, { error: 'Progress is too large to sync' });
      if (b.code == null) {
        for (let i = 0; i < 5; i++) { // a clash is very unlikely; try again if it happens
          const code = newCode();
          if (await redis('SET', 'recall:sync:' + code, val, 'EX', TTL, 'NX')) return send(200, { code: show(code), at });
        }
        return send(500, { error: 'Could not make a code, try again' });
      }
      const code = cleanCode(b.code);
      if (!code) return send(400, { error: 'That is not a sync code' });
      const ok = await redis('SET', 'recall:sync:' + code, val, 'EX', TTL, 'XX');
      if (!ok) return send(404, { error: 'No progress is saved under that code' });
      return send(200, { at });
    }
    res.setHeader('Allow', 'GET, POST');
    return send(405, { error: 'Method not allowed' });
  } catch (e) {
    return send(e.status || 500, { error: e.status ? e.message : 'Sync failed on the server' });
  }
};
