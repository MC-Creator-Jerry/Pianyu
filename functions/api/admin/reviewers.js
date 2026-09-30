// ============================================================
//  pianyu-site / functions/api/admin/reviewers.js —— 审核员管理（仅站长/管理员）
//  GET  /api/admin/reviewers -> { ok, reviewers:[login,...] }
//  POST /api/admin/reviewers -> { action:'addReviewer'|'removeReviewer', login }
//  审核员基于小蓝页 SSO 登录名（reviewer:list）；审核员可进举报处理台，
//  但不能管理兑换码、也不能增删其他审核员（仅站长/管理员可）。
// ============================================================

import { json, parseCookie, COOKIE as ADMIN_COOKIE } from '../../_lib/auth.js';
import { getSession } from '../../_lib/pyauth.js';
import { getSession as getAdminSession } from '../../_lib/store.js';

async function isAdminOnly(request, env) {
  const sso = await getSession({ request, env });
  if (sso && sso.isAdmin) return true;
  const sid = parseCookie(request.headers.get('Cookie') || '', ADMIN_COOKIE);
  const admin = sid ? await getAdminSession(env, sid) : null;
  return !!admin;
}

async function readReviewers(env) {
  const raw = await env.PIANYU_KV.get('reviewer:list');
  let list = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(list)) list = [];
  return list.filter((x) => typeof x === 'string' && x);
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdminOnly(request, env))) return json({ ok: false, error: 'forbidden' }, 403);
  return json({ ok: true, reviewers: await readReviewers(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdminOnly(request, env))) return json({ ok: false, error: 'forbidden' }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const action = String(body.action || '');
  const login = String(body.login || '').trim();
  if (!login) return json({ ok: false, error: 'bad_params' }, 400);
  let list = await readReviewers(env);
  if (action === 'addReviewer') {
    if (!list.includes(login)) list.push(login);
  } else if (action === 'removeReviewer') {
    list = list.filter((x) => x !== login);
  } else {
    return json({ ok: false, error: 'unknown_action' }, 400);
  }
  await env.PIANYU_KV.put('reviewer:list', JSON.stringify(list));
  return json({ ok: true, reviewers: list });
}
