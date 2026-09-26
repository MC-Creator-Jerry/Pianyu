// ============================================================
//  pianyu-site / functions/api/admin/reports.js   —— 举报处理（仅站长）
//  GET  /api/admin/reports  -> 待处理举报列表（附带 videoTitle）
//  POST /api/admin/reports -> { id, action: 'resolve' | 'delete' }
//        resolve：仅标记已处理；delete：先删除被举报内容再标记已处理
//  注意：本文件位于 functions/api/admin/，_lib 相对路径为 ../../_lib/
// ============================================================

import {
  listOpenReports, resolveReport, removeComment, removeDanmaku, listVideos, saveVideos,
} from '../../_lib/store.js';
import { json } from '../../_lib/auth.js';
import { getSession } from '../../_lib/pyauth.js';

function forbid() {
  return json({ ok: false, error: 'forbidden' }, 403);
}

export async function onRequestGet({ request, env }) {
  const sess = await getSession({ request, env });
  if (!sess || !sess.isAdmin) return forbid();

  const reports = await listOpenReports(env);
  const videos = await listVideos(env);
  const titleMap = {};
  videos.forEach((v) => { titleMap[v.id] = v.title; });
  const out = reports.map((r) => ({ ...r, videoTitle: titleMap[r.videoId] || '(视频已删除)' }));
  // 新的在前
  out.sort((a, b) => b.createdAt - a.createdAt);
  return json({ ok: true, reports: out });
}

export async function onRequestPost({ request, env }) {
  const sess = await getSession({ request, env });
  if (!sess || !sess.isAdmin) return forbid();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
  const id = String(body.id || '');
  const action = String(body.action || 'resolve');

  const reports = await listOpenReports(env);
  const r = reports.find((x) => x.id === id);
  if (!r) return json({ ok: false, error: 'not_found' }, 404);

  if (action === 'delete') {
    if (r.kind === 'video') {
      const videos = await listVideos(env);
      await saveVideos(env, videos.filter((v) => v.id !== r.videoId));
    } else if (r.kind === 'comment') {
      await removeComment(env, r.videoId, r.targetId);
    } else if (r.kind === 'danmaku') {
      await removeDanmaku(env, r.videoId, r.targetId);
    }
  }

  await resolveReport(env, id);
  return json({ ok: true });
}
