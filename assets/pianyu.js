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
        <div class="meta"><span>${window.PY.fmtViews(v.views)} 位岛民看过</span><span>${window.PY.fmtDate(v.createdAt)}</span></div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>`;
    return a;
  },

  async isAdmin() {
    const { data } = await this.api('/api/admin/me');
    return !!(data && data.loggedIn);
  },

  mountHeader() {
    // Shared-ish header helpers can live here if needed later.
  },
};
