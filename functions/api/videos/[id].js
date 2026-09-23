// ============================================================
//  pianyu-site / functions/api/videos/[id].js
//  GET    /api/videos/:id  -> detail (public; bumps view count)
//  PATCH  /api/videos/:id  -> edit  (admin only)
//  DELETE /api/videos/:id  -> delete (admin only)
// ============================================================

import { listVideos, saveVideos, normalizeTags } from '../../_lib/store.js';
import { isAuthed, json } from '../../_lib/auth.js';

export async function onRequestGet({ params, env, waitUntil }) {
  const videos = await listVideos(env);
  const video = videos.find((v) => v.id === params.id);
  if (!video) return json({ ok: false, error: 'not_found' }, 404);

  video.views = (video.views || 0) + 1;
  const p = saveVideos(env, videos);
  if (waitUntil) waitUntil(p);
  else await p;

  return json({ ok: true, video });
}

export async function onRequestPatch({ params, request, env }) {
  if (!(await isAuthed(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const videos = await listVideos(env);
  const i = videos.findIndex((v) => v.id === params.id);
  if (i < 0) return json({ ok: false, error: 'not_found' }, 404);
  const v = videos[i];

  if (typeof body.title === 'string' && body.title.trim()) v.title = body.title.trim();
  if (typeof body.desc === 'string') v.desc = body.desc.trim();
  if (typeof body.url === 'string' && body.url.trim()) v.url = body.url.trim();
  if (body.source === 'file' || body.source === 'embed') v.source = body.source;
  if (typeof body.cover === 'string') v.cover = body.cover.trim();
  if (typeof body.duration === 'string') v.duration = body.duration.trim();
  if (body.tags !== undefined) v.tags = normalizeTags(body.tags);
  v.updatedAt = Date.now();

  await saveVideos(env, videos);
  return json({ ok: true, video: v });
}

export async function onRequestDelete({ params, request, env }) {
  if (!(await isAuthed(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);

  const videos = await listVideos(env);
  const next = videos.filter((v) => v.id !== params.id);
  if (next.length === videos.length) return json({ ok: false, error: 'not_found' }, 404);

  await saveVideos(env, next);
  return json({ ok: true, deleted: params.id });
}
