/**
 * Live2D 看板娘自定义"台词皮肤" - Yorushika / Bocchi 主题
 * 用户曾要求"别让她说话"，所以默认隐藏气泡；这里只在特定事件（点击切换模型）时静默地切换模型。
 * 同时把双击/拖拽提示等改成主题化文案，但通过 CSS 隐藏，仅作为可选项保留。
 */
(function () {
  // 自定义模型轮换：每次访问随机选一个模型 id (live2d-api 提供的模型池)
  // stevenjoezhang/live2d-widget 默认 API 有 ~50 个模型
  function pickRandomModel() {
    try {
      const KEY = 'modelId';
      const last = localStorage.getItem(KEY);
      const pool = [1, 2, 4, 5, 8, 13, 18, 24, 30, 36, 42, 48];
      const next = pool[Math.floor(Math.random() * pool.length)];
      // 仅在没有用户手动选择过模型时随机
      if (last === null) {
        localStorage.setItem(KEY, next);
      }
    } catch (e) {}
  }

  // 隐藏所有 waifu-tips 气泡（用户偏好）
  function hideTips() {
    const tips = document.getElementById('waifu-tips');
    if (tips) tips.style.display = 'none';
  }

  pickRandomModel();
  document.addEventListener('DOMContentLoaded', hideTips);
  // 定期再藏一次，因为 widget 会异步插入
  setTimeout(hideTips, 1500);
  setTimeout(hideTips, 4000);
  document.addEventListener('pjax:complete', hideTips);
})();
