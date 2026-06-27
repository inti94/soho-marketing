/* =================================================================
   assets/network.js — 6사이트 생애주기 네트워크 "함께 보면 좋은 정보"
   PART 4 (2026-06-26)
   -----------------------------------------------------------------
   생애주기 흐름: 소상공인 → 자동차 → 결혼 → 집 → 재테크 → 육아
   · 현재 글/계산기의 맥락(data-topic·키워드)이 맞을 때만 다른 사이트를
     "함께 보면 좋은 정보" 영수증 카드로 추천. (억지 링크 금지)
   · 6개 사이트 어디에든 복사해 재사용 가능 — 아래 CURRENT_SITE 와
     OUTGOING[해당 사이트] 규칙만 바꾸면 그대로 동작한다.
   · 아직 도메인이 없는 사이트는 url:'' 로 두면 "준비 중"으로 비활성 표시.
   -----------------------------------------------------------------
   ※ 루트의 기존 network.js(푸터 법적링크)와는 별개 파일/별개 id 라 무충돌.
   ================================================================= */
(function () {
  'use strict';
  if (window.__sohoNetV2) return;
  window.__sohoNetV2 = true;

  /* ★ 이식할 때 이 값만 바꾸면 됩니다 (예: 카백과 = 'car') */
  var CURRENT_SITE = 'soho';

  /* 6개 사이트 레지스트리. url:'' → 아직 준비 중(비활성). */
  var SITES = {
    soho:    { name: '소호팁',   emoji: '🏪', url: 'https://sohotip.co.kr', desc: '소상공인 계산기·실전 가이드' },
    car:     { name: '카백과',   emoji: '🚗', url: '', desc: '자동차 구매·세금·보험' },
    wedding: { name: '신혼백과', emoji: '💍', url: '', desc: '결혼 준비·예산' },
    house:   { name: '집백과',   emoji: '🏠', url: '', desc: '부동산·임대차·내집마련' },
    money:   { name: '머니백과', emoji: '💰', url: '', desc: '대출·재테크·금융' },
    baby:    { name: '맘백과',   emoji: '👶', url: '', desc: '육아·출산 지원' },
  };

  /* 사이트별 "내보내는" 추천 규칙. 맥락(정규식)이 맞을 때만 노출.
     to: 대상 사이트 id / match: 페이지 텍스트 정규식 / title·desc: 카드 카피
     ── 다른 사이트로 이식 시 OUTGOING[그 사이트]에 규칙을 추가하면 됨. */
  var OUTGOING = {
    soho: [
      { to: 'car',   match: /사업용\s*차량|업무용\s*차량|차량\s*경비|차량\s*절세|법인\s*차|영업용\s*차|차량\s*리스|화물차|용달|차량\s*보험/i,
        title: '사업용 차량, 세금 얼마나 아낄까?',
        desc: '업무용 차량 경비처리·보험·취득세까지. 차 한 대로 새는 돈, 카백과에서 정리했어요.' },
      { to: 'money', match: /정책자금|소상공인\s*대출|융자|보증재단|대환|자금\s*조달|이자|금리|상환/i,
        title: '정책자금·대출, 더 깊게 비교하기',
        desc: '한도·금리·갈아타기 조건까지. 빌리기 전에 머니백과에서 따져보고 결정하세요.' },
      { to: 'house', match: /임대차|상가\s*임대|권리금|환산보증금|보증금|월세|상가\s*계약|점포\s*계약|임대료/i,
        title: '상가 임대차, 손해 안 보려면',
        desc: '계약·권리금·보증금 분쟁은 미리 챙겨야 덜 답답하죠. 집백과에서 확인하세요.' },
    ],
    /* 다른 사이트 예시 (이식 시 채움)
    car:     [ { to:'soho',  match:/개인사업자|화물|자영업/i, title:'...', desc:'...' } ],
    wedding: [], house: [], money: [], baby: [],
    */
  };

  var MAX_CARDS = 2;

  function pageText() {
    var parts = [];
    var dt = document.querySelector('[data-topic]'); if (dt) parts.push(dt.getAttribute('data-topic') || '');
    var mk = document.querySelector('meta[name="keywords"]'); if (mk && mk.content) parts.push(mk.content);
    if (document.title) parts.push(document.title);
    var h1 = document.querySelector('h1'); if (h1) parts.push(h1.textContent || '');
    var tag = document.querySelector('.article-tag'); if (tag) parts.push(tag.textContent || '');
    return parts.join('  ');
  }

  function contentHost() {
    return document.querySelector('.article-main')
      || document.querySelector('.article-content')
      || document.querySelector('.page-wrap');
  }

  function pick() {
    var rules = OUTGOING[CURRENT_SITE] || [];
    var blob = pageText();
    var chosen = [], seen = {};
    for (var i = 0; i < rules.length && chosen.length < MAX_CARDS; i++) {
      var r = rules[i];
      if (r.to === CURRENT_SITE || seen[r.to]) continue;
      if (r.match && r.match.test(blob)) {
        var site = SITES[r.to];
        if (site) { seen[r.to] = 1; chosen.push({ rule: r, site: site }); }
      }
    }
    return chosen;
  }

  function injectStyle() {
    if (document.getElementById('soho-net-style')) return;
    var css = [
      '.soho-net{max-width:680px;margin:30px auto;font-family:var(--sans,"Apple SD Gothic Neo","Noto Sans KR",sans-serif);}',
      '.page-wrap .soho-net,.article-main .soho-net,.article-content .soho-net{max-width:100%;}',
      '.soho-net-head{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--sub,#8A7B6B);margin-bottom:10px;}',
      '.soho-net-head::before{content:"";width:16px;height:2px;background:var(--orange,#3D5AFE);display:inline-block;}',
      '.soho-net-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;}',
      '.soho-net-card{display:flex;gap:12px;align-items:flex-start;background:var(--receipt,#fff);border:1px solid var(--line,#EDE3D5);border-radius:13px;box-shadow:0 6px 16px rgba(42,32,24,.08);padding:15px 16px;text-decoration:none;color:var(--ink,#2A2018);transition:transform .15s,border-color .15s,box-shadow .15s;}',
      'a.soho-net-card:hover{transform:translateY(-2px);border-color:var(--orange,#3D5AFE);box-shadow:0 8px 20px rgba(61,90,254,.12);}',
      '.soho-net-card .snc-ico{font-size:26px;flex-shrink:0;line-height:1.1;}',
      '.soho-net-card .snc-body{min-width:0;}',
      '.soho-net-card .snc-site{font-family:var(--mono,"Roboto Mono",monospace);font-size:10.5px;font-weight:700;color:var(--orange-d,#2438B0);letter-spacing:.02em;}',
      '.soho-net-card .snc-t{font-size:14.5px;font-weight:800;line-height:1.35;margin:1px 0 3px;letter-spacing:-.01em;}',
      '.soho-net-card .snc-d{font-size:12.5px;color:var(--sub,#8A7B6B);line-height:1.5;}',
      '.soho-net-card .snc-go{font-size:12px;font-weight:700;color:var(--orange,#3D5AFE);margin-top:6px;}',
      '.soho-net-card.is-soon{cursor:default;opacity:.85;}',
      '.soho-net-card.is-soon .snc-go{color:var(--sub,#8A7B6B);}',
      '.snc-soon{display:inline-block;font-size:10px;font-weight:700;color:var(--sub,#8A7B6B);background:var(--paper,#FBF6EE);border:1px dashed var(--dash,#D6C8B6);border-radius:5px;padding:2px 7px;margin-top:6px;}',
      '@media (max-width:768px){.soho-net-grid{grid-template-columns:1fr;}}',
    ].join('\n');
    var st = document.createElement('style'); st.id = 'soho-net-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function cardHTML(item) {
    var s = item.site, r = item.rule, live = !!s.url;
    var inner =
      '<span class="snc-ico">' + s.emoji + '</span>' +
      '<span class="snc-body">' +
        '<span class="snc-site">' + esc(s.name) + '</span>' +
        '<span class="snc-t">' + esc(r.title) + '</span>' +
        '<span class="snc-d">' + esc(r.desc) + '</span>' +
        (live ? '<span class="snc-go">' + esc(s.name) + '에서 보기 →</span>'
              : '<span class="snc-soon">🔜 ' + esc(s.name) + ' 준비 중</span>') +
      '</span>';
    if (live) {
      return '<a class="soho-net-card" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + inner + '</a>';
    }
    return '<div class="soho-net-card is-soon">' + inner + '</div>';
  }

  function render() {
    if (document.getElementById('soho-net')) return;
    var host = contentHost();
    if (!host) return;
    var items = pick();
    if (!items.length) return; // 맥락 맞는 추천 없으면 위젯 자체를 안 만듦

    injectStyle();
    var box = document.createElement('section');
    box.id = 'soho-net';
    box.className = 'soho-net';
    box.setAttribute('aria-label', '함께 보면 좋은 정보');
    box.innerHTML = '<div class="soho-net-head">함께 보면 좋은 정보</div>' +
      '<div class="soho-net-grid">' + items.map(cardHTML).join('') + '</div>';
    host.appendChild(box);
  }

  function init() { try { render(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
