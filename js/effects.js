/**
 * 樱花飘落 + 3D 卡片倾斜
 * SuisDokoXD blog effects bundle
 */

// 🌸 樱花飘落 - sakura-js
(function () {
  const s = document.createElement('script');
  s.src = 'https://fastly.jsdelivr.net/npm/sakura-js@1.1.4/dist/sakura.min.js';
  s.async = true;
  s.onload = function () {
    if (typeof Sakura === 'undefined') return;
    new Sakura('body', {
      // 浅粉 + 杏色渐变（贴合 bocchi 配色）
      colors: [
        {
          gradientColorStart: 'rgba(255, 183, 197, 0.85)',
          gradientColorEnd: 'rgba(255, 197, 208, 0.85)',
          gradientColorDegree: 120,
        },
        {
          gradientColorStart: 'rgba(255, 220, 220, 0.85)',
          gradientColorEnd: 'rgba(255, 235, 235, 0.85)',
          gradientColorDegree: 120,
        },
        {
          gradientColorStart: 'rgba(255, 165, 175, 0.85)',
          gradientColorEnd: 'rgba(255, 200, 200, 0.85)',
          gradientColorDegree: 120,
        },
      ],
      delay: 300,      // 飘落间隔 ms
      fallSpeed: 1.4,  // 飘落速度倍率
      minSize: 8,
      maxSize: 16,
    });
  };
  document.head.appendChild(s);
})();

// 🎴 3D 卡片倾斜 - vanilla-tilt
(function () {
  const s = document.createElement('script');
  s.src = 'https://fastly.jsdelivr.net/npm/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js';
  s.async = true;
  s.onload = function () {
    if (typeof VanillaTilt === 'undefined') return;

    function applyTilt() {
      // Butterfly 首页文章卡片 = .recent-post-item，friend-link 卡片 = .flink-list-item
      const targets = document.querySelectorAll(
        '.recent-post-item, .flink-list-item'
      );
      if (!targets.length) return;
      VanillaTilt.init(targets, {
        max: 6,
        speed: 500,
        glare: true,
        'max-glare': 0.15,
        scale: 1.02,
        perspective: 1200,
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyTilt);
    } else {
      applyTilt();
    }
    // Butterfly 切页（pjax）时重新挂载
    document.addEventListener('pjax:complete', applyTilt);
  };
  document.head.appendChild(s);
})();
