// ============================================================
//  pianyu-site / functions/_lib/pycode.js
//  「发布功能升级」一次性兑换码
//
//  为什么走兑换码、而不是 webhook：
//    爱发电一个创作者账号只能配【一个】webhook 通知地址，而那个坑
//    已经被小蓝页（赞助 / 茶馆加成）占用了。改指向片屿会让小蓝页的自动
//    开通立刻失效，所以片屿改走兑换码：
//      创作者在爱发电「赞助奖励」里预填一批码并开启自动随机回复，
//      赞助者付款后立刻收到一条码，回片屿贴上即开通；续费再兑一次即顺延。
//    码是一次性的 = 天然防重放，且不依赖任何 webhook / 开发者 API 权限。
//
//  KV 键（PIANYU_KV）：
//    pycode:<CODE>  -> { code, createdAt, usedBy, usedAt }
//    pycodes:list   -> JSON 数组，本批生成的码（后台查看/导出，上限 500）
//    vip:<sub>      -> { until, bonus, plan, order, ref, grantedAt }
//                      （与已删除的 webhook 版同构，videos.js / me.js 无需改动）
// ============================================================

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I/O/0/1，共 32 个字符
const CODE_LEN = 8;
const CODE_PREFIX = 'pycode:';
const LIST_KEY = 'pycodes:list';
const MAX_LIST = 500;

export const VIP_DAYS = 31;
export const VIP_BONUS = 10;
const SPAN_MS = VIP_DAYS * 24 * 3600 * 1000;

// 32 能整除 256，所以 byte % 32 是均匀的，不引入偏差
function randCode() {
  const buf = new Uint8Array(CODE_LEN);
  (globalThis.crypto || crypto).getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export function normalizeCode(raw) {
  return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatCode(code) {
  const c = normalizeCode(code);
  return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c;
}

function safeJSON(raw, fallback) {
  if (raw == null) return fallback;
  try {
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

/* ---------------- 生成（仅站长） ---------------- */

export async function generateCodes(env, count) {
  const kv = env.PIANYU_KV;
  const n = Math.max(1, Math.min(100, parseInt(count, 10) || 20));
  const list = safeJSON(await kv.get(LIST_KEY), []);
  const known = new Set(Array.isArray(list) ? list : []);
  const made = [];
  const now = Date.now();

  for (let i = 0; i < n; i++) {
    let code = randCode();
    let guard = 0;
    // 极小概率撞码，重试几次即可
    while ((known.has(code) || (await kv.get(CODE_PREFIX + code))) && guard++ < 20) {
      code = randCode();
    }
    await kv.put(
      CODE_PREFIX + code,
      JSON.stringify({ code, createdAt: now, usedBy: '', usedAt: 0 })
    );
    known.add(code);
    made.push(code);
  }

  await kv.put(LIST_KEY, JSON.stringify(Array.from(known).slice(-MAX_LIST)));
  return made;
}

/* ---------------- 列表（仅站长） ---------------- */

export async function listCodes(env) {
  const kv = env.PIANYU_KV;
  const list = safeJSON(await kv.get(LIST_KEY), []);
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const code of list) {
    const rec = safeJSON(await kv.get(CODE_PREFIX + code), null);
    out.push({
      code,
      createdAt: (rec && rec.createdAt) || 0,
      usedBy: (rec && rec.usedBy) || '',
      usedAt: (rec && rec.usedAt) || 0,
      used: !!(rec && rec.usedBy),
    });
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

/* ---------------- 兑换 ---------------- */

export async function redeemCode(env, rawCode, sub) {
  const kv = env.PIANYU_KV;
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: 'empty' };
  if (!sub) return { ok: false, reason: 'not_logged_in' };

  const rec = safeJSON(await kv.get(CODE_PREFIX + code), null);
  if (!rec) return { ok: false, reason: 'notfound' };
  if (rec.usedBy) return { ok: false, reason: 'used' };

  // 发放 / 顺延：未过期就在原到期时间上叠加，已过期则从现在起算
  const now = Date.now();
  const cur = safeJSON(await kv.get('vip:' + sub), null);
  const base = cur && cur.until && cur.until > now ? cur.until : now;
  const next = {
    until: base + SPAN_MS,
    bonus: VIP_BONUS,
    plan: 'afdian-code',
    order: code, // 与旧 webhook 版字段对齐，me.js 会读它
    ref: code,
    grantedAt: now,
  };
  await kv.put('vip:' + sub, JSON.stringify(next));

  await kv.put(
    CODE_PREFIX + code,
    JSON.stringify({ code, createdAt: rec.createdAt || now, usedBy: sub, usedAt: now })
  );
  return { ok: true, vip: next };
}
