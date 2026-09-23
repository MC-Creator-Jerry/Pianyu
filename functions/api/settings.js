// ============================================================
//  pianyu-site / functions/api/settings.js   —— 个人设置
//  GET  /api/settings   -> { ok, settings }
//  POST /api/settings   -> { display_name?, bio? }  需要登录
//
//  头像与身份来自小蓝页 SSO，片屿只允许改「岛名」与「签名」。
// ============================================================

import { getSession, getPrefs, savePrefs, publicProfile } from '../_lib/pyauth.js';
import { json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const sess = await getSession(context);
  if (!sess) return json({ ok: false, error: 'not_logged_in' }, 401);
  const prefs = await getPrefs(context.env.PIANYU_KV, sess.sub);
  return json({ ok: true, settings: prefs, user: publicProfile(sess, prefs) });
}

export async function onRequestPost(context) {
  const sess = await getSession(context);
  if (!sess) return json({ ok: false, error: 'not_logged_in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const patch = {};
  if (typeof body.display_name === 'string') {
    const v = body.display_name.trim().slice(0, 24);
    patch.display_name = v;
  }
  if (typeof body.bio === 'string') {
    const v = body.bio.trim().slice(0, 120);
    patch.bio = v;
  }

  const settings = await savePrefs(context.env.PIANYU_KV, sess.sub, patch);
  return json({ ok: true, settings: settings, user: publicProfile(sess, settings) });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
