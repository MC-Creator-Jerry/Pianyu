// ============================================================
//  pianyu-site / functions/api/comments.js   —— 屿论（评论）
//  GET  /api/comments?videoId=xxx   -> list (public)
//  POST /api/comments               -> add  { videoId, name?, text }
// ============================================================

import { listComments, addComment } from '../_lib/store.js';
import { json } from '../_lib/auth.js';

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

  const name = String(body.name || '').trim().slice(0, 24) || '匿名岛民';
  const comment = {
    id: 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    name,
    text,
    createdAt: Date.now(),
  };
  await addComment(env, videoId, comment);
  return json({ ok: true, comment }, 201);
}
