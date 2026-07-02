/* =================================================================
   consult.js — 상담 전환 (영수증 박스, 광고처럼 안 보이게)
   PART 5 (2026-06-29)
   -----------------------------------------------------------------
   · 절대 강제 노출 금지. data-topic 속성 또는 글/계산기 키워드 문맥이
     "지원금·플레이스·배달앱·마케팅(SNS 등)" 맥락일 때만 노출.
   · 주제별 문구 자동 매칭:
       지원금  → 지원금 상담
       플레이스 → 플레이스 상담
       배달앱  → 배달운영 상담
       마케팅(SNS·기타) → 마케팅 상담
   · 노무(주휴·퇴직금·4대보험 등)·세무(부가세·종소세 등) 단독 글은
     위 4개 상담과 맥락이 어울리지 않으므로 미노출(억지 상담 방지).
   · 배치: 글/계산기 본문 하단(= FAQ·결과 영역 아래). 링크는 consultation.html 유지.
   · 색상은 var(--토큰, 폴백) → 테마 미로드 페이지에서도 정상.
   ================================================================= */
(function () {
  'use strict';
  if (window.__sohoConsult) return;
  window.__sohoConsult = true;

  var CONSULT_URL = 'consultation.html';

  /* 노출 가능한 상담 주제(이 중 하나로 감지될 때만 CTA 노출) */
  var TOPICS = { support: 1, place: 1, delivery: 1, marketing: 1 };

  /* 주제별 CTA 문구 */
  var COPY = {
    support:   { stamp: '지원금 상담',   title: '받을 수 있는 지원금, 놓치지 마세요',   desc: '우리 가게가 신청 가능한 지원금·정책자금을 함께 찾아드려요.' },
    place:     { stamp: '플레이스 상담', title: '네이버 플레이스, 상위 노출 막막하셨죠', desc: '지금 플레이스 상태와 개선 포인트를 무료로 진단해드려요.' },
    delivery:  { stamp: '배달운영 상담', title: '배달앱, 수수료·노출 같이 점검해드려요', desc: '수수료 구조부터 노출·광고까지 우리 가게 맞춤으로 봐드려요.' },
    marketing: { stamp: '마케팅 상담',   title: '마케팅, 혼자 앓지 마세요',             desc: '매출·홍보·광고 고민은 키우기 전이 쌉니다.' }
  };

  /* 글/계산기 키워드 → 주제 (위에서부터 우선. 매칭 없으면 미노출=보수적).
     노무·세무 단독 키워드는 목록에 없으므로 그런 글은 null → 미노출. */
  var KEYWORD_TOPICS = [
    { t: 'place',     re: /네이버\s*플레이스|스마트\s*플레이스|플레이스\s*(상위|노출|리뷰|순위|사진)|플레이스/i },
    { t: 'delivery',  re: /배달의민족|배민|쿠팡이츠|배달앱|배달\s*수수료|배달\s*광고|배달\s*순이익|울트라콜|오픈리스트|포장\s*주문|배달/i },
    { t: 'support',   re: /지원금|정책자금|소상공인\s*지원|두루누리|보조금|융자|폐업\s*지원|바우처|관리지원금/i },
    { t: 'marketing', re: /마케팅|인스타|블로그|릴스|숏폼|유튜브|sns|단골|재방문|체험단|리뷰\s*이벤트|상위\s*노출|광고/i }
  ];

  function slugOf() { var p = location.pathname.split('/').pop() || ''; return p.replace(/\.html$/, ''); }

  /* 브랜드명("소상공인 마케팅 실전백과"·"소호팁")은 매칭에서 제거 —
     안 그러면 제목 꼬리말의 '마케팅' 때문에 모든 글이 marketing 으로 오탐됨. */
  function deBrand(s) { return String(s || '').replace(/소상공인\s*마케팅\s*실전백과/g, '').replace(/소호팁/g, ''); }

  function pageText() {
    var parts = [];
    var mk = document.querySelector('meta[name="keywords"]'); if (mk && mk.content) parts.push(deBrand(mk.content));
    if (document.title) parts.push(deBrand(document.title));
    var h1 = document.querySelector('h1'); if (h1) parts.push(deBrand(h1.textContent || ''));
    var tag = document.querySelector('.article-tag'); if (tag) parts.push(deBrand(tag.textContent || ''));
    return parts.join(' ');
  }

  function detectTopic() {
    /* 1) 명시적 data-topic (지원금/플레이스/배달/마케팅) */
    var el = document.querySelector('[data-topic]');
    if (el) {
      var t = (el.getAttribute('data-topic') || '').trim().toLowerCase();
      if (TOPICS[t]) return t;
    }
    /* 2) 글/계산기 키워드 추론 (보수적, 매칭 없으면 null → 미노출) */
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
      '.sohoc-card{background:#fff;border:1px solid var(--g200,#E5E8EB);border-radius:24px;box-shadow:0 1px 8px rgba(0,0,0,.04);padding:24px 22px;}',
      '.sohoc-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--primary,#3D5AFE);background:var(--primary-light,#ECEEFF);border:1px solid transparent;border-radius:9999px;padding:5px 13px;margin-bottom:12px;}',
      '.sohoc-t{font-size:20px;font-weight:800;color:var(--g900,#191F28);line-height:1.35;letter-spacing:-.02em;}',
      '.sohoc-d{font-size:14px;font-weight:500;color:#6B7684;line-height:1.65;margin:8px 0 18px;}',
      '.sohoc-btn{width:100%;box-sizing:border-box;height:56px;display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--primary,#3D5AFE);color:#fff;font-weight:700;font-size:16px;text-decoration:none;border-radius:16px;transition:background .15s,transform .1s;-webkit-tap-highlight-color:transparent;}',
      '.sohoc-btn:hover{background:var(--primary-dark,#2541E0);}',
      '.sohoc-btn:active{transform:scale(.98);}',
      '.sohoc-trust{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12px;color:#ADB5BD;}',
      '.sohoc-trust .dot{width:6px;height:6px;border-radius:50%;background:var(--green,#00C471);display:inline-block;flex-shrink:0;}',
      /* 계산기 상세 전용 오렌지 변형(상단 점선 + 오렌지 배지/버튼) */
      '.sohoc--accent .sohoc-card{border-top:2px dashed #FFD2B3;}',
      '.sohoc--accent .sohoc-badge{color:#FF6A00;background:#fff;border-color:#FF6A00;}',
      '.sohoc--accent .sohoc-btn{background:#FF6A00;}',
      '.sohoc--accent .sohoc-btn:hover{background:#E55F00;}',
    ].join('\n');
    var st = document.createElement('style'); st.id = 'soho-consult-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  function render() {
    if (document.getElementById('soho-consult')) return;
    if (slugOf() === 'consultation' || slugOf() === 'contact') return; // 상담/문의 페이지엔 미노출
    // 본문에 이미 맥락 상담 CTA(ais-cta)가 있으면 중복 노출 방지 → 페이지당 상담 CTA 1개로 제한
    if (document.querySelector('.ais-cta a[href="consultation.html"]')) return;
    var host = contentHost();
    if (!host) return;
    var topic = detectTopic();
    if (!topic) return; // 맥락 안 맞으면 절대 노출 안 함(노무·세무 단독 글 포함)
    var c = COPY[topic] || COPY.marketing; // 주제별 문구

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    injectStyle();
    var box = document.createElement('div');
    box.id = 'soho-consult';
    box.className = 'sohoc';
    // 계산기 상세(.page-wrap)에서는 오렌지 보조색 변형 적용(글 페이지는 블루 유지)
    if (host.classList && host.classList.contains('page-wrap')) box.className += ' sohoc--accent';
    box.innerHTML =
      '<div class="sohoc-card">' +
        '<span class="sohoc-badge">' + esc(c.stamp) + '</span>' +
        '<div class="sohoc-t">' + esc(c.title) + '</div>' +
        '<div class="sohoc-d">' + esc(c.desc) + '</div>' +
        '<a class="sohoc-btn" href="' + CONSULT_URL + '">무료 상담 요청하기</a>' +
        '<div class="sohoc-trust"><span class="dot"></span>광고 아닌 실제 상담 · 1영업일 내 답변</div>' +
      '</div>';
    host.appendChild(box);
  }

  function init() { try { render(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
