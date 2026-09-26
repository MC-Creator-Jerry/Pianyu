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
//    promember:<sub> -> { until, bonus, plan, order, ref, grantedAt }
//                      （与已删除的 webhook 版同构，videos.js / me.js 无需改动）
//    兼容：旧键 vip:<sub> 首次读取时自动迁移到 promember:<sub>（见 readProMemberRaw）
// ============================================================

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I/O/0/1，共 32 个字符
const CODE_LEN = 8;
const CODE_PREFIX = 'pycode:';
const LIST_KEY = 'pycodes:list';
const MAX_LIST = 500;

export const PRO_MEMBER_DAYS = 31;
export const PRO_MEMBER_BONUS = 10;
const SPAN_MS = PRO_MEMBER_DAYS * 24 * 3600 * 1000;

// 付费成员（pro-member）记录键；旧键 vip:<sub> 仅用于兼容迁移，不再新写。
const MEMBER_KEY = (sub) => 'promember:' + sub;
const LEGACY_KEY = (sub) => 'vip:' + sub;
async function readProMemberRaw(kv, sub) {
  const raw = await kv.get(MEMBER_KEY(sub));
  if (raw) return raw;
  const legacy = await kv.get(LEGACY_KEY(sub)); // 兼容旧数据
  if (legacy) {
    try { await kv.put(MEMBER_KEY(sub), legacy); } catch (e) { /* 迁移失败忽略 */ }
    return legacy;
  }
  return null;
}
function writeProMemberRaw(kv, sub, obj) {
  return kv.put(MEMBER_KEY(sub), JSON.stringify(obj));
}
export async function getProMember(kv, sub) {
  const raw = await readProMemberRaw(kv, sub);
  const o = safeJSON(raw, null);
  if (!o || !o.until || o.until <= Date.now()) return null;
  return { active: true, until: o.until, bonus: Number(o.bonus) || PRO_MEMBER_BONUS, plan: o.plan || '', order: o.order || '' };
}

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
  const cur = safeJSON(await readProMemberRaw(kv, sub), null);
  const base = cur && cur.until && cur.until > now ? cur.until : now;
  const next = {
    until: base + SPAN_MS,
    bonus: PRO_MEMBER_BONUS,
    plan: 'afdian-code',
    order: code, // 与旧 webhook 版字段对齐，me.js 会读它
    ref: code,
    grantedAt: now,
  };
  await writeProMemberRaw(kv, sub, next);

  await kv.put(
    CODE_PREFIX + code,
    JSON.stringify({ code, createdAt: rec.createdAt || now, usedBy: sub, usedAt: now })
  );
  return { ok: true, promember: next };
}

/* ---------------- 爱发电 Webhook 支持 ---------------- */
//
// 片屿的「发布功能升级」（promember:<sub>）走两种开通方式：
//   1) 一次性兑换码（redeemCode，上一段）—— 不依赖 webhook；
//   2) 爱发电 Webhook —— 由小蓝页中枢在确认捆绑包订单后 fan-out 到这里，
//      或（若未来爱发电 webhook 改指向片屿）直接收到推送。
// 两种方式的发放记录都写在 promember:<sub>，等价、可顺延。
//
// 片屿只认自己的套餐 + 捆绑包；其它站的套餐（小蓝页/茶馆/书栈）一律不发放，
// 避免一笔订单被多个站点重复误发。
export const PY_PLAN_IDS = {
  pianyu: '8ffb1aa0b87711f1b03952540025c377', // 片屿·发布功能升级
  bundle: '518675d8b93711f1a49352540025c377', // 茶馆·片屿·书栈 捆绑包 ¥38/月（含片屿权益）
};

// 返回命中的档位标识 'pianyu' | 'bundle'，认不出返回 null。
export function orderMatchesPianyuPlan(order) {
  if (!order) return null;
  const pid = order.plan_id ? String(order.plan_id).trim() : '';
  if (pid === PY_PLAN_IDS.bundle) return 'bundle';
  if (pid === PY_PLAN_IDS.pianyu) return 'pianyu';
  return null; // 其它站套餐 / 未知套餐：片屿不发放
}

// 直接发放 / 顺延 promember:<sub>（与兑换码路径共用同一份记录）。
export async function grantProMember(env, sub, months, plan, ref) {
  const kv = env.PIANYU_KV;
  if (!sub) return null;
  const n = Math.max(1, Math.min(36, parseInt(months, 10) || 1));
  const cur = safeJSON(await readProMemberRaw(kv, sub), null);
  const now = Date.now();
  const base = cur && cur.until && cur.until > now ? cur.until : now;
  const next = {
    until: base + SPAN_MS * n,
    bonus: PRO_MEMBER_BONUS,
    plan: plan || (cur && cur.plan) || 'afdian-webhook',
    order: ref || (cur && cur.order) || '',
    ref: ref || '',
    grantedAt: now,
  };
  await writeProMemberRaw(kv, sub, next);
  return next;
}

// 幂等：同一笔订单只处理一次（官方明确说可能重复推送）
const ORDER_PREFIX = 'afdian:order:';
const PENDING_PREFIX = 'afdian:pending:';

export async function isOrderProcessed(env, outTradeNo) {
  const raw = await env.PIANYU_KV.get(ORDER_PREFIX + outTradeNo).catch(() => null);
  return safeJSON(raw, null);
}

export async function markOrderProcessed(env, outTradeNo, sub, months, plan) {
  await env.PIANYU_KV.put(
    ORDER_PREFIX + outTradeNo,
    JSON.stringify({ out_trade_no: outTradeNo, sub: sub || '', plan: plan || '', months: months || 1, ts: Date.now() })
  );
}

// 认领不到 sub 的订单（比如留言没写用户名 / 该用户名从未登录片屿）先挂起，等管理员手动绑定
export async function addPending(env, order) {
  const no = String((order && order.out_trade_no) || '');
  if (!no) return null;

  const MAX_PENDING = 100;
  try {
    const listed = await env.PIANYU_KV.list({ prefix: PENDING_PREFIX });
    const keys = (listed.keys || []).map((k) => k.name);
    if (keys.length >= MAX_PENDING) {
      const rows = [];
      for (const k of keys) {
        const r = safeJSON(await env.PIANYU_KV.get(k).catch(() => null), null);
        if (r) rows.push({ k, ts: r.ts || 0 });
      }
      rows.sort((a, b) => a.ts - b.ts);
      const drop = rows.slice(0, Math.max(1, keys.length - MAX_PENDING + 1));
      for (const d of drop) await env.PIANYU_KV.delete(d.k).catch(() => {});
    }
  } catch (e) { /* list 不可用时跳过淘汰 */ }

  const rec = {
    out_trade_no: no,
    user_id: order.user_id || '',
    plan_id: order.plan_id || '',
    amount: order.total_amount || order.show_amount || '',
    month: order.month || 1,
    status: order.status,
    remark: String(order.remark || '').slice(0, 200),
    ts: Date.now(),
  };
  await env.PIANYU_KV.put(PENDING_PREFIX + no, JSON.stringify(rec));
  return rec;
}

export async function listPending(env) {
  const out = [];
  try {
    const listed = await env.PIANYU_KV.list({ prefix: PENDING_PREFIX });
    for (const k of listed.keys || []) {
      const rec = safeJSON(await env.PIANYU_KV.get(k.name).catch(() => null), null);
      if (rec) out.push(rec);
    }
  } catch (e) { /* list 不可用时忽略 */ }
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}
