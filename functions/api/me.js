// ============================================================
//  pianyu-site / functions/api/me.js   —— 当前岛民
//  GET /api/me  -> { ok, user }  (未登录 user = null)
// ============================================================

import { getSession, getPrefs, publicProfile } from '../_lib/pyauth.js';
import { json } from '../_lib/auth.js';
import { getProMember } from '../_lib/pycode.js';

export async function onRequestGet(context) {
  let sess = null;
  try {
    sess = await getSession(context);
  } catch (e) {
    sess = null;
  }
  if (!sess) return json({ ok: true, user: null });

  const prefs = await getPrefs(context.env.PIANYU_KV, sess.sub);
  const user = publicProfile(sess, prefs);

  // 升级状态（爱发电「发布功能升级」）：promember:<sub> 有效则附带（含旧 vip:<sub> 迁移）
  const promember = await getProMember(context.env.PIANYU_KV, sess.sub);
  user.promember = promember;

  return json({ ok: true, user });
}
