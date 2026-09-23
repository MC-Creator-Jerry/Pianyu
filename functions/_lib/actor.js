// ============================================================
//  pianyu-site / functions/_lib/actor.js
//  Resolve who is acting on a write request (Option C: UGC model).
//
//   - islander SSO session (pianyu_uid)  -> normal user
//   - islander whose SSO profile carries isAdmin -> owner / superuser
//
//  The separate admin cookie (pianyu_sid) is intentionally NOT
//  trusted here: /api/admin/login is open, so anyone could grab it.
//  Superuser is the OWNER's SSO identity, not a shared cookie.
// ============================================================

import { getSession } from './pyauth.js';

export async function getActor(request, env) {
  const sess = await getSession({ env, request });
  if (sess && sess.sub) {
    const isOwner = !!sess.isAdmin;
    return {
      role: isOwner ? 'owner' : 'islander',
      isOwner,
      sub: sess.sub,
      login: sess.login || '',
      name: sess.name || sess.login || '岛民',
      avatar: sess.avatar_url || '',
    };
  }
  return null;
}

// True if the actor may modify `video` (edit/delete).
export function canModify(actor, video) {
  if (!actor) return false;
  if (actor.isOwner) return true;
  return !!(video && video.author && video.author.sub && String(video.author.sub) === String(actor.sub));
}
