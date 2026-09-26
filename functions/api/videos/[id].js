// ============================================================
//  pianyu-site / functions/api/videos/[id].js
//  GET    /api/videos/:id  -> detail (public; bumps view count)
//  PATCH  /api/videos/:id  -> edit  (author, or owner superuser)
//  DELETE /api/videos/:id  -> delete (author, or owner superuser)
// ============================================================

import { listVideos, saveVideos, normalizeTags } from '../../_lib/store.js';
import { json } from '../../_lib/auth.js';
import { getActor, canModify } from '../../_lib/actor.js';

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
  const actor = await getActor(request, env);
  if (!actor) return json({ ok: false, error: 'unauthorized' }, 401);

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

  if (!canModify(actor, v)) return json({ ok: false, error: 'forbidden' }, 403);

  if (typeof body.title === 'string' && body.title.trim()) v.title = body.title.trim();
  if (typeof body.desc === 'string') v.desc = body.desc.trim();
  if (typeof body.url === 'string' && body.url.trim()) v.url = body.url.trim();
  if (body.source === 'file' || body.source === 'embed') v.source = body.source;
  if (typeof body.cover === 'string') v.cover = body.cover.trim();
  if (typeof body.duration === 'string') v.duration = body.duration.trim();
  if (body.tags !== undefined) v.tags = normalizeTags(body.tags);
  if (body.workType) v.workType = ['original', 'derivative', 'remix', 'repost'].includes(body.workType) ? body.workType : v.workType;
  v.updatedAt = Date.now();

  await saveVideos(env, videos);
  return json({ ok: true, video: v });
}

export async function onRequestDelete({ params, request, env }) {
  const actor = await getActor(request, env);
  if (!actor) return json({ ok: false, error: 'unauthorized' }, 401);

  const videos = await listVideos(env);
  const v = videos.find((x) => x.id === params.id);
  if (!v) return json({ ok: false, error: 'not_found' }, 404);
  if (!canModify(actor, v)) return json({ ok: false, error: 'forbidden' }, 403);

  const next = videos.filter((x) => x.id !== params.id);
  await saveVideos(env, next);
  return json({ ok: true, deleted: params.id });
}
