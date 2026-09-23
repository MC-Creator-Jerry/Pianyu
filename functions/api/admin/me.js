// ============================================================
//  pianyu-site / functions/api/admin/me.js
//  GET /api/admin/me -> { ok, loggedIn }  (200 either way; frontend-friendly)
// ============================================================

import { getSession } from '../../_lib/store.js';
import { parseCookie, json, COOKIE } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const sid = parseCookie(request.headers.get('Cookie'), COOKIE);
  const s = await getSession(env, sid);
  return json({ ok: true, loggedIn: !!s });
}
