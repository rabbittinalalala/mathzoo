/* util.js — 共用設定與小工具（全站共用的全域物件：MZ） */
(function (root) {
  var MZ = (root.MZ = root.MZ || {});

  // ===== 可自行調整的全域設定 =====
  MZ.CONFIG = {
    MAX_PLAYERS: 3, // 最多幾位玩家
    ROUND_SIZE: 15, // 每回合題數
    PIN_LENGTH: 4, // 家長 PIN 位數
    NAME_MAX: 8, // 暱稱最多幾個字
    AVATARS: ['🐰', '🐱', '🐶', '🐻', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🐧', '🐷', '🐮', '🦄', '🐹']
  };

  var U = (MZ.util = {});

  U.randInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  U.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  U.pad2 = function (n) {
    return n < 10 ? '0' + n : '' + n;
  };

  // 以「本機時間」產生 YYYY-MM-DD
  U.dateKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  };

  U.parseKey = function (k) {
    var p = String(k).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };

  U.addDays = function (d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  };

  // 該週的星期一（週一為一週的開始）
  U.weekStart = function (d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };

  // 例：75 秒 → "1 分 15 秒"
  U.formatDuration = function (sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m >= 60) {
      return Math.floor(m / 60) + ' 小時 ' + (m % 60) + ' 分';
    }
    return m > 0 ? m + ' 分 ' + s + ' 秒' : s + ' 秒';
  };

  // 例：75 秒 → "01:15"
  U.formatClock = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    return U.pad2(Math.floor(sec / 60)) + ':' + U.pad2(sec % 60);
  };

  U.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  U.pct = function (num, den) {
    return den > 0 ? Math.round((num / den) * 100) : 0;
  };
})(typeof window !== 'undefined' ? window : globalThis);
