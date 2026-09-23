// ============================================================
//  pianyu-site / functions/api/profile.js   —— 岛民个人主页数据
//  GET /api/profile            -> 当前登录岛民
//  GET /api/profile?sub=xxx    -> 指定岛民（公开信息）
//
//  返回 { ok, user, activity: { comments, danmaku }, stats }
// ============================================================

import { getSession, getPrefs, publicProfile, listMyActivity } from '../_lib/pyauth.js';
import { json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const wantSub = (url.searchParams.get('sub') || '').trim();

  const sess = await getSession(context);
  const target = wantSub || (sess ? sess.sub : '');

  if (!target) return json({ ok: false, error: 'not_logged_in' }, 401);

  // 只允许查看自己（片屿目前不做他人主页，避免暴露他人足迹）
  if (!sess || String(sess.sub) !== String(target)) {
    return json({ ok: false, error: 'not_allowed' }, 403);
  }

  const prefs = await getPrefs(context.env.PIANYU_KV, sess.sub);
  const user = publicProfile(sess, prefs);
  const activity = await listMyActivity(context.env, sess.sub, 100);

  return json({
    ok: true,
    user: user,
    activity: activity,
    stats: {
      comments: activity.comments.length,
      danmaku: activity.danmaku.length,
      total: activity.comments.length + activity.danmaku.length,
    },
  });
}
