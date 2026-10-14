/* rewards.js — 星星、等級、徽章規則
 * 想調整獎勵，修改本檔最上方的數字或 LEVEL_TABLE / BADGES 即可。
 */
(function (root) {
  var MZ = (root.MZ = root.MZ || {});
  var U = MZ.util;

  // ===== 星星規則 =====
  var STAR_FIRST = 3; // 第一次就答對
  var STAR_RETRY = 1; // 重答答對
  var BONUS_PERFECT = 10; // 全部第一次答對的額外星星
  var BONUS_ACCURACY = 5; // 正確率達標的額外星星
  var ACCURACY_THRESHOLD = 0.8; // 正確率門檻（答對題數 ÷ 總題數）

  // ===== 等級（以動物成長命名）=====
  var LEVEL_TABLE = [
    { level: 1, name: '蛋寶寶', emoji: '🥚', min: 0 },
    { level: 2, name: '小雞', emoji: '🐥', min: 100 },
    { level: 3, name: '兔兔', emoji: '🐰', min: 250 },
    { level: 4, name: '小貓', emoji: '🐱', min: 500 },
    { level: 5, name: '小狗', emoji: '🐶', min: 800 },
    { level: 6, name: '小熊', emoji: '🐻', min: 1200 },
    { level: 7, name: '獅子', emoji: '🦁', min: 1800 },
    { level: 8, name: '獨角獸', emoji: '🦄', min: 2500 }
  ];

  function levelInfo(totalStars) {
    var idx = 0;
    for (var i = 0; i < LEVEL_TABLE.length; i++) {
      if (totalStars >= LEVEL_TABLE[i].min) idx = i;
    }
    var cur = LEVEL_TABLE[idx];
    var next = LEVEL_TABLE[idx + 1] || null;
    return {
      level: cur.level,
      name: cur.name,
      emoji: cur.emoji,
      min: cur.min,
      next: next,
      toNext: next ? next.min - totalStars : 0,
      progress: next ? (totalStars - cur.min) / (next.min - cur.min) : 1
    };
  }

  // questions: [{result:'first'|'retry'|'wrong'}]
  // 總星星 = 四捨五入(基本星星 × 難度倍率) + 全對加成 + 正確率加成
  function scoreRound(questions, multiplier) {
    var first = 0, retry = 0, wrong = 0;
    questions.forEach(function (q) {
      if (q.result === 'first') first++;
      else if (q.result === 'retry') retry++;
      else wrong++;
    });
    var n = questions.length;
    var base = first * STAR_FIRST + retry * STAR_RETRY;
    var scaled = Math.round(base * multiplier);
    var perfect = n > 0 && first === n;
    var accuracy = n > 0 ? (first + retry) / n : 0;
    var bonusPerfect = perfect ? BONUS_PERFECT : 0;
    var bonusAcc = accuracy >= ACCURACY_THRESHOLD ? BONUS_ACCURACY : 0;
    return {
      first: first, retry: retry, wrong: wrong,
      correct: first + retry,
      base: base, multiplier: multiplier, scaled: scaled,
      perfect: perfect, accuracy: accuracy,
      bonusPerfect: bonusPerfect, bonusAcc: bonusAcc,
      total: scaled + bonusPerfect + bonusAcc
    };
  }

  function questionStars(result) {
    return result === 'first' ? STAR_FIRST : result === 'retry' ? STAR_RETRY : 0;
  }

  // ===== 由歷史回合計算統計（徽章判斷用）=====
  function maxFirstStreak(questions) {
    var best = 0, cur = 0;
    questions.forEach(function (q) {
      if (q.result === 'first') { cur++; if (cur > best) best = cur; }
      else cur = 0;
    });
    return best;
  }

  function computeStats(sessions) {
    var st = {
      rounds: sessions.length,
      perfect: 0,
      maxStreak: 0,
      opCorrect: { add: 0, sub: 0, mul: 0, div: 0 },
      retryCorrect: 0,
      hardRounds: 0,
      maxDayRun: 0,
      maxDaysInWeek: 0
    };
    var days = {};
    var weeks = {};
    sessions.forEach(function (s) {
      var qs = s.questions || [];
      var firstCount = 0;
      qs.forEach(function (q) {
        if (q.result === 'first') firstCount++;
        if (q.result === 'retry') st.retryCorrect++;
        if ((q.result === 'first' || q.result === 'retry') && st.opCorrect[q.op] !== undefined) {
          st.opCorrect[q.op]++;
        }
      });
      if (qs.length > 0 && firstCount === qs.length) st.perfect++;
      st.maxStreak = Math.max(st.maxStreak, maxFirstStreak(qs));
      if (s.level === 'hard') st.hardRounds++;
      days[s.date] = true;
    });

    var keys = Object.keys(days).sort();
    var run = 0;
    keys.forEach(function (k, i) {
      if (i > 0 && U.dateKey(U.addDays(U.parseKey(keys[i - 1]), 1)) === k) run++;
      else run = 1;
      st.maxDayRun = Math.max(st.maxDayRun, run);
      var wk = U.dateKey(U.weekStart(U.parseKey(k)));
      weeks[wk] = (weeks[wk] || 0) + 1;
      st.maxDaysInWeek = Math.max(st.maxDaysInWeek, weeks[wk]);
    });
    return st;
  }

  // 是否刷新「同難度」最快用時（只比較正確率 80% 以上的回合，避免亂按求快）
  function isNewRecord(session, priorSessions) {
    if (session.accuracy < ACCURACY_THRESHOLD) return false;
    var times = priorSessions
      .filter(function (s) { return s.level === session.level && s.accuracy >= ACCURACY_THRESHOLD; })
      .map(function (s) { return s.durationSec; });
    if (times.length === 0) return false;
    return session.durationSec < Math.min.apply(null, times);
  }

  // ===== 徽章 =====
  var BADGES = [
    { id: 'first_round', emoji: '🐣', name: '初次登場', desc: '完成第一回合', check: function (s) { return s.rounds >= 1; } },
    { id: 'perfect', emoji: '💯', name: '滿分達人', desc: '一回合 15 題全部第一次就答對', check: function (s) { return s.perfect >= 1; } },
    { id: 'streak10', emoji: '🔥', name: '十連擊', desc: '連續 10 題都第一次就答對', check: function (s) { return s.maxStreak >= 10; } },
    { id: 'add_king', emoji: '➕', name: '加法王', desc: '加法累積答對 100 題', check: function (s) { return s.opCorrect.add >= 100; } },
    { id: 'sub_king', emoji: '➖', name: '減法王', desc: '減法累積答對 100 題', check: function (s) { return s.opCorrect.sub >= 100; } },
    { id: 'mul_king', emoji: '✖️', name: '乘法王', desc: '乘法累積答對 100 題', check: function (s) { return s.opCorrect.mul >= 100; } },
    { id: 'div_king', emoji: '➗', name: '除法王', desc: '除法累積答對 100 題', check: function (s) { return s.opCorrect.div >= 100; } },
    { id: 'fixer', emoji: '🛠️', name: '錯題終結者', desc: '重答答對累計 20 題', check: function (s) { return s.retryCorrect >= 20; } },
    { id: 'challenger', emoji: '🦁', name: '挑戰者', desc: '完成第一次困難回合', check: function (s) { return s.hardRounds >= 1; } },
    { id: 'record', emoji: '⚡', name: '打破紀錄', desc: '刷新自己同難度的最快用時（正確率要 80% 以上）', check: function (s, c) { return !!(c && c.newRecord); } },
    { id: 'days3', emoji: '📅', name: '三日連玩', desc: '連續 3 天都有玩', check: function (s) { return s.maxDayRun >= 3; } },
    { id: 'days7', emoji: '🗓️', name: '七日連玩', desc: '連續 7 天都有玩', check: function (s) { return s.maxDayRun >= 7; } },
    { id: 'weekly', emoji: '🌟', name: '週週有玩', desc: '同一週（週一到週日）玩滿 5 天', check: function (s) { return s.maxDaysInWeek >= 5; } }
  ];

  // 回傳「這次新得到」的徽章；並寫入 player.badges（徽章 id → 取得日期）
  function awardBadges(player, allSessions, ctx) {
    player.badges = player.badges || {};
    var stats = computeStats(allSessions);
    var earned = [];
    var today = U.dateKey();
    BADGES.forEach(function (b) {
      if (!player.badges[b.id] && b.check(stats, ctx || {})) {
        player.badges[b.id] = today;
        earned.push(b);
      }
    });
    return earned;
  }

  MZ.rewards = {
    STAR_FIRST: STAR_FIRST,
    STAR_RETRY: STAR_RETRY,
    BONUS_PERFECT: BONUS_PERFECT,
    BONUS_ACCURACY: BONUS_ACCURACY,
    ACCURACY_THRESHOLD: ACCURACY_THRESHOLD,
    LEVEL_TABLE: LEVEL_TABLE,
    BADGES: BADGES,
    levelInfo: levelInfo,
    scoreRound: scoreRound,
    questionStars: questionStars,
    computeStats: computeStats,
    isNewRecord: isNewRecord,
    awardBadges: awardBadges
  };
})(typeof window !== 'undefined' ? window : globalThis);
