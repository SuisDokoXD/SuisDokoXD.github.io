/**
 * 星空聚合登录 —— 博客前端
 * ------------------------------------------------------------------
 * 依赖：window.SL_CONFIG = { api, providers, ... }（由 Butterfly inject 注入）
 *
 * 功能：
 *   1. 导航栏「登录」入口 + 第三方登录弹窗（QQ / 微信 / 微博 / 百度 / 华为 / Gitee / GitHub …）
 *   2. 处理 xkzhi 授权回跳（?type=xx&code=xx）→ 交给 Worker 换用户信息 → 落地本站会话
 *   3. 文章页评论模块：只有登录（拿到 Worker 签发的 token）才能发言
 *
 * 注意：本站开启了 PJAX，DOM 会被整块替换，所以所有渲染都必须可重复执行且幂等。
 */
(function () {
  'use strict';

  var CFG = window.SL_CONFIG || {};
  var API = String(CFG.api || '').replace(/\/+$/, '');
  var PROVIDERS = (CFG.providers && CFG.providers.length)
    ? CFG.providers
    : ['qq', 'wx', 'sina', 'baidu', 'huawei', 'gitee', 'github'];
  var HIDE_GISCUS = CFG.hideGiscus === true;
  var COMMENT_TITLE = CFG.commentTitle || '社交账号评论';
  // 两套评论并存时，把 Giscus 那块标题写明白，
  // 否则读者会以为「评论」区就是唯一入口，然后被 GitHub 登录卡住
  var GISCUS_TITLE = CFG.giscusTitle || 'GitHub 评论（需 GitHub 账号）';

  var SESSION_KEY = 'sl_session_v1';
  var RETURN_KEY = 'sl_return_v1';
  var PENDING_KEY = 'sl_pending_v1';

  var NAMES = {
    qq: 'QQ', wx: '微信', sina: '微博', baidu: '百度', huawei: '华为',
    google: 'Google', microsoft: '微软', dingtalk: '钉钉', gitee: 'Gitee', github: 'GitHub'
  };
  var ICONS = {
    qq: 'fa-brands fa-qq', wx: 'fa-brands fa-weixin', sina: 'fa-brands fa-weibo',
    github: 'fa-brands fa-github', gitee: 'fa-brands fa-git-alt',
    google: 'fa-brands fa-google', microsoft: 'fa-brands fa-microsoft',
    dingtalk: 'fa-brands fa-dingtalk', baidu: 'fa-solid fa-paw', huawei: 'fa-solid fa-star'
  };

  // ------------------------------------------------------------ 会话存取

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && parsed.token) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* 隐私模式下 localStorage 可能不可用 */ }
  }

  function currentUser() {
    var session = loadSession();
    return session ? session.user : null;
  }

  /**
   * 用服务端校验一次登录态。
   * 目的：token 过期或被旁路清除后，界面不能一直显示一个假的"已登录"。
   * 策略：1 小时内校验过就跳过；网络异常时不踢人下线，只保留本地缓存。
   * 返回 Promise<{ invalidated: boolean, userChanged: boolean }>
   */
  function refreshSession() {
    var session = loadSession();
    var idle = { invalidated: false, userChanged: false };
    if (!session || !session.token) return Promise.resolve(idle);
    if (session.checkedAt && Date.now() - session.checkedAt < 60 * 60 * 1000) {
      return Promise.resolve(idle);
    }

    return request('/api/me', { auth: true })
      .then(function (result) {
        if (result.status === 200 && result.data.code === 0) {
          var before = JSON.stringify(session.user || {});
          session.user = result.data.user;
          session.checkedAt = Date.now();
          saveSession(session);
          return { invalidated: false, userChanged: before !== JSON.stringify(session.user) };
        }
        if (result.status === 401) {
          saveSession(null);
          return { invalidated: true, userChanged: true };
        }
        return idle; // 服务端抽风，先不动用户的登录态
      })
      .catch(function () {
        return idle;
      });
  }

  // ------------------------------------------------------------ 请求封装

  function request(path, options) {
    var opts = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var session = loadSession();
    if (opts.auth && session) headers.Authorization = 'Bearer ' + session.token;

    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    }).then(function (response) {
      return response.json().catch(function () {
        return { code: -1, msg: 'HTTP ' + response.status };
      }).then(function (data) {
        return { status: response.status, data: data };
      });
    });
  }

  // ------------------------------------------------------------ 小工具

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(classes) {
    return el('i', classes);
  }

  function providerName(type) {
    // 注意：type 缺失时要返回 null，不能返回 undefined，
    // 否则拼接出来会变成字面量「undefined 登录」显示给用户
    if (!type) return null;
    return NAMES[type] || type;
  }

  function relativeTime(seconds) {
    var diff = Math.floor(Date.now() / 1000) - Number(seconds || 0);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
    var d = new Date(Number(seconds) * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function toast(message, isError) {
    var node = document.getElementById('sl-toast');
    if (!node) {
      node = el('div', 'sl-toast');
      node.id = 'sl-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.className = 'sl-toast sl-toast-show' + (isError ? ' sl-toast-error' : '');
    clearTimeout(node.__timer);
    node.__timer = setTimeout(function () {
      node.className = 'sl-toast';
    }, 3200);
  }

  function avatarNode(url, name, className) {
    var wrap = el('span', className || 'sl-avatar');
    if (url) {
      var img = el('img');
      img.src = url;
      img.alt = name || '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        img.remove();
        wrap.textContent = (name || '?').slice(0, 1);
      };
      wrap.appendChild(img);
    } else {
      wrap.textContent = (name || '?').slice(0, 1);
    }
    return wrap;
  }

  // ------------------------------------------------------------ 登录弹窗

  function providerButton(type, onPick) {
    var btn = el('button', 'sl-provider sl-provider-' + type);
    btn.type = 'button';
    btn.appendChild(icon(ICONS[type] || 'fa-solid fa-key'));
    btn.appendChild(el('span', null, providerName(type)));
    btn.addEventListener('click', function () { onPick(type); });
    return btn;
  }

  function openLoginModal(reason) {
    closeLoginModal();

    var mask = el('div', 'sl-mask');
    mask.id = 'sl-mask';

    var modal = el('div', 'sl-modal');
    var head = el('div', 'sl-modal-head');
    head.appendChild(el('strong', null, '选择登录方式'));
    var close = el('button', 'sl-modal-close');
    close.type = 'button';
    close.appendChild(icon('fa-solid fa-xmark'));
    close.addEventListener('click', closeLoginModal);
    head.appendChild(close);
    modal.appendChild(head);

    if (reason) modal.appendChild(el('p', 'sl-modal-tip', reason));

    var grid = el('div', 'sl-provider-grid');
    PROVIDERS.forEach(function (type) {
      grid.appendChild(providerButton(type, startLogin));
    });
    modal.appendChild(grid);

    modal.appendChild(el('p', 'sl-modal-note', '登录后即可参与评论。本站只保存第三方返回的昵称、头像与唯一 ID，不会接触你的账号密码。'));

    mask.appendChild(modal);
    mask.addEventListener('click', function (event) {
      if (event.target === mask) closeLoginModal();
    });
    document.body.appendChild(mask);

    var onKey = function (event) {
      if (event.key === 'Escape') {
        closeLoginModal();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  function closeLoginModal() {
    var mask = document.getElementById('sl-mask');
    if (mask) mask.remove();
  }

  // ------------------------------------------------------------ 发起登录

  function startLogin(type) {
    var buttons = document.querySelectorAll('#sl-mask .sl-provider');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;

    try {
      sessionStorage.setItem(RETURN_KEY, location.pathname + location.search + location.hash);
      sessionStorage.setItem(PENDING_KEY, String(Date.now()));
    } catch (e) { /* ignore */ }

    request('/api/auth/start', { method: 'POST', body: { type: type } })
      .then(function (result) {
        var data = result.data;
        if (result.status !== 200 || data.code !== 0 || !data.url) {
          throw new Error(data.msg || '发起登录失败');
        }
        location.href = data.url;
      })
      .catch(function (error) {
        for (var i = 0; i < buttons.length; i++) buttons[i].disabled = false;
        toast('登录失败：' + (error.message || error), true);
      });
  }

  function logout() {
    saveSession(null);
    renderNav();
    renderComments();
    toast('已退出登录');
  }

  // ------------------------------------------------------------ 授权回跳处理

  function readCallbackParams() {
    var search = location.search.replace(/^\?/, '');
    if (!search) return null;
    var params = new URLSearchParams(search);
    var type = params.get('type');
    var code = params.get('code');
    if (!type || !code) return null;
    return { type: type, code: code };
  }

  function cleanUrl() {
    if (!history.replaceState) return;
    var url = location.pathname + location.hash;
    history.replaceState(null, document.title, url);
  }

  function handleCallback(params, attempt) {
    attempt = attempt || 1;
    var retries = attempt === 1 ? 10 : 8;

    showCallbackBanner('正在完成登录，请稍候…');

    request('/api/auth/callback', { method: 'POST', body: { type: params.type, code: params.code } })
      .then(function (result) {
        var data = result.data;

        // 202：用户还没完成授权（例如微信扫码未确认），稍后重试
        if (result.status === 202 || data.pending) {
          if (attempt < retries) {
            showCallbackBanner('等待授权确认…（第 ' + attempt + ' 次重试）');
            return new Promise(function (resolve) {
              setTimeout(function () { resolve(handleCallback(params, attempt + 1)); }, 1500);
            });
          }
          throw new Error('等待授权超时，请重新登录');
        }

        if (result.status !== 200 || data.code !== 0) {
          throw new Error(data.msg || '登录失败');
        }

        saveSession({ token: data.token, user: data.user, savedAt: Date.now(), checkedAt: Date.now() });
        try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }

        var back = '/';
        try {
          back = sessionStorage.getItem(RETURN_KEY) || '/';
          sessionStorage.removeItem(RETURN_KEY);
        } catch (e) { /* ignore */ }

        toast('欢迎回来，' + (data.user.nickname || '') + '！');
        showCallbackBanner('登录成功，正在跳转…');
        setTimeout(function () { location.replace(back); }, 600);
      })
      .catch(function (error) {
        showCallbackBanner('登录失败：' + (error.message || error), true);
        cleanUrl();
      });
  }

  function showCallbackBanner(message, isError) {
    var banner = document.getElementById('sl-callback-banner');
    if (!banner) {
      banner = el('div', 'sl-callback-banner');
      banner.id = 'sl-callback-banner';
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.className = 'sl-callback-banner sl-callback-banner-show' + (isError ? ' sl-callback-banner-error' : '');
  }

  // ------------------------------------------------------------ 导航栏

  function renderNav() {
    var menus = document.querySelector('#nav .menus_items');
    if (!menus) return;

    var existing = document.getElementById('sl-nav-entry');
    if (existing) existing.remove();

    var item = el('div', 'menus_item');
    item.id = 'sl-nav-entry';

    var user = currentUser();
    if (user) {
      var trigger = el('span', 'site-page sl-nav-user');
      trigger.appendChild(avatarNode(user.faceimg, user.nickname, 'sl-avatar sl-avatar-nav'));
      trigger.appendChild(el('span', null, user.nickname || '已登录'));
      trigger.appendChild(icon('fas fa-chevron-down'));
      item.appendChild(trigger);

      var dropdown = el('ul', 'menus_item_child sl-nav-dropdown');
      var info = el('li', 'sl-nav-info');
      info.appendChild(el('span', 'sl-nav-provider', '来自 ' + providerName(user.type)));
      dropdown.appendChild(info);
      var logoutItem = el('li');
      var logoutLink = el('a', 'site-page child');
      logoutLink.href = 'javascript:;';
      logoutLink.appendChild(icon('fa-solid fa-right-from-bracket'));
      logoutLink.appendChild(el('span', null, ' 退出登录'));
      logoutLink.addEventListener('click', logout);
      logoutItem.appendChild(logoutLink);
      dropdown.appendChild(logoutItem);
      item.appendChild(dropdown);
    } else {
      var loginLink = el('a', 'site-page');
      loginLink.href = 'javascript:;';
      loginLink.appendChild(icon('fa-solid fa-user-circle'));
      loginLink.appendChild(el('span', null, ' 登录'));
      loginLink.addEventListener('click', function () { openLoginModal(); });
      item.appendChild(loginLink);
    }

    menus.appendChild(item);
  }

  // ------------------------------------------------------------ 评论模块

  function pagePath() {
    var path = location.pathname || '/';
    if (!path.endsWith('/')) path += '/';
    return path;
  }

  /**
   * 两套评论并存时，把 Giscus 的标题改清楚（只动标题文案和图标，别处不碰）。
   * 打标记，所以重复执行是幂等的；PJAX 重建 DOM 后标记会消失，会重新打上。
   */
  function labelGiscus(container) {
    var headline = container.querySelector('.comment-head .comment-headline');
    if (!headline || headline.getAttribute('data-sl-labeled') === '1') return;
    var icon = headline.querySelector('i');
    if (icon) icon.className = ICONS.github + ' fa-fw';
    var text = headline.querySelector('span');
    if (text) text.textContent = GISCUS_TITLE;
    headline.setAttribute('data-sl-labeled', '1');
  }

  function renderComments() {
    var container = document.getElementById('post-comment');
    if (!container) return;

    if (HIDE_GISCUS) {
      var giscus = container.querySelector('.comment-head, .comment-wrap');
      if (giscus) container.classList.add('sl-giscus-hidden');
    } else {
      labelGiscus(container);
    }

    var section = document.getElementById('sl-comments');
    if (!section) {
      section = el('section', 'sl-comments');
      section.id = 'sl-comments';
      container.insertBefore(section, container.firstChild);
    }

    section.textContent = '';

    var head = el('div', 'sl-comments-head');
    head.appendChild(icon('fa-solid fa-comments'));
    head.appendChild(el('span', 'sl-comments-title', ' ' + COMMENT_TITLE));
    var countNode = el('span', 'sl-comments-count', '');
    head.appendChild(countNode);
    section.appendChild(head);

    section.appendChild(buildEditor());

    var listNode = el('div', 'sl-list');
    listNode.id = 'sl-list';
    listNode.appendChild(el('p', 'sl-empty', '加载评论中…'));
    section.appendChild(listNode);

    loadComments(countNode, listNode);
  }

  function buildEditor() {
    var box = el('div', 'sl-editor');
    var user = currentUser();

    if (!user) {
      var prompt = el('div', 'sl-login-prompt');
      prompt.appendChild(el('p', 'sl-login-text', '登录后即可发表评论'));
      var row = el('div', 'sl-provider-grid sl-provider-grid-inline');
      PROVIDERS.forEach(function (type) {
        row.appendChild(providerButton(type, startLogin));
      });
      prompt.appendChild(row);
      box.appendChild(prompt);
      return box;
    }

    var header = el('div', 'sl-editor-user');
    header.appendChild(avatarNode(user.faceimg, user.nickname, 'sl-avatar'));
    var meta = el('div', 'sl-editor-meta');
    meta.appendChild(el('strong', null, user.nickname || ''));
    var providerLabel = providerName(user.type);
    if (providerLabel) meta.appendChild(el('span', 'sl-editor-provider', providerLabel + ' 登录'));
    header.appendChild(meta);
    box.appendChild(header);

    var textarea = el('textarea', 'sl-textarea');
    textarea.placeholder = '说点什么吧…（最多 1000 字）';
    textarea.maxLength = 1000;
    box.appendChild(textarea);

    var footer = el('div', 'sl-editor-footer');
    var counter = el('span', 'sl-counter', '0 / 1000');
    footer.appendChild(counter);

    var submit = el('button', 'sl-submit');
    submit.type = 'button';
    submit.textContent = '发表评论';
    submit.classList.add('sl-submit-disabled');
    footer.appendChild(submit);
    box.appendChild(footer);

    textarea.addEventListener('input', function () {
      counter.textContent = textarea.value.length + ' / 1000';
      submit.classList.toggle('sl-submit-disabled', !textarea.value.trim());
    });

    submit.addEventListener('click', function () {
      var content = textarea.value.trim();
      if (!content || submit.disabled) return;
      submit.disabled = true;
      submit.textContent = '发表中…';

      request('/api/comments', { method: 'POST', auth: true, body: { path: pagePath(), content: content } })
        .then(function (result) {
          if (result.status === 401) {
            saveSession(null);
            throw new Error('登录已过期，请重新登录');
          }
          if (result.status !== 201 || result.data.code !== 0) {
            throw new Error(translateError(result.data));
          }
          textarea.value = '';
          counter.textContent = '0 / 1000';
          toast('评论发表成功');
          renderComments();
        })
        .catch(function (error) {
          toast(error.message || '发表失败', true);
        })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = '发表评论';
        });
    });

    return box;
  }

  function translateError(data) {
    var map = {
      rate_limited: '发言太快啦，请稍等一会儿',
      content_too_long: '评论太长了',
      empty_content: '评论不能为空',
      unauthorized: '请先登录',
      invalid_token: '登录已过期，请重新登录',
      token_expired: '登录已过期，请重新登录'
    };
    return map[data && data.msg] || (data && data.msg) || '请求失败';
  }

  function loadComments(countNode, listNode) {
    request('/api/comments?path=' + encodeURIComponent(pagePath()))
      .then(function (result) {
        if (result.status !== 200 || result.data.code !== 0) {
          throw new Error(translateError(result.data));
        }
        renderList(listNode, result.data.comments || []);
        countNode.textContent = result.data.count ? '（' + result.data.count + '）' : '';
      })
      .catch(function (error) {
        listNode.textContent = '';
        listNode.appendChild(el('p', 'sl-empty', '评论加载失败：' + (error.message || error)));
      });
  }

  function renderList(listNode, comments) {
    listNode.textContent = '';
    if (!comments.length) {
      listNode.appendChild(el('p', 'sl-empty', '还没有评论，来做第一个吧～'));
      return;
    }

    var me = currentUser();

    comments.forEach(function (comment) {
      var item = el('div', 'sl-item');
      item.appendChild(avatarNode(comment.faceimg, comment.nickname, 'sl-avatar'));

      var body = el('div', 'sl-item-body');
      var head = el('div', 'sl-item-head');
      head.appendChild(el('strong', 'sl-item-name', comment.nickname || '匿名'));
      head.appendChild(el('span', 'sl-badge', providerName(comment.type)));
      head.appendChild(el('span', 'sl-item-time', relativeTime(comment.created_at)));

      if (me && me.uid === comment.uid) {
        var del = el('a', 'sl-item-delete', '删除');
        del.href = 'javascript:;';
        del.addEventListener('click', function () { deleteComment(comment.id); });
        head.appendChild(del);
      }
      body.appendChild(head);

      var content = el('div', 'sl-item-content');
      String(comment.content).split('\n').forEach(function (line, index) {
        if (index > 0) content.appendChild(document.createElement('br'));
        content.appendChild(document.createTextNode(line));
      });
      body.appendChild(content);

      item.appendChild(body);
      listNode.appendChild(item);
    });
  }

  function deleteComment(id) {
    if (!window.confirm('确定要删除这条评论吗？')) return;
    request('/api/comments/' + id, { method: 'DELETE', auth: true })
      .then(function (result) {
        if (result.status !== 200) throw new Error(translateError(result.data));
        toast('已删除');
        renderComments();
      })
      .catch(function (error) {
        toast(error.message || '删除失败', true);
      });
  }

  // ------------------------------------------------------------ 启动 / PJAX

  function boot() {
    if (!API || /REPLACE|YOUR-WORKER|example\.com/i.test(API)) {
      console.warn('[social-login] 未配置 window.SL_CONFIG.api（当前值：' + (API || '空') + '），社交登录已停用');
      return;
    }
    renderNav();
    renderComments();

    // 先按本地缓存渲染（快），再静默校验一次登录态
    refreshSession().then(function (state) {
      if (state.invalidated) {
        toast('登录已过期，请重新登录', true);
        renderNav();
        renderComments();
      } else if (state.userChanged) {
        renderNav(); // 只刷导航，避免打断正在输入的评论
      }
    });
  }

  function onNavigation() {
    boot();
    // 评论容器可能被主题的 lazyload 延后填充，稍后再补一次
    setTimeout(boot, 400);
  }

  function init() {
    if (window.__SL_BOOTED__) return;
    window.__SL_BOOTED__ = true;

    var params = readCallbackParams();
    if (params && /\/login-callback\/?$/.test(location.pathname)) {
      handleCallback(params);
    } else if (params) {
      // 万一回调落到了别的页面
      handleCallback(params);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onNavigation);
    } else {
      onNavigation();
    }

    document.addEventListener('pjax:complete', onNavigation);
    document.addEventListener('pjax:success', onNavigation);
    window.addEventListener('popstate', onNavigation);
  }

  init();
})();
