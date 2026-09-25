// ============================================================
//  pianyu-site / functions/api/redeem.js   —— 兑换码开通
//  POST /api/redeem  { code }  需要登录（小蓝页 SSO）
//
//  码是一次性的：兑换后即作废，同一码再兑会返回 used。
//  已开通的用户再兑一条新码 = 在原到期时间上顺延 31 天（续费）。
// ============================================================

import { getSession } from '../_lib/pyauth.js';
import { json } from '../_lib/auth.js';
import { redeemCode, formatCode } from '../_lib/pycode.js';

const REASON_TEXT = {
  empty: '请输入兑换码',
  notfound: '兑换码无效，请检查是否输错',
  used: '这个兑换码已经用过了',
  not_logged_in: '请先登录再兑换',
};

export async function onRequestPost(context) {
  const sess = await getSession(context);
  if (!sess || !sess.sub) return json({ ok: false, error: 'not_logged_in' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const r = await redeemCode(context.env, body && body.code, sess.sub);
  if (!r.ok) {
    return json(
      { ok: false, error: r.reason, message: REASON_TEXT[r.reason] || '兑换失败' },
      r.reason === 'used' || r.reason === 'notfound' ? 400 : 400
    );
  }

  return json({
    ok: true,
    code: formatCode(body.code),
    vip: {
      active: true,
      until: r.vip.until,
      bonus: r.vip.bonus,
      plan: r.vip.plan,
      order: r.vip.order,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
