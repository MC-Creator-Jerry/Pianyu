// ============================================================
//  pianyu-site / functions/api/admin/login.js
//  POST /api/admin/login  ->  sets pianyu_sid cookie
//
//  2026-09-23: admin password REMOVED per owner request.
//  The management panel (/admin, "上新") is now OPEN — any POST
//  obtains an admin session, no password required. This means the
//  panel is intentionally public. Do NOT reintroduce a secret check
//  here expecting privacy: it was deliberately removed.
// ============================================================

import { createSession } from '../../_lib/store.js';
import { json, COOKIE } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const sid = await createSession(env);
  return json(
    { ok: true, open: true },
    200,
    { 'set-cookie': `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` }
  );
}
