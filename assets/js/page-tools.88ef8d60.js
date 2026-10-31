/**
 * 分类 / 标签 / 归档 三个总览页的交互
 *
 * 关键点（踩过的坑）：
 *   本主题开了 pjax。pjax 只替换 DOM，**不会重新执行已加载的脚本**。
 *   所以不能在脚本顶层直接 getElementById 然后 return——
 *   从首页点链接进分类页时，脚本早就跑完了，监听器一个都没挂上，
 *   表现就是「按钮点了没反应」。
 *   正确做法：initAll() 可重复执行（幂等），并挂在
 *   DOMContentLoaded + pjax:complete 上；再加 MutationObserver 兜底。
 */

(function () {
  'use strict';

  // 当前页面上的搜索框（每次 init 重置，避免累积旧元素）
  var searchInputs = [];
  var keysBound = false;

  /* ---------- 通用小工具 ---------- */

  // 全局只绑一次 / 与 Esc，操作当前页面的搜索框
  function bindGlobalKeys() {
    if (keysBound) return;
    keysBound = true;
    document.addEventListener('keydown', function (e) {
      var inputs = liveSearchInputs();
      if (!inputs.length) return;

      if (e.key === '/') {
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        inputs[0].input.focus();
        return;
      }

      if (e.key === 'Escape') {
        for (var i = 0; i < inputs.length; i++) {
          if (inputs[i].input === document.activeElement) {
            inputs[i].input.value = '';
            inputs[i].onChange();
            inputs[i].input.blur();
            break;
          }
        }
      }
    });
  }

  // 幂等登记：initAll 可能被多次调用（pjax / MutationObserver），
  // 不能每次重置数组，否则第二次 init 提前 return 后就再也登记不上，
  // 表现就是「筛选还能用，但 / 和 Esc 失灵」。
  function registerSearch(input, onChange) {
    if (!input || input.dataset.searchBound) return;
    input.dataset.searchBound = '1';
    input.addEventListener('input', onChange);
    searchInputs.push({ input: input, onChange: onChange });
  }

  // 取当前仍在文档里的搜索框（pjax 换过 DOM 后，旧引用已失效）
  function liveSearchInputs() {
    searchInputs = searchInputs.filter(function (item) {
      return item.input && item.input.isConnected;
    });
    return searchInputs;
  }

  function bindSortGroup(group, onSort) {
    if (!group || group.dataset.bound) return;
    group.dataset.bound = '1';
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-sort]');
      if (!btn) return;
      Array.prototype.forEach.call(group.querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b === btn);
      });
      onSort(btn.dataset.sort);
    });
  }

  function sortBy(list, key, get) {
    return list.slice().sort(function (a, b) {
      if (key === 'name') {
        return String(get(a).name).localeCompare(String(get(b).name), 'zh-CN');
      }
      return (Number(get(b).count) - Number(get(a).count)) ||
        String(get(a).name).localeCompare(String(get(b).name), 'zh-CN');
    });
  }

  function toggleEmpty(container, cls, text, show) {
    var el = container.querySelector('.' + cls);
    if (show) {
      if (!el) {
        el = document.createElement('p');
        el.className = cls;
        container.appendChild(el);
      }
      el.textContent = text;
    } else if (el) {
      el.remove();
    }
  }

  /* ---------- 1. 分类页 ---------- */

  function initCategories() {
    var grid = document.getElementById('cat-grid');
    if (!grid || grid.dataset.toolsReady) return;
    grid.dataset.toolsReady = '1';

    var input = document.getElementById('cat-q');
    var countEl = document.getElementById('cat-count');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.category-card'));
    var totalText = countEl ? countEl.textContent : '';

    function apply() {
      var kw = (input && input.value || '').trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var ok = !kw || (card.dataset.name || '').indexOf(kw) !== -1;
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      if (countEl) {
        countEl.textContent = kw
          ? ('匹配 ' + shown + ' / ' + cards.length + ' 个分类')
          : totalText;
      }
      toggleEmpty(grid, 'cat-empty', '没有匹配的分类', !shown && !!kw);
    }

    registerSearch(input, apply);

    bindSortGroup(document.getElementById('cat-sort'), function (key) {
      sortBy(cards, key, function (el) {
        return { name: el.dataset.name || '', count: el.dataset.count };
      }).forEach(function (el) { grid.appendChild(el); });
      apply();
    });
  }

  /* ---------- 2. 标签页 ---------- */

  function initTags() {
    var grid = document.getElementById('tag-grid');
    if (!grid || grid.dataset.toolsReady) return;
    grid.dataset.toolsReady = '1';

    var input = document.getElementById('tag-q');
    var countEl = document.getElementById('tag-count');
    var items = Array.prototype.slice.call(grid.querySelectorAll('.tag-item'));
    var totalText = countEl ? countEl.textContent : '';

    function apply() {
      var kw = (input && input.value || '').trim().toLowerCase();
      var shown = 0;
      items.forEach(function (el) {
        var ok = !kw || (el.dataset.name || '').indexOf(kw) !== -1;
        el.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      if (countEl) {
        countEl.textContent = kw
          ? ('匹配 ' + shown + ' / ' + items.length + ' 个标签')
          : totalText;
      }
      toggleEmpty(grid, 'tag-empty', '没有匹配的标签', !shown && !!kw);
    }

    registerSearch(input, apply);

    bindSortGroup(document.getElementById('tag-sort'), function (key) {
      sortBy(items, key, function (el) {
        return { name: el.dataset.name || '', count: el.dataset.count };
      }).forEach(function (el) { grid.appendChild(el); });
      apply();
    });
  }

  /* ---------- 3. 归档页 ---------- */

  function initArchive() {
    var wrap = document.getElementById('archive');
    if (!wrap) return;

    var sortBox = wrap.querySelector('.article-sort');
    var countEl = document.getElementById('arc-count');
    if (!sortBox || !countEl || sortBox.dataset.toolsReady) return;
    sortBox.dataset.toolsReady = '1';

    var input = document.getElementById('arc-q');
    var yearBox = document.getElementById('arc-years');
    var totalText = countEl.textContent;
    var activeYear = 'all';

    // 把「年份标题 + 它后面的文章」组织成组，便于整组显隐
    var groups = [];
    var current = null;
    Array.prototype.slice.call(sortBox.children).forEach(function (node) {
      if (node.classList.contains('year')) {
        current = { header: node, year: node.dataset.year, items: [] };
        groups.push(current);
      } else if (current && node.hasAttribute('data-title')) {
        current.items.push(node);
      }
    });
    var totalItems = groups.reduce(function (n, g) { return n + g.items.length; }, 0);

    function apply() {
      var kw = (input && input.value || '').trim().toLowerCase();
      var shown = 0;

      groups.forEach(function (group) {
        var yearOk = activeYear === 'all' || group.year === activeYear;
        var visibleInGroup = 0;

        group.items.forEach(function (item) {
          var titleOk = !kw || (item.dataset.title || '').indexOf(kw) !== -1;
          var ok = yearOk && titleOk;
          item.classList.toggle('is-hidden', !ok);
          if (ok) visibleInGroup++;
        });

        group.header.classList.toggle('is-hidden', visibleInGroup === 0);
        shown += visibleInGroup;
      });

      countEl.textContent = (kw || activeYear !== 'all')
        ? ('匹配 ' + shown + ' / ' + totalItems + ' 篇')
        : totalText;

      toggleEmpty(sortBox, 'arc-empty', '没有匹配的文章', !shown);
    }

    registerSearch(input, apply);

    if (yearBox && !yearBox.dataset.bound) {
      yearBox.dataset.bound = '1';
      yearBox.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-year]');
        if (!btn) return;
        var target = btn.dataset.year;

        // 再点一次同一个年份 = 取消筛选
        if (btn.classList.contains('on') && target !== 'all') target = 'all';

        activeYear = target;
        Array.prototype.forEach.call(yearBox.querySelectorAll('button'), function (b) {
          b.classList.toggle('on', b.dataset.year === activeYear);
        });
        apply();
      });
    }

    apply();
  }

  /* ---------- 统一入口 ---------- */

  function initAll() {
    bindGlobalKeys();
    try { initCategories(); } catch (e) {}
    try { initTags(); } catch (e) {}
    try { initArchive(); } catch (e) {}
  }

  // 首屏
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // pjax 跳转后（主题的 local-search 也用的这个事件）
  document.addEventListener('pjax:complete', initAll);
  window.addEventListener('pjax:complete', initAll);

  // 兜底：如果哪天换了 pjax 实现或事件没触发，
  // 直接监听 DOM 变化。initAll 是幂等的，重复调用无副作用。
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var timer = null;
    new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        initAll();
      }, 60);
    }).observe(document.body, { childList: true, subtree: true });
  }

})();