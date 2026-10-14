/* ui.js — 畫面共用元件：音效、彩帶動畫、彈窗、提示訊息 */
(function (root) {
  var MZ = (root.MZ = root.MZ || {});
  var UI = (MZ.ui = {});

  // ===== 音效（用 Web Audio 即時合成，不需要音檔）=====
  var ctx = null;

  function ac() {
    if (!ctx) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (C) ctx = new C();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 手機瀏覽器要求「使用者點擊後」才能發聲
  UI.unlockAudio = function () {
    try { ac(); } catch (e) { /* 忽略 */ }
  };

  function tone(freq, start, dur, type, vol) {
    var c = ac();
    if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    var t = c.currentTime + start;
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  var SOUNDS = {
    tap: function () { tone(520, 0, 0.05, 'sine', 0.06); },
    correct: function () { tone(660, 0, 0.12, 'triangle'); tone(880, 0.1, 0.2, 'triangle'); },
    retry: function () { tone(330, 0, 0.12, 'triangle', 0.1); tone(392, 0.1, 0.16, 'triangle', 0.1); },
    wrong: function () { tone(220, 0, 0.18, 'sawtooth', 0.07); tone(175, 0.15, 0.25, 'sawtooth', 0.07); },
    finish: function () { [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle'); }); },
    levelup: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.12, 0.3, 'triangle'); }); },
    badge: function () { [784, 988, 1175].forEach(function (f, i) { tone(f, i * 0.1, 0.22, 'sine', 0.18); }); }
  };

  UI.sound = function (name) {
    if (!MZ.storage.settings().sound) return;
    try { if (SOUNDS[name]) SOUNDS[name](); } catch (e) { /* 忽略 */ }
  };

  // ===== 動畫開關 =====
  UI.applySettings = function () {
    document.body.classList.toggle('no-anim', !MZ.storage.settings().anim);
  };

  UI.confetti = function (emojis, count) {
    if (!MZ.storage.settings().anim) return;
    var layer = document.getElementById('fx-layer');
    emojis = emojis || ['⭐', '🎉', '✨', '🌟'];
    count = count || 28;
    for (var i = 0; i < count; i++) {
      var s = document.createElement('span');
      s.className = 'confetti-piece';
      s.textContent = emojis[i % emojis.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.setProperty('--dur', 2.2 + Math.random() * 1.8 + 's');
      s.style.setProperty('--delay', Math.random() * 0.8 + 's');
      s.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      s.style.fontSize = 20 + Math.round(Math.random() * 16) + 'px';
      layer.appendChild(s);
    }
    setTimeout(function () { layer.innerHTML = ''; }, 4800);
  };

  // ===== 提示訊息 =====
  var toastTimer = null;
  UI.toast = function (msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };

  // ===== 彈窗 =====
  // opts: { title, body(HTML), buttons:[{label, cls, onClick(box, close)}], onOpen(box, close), dismissible }
  // onClick 回傳 false 代表「不要關閉」（例如輸入有誤）
  UI.modal = function (opts) {
    var rootEl = document.getElementById('modal-root');
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var box = document.createElement('div');
    box.className = 'modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    var html = '';
    if (opts.title) html += '<h2 class="modal-title">' + opts.title + '</h2>';
    html += '<div class="modal-body">' + (opts.body || '') + '</div>';
    html += '<div class="modal-actions"></div>';
    box.innerHTML = html;
    overlay.appendChild(box);

    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    var actions = box.querySelector('.modal-actions');
    (opts.buttons || [{ label: '好', cls: 'primary' }]).forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.addEventListener('click', function () {
        UI.sound('tap');
        var r = b.onClick ? b.onClick(box, close) : undefined;
        if (r !== false) close();
      });
      actions.appendChild(btn);
    });

    // 在輸入框按 Enter = 按主要按鈕
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
        var primary = box.querySelector('.btn.primary');
        if (primary) { e.preventDefault(); primary.click(); }
      }
    });

    if (opts.dismissible !== false) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    }

    rootEl.appendChild(overlay);
    var first = box.querySelector('input, select');
    if (first && !opts.noFocus) { try { first.focus(); } catch (e) { /* 忽略 */ } }
    if (opts.onOpen) opts.onOpen(box, close);
    return { box: box, close: close };
  };

  UI.closeAllModals = function () {
    document.getElementById('modal-root').innerHTML = '';
  };

  // ===== 換畫面 =====
  UI.render = function (html, name) {
    var app = document.getElementById('app');
    document.getElementById('fx-layer').innerHTML = ''; // 換畫面時清掉還在飄的彩帶
    app.innerHTML = html;
    app.className = 'screen screen-' + name;
    if (root.scrollTo) { try { root.scrollTo(0, 0); } catch (e) { /* jsdom 等環境 */ } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
