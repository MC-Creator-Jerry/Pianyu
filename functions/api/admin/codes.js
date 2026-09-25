// ============================================================
//  pianyu-site / functions/api/admin/codes.js   —— 兑换码管理（仅站长）
//  GET  /api/admin/codes        -> { ok, codes:[{code,used,usedBy,usedAt,createdAt}] }
//  POST /api/admin/codes {count}-> { ok, codes:[新增的码] }   生成一批新码
//  DELETE /api/admin/codes      -> { ok, removed }           清空码清单（慎用）
//
//  站长判定走 SSO 档案的 isAdmin（与 actor.js 一致），
//  不信任 /api/admin/login 的共享 cookie（那个接口是开放的）。
// ============================================================

import { getSession } from '../../_lib/pyauth.js';
import { json } from '../../_lib/auth.js';
import { generateCodes, listCodes } from '../../_lib/pycode.js';

async function requireOwner(context) {
  const sess = await getSession(context);
  if (!sess || !sess.sub) return { err: json({ ok: false, error: 'not_logged_in' }, 401) };
  if (!sess.isAdmin) return { err: json({ ok: false, error: 'forbidden' }, 403) };
  return { sess };
}

export async function onRequestGet(context) {
  const g = await requireOwner(context);
  if (g.err) return g.err;
  const codes = await listCodes(context.env);
  return json({
    ok: true,
    count: codes.length,
    unused: codes.filter((c) => !c.used).length,
    codes: codes.slice(0, 500),
  });
}

export async function onRequestPost(context) {
  const g = await requireOwner(context);
  if (g.err) return g.err;

  let body = {};
  try {
    body = (await context.request.json()) || {};
  } catch (e) {
    body = {};
  }

  const made = await generateCodes(context.env, body.count);
  return json({ ok: true, codes: made });
}

export async function onRequestDelete(context) {
  const g = await requireOwner(context);
  if (g.err) return g.err;

  const kv = context.env.PIANYU_KV;
  const codes = await listCodes(context.env);
  let removed = 0;
  for (const c of codes) {
    // 已用过的码保留记录，只清未使用的，避免误删兑换凭据
    if (c.used) continue;
    await kv.delete('pycode:' + c.code).catch(() => {});
    removed++;
  }
  const kept = codes.filter((c) => c.used).map((c) => c.code);
  await kv.put('pycodes:list', JSON.stringify(kept.slice(-500)));
  return json({ ok: true, removed, kept: kept.length });
}

export async function onRequest(context) {
  const m = context.request.method;
  if (m === 'GET') return onRequestGet(context);
  if (m === 'POST') return onRequestPost(context);
  if (m === 'DELETE') return onRequestDelete(context);
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
