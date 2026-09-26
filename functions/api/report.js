// ============================================================
//  pianyu-site / functions/api/report.js   —— 举报
//  POST /api/report  -> { videoId, kind: video|comment|danmaku, targetId?, reason, text? }
//  需登录（防止滥用）。举报进入待处理队列，由站长在管理页处理。
// ============================================================

import { addReport } from '../_lib/store.js';
import { json } from '../_lib/auth.js';
import { getSession, getPrefs } from '../_lib/pyauth.js';

const REASONS = ['spam', 'abuse', 'copyright', 'other'];

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const videoId = String(body.videoId || '').trim();
  const kind = String(body.kind || 'video');
  if (!videoId) return json({ ok: false, error: 'missing_videoId' }, 400);
  if (!['video', 'comment', 'danmaku'].includes(kind)) return json({ ok: false, error: 'bad_kind' }, 400);
  if (kind !== 'video' && !body.targetId) return json({ ok: false, error: 'missing_targetId' }, 400);

  const text = String(body.text || '').trim().slice(0, 300);
  const reason = REASONS.includes(body.reason) ? body.reason : 'other';

  let sess = null;
  try { sess = await getSession({ request, env }); } catch (e) { sess = null; }
  if (!sess) return json({ ok: false, error: 'login_required' }, 401);

  let name = '岛民';
  try {
    const prefs = await getPrefs(env, sess.sub);
    name = String(prefs && prefs.display_name || sess.name || sess.login || '岛民').slice(0, 24);
  } catch (e) { name = String(sess.name || sess.login || '岛民').slice(0, 24); }

  const report = {
    id: 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    videoId,
    kind,
    targetId: kind === 'video' ? '' : String(body.targetId || ''),
    reason,
    text,
    sub: String(sess.sub || ''),
    login: sess.login || '',
    name,
    createdAt: Date.now(),
    status: 'open',
  };
  await addReport(env, report);
  return json({ ok: true, report }, 201);
}
