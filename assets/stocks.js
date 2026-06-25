/* =================================================================
   stocks.js — 실시간 주가 (시세 전광판)
   PART 3 (2026-06-26)
   -----------------------------------------------------------------
   · 종목: (한국)삼성전자·SK하이닉스·NAVER·카카오
           (미국)애플·MS·엔비디아·테슬라  (일본)토요타·소니
   · 무료 API: Finnhub (assets/config.js 의 STOCK_API_KEY).
     ▷ 무료 플랜은 미국 종목 위주로 동작. 한국/일본 종목은 미지원일 수 있어
       받아지는 종목만 표시하고 나머지는 숨깁니다.
   · 완전 독립: 모든 처리를 try/catch 로 감싸 실패해도 사이트에 영향 없음.
   · 실패/데이터 없음 → "주가 정보는 준비 중입니다" 안내 카드로 대체.
   · 절대 원칙: 과거 주가를 하드코딩해서 표시하지 않는다.
   · window.SohoStocks.render(el) 로 호출 (briefing.js 가 호출)
   ================================================================= */
window.SohoStocks = (function () {
  'use strict';

  var CACHE_KEY = 'sohotip_stocks';
  var TTL = 15 * 60 * 1000; // 15분

  /* 종목 정의 (sym = Finnhub 심볼) */
  var SYMBOLS = [
    { sym: '005930.KS', name: '삼성전자',       cur: 'KRW', flag: '🇰🇷' },
    { sym: '000660.KS', name: 'SK하이닉스',     cur: 'KRW', flag: '🇰🇷' },
    { sym: '035420.KS', name: 'NAVER',          cur: 'KRW', flag: '🇰🇷' },
    { sym: '035720.KS', name: '카카오',         cur: 'KRW', flag: '🇰🇷' },
    { sym: 'AAPL',      name: '애플',           cur: 'USD', flag: '🇺🇸' },
    { sym: 'MSFT',      name: '마이크로소프트', cur: 'USD', flag: '🇺🇸' },
    { sym: 'NVDA',      name: '엔비디아',       cur: 'USD', flag: '🇺🇸' },
    { sym: 'TSLA',      name: '테슬라',         cur: 'USD', flag: '🇺🇸' },
    { sym: '7203.T',    name: '토요타',         cur: 'JPY', flag: '🇯🇵' },
    { sym: '6758.T',    name: '소니',           cur: 'JPY', flag: '🇯🇵' },
  ];

  function cfg() { return window.SOHO_CONFIG || {}; }
  function getCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function setCache(items) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: items })); } catch (e) {} }

  var CUR_SYMBOL = { KRW: '₩', USD: '$', JPY: '¥' };
  function fmtPrice(v, cur) {
    var dec = cur === 'USD' ? 2 : 0;
    return (CUR_SYMBOL[cur] || '') + Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function rowsHTML(items) {
    return items.map(function (s) {
      var up = s.dp > 0, down = s.dp < 0;
      var cls = up ? 'up' : (down ? 'down' : 'flat');
      var arr = up ? '▲' : (down ? '▼' : '−');
      var dp = (s.dp == null) ? '' : (s.dp > 0 ? '+' : '') + (Math.round(s.dp * 100) / 100) + '%';
      return '<div class="board-row">' +
        '<span class="br-name">' + s.flag + ' ' + s.name + '</span>' +
        '<span class="br-val">' + fmtPrice(s.c, s.cur) +
        ' <span class="br-chg ' + cls + '">' + arr + ' ' + dp + '</span></span>' +
        '</div>';
    }).join('');
  }

  function whenText(ts) {
    try {
      var d = new Date(ts);
      return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2) +
        ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) { return ''; }
  }

  function paint(el, items, ts, stale) {
    el.innerHTML =
      '<div class="board-head"><span class="bh-t"><span class="led"></span>📈 실시간 주가</span>' +
      '<span class="bh-sub">' + items.length + '종목</span></div>' +
      '<div class="board-body">' + rowsHTML(items) + '</div>' +
      '<div class="board-foot">' + (stale ? '⚠ 최신 연결 실패 · ' : '') + '기준 ' + whenText(ts) + ' · Finnhub</div>';
    el.style.display = '';
  }

  function fallbackCard(el) {
    /* 데이터 없음 → 과거값 대신 안내 카드 */
    el.innerHTML =
      '<div class="board-head"><span class="bh-t"><span class="led led-off"></span>📈 실시간 주가</span></div>' +
      '<div class="board-empty">주가 정보는 준비 중입니다.<br><small>잠시 후 다시 확인해 주세요.</small></div>';
    el.style.display = '';
  }

  function loading(el) {
    el.innerHTML =
      '<div class="board-head"><span class="bh-t"><span class="led"></span>📈 실시간 주가</span></div>' +
      '<div class="board-loading">시세를 불러오는 중…</div>';
    el.style.display = '';
  }

  function fetchQuote(item, key) {
    var url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(item.sym) + '&token=' + encodeURIComponent(key);
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        // c=현재가, dp=등락률(%). 유효한 가격만 채택.
        if (!j || typeof j.c !== 'number' || j.c <= 0) return null;
        return { sym: item.sym, name: item.name, cur: item.cur, flag: item.flag, c: j.c, dp: (typeof j.dp === 'number' ? j.dp : null) };
      })
      .catch(function () { return null; });
  }

  function render(el) {
    if (!el) return;
    try {
      var cache = getCache();
      var fresh = cache && cache.data && cache.data.length && (Date.now() - cache.ts < TTL);
      if (fresh) { paint(el, cache.data, cache.ts, false); return; }

      var key = (cfg().STOCK_API_KEY || '').trim();

      /* KEY 없음 → 캐시라도 있으면 표시, 없으면 안내 카드 */
      if (!key) {
        if (cache && cache.data && cache.data.length) paint(el, cache.data, cache.ts, true);
        else fallbackCard(el);
        return;
      }

      loading(el);
      var jobs = SYMBOLS.map(function (s) { return fetchQuote(s, key); });
      Promise.all(jobs).then(function (results) {
        var ok = [];
        for (var i = 0; i < results.length; i++) { if (results[i]) ok.push(results[i]); }
        if (ok.length) { setCache(ok); paint(el, ok, Date.now(), false); }
        else if (cache && cache.data && cache.data.length) paint(el, cache.data, cache.ts, true);
        else fallbackCard(el);
      }).catch(function () {
        if (cache && cache.data && cache.data.length) paint(el, cache.data, cache.ts, true);
        else fallbackCard(el);
      });
    } catch (e) {
      /* 어떤 경우에도 사이트에 영향 없이 안내 카드로 */
      try { fallbackCard(el); } catch (e2) {}
    }
  }

  return { render: render };
})();
