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
  const user = publicProfile(sess, prefs);

  // 升级状态（爱发电「发布功能升级」）：vip:<sub> 有效则附带
  let vip = null;
  try {
    const vipRaw = await context.env.PIANYU_KV.get('vip:' + sess.sub);
    if (vipRaw) {
      const v = JSON.parse(vipRaw);
      if (v && v.until && v.until > Date.now()) {
        vip = {
          active: true,
          until: v.until,
          bonus: Number(v.bonus) || 10,
          plan: v.plan || '',
          order: v.order || '',
        };
      }
    }
  } catch (e) {
    /* 损坏数据忽略 */
  }
  user.vip = vip;

  return json({ ok: true, user });
}
