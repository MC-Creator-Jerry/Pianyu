/* 片屿 PIANYU —— 中英双语引擎（xl_lang 约定） */
(function () {
  var LS_KEY = 'xl_lang';

  function getLang() {
    try { return localStorage.getItem(LS_KEY) === 'en' ? 'en' : 'zh'; }
    catch (e) { return 'zh'; }
  }

  var DIC = {
    'nav.home': { zh: '首页', en: 'Home' },
    'nav.map': { zh: '岛图', en: 'Island Map' },
    'nav.new': { zh: '上新', en: 'Upload' },
    'nav.creator': { zh: '创作岛', en: 'Creator Island' },
    'nav.manage': { zh: '管理', en: 'Manage' },
    'theme.toggle': { zh: '切换明暗', en: 'Toggle theme' },
    'search.placeholder': { zh: '搜索标题 / 简介 / 标签…', en: 'Search title / description / tags…' },
    'sort.newest': { zh: '最新', en: 'Latest' },
    'sort.views': { zh: '流量', en: 'Popular' },
    'btn.clear': { zh: '清空', en: 'Clear' },
    'empty': { zh: '这里还是一片空岛 —— 去 上新 放上第一个视频吧。', en: 'This island is empty — upload your first video from 上新.' },
    'footer.copy': { zh: '© ', en: '© ' },
    'footer.tagline': { zh: '独立站点 · 独立后端（Cloudflare Pages + Functions）', en: 'Independent site · own backend (Cloudflare Pages + Functions)' },
    'footer.motto': { zh: '小岛不大，好片管够。', en: 'A small isle — and plenty of good films.' },
    'footer.main': { zh: '小蓝页（主站）', en: 'Xiaolan (main site)' }
  };

  function t(k) {
    var d = DIC[k];
    if (!d) return k;
    var l = getLang();
    return d[l] != null ? d[l] : (d.zh != null ? d.zh : k);
  }

  var mo = null;
  function apply() {
    if (mo) mo.disconnect();
    var l = getLang();
    document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
    document.documentElement.setAttribute('data-lang', l);
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-i18n');
      var txt = t(k);
      if (txt != null) nodes[i].textContent = txt;
    }
    var phs = document.querySelectorAll('[data-i18n-ph]');
    for (var p = 0; p < phs.length; p++) {
      var pt = t(phs[p].getAttribute('data-i18n-ph'));
      if (pt != null) phs[p].setAttribute('placeholder', pt);
    }
    var tg = document.querySelectorAll('[data-lang-toggle]');
    for (var j = 0; j < tg.length; j++) {
      tg[j].textContent = l === 'en' ? '中文' : 'EN';
      tg[j].setAttribute('title', l === 'en' ? '切换到中文' : 'Switch to English');
    }
    if (mo) mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function setLang(l) {
    try { localStorage.setItem(LS_KEY, l); } catch (e) {}
    apply();
  }

  function observe() {
    if (!('MutationObserver' in window)) return;
    mo = new MutationObserver(function () { apply(); });
  }

  window.__t = t;
  window.__lang = getLang;
  window.__setLang = setLang;
  window.__applyLang = apply;

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-lang-toggle]') : null;
    if (el) { setLang(getLang() === 'en' ? 'zh' : 'en'); }
  });
  document.addEventListener('DOMContentLoaded', function () { observe(); apply(); });
  apply();
})();
