/* =================================================================
   briefing.js — "오늘의 사업 브리핑" 오케스트레이터
   PART 3 (2026-06-26)
   -----------------------------------------------------------------
   · index.html 의 <section id="briefing"> 안에 브리핑 UI를 구성
   · (b)금리 / (c)~(f)뉴스는 briefing-data.js 에서 렌더 (검증된 것만, 없으면 숨김)
   · (a)환율 = exchange.js, 주가 = stocks.js 가 전광판 카드에 채움
   · CSS 자체 주입 (PART 1 영수증 토큰 + var 폴백)
   ================================================================= */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }

  /* ── CSS 1회 주입 ──────────────────────────── */
  function injectStyle() {
    if (document.getElementById('soho-briefing-style')) return;
    var css = [
      '#briefing{display:block;}',
      '.brief-block{padding:40px 0;}',
      '.brief-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;align-items:start;}',

      /* 시세 전광판(어두운 카드) */
      '.board{background:#15110D;color:#fff;border-radius:14px;padding:6px 18px 14px;box-shadow:0 10px 28px rgba(21,17,13,.28);min-height:90px;}',
      '.board-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 0 8px;border-bottom:1px dashed rgba(255,255,255,.18);}',
      '.board-head .bh-t{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;}',
      '.board-head .bh-sub{font-family:var(--mono,"Roboto Mono","Consolas",monospace);font-size:11px;color:rgba(255,255,255,.45);}',
      '.led{width:8px;height:8px;border-radius:50%;background:#33D17A;box-shadow:0 0 8px #33D17A;display:inline-block;animation:ledblink 1.6s infinite;}',
      '.led-off{background:#7a6f63;box-shadow:none;animation:none;}',
      '@keyframes ledblink{0%,100%{opacity:1;}50%{opacity:.35;}}',
      '.board-body{padding:4px 0 0;}',
      '.board-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px dotted rgba(255,255,255,.1);}',
      '.board-row:last-child{border-bottom:none;}',
      '.board-row .br-name{font-size:13.5px;color:rgba(255,255,255,.82);}',
      '.board-row .br-name small{color:rgba(255,255,255,.4);font-size:11px;}',
      '.board-row .br-val{font-family:var(--mono,"Roboto Mono","Consolas",monospace);font-variant-numeric:tabular-nums;font-size:16px;font-weight:700;color:#FFD466;white-space:nowrap;}',
      '.board-row .br-val small{font-size:11px;color:rgba(255,212,102,.7);font-weight:500;margin-left:1px;}',
      '.br-chg{font-size:12px;font-weight:700;margin-left:6px;}',
      '.br-chg.up{color:#FF6B5E;}.br-chg.down{color:#4DA3FF;}.br-chg.flat{color:rgba(255,255,255,.5);}',
      '.board-foot{font-family:var(--mono,"Roboto Mono","Consolas",monospace);font-size:10.5px;color:rgba(255,255,255,.4);padding-top:10px;text-align:right;}',
      '.board-loading,.board-empty{padding:22px 4px;text-align:center;color:rgba(255,255,255,.6);font-size:13.5px;line-height:1.6;}',
      '.board-empty small{color:rgba(255,255,255,.4);}',

      /* 금리 카드(밝은 영수증) */
      '.rate-card{background:var(--receipt,#fff);border:1px solid var(--line,#EDE3D5);border-radius:14px;box-shadow:0 6px 18px rgba(42,32,24,.08);padding:18px;}',
      '.rate-card .rc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.rate-card .rc-t{font-weight:800;font-size:15px;color:var(--ink,#2A2018);}',
      '.rate-card .rc-badge{font-family:var(--mono,"Roboto Mono",monospace);font-size:10.5px;color:var(--sub,#8A7B6B);}',
      '.rate-card .rc-val{font-family:var(--mono,"Roboto Mono",monospace);font-size:34px;font-weight:700;color:var(--orange-d,#2438B0);letter-spacing:-.02em;margin:10px 0 2px;}',
      '.rate-card .rc-val .pct{font-size:20px;}',
      '.rate-card .rc-pending{font-size:22px;color:var(--sub,#8A7B6B);font-weight:700;margin:12px 0 2px;}',
      '.rate-card .rc-sub{font-size:12px;color:var(--sub,#8A7B6B);line-height:1.5;}',
      '.rate-card .rc-sub a{color:var(--orange,#3D5AFE);text-decoration:none;}',

      /* 뉴스 카드 */
      '.news-card{background:var(--receipt,#fff);border:1px solid var(--line,#EDE3D5);border-radius:14px;box-shadow:0 6px 18px rgba(42,32,24,.08);padding:16px 18px;}',
      '.news-card .nc-h{font-weight:800;font-size:14px;color:var(--ink,#2A2018);margin-bottom:10px;display:flex;align-items:center;gap:7px;}',
      '.news-item{display:block;text-decoration:none;color:var(--ink,#2A2018);padding:10px 0;border-top:1px dotted var(--line,#EDE3D5);}',
      '.news-item:first-of-type{border-top:none;}',
      '.news-item .ni-t{font-size:13.5px;font-weight:700;line-height:1.4;}',
      '.news-item:hover .ni-t{color:var(--orange,#3D5AFE);}',
      '.news-item .ni-s{font-size:12px;color:var(--sub,#8A7B6B);line-height:1.5;margin-top:2px;}',
      '.news-item .ni-d{font-family:var(--mono,"Roboto Mono",monospace);font-size:10.5px;color:var(--sub,#8A7B6B);margin-top:3px;}',
      '.news-empty{background:var(--receipt,#fff);border:1px dashed var(--dash,#D6C8B6);border-radius:14px;padding:20px;text-align:center;color:var(--sub,#8A7B6B);font-size:13px;line-height:1.6;}',

      '@media (max-width:768px){.brief-grid{grid-template-columns:1fr;}}',
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'soho-briefing-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ── 금리 카드 ─────────────────────────────── */
  function rateCardHTML() {
    var data = (window.SOHO_BRIEFING && window.SOHO_BRIEFING.baseRate) || {};
    var valNum = (typeof data.value === 'number' && isFinite(data.value)) ? data.value : null;
    var src = data.source || '한국은행 기준금리';
    var inner;
    if (valNum !== null) {
      inner = '<div class="rc-val">' + esc(String(valNum)) + '<span class="pct">%</span></div>' +
        '<div class="rc-sub">' + esc(src) + (data.asOf ? ' · ' + esc(data.asOf) + ' 기준' : '') +
        (data.url ? ' · <a href="' + esc(data.url) + '" target="_blank" rel="noopener">출처</a>' : '') + '</div>';
    } else {
      /* 검증 전 — 임의 수치 노출 금지 */
      inner = '<div class="rc-pending">확인 중</div>' +
        '<div class="rc-sub">' + esc(src) + ' 발표값을 확인해 표시합니다.' +
        (data.url ? ' <a href="' + esc(data.url) + '" target="_blank" rel="noopener">한국은행 →</a>' : '') + '</div>';
    }
    return '<div class="rate-card" id="rate-card">' +
      '<div class="rc-top"><span class="rc-t">🏦 오늘 금리</span><span class="rc-badge">기준금리</span></div>' +
      inner + '</div>';
  }

  /* ── 뉴스 카드 ─────────────────────────────── */
  var NEWS_CATS = [
    { key: 'policyNews',     label: '소상공인 정책 뉴스', emoji: '📌' },
    { key: 'naverUpdates',   label: '네이버 업데이트',     emoji: '📍' },
    { key: 'deliveryPolicy', label: '배달앱 정책 변화',    emoji: '🛵' },
    { key: 'govSupport',     label: '정부 지원사업',       emoji: '💰' },
  ];

  function newsCardsHTML() {
    var B = window.SOHO_BRIEFING || {};
    var html = '', any = false;
    NEWS_CATS.forEach(function (cat) {
      var items = isArr(B[cat.key]) ? B[cat.key].filter(Boolean) : [];
      if (!items.length) return;
      any = true;
      /* 최신순 정렬(date 있으면) */
      items = items.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      html += '<div class="news-card"><div class="nc-h">' + cat.emoji + ' ' + esc(cat.label) + '</div>';
      items.forEach(function (it) {
        var tag = it.url ? 'a' : 'div';
        var href = it.url ? ' href="' + esc(it.url) + '" target="_blank" rel="noopener"' : '';
        html += '<' + tag + ' class="news-item"' + href + '>' +
          '<div class="ni-t">' + esc(it.title || '') + '</div>' +
          (it.summary ? '<div class="ni-s">' + esc(it.summary) + '</div>' : '') +
          (it.date ? '<div class="ni-d">' + esc(String(it.date).replace(/-/g, '.')) + '</div>' : '') +
          '</' + tag + '>';
      });
      html += '</div>';
    });
    if (!any) {
      /* 검증된 소식이 아직 없을 때 — 빈 자리 대신 정직한 안내(임의 내용 금지) */
      html = '<div class="news-empty">📰 오늘의 사업 소식은 준비 중이에요.<br>정책·지원사업 소식이 확인되는 대로 이곳에 올라옵니다.</div>';
    }
    return html;
  }

  /* ── 빌드 ──────────────────────────────────── */
  function build() {
    var host = document.getElementById('briefing');
    if (!host || host.getAttribute('data-soho-built')) return;
    host.setAttribute('data-soho-built', '1');
    injectStyle();

    host.className = 'block brief-block';
    host.innerHTML =
      '<div class="sec-title">🧾 오늘의 사업 브리핑</div>' +
      '<p class="sec-desc">환율·금리·업계 소식을 매일 아침 한 장으로 확인하세요.</p>' +
      '<div class="brief-grid">' +
        '<div class="board" id="fx-board"></div>' +
        '<div class="board" id="stock-board"></div>' +
        rateCardHTML() +
        newsCardsHTML() +
      '</div>';

    /* 환율·주가 전광판 — 각각 독립 실행(실패해도 서로/페이지에 영향 없음) */
    try { if (window.SohoExchange) window.SohoExchange.render(document.getElementById('fx-board')); else document.getElementById('fx-board').style.display = 'none'; } catch (e) { try { document.getElementById('fx-board').style.display = 'none'; } catch (e2) {} }
    try { if (window.SohoStocks) window.SohoStocks.render(document.getElementById('stock-board')); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
