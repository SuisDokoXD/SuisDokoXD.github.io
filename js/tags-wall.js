/**
 * 标签/分类「文章墙」 —— 把空荡荡的标签云/分类列表入口页，补上按标签
 * （或分类）分组铺开的文章卡片，让页面真正有内容可看、可点。
 *
 *   · 数据来自构建期生成的 /api/posts.json（见 scripts/posts-data.js）。
 *   · 只在标签云入口页（含 .tag-cloud-list）和分类入口页（含 .category-lists）
 *     运行；具体某个标签页 /tags/xxx/ 本身已是文章列表，不处理。
 *   · 卡片点击走 pjax 无刷新跳转，与全站切页过渡一致。
 *   · pjax 切到这两类页面时重渲染；重渲染前先清掉旧的墙，避免重复。
 */
(function () {
  // 转义，防止标题里的特殊字符破坏结构
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 单张文章卡片
  function buildCard(post) {
    var a = document.createElement('a');
    a.className = 'tw-card';
    a.href = post.url;
    var cover = post.cover || '/img/banner/bocchi-1.jpg';
    a.innerHTML =
      '<div class="tw-cover" style="background-image:url(' + cover + ')"></div>' +
      '<div class="tw-body">' +
        '<div class="tw-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="tw-date">' + (post.date || '') + '</div>' +
      '</div>';
    // 走 pjax，保持无刷新切页 + 过渡
    a.addEventListener('click', function (ev) {
      if (window.pjax) {
        ev.preventDefault();
        window.pjax.loadUrl(post.url);
      }
    });
    return a;
  }

  // 主流程
  function build() {
    var page = document.querySelector('#content-inner #page');
    if (!page) return;

    // 用页面特征判断是标签入口页还是分类入口页
    var mode = page.querySelector('.tag-cloud-list')
      ? 'tags'
      : (page.querySelector('.category-lists') ? 'categories' : null);
    if (!mode) return;

    // 清掉上一次渲染的墙（pjax 重渲染 / 重复触发时）
    var old = page.querySelector('#tags-wall');
    if (old) old.remove();

    fetch('/api/posts.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (posts) {
        // 按标签（或分类）分组；无标签的归到「未分类」
        var groups = {};
        posts.forEach(function (p) {
          var keys = (p[mode] && p[mode].length) ? p[mode] : ['未分类'];
          keys.forEach(function (k) {
            (groups[k] = groups[k] || []).push(p);
          });
        });

        // 文章多的分组排前面
        var names = Object.keys(groups).sort(function (a, b) {
          return groups[b].length - groups[a].length;
        });
        if (!names.length) return;

        var base = mode === 'tags' ? '/tags/' : '/categories/';
        var wall = document.createElement('div');
        wall.id = 'tags-wall';

        names.forEach(function (name) {
          var sec = document.createElement('section');
          sec.className = 'tw-group';
          sec.innerHTML =
            '<h2 class="tw-group-title">' +
              '<a href="' + base + encodeURIComponent(name) + '/">' +
                '<span class="tw-hash">#</span>' + escapeHtml(name) +
                '<span class="tw-count">' + groups[name].length + '</span>' +
              '</a>' +
            '</h2>';

          var grid = document.createElement('div');
          grid.className = 'tw-grid';
          groups[name].forEach(function (p) { grid.appendChild(buildCard(p)); });
          sec.appendChild(grid);
          wall.appendChild(sec);
        });

        page.appendChild(wall);
      })
      .catch(function (e) { console.debug('tags-wall load failed:', e); });
  }

  if (document.readyState !== 'loading') build();
  else document.addEventListener('DOMContentLoaded', build);
  document.addEventListener('pjax:complete', build);
})();
