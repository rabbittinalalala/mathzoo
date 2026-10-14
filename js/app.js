/* app.js — 遊戲流程與各個畫面
 * 畫面：選玩家 → 主選單 → 選難度 → 答題 → 回合結果；另有徽章、設定、家長模式。
 * 所有按鈕都用 data-action 屬性，對應下方 actions 物件裡的函式。
 */
(function () {
  'use strict';

  var MZ = window.MZ;
  var U = MZ.util, Q = MZ.questions, R = MZ.rewards, S = MZ.storage, UI = MZ.ui, C = MZ.CONFIG;
  var esc = U.escapeHtml;

  var state = {
    screen: 'players',
    pid: null, // 目前玩家
    game: null, // 進行中的回合
    result: null, // 最近一回合的結果
    parent: { tab: 'stats', pid: null, histCount: 20 }
  };
  var actions = {};

  function $(id) { return document.getElementById(id); }
  function player() { return S.getPlayer(state.pid); }

  // =====================================================================
  // 選玩家
  // =====================================================================
  function renderPlayers() {
    state.screen = 'players';
    state.pid = null;
    state.game = null;
    var ps = S.players();
    var cards = ps.map(function (p) {
      var info = R.levelInfo(p.totalStars);
      return '<button class="player-card" data-action="pick-player" data-id="' + esc(p.id) + '">' +
        '<span class="avatar">' + esc(p.avatar) + '</span>' +
        '<span class="pname">' + esc(p.name) + '</span>' +
        '<span class="plevel">Lv.' + info.level + ' ' + info.emoji + ' ' + info.name + '</span></button>';
    }).join('');
    if (ps.length < C.MAX_PLAYERS) {
      cards += '<button class="player-card add" data-action="add-player">' +
        '<span class="avatar">＋</span><span class="pname">新增玩家</span></button>';
    }
    var warn = S.isMemoryOnly()
      ? '<div class="card warn">⚠️ 這個瀏覽器目前無法儲存資料，關掉頁面後紀錄會消失。請不要用無痕模式。</div>' : '';
    UI.render(
      '<h1 class="title">🐾 動物數學樂園</h1>' +
      '<p class="sub">' + (ps.length ? '選一位小朋友開始玩' : '先來建立第一位玩家吧！') + '</p>' +
      warn +
      '<div class="player-grid">' + cards + '</div>' +
      '<div class="row footer-row">' +
      '<button class="btn ghost" data-action="open-parent">👨‍👩‍👧 家長模式</button>' +
      '<button class="btn ghost" data-action="open-settings">⚙️ 設定</button></div>',
      'players'
    );
  }

  function playerModal(existing, onDone) {
    var chosen = existing ? existing.avatar : (function () {
      var used = S.players().map(function (p) { return p.avatar; });
      for (var i = 0; i < C.AVATARS.length; i++) if (used.indexOf(C.AVATARS[i]) < 0) return C.AVATARS[i];
      return C.AVATARS[0];
    })();
    var avatars = C.AVATARS.map(function (a) {
      return '<button type="button" class="av-opt' + (a === chosen ? ' sel' : '') + '" data-av="' + a + '">' + a + '</button>';
    }).join('');
    UI.modal({
      title: existing ? '修改玩家' : '新增玩家',
      body: '<label class="field">暱稱（最多 ' + C.NAME_MAX + ' 個字）' +
        '<input id="pm-name" type="text" maxlength="' + C.NAME_MAX + '" autocomplete="off" value="' + (existing ? esc(existing.name) : '') + '"></label>' +
        '<div class="field-label">選一個動物頭像</div><div class="av-grid">' + avatars + '</div>',
      buttons: [
        { label: '取消' },
        {
          label: '確定', cls: 'primary',
          onClick: function (box) {
            var name = box.querySelector('#pm-name').value.trim();
            if (!name) { UI.toast('請輸入暱稱喔'); return false; }
            onDone(name, chosen);
          }
        }
      ],
      onOpen: function (box) {
        box.addEventListener('click', function (e) {
          var b = e.target.closest('.av-opt');
          if (!b) return;
          chosen = b.getAttribute('data-av');
          [].forEach.call(box.querySelectorAll('.av-opt'), function (x) { x.classList.toggle('sel', x === b); });
          UI.sound('tap');
        });
      }
    });
  }

  actions['pick-player'] = function (el) {
    state.pid = el.getAttribute('data-id');
    UI.sound('tap');
    renderMenu();
  };

  actions['add-player'] = function () {
    playerModal(null, function (name, avatar) {
      S.addPlayer(name, avatar);
      renderPlayers();
    });
  };

  actions['to-players'] = function () { renderPlayers(); };

  // =====================================================================
  // 主選單
  // =====================================================================
  function renderMenu() {
    state.screen = 'menu';
    var p = player();
    if (!p) { renderPlayers(); return; }
    var info = R.levelInfo(p.totalStars);
    var today = S.todayStats(p.id);
    var limit = S.settings().dailyLimitMin;
    var progressText = info.next
      ? '再 ' + info.toNext + ' ⭐ 升到 ' + info.next.emoji + ' ' + info.next.name
      : '你已經是最高等級啦！🎉';
    UI.render(
      '<div class="topbar">' +
      '<button class="icon-btn" data-action="to-players" aria-label="換人">⬅</button>' +
      '<div class="who"><span class="avatar sm">' + esc(p.avatar) + '</span><b>' + esc(p.name) + '</b></div>' +
      '<button class="icon-btn" data-action="open-settings" aria-label="設定">⚙️</button></div>' +
      '<div class="card level-card">' +
      '<div class="big-emoji">' + info.emoji + '</div>' +
      '<div class="lv-name">Lv.' + info.level + ' ' + info.name + '</div>' +
      '<div class="stars-total">⭐ ' + p.totalStars + '</div>' +
      '<div class="bar"><i style="width:' + Math.round(info.progress * 100) + '%"></i></div>' +
      '<div class="hint">' + progressText + '</div></div>' +
      '<div class="card today-card"><div class="today-title">📅 今天</div>' +
      '<div class="today-row">' +
      '<div><b id="m-today-rounds">' + today.rounds + '</b><span>次遊戲</span></div>' +
      '<div><b id="m-today-time">' + U.formatDuration(today.seconds) + '</b><span>總時間</span></div></div>' +
      (limit > 0 ? '<div class="hint">今日上限 ' + limit + ' 分鐘</div>' : '') + '</div>' +
      '<button class="btn big primary" data-action="go-level">▶ 開始遊戲</button>' +
      '<div class="row">' +
      '<button class="btn" data-action="open-badges">🏅 我的徽章</button>' +
      '<button class="btn" data-action="open-parent">👨‍👩‍👧 家長模式</button></div>',
      'menu'
    );
  }

  actions['go-level'] = function () { UI.sound('tap'); renderLevelSelect(); };

  function renderLevelSelect() {
    state.screen = 'level';
    var p = player();
    var cards = Q.LEVEL_ORDER.map(function (id) {
      var L = Q.LEVELS[id];
      return '<button class="level-btn lv-' + id + (p.defaultLevel === id ? ' last' : '') + '" data-action="start" data-level="' + id + '">' +
        '<span class="lv-emoji">' + L.emoji + '</span>' +
        '<span class="lv-body"><span class="lv-title">' + L.label + (p.defaultLevel === id ? ' <small>上次玩的</small>' : '') + '</span>' +
        '<span class="lv-desc">' + L.desc + '</span></span>' +
        '<span class="lv-mult">⭐ ×' + L.multiplier + '</span></button>';
    }).join('');
    UI.render(
      '<div class="topbar"><button class="icon-btn" data-action="to-menu" aria-label="返回">⬅</button>' +
      '<div class="who"><b>選擇難度</b></div><span class="icon-btn ghost"></span></div>' +
      '<p class="sub">每回合 ' + C.ROUND_SIZE + ' 題，加減乘除混合！</p>' +
      '<div class="level-list">' + cards + '</div>',
      'level'
    );
  }

  actions['to-menu'] = function () { renderMenu(); };

  // =====================================================================
  // 答題
  // =====================================================================
  actions.start = function (el) { startGame(el.getAttribute('data-level')); };

  function startGame(levelId) {
    var p = player();
    var st = S.settings();
    if (st.dailyLimitMin > 0 && S.todayStats(p.id).seconds >= st.dailyLimitMin * 60) {
      UI.modal({
        title: '今天玩得夠多了 🌙',
        body: '<p>今天已經玩了 ' + U.formatDuration(S.todayStats(p.id).seconds) + '（上限 ' + st.dailyLimitMin + ' 分鐘）。<br>休息一下，明天再來挑戰吧！</p>',
        buttons: [{ label: '好的', cls: 'primary' }]
      });
      return;
    }
    S.updatePlayer(p.id, { defaultLevel: levelId });
    var qs = Q.generateRound(levelId, { twoDigitMul: st.twoDigitMul });
    state.game = {
      level: levelId,
      qs: qs.map(function (q) { return { q: q, attempts: [], result: null }; }),
      idx: 0,
      input: '',
      tries: 0,
      locked: false,
      waitNext: false,
      done: false,
      activeMs: 0,
      tickStart: Date.now(),
      timer: null,
      advance: null,
      startedAt: new Date().toISOString()
    };
    renderGame();
    updateQuestion();
    state.game.timer = setInterval(tick, 250);
  }

  function renderGame() {
    state.screen = 'game';
    var p = player();
    var keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(function (k) {
      return '<button class="key" data-action="key" data-k="' + k + '">' + k + '</button>';
    }).join('') +
      '<button class="key back" data-action="back" aria-label="刪除">⌫</button>' +
      '<button class="key" data-action="key" data-k="0">0</button>' +
      '<button class="key ok" data-action="submit" aria-label="確認">✔</button>';
    UI.render(
      '<div class="topbar game-top">' +
      '<button class="icon-btn" data-action="quit-game" aria-label="離開">✕</button>' +
      '<div class="qno" id="g-no">1 / ' + C.ROUND_SIZE + '</div>' +
      '<div class="timer" id="g-timer">⏱ 00:00</div>' +
      '<div class="gstars" id="g-stars">⭐ 0</div></div>' +
      '<div class="bar thin"><i id="g-bar"></i></div>' +
      '<div class="question-card" id="g-card">' +
      '<div class="mascot" id="g-mascot">' + esc(p.avatar) + '</div>' +
      '<div class="q-text" id="g-q"></div>' +
      '<div class="answer" id="g-ans"><span id="g-ans-text"></span><span class="caret"></span></div>' +
      '<div class="feedback"><div class="msg" id="g-msg"></div>' +
      '<button class="btn primary hidden" id="g-next" data-action="next">下一題 ➜</button></div></div>' +
      '<div class="keypad" id="g-keys">' + keys + '</div>',
      'game'
    );
  }

  function elapsedMs(g) { return g.activeMs + (g.tickStart ? Date.now() - g.tickStart : 0); }
  function pauseClock(g) { if (g && g.tickStart) { g.activeMs += Date.now() - g.tickStart; g.tickStart = null; } }
  function resumeClock(g) { if (g && !g.done && !g.tickStart) g.tickStart = Date.now(); }

  function tick() {
    var g = state.game;
    var t = $('g-timer');
    if (!g || !t) return;
    t.textContent = '⏱ ' + U.formatClock(elapsedMs(g) / 1000);
  }

  function stopGameTimers(g) {
    if (!g) return;
    clearInterval(g.timer);
    clearTimeout(g.advance);
    g.timer = null;
    g.advance = null;
  }

  // 離開分頁或鎖屏時暫停計時，回來再繼續
  document.addEventListener('visibilitychange', function () {
    var g = state.game;
    if (!g || g.done || state.screen !== 'game') return;
    if (document.hidden) pauseClock(g); else if (!document.querySelector('.modal-overlay')) resumeClock(g);
  });

  function setMsg(text, cls) {
    var m = $('g-msg');
    if (!m) return;
    m.textContent = text || '';
    m.className = 'msg' + (cls ? ' ' + cls : '');
  }

  function updateAnswer() {
    var g = state.game;
    var a = $('g-ans-text');
    if (a) a.textContent = g.input;
  }

  function animateCard(cls) {
    var c = $('g-card');
    if (!c) return;
    c.classList.remove('shake', 'happy', 'enter');
    void c.offsetWidth; // 重新觸發動畫
    c.classList.add(cls);
  }

  function updateQuestion() {
    var g = state.game;
    var item = g.qs[g.idx];
    g.input = '';
    g.tries = 0;
    g.locked = false;
    g.waitNext = false;
    $('g-no').textContent = (g.idx + 1) + ' / ' + g.qs.length;
    $('g-bar').style.width = Math.round((g.idx / g.qs.length) * 100) + '%';
    $('g-q').textContent = item.q.text + ' = ?';
    $('g-next').classList.add('hidden');
    setMsg('', '');
    updateAnswer();
    animateCard('enter');
  }

  function runningStars() {
    var g = state.game;
    return g.qs.reduce(function (s, it) { return s + R.questionStars(it.result); }, 0);
  }

  function pressKey(k) {
    var g = state.game;
    if (!g || g.locked) return;
    if (g.input.length >= 4) return;
    g.input = g.input === '0' ? k : g.input + k;
    UI.sound('tap');
    updateAnswer();
  }

  function pressBack() {
    var g = state.game;
    if (!g || g.locked) return;
    g.input = g.input.slice(0, -1);
    UI.sound('tap');
    updateAnswer();
  }

  function submit() {
    var g = state.game;
    if (!g || g.locked || g.input === '') return;
    var item = g.qs[g.idx];
    var val = parseInt(g.input, 10);
    item.attempts.push(val);
    g.tries++;

    if (val === item.q.answer) {
      item.result = g.tries === 1 ? 'first' : 'retry';
      g.locked = true;
      var gain = R.questionStars(item.result);
      UI.sound(item.result === 'first' ? 'correct' : 'retry');
      setMsg((item.result === 'first' ? '答對了！太棒了 🎉 ' : '這次答對了！👍 ') + '+' + gain + ' ⭐', 'good');
      animateCard('happy');
      $('g-stars').textContent = '⭐ ' + runningStars();
      g.advance = setTimeout(nextQuestion, 1000);
    } else if (g.tries === 1) {
      UI.sound('wrong');
      setMsg('差一點點！再試一次 💪', 'try');
      animateCard('shake');
      g.input = '';
      updateAnswer();
    } else {
      item.result = 'wrong';
      g.locked = true;
      g.waitNext = true;
      UI.sound('wrong');
      setMsg('正確答案是 ' + item.q.answer + '，我們下次再來！', 'bad');
      animateCard('shake');
      var nb = $('g-next');
      nb.textContent = g.idx + 1 >= g.qs.length ? '看結果 ➜' : '下一題 ➜';
      nb.classList.remove('hidden');
    }
  }

  function nextQuestion() {
    var g = state.game;
    if (!g || g.done) return;
    clearTimeout(g.advance);
    g.advance = null;
    g.idx++;
    if (g.idx >= g.qs.length) finishGame();
    else updateQuestion();
  }

  actions.key = function (el) { pressKey(el.getAttribute('data-k')); };
  actions.back = pressBack;
  actions.submit = submit;
  actions.next = nextQuestion;

  actions['quit-game'] = function () {
    var g = state.game;
    pauseClock(g);
    UI.modal({
      title: '要離開嗎？',
      body: '<p>這一回合還沒完成，離開的話不會被記錄喔。</p>',
      dismissible: false,
      buttons: [
        { label: '繼續玩', cls: 'primary', onClick: function () { resumeClock(g); } },
        {
          label: '離開', cls: 'danger',
          onClick: function () { stopGameTimers(g); g.done = true; state.game = null; renderMenu(); }
        }
      ]
    });
  };

  // 電腦鍵盤：數字鍵輸入、Backspace 刪除、Enter 確認／下一題
  document.addEventListener('keydown', function (e) {
    if (state.screen !== 'game' || !state.game || document.querySelector('.modal-overlay')) return;
    var k = e.key;
    if (/^[0-9]$/.test(k)) { pressKey(k); e.preventDefault(); }
    else if (k === 'Backspace') { pressBack(); e.preventDefault(); }
    else if (k === 'Enter') {
      e.preventDefault();
      if (state.game.waitNext) nextQuestion(); else submit();
    }
  });

  // =====================================================================
  // 回合結束
  // =====================================================================
  function finishGame() {
    var g = state.game;
    stopGameTimers(g);
    pauseClock(g);
    g.done = true;
    var p = player();
    var L = Q.LEVELS[g.level];

    var qrecs = g.qs.map(function (it) {
      return {
        text: it.q.text, op: it.q.op, answer: it.q.answer,
        attempts: it.attempts.slice(), result: it.result, stars: R.questionStars(it.result)
      };
    });
    var sc = R.scoreRound(qrecs, L.multiplier);
    var prior = S.sessionsFor(p.id);
    var session = {
      id: U.uid('s'),
      playerId: p.id,
      date: U.dateKey(new Date(g.startedAt)),
      startedAt: g.startedAt,
      level: g.level,
      durationSec: Math.round(g.activeMs / 1000),
      accuracy: sc.accuracy,
      stars: sc.total,
      starBreakdown: {
        first: sc.first, retry: sc.retry, wrong: sc.wrong, base: sc.base, multiplier: sc.multiplier,
        scaled: sc.scaled, bonusPerfect: sc.bonusPerfect, bonusAcc: sc.bonusAcc
      },
      questions: qrecs
    };

    var levelBefore = R.levelInfo(p.totalStars);
    var newRecord = R.isNewRecord(session, prior);
    S.addSession(session);
    var after = S.getPlayer(p.id);
    var newBadges = R.awardBadges(after, S.sessionsFor(p.id), { newRecord: newRecord });
    S.save();
    var levelAfter = R.levelInfo(after.totalStars);

    state.game = null;
    state.result = {
      session: session, score: sc, levelBefore: levelBefore, levelAfter: levelAfter,
      levelUp: levelAfter.level > levelBefore.level, newBadges: newBadges, newRecord: newRecord
    };
    renderResult();
  }

  function reviewHtml(questions) {
    var wrongs = questions.filter(function (q) { return q.result !== 'first'; });
    if (!wrongs.length) return '<div class="card review ok">🎉 全部第一次就答對，沒有錯題！</div>';
    var rows = wrongs.map(function (q) {
      var tag = q.result === 'retry' ? '<span class="tag retry">重答答對</span>' : '<span class="tag wrong">答錯</span>';
      return '<li><div class="rv-q">' + esc(q.text) + ' = <b>' + q.answer + '</b></div>' +
        '<div class="rv-a">你答：' + esc(q.attempts.join(' → ')) + ' ' + tag + '</div></li>';
    }).join('');
    return '<div class="card review"><h3>📝 錯題檢討（' + wrongs.length + ' 題）</h3><ul>' + rows + '</ul></div>';
  }

  function renderResult() {
    state.screen = 'result';
    var r = state.result;
    var s = r.session, sc = r.score;
    var L = Q.LEVELS[s.level];
    var title = sc.perfect ? '全對！你是數學天才 🎉' : sc.accuracy >= R.ACCURACY_THRESHOLD ? '好棒喔！👏' : '很努力！下次會更好 💪';

    var lines = '<li><span>基本星星（第一次對 ' + sc.first + ' 題 × ' + R.STAR_FIRST + '，重答對 ' + sc.retry + ' 題 × ' + R.STAR_RETRY + '）</span><b>' + sc.base + '</b></li>' +
      '<li><span>' + L.label + '難度 ×' + sc.multiplier + '</span><b>' + sc.scaled + '</b></li>';
    if (sc.bonusPerfect) lines += '<li><span>🏆 全部第一次答對加成</span><b>+' + sc.bonusPerfect + '</b></li>';
    if (sc.bonusAcc) lines += '<li><span>🎯 正確率 ' + Math.round(R.ACCURACY_THRESHOLD * 100) + '% 以上加成</span><b>+' + sc.bonusAcc + '</b></li>';

    var banners = '';
    if (r.levelUp) {
      banners += '<div class="banner levelup">🎊 升級啦！<br>' + r.levelBefore.emoji + ' ' + r.levelBefore.name +
        ' ➜ <b>' + r.levelAfter.emoji + ' ' + r.levelAfter.name + '</b></div>';
    }
    if (r.newRecord) banners += '<div class="banner record">⚡ 新紀錄！這是你' + L.label + '難度最快的一次！</div>';
    if (r.newBadges.length) {
      banners += '<div class="banner badge"><div>🏅 獲得新徽章！</div><div class="chips">' +
        r.newBadges.map(function (b) { return '<span class="chip-badge">' + b.emoji + ' ' + b.name + '</span>'; }).join('') + '</div></div>';
    }

    var info = r.levelAfter;
    UI.render(
      '<h1 class="title small">' + title + '</h1>' +
      '<div class="card result-card"><div class="result-grid">' +
      '<div><b>' + sc.correct + ' / ' + s.questions.length + '</b><span>答對題數</span></div>' +
      '<div><b>' + U.formatDuration(s.durationSec) + '</b><span>用時</span></div>' +
      '<div><b>+' + sc.total + ' ⭐</b><span>本回合星星</span></div></div>' +
      '<ul class="breakdown">' + lines + '<li class="sum"><span>合計</span><b>+' + sc.total + ' ⭐</b></li></ul>' +
      '<div class="lv-line">' + info.emoji + ' Lv.' + info.level + ' ' + info.name + '　⭐ ' + player().totalStars +
      (info.next ? '　（再 ' + info.toNext + ' ⭐ 升級）' : '') + '</div>' +
      '<div class="bar"><i style="width:' + Math.round(info.progress * 100) + '%"></i></div></div>' +
      banners + reviewHtml(s.questions) +
      '<div class="row sticky-actions">' +
      '<button class="btn primary" data-action="again" data-level="' + s.level + '">🔁 再玩一次</button>' +
      '<button class="btn" data-action="to-menu">🏠 回主選單</button></div>',
      'result'
    );

    UI.sound('finish');
    if (r.levelUp) { setTimeout(function () { UI.sound('levelup'); UI.confetti(['⭐', '🎉', '✨', info.emoji], 40); }, 500); }
    else if (r.newBadges.length) { setTimeout(function () { UI.sound('badge'); UI.confetti(['🏅', '✨', '⭐'], 24); }, 500); }
    else if (sc.perfect) { setTimeout(function () { UI.confetti(['⭐', '🎉', '✨'], 24); }, 400); }
  }

  actions.again = function (el) { startGame(el.getAttribute('data-level')); };

  // =====================================================================
  // 徽章
  // =====================================================================
  function renderBadges() {
    state.screen = 'badges';
    var p = player();
    var got = 0;
    var cells = R.BADGES.map(function (b) {
      var date = p.badges && p.badges[b.id];
      if (date) got++;
      return '<div class="badge' + (date ? '' : ' locked') + '">' +
        '<div class="b-emoji">' + (date ? b.emoji : '🔒') + '</div>' +
        '<div class="b-name">' + b.name + '</div>' +
        '<div class="b-desc">' + b.desc + '</div>' +
        (date ? '<div class="b-date">' + esc(date) + '</div>' : '') + '</div>';
    }).join('');
    UI.render(
      '<div class="topbar"><button class="icon-btn" data-action="to-menu" aria-label="返回">⬅</button>' +
      '<div class="who"><b>我的徽章</b></div><span class="icon-btn ghost"></span></div>' +
      '<p class="sub">已獲得 ' + got + ' / ' + R.BADGES.length + ' 個</p>' +
      '<div class="badge-grid">' + cells + '</div>',
      'badges'
    );
  }

  actions['open-badges'] = function () { UI.sound('tap'); renderBadges(); };

  // =====================================================================
  // 設定（音效、動畫）
  // =====================================================================
  actions['open-settings'] = function () {
    var st = S.settings();
    UI.modal({
      title: '⚙️ 設定',
      body: '<label class="switch-row"><span>🔊 音效</span><span class="switch"><input type="checkbox" id="st-sound"' + (st.sound ? ' checked' : '') + '><i></i></span></label>' +
        '<label class="switch-row"><span>✨ 動畫</span><span class="switch"><input type="checkbox" id="st-anim"' + (st.anim ? ' checked' : '') + '><i></i></span></label>',
      buttons: [{ label: '完成', cls: 'primary' }],
      noFocus: true,
      onOpen: function (box) {
        box.querySelector('#st-sound').addEventListener('change', function (e) {
          S.setSetting('sound', e.target.checked);
          if (e.target.checked) { UI.unlockAudio(); UI.sound('correct'); }
        });
        box.querySelector('#st-anim').addEventListener('change', function (e) {
          S.setSetting('anim', e.target.checked);
          UI.applySettings();
        });
      }
    });
  };

  // =====================================================================
  // 家長模式
  // =====================================================================
  var pinFails = 0;
  var pinLockedUntil = 0;

  function pinInput(id, label) {
    return '<label class="field">' + label + '<input id="' + id + '" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="' + C.PIN_LENGTH + '" autocomplete="off"></label>';
  }

  function setupPinModal(done) {
    UI.modal({
      title: '設定家長 PIN',
      body: '<p>第一次使用，請設定 ' + C.PIN_LENGTH + ' 位數字 PIN，之後進入家長模式要輸入它。</p>' +
        pinInput('pin1', '輸入 PIN') + pinInput('pin2', '再輸入一次'),
      buttons: [
        { label: '取消' },
        {
          label: '設定', cls: 'primary',
          onClick: function (box, close) {
            var a = box.querySelector('#pin1').value, b = box.querySelector('#pin2').value;
            var re = new RegExp('^\\d{' + C.PIN_LENGTH + '}$');
            if (!re.test(a)) { UI.toast('PIN 要是 ' + C.PIN_LENGTH + ' 位數字'); return false; }
            if (a !== b) { UI.toast('兩次輸入不一樣'); return false; }
            S.setPin(a).then(function () { close(); UI.toast('PIN 設定好了'); done(); });
            return false;
          }
        }
      ]
    });
  }

  function askPinModal(done) {
    UI.modal({
      title: '🔒 家長模式',
      body: pinInput('pin-in', '請輸入 PIN'),
      buttons: [
        { label: '取消' },
        {
          label: '進入', cls: 'primary',
          onClick: function (box, close) {
            var now = Date.now();
            if (now < pinLockedUntil) { UI.toast('輸入錯太多次，請稍後再試'); return false; }
            var input = box.querySelector('#pin-in');
            S.checkPin(input.value).then(function (ok) {
              if (ok) { pinFails = 0; close(); done(); return; }
              pinFails++;
              if (pinFails >= 5) { pinLockedUntil = Date.now() + 30000; pinFails = 0; UI.toast('輸入錯太多次，請 30 秒後再試'); }
              else UI.toast('PIN 不對喔');
              input.value = '';
              input.focus();
            });
            return false;
          }
        }
      ]
    });
  }

  actions['open-parent'] = function () {
    UI.sound('tap');
    var enter = function () {
      state.parent.pid = state.pid || (S.players()[0] && S.players()[0].id) || null;
      state.parent.tab = 'stats';
      state.parent.histCount = 20;
      renderParent();
    };
    if (S.hasPin()) askPinModal(enter); else setupPinModal(enter);
  };

  actions['parent-exit'] = function () { renderPlayers(); };

  actions['parent-tab'] = function (el) {
    state.parent.tab = el.getAttribute('data-tab');
    renderParent();
  };

  actions['parent-player'] = function (el) {
    state.parent.pid = el.getAttribute('data-id');
    state.parent.histCount = 20;
    renderParent();
  };

  actions['hist-more'] = function () { state.parent.histCount += 20; renderParent(); };

  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  function md(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }

  function statCard(title, st) {
    return '<div class="stat-card"><div class="stat-title">' + title + '</div>' +
      '<div class="stat-big">' + st.rounds + ' 次</div>' +
      '<div class="stat-line">⏱ ' + U.formatDuration(st.seconds) + '</div>' +
      '<div class="stat-line">🎯 ' + (st.total ? st.accuracy + '%' : '—') + '</div>' +
      '<div class="stat-line">⭐ ' + st.stars + '</div></div>';
  }

  function statsTabHtml(p) {
    var today = new Date();
    var tk = U.dateKey(today);
    var ws = U.weekStart(today);
    var week = S.statsBetween(p.id, U.dateKey(ws), tk);
    var all = S.summarize(S.sessionsFor(p.id));

    // 最近 7 天
    var days = [], maxSec = 1, i;
    for (i = 6; i >= 0; i--) {
      var d = U.addDays(today, -i);
      var st = S.statsBetween(p.id, U.dateKey(d), U.dateKey(d));
      days.push({ d: d, st: st });
      if (st.seconds > maxSec) maxSec = st.seconds;
    }
    var dayRows = days.map(function (x) {
      return '<tr><td>' + md(x.d) + '（' + WEEKDAYS[x.d.getDay()] + '）</td><td>' + x.st.rounds + '</td>' +
        '<td><div class="mini-bar"><i style="width:' + Math.round((x.st.seconds / maxSec) * 100) + '%"></i></div>' + U.formatDuration(x.st.seconds) + '</td>' +
        '<td>' + (x.st.total ? x.st.accuracy + '%' : '—') + '</td><td>' + x.st.stars + '</td></tr>';
    }).join('');

    // 近 4 週
    var weekRows = '';
    for (i = 0; i < 4; i++) {
      var s0 = U.addDays(ws, -7 * i), e0 = U.addDays(s0, 6);
      var w = S.statsBetween(p.id, U.dateKey(s0), U.dateKey(e0));
      weekRows += '<tr><td>' + md(s0) + '–' + md(e0) + (i === 0 ? '（本週）' : '') + '</td><td>' + w.rounds + '</td><td>' +
        U.formatDuration(w.seconds) + '</td><td>' + (w.total ? w.accuracy + '%' : '—') + '</td><td>' + w.stars + '</td></tr>';
    }

    // 各運算首次答對率（近 30 天）
    var from30 = U.dateKey(U.addDays(today, -29));
    var ops = { add: [0, 0], sub: [0, 0], mul: [0, 0], div: [0, 0] };
    S.sessionsFor(p.id).forEach(function (s) {
      if (s.date < from30) return;
      s.questions.forEach(function (q) { ops[q.op][0]++; if (q.result === 'first') ops[q.op][1]++; });
    });
    var opRows = Object.keys(ops).map(function (k) {
      var n = ops[k][0], f = ops[k][1];
      return '<tr><td>' + Q.OP_SYMBOL[k] + ' ' + Q.OP_NAME[k] + '</td><td>' + n + '</td><td>' +
        (n ? '<div class="mini-bar"><i style="width:' + U.pct(f, n) + '%"></i></div>' + U.pct(f, n) + '%' : '—') + '</td></tr>';
    }).join('');

    var info = R.levelInfo(p.totalStars);
    return '<div class="stat-row">' + statCard('今天', S.todayStats(p.id)) + statCard('本週', week) + statCard('累計', all) + '</div>' +
      '<div class="card"><h3>' + info.emoji + ' Lv.' + info.level + ' ' + info.name + '　⭐ ' + p.totalStars + '　🏅 ' + Object.keys(p.badges || {}).length + '/' + R.BADGES.length + '</h3></div>' +
      '<div class="card"><h3>最近 7 天</h3><table class="tbl"><thead><tr><th>日期</th><th>次數</th><th>時間</th><th>正確率</th><th>⭐</th></tr></thead><tbody>' + dayRows + '</tbody></table></div>' +
      '<div class="card"><h3>每週統計（近 4 週）</h3><table class="tbl"><thead><tr><th>週</th><th>次數</th><th>時間</th><th>正確率</th><th>⭐</th></tr></thead><tbody>' + weekRows + '</tbody></table></div>' +
      '<div class="card"><h3>各運算「第一次就答對」比率（近 30 天）</h3><table class="tbl"><thead><tr><th>運算</th><th>題數</th><th>第一次答對率</th></tr></thead><tbody>' + opRows + '</tbody></table></div>';
  }

  function historyTabHtml(p) {
    var list = S.sessionsFor(p.id).slice().reverse();
    if (!list.length) return '<div class="card">還沒有遊戲紀錄。</div>';
    var shown = list.slice(0, state.parent.histCount);
    var rows = shown.map(function (s) {
      var t = '';
      var dt = new Date(s.startedAt);
      if (!isNaN(dt.getTime())) t = ' ' + U.pad2(dt.getHours()) + ':' + U.pad2(dt.getMinutes());
      var correct = s.questions.filter(function (q) { return q.result !== 'wrong'; }).length;
      var L = Q.LEVELS[s.level];
      return '<details class="hist"><summary><span>' + esc(s.date) + t + '</span><span>' + L.emoji + L.label + '</span>' +
        '<span>' + correct + '/' + s.questions.length + '</span><span>' + U.formatDuration(s.durationSec) + '</span><span>⭐' + s.stars + '</span></summary>' +
        reviewHtml(s.questions) + '</details>';
    }).join('');
    var more = list.length > shown.length ? '<button class="btn" data-action="hist-more">顯示更多</button>' : '';
    return '<div class="card"><h3>歷史紀錄（共 ' + list.length + ' 回合，點開看錯題）</h3>' + rows + '</div>' + more;
  }

  function settingsTabHtml() {
    var st = S.settings();
    var limits = [0, 15, 30, 45, 60, 90, 120].map(function (m) {
      return '<option value="' + m + '"' + (st.dailyLimitMin === m ? ' selected' : '') + '>' + (m === 0 ? '不限制' : m + ' 分鐘') + '</option>';
    }).join('');
    var plist = S.players().map(function (p) {
      return '<div class="plist-row"><span class="avatar sm">' + esc(p.avatar) + '</span><b>' + esc(p.name) + '</b>' +
        '<button class="btn small" data-action="edit-player" data-id="' + esc(p.id) + '">✏️ 修改</button>' +
        '<button class="btn small danger" data-action="del-player" data-id="' + esc(p.id) + '">🗑️ 刪除</button></div>';
    }).join('');
    if (S.players().length < C.MAX_PLAYERS) plist += '<button class="btn small" data-action="add-player-parent">＋ 新增玩家</button>';
    return '<div class="card"><h3>遊玩限制</h3>' +
      '<label class="switch-row"><span>每位玩家「每日時間上限」</span><select data-change="limit">' + limits + '</select></label>' +
      '<p class="hint">達到上限後，當天無法再開始新回合（進行中的回合可以玩完）。</p></div>' +
      '<div class="card"><h3>題目設定</h3>' +
      '<label class="switch-row"><span>第二階段：乘除加入「2 位數 × 1 位數」</span><span class="switch"><input type="checkbox" data-change="twodigit"' + (st.twoDigitMul ? ' checked' : '') + '><i></i></span></label>' +
      '<p class="hint">開啟後，普通／困難難度的乘法與除法有一半機率出現 2 位數的題目（簡單難度不受影響）。</p></div>' +
      '<div class="card"><h3>玩家管理</h3>' + plist + '</div>' +
      '<div class="card"><h3>備份與安全</h3><div class="col">' +
      '<button class="btn" data-action="export">⬇️ 匯出紀錄檔</button>' +
      '<button class="btn" data-action="import">⬆️ 匯入紀錄檔</button>' +
      '<input type="file" id="import-file" accept=".json,application/json" class="hidden">' +
      '<button class="btn" data-action="change-pin">🔑 修改 PIN</button>' +
      '<button class="btn danger" data-action="reset-all">🧹 清除全部資料</button></div>' +
      '<p class="hint">資料只存在這台裝置的瀏覽器裡。換裝置或清除瀏覽器資料前，請先匯出備份。</p></div>';
  }

  function renderParent() {
    state.screen = 'parent';
    var P = state.parent;
    var ps = S.players();
    if (!S.getPlayer(P.pid)) P.pid = ps[0] ? ps[0].id : null;
    var p = P.pid ? S.getPlayer(P.pid) : null;

    var tabs = [['stats', '📊 統計'], ['history', '📜 歷史'], ['settings', '🔧 設定']].map(function (t) {
      return '<button class="tab' + (P.tab === t[0] ? ' sel' : '') + '" data-action="parent-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('');

    var chips = '';
    var body;
    if (P.tab === 'settings') {
      body = settingsTabHtml();
    } else if (!p) {
      body = '<div class="card">還沒有玩家。請到「設定」新增玩家。</div>';
    } else {
      chips = '<div class="chip-row">' + ps.map(function (x) {
        return '<button class="chip' + (x.id === P.pid ? ' sel' : '') + '" data-action="parent-player" data-id="' + esc(x.id) + '">' + esc(x.avatar) + ' ' + esc(x.name) + '</button>';
      }).join('') + '</div>';
      body = P.tab === 'stats' ? statsTabHtml(p) : historyTabHtml(p);
    }

    UI.render(
      '<div class="topbar"><button class="icon-btn" data-action="parent-exit" aria-label="離開家長模式">⬅</button>' +
      '<div class="who"><b>👨‍👩‍👧 家長模式</b></div><span class="icon-btn ghost"></span></div>' +
      '<div class="tabs">' + tabs + '</div>' + chips + body,
      'parent'
    );
  }

  // ----- 家長模式：玩家管理 -----
  actions['edit-player'] = function (el) {
    var p = S.getPlayer(el.getAttribute('data-id'));
    if (!p) return;
    playerModal(p, function (name, avatar) {
      S.updatePlayer(p.id, { name: name, avatar: avatar });
      renderParent();
    });
  };

  actions['add-player-parent'] = function () {
    playerModal(null, function (name, avatar) { S.addPlayer(name, avatar); renderParent(); });
  };

  actions['del-player'] = function (el) {
    var p = S.getPlayer(el.getAttribute('data-id'));
    if (!p) return;
    UI.modal({
      title: '刪除 ' + esc(p.name) + '？',
      body: '<p>這位玩家的所有紀錄、星星與徽章都會一起刪除，<b>無法復原</b>。建議先匯出備份。</p>',
      buttons: [{ label: '取消', cls: 'primary' }, { label: '確定刪除', cls: 'danger', onClick: function () { S.removePlayer(p.id); renderParent(); } }]
    });
  };

  // ----- 家長模式：備份 -----
  actions.export = function () {
    var blob = new Blob([S.exportData()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mathzoo-backup-' + U.dateKey() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    UI.toast('已匯出備份檔');
  };

  actions.import = function () {
    var f = $('import-file');
    if (f) f.click();
  };

  function handleImportFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result);
      UI.modal({
        title: '匯入紀錄檔',
        body: '<p><b>合併</b>：保留這台裝置現有的資料，只加入備份裡沒有的紀錄。<br><b>取代</b>：用備份檔完全取代這台裝置的玩家與紀錄。</p>',
        dismissible: false,
        buttons: [
          { label: '取消' },
          { label: '合併', cls: 'primary', onClick: function () { doImport(text, 'merge'); } },
          { label: '取代', cls: 'danger', onClick: function () { doImport(text, 'replace'); } }
        ]
      });
    };
    reader.readAsText(file);
  }

  function doImport(text, mode) {
    var r = S.importData(text, mode);
    if (!r.ok) { UI.toast(r.error); return; }
    UI.toast('匯入完成：' + r.players + ' 位玩家、' + r.sessions + ' 回合紀錄' + (r.skippedPlayers ? '（有 ' + r.skippedPlayers + ' 位因超過人數上限而略過）' : ''));
    renderParent();
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'import-file' && t.files && t.files[0]) { handleImportFile(t.files[0]); t.value = ''; return; }
    var kind = t.getAttribute && t.getAttribute('data-change');
    if (kind === 'limit') S.setSetting('dailyLimitMin', parseInt(t.value, 10) || 0);
    else if (kind === 'twodigit') S.setSetting('twoDigitMul', !!t.checked);
  });

  actions['change-pin'] = function () { setupPinModal(function () {}); };

  actions['reset-all'] = function () {
    UI.modal({
      title: '清除全部資料？',
      body: '<p>所有玩家、紀錄、星星、徽章都會被刪除，<b>無法復原</b>。<br>建議先匯出備份。</p>',
      buttons: [
        { label: '取消', cls: 'primary' },
        {
          label: '全部清除', cls: 'danger',
          onClick: function () { S.resetAll(); UI.toast('已清除全部資料'); renderParent(); }
        }
      ]
    });
  };

  // =====================================================================
  // 啟動
  // =====================================================================
  document.getElementById('app').addEventListener('click', function (e) {
    UI.unlockAudio();
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = actions[el.getAttribute('data-action')];
    if (fn) fn(el, e);
  });

  S.load();
  UI.applySettings();
  renderPlayers();
})();
