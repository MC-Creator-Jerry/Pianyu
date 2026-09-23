// ============================================================
//  pianyu-site / functions/_lib/auth.js
//  Admin auth helpers. Cookie name is site-specific: pianyu_sid
//  (never share a cookie/secret with xiaolan or teahouse).
// ============================================================

import { getSession } from './store.js';

export const COOKIE = 'pianyu_sid';

export function parseCookie(header, name) {
  if (!header) return '';
  const hit = header
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1) : '';
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function isAuthed(request, env) {
  const sid = parseCookie(request.headers.get('Cookie'), COOKIE);
  return !!(await getSession(env, sid));
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}
