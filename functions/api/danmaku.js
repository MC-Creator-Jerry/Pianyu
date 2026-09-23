// ============================================================
//  pianyu-site / functions/api/danmaku.js   —— 定点屿论（弹幕）
//  GET  /api/danmaku?videoId=xxx  -> list (public)
//  POST /api/danmaku              -> add { videoId, time, text, color? }
//  `time`  = seconds into the video (number)
//  `color` = optional css color
// ============================================================

import { listDanmaku, addDanmaku } from '../_lib/store.js';
import { json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const videoId = (new URL(request.url).searchParams.get('videoId') || '').trim();
  if (!videoId) return json({ ok: false, error: 'missing_videoId' }, 400);
  const danmaku = await listDanmaku(env, videoId);
  return json({ ok: true, count: danmaku.length, danmaku });
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
  const time = Number(body.time);
  if (!videoId || !text) return json({ ok: false, error: 'missing_fields' }, 400);
  if (!Number.isFinite(time) || time < 0) return json({ ok: false, error: 'bad_time' }, 400);
  if (text.length > 60) return json({ ok: false, error: 'too_long' }, 400);

  const color = /^#[0-9a-fA-F]{3,8}$/.test(String(body.color || '')) ? body.color : '';
  const d = {
    id: 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    time: Math.round(time * 10) / 10,
    text,
    color,
    createdAt: Date.now(),
  };
  await addDanmaku(env, videoId, d);
  return json({ ok: true, danmaku: d }, 201);
}
