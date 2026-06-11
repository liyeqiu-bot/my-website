/*
 * 访问控制脚本：
 * - apply.html / admin.html 直接放行
 * - 访问申请、查询、审批数据保存到 Supabase 云端
 * - 管理员已登录后台时，也可直接查看主页
 * - 已审批访客：凭 isLoggedIn_<姓名> 7 天有效登录标记直接查看主页
 * - 未授权访客：不立即跳转，在当前主页显示模糊背景 + 身份选择弹窗
 */
(function () {
  var STORAGE_KEYS = {
    LOGIN_PREFIX: 'isLoggedIn_',
    ADMIN_SESSION: 'ac_admin_session'
  };

  var cachedApplications = [];

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

  function getConfig() {
    var cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey || !cfg.table) {
      throw new Error('Supabase 配置未加载，请检查 supabase-config.js。');
    }
    return cfg;
  }

  function toDbRecord(item) {
    var now = Date.now();
    var name = String(item.name || '').trim();
    return {
      id: item.id || ('a_' + now + '_' + Math.random().toString(36).slice(2, 7)),
      name: name,
      name_key: normName(name),
      reason: String(item.reason || '').trim(),
      status: item.status || 'pending',
      created_at: item.createdAt || item.created_at || now,
      updated_at: item.updatedAt || item.updated_at || now
    };
  }

  function fromDbRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function request(path, options) {
    var cfg = getConfig();
    var headers = {
      apikey: cfg.anonKey,
      Authorization: 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json'
    };
    options = options || {};
    if (options.prefer) headers.Prefer = options.prefer;

    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (text) {
          throw new Error(text || ('Supabase 请求失败：' + res.status));
        });
      }
      if (res.status === 204) return null;
      return res.text().then(function (text) {
        return text ? JSON.parse(text) : null;
      });
    });
  }

  window.AccessControl = window.AccessControl || {
    keys: STORAGE_KEYS,

    getApplications: function () {
      var cfg = getConfig();
      return request(cfg.table + '?select=*&order=updated_at.desc').then(function (rows) {
        cachedApplications = (rows || []).map(fromDbRecord);
        return cachedApplications;
      });
    },

    saveApplications: function (list) {
      cachedApplications = list || [];
      return Promise.all(cachedApplications.map(function (item) {
        return window.AccessControl.upsertApplication(item);
      }));
    },

    upsertApplication: function (item) {
      var cfg = getConfig();
      var row = toDbRecord(item);
      return request(cfg.table + '?on_conflict=name_key', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: row
      }).then(function (rows) {
        var rec = fromDbRecord(rows && rows[0]);
        return rec || fromDbRecord(row);
      });
    },

    findByName: function (name) {
      if (!name) return Promise.resolve(null);
      var cfg = getConfig();
      var key = encodeURIComponent(normName(name));
      return request(cfg.table + '?select=*&name_key=eq.' + key + '&limit=1').then(function (rows) {
        return fromDbRecord(rows && rows[0]);
      });
    },

    isApprovedName: function (name) {
      return this.findByName(name).then(function (rec) {
        return !!(rec && rec.status === 'approved');
      });
    },

    updateApplicationStatus: function (id, status) {
      var cfg = getConfig();
      return request(cfg.table + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        prefer: 'return=representation',
        body: {
          status: status,
          updated_at: Date.now()
        }
      }).then(function (rows) {
        return fromDbRecord(rows && rows[0]);
      });
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

  function showAccessGate(note) {
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
        '<div class="access-gate-note">' + (note || '申请通过后，再次打开主页链接可直接查看作品。') + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function checkVisitorAccess() {
    var name = window.AccessControl.getCurrentLoggedInName();
    if (!name) {
      showAccessGate();
      return;
    }
    window.AccessControl.isApprovedName(name).then(function (ok) {
      if (!ok) {
        window.AccessControl.clearLogin(name);
        showAccessGate('您的本机登录标记已失效或权限尚未通过，请重新申请或查询状态。');
      }
    }).catch(function () {
      showAccessGate('暂时无法连接云端审批服务，请稍后再试或联系管理员。');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkVisitorAccess);
  } else {
    checkVisitorAccess();
  }
})();
