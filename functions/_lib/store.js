// ============================================================
//  pianyu-site / functions/_lib/store.js
//  KV-backed storage for video metadata (external-link mode).
//  Everything lives under the independent PIANYU_KV namespace.
// ============================================================

const VIDEOS_KEY = 'videos';
const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function listVideos(env) {
  const raw = await env.PIANYU_KV.get(VIDEOS_KEY, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

export async function saveVideos(env, videos) {
  await env.PIANYU_KV.put(VIDEOS_KEY, JSON.stringify(videos));
}

export function newId() {
  return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map((t) => String(t).trim()).filter(Boolean);
  }
  return String(input || '')
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/* ---------------- admin sessions ---------------- */

export async function createSession(env) {
  const sid = crypto.randomUUID().replace(/-/g, '');
  await env.PIANYU_KV.put(SESSION_PREFIX + sid, JSON.stringify({ createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL,
  });
  return sid;
}

export async function getSession(env, sid) {
  if (!sid) return null;
  const v = await env.PIANYU_KV.get(SESSION_PREFIX + sid, { type: 'json' });
  return v || null;
}

export async function deleteSession(env, sid) {
  if (sid) await env.PIANYU_KV.delete(SESSION_PREFIX + sid);
}

/* ---------------- 屿论 (comments) ---------------- */

const COMMENTS_PREFIX = 'comments:';

export async function listComments(env, videoId) {
  const raw = await env.PIANYU_KV.get(COMMENTS_PREFIX + videoId, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

export async function addComment(env, videoId, comment) {
  const list = await listComments(env, videoId);
  list.push(comment);
  // keep the newest 500 per video
  const trimmed = list.slice(-500);
  await env.PIANYU_KV.put(COMMENTS_PREFIX + videoId, JSON.stringify(trimmed));
  return trimmed;
}

/* ---------------- 定点屿论 (danmaku) ---------------- */

const DANMAKU_PREFIX = 'danmaku:';

export async function listDanmaku(env, videoId) {
  const raw = await env.PIANYU_KV.get(DANMAKU_PREFIX + videoId, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

export async function addDanmaku(env, videoId, d) {
  const list = await listDanmaku(env, videoId);
  list.push(d);
  const trimmed = list.slice(-1000);
  await env.PIANYU_KV.put(DANMAKU_PREFIX + videoId, JSON.stringify(trimmed));
  return trimmed;
}
