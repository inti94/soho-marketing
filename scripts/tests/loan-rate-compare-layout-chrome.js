// 신용점수별 대출비용 비교 계산기 — '금리별 상세 비교' 표 실제 Chrome 레이아웃 검사
// jsdom은 픽셀 레이아웃이 없어, 이 스크립트를 실제 Chrome에서 실행해 폭·넘침·정렬을 측정한다.
// 사용법: 같은 출처(https://sohotip.co.kr 또는 로컬 서버)의 아무 페이지를 연 뒤 개발자도구 콘솔에 붙여넣고
//   await LRC_LAYOUT.run([1920,1440,1366,1280,1024,430,390,375,360,320])
// 각 폭마다 그 폭의 iframe에 계산기를 띄워(미디어쿼리가 실제 기기처럼 적용됨) 3가지 데이터로 계산한 뒤 측정한다.
// ※ 데스크톱 Chrome iframe은 세로 스크롤바(약 15px)가 폭을 차지하므로 실제 모바일(오버레이 스크롤바)보다 약 15px 좁게 측정된다.
window.LRC_LAYOUT = (function () {
  var SETS = {
    spec: { P: '50000000', a: '5', b: '18', term: '5', t: 'bullet' },          // 요청서 예시 데이터
    long: { P: '1000000000', a: '5', b: '20', term: '30', t: 'equalPayment' },  // 긴 금액(총상환 60억대)
    save: { P: '1000000000', a: '20', b: '5', term: '40', t: 'equalPrincipal' } // 절감 방향 + 긴 금액
  };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function measure(W, data) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;height:900px;border:0;background:#fff;z-index:2147483647';
    f.style.setProperty('width', W + 'px', 'important');
    f.style.setProperty('max-width', 'none', 'important');
    f.src = '/loan-rate-compare-calc.html?layout=' + W + '&r=' + Math.random();
    document.body.appendChild(f);
    await new Promise(function (r) { f.onload = r; });
    await sleep(1500);
    var d = f.contentDocument, w = f.contentWindow, $ = function (id) { return d.getElementById(id); };
    var set = function (id, v) { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
    set('lrc-principal', data.P); set('lrc-base-rate', data.a); set('lrc-comp-rate', data.b); set('lrc-term', data.term);
    $('lrc-type-' + data.t).click(); $('lrc-calc-btn').click();
    await sleep(500);
    var t = $('lrc-table'), wrap = t.parentElement, R = function (e) { return e.getBoundingClientRect(); };
    var ths = [].slice.call(t.querySelectorAll('thead th')), rows = [].slice.call(t.querySelectorAll('tbody tr'));
    var lines = function (n) { var rg = d.createRange(); rg.selectNodeContents(n); var s = {}; [].forEach.call(rg.getClientRects(), function (x) { s[Math.round(x.top)] = 1; }); return Object.keys(s).length; };
    var align = 0, cellOverflow = 0, broken = 0, minFont = 99, escape = 0;
    rows.forEach(function (r) { [].forEach.call(r.children, function (td, i) { align = Math.max(align, Math.abs(R(td).left - R(ths[i]).left), Math.abs(R(td).right - R(ths[i]).right)); }); });
    ths.concat([].concat.apply([], rows.map(function (r) { return [].slice.call(r.children); }))).forEach(function (c) {
      if (c.scrollWidth > c.clientWidth + 1) cellOverflow++;
      minFont = Math.min(minFont, parseFloat(w.getComputedStyle(c).fontSize));
      var col = [].indexOf.call(c.parentElement.children, c);
      if (col > 0 && c.tagName === 'TD') { var n = c.querySelector('.amt') || c; if (lines(n) > 1) broken++; }
      if (R(c).right > R(t).right + 0.5 || R(c).left < R(t).left - 0.5) escape++;
    });
    var out = {
      W: W, vw: w.innerWidth,
      pageOverflow: d.documentElement.scrollWidth > d.documentElement.clientWidth,
      wrapInner: wrap.clientWidth, tableW: Math.round(R(t).width), display: w.getComputedStyle(t).display,
      rowWidths: Object.keys(rows.concat([t.querySelector('thead tr')]).reduce(function (a, r) { a[Math.round(R(r).width)] = 1; return a; }, {})).join(','),
      cols: ths.map(function (x) { return Math.round(R(x).width); }).join(','),
      innerScroll: wrap.scrollWidth > wrap.clientWidth + 1, wrapScrollW: wrap.scrollWidth,
      alignPx: Math.round(align * 10) / 10, cellOverflow: cellOverflow, brokenAmounts: broken, cellsOutsideTable: escape, minFont: minFont
    };
    // 판정: 스크롤이 없으면 표 폭 = wrapper 안쪽 폭이어야 하고, 스크롤이 있으면 표가 더 넓어야 한다(오른쪽 빈 공간 금지)
    out.fillsCard = out.innerScroll ? out.tableW >= out.wrapInner : Math.abs(out.tableW - out.wrapInner) <= 1;
    out.pass = out.display === 'table' && !out.pageOverflow && out.fillsCard && out.alignPx <= 0.5 && !out.cellOverflow && !out.brokenAmounts && !out.cellsOutsideTable && out.minFont >= 12 && out.rowWidths.split(',').length === 1;
    f.remove();
    return out;
  }

  async function run(widths) {
    var res = [];
    for (var i = 0; i < widths.length; i++) for (var k in SETS) { var m = await measure(widths[i], SETS[k]); m.data = k; res.push(m); }
    console.table(res);
    console.log('레이아웃 검사: ' + res.length + '건 / 실패 ' + res.filter(function (m) { return !m.pass; }).length);
    return res;
  }
  return { SETS: SETS, measure: measure, run: run };
})();
