// ============================================================
//  pianyu-site / functions/api/afdian-webhook.js
//  片屿 · 爱发电 Webhook 回调（POST）
//
//  调用来源（爱发电一个账号只能配一个 webhook，已被小蓝页占用）：
//    1) 小蓝页中枢在确认「茶馆·片屿·书栈 捆绑包」订单成功后，fan-out 到这里；
//    2) （可选）若未来把爱发电 webhook 直接指向片屿，则直接收推送。
//
//  必须返回 {ec:200,em:""} 否则平台会重试。
//
//  ⚠️ 安全：爱发电 Webhook 推送【不带签名】，本端点又是对外公开，
//  所以一律用带签名的官方 query-order 反查订单，确认 status===2 才发放。
//  伪造的订单号在官方那边查不到，自然被挡。
//
//  绑定：订单留言（remark）里写 GitHub 用户名（如 @MC-Creator-Jerry 或纯用户名），
//  通过 login2sub 索引（SSO 登录时写入）反查到 SSO 的 sub，再发放 promember:<sub>。
//  认不到 sub（留言没写用户名 / 该用户名从未登录片屿）→ 挂起，等管理员手动绑定。
//
//  未配 AFDIAN_USER_ID/AFDIAN_TOKEN 时只挂起订单、绝不臆造权益。
// ============================================================

import { queryOrder } from '../_lib/py_afdian.js';
import {
  isOrderProcessed,
  markOrderProcessed,
  grantProMember,
  addPending,
  listPending,
  orderMatchesPianyuPlan,
} from '../_lib/pycode.js';
import { json } from '../_lib/auth.js';
import { getSession } from '../_lib/pyauth.js';

const OK = { ec: 200, em: '' };

// 从订单留言里找 GitHub 用户名：
//   1) 形如 "@MC-Creator-Jerry" 优先；
//   2) 整条留言就是一个合法用户名（无空格、无中文）也算。
function extractLogin(remark) {
  const s = String(remark == null ? '' : remark).trim();
  if (!s) return '';
  const m = s.match(/@([A-Za-z0-9][A-Za-z0-9-]{1,38})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9][A-Za-z0-9-]{1,38}$/.test(s)) return s;
  return '';
}

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => null);
  const order = (body && body.data && body.data.order) || null;
  const no = order && String(order.out_trade_no || '').trim();
  if (!no) return json(OK, 200);

  // 幂等：同一订单只处理一次
  if (await isOrderProcessed(context.env, no)) return json(OK);

  const hasCreds = !!(context.env.AFDIAN_USER_ID && context.env.AFDIAN_TOKEN);

  // 没配凭据：无法验真，一律挂起等管理员确认，绝不放行
  if (!hasCreds) {
    await addPending(context.env, Object.assign({}, order, {
      out_trade_no: no,
      remark: String(order.remark || '') + ' [未配置 AFDIAN_TOKEN，未验真]',
    }));
    return json(OK);
  }

  // 反查验真（唯一可信判定）
  const q = await queryOrder(context.env, no);
  if (!q.ok || !q.order) {
    await addPending(context.env, Object.assign({}, order, {
      out_trade_no: no,
      remark: String(order.remark || '') + ' [官方反查未确认]',
    }));
    return json(OK);
  }

  const o = q.order;
  if (String(o.status) !== '2') return json(OK); // 非「交易成功」不处理

  // 只认片屿自己的套餐 / 捆绑包，其余纯打赏或不相干订单不解锁
  const plan = orderMatchesPianyuPlan(o);
  if (!plan) {
    await markOrderProcessed(context.env, no, '', o.month || 1, 'other');
    return json(OK);
  }

  const months = Math.max(1, parseInt(o.month, 10) || 1);
  const login = extractLogin(o.remark);
  const sub = login
    ? (await context.env.PIANYU_KV.get('login2sub:' + login).catch(() => null)) || ''
    : '';

  if (sub) {
    await grantProMember(context.env, sub, months, plan, o.out_trade_no);
    await markOrderProcessed(context.env, no, sub, months, plan);
  } else {
    // 留言里没写用户名，或该用户名从未登录片屿 → 挂起，等管理员手动绑定
    await addPending(context.env, o);
  }
  return json(OK);
}

// GET：自检用（仅站长 SSO 会话）。看凭据配好没、有没有待认领订单。
export async function onRequestGet(context) {
  const sess = await getSession(context).catch(() => null);
  if (!sess || !sess.isAdmin) return json({ error: 'forbidden' }, 403);
  const pending = await listPending(context.env);
  return json({
    ok: true,
    configured: {
      user_id: !!context.env.AFDIAN_USER_ID,
      token: !!context.env.AFDIAN_TOKEN,
    },
    pending: { count: pending.length, list: pending.slice(0, 50) },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}
