// ============================================================
//  pianyu-site / functions/api/videos.js
//  GET  /api/videos   -> list (public; supports ?q= & ?tag=)
//  POST /api/videos   -> create (admin only)
// ============================================================

import { listVideos, saveVideos, newId, normalizeTags } from '../_lib/store.js';
import { isAuthed, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const tag = (url.searchParams.get('tag') || '').trim().toLowerCase();

  const all = await listVideos(env);
  const tags = [...new Set(all.flatMap((v) => v.tags || []))].sort();

  let videos = all;
  if (q) {
    videos = videos.filter((v) => {
      const hay = [v.title, v.desc, (v.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  if (tag) {
    videos = videos.filter((v) => (v.tags || []).map((t) => t.toLowerCase()).includes(tag));
  }
  videos = videos.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return json({ ok: true, count: videos.length, tags, videos });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const title = String(body.title || '').trim();
  const url = String(body.url || '').trim();
  if (!title || !url) return json({ ok: false, error: 'missing_title_or_url' }, 400);

  const videos = await listVideos(env);
  const now = Date.now();
  const video = {
    id: newId(),
    title,
    desc: String(body.desc || '').trim(),
    tags: normalizeTags(body.tags),
    url,
    source: body.source === 'embed' ? 'embed' : 'file',
    cover: String(body.cover || '').trim(),
    duration: String(body.duration || '').trim(),
    views: 0,
    createdAt: now,
    updatedAt: now,
  };
  videos.push(video);
  await saveVideos(env, videos);
  return json({ ok: true, video }, 201);
}
