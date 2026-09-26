// ============================================================
//  pianyu-site / functions/api/admin/me.js
//  GET /api/admin/me -> { ok, loggedIn, isAdmin, login, kind, user }
//  200 either way (frontend-friendly)
//
//  管理员有两种来源（与 _lib/actor.js / admin/reports.js 的 resolveAdmin 一致）：
//    1) 站长：小蓝页 SSO 会话（pianyu_uid）里 isAdmin=true；
//    2) 管理员账户：pianyu_sid（/api/admin/login 开放登录）。
//  两者任一成立即 isAdmin=true。前端据此显示举报/管理面板。
// ============================================================

import { getSession as getAdminSession } from '../../_lib/store.js';
import { parseCookie, json, COOKIE as ADMIN_COOKIE } from '../../_lib/auth.js';
import { getSession as getSsoSession } from '../../_lib/pyauth.js';

export async function onRequestGet({ request, env }) {
  // 1) 站长（SSO）
  let sso = null;
  try {
    sso = await getSsoSession({ request, env });
  } catch (e) {
    sso = null;
  }
  if (sso && sso.isAdmin) {
    return json({
      ok: true,
      loggedIn: true,
      isAdmin: true,
      kind: 'owner',
      login: sso.login || null,
      user: {
        login: sso.login || null,
        name: sso.name || null,
        avatar_url: sso.avatar_url || '',
        sub: sso.sub || null,
      },
    });
  }

  // 2) 管理员账户（pianyu_sid）
  const sid = parseCookie(request.headers.get('Cookie') || '', ADMIN_COOKIE);
  const s = sid ? await getAdminSession(env, sid) : null;
  if (s) {
    return json({
      ok: true,
      loggedIn: true,
      isAdmin: true,
      kind: 'admin',
      login: s.login || null,
      user: s,
    });
  }

  // 都不是
  return json({ ok: true, loggedIn: false, isAdmin: false, kind: null, login: null, user: null });
}
