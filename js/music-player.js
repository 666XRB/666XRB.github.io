/**
 * 全站悬浮播放器
 *
 * 设计要点
 *   1. 全局只有一个 <audio>，/music/ 页面与悬浮条都操作它，状态天然一致。
 *   2. 播放器外壳由 pug 服务端渲染，且在 #body-wrap 之外，
 *      所以主题 pjax 换页不会打断播放。
 *   3. 本脚本只初始化一次（window.MusicPlayer 守卫）；没有 data-pjax 属性，
 *      pjax 不会重新执行它。
 *   4. 曲目列表走事件委托，pjax 换了 DOM 也不用重新绑定。
 *   5. 不做歌词、不做随机、不做收藏 —— 只按需求给 播放 / 进度 / 上下曲。
 */

(function () {
  'use strict';

  if (window.MusicPlayer) return;

  var bar = document.getElementById('mplayer');
  var dataEl = document.getElementById('music-data');
  if (!bar || !dataEl) return;

  var tracks = [];
  try {
    tracks = JSON.parse(dataEl.textContent || '[]');
  } catch (e) {
    tracks = [];
  }
  if (!Array.isArray(tracks) || !tracks.length) return;

  var audio = document.getElementById('mp-audio');
  if (!audio) return;

  /* ---------- DOM 缓存 ---------- */
  var el = {
    toggle: document.getElementById('mp-toggle'),
    title: document.getElementById('mp-title'),
    artist: document.getElementById('mp-artist'),
    seek: document.getElementById('mp-seek'),
    cur: document.getElementById('mp-cur'),
    dur: document.getElementById('mp-dur'),
    prev: document.getElementById('mp-prev'),
    next: document.getElementById('mp-next'),
    vol: document.getElementById('mp-vol'),
    listBtn: document.getElementById('mp-list-btn'),
    list: document.getElementById('mp-list'),
    fold: document.getElementById('mp-fold'),
    fab: document.getElementById('mp-fab')
  };

  var LS = {
    index: 'mp-index',
    volume: 'mp-volume',
    collapsed: 'mp-collapsed',
    time: 'mp-time'
  };

  var state = {
    cur: -1,
    seeking: false,
    failed: Object.create(null),
    collapsed: false,
    listOpen: false
  };

  /* ---------- 工具 ---------- */
  function readLS(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeLS(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch (e) {}
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function trackName(i) {
    var t = tracks[i];
    if (!t) return '';
    return t.title || ('第 ' + (i + 1) + ' 首');
  }

  // 只在焦点不在输入框时响应快捷键，避免和页面里的搜索框抢键
  function isTyping() {
    var a = document.activeElement;
    if (!a) return false;
    var tag = a.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var t = tracks[state.cur] || {};
    el.title.textContent = state.cur >= 0 ? (t.title || ('第 ' + (state.cur + 1) + ' 首')) : '—';
    el.artist.textContent = state.cur >= 0 ? (t.artist || '') : '';

    var playing = !audio.paused && !audio.ended;
    bar.setAttribute('data-playing', playing ? '1' : '0');
    el.toggle.setAttribute('aria-label', playing ? '暂停' : '播放');
    bar.setAttribute('title', state.cur >= 0 ? trackName(state.cur) + (t.artist ? ' · ' + t.artist : '') : '');
  }

  function syncProgress() {
    if (state.seeking) return;
    var d = audio.duration;
    if (isFinite(d) && d > 0) {
      el.seek.value = String(Math.round((audio.currentTime / d) * 1000));
      el.dur.textContent = fmt(d);
    } else {
      el.seek.value = '0';
      el.dur.textContent = '0:00';
    }
    el.cur.textContent = fmt(audio.currentTime);
  }

  function broadcast() {
    try {
      document.dispatchEvent(new CustomEvent('music:state', {
        detail: { index: state.cur, playing: !audio.paused && !audio.ended, total: tracks.length }
      }));
    } catch (e) {}
  }

  function highlightPageList() {
    var rows = document.querySelectorAll('[data-music-index]');
    if (!rows.length) return;
    var playing = !audio.paused && !audio.ended;
    Array.prototype.forEach.call(rows, function (row) {
      var i = Number(row.getAttribute('data-music-index'));
      row.classList.toggle('is-current', i === state.cur);
      row.classList.toggle('is-playing', i === state.cur && playing);
    });
  }

  /* ---------- 核心动作 ---------- */
  function savePos() {
    if (state.cur >= 0 && isFinite(audio.currentTime) && audio.currentTime > 2) {
      writeLS(LS.time, state.cur + ':' + Math.floor(audio.currentTime));
    }
  }

  function load(i, autoplay) {
    if (i < 0 || i >= tracks.length) return;
    var t = tracks[i];
    if (!t || !t.file) return;

    state.cur = i;
    writeLS(LS.index, i);
    audio.src = t.file;
    audio.load();
    render();
    highlightPageList();

    // 恢复这首歌上次听到的位置
    var saved = readLS(LS.time, '');
    if (saved) {
      var parts = String(saved).split(':');
      if (Number(parts[0]) === i && Number(parts[1]) > 2) {
        var resume = Number(parts[1]);
        var once = function () {
          audio.removeEventListener('loadedmetadata', once);
          if (isFinite(audio.duration) && resume < audio.duration - 3) {
            audio.currentTime = resume;
          }
        };
        audio.addEventListener('loadedmetadata', once);
      }
    }

    if (autoplay) play();
    else broadcast();
  }

  function play() {
    if (state.cur < 0) {
      load(firstAvailable(0), true);
      return;
    }
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        // 浏览器拦截自动播放时会走到这里，保持暂停态即可
        render();
      });
    }
  }

  function pause() {
    audio.pause();
  }

  function toggle() {
    if (audio.paused || audio.ended) play();
    else pause();
  }

  function firstAvailable(from) {
    for (var i = from; i < tracks.length; i++) {
      if (!state.failed[i]) return i;
    }
    return -1;
  }

  function step(dir) {
    if (state.cur < 0) {
      load(firstAvailable(0), true);
      return;
    }
    var i = state.cur + dir;
    while (i >= 0 && i < tracks.length && state.failed[i]) i += dir;
    if (i < 0 || i >= tracks.length) return;
    load(i, true);
  }

  function seekToRatio(ratio) {
    var d = audio.duration;
    if (!isFinite(d) || d <= 0) return;
    audio.currentTime = Math.max(0, Math.min(d, ratio * d));
    syncProgress();
  }

  function setVolume(v) {
    var vol = Math.max(0, Math.min(1, v / 100));
    audio.volume = vol;
    writeLS(LS.volume, Math.round(vol * 100));
  }

  /* ---------- 列表面板 ---------- */
  function buildList() {
    el.list.textContent = '';
    tracks.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'mp-list-item';
      li.setAttribute('data-music-index', String(i));
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');

      var no = document.createElement('span');
      no.className = 'mp-list-no';
      no.textContent = String(i + 1);

      var main = document.createElement('span');
      main.className = 'mp-list-main';
      var name = document.createElement('span');
      name.className = 'mp-list-title';
      name.textContent = t.title || ('第 ' + (i + 1) + ' 首');
      main.appendChild(name);
      if (t.artist) {
        var ar = document.createElement('span');
        ar.className = 'mp-list-artist';
        ar.textContent = t.artist;
        main.appendChild(ar);
      }

      li.appendChild(no);
      li.appendChild(main);
      el.list.appendChild(li);
    });
  }

  function setListOpen(open) {
    state.listOpen = open;
    el.list.hidden = !open;
    el.listBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    bar.setAttribute('data-list-open', open ? '1' : '0');
    if (open) highlightPageList();
  }

  function setCollapsed(collapsed) {
    state.collapsed = collapsed;
    writeLS(LS.collapsed, collapsed ? '1' : '0');
    bar.hidden = collapsed;
    if (el.fab) el.fab.hidden = !collapsed;
    if (collapsed) setListOpen(false);
  }

  /* ---------- 事件 ---------- */
  audio.addEventListener('timeupdate', function () {
    syncProgress();
    if (state.cur >= 0 && Math.floor(audio.currentTime) % 5 === 0) savePos();
  });

  audio.addEventListener('loadedmetadata', function () {
    syncProgress();
    el.dur.textContent = fmt(audio.duration);
  });

  audio.addEventListener('play', function () { render(); broadcast(); highlightPageList(); });
  audio.addEventListener('pause', function () { render(); broadcast(); highlightPageList(); savePos(); });
  audio.addEventListener('playing', function () { bar.removeAttribute('data-buffering'); });
  audio.addEventListener('waiting', function () { bar.setAttribute('data-buffering', '1'); });
  audio.addEventListener('canplay', function () { bar.removeAttribute('data-buffering'); });

  audio.addEventListener('ended', function () {
    // 播完最后一首就停下，不自动循环
    var nxt = state.cur + 1;
    if (nxt < tracks.length && !state.failed[nxt]) {
      load(nxt, true);
    } else {
      audio.currentTime = 0;
      render();
      broadcast();
    }
  });

  audio.addEventListener('error', function () {
    if (state.cur < 0) return;
    state.failed[state.cur] = true;
    el.artist.textContent = '加载失败，已跳过';
    var nxt = firstAvailable(state.cur + 1);
    if (nxt >= 0) {
      setTimeout(function () { load(nxt, true); }, 900);
    } else {
      audio.pause();
      el.artist.textContent = '全部曲目都无法加载';
      render();
    }
  });

  if (el.toggle) el.toggle.addEventListener('click', toggle);
  if (el.prev) el.prev.addEventListener('click', function () { step(-1); });
  if (el.next) el.next.addEventListener('click', function () { step(1); });

  if (el.seek) {
    el.seek.addEventListener('input', function () {
      state.seeking = true;
      var d = audio.duration;
      if (isFinite(d) && d > 0) {
        var ratio = Number(el.seek.value) / 1000;
        el.cur.textContent = fmt(ratio * d);
      }
    });
    var commitSeek = function () {
      var ratio = Number(el.seek.value) / 1000;
      state.seeking = false;
      seekToRatio(ratio);
    };
    el.seek.addEventListener('change', commitSeek);
    el.seek.addEventListener('pointerup', function () {
      if (state.seeking) commitSeek();
    });
  }

  if (el.vol) {
    el.vol.addEventListener('input', function () { setVolume(Number(el.vol.value)); });
  }

  if (el.listBtn) {
    el.listBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setListOpen(!state.listOpen);
    });
  }

  if (el.fold) el.fold.addEventListener('click', function () { setCollapsed(true); });
  if (el.fab) el.fab.addEventListener('click', function () { setCollapsed(false); });

  // 点击播放器外部收起列表
  document.addEventListener('click', function (e) {
    if (!state.listOpen) return;
    if (bar.contains(e.target)) return;
    setListOpen(false);
  });

  // 曲目行（/music/ 页面 + 列表面板）统一走事件委托，
  // pjax 换过 DOM 也不用重新绑定
  document.addEventListener('click', function (e) {
    var row = e.target.closest('[data-music-index]');
    if (!row) return;
    var i = Number(row.getAttribute('data-music-index'));
    if (isNaN(i)) return;
    if (state.cur === i && !audio.paused) {
      pause();
    } else {
      load(i, true);
    }
  });

  document.addEventListener('keydown', function (e) {
    var row = e.target.closest && e.target.closest('[data-music-index]');
    if (row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      row.click();
      return;
    }
    if (isTyping()) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowLeft') {
      if (e.altKey) { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); syncProgress(); }
    } else if (e.key === 'ArrowRight') {
      if (e.altKey) { e.preventDefault(); audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); syncProgress(); }
    }
  });

  // 播放全部（/music/ 页顶部按钮）
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#music-playall')) return;
    load(firstAvailable(0), true);
  });

  // 离开页面前记住位置
  window.addEventListener('beforeunload', savePos);
  document.addEventListener('pjax:send', savePos);

  // pjax 换页后，/music/ 页的行是新的，重新上色
  function refreshPageList() {
    highlightPageList();
  }
  document.addEventListener('pjax:complete', function () {
    setTimeout(refreshPageList, 60);
  });

  /* ---------- 启动 ---------- */
  buildList();

  var savedVol = Number(readLS(LS.volume, '60'));
  el.vol && (el.vol.value = String(isFinite(savedVol) ? savedVol : 60));
  setVolume(isFinite(savedVol) ? savedVol : 60);

  bar.dataset.ready = '1';
  document.body.classList.add('has-mplayer');

  var savedIndex = Number(readLS(LS.index, '0'));
  if (!isFinite(savedIndex) || savedIndex < 0 || savedIndex >= tracks.length) savedIndex = 0;
  load(savedIndex, false);

  if (readLS(LS.collapsed, '0') === '1') setCollapsed(true);

  window.MusicPlayer = {
    play: function (i) {
      if (typeof i === 'number') load(i, true);
      else play();
    },
    pause: pause,
    toggle: toggle,
    next: function () { step(1); },
    prev: function () { step(-1); },
    get state() {
      return { index: state.cur, playing: !audio.paused && !audio.ended, tracks: tracks };
    }
  };
})();