/**
 * 侧边栏「网站资讯」兜底
 *
 * 解决两个真实故障：
 *   1. 已运行时间 / 最后更新时间 原本全靠 main.js 的 refreshFn 里计算。
 *      一旦 main.js 因任何原因没跑完（缓存混版、第三方脚本报错、
 *      主题升级）它们就永远停在模板里的转圈图标上。
 *      这里自己算，不再依赖 main.js。
 *   2. 访客数 / 访问量 依赖第三方统计服务。服务挂了就会无限转圈。
 *      这里给了超时兜底：仍没数据就显示「—」并说明原因，不再转。
 *
 * 同时兼容 pjax（本主题开了 pjax，脚本只加载一次，必须能重复执行）。
 */

(function () {
  'use strict';

  var FALLBACK_AFTER = 8000;   // 等统计服务的宽限期（实测 Vercount 约 5~8s 返回）
  var timers = [];

  function done(el) {
    return el && el.getAttribute('data-webinfo-done') === '1';
  }

  function mark(el, text) {
    if (!el) return;
    el.textContent = text;
    el.setAttribute('data-webinfo-done', '1');
  }

  // 与主题 btf.diffDate 一致的量级：返回天数
  function daysSince(dateStr) {
    var t = new Date(dateStr).getTime();
    if (isNaN(t)) return null;
    var diff = Date.now() - t;
    if (diff < 0) return 0;
    return Math.floor(diff / 86400000);
  }

  // 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前
  function relative(dateStr) {
    var t = new Date(dateStr).getTime();
    if (isNaN(t)) return null;
    var diff = Date.now() - t;
    if (diff < 0) diff = 0;
    var m = Math.floor(diff / 60000);
    if (m < 1) return '\u521A\u521A';
    if (m < 60) return m + ' \u5206\u949F\u524D';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' \u5C0F\u65F6\u524D';
    return Math.floor(h / 24) + ' \u5929\u524D';
  }

  function fillRuntime() {
    var el = document.getElementById('runtimeshow');
    if (!el || done(el)) return;
    var d = daysSince(el.getAttribute('data-publishDate'));
    if (d === null) return;
    // 单位跟主题语言包走，取不到就用「天」
    var unit = '\u5929';
    try {
      if (window.GLOBAL_CONFIG && typeof window.GLOBAL_CONFIG.runtime === 'string' && window.GLOBAL_CONFIG.runtime) {
        unit = window.GLOBAL_CONFIG.runtime;
      }
    } catch (e) {}
    mark(el, d + ' ' + unit);
  }

  function fillLastPush() {
    var el = document.getElementById('last-push-date');
    if (!el || done(el)) return;
    var r = relative(el.getAttribute('data-lastPushDate'));
    if (r === null) return;
    mark(el, r);
  }

  // 统计服务没回来时，别再把转圈图标留在页面上
  function settleCounter(id, label) {
    var el = document.getElementById(id);
    if (!el) return;
    if (done(el)) return;

    var text = (el.textContent || '').trim();
    var spinning = !!el.querySelector('.fa-spin, .fa-spinner');

    // 有真实数字了（第三方统计成功），什么都不做
    if (text && !spinning) {
      el.setAttribute('data-webinfo-done', '1');
      return;
    }

    el.textContent = '\u2014';
    el.setAttribute('data-webinfo-done', '1');
    el.title = label + '\uFF1A\u7EDF\u8BA1\u670D\u52A1\u672A\u54CD\u5E94\uFF0C\u6682\u65E0\u6570\u636E';
  }

  function scheduleFallback() {
    timers.forEach(clearTimeout);
    timers = [];
    timers.push(setTimeout(function () {
      settleCounter('busuanzi_value_site_uv', '\u672C\u7AD9\u8BBF\u5BA2\u6570');
      settleCounter('busuanzi_value_site_pv', '\u672C\u7AD9\u603B\u8BBF\u95EE\u91CF');
      settleCounter('busuanzi_value_page_pv', '\u672C\u9875\u8BBF\u95EE\u91CF');
    }, FALLBACK_AFTER));
  }

  function init() {
    fillRuntime();
    fillLastPush();
    scheduleFallback();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 时间类内容会随时间变化，重新进页面时重算（清掉 done 标记）
  function resetAndInit() {
    ['runtimeshow', 'last-push-date', 'busuanzi_value_site_uv', 'busuanzi_value_site_pv', 'busuanzi_value_page_pv']
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.removeAttribute('data-webinfo-done');
      });
    init();
  }

  document.addEventListener('pjax:complete', resetAndInit);
  window.addEventListener('pjax:complete', resetAndInit);

  // 兜底再跑一次（img/字体等外部资源导致的延迟，可能在 DOMContentLoaded 之后才出现这些节点）
  window.addEventListener('load', init);

})();