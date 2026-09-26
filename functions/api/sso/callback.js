// ============================================================
//  pianyu-site / functions/api/sso/callback.js   —— 岛民登录回调
//  GET /api/sso/callback?code=&state=
//  用一次性 code 向小蓝页换身份（服务端到服务端），成功后在本域种 pianyu_uid。
// ============================================================

import {
  getCookie,
  SSO_COOKIE,
  createSession,
  sessionCookie,
  clearSsoStateCookie,
  upsertUser,
  IDP,
  CLIENT_ID,
} from '../../_lib/pyauth.js';

function safeNext(v) {
  const s = String(v || '');
  if (!s || s[0] !== '/' || s[1] === '/' || s.indexOf('\\') >= 0) return '/';
  return s;
}

function redirect(location, cookies) {
  const h = new Headers();
  (cookies || []).forEach((c) => h.append('set-cookie', c));
  h.set('location', location);
  h.set('cache-control', 'no-store');
  return new Response(null, { status: 302, headers: h });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const kv = context.env.PIANYU_KV;

  if (!code || !state) return redirect('/?sso=bad_params', [clearSsoStateCookie()]);
  if (!kv) return redirect('/?sso=not_ready', [clearSsoStateCookie()]);

  // state 双校验：HttpOnly Cookie + KV 记录，缺一不可（防 CSRF / 伪造回调）
  const cookieState = getCookie(context.request, SSO_COOKIE);
  if (!cookieState || cookieState !== state) {
    return redirect('/?sso=bad_state', [clearSsoStateCookie()]);
  }

  let rec = null;
  try {
    rec = await kv.get('sso:state:' + state, { type: 'json' });
  } catch (e) {
    rec = null;
  }
  if (!rec) return redirect('/?sso=bad_state', [clearSsoStateCookie()]);
  try {
    await kv.delete('sso:state:' + state);
  } catch (e) {
    /* 忽略 */
  }

  const secret = context.env.SSO_CLIENT_SECRET;
  if (!secret) return redirect('/?sso=not_configured', [clearSsoStateCookie()]);

  let d = null;
  try {
    const r = await fetch(IDP + '/api/sso/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + secret,
      },
      body: JSON.stringify({ code: code, client_id: CLIENT_ID }),
    });
    const j = await r.json();
    if (r.ok && j && j.ok) d = j;
  } catch (e) {
    d = null;
  }

  if (!d) return redirect('/?sso=token_failed', [clearSsoStateCookie()]);

  const sid = await createSession(kv, {
    sub: d.sub,
    login: d.login,
    name: d.name,
    avatar_url: d.avatar_url,
    isAdmin: !!d.isAdmin,
    provider: d.provider || 'xiaolan',
  });

  // 顺手把岛民档案写进片屿自己的目录（屿论/定点屿论 显示昵称头像用）
  await upsertUser(kv, { login: d.login, name: d.name, avatar: d.avatar_url });

  // 维护 login -> sub 反查索引：爱发电 Webhook 凭留言里的 GitHub 用户名找 SSO sub 用。
  // 片屿 promember 以 sub（GitHub user id）为键，而 webhook 只能从订单留言拿到 login（用户名），
  // 所以 SSO 登录时把「用户名 -> sub」落库，webhook 才能反查到要发放的人。
  try { await kv.put('login2sub:' + d.login, d.sub); } catch (e) {}

  const next = safeNext(rec.next);
  return redirect(next, [sessionCookie(sid, 60 * 60 * 24 * 30), clearSsoStateCookie()]);
}
