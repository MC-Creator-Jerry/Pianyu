// ============================================================
//  片屿 pianyu-site  /  assets/pianyu.js
//  Shared helpers (no framework).
// ============================================================

window.PY = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  },

  async api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'content-type': 'application/json' },
      ...opts,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { res, data };
  },

  qs(name) {
    return new URLSearchParams(location.search).get(name) || '';
  },

  fmtDate(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  fmtViews(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + ' 万';
    return String(n);
  },

  fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  },

  // Build a card element for a video
  card(v) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = 'watch.html?id=' + encodeURIComponent(v.id);
    const tags = (v.tags || [])
      .map((t) => `<span class="tag">${window.PY.esc(t)}</span>`)
      .join('');
    const thumbInner = v.cover
      ? `<img src="${window.PY.esc(v.cover)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.ph').style.display='flex'">`
      : '';
    a.innerHTML = `
      <div class="thumb">
        ${thumbInner}
        <div class="ph" style="${v.cover ? 'display:none' : ''}">▶</div>
        ${v.duration ? `<span class="dur">${window.PY.esc(v.duration)}</span>` : ''}
      </div>
      <div class="body">
        <div class="title">${window.PY.esc(v.title)}</div>
        <div class="meta"><span>${window.PY.fmtViews(v.views)} 位岛民看过</span><span>${window.PY.fmtDate(v.createdAt)}</span>${v.author?`<span>· ${window.PY.esc(v.author.owner?'站长':(v.author.name||'岛民'))} 发布</span>`:''}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>`;
    return a;
  },

  async isAdmin() {
    const { data } = await this.api('/api/admin/me');
    return !!(data && data.loggedIn);
  },
};

/* 爱发电「发布功能升级」计划下单地址（全站统一入口） */
PY.AFDIAN_URL =
  'https://ifdian.net/order/create?plan_id=8ffb1aa0b87711f1b03952540025c377&product_type=0';
PY.AFDIAN_PRICE = '¥13.25';

// 带片屿用户标识的下单链接：把 sub 写进 custom_order_id（爱发电回传 webhook，
// 用于自动发放升级权益）。未登录时回落到不带 sub 的基础链接。
PY.afdianUrl = function (sub) {
  if (!sub) return PY.AFDIAN_URL;
  return PY.AFDIAN_URL + '&custom_order_id=' + encodeURIComponent('pianyu:' + sub);
};

/* ============================================================
   深浅模式
   localStorage: pianyu-theme = 'dark' | 'light' | 'auto'
   未设置时跟随系统；系统也读不到则回到 dark（片屿本色）。
   ============================================================ */
PY.theme = {
  KEY: 'pianyu-theme',

  pref() {
    try {
      return localStorage.getItem(this.KEY) || 'auto';
    } catch (e) {
      return 'auto';
    }
  },

  resolve() {
    const p = this.pref();
    if (p === 'dark' || p === 'light') return p;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (e) {
      /* ignore */
    }
    return 'dark';
  },

  apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = t === 'light' ? '🌙' : '☀️';
      btn.title = t === 'light' ? '切换到深色模式' : '切换到浅色模式';
      btn.setAttribute('aria-label', btn.title);
    }
  },

  // 只做「深/浅」二态切换；点过之后就固定，不再跟随系统
  toggle() {
    const next = this.resolve() === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(this.KEY, next);
    } catch (e) {
      /* ignore */
    }
    this.apply(next);
  },

  init() {
    this.apply(this.resolve());
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
    // 跟随系统时，系统切换则实时跟随
    try {
      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const on = () => {
          if (this.pref() === 'auto') this.apply(this.resolve());
        };
        if (mq.addEventListener) mq.addEventListener('change', on);
        else if (mq.addListener) mq.addListener(on);
      }
    } catch (e) {
      /* ignore */
    }
  },
};

/* ============================================================
   岛民身份（小蓝页 SSO）
   ============================================================ */
PY.user = {
  _cached: undefined,

  async load(force) {
    if (!force && this._cached !== undefined) return this._cached;
    const { data } = await PY.api('/api/me');
    this._cached = (data && data.ok && data.user) || null;
    return this._cached;
  },

  initial(u) {
    const s = String((u && (u.name || u.login)) || '岛').trim();
    return s ? s.slice(0, 1).toUpperCase() : '岛';
  },

  // 登录 / 登出后回到当前页
  loginUrl() {
    const next = location.pathname + location.search;
    return '/api/sso/start?next=' + encodeURIComponent(next);
  },

  async logout() {
    await PY.api('/api/logout', { method: 'POST' });
    this._cached = null;
    location.reload();
  },

  // 把头像 / 登录按钮渲染进容器
  async mount(slotId) {
    const slot = document.getElementById(slotId || 'hdrRight');
    if (!slot) return;

    const u = await this.load(true);

    const wrap = document.createElement('div');
    wrap.className = 'user-wrap';

    if (!u) {
      wrap.innerHTML =
        '<a class="login-btn" href="' + PY.esc(this.loginUrl()) + '">用小蓝页登录</a>';
      slot.appendChild(wrap);
      return;
    }

    const av = u.avatar_url
      ? '<img src="' + PY.esc(u.avatar_url) + '" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'fb\',textContent:\'' + PY.esc(this.initial(u)) + '\'}))">'
      : '<span class="fb">' + PY.esc(this.initial(u)) + '</span>';

    wrap.innerHTML =
      '<button class="avatar-btn" id="avatarBtn" aria-haspopup="true" aria-expanded="false">' +
      av +
      '<span class="nm">' + PY.esc(u.name || u.login || '岛民') + '</span>' +
      '</button>' +
      '<div class="menu hide" id="userMenu" role="menu">' +
      '<div class="hd"><div class="n">' + PY.esc(u.name || u.login || '岛民') +
      (u.isAdmin ? '<span class="badge">站长</span>' : '') +
      '</div><div class="l">' + PY.esc(u.login ? '@' + u.login : '小蓝页账户') + '</div></div>' +
      '<div class="sep"></div>' +
      '<a role="menuitem" href="profile.html">我的主页</a>' +
      '<a role="menuitem" href="settings.html">设置</a>' +
      '<a role="menuitem" id="afdianItem" href="' + PY.AFDIAN_URL + '" target="_blank" rel="noopener">⚡ 发电支持 · 升级</a>' +
      '<div class="sep"></div>' +
      '<button role="menuitem" id="logoutBtn">退出登录</button>' +
      '</div>';

    slot.appendChild(wrap);

    // 发电入口带上当前用户标识，便于 webhook 自动归因
    const afd = wrap.querySelector('#afdianItem');
    if (afd) afd.href = PY.afdianUrl(u && u.sub);

    const btn = wrap.querySelector('#avatarBtn');
    const menu = wrap.querySelector('#userMenu');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = menu.classList.toggle('hide');
      btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    });
    document.addEventListener('click', () => {
      menu.classList.add('hide');
      btn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.add('hide');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    wrap.querySelector('#logoutBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.logout();
    });
  },
};

/* ============================================================
   统一挂载：主题按钮 + 岛民头像
   页面里放 <div class="hdr-right" id="hdrRight"></div> 即可。
   ============================================================ */
PY.mountHeader = async function () {
  const slot = document.getElementById('hdrRight');
  if (!slot) return;

  const tb = document.createElement('button');
  tb.id = 'themeToggle';
  tb.className = 'theme-btn';
  tb.type = 'button';
  slot.appendChild(tb);

  PY.theme.init();
  await PY.user.mount('hdrRight');
};

// SSO 回调带回的错误码 → 顶部提示条
PY.showSsoNotice = function () {
  const code = new URLSearchParams(location.search).get('sso');
  if (!code) return;
  const map = {
    bad_params: '登录参数不完整，请重试。',
    bad_state: '登录校验失败（可能是链接过期），请重试。',
    not_ready: '站点尚未就绪，请稍后重试。',
    not_configured: '站点未配置登录密钥，请联系站长。',
    token_failed: '身份校验未通过，请重新登录。',
    ok: '',
  };
  const msg = map[code] !== undefined ? map[code] : '登录未完成。';
  if (!msg) return;

  const bar = document.createElement('div');
  bar.className = 'notice err';
  bar.style.maxWidth = '1180px';
  bar.style.margin = '14px auto -6px';
  bar.style.width = 'calc(100% - 40px)';
  bar.textContent = msg;
  const main = document.querySelector('main');
  if (main && main.parentNode) main.parentNode.insertBefore(bar, main);
  else document.body.appendChild(bar);

  setTimeout(() => bar.remove(), 6000);
};

// 立刻应用主题（避免首屏闪白/闪黑），随后再挂载交互
PY.theme.apply(PY.theme.resolve());

