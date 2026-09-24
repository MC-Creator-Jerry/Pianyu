// ============================================================
//  pianyu-site / functions/api/videos.js
//  GET  /api/videos   -> list (public; supports ?q= & ?tag=)
//  POST /api/videos   -> create (islander SSO; owner = superuser)
//                       video carries `author` attribution
// ============================================================

import { listVideos, saveVideos, newId, normalizeTags } from '../_lib/store.js';
import { json } from '../_lib/auth.js';
import { getActor } from '../_lib/actor.js';

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
  const actor = await getActor(request, env);
  if (!actor) return json({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const title = String(body.title || '').trim();
  const url = String(body.url || '').trim();
  if (!title || !url) return json({ ok: false, error: 'missing_title_or_url' }, 400);

  // 每用户每日上新上限（站长城除外）
  const DAILY_LIMIT = 6;
  if (!actor.isOwner) {
    const day = new Date().toISOString().slice(0, 10); // UTC 日期
    const who = actor.sub || actor.login || 'unknown';
    const limitKey = `uplimit:${day}:${who}`;
    const used = Number(await env.PIANYU_KV.get(limitKey)) || 0;
    if (used >= DAILY_LIMIT) {
      return json({
        ok: false,
        error: 'daily_limit',
        limit: DAILY_LIMIT,
        message: `今天的上新已达上限（每天 ${DAILY_LIMIT} 个），明天再来吧～`,
      }, 429);
    }
    await env.PIANYU_KV.put(limitKey, String(used + 1), { expirationTtl: 60 * 60 * 24 * 2 });
  }

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
    author: actor.isOwner
      ? { owner: true, name: actor.name || '站长' }
      : { sub: actor.sub, login: actor.login, name: actor.name, avatar: actor.avatar },
    views: 0,
    createdAt: now,
    updatedAt: now,
  };
  videos.push(video);
  await saveVideos(env, videos);
  return json({ ok: true, video }, 201);
}
