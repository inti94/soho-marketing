/* =================================================================
   exchange.js — 실시간 환율 (시세 전광판)
   PART 3 (2026-06-26)
   -----------------------------------------------------------------
   · ExchangeRate-API (base USD) 호출 → USD/JPY(100엔)/CNY/EUR 대 KRW
   · KEY 는 assets/config.js 의 EXCHANGE_API_KEY 사용
   · 캐시: localStorage 'sohotip_fx' (+타임스탬프), TTL 이내면 캐시 사용
   · 실패 시: 캐시 폴백 → 캐시도 없으면 카드 숨김
   · 절대 원칙: 과거 환율을 하드코딩 fallback 으로 넣지 않는다.
   · window.SohoExchange.render(el) 로 호출 (briefing.js 가 호출)
   ================================================================= */
window.SohoExchange = (function () {
  'use strict';

  var CACHE_KEY = 'sohotip_fx';
  var TTL = 60 * 60 * 1000; // 1시간

  function cfg() { return window.SOHO_CONFIG || {}; }

  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function setCache(pairs, updatedUnix) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), updated: updatedUnix || null, data: pairs })); } catch (e) {}
  }

  function fmt(n, dec) {
    return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  /* base USD 환율표 → 표시용 통화쌍(원화 기준) 계산 */
  function computePairs(rates) {
    if (!rates || !rates.KRW) return null;
    var krw = rates.KRW, out = [];
    out.push({ code: 'USD', flag: '🇺🇸', label: '미국 달러', unit: '1달러', value: krw });
    if (rates.JPY) out.push({ code: 'JPY', flag: '🇯🇵', label: '일본 엔', unit: '100엔', value: krw / rates.JPY * 100 });
    if (rates.CNY) out.push({ code: 'CNY', flag: '🇨🇳', label: '중국 위안', unit: '1위안', value: krw / rates.CNY });
    if (rates.EUR) out.push({ code: 'EUR', flag: '🇪🇺', label: '유로', unit: '1유로', value: krw / rates.EUR });
    return out;
  }

  function rowsHTML(pairs) {
    return pairs.map(function (p) {
      return '<div class="board-row">' +
        '<span class="br-name">' + p.flag + ' ' + p.label + ' <small>(' + p.unit + ')</small></span>' +
        '<span class="br-val">' + fmt(p.value, 2) + '<small>원</small></span>' +
        '</div>';
    }).join('');
  }

  function whenText(ts) {
    try {
      var d = new Date(ts);
      var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
      return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2) + ' ' + hh + ':' + mm;
    } catch (e) { return ''; }
  }

  function paint(el, pairs, ts, stale) {
    el.innerHTML =
      '<div class="board-head"><span class="bh-t"><span class="led"></span>💱 오늘 환율</span>' +
      '<span class="bh-sub">원/외화</span></div>' +
      '<div class="board-body">' + rowsHTML(pairs) + '</div>' +
      '<div class="board-foot">' + (stale ? '⚠ 최신 연결 실패 · ' : '') + '기준 ' + whenText(ts) + ' · ExchangeRate-API</div>';
    el.style.display = '';
  }

  function loading(el) {
    el.innerHTML =
      '<div class="board-head"><span class="bh-t"><span class="led"></span>💱 오늘 환율</span></div>' +
      '<div class="board-loading">시세를 불러오는 중…</div>';
    el.style.display = '';
  }

  function hide(el) { el.style.display = 'none'; }

  function render(el) {
    if (!el) return;
    var cache = getCache();
    var fresh = cache && cache.data && (Date.now() - cache.ts < TTL);

    /* 1) 캐시가 신선하면 바로 표시 (네트워크 호출 절약) */
    if (fresh) { paint(el, cache.data, cache.ts, false); return; }

    var key = (cfg().EXCHANGE_API_KEY || '').trim();

    /* 2) 실시간 호출
       · KEY 있으면 운영자의 ExchangeRate-API(키 엔드포인트) 사용
       · KEY 없으면 무키 무료 엔드포인트(open.er-api.com, 브라우저 CORS 허용)로 자동 폴백
         → 키를 안 넣어도 카드가 실데이터로 동작. (과거값 하드코딩 아님 — 실시간 API) */
    loading(el);
    var url = key
      ? 'https://v6.exchangerate-api.com/v6/' + encodeURIComponent(key) + '/latest/USD'
      : 'https://open.er-api.com/v6/latest/USD';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || j.result !== 'success') throw new Error('api');
        /* 키 엔드포인트=conversion_rates / 무키 엔드포인트=rates */
        var pairs = computePairs(j.conversion_rates || j.rates);
        if (!pairs) throw new Error('rates');
        setCache(pairs, j.time_last_update_unix || null);
        paint(el, pairs, Date.now(), false);
      })
      .catch(function () {
        /* 실패 → 캐시 폴백, 캐시도 없으면 카드 숨김 (과거값 하드코딩 금지) */
        if (cache && cache.data) paint(el, cache.data, cache.ts, true);
        else hide(el);
      });
  }

  return { render: render };
})();
