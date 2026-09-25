// ============================================================
//  pianyu-site / functions/api/afdian/webhook/[secret].js
//  爱发电「发布功能升级」订单回调：付费成功后给对应片屿用户发放
//  每日发布上限 +10（写 KV vip:<sub>，31 天续期）。
//
//  安全：爱发电 webhook 本身不带签名，故用「路径里的 secret」鉴权——
//  在爱发电后台把通知地址配成
//    https://jerrypianyu.pages.dev/api/afdian/webhook/<SECRET>
//  其中 <SECRET> 必须等于 Cloudflare 环境变量 AFDIAN_WEBHOOK_SECRET。
//  同时按 out_trade_no 做幂等，重复推送不会重复发放。
// ============================================================

import { json } from '../../../_lib/auth.js';

const PLAN_ID = '8ffb1aa0b87711f1b03952540025c377'; // 片屿·发布功能升级
const VIP_BONUS = 10; // 每日上限 +10（6 -> 16）
const VIP_DAYS = 31; // 月付，按 31 天续期
const PREFIX = 'pianyu:'; // custom_order_id / remark 前缀，用于归属片屿用户

export async function onRequestPost({ request, env, params }) {
  // 1) 鉴权：路径 secret 必须匹配环境变量
  const want = env.AFDIAN_WEBHOOK_SECRET;
  if (!want || (params && params.secret) !== want) {
    return json({ ec: 400, em: 'forbidden' }, 403);
  }

  // 2) 解析 body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ec: 400, em: 'bad_json' }, 400);
  }

  const data = body && body.data;
  const order = (data && data.order) || (body && body.order) || null;
  if (!order || (data && data.type) !== 'order') {
    return json({ ec: 200, em: '' }); // 非订单事件（如心跳），直接 ack
  }

  // 3) 校验：必须是本计划、且已支付（status 2）
  if (order.plan_id !== PLAN_ID) return json({ ec: 200, em: '' });
  if (Number(order.status) !== 2) return json({ ec: 200, em: '' });

  const tradeNo = String(order.out_trade_no || '');
  if (!tradeNo) return json({ ec: 200, em: '' });

  // 4) 幂等：已处理过的订单直接 ack
  const doneKey = 'afdian:order:' + tradeNo;
  if (await env.PIANYU_KV.get(doneKey)) return json({ ec: 200, em: '' });

  // 5) 归因：custom_order_id 优先，remark 兜底（值形如 pianyu:<sub>）
  const raw = String(order.custom_order_id || order.remark || '').trim();
  const sub = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length).trim() : '';
  if (!sub) return json({ ec: 200, em: '' }); // 无法归属，忽略

  // 6) 发放权益
  const until = Date.now() + VIP_DAYS * 86400 * 1000;
  await env.PIANYU_KV.put(
    'vip:' + sub,
    JSON.stringify({
      until,
      bonus: VIP_BONUS,
      plan: 'afdian-' + PLAN_ID,
      order: tradeNo,
      grantedAt: Date.now(),
    }),
    { expirationTtl: VIP_DAYS * 2 * 86400 }
  );
  await env.PIANYU_KV.put(doneKey, '1', { expirationTtl: VIP_DAYS * 2 * 86400 });

  return json({ ec: 200, em: '' });
}
