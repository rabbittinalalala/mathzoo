/* storage.js — 資料儲存（瀏覽器 localStorage，每個裝置各自記錄）
 * 全部資料存在同一個 key：mathzoo.v1
 *   { version, players:[], sessions:[], settings:{} }
 * 今日次數、總時數、週統計都由 sessions 即時計算，不另外存。
 */
(function (root) {
  var MZ = (root.MZ = root.MZ || {});
  var U = MZ.util;
  var KEY = 'mathzoo.v1';

  var data = null;
  var memoryOnly = false; // localStorage 不可用時（例如無痕模式被封鎖）改存記憶體

  function defaultSettings() {
    return { sound: true, anim: true, pinHash: null, pinSalt: null, dailyLimitMin: 0, twoDigitMul: false };
  }

  function blank() {
    return { version: 1, players: [], sessions: [], settings: defaultSettings() };
  }

  function normalize() {
    if (!data || typeof data !== 'object') data = blank();
    if (!Array.isArray(data.players)) data.players = [];
    if (!Array.isArray(data.sessions)) data.sessions = [];
    var d = defaultSettings();
    data.settings = Object.assign(d, data.settings || {});
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : blank();
    } catch (e) {
      data = blank();
      memoryOnly = true;
    }
    normalize();
    return data;
  }

  function save() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      memoryOnly = true;
      return false;
    }
  }

  // ===== 玩家 =====
  function players() { return data.players; }

  function getPlayer(id) {
    for (var i = 0; i < data.players.length; i++) if (data.players[i].id === id) return data.players[i];
    return null;
  }

  function cleanName(name) {
    return String(name || '').trim().slice(0, MZ.CONFIG.NAME_MAX);
  }

  function addPlayer(name, avatar) {
    if (data.players.length >= MZ.CONFIG.MAX_PLAYERS) return null;
    var p = {
      id: U.uid('p'),
      name: cleanName(name) || '小朋友',
      avatar: avatar || MZ.CONFIG.AVATARS[0],
      totalStars: 0,
      level: 1,
      badges: {},
      defaultLevel: 'normal',
      createdAt: new Date().toISOString()
    };
    data.players.push(p);
    save();
    return p;
  }

  function updatePlayer(id, patch) {
    var p = getPlayer(id);
    if (!p) return null;
    if (patch.name !== undefined) p.name = cleanName(patch.name) || p.name;
    if (patch.avatar !== undefined) p.avatar = patch.avatar;
    if (patch.defaultLevel !== undefined) p.defaultLevel = patch.defaultLevel;
    save();
    return p;
  }

  function removePlayer(id) {
    data.players = data.players.filter(function (p) { return p.id !== id; });
    data.sessions = data.sessions.filter(function (s) { return s.playerId !== id; });
    save();
  }

  // ===== 回合紀錄 =====
  function sessionsFor(pid) {
    return data.sessions.filter(function (s) { return s.playerId === pid; });
  }

  function recalcPlayer(pid) {
    var p = getPlayer(pid);
    if (!p) return null;
    p.totalStars = sessionsFor(pid).reduce(function (sum, s) { return sum + (s.stars || 0); }, 0);
    p.level = MZ.rewards.levelInfo(p.totalStars).level;
    return p;
  }

  function addSession(s) {
    data.sessions.push(s);
    recalcPlayer(s.playerId);
    save();
  }

  // ===== 設定 =====
  function settings() { return data.settings; }

  function setSetting(k, v) {
    data.settings[k] = v;
    save();
  }

  // ===== 統計（由 sessions 計算）=====
  function summarize(list) {
    var seconds = 0, stars = 0, correct = 0, total = 0;
    list.forEach(function (s) {
      seconds += s.durationSec || 0;
      stars += s.stars || 0;
      var qs = s.questions || [];
      total += qs.length;
      qs.forEach(function (q) { if (q.result === 'first' || q.result === 'retry') correct++; });
    });
    return { rounds: list.length, seconds: seconds, stars: stars, correct: correct, total: total, accuracy: U.pct(correct, total) };
  }

  function statsBetween(pid, fromKey, toKey) {
    return summarize(sessionsFor(pid).filter(function (s) { return s.date >= fromKey && s.date <= toKey; }));
  }

  function todayStats(pid) {
    var k = U.dateKey();
    return statsBetween(pid, k, k);
  }

  // ===== 備份：匯出／匯入 =====
  function exportData() {
    return JSON.stringify(
      { app: 'mathzoo', version: 1, exportedAt: new Date().toISOString(), players: data.players, sessions: data.sessions },
      null, 2
    );
  }

  var VALID_LEVELS = { easy: 1, normal: 1, hard: 1 };
  var VALID_OPS = { add: 1, sub: 1, mul: 1, div: 1 };
  var VALID_RESULTS = { first: 1, retry: 1, wrong: 1 };

  function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }

  function cleanPlayer(p) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return null;
    var knownBadges = {};
    MZ.rewards.BADGES.forEach(function (b) { knownBadges[b.id] = true; });
    var badges = {};
    if (p.badges && typeof p.badges === 'object') {
      Object.keys(p.badges).forEach(function (k) {
        if (knownBadges[k] && typeof p.badges[k] === 'string') badges[k] = p.badges[k].slice(0, 10);
      });
    }
    return {
      id: p.id.slice(0, 40),
      name: cleanName(p.name) || '小朋友',
      avatar: typeof p.avatar === 'string' ? p.avatar.slice(0, 8) : MZ.CONFIG.AVATARS[0],
      totalStars: 0,
      level: 1,
      badges: badges,
      defaultLevel: VALID_LEVELS[p.defaultLevel] ? p.defaultLevel : 'normal',
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString()
    };
  }

  function cleanSession(s) {
    if (!s || typeof s.id !== 'string' || typeof s.playerId !== 'string') return null;
    if (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return null;
    if (!VALID_LEVELS[s.level] || !Array.isArray(s.questions)) return null;
    var qs = [];
    s.questions.forEach(function (q) {
      if (!q || !VALID_OPS[q.op] || !VALID_RESULTS[q.result]) return;
      qs.push({
        text: String(q.text).slice(0, 30),
        op: q.op,
        answer: num(q.answer),
        attempts: Array.isArray(q.attempts) ? q.attempts.map(num).slice(0, 2) : [],
        result: q.result,
        stars: num(q.stars)
      });
    });
    return {
      id: s.id.slice(0, 40),
      playerId: s.playerId.slice(0, 40),
      date: s.date,
      startedAt: typeof s.startedAt === 'string' ? s.startedAt : '',
      level: s.level,
      durationSec: num(s.durationSec),
      accuracy: num(s.accuracy),
      stars: num(s.stars),
      starBreakdown: s.starBreakdown && typeof s.starBreakdown === 'object' ? s.starBreakdown : {},
      questions: qs
    };
  }

  // mode: 'merge'（合併，保留現有）或 'replace'（取代）
  function importData(text, mode) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: '這不是有效的備份檔（JSON 格式錯誤）' }; }
    if (!obj || obj.app !== 'mathzoo' || !Array.isArray(obj.players) || !Array.isArray(obj.sessions)) {
      return { ok: false, error: '這不是「動物數學樂園」的備份檔' };
    }
    var inPlayers = obj.players.map(cleanPlayer).filter(Boolean);
    var inSessions = obj.sessions.map(cleanSession).filter(Boolean);
    var skippedPlayers = 0;

    if (mode === 'replace') {
      data.players = inPlayers.slice(0, MZ.CONFIG.MAX_PLAYERS);
      skippedPlayers = inPlayers.length - data.players.length;
      var keep = {};
      data.players.forEach(function (p) { keep[p.id] = true; });
      data.sessions = inSessions.filter(function (s) { return keep[s.playerId]; });
    } else {
      inPlayers.forEach(function (p) {
        var exist = getPlayer(p.id);
        if (exist) {
          Object.keys(p.badges).forEach(function (k) { if (!exist.badges[k]) exist.badges[k] = p.badges[k]; });
        } else if (data.players.length < MZ.CONFIG.MAX_PLAYERS) {
          data.players.push(p);
        } else {
          skippedPlayers++;
        }
      });
      var have = {};
      data.sessions.forEach(function (s) { have[s.id] = true; });
      inSessions.forEach(function (s) {
        if (!have[s.id] && getPlayer(s.playerId)) { data.sessions.push(s); have[s.id] = true; }
      });
    }
    data.players.forEach(function (p) { recalcPlayer(p.id); });
    save();
    return { ok: true, players: data.players.length, sessions: data.sessions.length, skippedPlayers: skippedPlayers };
  }

  function resetAll() {
    var keepSettings = data.settings;
    data = blank();
    data.settings = keepSettings;
    save();
  }

  // ===== 家長 PIN =====
  // 優先用 SHA-256（需要 https 或 localhost）；不支援時退回簡易雜湊。
  // PIN 只是擋小朋友用，不是銀行等級的安全機制。
  function simpleHash(str) {
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 33) ^ c) >>> 0;
    }
    return h1.toString(16) + h2.toString(16);
  }

  function hashWith(algo, str) {
    if (algo === 'sha256' && root.crypto && root.crypto.subtle && root.TextEncoder) {
      return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    return Promise.resolve(simpleHash(str));
  }

  function hasPin() { return !!data.settings.pinHash; }

  function setPin(pin) {
    var salt = U.uid('salt');
    var algo = root.crypto && root.crypto.subtle && root.TextEncoder ? 'sha256' : 'simple';
    return hashWith(algo, salt + ':' + pin).then(function (h) {
      data.settings.pinSalt = salt;
      data.settings.pinHash = algo + ':' + h;
      save();
    });
  }

  function checkPin(pin) {
    if (!hasPin()) return Promise.resolve(false);
    var stored = data.settings.pinHash;
    var algo = stored.split(':')[0];
    return hashWith(algo, data.settings.pinSalt + ':' + pin).then(function (h) {
      return stored === algo + ':' + h;
    });
  }

  MZ.storage = {
    load: load,
    save: save,
    isMemoryOnly: function () { return memoryOnly; },
    players: players,
    getPlayer: getPlayer,
    addPlayer: addPlayer,
    updatePlayer: updatePlayer,
    removePlayer: removePlayer,
    sessionsFor: sessionsFor,
    recalcPlayer: recalcPlayer,
    addSession: addSession,
    settings: settings,
    setSetting: setSetting,
    summarize: summarize,
    statsBetween: statsBetween,
    todayStats: todayStats,
    exportData: exportData,
    importData: importData,
    resetAll: resetAll,
    hasPin: hasPin,
    setPin: setPin,
    checkPin: checkPin
  };
})(typeof window !== 'undefined' ? window : globalThis);
