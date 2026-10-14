/* questions.js — 出題規則
 * 四則混合隨機；減法不出負數；除法由「商 × 除數」反推，確保整除。
 * 想調整難度範圍，修改下方 LEVELS 即可。
 */
(function (root) {
  var MZ = (root.MZ = root.MZ || {});
  var U = MZ.util;

  var OP_SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' };
  var OP_NAME = { add: '加法', sub: '減法', mul: '乘法', div: '除法' };

  // 難度設定
  //  addMax：加減法的最大數（加法的和不超過它）
  //  carry ：加減法是否「必須」進位／退位
  //  mulMin/mulMax：乘法與除法使用的乘法表範圍
  //  multiplier：星星的難度倍率
  //  twoDigit：家長模式開啟「2 位數 × 1 位數」後，這個難度是否會出現
  //  LEVEL_ORDER：選難度畫面的排列順序
  var LEVELS = {
    easy: {
      id: 'easy', label: '簡單', emoji: '🌱', multiplier: 1,
      desc: '加減到 2 位數，乘除用 2～5 的乘法表',
      addMax: 99, carry: false, mulMin: 2, mulMax: 5, twoDigit: false
    },
    mid: {
      id: 'mid', label: '中等', emoji: '🌼', multiplier: 1.25,
      desc: '加減到 2 位數，乘除用 4～9 的乘法表',
      addMax: 99, carry: false, mulMin: 4, mulMax: 9, twoDigit: false
    },
    normal: {
      id: 'normal', label: '普通', emoji: '🌿', multiplier: 1.5,
      desc: '加減到 3 位數，乘除用 9×9 乘法表',
      addMax: 999, carry: false, mulMin: 2, mulMax: 9, twoDigit: true
    },
    hard: {
      id: 'hard', label: '困難', emoji: '🌳', multiplier: 2,
      desc: '加減 3 位數且要進位／退位，乘除 9×9',
      addMax: 999, carry: true, mulMin: 2, mulMax: 9, twoDigit: true
    }
  };
  var LEVEL_ORDER = ['easy', 'mid', 'normal', 'hard'];

  // 是否有進位 / 退位（只要任一位數需要就算）
  function hasCarry(a, b) {
    while (a > 0 || b > 0) {
      if ((a % 10) + (b % 10) >= 10) return true;
      a = Math.floor(a / 10);
      b = Math.floor(b / 10);
    }
    return false;
  }

  function hasBorrow(a, b) {
    // 前提：a >= b
    while (b > 0) {
      if (a % 10 < b % 10) return true;
      a = Math.floor(a / 10);
      b = Math.floor(b / 10);
    }
    return false;
  }

  function genAdd(L) {
    var a, b, tries = 0;
    do {
      if (L.addMax <= 99) {
        a = U.randInt(10, 89);
        b = U.randInt(1, 99 - a);
      } else {
        a = U.randInt(100, 900);
        b = U.randInt(10, 999 - a);
      }
      tries++;
    } while (L.carry && !hasCarry(a, b) && tries < 300);
    return { a: a, b: b, answer: a + b };
  }

  function genSub(L) {
    var a, b, tries = 0;
    do {
      if (L.addMax <= 99) {
        a = U.randInt(11, 99);
        b = U.randInt(1, a - 1);
      } else {
        a = U.randInt(100, 999);
        b = U.randInt(10, a - 1);
      }
      tries++;
    } while (L.carry && !hasBorrow(a, b) && tries < 300);
    return { a: a, b: b, answer: a - b };
  }

  // 第二階段：打開「2 位數 × 1 位數」（家長模式的開關 twoDigitMul）
  function twoDigitRange(L) {
    return L.id === 'hard' ? [11, 99] : [11, 30];
  }

  function genMul(L, opts) {
    var a, b;
    if (opts.twoDigitMul && L.twoDigit && Math.random() < 0.5) {
      var r = twoDigitRange(L);
      var big = U.randInt(r[0], r[1]);
      var small = U.randInt(2, 9);
      if (Math.random() < 0.5) { a = big; b = small; } else { a = small; b = big; }
    } else {
      a = U.randInt(L.mulMin, L.mulMax);
      b = U.randInt(L.mulMin, L.mulMax);
    }
    return { a: a, b: b, answer: a * b };
  }

  function genDiv(L, opts) {
    var divisor, quotient;
    if (opts.twoDigitMul && L.twoDigit && Math.random() < 0.5) {
      var r = twoDigitRange(L);
      quotient = U.randInt(r[0], r[1]);
      divisor = U.randInt(2, 9);
    } else {
      quotient = U.randInt(L.mulMin, L.mulMax);
      divisor = U.randInt(L.mulMin, L.mulMax);
    }
    return { a: quotient * divisor, b: divisor, answer: quotient };
  }

  function makeOne(op, L, opts) {
    var r;
    if (op === 'add') r = genAdd(L);
    else if (op === 'sub') r = genSub(L);
    else if (op === 'mul') r = genMul(L, opts);
    else r = genDiv(L, opts);
    return {
      op: op,
      a: r.a,
      b: r.b,
      answer: r.answer,
      text: r.a + ' ' + OP_SYMBOL[op] + ' ' + r.b,
      key: op + ':' + r.a + ':' + r.b
    };
  }

  // 產生一回合（預設 15 題）：四種運算盡量平均，順序隨機，不重複
  function generateRound(levelId, opts) {
    opts = opts || {};
    var L = LEVELS[levelId] || LEVELS.normal;
    var size = MZ.CONFIG.ROUND_SIZE;
    var base = U.shuffle(['add', 'sub', 'mul', 'div']);
    var ops = [];
    for (var i = 0; i < size; i++) ops.push(base[i % 4]);
    ops = U.shuffle(ops);

    var seen = {};
    var out = [];
    ops.forEach(function (op) {
      var q, tries = 0;
      do {
        q = makeOne(op, L, opts);
        tries++;
      } while (seen[q.key] && tries < 80);
      seen[q.key] = true;
      out.push(q);
    });
    return out;
  }

  MZ.questions = {
    LEVELS: LEVELS,
    LEVEL_ORDER: LEVEL_ORDER,
    OP_SYMBOL: OP_SYMBOL,
    OP_NAME: OP_NAME,
    generateRound: generateRound,
    makeOne: makeOne,
    hasCarry: hasCarry,
    hasBorrow: hasBorrow
  };
})(typeof window !== 'undefined' ? window : globalThis);
