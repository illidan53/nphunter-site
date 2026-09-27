import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const sessionCookie = '__Host-nph-session';
const flowCookie = '__Host-nph-flow';
const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (statusCode, data, cookies = [], extra = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff', ...extra }, cookies, body: JSON.stringify(data) });
const redirect = (location, cookies = []) => reply(302, {}, cookies, { location });
const readCookies = event => Object.fromEntries((event.cookies || [event.headers?.cookie || '']).join(';').split(';').map(v => v.trim().split('=')));
export function validDay(day) { return /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day; }
export function viewer(headers) {
  const address = headers['cloudfront-viewer-address'] || '';
  const ip = address.startsWith('[') ? address.slice(1, address.indexOf(']')) : address.slice(0, address.lastIndexOf(':'));
  return { ip: isIP(ip) ? ip : 'unknown', country: /^[A-Z]{2}$/.test(headers['cloudfront-viewer-country'] || '') ? headers['cloudfront-viewer-country'] : 'unknown' };
}
// admins maps each provider to its administrator mailbox; configured at deploy time, none by default.
export function createApp({ store, oauth, origin, originSecret, admins = {}, now = () => Date.now(), retentionDays = 90 }) {
  const time = () => Math.floor(now() / 1000);
  const live = item => item && item.expiresAt > time();
  const dayNow = () => new Date(now()).toISOString().slice(0, 10);
  async function identity(event) {
    const raw = readCookies(event)[sessionCookie];
    if (!raw || !/^[\w-]{43}$/.test(raw)) return null;
    const session = await store.get(`SESSION#${hash(raw)}`);
    if (!live(session)) return null;
    return session.user;
  }
  const adminEmail = provider => String(admins[provider] || '').trim().toLowerCase();
  async function adminRole(user) {
    const admin = adminEmail(user.provider);
    if (!admin || user.email !== admin || !user.emailVerified) return 'user';
    const pk = `ADMIN#${user.provider}#${user.email}`;
    await store.put({ pk, sk: 'META', subject: user.subject }, true);
    return (await store.get(pk))?.subject === user.subject ? 'admin' : 'user';
  }
  return async event => {
    const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    event = { ...event, headers: h };
    if (!originSecret || !same(h['x-origin-verify'], originSecret)) return reply(403, { error: 'Forbidden' });
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;
    const q = event.queryStringParameters || {};
    const callback = path?.match(/^\/api\/auth\/(google|microsoft)\/callback$/);
    try {
      if (method === 'POST' && (h.origin !== origin || !h['content-type']?.startsWith('application/json'))) return reply(403, { error: 'Invalid origin or content type' });
      if (method === 'GET' && path === '/api/session') return reply(200, { user: await identity(event), providers: oauth.available() });
      const login = path?.match(/^\/api\/auth\/(google|microsoft)$/);
      if (method === 'GET' && login) {
        const provider = login[1];
        if (!oauth.available()[provider]) return redirect('/?authError=unavailable');
        const state = token(), browser = token(), verifier = token(), nonce = token();
        await store.put({ pk: `FLOW#${hash(state)}`, sk: 'META', provider, browser: hash(browser), verifier, nonce, expiresAt: time() + 600 });
        return redirect(await oauth.authorize(provider, { state, verifier, nonce }), [cookie(flowCookie, browser, 600)]);
      }
      if (method === 'GET' && callback) {
        const browser = readCookies(event)[flowCookie];
        if (!q.state || !browser) return redirect('/?authError=invalid');
        const pk = `FLOW#${hash(q.state)}`;
        const pending = await store.get(pk);
        if (!live(pending) || pending.provider !== callback[1] || !same(pending.browser, hash(browser))) return redirect('/?authError=invalid');
        const flow = await store.take(pk);
        if (!live(flow) || !q.code || q.error) return redirect('/?authError=invalid', [cookie(flowCookie, '', 0)]);
        const user = await oauth.exchange(flow.provider, q.code, flow);
        if (!user.subject || user.provider !== flow.provider) throw new Error('Invalid identity');
        user.role = await adminRole(user);
        const raw = token();
        await store.put({ pk: `SESSION#${hash(raw)}`, sk: 'META', user, expiresAt: time() + 86400 });
        return redirect('/', [cookie(sessionCookie, raw, 86400), cookie(flowCookie, '', 0)]);
      }
      if (method === 'POST' && path === '/api/logout') {
        const raw = readCookies(event)[sessionCookie];
        if (raw) await store.take(`SESSION#${hash(raw)}`);
        return reply(200, { ok: true }, [cookie(sessionCookie, '', 0)]);
      }
      if (method === 'POST' && path === '/api/visits') {
        if ((event.body || '').length > 4096) return reply(413, { error: 'Payload too large' });
        let body;
        try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid visit' });
        if (!/^[a-f0-9]{64}$/.test(body.signature || '') || !/^[\w-]{20,80}$/.test(body.eventId || '') || !['/', '/index.html', '/history.html'].includes(body.path)) return reply(400, { error: 'Invalid visit' });
        const user = await identity(event);
        const date = new Date(now()).toISOString();
        const item = { pk: `DAY#${date.slice(0, 10)}`, sk: `${date}#${body.eventId}`, time: date, ...viewer(h), signature: body.signature,
          visitorId: user ? hash(`${user.provider}:${user.subject}`) : body.signature, role: user?.role || 'guest', email: user?.email || null,
          path: body.path, browser: (h['user-agent'] || '').slice(0, 512), language: (h['accept-language'] || '').slice(0, 100),
          expiresAt: time() + retentionDays * 86400 };
        await store.put(item, true);
        return reply(202, { ok: true });
      }
      if (method === 'GET' && (path === '/api/history' || path === '/api/history/trend')) {
        const user = await identity(event);
        if (!user) return reply(401, { error: 'Sign in required' });
        if (user.role !== 'admin') return reply(403, { error: 'Administrator access required' });
        if (path === '/api/history') {
          const day = q.day || dayNow();
          if (!validDay(day) || (q.cursor && (q.cursor.length > 100 || !q.cursor.startsWith(`${day}T`)))) return reply(400, { error: 'Invalid day or cursor' });
          const page = await store.page(day, q.cursor);
          return reply(200, { records: page.items.filter(live).map(({ pk, sk, expiresAt, ...row }) => row), cursor: page.cursor });
        }
        const days = Number(q.days || 30);
        if (![7, 30, 90].includes(days)) return reply(400, { error: 'Invalid range' });
        // Bound each response; the client follows cursors before presenting complete totals.
        const start = new Date(`${dayNow()}T00:00:00Z`).getTime() - (days - 1) * 86400000;
        let day = q.day || new Date(start).toISOString().slice(0, 10);
        if (!validDay(day) || day < new Date(start).toISOString().slice(0, 10) || day > dayNow() || (q.cursor && (q.cursor.length > 100 || !q.cursor.startsWith(`${day}T`)))) return reply(400, { error: 'Invalid cursor' });
        const page = await store.page(day, q.cursor, 1000);
        const records = page.items.filter(live).map(({ visitorId, role }) => ({ visitorId, role }));
        const nextDay = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
        return reply(200, { day, records, next: page.cursor ? { day, cursor: page.cursor } : nextDay <= dayNow() ? { day: nextDay } : null });
      }
      return reply(404, { error: 'Not found' });
    } catch (error) {
      const safeReasons = ['Token exchange failed', 'Invalid nonce', 'Personal Microsoft account required', 'Profile lookup failed', 'Profile identity mismatch', 'Invalid identity'];
      console.error('Request failed', { path, name: error.name, reason: safeReasons.includes(error.message) ? error.message : undefined, code: /^OAUTH_[a-z_0-9]+$/.test(error.code || '') ? error.code : undefined }); // Never log tokens, emails or IPs.
      if (callback) return redirect('/?authError=failed', [cookie(flowCookie, '', 0)]);
      return reply(503, { error: 'Service temporarily unavailable' });
    }
  };
}
