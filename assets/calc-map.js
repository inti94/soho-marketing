/* =================================================================
   calc-map.js — 소호팁 계산기 ↔ 계산기 / 가이드 / 서식 매핑 데이터
   PART 2 (2026-06-26)
   -----------------------------------------------------------------
   · 단일 진실 공급원(SSOT). inline-calc.js 가 이 데이터를 읽어
     계산기 페이지 하단 "함께 보면 좋은" 영역을 자동 렌더링한다.
   · 관련성은 "주제가 실제로 맞는 것"만 손으로 큐레이션(억지 추천 금지).
     관련 항목이 없으면 빈 배열로 둔다.
   · guides 슬러그는 .html 제외. 렌더러가 search-index.json 에서
     제목·설명을 찾아 매칭하며, 인덱스에 없는 슬러그는 자동 스킵한다.
   · forms(무료 서식)는 현재 전용 페이지가 없어 비어 있다.
     서식 페이지가 생기면 forms 레지스트리에 추가하면 자동 노출된다.
   ================================================================= */
(function () {
  'use strict';

  /* 카테고리 */
  var categories = [
    { key: 'labor',   name: '인사·노무', emoji: '👥' },
    { key: 'revenue', name: '매출·수익', emoji: '📈' },
    { key: 'tax',     name: '세무·비용', emoji: '🧾' },
    { key: 'startup', name: '창업 준비', emoji: '🚀' },
  ];

  /* 무료 서식 레지스트리 — 실제 서식 페이지가 생기면 추가.
     예) 'labor-contract': { name:'표준 근로계약서', emoji:'📄',
                             url:'forms/labor-contract.html', desc:'알바·직원용 표준 근로계약서 양식' } */
  var forms = {};

  /* 계산기 레지스트리 (id = 파일명에서 .html 제외)
     related : 관련 계산기 id 배열  /  guides : 관련 글 슬러그 배열  /  formIds : 서식 id 배열 */
  var calcs = {
    /* ── 인사·노무 ── */
    'weekly-pay-calc': {
      name: '주휴수당 계산기', emoji: '📅', cat: 'labor', url: 'weekly-pay-calc.html',
      desc: '시급·근무시간으로 주휴수당 지급 여부와 금액을 계산',
      related: ['alba-cost-calc', 'insurance-4d-calc', 'severance-calc'],
      guides: ['parttime-hiring-solution', 'employee-insurance-cost'], formIds: [],
    },
    'severance-calc': {
      name: '퇴직금 계산기', emoji: '💼', cat: 'labor', url: 'severance-calc.html',
      desc: '근속기간·평균임금으로 법정 퇴직금을 자동 산출',
      related: ['weekly-pay-calc', 'insurance-4d-calc', 'annual-leave-calc'],
      guides: ['employee-termination-guide'], formIds: [],
    },
    'insurance-4d-calc': {
      name: '4대보험 계산기', emoji: '🛡️', cat: 'labor', url: 'insurance-4d-calc.html',
      desc: '직원 공제액과 사업주 부담액을 동시에 계산',
      related: ['alba-cost-calc', 'weekly-pay-calc', 'severance-calc'],
      guides: ['employee-insurance-cost', 'durunuri-application'], formIds: [],
    },
    'alba-cost-calc': {
      name: '직원 인건비 계산기', emoji: '🧮', cat: 'labor', url: 'alba-cost-calc.html',
      desc: '주휴수당·4대보험 포함 월 실인건비 자동 계산',
      related: ['weekly-pay-calc', 'insurance-4d-calc', 'severance-calc'],
      guides: ['employee-insurance-cost', 'parttime-hiring-solution'], formIds: [],
    },
    'annual-leave-calc': {
      name: '직원 연차 계산기', emoji: '🌴', cat: 'labor', url: 'annual-leave-calc.html',
      desc: '입사일로 연차 발생 일수·미사용 연차수당 계산',
      related: ['severance-calc', 'weekly-pay-calc', 'insurance-4d-calc'],
      guides: ['employee-termination-guide'], formIds: [],
    },

    /* ── 매출·수익 ── */
    'delivery-profit-calc': {
      name: '배달 순이익 계산기', emoji: '🛵', cat: 'revenue', url: 'delivery-profit-calc.html',
      desc: '수수료·배달비·재료비 빼고 실제 남는 돈 계산',
      related: ['food-cost-calc', 'delivery-ads-calc', 'bep-calc'],
      guides: ['delivery-fee-real-calc', 'baemin-vs-coupang'], formIds: [],
    },
    'food-cost-calc': {
      name: '메뉴 원가율 계산기', emoji: '🍽️', cat: 'revenue', url: 'food-cost-calc.html',
      desc: '재료비·판매가로 원가율·마진율·권장가 계산',
      related: ['bep-calc', 'delivery-profit-calc', 'store-profit-calc'],
      guides: ['food-cost-control', 'menu-design-tips'], formIds: [],
    },
    'bep-calc': {
      name: '손익분기점(BEP) 계산기', emoji: '📈', cat: 'revenue', url: 'bep-calc.html',
      desc: '고정비·변동비율로 최소 목표 매출 계산',
      related: ['store-profit-calc', 'food-cost-calc', 'startup-cost-calc'],
      guides: ['restaurant-startup-cost', 'food-cost-control'], formIds: [],
    },
    'store-profit-calc': {
      name: '매장 수익성 계산기', emoji: '🏪', cat: 'revenue', url: 'store-profit-calc.html',
      desc: '월 매출·비용으로 영업이익률·순이익 계산',
      related: ['bep-calc', 'food-cost-calc', 'naver-ads-calc'],
      guides: ['restaurant-startup-cost', 'food-cost-control'], formIds: [],
    },
    'delivery-ads-calc': {
      name: '배달앱 광고비 ROI 계산기', emoji: '📣', cat: 'revenue', url: 'delivery-ads-calc.html',
      desc: '광고비 대비 추가 주문·ROI·손익분기 주문수 계산',
      related: ['delivery-profit-calc', 'bep-calc', 'naver-ads-calc'],
      guides: ['delivery-ad-reduce', 'baemin-ultraol-vs-openlist'], formIds: [],
    },
    'naver-ads-calc': {
      name: '네이버 플레이스 광고비 계산기', emoji: '📍', cat: 'revenue', url: 'naver-ads-calc.html',
      desc: '예산·CPC·전환율로 방문 고객·고객당 광고비 계산',
      related: ['store-profit-calc', 'bep-calc', 'delivery-ads-calc'],
      guides: ['naver-advertising', 'naver-place-ranking-2026'], formIds: [],
    },

    /* ── 세무·비용 ── */
    'vat-calc': {
      name: '부가세 계산기', emoji: '💰', cat: 'tax', url: 'vat-calc.html',
      desc: '매출·매입으로 납부세액 또는 환급액 계산',
      related: ['card-fee-calc', 'loan-interest-calc'],
      guides: ['general-vs-simple-tax', 'card-sales-tax-audit'], formIds: [],
    },
    'rent-increase-calc': {
      name: '임대료 인상 상한 계산기', emoji: '🏠', cat: 'tax', url: 'rent-increase-calc.html',
      desc: '현재 월세 기준 법정 5% 상한 인상액 계산',
      related: ['premium-calc', 'startup-cost-calc'],
      guides: ['rent-increase-refusal'], formIds: [],
    },
    'loan-interest-calc': {
      name: '정책자금 이자 계산기', emoji: '💳', cat: 'tax', url: 'loan-interest-calc.html',
      desc: '대출금·금리·기간으로 월 상환액·총이자 계산',
      related: ['startup-cost-calc', 'vat-calc'],
      guides: ['policy-loan-guide', 'noran-umbrella'], formIds: [],
    },
    'premium-calc': {
      name: '권리금 계산기', emoji: '🔑', cat: 'tax', url: 'premium-calc.html',
      desc: '순이익·시설 잔존가치로 적정 권리금 범위 계산',
      related: ['startup-cost-calc', 'rent-increase-calc', 'bep-calc'],
      guides: ['premium-money-dispute'], formIds: [],
    },
    'card-fee-calc': {
      name: '카드수수료 계산기', emoji: '💳', cat: 'tax', url: 'card-fee-calc.html',
      desc: '월 카드매출 기준 우대수수료율·월·연 수수료 계산',
      related: ['vat-calc', 'delivery-profit-calc'],
      guides: ['card-terminal-compare', 'card-sales-tax-audit'], formIds: [],
    },
    'closure-cost-calc': {
      name: '폐업 비용 계산기', emoji: '📦', cat: 'tax', url: 'closure-cost-calc.html',
      desc: '철거비·퇴직금·재고에서 폐업 지원금 차감한 실부담 계산',
      related: ['severance-calc', 'startup-cost-calc'],
      guides: ['closure-support'], formIds: [],
    },

    /* ── 창업 준비 ── */
    'startup-cost-calc': {
      name: '창업 초기비용 계산기', emoji: '🚀', cat: 'startup', url: 'startup-cost-calc.html',
      desc: '업종·평수로 창업비용과 월 손익분기 추정',
      related: ['premium-calc', 'rent-increase-calc', 'loan-interest-calc', 'bep-calc'],
      guides: ['restaurant-startup-cost', 'cafe-startup-real-cost'], formIds: [],
    },
  };

  /* 계산기별 상담/네트워크 문맥 토픽 (marketing/startup/tax/labor/ad)
     — consult.js / 서식 자동연결에서 사용. */
  var TOPIC_OF = {
    'weekly-pay-calc': 'labor', 'severance-calc': 'labor', 'insurance-4d-calc': 'labor',
    'alba-cost-calc': 'labor', 'annual-leave-calc': 'labor',
    'delivery-profit-calc': 'startup', 'food-cost-calc': 'startup', 'bep-calc': 'startup',
    'store-profit-calc': 'startup', 'startup-cost-calc': 'startup', 'premium-calc': 'startup',
    'delivery-ads-calc': 'ad', 'naver-ads-calc': 'ad',
    'vat-calc': 'tax', 'card-fee-calc': 'tax', 'rent-increase-calc': 'tax',
    'loan-interest-calc': 'tax', 'closure-cost-calc': 'tax',
  };
  Object.keys(calcs).forEach(function (id) { if (TOPIC_OF[id]) calcs[id].topic = TOPIC_OF[id]; });

  window.SOHO_CALC_MAP = { categories: categories, forms: forms, calcs: calcs };
})();
