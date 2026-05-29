/**
 * 苹果风切页过渡 —— 配合 butterfly pjax 无刷新切页。
 *
 *   · 顶部 2px 渐变进度条：pjax:send 时淡入并推进到 ~80%（模拟加载中），
 *     pjax:complete 时走满 100% 再淡出复位。
 *   · 主内容 #content-inner 入场：淡入 + 轻微上移（动画在 css 里，
 *     这里负责「移除 class → 强制 reflow → 重新加上」来重放）。
 *
 * 本脚本只随页面加载一次（不在 pjax 的替换选择器范围内），所以事件
 * 监听器只注册一次、持续有效，pjax 多次切页都不会重复绑定。
 */
(function () {
  // 顶部进度条元素：整站只创建一个
  var bar = document.createElement('div');
  bar.id = 'pjax-progress';
  document.body.appendChild(bar);

  var resetTimer = null;

  // 进度条开始：淡入并推进到 80%，营造「正在加载」的观感
  function startBar() {
    clearTimeout(resetTimer);
    bar.classList.add('active');
    bar.style.width = '0';
    // 下一帧再设目标宽度，确保 width 过渡被触发
    requestAnimationFrame(function () {
      bar.style.width = '80%';
    });
  }

  // 进度条完成：走满 → 淡出 → 宽度复位（避免下次从满格缩回）
  function finishBar() {
    bar.style.width = '100%';
    resetTimer = setTimeout(function () {
      bar.classList.remove('active');
      setTimeout(function () {
        bar.style.width = '0';
      }, 250);
    }, 200);
  }

  // 重放主内容入场动画
  function playContentEnter() {
    var el = document.getElementById('content-inner');
    if (!el) return;
    el.classList.remove('pjax-enter');
    void el.offsetWidth; // 强制 reflow，让 css 动画从头播放
    el.classList.add('pjax-enter');
  }

  // 首次进站也播一次，保持与切页一致的观感
  if (document.readyState !== 'loading') {
    playContentEnter();
  } else {
    document.addEventListener('DOMContentLoaded', playContentEnter);
  }

  // pjax 事件钩子
  document.addEventListener('pjax:send', startBar);
  document.addEventListener('pjax:complete', function () {
    finishBar();
    playContentEnter();
  });
})();
