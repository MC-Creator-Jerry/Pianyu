// ============================================================
//  pianyu-site / functions/api/admin/login.js
//  POST /api/admin/login  { password }  -> sets pianyu_sid cookie
//  Password comes from the Pages secret PIANYU_ADMIN_PASSWORD.
//  If the secret is missing we FAIL CLOSED (never "empty = open").
// ============================================================

import { createSession } from '../../_lib/store.js';
import { timingSafeEqual, json, COOKIE } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const expected = env.PIANYU_ADMIN_PASSWORD;
  if (!expected) {
    return json(
      {
        ok: false,
        error: 'not_configured',
        hint:
          'Set the admin password:  wrangler pages secret put PIANYU_ADMIN_PASSWORD --project-name pianyu',
      },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const pw = String(body.password || '');
  if (!timingSafeEqual(pw, expected)) {
    return json({ ok: false, error: 'invalid_credentials' }, 401);
  }

  const sid = await createSession(env);
  return json(
    { ok: true },
    200,
    { 'set-cookie': `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` }
  );
}
