// ============================================================
//  pianyu-site / functions/api/me.js   —— 当前岛民
//  GET /api/me  -> { ok, user }  (未登录 user = null)
// ============================================================

import { getSession, getPrefs, publicProfile } from '../_lib/pyauth.js';
import { json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  let sess = null;
  try {
    sess = await getSession(context);
  } catch (e) {
    sess = null;
  }
  if (!sess) return json({ ok: true, user: null });

  const prefs = await getPrefs(context.env.PIANYU_KV, sess.sub);
  return json({ ok: true, user: publicProfile(sess, prefs) });
}
