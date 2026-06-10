/*
 * 访问控制脚本：
 * - apply.html / admin.html 直接放行
 * - 管理员已登录后台时，也可直接查看主页
 * - 已审批访客：凭 isLoggedIn_<姓名> 7 天有效登录标记直接查看主页
 * - 未授权访客：不立即跳转，在当前主页显示模糊背景 + 身份选择弹窗
 */
(function () {
  var STORAGE_KEYS = {
    APPLICATIONS: 'accessApplications',
    LOGIN_PREFIX: 'isLoggedIn_',
    ADMIN_SESSION: 'ac_admin_session'
  };

  function normName(name) {
    return String(name || '').trim().toLowerCase();
  }

  function getBaseDir() {
    var path = location.pathname || '/';
    return path.substring(0, path.lastIndexOf('/') + 1);
  }

  function buildUrl(file) {
    return getBaseDir() + file;
  }

  window.AccessControl = window.AccessControl || {
    keys: STORAGE_KEYS,

    getApplications: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS) || '[]');
      } catch (e) {
        return [];
      }
    },

    saveApplications: function (list) {
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(list));
    },

    findByName: function (name) {
      if (!name) return null;
      var list = this.getApplications();
      var key = normName(name);
      for (var i = 0; i < list.length; i++) {
        if (normName(list[i].name) === key) return list[i];
      }
      return null;
    },

    isApprovedName: function (name) {
      var rec = this.findByName(name);
      return !!(rec && rec.status === 'approved');
    },

    setLogin: function (name, days) {
      if (!name) return;
      var cleanName = String(name).trim();
      var ttl = (days || 7) * 24 * 60 * 60 * 1000;
      var data = { name: cleanName, expires: Date.now() + ttl };
      localStorage.setItem(
        STORAGE_KEYS.LOGIN_PREFIX + normName(cleanName),
        JSON.stringify(data)
      );
    },

    clearLogin: function (name) {
      localStorage.removeItem(STORAGE_KEYS.LOGIN_PREFIX + normName(name));
    },

    getCurrentLoggedInName: function () {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(STORAGE_KEYS.LOGIN_PREFIX) !== 0) continue;
        try {
          var v = JSON.parse(localStorage.getItem(k) || 'null');
          var name = v && (v.name || v.email);
          if (!name) continue;
          if (v.expires && v.expires < Date.now()) {
            localStorage.removeItem(k);
            continue;
          }
          return name;
        } catch (e) { /* ignore */ }
      }
      return null;
    },

    isAdminLoggedIn: function () {
      return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === '1';
    },

    // 兼容旧版本方法名，避免旧缓存脚本调用时报错
    findByEmail: function (email) { return this.findByName(email); },
    isApprovedEmail: function (email) { return this.isApprovedName(email); },
    getCurrentLoggedInEmail: function () { return this.getCurrentLoggedInName(); },
    isValidEmail: function () { return true; }
  };

  var path = (location.pathname || '').toLowerCase();
  var page = path.substring(path.lastIndexOf('/') + 1);
  if (!page) page = 'index.html';

  // 申请页、管理后台直接放行
  if (['apply.html', 'admin.html'].indexOf(page) !== -1) return;

  // 管理员已登录后台，允许直接查看主页
  if (window.AccessControl.isAdminLoggedIn()) return;

  // 已通过访客，允许直接查看主页
  var name = window.AccessControl.getCurrentLoggedInName();
  if (name && window.AccessControl.isApprovedName(name)) return;

  function ensureGateStyle() {
    if (document.getElementById('accessGateStyle')) return;
    var style = document.createElement('style');
    style.id = 'accessGateStyle';
    style.textContent = [
      'body.access-gate-locked { overflow: hidden; }',
      'body.access-gate-locked > :not(.access-gate-overlay) {',
      '  filter: blur(9px);',
      '  transform: scale(1.01);',
      '  transition: filter .25s ease, transform .25s ease;',
      '  pointer-events: none;',
      '  user-select: none;',
      '}',
      '.access-gate-overlay {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 999999;',
      '  display: grid;',
      '  place-items: center;',
      '  padding: 24px;',
      '  background: rgba(246, 238, 220, 0.58);',
      '  backdrop-filter: blur(10px);',
      '}',
      '.access-gate-card {',
      '  width: min(92vw, 520px);',
      '  border-radius: 28px;',
      '  padding: 34px;',
      '  background: rgba(255,255,255,.88);',
      '  border: 1px solid rgba(230,223,207,.95);',
      '  box-shadow: 0 28px 70px rgba(92, 73, 35, .22);',
      '  text-align: center;',
      '  font-family: -apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Microsoft YaHei\", \"Segoe UI\", sans-serif;',
      '  color: #1d1d1d;',
      '}',
      '.access-gate-mark {',
      '  width: 58px;',
      '  height: 58px;',
      '  margin: 0 auto 16px;',
      '  border-radius: 18px;',
      '  display: grid;',
      '  place-items: center;',
      '  color: #fff;',
      '  font-weight: 900;',
      '  letter-spacing: .04em;',
      '  background: linear-gradient(135deg, #f6a81d, #ff7a45);',
      '  box-shadow: 0 14px 28px rgba(246, 168, 29, .28);',
      '}',
      '.access-gate-card h1 {',
      '  margin: 0;',
      '  color: #1f3a8a;',
      '  font-size: 28px;',
      '  line-height: 1.25;',
      '}',
      '.access-gate-card p {',
      '  margin: 12px auto 26px;',
      '  max-width: 390px;',
      '  color: #6b7280;',
      '  font-size: 15px;',
      '  line-height: 1.7;',
      '}',
      '.access-gate-actions {',
      '  display: grid;',
      '  grid-template-columns: 1fr 1fr;',
      '  gap: 12px;',
      '}',
      '.access-gate-btn {',
      '  min-height: 48px;',
      '  border-radius: 999px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  text-decoration: none;',
      '  font-size: 14px;',
      '  font-weight: 900;',
      '  border: 1px solid #e6dfcf;',
      '  transition: transform .16s ease, box-shadow .16s ease, background .16s ease;',
      '}',
      '.access-gate-btn:hover {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 12px 24px rgba(31, 41, 55, .12);',
      '}',
      '.access-gate-btn.primary {',
      '  color: #fff;',
      '  background: #ff7a45;',
      '  border-color: #ff7a45;',
      '}',
      '.access-gate-btn.secondary {',
      '  color: #1f3a8a;',
      '  background: #fffaf0;',
      '}',
      '.access-gate-note {',
      '  margin-top: 16px;',
      '  color: #8f8778;',
      '  font-size: 12px;',
      '}',
      '@media (max-width: 560px) {',
      '  .access-gate-card { padding: 26px 20px; }',
      '  .access-gate-actions { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function showAccessGate() {
    if (document.querySelector('.access-gate-overlay')) return;
    ensureGateStyle();
    document.body.classList.add('access-gate-locked');

    var overlay = document.createElement('div');
    overlay.className = 'access-gate-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '访问身份选择');
    overlay.innerHTML =
      '<div class="access-gate-card">' +
        '<div class="access-gate-mark">PA</div>' +
        '<h1>请选择访问身份</h1>' +
        '<p>当前页面需要访问权限。访客请先提交访问申请，管理员请进入审批后台处理申请。</p>' +
        '<div class="access-gate-actions">' +
          '<a class="access-gate-btn primary" href="' + buildUrl('apply.html') + '">访客申请访问</a>' +
          '<a class="access-gate-btn secondary" href="' + buildUrl('admin.html') + '">管理员登录</a>' +
        '</div>' +
        '<div class="access-gate-note">申请通过后，再次打开主页链接可直接查看作品。</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showAccessGate);
  } else {
    showAccessGate();
  }
})();
