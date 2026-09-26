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

/* ---------------- 点赞 (likes) ---------------- */

const LIKES_PREFIX = 'likes:';

export async function getLikes(env, videoId) {
  const raw = await env.PIANYU_KV.get(LIKES_PREFIX + videoId, { type: 'json' });
  const obj = (raw && Array.isArray(raw.users)) ? raw : { users: [] };
  return obj;
}

// 切换当前用户的点赞态；返回最新 { liked, count }
export async function toggleLike(env, videoId, sub) {
  const obj = await getLikes(env, videoId);
  const i = obj.users.indexOf(sub);
  let liked;
  if (i >= 0) { obj.users.splice(i, 1); liked = false; }
  else { obj.users.push(sub); liked = true; }
  await env.PIANYU_KV.put(LIKES_PREFIX + videoId, JSON.stringify(obj));
  return { liked, count: obj.users.length };
}

/* ---------------- 举报 (reports) ---------------- */

const REPORTS_INDEX = 'reports:open';
const reportKey = (id) => 'report:' + id;

export async function addReport(env, report) {
  await env.PIANYU_KV.put(reportKey(report.id), JSON.stringify(report));
  const idx = await env.PIANYU_KV.get(REPORTS_INDEX, { type: 'json' });
  const list = Array.isArray(idx) ? idx : [];
  list.push(report.id);
  await env.PIANYU_KV.put(REPORTS_INDEX, JSON.stringify(list));
  return report;
}

export async function listOpenReports(env) {
  const idx = await env.PIANYU_KV.get(REPORTS_INDEX, { type: 'json' });
  const ids = Array.isArray(idx) ? idx : [];
  const out = [];
  for (const id of ids) {
    const r = await env.PIANYU_KV.get(reportKey(id), { type: 'json' });
    if (r) out.push(r);
  }
  return out;
}

// 标记举报为已处理：保留明细（status=resolved），仅从待处理索引移除
export async function resolveReport(env, id) {
  const r = await env.PIANYU_KV.get(reportKey(id), { type: 'json' });
  if (r) {
    r.status = 'resolved';
    await env.PIANYU_KV.put(reportKey(id), JSON.stringify(r));
  }
  const idx = await env.PIANYU_KV.get(REPORTS_INDEX, { type: 'json' });
  const list = Array.isArray(idx) ? idx.filter((x) => x !== id) : [];
  await env.PIANYU_KV.put(REPORTS_INDEX, JSON.stringify(list));
}

export async function getReport(env, id) {
  return await env.PIANYU_KV.get(reportKey(id), { type: 'json' });
}

// 供管理员删除被举报内容
export async function removeComment(env, videoId, targetId) {
  const list = await listComments(env, videoId);
  const next = list.filter((c) => c.id !== targetId);
  await env.PIANYU_KV.put(COMMENTS_PREFIX + videoId, JSON.stringify(next));
  return next.length;
}

export async function removeDanmaku(env, videoId, targetId) {
  const list = await listDanmaku(env, videoId);
  const next = list.filter((d) => d.id !== targetId);
  await env.PIANYU_KV.put(DANMAKU_PREFIX + videoId, JSON.stringify(next));
  return next.length;
}
