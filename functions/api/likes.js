// ============================================================
//  pianyu-site / functions/api/likes.js   —— 点赞（赞）
//  GET  /api/likes?videoId=xxx   -> { count, liked }（liked 按会话判定）
//  POST /api/likes               -> { videoId } 切换当前用户点赞（需登录）
// ============================================================

import { getLikes, toggleLike } from '../_lib/store.js';
import { json } from '../_lib/auth.js';
import { getSession } from '../_lib/pyauth.js';

export async function onRequestGet({ request, env }) {
  const videoId = (new URL(request.url).searchParams.get('videoId') || '').trim();
  if (!videoId) return json({ ok: false, error: 'missing_videoId' }, 400);
  const obj = await getLikes(env, videoId);
  let sess = null;
  try { sess = await getSession({ request, env }); } catch (e) { sess = null; }
  const liked = sess ? obj.users.includes(String(sess.sub)) : false;
  return json({ ok: true, count: obj.users.length, liked });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const videoId = String(body.videoId || '').trim();
  if (!videoId) return json({ ok: false, error: 'missing_videoId' }, 400);

  let sess = null;
  try { sess = await getSession({ request, env }); } catch (e) { sess = null; }
  if (!sess) return json({ ok: false, error: 'login_required' }, 401);

  const r = await toggleLike(env, videoId, String(sess.sub));
  return json({ ok: true, liked: r.liked, count: r.count });
}
