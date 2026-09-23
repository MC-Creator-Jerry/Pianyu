// ============================================================
//  pianyu-site / functions/api/comments.js   —— 屿论（评论）
//  GET  /api/comments?videoId=xxx   -> list (public)
//  POST /api/comments               -> add  { videoId, name?, text }
// ============================================================

import { listComments, addComment } from '../_lib/store.js';
import { json } from '../_lib/auth.js';
import { getSession, getPrefs } from '../_lib/pyauth.js';

export async function onRequestGet({ request, env }) {
  const videoId = (new URL(request.url).searchParams.get('videoId') || '').trim();
  if (!videoId) return json({ ok: false, error: 'missing_videoId' }, 400);
  const comments = await listComments(env, videoId);
  return json({ ok: true, count: comments.length, comments });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const videoId = String(body.videoId || '').trim();
  const text = String(body.text || '').trim();
  if (!videoId || !text) return json({ ok: false, error: 'missing_fields' }, 400);
  if (text.length > 500) return json({ ok: false, error: 'too_long' }, 400);

  // 登录岛民：归属到小蓝页 sub（昵称取个人设置里的岛名）
  let sess = null;
  try {
    sess = await getSession({ request, env });
  } catch (e) {
    sess = null;
  }

  let name = String(body.name || '').trim().slice(0, 24);
  let sub = '';
  let avatar = '';
  let login = '';
  let isAdmin = false;

  if (sess) {
    const prefs = await getPrefs(env, sess.sub);
    name = String(prefs.display_name || sess.name || sess.login || '岛民').slice(0, 24);
    sub = String(sess.sub || '');
    avatar = sess.avatar_url || '';
    login = sess.login || '';
    isAdmin = !!sess.isAdmin;
  }
  if (!name) name = '匿名岛民';

  const comment = {
    id: 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    name,
    text,
    createdAt: Date.now(),
    // 身份字段（未登录留空，前端据此区分「登录岛民 / 匿名」）
    sub,
    login,
    avatar,
    isAdmin,
  };
  await addComment(env, videoId, comment);
  return json({ ok: true, comment }, 201);
}
