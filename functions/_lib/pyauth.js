// ============================================================
//  pianyu-site / functions/_lib/pyauth.js
//  岛民会话库（PIANYU_KV）· 身份来源＝小蓝页 SSO
//
//  与后台管理员会话（auth.js 的 pianyu_sid）完全隔离：
//    管理员 = pianyu_sid   （密钥登录，见 /api/admin/*）
//    岛民   = pianyu_uid   （小蓝页 SSO 登录，见 /api/sso/*）
//
//  为什么各存各的会话：pages.dev 在公共后缀名单里，
//  jerrypianyu.pages.dev 与小蓝页属于不同站点，Cookie 无法跨子域共享，
//  只能「小蓝页签一次性 code → 片屿服务端换码 → 在片屿域下种自己的会话」。
//
//  KV 键：
//    usess:<sid>        -> JSON 岛民会话档案（30 天）
//    sso:state:<state>  -> JSON { ts, next }  一次性 state（10 分钟，防 CSRF）
//    users:index        -> JSON 岛民目录（昵称 / 头像）
//    prefs:<sub>        -> JSON 个人设置
// ============================================================

export const COOKIE = 'pianyu_uid';
export const SSO_COOKIE = 'pianyu_sso';

export const IDP = 'https://mc-creator-jerry-webpage.pages.dev';
export const CLIENT_ID = 'pianyu';
export const REDIRECT_URI = 'https://jerrypianyu.pages.dev/api/sso/callback';

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 天

/* ---------------- cookies ---------------- */

export function getCookie(req, name) {
  const h = req.headers.get('cookie');
  if (!h) return null;
  const m = h
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

export function randomId(bytes) {
  const n = bytes || 24;
  const a = new Uint8Array(n);
  (globalThis.crypto || crypto).getRandomValues(a);
  let s = '';
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, '0');
  return s;
}

export function sessionCookie(sid, maxAge) {
  return COOKIE + '=' + sid + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}

export function clearSessionCookie() {
  return COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function ssoStateCookie(state, maxAge) {
  return SSO_COOKIE + '=' + state + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}

export function clearSsoStateCookie() {
  return SSO_COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/* ---------------- session ---------------- */

// profile: { sub, login, name, avatar_url, isAdmin, provider }
export async function createSession(kv, profile) {
  const sid = randomId(24);
  const rec = Object.assign({ ts: Date.now() }, profile);
  await kv.put('usess:' + sid, JSON.stringify(rec), { expirationTtl: SESSION_TTL });
  return sid;
}

export async function getSession(context) {
  const kv = context.env.PIANYU_KV;
  if (!kv) return null;
  const sid = getCookie(context.request, COOKIE);
  if (!sid) return null;
  let raw = null;
  try {
    raw = await kv.get('usess:' + sid);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function destroySession(context) {
  const kv = context.env.PIANYU_KV;
  const sid = getCookie(context.request, COOKIE);
  if (kv && sid) {
    try {
      await kv.delete('usess:' + sid);
    } catch (e) {
      /* 忽略 */
    }
  }
}

// 给前端用的公开档案
export function publicProfile(sess, prefs) {
  if (!sess) return null;
  const p = prefs || {};
  return {
    sub: sess.sub || null,
    login: sess.login || '',
    name: p.display_name || sess.name || sess.login || '岛民',
    avatar_url: sess.avatar_url || '',
    bio: p.bio || '',
    isAdmin: !!sess.isAdmin,
    provider: sess.provider || 'xiaolan',
  };
}

/* ---------------- 岛民目录 ---------------- */

export async function upsertUser(kv, u) {
  if (!kv || !u || !u.login) return;
  try {
    const raw = await kv.get('users:index');
    let idx = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(idx)) idx = [];
    const i = idx.findIndex((x) => x && x.login === u.login);
    const prev = i >= 0 ? idx[i] : {};
    const rec = {
      login: u.login,
      name: u.name || prev.name || u.login,
      avatar: u.avatar || prev.avatar || '',
    };
    if (i >= 0) idx[i] = Object.assign({}, prev, rec);
    else idx.unshift(rec);
    if (idx.length > 500) idx.length = 500;
    await kv.put('users:index', JSON.stringify(idx));
  } catch (e) {
    /* 目录失败不影响登录 */
  }
}

/* ---------------- 个人设置 ---------------- */

export async function getPrefs(kv, sub) {
  if (!kv || !sub) return {};
  try {
    const raw = await kv.get('prefs:' + sub);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function savePrefs(kv, sub, patch) {
  const cur = await getPrefs(kv, sub);
  const next = Object.assign({}, cur, patch || {});
  next.updatedAt = Date.now();
  await kv.put('prefs:' + sub, JSON.stringify(next));
  return next;
}

/* ---------------- 我的足迹 ---------------- */

// 扫描全部 comments:* / danmaku:* 找出该 sub 的发言（KV list 分页）
export async function listMyActivity(env, sub, limit) {
  const cap = limit || 100;
  const out = { comments: [], danmaku: [] };
  if (!env.PIANYU_KV || !sub) return out;

  // 视频标题映射，便于前端显示
  let titles = {};
  try {
    const raw = await env.PIANYU_KV.get('videos', { type: 'json' });
    if (Array.isArray(raw)) {
      raw.forEach((v) => {
        if (v && v.id) titles[v.id] = v.title || v.id;
      });
    }
  } catch (e) {
    titles = {};
  }

  async function scan(prefix, bucket) {
    let cursor = undefined;
    let scanned = 0;
    while (scanned < 20) {
      let page;
      try {
        page = await env.PIANYU_KV.list({ prefix: prefix, cursor: cursor, limit: 1000 });
      } catch (e) {
        break;
      }
      for (const k of page.keys) {
        let arr = null;
        try {
          arr = await env.PIANYU_KV.get(k.name, { type: 'json' });
        } catch (e) {
          arr = null;
        }
        if (!Array.isArray(arr)) continue;
        const videoId = k.name.slice(prefix.length);
        arr.forEach((it) => {
          if (it && it.sub && String(it.sub) === String(sub)) {
            bucket.push({
              id: it.id,
              videoId: videoId,
              videoTitle: titles[videoId] || videoId,
              text: it.text,
              time: it.time,
              createdAt: it.createdAt,
            });
          }
        });
      }
      scanned += 1;
      if (page.list_complete) break;
      cursor = page.cursor;
    }
    bucket.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (bucket.length > cap) bucket.length = cap;
  }

  await scan('comments:', out.comments);
  await scan('danmaku:', out.danmaku);
  return out;
}
