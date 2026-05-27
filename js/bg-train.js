/**
 * 背景蒸汽列车 - 从右到左缓慢驶过 + 烟雾飘升
 * SuisDokoXD blog · bg-train
 */
(function () {
  // ---------- CSS ----------
  const style = document.createElement('style');
  style.textContent = `
    #bg-train {
      position: fixed;
      bottom: 12px;
      left: 100vw;
      width: 240px;
      height: 80px;
      pointer-events: none;
      z-index: 9000;
      opacity: 0.4;
      animation: train-pass 55s linear infinite;
      animation-delay: 6s;
      transition: opacity 0.4s;
      mix-blend-mode: multiply;
    }
    #bg-train svg { width: 100%; height: 100%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25)); }
    @keyframes train-pass {
      0%   { transform: translateX(0); }
      100% { transform: translateX(calc(-100vw - 260px)); }
    }

    /* 烟雾向上飘升 */
    #bg-train .smoke { animation: smoke-rise 2.2s ease-out infinite; transform-origin: center; }
    #bg-train .smoke-2 { animation-delay: 0.5s; }
    #bg-train .smoke-3 { animation-delay: 1.0s; }
    #bg-train .smoke-4 { animation-delay: 1.5s; }
    @keyframes smoke-rise {
      0%   { opacity: 0.75; transform: translate(0, 0) scale(0.6); }
      70%  { opacity: 0.35; }
      100% { opacity: 0; transform: translate(-8px, -38px) scale(1.6); }
    }

    /* 车头大灯一闪一闪 */
    #bg-train .headlight {
      animation: headlight-blink 3s ease-in-out infinite;
    }
    @keyframes headlight-blink {
      0%, 100% { opacity: 0.9; }
      50% { opacity: 0.4; }
    }

    /* 暗色模式下保持暗色融合 */
    [data-theme="dark"] #bg-train {
      opacity: 0.55;
      mix-blend-mode: screen;
    }

    /* 窄屏隐藏（手机上太挤） */
    @media (max-width: 768px) {
      #bg-train { display: none; }
    }
  `;
  document.head.appendChild(style);

  // ---------- SVG ----------
  const train = document.createElement('div');
  train.id = 'bg-train';
  train.setAttribute('aria-hidden', 'true');
  train.innerHTML = `
    <svg viewBox="0 0 260 90" xmlns="http://www.w3.org/2000/svg">
      <!-- 烟雾（4 朵交错升起） -->
      <ellipse class="smoke smoke-1" cx="38" cy="22" rx="10" ry="7" fill="rgba(220,220,225,0.85)"/>
      <ellipse class="smoke smoke-2" cx="38" cy="22" rx="12" ry="8" fill="rgba(230,230,235,0.75)"/>
      <ellipse class="smoke smoke-3" cx="38" cy="22" rx="14" ry="9" fill="rgba(240,240,245,0.65)"/>
      <ellipse class="smoke smoke-4" cx="38" cy="22" rx="11" ry="7" fill="rgba(235,235,240,0.55)"/>

      <!-- 烟囱 -->
      <rect x="30" y="30" width="16" height="22" fill="#1a1a1a" rx="1"/>
      <rect x="28" y="28" width="20" height="4" fill="#1a1a1a"/>

      <!-- 车头（暗红） -->
      <rect x="10" y="48" width="60" height="32" fill="#a93226" rx="4"/>
      <rect x="10" y="48" width="60" height="6" fill="#7b241c" rx="3"/>
      <!-- 车头灯 -->
      <circle class="headlight" cx="14" cy="64" r="4" fill="#fff8dc"/>
      <circle class="headlight" cx="14" cy="64" r="2" fill="#fff"/>

      <!-- 车厢 1（深蓝） -->
      <rect x="70" y="42" width="90" height="38" fill="#2c3e50" rx="3"/>
      <rect x="70" y="42" width="90" height="5" fill="#1b2631" rx="2"/>
      <!-- 车厢 1 窗户（黄光） -->
      <rect x="78" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="93" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="108" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="123" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="138" y="51" width="11" height="15" fill="#ffd700" rx="1"/>

      <!-- 车厢 2（深蓝） -->
      <rect x="165" y="42" width="85" height="38" fill="#2c3e50" rx="3"/>
      <rect x="165" y="42" width="85" height="5" fill="#1b2631" rx="2"/>
      <rect x="173" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="188" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="203" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="218" y="51" width="11" height="15" fill="#ffd700" rx="1"/>
      <rect x="233" y="51" width="11" height="15" fill="#ffd700" rx="1"/>

      <!-- 连接器 -->
      <rect x="68" y="62" width="4" height="6" fill="#555"/>
      <rect x="160" y="62" width="6" height="6" fill="#555"/>

      <!-- 车轮（带辐条） -->
      <g fill="#1a1a1a">
        <circle cx="22" cy="82" r="7"/>
        <circle cx="52" cy="82" r="7"/>
        <circle cx="85" cy="82" r="6"/>
        <circle cx="120" cy="82" r="6"/>
        <circle cx="150" cy="82" r="6"/>
        <circle cx="180" cy="82" r="6"/>
        <circle cx="215" cy="82" r="6"/>
        <circle cx="245" cy="82" r="6"/>
      </g>
      <g stroke="#555" stroke-width="1.5" fill="none">
        <circle cx="22" cy="82" r="4"/>
        <circle cx="52" cy="82" r="4"/>
      </g>
    </svg>
  `;

  function mount() {
    if (!document.getElementById('bg-train')) {
      document.body.appendChild(train);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  // pjax 切页保留
  document.addEventListener('pjax:complete', mount);
})();
