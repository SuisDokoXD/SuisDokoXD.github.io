/**
 * 随机 banner —— 让首页/归档/标签/分类等「列表页」的页头背景随机轮播。
 *
 * 背景：butterfly 不支持给 index_img / archive_img / default_top_img 等配置
 *      使用数组，多张图会被 getBgPath 拼成非法的 url(a,b,c) ，导致 banner
 *      整张加载失败、只剩兜底的纯色背景。这里在 <head> 阶段（#page-header
 *      渲染之前）就注入一条 !important 背景规则：
 *        · !important 盖过主题写在元素上的坏掉内联 url，修复 banner；
 *        · 因为先于 #page-header 渲染，不会出现兜底色 → 随机图的闪烁。
 *      选择器只命中 .full_page（首页）与 .not-home-page（归档/标签/分类），
 *      不动 .post-bg —— 文章页用的是自己的单张封面，本来就是好的。
 */
(function () {
  // banner 图集，对应 source/img/banner/bocchi-1.jpg ... bocchi-15.jpg
  var banners = [];
  for (var i = 1; i <= 15; i++) {
    banners.push('/img/banner/bocchi-' + i + '.jpg');
  }

  // 从图集中随机取一张
  function pick() {
    return banners[Math.floor(Math.random() * banners.length)];
  }

  // 首屏：head 阶段注入随机背景样式，盖过主题坏掉的内联 background-image
  var style = document.createElement('style');
  style.id = 'random-banner-style';
  style.textContent =
    '#page-header.full_page,#page-header.not-home-page{' +
    'background-image:url(' + pick() + ') !important;}';
  document.head.appendChild(style);

  // butterfly 用 pjax 做无刷新切页，切页后给目标页头再换一张
  document.addEventListener('pjax:complete', function () {
    var next = pick();
    document
      .querySelectorAll('#page-header.full_page,#page-header.not-home-page')
      .forEach(function (el) {
        el.style.setProperty('background-image', 'url(' + next + ')', 'important');
      });
  });
})();
