/**
 * 背景墨晕：按设备能力决定动不动
 *
 * 设计取舍：
 *  - 默认「不动」。只有明确判断这台设备能扛，才挂上 150s 的极慢漂移。
 *  - 这样最坏情况就是一张静态纸底，绝不会因为背景卡顿。
 *
 * 判据（任一命中就不动）：
 *  1. 系统开了「减少动态效果」
 *  2. 设备内存 <= 4GB
 *  3. CPU 逻辑核心 <= 4
 *  4. 粗指针（触屏为主）+ 小屏 —— 手机上省电优先
 *
 * 提供全局开关：
 *  window.__BTF_WEB_BG__ = { force: true | false }  // 调试时强制开关
 */

(function () {
  'use strict';

  var bg = document.getElementById('web_bg');
  if (!bg) return;

  var override = window.__BTF_WEB_BG__ && window.__BTF_WEB_BG__.force;

  function canAnimate() {
    if (override === true) return true;
    if (override === false) return false;

    // 尊重系统辅助功能设置
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
    } catch (e) { /* 老浏览器忽略 */ }

    // 内存（只有部分浏览器暴露）
    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4) {
      return false;
    }

    // 逻辑核心数
    if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) {
      return false;
    }

    // 粗指针（触屏）且短边较小 —— 手机/平板上关掉，省电
    try {
      var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      var smallViewport = Math.min(window.innerWidth, window.innerHeight) < 600;
      if (coarse && smallViewport) return false;
    } catch (e) { /* 忽略 */ }

    return true;
  }

  if (canAnimate()) {
    bg.classList.add('ink-motion');
  }

  // 页面切到后台时暂停动画，回来再继续（省电，也避免长时间挂后台掉帧）
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      bg.classList.remove('ink-motion');
    } else if (canAnimate()) {
      bg.classList.add('ink-motion');
    }
  });
})();
