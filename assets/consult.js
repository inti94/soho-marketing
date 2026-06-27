/* =================================================================
   consult.js — 상담 전환 (영수증 박스, 광고처럼 안 보이게)
   PART 4 (2026-06-26)
   -----------------------------------------------------------------
   · 절대 강제 노출 금지. data-topic 속성 또는 계산기 토픽/키워드 문맥이
     "창업·마케팅·광고·세무·노무" 맥락일 때만 노출. 단순 정보글엔 안 띄움.
   · 문맥별 문구 자동 매칭. 하단에 "광고 아닌 실제 상담" 신뢰 문구.
   · 배치: 글/계산기 본문 하단(= FAQ·결과 영역 아래).
   · 색상은 var(--토큰, 폴백) → 테마 미로드 페이지에서도 정상.
   ================================================================= */
(function () {
  'use strict';
  if (window.__sohoConsult) return;
  window.__sohoConsult = true;

  var CONSULT_URL = 'consultation.html';

  /* 토픽별 문구 (광고 카피 아님 — 공감/맥락 우선) */
  var TOPICS = {
    ad: {
      stamp: '광고 상담', emoji: '📣',
      title: '광고 운영이 어렵다면, 혼자 끙끙대지 마세요',
      desc: '광고비는 쓰는데 주문이 안 늘 때 — 어디서 새는지 실제 운영 사례로 같이 봐드려요.',
    },
    startup: {
      stamp: '창업 상담', emoji: '🚀',
      title: '창업·운영 비용이 고민된다면',
      desc: '숫자만 보면 막막하죠. 사장님 가게 상황에 맞춰 비용·손익을 같이 따져봐요.',
    },
    tax: {
      stamp: '세무 상담', emoji: '🧾',
      title: '세무, 이것만 물어봐도 돈 아껴요',
      desc: '부가세·종합소득세·경비처리… 헷갈리는 것만 짚어드릴게요. 혼자 끙끙 마세요.',
    },
    labor: {
      stamp: '노무 상담', emoji: '👥',
      title: '노무 문제, 혼자 앓지 마세요',
      desc: '주휴수당·퇴직금·4대보험 분쟁은 커지기 전이 쌉니다. 지금 짚어보세요.',
    },
    marketing: {
      stamp: '마케팅 상담', emoji: '📈',
      title: '마케팅 성과가 안 나온다면',
      desc: '플레이스·배달앱·SNS, 뭐부터 손대야 할지 막막할 때 우선순위를 같이 정해요.',
    },
  };

  /* 글 키워드 → 토픽 (위에서부터 우선). 매칭 없으면 노출 안 함(보수적). */
  var KEYWORD_TOPICS = [
    { t: 'ad',        re: /광고|울트라콜|오픈리스트|파워링크|cpc|상위\s*노출\s*광고|광고비|배너/i },
    { t: 'labor',     re: /주휴|퇴직금|4대\s*보험|해고|권고사직|근로계약|인건비|노무|연차|최저임금|알바/i },
    { t: 'tax',       re: /부가세|종합소득세|종소세|세무|절세|경비\s*처리|세금계산서|간이과세|일반과세|소득세|세금/i },
    { t: 'startup',   re: /창업|손익분기|권리금|임대차|폐업|초기\s*비용|인테리어|정책자금|대출|매출\s*분석|비용\s*절감/i },
    { t: 'marketing', re: /마케팅|플레이스|인스타|블로그|릴스|숏폼|리뷰|단골|재방문|스마트플레이스/i },
  ];

  function slugOf() { var p = location.pathname.split('/').pop() || ''; return p.replace(/\.html$/, ''); }

  function pageText() {
    var parts = [];
    var mk = document.querySelector('meta[name="keywords"]'); if (mk && mk.content) parts.push(mk.content);
    if (document.title) parts.push(document.title);
    var h1 = document.querySelector('h1'); if (h1) parts.push(h1.textContent || '');
    var tag = document.querySelector('.article-tag'); if (tag) parts.push(tag.textContent || '');
    return parts.join(' ');
  }

  function detectTopic() {
    /* 1) 명시적 data-topic */
    var el = document.querySelector('[data-topic]');
    if (el) {
      var t = (el.getAttribute('data-topic') || '').trim().toLowerCase();
      if (TOPICS[t]) return t;
    }
    /* 2) 계산기 페이지 → calc-map 토픽 */
    var map = window.SOHO_CALC_MAP;
    if (map && map.calcs) {
      var c = map.calcs[slugOf()];
      if (c && TOPICS[c.topic]) return c.topic;
    }
    /* 3) 글 키워드 추론 (보수적, 매칭 없으면 null) */
    var blob = pageText();
    for (var i = 0; i < KEYWORD_TOPICS.length; i++) {
      if (KEYWORD_TOPICS[i].re.test(blob)) return KEYWORD_TOPICS[i].t;
    }
    return null;
  }

  /* 본문 컨테이너(없으면 노출 안 함 → 목록/홈 제외) */
  function contentHost() {
    return document.querySelector('.article-main')
      || document.querySelector('.article-content')
      || document.querySelector('.page-wrap');
  }

  function injectStyle() {
    if (document.getElementById('soho-consult-style')) return;
    var css = [
      '.sohoc{max-width:680px;margin:30px auto;font-family:var(--sans,"Pretendard","Noto Sans KR",sans-serif);}',
      '.page-wrap .sohoc,.article-main .sohoc,.article-content .sohoc{max-width:100%;}',
      '.sohoc-card{background:#fff;border:1px solid var(--g200,#E5E8EB);border-radius:20px;box-shadow:0 1px 8px rgba(0,0,0,.04);padding:22px;}',
      '.sohoc-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--primary,#3D5AFE);background:var(--primary-light,#ECEEFF);border-radius:100px;padding:5px 12px;margin-bottom:12px;}',
      '.sohoc-t{font-size:17px;font-weight:800;color:var(--g900,#191F28);line-height:1.4;letter-spacing:-.02em;}',
      '.sohoc-d{font-size:13.5px;color:var(--g600,#6B7684);line-height:1.65;margin:7px 0 16px;}',
      '.sohoc-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--primary,#3D5AFE);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 24px;border-radius:12px;transition:background .15s,transform .1s;-webkit-tap-highlight-color:transparent;}',
      '.sohoc-btn:hover{background:var(--primary-dark,#2541E0);}',
      '.sohoc-btn:active{transform:scale(.97);}',
      '.sohoc-trust{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12px;color:var(--g600,#6B7684);}',
      '.sohoc-trust .dot{width:6px;height:6px;border-radius:50%;background:var(--green,#00C471);display:inline-block;flex-shrink:0;}',
      '@media (max-width:520px){.sohoc-btn{width:100%;}}',
    ].join('\n');
    var st = document.createElement('style'); st.id = 'soho-consult-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  function render() {
    if (document.getElementById('soho-consult')) return;
    if (slugOf() === 'consultation' || slugOf() === 'contact') return; // 상담/문의 페이지엔 미노출
    var host = contentHost();
    if (!host) return;
    var topic = detectTopic();
    if (!topic) return; // 맥락 안 맞으면 절대 노출 안 함
    var c = TOPICS[topic];

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    injectStyle();
    var box = document.createElement('div');
    box.id = 'soho-consult';
    box.className = 'sohoc';
    box.innerHTML =
      '<div class="sohoc-card">' +
        '<span class="sohoc-badge">' + esc(c.stamp) + '</span>' +
        '<div class="sohoc-t">' + esc(c.title) + '</div>' +
        '<div class="sohoc-d">' + esc(c.desc) + '</div>' +
        '<a class="sohoc-btn" href="' + CONSULT_URL + '">무료 상담 요청하기</a>' +
        '<div class="sohoc-trust"><span class="dot"></span>광고 아닌 실제 상담 · 1영업일 내 답변 · 부담 없이 질문만 OK</div>' +
      '</div>';
    host.appendChild(box);
  }

  function init() { try { render(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
