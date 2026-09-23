// ============================================================
//  pianyu-site / functions/api/admin/logout.js
//  POST /api/admin/logout -> clears the piano session cookie
// ============================================================

import { deleteSession } from '../../_lib/store.js';
import { parseCookie, json, COOKIE } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const sid = parseCookie(request.headers.get('Cookie'), COOKIE);
  await deleteSession(env, sid);
  return json(
    { ok: true },
    200,
    { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` }
  );
}
