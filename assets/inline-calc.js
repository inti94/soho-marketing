/* =================================================================
   inline-calc.js — 소호팁 PART 2
   (2026-06-26)
   -----------------------------------------------------------------
   1) 계산기 페이지 하단 "함께 보면 좋은" 영수증 명세서 자동 렌더
      (calc-map.js + search-index.json 기반, 관련 항목만)
   2) 글 본문 미니 계산기: <div class="inline-calc" data-calc="juhyu"></div>
      자리에 영수증형 미니 계산기를 렌더 (주휴수당·배달순이익·BEP·배달ROI 동작)
   3) "내 데이터는 내 폰에만" — 입력값을 localStorage(sohotip_ 접두사)에
      저장하고 재방문 시 자동 복원
   -----------------------------------------------------------------
   · 모든 클래스는 .soho- 네임스페이스 → 기존 .inline-calc(엔게이지)와 무충돌
   · 색상은 var(--토큰, 폴백) → 테마 CSS 미로드 페이지에서도 정상 표시
   · 수치는 2026년 기준(최저시급 10,320원 등). 요율 가정 없이 사용자 입력 기반.
   ================================================================= */
(function () {
  'use strict';

  /* ── 0. 유틸 ───────────────────────────────── */
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function pct(n) { return (Math.round(n * 10) / 10) + '%'; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) { return parseFloat(String(v == null ? '' : v).replace(/,/g, '')) || 0; }
  function comma(n) { return String(n).replace(/[^\d.]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function slugOfFile(f) { return (f || '').replace(/\.html$/, ''); }
  function currentSlug() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return slugOfFile(decodeURIComponent(p || 'index.html'));
  }

  /* localStorage (sohotip_ 접두사) — 차단 환경 안전 처리 */
  function lsGet(k) { try { return localStorage.getItem('sohotip_' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('sohotip_' + k, v); } catch (e) {} }

  /* 검색 인덱스: sohotip.js 의 loadSearchIndex 재사용, 없으면 직접 fetch */
  function getIndex() {
    if (typeof window.loadSearchIndex === 'function') return window.loadSearchIndex();
    return fetch('search-index.json').then(function (r) { return r.json(); }).catch(function () { return []; });
  }

  /* ── 아이콘(이모지 금지 → SVG, ③ SohoCards.icon 재사용) ── */
  /* 계산기 슬러그 → 아이콘 이름 */
  var SLUG_ICON = {
    'alba-cost-calc': 'Users', 'delivery-profit-calc': 'Bike', 'vat-calc': 'Receipt',
    'bep-calc': 'TrendingUp', 'food-cost-calc': 'UtensilsCrossed', 'severance-calc': 'Briefcase',
    'weekly-pay-calc': 'Clock', 'insurance-4d-calc': 'Shield', 'annual-leave-calc': 'CalendarDays',
    'store-profit-calc': 'BarChart2', 'delivery-ads-calc': 'Megaphone', 'naver-ads-calc': 'MapPin',
    'rent-increase-calc': 'Home', 'card-fee-calc': 'CreditCard', 'premium-calc': 'KeyRound',
    'loan-interest-calc': 'Banknote', 'closure-cost-calc': 'Package', 'startup-cost-calc': 'Rocket'
  };
  /* 가이드 카테고리(부분일치) → {아이콘, 색} */
  var CAT_VIS = [
    { k: '플레이스', i: 'MapPin', c: '#00C471' },
    { k: '배달', i: 'Bike', c: '#FF6B35' },
    { k: 'SNS', i: 'Camera', c: '#E040FB' }, { k: '숏폼', i: 'Camera', c: '#E040FB' },
    { k: '지원금', i: 'Banknote', c: '#FFB800' },
    { k: '창업', i: 'FileText', c: '#F04452' }, { k: '세금', i: 'FileText', c: '#F04452' }
  ];
  function catVis(cat) {
    cat = cat || '';
    for (var i = 0; i < CAT_VIS.length; i++) { if (cat.indexOf(CAT_VIS[i].k) !== -1) return CAT_VIS[i]; }
    return { i: 'FileText', c: '#3D5AFE' };
  }
  /* SVG 아이콘: SohoCards.icon 우선, 없으면 빈 박스 */
  function iconSVG(name, size) {
    return (window.SohoCards && SohoCards.icon) ? SohoCards.icon(name, size || 22) : '';
  }
  /* 44x44 연한 색 아이콘 박스 */
  function iconBox(name, color) {
    return '<span class="soho-ico" style="background:' + color + '1A;color:' + color + '">' + iconSVG(name, 22) + '</span>';
  }
  var ARROW_R = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>';
  function arrowRight() {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ARROW_R + '</svg>';
  }

  /* ── 1. 공통 스타일 1회 주입 ───────────────────── */
  function injectStyle() {
    if (document.getElementById('soho-part2-style')) return;
    var css = [
      ':root{}',
      '.soho-reco,.soho-mini{font-family:var(--sans,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif);}',

      /* 함께 보면 좋은 — 정밀 흰카드(게시글 먼저 → 계산기) */
      '.soho-reco{max-width:680px;margin:30px auto 0;}',
      '.page-wrap .soho-reco{max-width:100%;}',
      '.soho-card{background:#fff;border:1px solid var(--g200,#E5E8EB);border-radius:24px;box-shadow:0 1px 8px rgba(0,0,0,.04);padding:6px 20px 14px;}',
      '.soho-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 0 6px;}',
      '.soho-card-top .sc-h{display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:700;color:var(--g900,#191F28);letter-spacing:-.02em;}',
      '.soho-card-top .sc-h svg{width:18px;height:18px;stroke:var(--primary,#3D5AFE);fill:none;flex-shrink:0;}',
      '.soho-card-top .sc-no{font-size:12px;color:#ADB5BD;letter-spacing:.01em;white-space:nowrap;}',
      '.soho-sec{padding:2px 0;}',
      '.soho-sec-tag{display:block;font-size:13px;font-weight:700;color:var(--g900,#191F28);margin:10px 0 2px;}',
      '.soho-item{display:flex;align-items:center;gap:12px;height:72px;text-decoration:none;color:var(--g900,#191F28);}',
      '.soho-item+.soho-item{border-top:1px solid var(--g100,#F2F4F6);}',
      '.soho-ico{width:44px;height:44px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}',
      '.soho-ico svg{width:22px;height:22px;stroke:currentColor;fill:none;}',
      '.soho-item .si-body{flex:1;min-width:0;}',
      '.soho-item .si-t{display:block;max-width:100%;font-size:15px;font-weight:700;line-height:1.3;color:var(--g900,#191F28);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.soho-item .si-d{display:block;max-width:100%;font-size:13px;color:#6B7684;line-height:1.4;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.soho-item .si-arrow{flex-shrink:0;color:var(--g300,#C4C9D4);display:flex;}',
      '.soho-tear{height:0;border-top:1px dashed var(--g200,#E5E8EB);margin:12px 0;}',

      /* 맨 위로 플로팅(오렌지 원, 탭바와 안 겹침) */
      '.soho-backtop{position:fixed;right:16px;bottom:calc(var(--tabbar-h,72px) + 16px);width:52px;height:52px;border-radius:50%;border:none;background:#FF6A00;color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(255,106,0,.45);z-index:300;transition:transform .15s;-webkit-tap-highlight-color:transparent;}',
      '.soho-backtop.show{display:inline-flex;}',
      '.soho-backtop:active{transform:scale(.92);}',
      '.soho-backtop svg{width:24px;height:24px;stroke:currentColor;fill:none;}',
      '@media (min-width:769px){.soho-backtop{bottom:24px;}}',

      /* 미니 계산기 (영수증 박스) — 플레이스홀더(.inline-calc[data-calc]) 리셋 */
      '.inline-calc[data-calc]{all:unset;display:block;margin:30px 0;}',
      '.soho-mini{max-width:520px;border-radius:14px;overflow:hidden;border:1px solid var(--line,#EDE3D5);box-shadow:0 8px 24px rgba(42,32,24,.12);background:var(--receipt,#fff);}',
      '.soho-mini-head{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--ink,#2A2018);color:#fff;padding:13px 18px;}',
      '.soho-mini-head .smh-t{font-size:15px;font-weight:800;display:flex;align-items:center;gap:7px;}',
      '.soho-mini-head .smh-stamp{font-family:var(--mono,"Roboto Mono",monospace);font-size:10.5px;font-weight:800;color:#fff;border:1.5px solid rgba(255,255,255,.7);border-radius:5px;padding:3px 7px;transform:rotate(-4deg);white-space:nowrap;}',
      '.soho-mini-body{padding:16px 18px 18px;}',
      '.soho-mini-fields{display:grid;grid-template-columns:1fr 1fr;gap:11px;}',
      '.soho-mini-fields .smf{display:flex;flex-direction:column;}',
      '.soho-mini-fields .smf.full{grid-column:1/-1;}',
      '.soho-mini-fields label{font-size:12px;font-weight:700;color:var(--ink,#2A2018);margin-bottom:5px;}',
      '.soho-mini-fields .smf-in{display:flex;align-items:center;gap:6px;border:2px solid var(--ink,#2A2018);border-radius:8px;padding:0 10px;background:#fff;box-shadow:0 2px 0 rgba(42,32,24,.1);}',
      '.soho-mini-fields input{flex:1;min-width:0;border:none;outline:none;background:transparent;font-family:var(--mono,"Roboto Mono",monospace);font-size:16px;font-weight:600;color:var(--ink,#2A2018);padding:11px 0;text-align:right;}',
      '.soho-mini-fields .smf-suf{font-size:12px;color:var(--sub,#8A7B6B);flex-shrink:0;}',
      '.soho-mini-btn{width:100%;margin-top:14px;border:none;cursor:pointer;background:var(--orange,#3D5AFE);color:#fff;font-family:inherit;font-weight:800;font-size:15px;padding:14px;border-radius:10px;box-shadow:0 4px 0 var(--orange-d,#2438B0);transition:transform .08s,box-shadow .08s,background .15s;-webkit-tap-highlight-color:transparent;}',
      '.soho-mini-btn:hover{background:var(--orange-d,#2438B0);}',
      '.soho-mini-btn:active{transform:translateY(4px);box-shadow:0 0 0 var(--orange-d,#2438B0);}',
      '.soho-mini-note{font-size:11.5px;color:var(--sub,#8A7B6B);margin-top:10px;line-height:1.5;}',
      '.soho-mini-result{display:none;margin-top:16px;padding-top:4px;border-top:2px dashed var(--dash,#D6C8B6);}',
      '.soho-mini-result.show{display:block;animation:sohoFade .25s ease;}',
      '@keyframes sohoFade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}',
      '.smr-main{text-align:center;padding:14px 0 6px;}',
      '.smr-main .smr-label{font-size:12.5px;color:var(--sub,#8A7B6B);font-weight:600;}',
      '.smr-main .smr-value{font-family:var(--mono,"Roboto Mono",monospace);font-size:30px;font-weight:700;color:var(--orange-d,#2438B0);letter-spacing:-.02em;line-height:1.2;margin-top:4px;}',
      '.smr-row{display:flex;align-items:baseline;gap:8px;padding:7px 0;font-size:13px;}',
      '.smr-row .k{flex-shrink:0;color:var(--ink,#2A2018);}',
      '.smr-row .d{flex:1;border-bottom:1.5px dotted var(--dash,#D6C8B6);transform:translateY(-3px);min-width:14px;}',
      '.smr-row .v{flex-shrink:0;font-family:var(--mono,"Roboto Mono",monospace);font-weight:700;}',
      '.soho-mini-full{display:block;text-align:center;margin-top:14px;font-size:13px;font-weight:700;color:var(--orange,#3D5AFE);text-decoration:none;}',
      '.soho-mini-full:hover{text-decoration:underline;}',

      '@media (max-width:520px){.soho-mini-fields{grid-template-columns:1fr;}.soho-tear::before{left:-26px;}.soho-tear::after{right:-26px;}}',
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'soho-part2-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ── 2. 미니 계산기 정의 (실동작 4종 + 폴백) ──────── */
  /* 2026년 기준: 최저시급 10,320원 / 배민 중개수수료 기본 6.8% / 결제수수료 약 1.2% */
  var MINI = {
    juhyu: {
      title: '주휴수당 미니 계산', emoji: '📅', full: 'weekly-pay-calc.html',
      fields: [
        { id: 'wage', label: '시급', suf: '원', value: 10320, money: true },
        { id: 'hours', label: '주 근무시간', suf: '시간', value: 40 },
      ],
      compute: function (v) {
        var wage = v.wage, hours = v.hours;
        var eligible = hours >= 15;
        var h = Math.min(hours, 40);
        var holiday = eligible ? (h / 40) * 8 * wage : 0;
        var base = wage * hours;
        return {
          main: { label: '주 1회 주휴수당', value: eligible ? won(holiday) : '대상 아님' },
          rows: [
            { k: '기본 주급 (시급×시간)', v: won(base) },
            { k: '주휴수당', v: eligible ? won(holiday) : '주 15시간 미만' },
            { k: '주급 합계', v: won(base + holiday) },
          ],
          note: '주 15시간 이상 근무 시 주휴수당이 발생해요. (2026년 최저시급 10,320원)',
        };
      },
    },
    'delivery-profit': {
      title: '배달 순이익 미니 계산', emoji: '🛵', full: 'delivery-profit-calc.html',
      fields: [
        { id: 'order', label: '주문금액', suf: '원', value: 20000, money: true },
        { id: 'comm', label: '중개수수료율', suf: '%', value: 6.8 },
        { id: 'deliv', label: '업주부담 배달비', suf: '원', value: 2400, money: true, full: true },
      ],
      compute: function (v) {
        var order = v.order;
        var commission = order * (v.comm / 100);
        var payment = order * 0.012; // 결제수수료 약 1.2%
        var net = order - commission - payment - v.deliv;
        return {
          main: { label: '수수료·배달비 빼고 남는 금액', value: won(net) },
          rows: [
            { k: '중개수수료 (' + v.comm + '%)', v: '-' + won(commission) },
            { k: '결제수수료 (1.2%)', v: '-' + won(payment) },
            { k: '업주부담 배달비', v: '-' + won(v.deliv) },
            { k: '주문 1건 실수령', v: won(net) },
          ],
          note: '※ 재료비(원가)는 별도예요. 원가까지 빼고 보려면 전체 계산기에서 확인하세요.',
        };
      },
    },
    bep: {
      title: '손익분기점 미니 계산', emoji: '📈', full: 'bep-calc.html',
      fields: [
        { id: 'fixed', label: '월 고정비', suf: '원', value: 5000000, money: true },
        { id: 'variable', label: '변동비율(원가율)', suf: '%', value: 40 },
      ],
      compute: function (v) {
        var cm = 1 - (v.variable / 100);
        var ok = cm > 0;
        var bep = ok ? v.fixed / cm : 0;
        return {
          main: { label: '손익분기 월 매출', value: ok ? won(bep) : '변동비율 100% 미만 입력' },
          rows: [
            { k: '공헌이익률 (1−변동비율)', v: pct(cm * 100) },
            { k: '손익분기 월 매출', v: ok ? won(bep) : '-' },
            { k: '하루 목표 매출 (÷30일)', v: ok ? won(bep / 30) : '-' },
          ],
          note: '이 매출을 넘겨야 비로소 이익이 남기 시작해요.',
        };
      },
    },
    'delivery-roi': {
      title: '배달앱 광고 ROI 미니 계산', emoji: '📣', full: 'delivery-ads-calc.html',
      fields: [
        { id: 'ad', label: '월 광고비', suf: '원', value: 300000, money: true },
        { id: 'orders', label: '광고로 늘어난 월 주문수', suf: '건', value: 120 },
        { id: 'per', label: '주문당 평균 순이익', suf: '원', value: 6000, money: true, full: true },
      ],
      compute: function (v) {
        var gain = v.orders * v.per;
        var profit = gain - v.ad;
        var roi = v.ad > 0 ? (profit / v.ad) * 100 : 0;
        var be = v.per > 0 ? Math.ceil(v.ad / v.per) : 0;
        return {
          main: { label: '광고 ROI', value: pct(roi) + (profit >= 0 ? ' (이득)' : ' (손해)') },
          rows: [
            { k: '광고로 번 순이익', v: won(gain) },
            { k: '광고비 빼고 남는 이익', v: won(profit) },
            { k: '손익분기 주문수', v: be.toLocaleString('ko-KR') + '건' },
          ],
          note: '광고로 늘어난 주문이 손익분기 주문수를 넘어야 광고가 남는 장사예요.',
        };
      },
    },
  };

  /* data-calc 별칭 → 표준 키 */
  var MINI_ALIAS = {
    'juhyu': 'juhyu', 'weekly-pay': 'juhyu', 'weekly-pay-calc': 'juhyu', '주휴수당': 'juhyu',
    'delivery': 'delivery-profit', 'delivery-profit': 'delivery-profit', 'delivery-profit-calc': 'delivery-profit', '배달순이익': 'delivery-profit',
    'bep': 'bep', 'bep-calc': 'bep', '손익분기점': 'bep', '손익분기': 'bep',
    'roi': 'delivery-roi', 'delivery-roi': 'delivery-roi', 'delivery-ads': 'delivery-roi', 'delivery-ads-calc': 'delivery-roi', '배달광고': 'delivery-roi',
  };

  /* ── 3. 미니 계산기 렌더 ─────────────────────────── */
  function buildMini(placeholder) {
    var raw = (placeholder.getAttribute('data-calc') || '').trim();
    var key = MINI_ALIAS[raw] || (MINI[raw] ? raw : null);

    /* 미동작 키 → 풀버전 안내 카드(폴백) */
    if (!key) {
      var map = window.SOHO_CALC_MAP;
      var c = map && map.calcs ? map.calcs[raw] || map.calcs[slugOfFile(raw)] : null;
      if (c) {
        placeholder.innerHTML =
          '<div class="soho-mini"><div class="soho-mini-head"><span class="smh-t">' + esc(c.emoji) + ' ' + esc(c.name) + '</span>' +
          '<span class="smh-stamp">바로계산</span></div><div class="soho-mini-body">' +
          '<p class="soho-mini-note" style="margin-top:0">우리 가게 숫자로 바로 계산해 보세요.</p>' +
          '<a class="soho-mini-full" href="' + esc(c.url) + '">정확히 계산기에서 보기 →</a></div></div>';
      }
      return;
    }

    var def = MINI[key];
    var storeKey = 'mini_' + key + '_';

    var fieldsHTML = def.fields.map(function (f) {
      var saved = lsGet(storeKey + f.id);
      var val = (saved !== null && saved !== '') ? saved : f.value;
      if (f.money) val = comma(val);
      return '<div class="smf' + (f.full ? ' full' : '') + '">' +
        '<label>' + esc(f.label) + '</label>' +
        '<div class="smf-in">' +
        '<input type="text" inputmode="' + (f.money ? 'numeric' : 'decimal') + '" data-fid="' + f.id + '"' + (f.money ? ' data-money="1"' : '') + ' value="' + esc(val) + '">' +
        '<span class="smf-suf">' + esc(f.suf) + '</span></div></div>';
    }).join('');

    var box = document.createElement('div');
    box.className = 'soho-mini';
    box.innerHTML =
      '<div class="soho-mini-head"><span class="smh-t">' + esc(def.emoji) + ' ' + esc(def.title) + '</span>' +
      '<span class="smh-stamp">바로계산</span></div>' +
      '<div class="soho-mini-body">' +
      '<div class="soho-mini-fields">' + fieldsHTML + '</div>' +
      '<button type="button" class="soho-mini-btn">계산하기</button>' +
      '<p class="soho-mini-note">' + esc(def.note ? '' : '') + '</p>' +
      '<div class="soho-mini-result" data-result></div>' +
      '<a class="soho-mini-full" href="' + esc(def.full) + '">정확히 계산기에서 보기 →</a>' +
      '</div>';

    placeholder.innerHTML = '';
    placeholder.appendChild(box);

    var inputs = box.querySelectorAll('input[data-fid]');
    var resultEl = box.querySelector('[data-result]');
    var noteEl = box.querySelector('.soho-mini-note');

    /* 금액 입력 콤마 자동 */
    inputs.forEach(function (inp) {
      if (inp.getAttribute('data-money')) {
        inp.addEventListener('input', function () {
          var pos = this.value.length - this.selectionStart;
          this.value = comma(this.value);
          try { var np = this.value.length - pos; this.setSelectionRange(np, np); } catch (e) {}
        });
      }
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    });

    function run() {
      var v = {};
      inputs.forEach(function (inp) {
        v[inp.getAttribute('data-fid')] = num(inp.value);
        lsSet(storeKey + inp.getAttribute('data-fid'), inp.value); // 내 폰에만 저장
      });
      var res = def.compute(v);
      var rows = res.rows.map(function (r) {
        return '<div class="smr-row"><span class="k">' + esc(r.k) + '</span><span class="d"></span><span class="v">' + esc(r.v) + '</span></div>';
      }).join('');
      resultEl.innerHTML =
        '<div class="smr-main"><div class="smr-label">' + esc(res.main.label) + '</div>' +
        '<div class="smr-value">' + esc(res.main.value) + '</div></div>' + rows;
      resultEl.classList.add('show');
      if (noteEl && res.note) noteEl.textContent = res.note;
    }

    box.querySelector('.soho-mini-btn').addEventListener('click', run);
    if (noteEl && def.note) noteEl.textContent = def.note;
  }

  function renderMiniCalcs() {
    var nodes = document.querySelectorAll('.inline-calc[data-calc]');
    if (!nodes.length) return;
    injectStyle();
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.getAttribute('data-soho-ready')) return;
      n.setAttribute('data-soho-ready', '1');
      buildMini(n);
    });
  }

  /* ── 4. "함께 보면 좋은" (계산기 페이지) ──────────── */
  function renderCalcHub() {
    var map = window.SOHO_CALC_MAP;
    if (!map || !map.calcs) return;
    var slug = currentSlug();
    var entry = map.calcs[slug];
    if (!entry) return;
    var host = document.querySelector('.page-wrap') || document.querySelector('main') || document.body;
    if (!host || document.getElementById('soho-reco')) return;

    injectStyle();

    /* 관련 계산기 */
    var relCalcs = (entry.related || []).map(function (id) { return map.calcs[id]; }).filter(Boolean);
    /* 관련 서식 */
    var relForms = (entry.formIds || []).map(function (id) { return map.forms[id]; }).filter(Boolean);

    getIndex().then(function (index) {
      index = index || [];
      var metaBySlug = {};
      index.forEach(function (a) { metaBySlug[slugOfFile(a.url)] = a; });
      var relGuides = (entry.guides || []).map(function (g) { return metaBySlug[g]; }).filter(Boolean);

      if (!relCalcs.length && !relGuides.length && !relForms.length) return;

      var html = '<div class="soho-card">' +
        '<div class="soho-card-top"><span class="sc-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>함께 보면 좋은</span>' +
        '<span class="sc-no">SOHOTIP · 연관</span></div>';

      var first = true;
      function sectionTear() { if (!first) html += '<div class="soho-tear"></div>'; first = false; }

      /* (1) 관련 게시글(가이드) 먼저 — 있을 때만(빈 섹션 금지) */
      if (relGuides.length) {
        sectionTear();
        html += '<div class="soho-sec"><span class="soho-sec-tag">함께 보면 좋은 가이드</span>';
        relGuides.forEach(function (a) {
          var v = catVis(a.cat);
          html += '<a class="soho-item" href="' + esc(a.url) + '">' +
            iconBox(v.i, v.c) +
            '<span class="si-body"><span class="si-t">' + esc(a.title || '') + '</span>' +
            '<span class="si-d">' + esc((a.desc || '').slice(0, 64)) + '</span></span>' +
            '<span class="si-arrow">' + arrowRight() + '</span></a>';
        });
        html += '</div>';
      }

      /* (2) 관련 계산기 — 게시글 다음 */
      if (relCalcs.length) {
        sectionTear();
        html += '<div class="soho-sec"><span class="soho-sec-tag">관련 계산기</span>';
        relCalcs.forEach(function (c) {
          var ic = SLUG_ICON[slugOfFile(c.url)] || 'Calculator';
          html += '<a class="soho-item" href="' + esc(c.url) + '">' +
            iconBox(ic, '#3D5AFE') +
            '<span class="si-body"><span class="si-t">' + esc(c.name) + '</span>' +
            '<span class="si-d">' + esc(c.desc || '') + '</span></span>' +
            '<span class="si-arrow">' + arrowRight() + '</span></a>';
        });
        html += '</div>';
      }

      /* (3) 무료 서식 — 있을 때만 */
      if (relForms.length) {
        sectionTear();
        html += '<div class="soho-sec"><span class="soho-sec-tag">무료 서식</span>';
        relForms.forEach(function (f) {
          html += '<a class="soho-item" href="' + esc(f.url) + '">' +
            iconBox('FolderOpen', '#00C471') +
            '<span class="si-body"><span class="si-t">' + esc(f.name) + '</span>' +
            '<span class="si-d">' + esc(f.desc || '') + '</span></span>' +
            '<span class="si-arrow">' + arrowRight() + '</span></a>';
        });
        html += '</div>';
      }

      html += '</div>';

      var wrap = document.createElement('div');
      wrap.id = 'soho-reco';
      wrap.className = 'soho-reco';
      wrap.innerHTML = html;

      /* 엔게이지 추천(#reco-root)이 있으면 그 위에, 없으면 page-wrap 끝에 */
      var recoRoot = document.getElementById('reco-root');
      if (recoRoot && recoRoot.parentNode) recoRoot.parentNode.insertBefore(wrap, recoRoot);
      else host.appendChild(wrap);
    });
  }

  /* ── 5. 풀버전 계산기 입력값 저장·복원 (내 폰에만) ── */
  function persistFullCalc() {
    var map = window.SOHO_CALC_MAP;
    if (!map || !map.calcs) return;
    var slug = currentSlug();
    if (!map.calcs[slug]) return; // 등록된 계산기 페이지에서만
    var scope = document.querySelector('.page-wrap');
    if (!scope) return;
    var sel = 'input[type="text"],input[type="number"],input[type="tel"],input[inputmode],select';
    var fields = scope.querySelectorAll(sel);
    var keyBase = 'full_' + slug + '_';

    Array.prototype.forEach.call(fields, function (el) {
      if (!el.id) return;
      var t = (el.getAttribute('type') || '').toLowerCase();
      if (t === 'hidden' || t === 'button' || t === 'submit' || t === 'checkbox' || t === 'radio') return;

      /* 복원 */
      var saved = lsGet(keyBase + el.id);
      if (saved !== null && saved !== '') {
        el.value = saved;
        /* 콤마 포맷 등 기존 로직 반영 위해 input 이벤트 1회 발생 */
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        if (el.tagName === 'SELECT') { try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
      }
      /* 저장 */
      var evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, function () { lsSet(keyBase + el.id, el.value); });
    });
  }

  /* ── 6. 인건비 계산기 → 카테고리 배지 블루(나머지는 calc.css 오렌지) ── */
  function colorTag() {
    var map = window.SOHO_CALC_MAP;
    if (!map || !map.calcs) return;
    var entry = map.calcs[currentSlug()];
    if (!entry || entry.cat !== 'labor') return;
    var tag = document.querySelector('.page-wrap .tag');
    if (tag) tag.classList.add('tag--blue');
  }

  /* ── 7. 맨 위로 플로팅(계산기 상세 페이지에서만) ── */
  function renderBackToTop() {
    var map = window.SOHO_CALC_MAP;
    if (!map || !map.calcs || !map.calcs[currentSlug()]) return;   // 등록된 계산기 상세에서만
    if (document.getElementById('soho-backtop')) return;
    injectStyle();
    var b = document.createElement('button');
    b.id = 'soho-backtop';
    b.type = 'button';
    b.className = 'soho-backtop';
    b.setAttribute('aria-label', '맨 위로');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
    b.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    });
    document.body.appendChild(b);
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      b.classList.toggle('show', y > 300);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 8. 초기화 ───────────────────────────────── */
  function init() {
    try { renderMiniCalcs(); } catch (e) {}
    try { colorTag(); } catch (e) {}
    try { renderCalcHub(); } catch (e) {}
    try { renderBackToTop(); } catch (e) {}
    try { persistFullCalc(); } catch (e) {}
  }

  /* soho-cards.js(③ 아이콘) → calc-map.js 순으로 확보 후 실행 */
  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src; s.async = true; s.onload = cb; s.onerror = cb;
    document.head.appendChild(s);
  }
  function start() {
    function withMap() {
      if (window.SOHO_CALC_MAP) { init(); return; }
      loadScript('assets/calc-map.js?v=20260628', init); // 맵 없어도 미니 계산기는 동작
    }
    if (window.SohoCards) withMap();
    else loadScript('assets/soho-cards.js?v=20260628', withMap); // 아이콘 레지스트리(③) 확보
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
