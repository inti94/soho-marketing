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

  var GUIDE_EMOJI = {
    '네이버 플레이스': '📍', '배달앱': '🛵', 'SNS': '📱',
    '소상공인 지원금': '💰', '창업': '🏪', '계산기': '🧮',
  };
  function guideEmoji(cat) {
    cat = cat || '';
    for (var k in GUIDE_EMOJI) { if (cat.indexOf(k) !== -1) return GUIDE_EMOJI[k]; }
    return '📄';
  }

  /* ── 1. 공통 스타일 1회 주입 ───────────────────── */
  function injectStyle() {
    if (document.getElementById('soho-part2-style')) return;
    var css = [
      ':root{}',
      '.soho-reco,.soho-mini{font-family:var(--sans,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif);}',

      /* 함께 보면 좋은 (영수증 명세서) */
      '.soho-reco{max-width:680px;margin:40px auto 0;}',
      '.page-wrap .soho-reco{max-width:100%;}',
      '.soho-card{background:var(--receipt,#fff);border:1px solid var(--line,#EDE3D5);border-radius:14px;box-shadow:0 10px 30px rgba(42,32,24,.10),0 2px 6px rgba(42,32,24,.05);padding:8px 22px 20px;}',
      '.soho-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 0 4px;}',
      '.soho-card-top .sc-h{font-size:16px;font-weight:800;color:var(--ink,#2A2018);letter-spacing:-.02em;}',
      '.soho-card-top .sc-no{font-family:var(--mono,"Roboto Mono","Consolas",monospace);font-size:11px;color:var(--sub,#8A7B6B);letter-spacing:.06em;}',
      '.soho-sec{padding:6px 0 2px;}',
      '.soho-sec-tag{display:inline-block;font-size:11px;font-weight:800;padding:3px 10px;border-radius:6px;margin:6px 0 4px;}',
      '.soho-sec-tag.t-calc{color:var(--orange-d,#D94E00);background:var(--soft,#FFEEE2);}',
      '.soho-sec-tag.t-guide{color:var(--sub,#8A7B6B);background:#F1ECE3;}',
      '.soho-sec-tag.t-form{color:#147a52;background:#E3F6EE;}',
      '.soho-item{display:flex;align-items:center;gap:12px;padding:12px 8px;margin:0 -8px;border-radius:9px;text-decoration:none;color:var(--ink,#2A2018);transition:background .15s;}',
      '.soho-item+.soho-item{border-top:1px dotted var(--line,#EDE3D5);}',
      '.soho-item:hover{background:var(--paper,#FBF6EE);}',
      '.soho-item .si-ico{font-size:24px;flex-shrink:0;line-height:1;}',
      '.soho-item .si-body{flex:1;min-width:0;}',
      '.soho-item .si-t{font-size:14.5px;font-weight:700;line-height:1.3;}',
      '.soho-item .si-d{font-size:12px;color:var(--sub,#8A7B6B);line-height:1.45;margin-top:2px;}',
      '.soho-item .si-arrow{flex-shrink:0;color:var(--orange,#FF5E00);font-size:17px;font-weight:700;}',
      '.soho-tear{position:relative;height:0;border-top:2px dashed var(--dash,#D6C8B6);margin:14px 0 6px;}',
      '.soho-tear::before,.soho-tear::after{content:"";position:absolute;top:50%;width:20px;height:20px;background:var(--bg,#FAFAF8);border-radius:50%;transform:translateY(-50%);}',
      '.soho-tear::before{left:-32px;}.soho-tear::after{right:-32px;}',

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
      '.soho-mini-btn{width:100%;margin-top:14px;border:none;cursor:pointer;background:var(--orange,#FF5E00);color:#fff;font-family:inherit;font-weight:800;font-size:15px;padding:14px;border-radius:10px;box-shadow:0 4px 0 var(--orange-d,#D94E00);transition:transform .08s,box-shadow .08s,background .15s;-webkit-tap-highlight-color:transparent;}',
      '.soho-mini-btn:hover{background:var(--orange-d,#D94E00);}',
      '.soho-mini-btn:active{transform:translateY(4px);box-shadow:0 0 0 var(--orange-d,#D94E00);}',
      '.soho-mini-note{font-size:11.5px;color:var(--sub,#8A7B6B);margin-top:10px;line-height:1.5;}',
      '.soho-mini-result{display:none;margin-top:16px;padding-top:4px;border-top:2px dashed var(--dash,#D6C8B6);}',
      '.soho-mini-result.show{display:block;animation:sohoFade .25s ease;}',
      '@keyframes sohoFade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}',
      '.smr-main{text-align:center;padding:14px 0 6px;}',
      '.smr-main .smr-label{font-size:12.5px;color:var(--sub,#8A7B6B);font-weight:600;}',
      '.smr-main .smr-value{font-family:var(--mono,"Roboto Mono",monospace);font-size:30px;font-weight:700;color:var(--orange-d,#D94E00);letter-spacing:-.02em;line-height:1.2;margin-top:4px;}',
      '.smr-row{display:flex;align-items:baseline;gap:8px;padding:7px 0;font-size:13px;}',
      '.smr-row .k{flex-shrink:0;color:var(--ink,#2A2018);}',
      '.smr-row .d{flex:1;border-bottom:1.5px dotted var(--dash,#D6C8B6);transform:translateY(-3px);min-width:14px;}',
      '.smr-row .v{flex-shrink:0;font-family:var(--mono,"Roboto Mono",monospace);font-weight:700;}',
      '.soho-mini-full{display:block;text-align:center;margin-top:14px;font-size:13px;font-weight:700;color:var(--orange,#FF5E00);text-decoration:none;}',
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
        '<div class="soho-card-top"><span class="sc-h">📋 함께 보면 좋은</span>' +
        '<span class="sc-no">SOHOTIP · 연관 명세</span></div>';

      var first = true;
      function sectionTear() { if (!first) html += '<div class="soho-tear"></div>'; first = false; }

      if (relCalcs.length) {
        sectionTear();
        html += '<div class="soho-sec"><span class="soho-sec-tag t-calc">🧮 관련 계산기</span>';
        relCalcs.forEach(function (c) {
          html += '<a class="soho-item" href="' + esc(c.url) + '">' +
            '<span class="si-ico">' + esc(c.emoji) + '</span>' +
            '<span class="si-body"><span class="si-t">' + esc(c.name) + '</span>' +
            '<span class="si-d">' + esc(c.desc || '') + '</span></span>' +
            '<span class="si-arrow">→</span></a>';
        });
        html += '</div>';
      }

      if (relGuides.length) {
        sectionTear();
        html += '<div class="soho-sec"><span class="soho-sec-tag t-guide">📖 함께 보면 좋은 가이드</span>';
        relGuides.forEach(function (a) {
          html += '<a class="soho-item" href="' + esc(a.url) + '">' +
            '<span class="si-ico">' + guideEmoji(a.cat) + '</span>' +
            '<span class="si-body"><span class="si-t">' + esc(a.title || '') + '</span>' +
            '<span class="si-d">' + esc((a.desc || '').slice(0, 64)) + '</span></span>' +
            '<span class="si-arrow">→</span></a>';
        });
        html += '</div>';
      }

      if (relForms.length) {
        sectionTear();
        html += '<div class="soho-sec"><span class="soho-sec-tag t-form">📂 무료 서식</span>';
        relForms.forEach(function (f) {
          html += '<a class="soho-item" href="' + esc(f.url) + '">' +
            '<span class="si-ico">' + esc(f.emoji || '📄') + '</span>' +
            '<span class="si-body"><span class="si-t">' + esc(f.name) + '</span>' +
            '<span class="si-d">' + esc(f.desc || '') + '</span></span>' +
            '<span class="si-arrow">↓</span></a>';
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

  /* ── 6. 초기화 ───────────────────────────────── */
  function init() {
    try { renderMiniCalcs(); } catch (e) {}
    try { renderCalcHub(); } catch (e) {}
    try { persistFullCalc(); } catch (e) {}
  }

  /* calc-map.js 가 아직 없으면 로드 후 실행 */
  function start() {
    if (window.SOHO_CALC_MAP) { init(); return; }
    var s = document.createElement('script');
    s.src = 'assets/calc-map.js?v=20260626';
    s.async = true;
    s.onload = init;
    s.onerror = init; // 맵 없어도 미니 계산기는 동작
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
