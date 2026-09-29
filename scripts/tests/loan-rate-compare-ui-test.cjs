// 신용점수별 대출비용 비교 계산기 UI 자동 테스트 — 실제 페이지 + 실제 스크립트를 jsdom에서 실행
// 실행: NODE_PATH=<jsdom 설치 경로> node scripts/tests/loan-rate-compare-ui-test.cjs
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '../../');
const html = fs.readFileSync(ROOT + 'loan-rate-compare-calc.html', 'utf8');
const engine = fs.readFileSync(ROOT + 'assets/loan-rate-compare.js', 'utf8');
const sohotip = fs.readFileSync(ROOT + 'sohotip.js', 'utf8');
const E = require(ROOT + 'assets/loan-rate-compare.js');

async function boot() {
  const stripped = html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const inline = [...stripped.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.includes('LoanRateCompare'))[0];
  const dom = new JSDOM(stripped.replace(/<script>[\s\S]*?<\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.alert = m => { throw new Error('alert: ' + m); };
  try { w.eval(sohotip); } catch (e) {}
  w.eval(engine); w.eval(inline);
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r));
  return w;
}
(async () => {
let w = await boot(), d = w.document;
let pass = 0, fail = 0;
const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : `  got=${JSON.stringify(g)} exp=${JSON.stringify(e)}`)); };
const ok = (n, c, info) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + (info || ''))); };
const $ = id => d.getElementById(id);
const type = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
const pick = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
const click = id => $(id).click();
const vis = id => { let e = $(id); while (e) { if (e.style && e.style.display === 'none') return false; e = e.parentElement; } return true; };
const txt = id => $(id).textContent;
const keyVal = label => { const r = [...$('lrc-key').querySelectorAll('.breakdown-row')].find(x => x.children[0].textContent.trim() === label); return r ? r.children[1].textContent.trim() : null; };
const keyLabels = () => [...$('lrc-key').querySelectorAll('.breakdown-row')].map(x => x.children[0].textContent.trim());
const tableRow = label => { const r = [...$('lrc-table').querySelectorAll('tbody tr')].find(x => x.children[0].textContent.trim() === label); return r ? [...r.children].slice(1).map(c => c.textContent.trim()) : null; };
const tableLabels = () => [...$('lrc-table').querySelectorAll('tbody tr')].map(x => x.children[0].textContent.trim());
const incVal = label => { const r = [...$('lrc-income-rows').querySelectorAll('.breakdown-row')].find(x => x.children[0].textContent.trim() === label); return r ? r.children[1].textContent.trim() : null; };
const clean = () => !/NaN|Infinity|undefined|null/.test(txt('result-section') + txt('lrc-errors') + txt('lrc-rate-diff'));
const errShown = () => $('lrc-errors').classList.contains('show');
const resultShown = () => vis('result-section');
const W = x => E.formatMoney(x);
async function fresh() { w = await boot(); d = w.document; }
function fill(o) {
  if (o.P != null) type('lrc-principal', o.P);
  if (o.a != null) type('lrc-base-rate', o.a);
  if (o.b != null) type('lrc-comp-rate', o.b);
  if (o.unit != null) pick('lrc-term-unit', o.unit);
  if (o.term != null) type('lrc-term', o.term);
  if (o.t) click('lrc-type-' + o.t);
  if (o.inc != null) type('lrc-income', o.inc);
}
const calc = () => click('lrc-calc-btn');
const eng = (P, a, b, n, t) => E.calculateLoanComparison({ principal: P, baseRate: a, compareRate: b, months: n, repaymentType: t });

// ── 초기 상태 ──
eq('초기: 결과 숨김', resultShown(), false);
eq('초기: 원리금균등 선택', [$('lrc-type-equalPayment').classList.contains('active'), $('lrc-type-equalPrincipal').classList.contains('active'), $('lrc-type-bullet').classList.contains('active')], [true, false, false]);
eq('초기: 기간 5년', [$('lrc-term').value, $('lrc-term-unit').value], ['5', 'year']);
eq('초기: 원금·금리·소득 빈칸', ['lrc-principal', 'lrc-base-rate', 'lrc-comp-rate', 'lrc-income'].map(id => $(id).value), ['', '', '', '']);
eq('제목·부제', [d.querySelector('h1').textContent, /금리 1~2%p 차이가 실제로 얼마인지 계산해보세요/.test(d.querySelector('.page-desc').textContent)], ['신용점수별 대출비용 비교 계산기', true]);
eq('form data-no-persist (공통 입력복원 차단)', $('calc').hasAttribute('data-no-persist'), true);

// ── TEST 35 모바일 입력 모드 ──
eq('TEST 35 원금 inputmode numeric', $('lrc-principal').getAttribute('inputmode'), 'numeric');
eq('TEST 35 월소득 inputmode numeric', $('lrc-income').getAttribute('inputmode'), 'numeric');
eq('TEST 35 금리 inputmode decimal', [$('lrc-base-rate').getAttribute('inputmode'), $('lrc-comp-rate').getAttribute('inputmode')], ['decimal', 'decimal']);
eq('TEST 35 기간 inputmode numeric', $('lrc-term').getAttribute('inputmode'), 'numeric');
eq('TEST 35 금액 필드 data-money', [$('lrc-principal').hasAttribute('data-money'), $('lrc-income').hasAttribute('data-money')], [true, true]);

// ── 케이스 A: 1억 · 4.5% vs 7% · 5년 · 원리금균등 ──
fill({ P: '100000000', a: '4.5', b: '7', term: '5' });
eq('TEST 27 원금 콤마 자동 표시', $('lrc-principal').value, '100,000,000');
eq('금리 입력 즉시 금리차 표시 %p', txt('lrc-rate-diff'), '금리 차이 +2.5%p');
calc();
let RA = eng(1e8, 4.5, 7, 60, 'equalPayment');
eq('A 결과 표시·오류 없음', [resultShown(), errShown()], [true, false]);
eq('A 핵심 제목 %p', txt('res-title'), '금리 차이 +2.5%p가 만드는 총 이자 차이');
eq('A 총이자 차이 강조', txt('res-total'), '+6,949,076원');
eq('A 문구: 추가 발생', txt('res-msg'), '비교 금리를 적용하면 5년 동안 총 이자가 약 695만원 더 발생합니다.');
eq('A 핵심 순서(금리→총이자→월→1년→총상환)', keyLabels(), ['금리 차이', '총 이자 차이', '월 상환액 차이', '첫 1년 이자 차이', '총 상환액 차이']);
eq('A 금리 차이 +2.5%p', keyVal('금리 차이'), '+2.5%p4.5% → 7.0%');
eq('A 월 상환액 차이', keyVal('월 상환액 차이'), '+115,818원 더 부담');
eq('A 첫1년 이자 차이 = 스케줄 1~12회 합 차', keyVal('첫 1년 이자 차이'), '+' + W(Math.round(RA.compare.firstYearInterest) - Math.round(RA.base.firstYearInterest)) + ' 더 부담1~12회차 실제 이자 합계 기준');
eq('A 총상환액 차이 = 총이자 차이', keyVal('총 상환액 차이'), '+6,949,076원 더 부담');
eq('A 비교표 행', tableLabels(), ['금리', '월 상환액', '첫 1년 이자', '총 이자', '총 상환액']);
eq('A 비교표 금리', tableRow('금리'), ['4.5%', '7.0%', '+2.5%p']);
eq('A 비교표 월 상환액', tableRow('월 상환액'), ['1,864,302원', '1,980,120원', '+115,818원']);
eq('A 비교표 첫 1년 이자', tableRow('첫 1년 이자'), ['4,126,751원', '6,451,642원', '+2,324,891원']);
eq('A 비교표 총 이자', tableRow('총 이자'), ['11,858,115원', '18,807,191원', '+6,949,076원']);
eq('A 비교표 총 상환액', tableRow('총 상환액'), ['111,858,115원', '118,807,191원', '+6,949,076원']);
eq('TEST 13 소득 미입력 → 부담률 영역 숨김', [vis('lrc-income-box'), $('lrc-income-note').classList.contains('show')], [false, false]);
ok('A NaN/Infinity/undefined 없음', clean());
eq('A 만기일시 경고 없음', $('lrc-bullet-warn').classList.contains('show'), false);
// 스케줄
eq('스케줄 기준 60행', $('lrc-sched-table').querySelectorAll('tbody tr').length, 60);
eq('스케줄 1회차(기준)', [...$('lrc-sched-table').querySelectorAll('tbody tr')[0].children].map(c => c.textContent), ['1', '1,864,302원', '1,489,302원', '375,000원', '98,510,698원']);
eq('스케줄 마지막 남은 원금 0원', $('lrc-sched-table').querySelectorAll('tbody tr')[59].children[4].textContent, '0원');
click('lrc-sched-comp');
eq('스케줄 탭 비교 금리 1회차 이자 583,333원', $('lrc-sched-table').querySelectorAll('tbody tr')[0].children[3].textContent, '583,333원');
eq('스케줄 탭 이름', [txt('lrc-sched-base'), txt('lrc-sched-comp'), $('lrc-sched-comp').classList.contains('active')], ['기준 금리 4.5%', '비교 금리 7.0%', true]);
click('lrc-sched-base');

// ── TEST 12·33 월소득 ──
type('lrc-income', '4000000');
eq('TEST 12 소득 콤마', $('lrc-income').value, '4,000,000');
eq('소득 입력 → 부담률 영역 표시', vis('lrc-income-box'), true);
eq('부담률 제목(DSR 표기 아님)', d.querySelector('#lrc-income-box h2').textContent, '입력한 월소득 대비 이번 대출 월 부담');
eq('기준 부담률 46.6%', incVal('기준 금리 (월 상환액 기준)'), '46.6%1,864,302원 ÷ 4,000,000원');
eq('비교 부담률 49.5%', incVal('비교 금리 (월 상환액 기준)'), '49.5%1,980,120원 ÷ 4,000,000원');
eq('부담률 차이 +2.9%p', incVal('차이'), '+2.9%p');
const before33 = [tableRow('월 상환액'), tableRow('총 이자'), tableRow('총 상환액'), txt('res-total')];
type('lrc-income', '5000000');
eq('TEST 33 소득 변경 → 대출 결과 불변', [tableRow('월 상환액'), tableRow('총 이자'), tableRow('총 상환액'), txt('res-total')], before33);
eq('TEST 33 부담률만 변경 37.3%', incVal('기준 금리 (월 상환액 기준)'), '37.3%1,864,302원 ÷ 5,000,000원');
ok('결과에 "DSR"은 부정 안내문에만, "대출 가능"·"승인" 문구 없음', !/대출 가능|승인/.test(txt('result-section')) && (txt('result-section').match(/DSR/g) || []).length === 1 && /DSR이 아닙니다/.test(txt('result-section')));
type('lrc-income', '');
eq('소득 삭제 → 부담률 숨김·대출 결과 유지', [vis('lrc-income-box'), resultShown(), tableRow('월 상환액')[0]], [false, true, '1,864,302원']);
type('lrc-income', '0');
eq('소득 0 → 부담률 제외 안내·계산은 정상', [vis('lrc-income-box'), $('lrc-income-note').classList.contains('show'), /계산하지 않았습니다/.test(txt('lrc-income-note')), resultShown()], [false, true, true, true]);
type('lrc-income', '');

// ── TEST 32 기간 변경 5년 → 10년 ──
type('lrc-term', '10');
let R10 = eng(1e8, 4.5, 7, 120, 'equalPayment');
eq('TEST 32 월상환 재계산', tableRow('월 상환액'), [W(R10.base.monthlyPayment), W(R10.compare.monthlyPayment), '+' + W(Math.round(R10.compare.monthlyPayment) - Math.round(R10.base.monthlyPayment))]);
eq('TEST 32 총이자 재계산', tableRow('총 이자').slice(0, 2), [W(R10.base.totalInterest), W(R10.compare.totalInterest)]);
eq('TEST 32 첫1년 이자 재계산', tableRow('첫 1년 이자').slice(0, 2), [W(R10.base.firstYearInterest), W(R10.compare.firstYearInterest)]);
eq('TEST 32 총상환 재계산', tableRow('총 상환액').slice(0, 2), [W(R10.base.totalPayment), W(R10.compare.totalPayment)]);
eq('TEST 32 문구 10년', /10년 동안/.test(txt('res-msg')), true);
eq('TEST 32 스케줄 120행', $('lrc-sched-table').querySelectorAll('tbody tr').length, 120);

// ── TEST 34 원금 변경 → 두 금리 동시 갱신 ──
type('lrc-principal', '200000000');
let R2 = eng(2e8, 4.5, 7, 120, 'equalPayment');
eq('TEST 34 원금 변경 → 기준·비교 모두 갱신', tableRow('월 상환액').slice(0, 2), [W(R2.base.monthlyPayment), W(R2.compare.monthlyPayment)]);
eq('TEST 34 부제 원금 반영', /200,000,000원/.test(txt('res-sub')), true);

// ── TEST 28 원리금균등 → 원금균등 ──
type('lrc-principal', '120000000'); type('lrc-base-rate', '6'); type('lrc-comp-rate', '8'); type('lrc-term', '10');
const prevEP = tableRow('월 상환액');
click('lrc-type-equalPrincipal');
eq('TEST 28 월 상환액 행 사라짐', tableRow('월 상환액'), null);
eq('TEST 28 원금균등 행 구성', tableLabels(), ['금리', '첫 달 상환액', '월평균 상환액', '마지막 달 상환액', '첫 1년 이자', '총 이자', '총 상환액']);
eq('케이스 B 첫 달', tableRow('첫 달 상환액'), ['1,600,000원', '1,800,000원', '+200,000원']);
eq('케이스 B 평균', tableRow('월평균 상환액'), ['1,302,500원', '1,403,333원', '+100,833원']);
eq('케이스 B 마지막 달', tableRow('마지막 달 상환액'), ['1,005,000원', '1,006,667원', '+1,667원']);
eq('케이스 B 총이자 36,300,000 / 48,400,000', tableRow('총 이자'), ['36,300,000원', '48,400,000원', '+12,100,000원']);
eq('케이스 B 총상환', tableRow('총 상환액'), ['156,300,000원', '168,400,000원', '+12,100,000원']);
eq('케이스 B 첫1년 이자', tableRow('첫 1년 이자'), ['6,870,000원', '9,160,000원', '+2,290,000원']);
eq('TEST 28 핵심 라벨 = 첫 달 상환액 차이', keyLabels()[2], '첫 달 상환액 차이');
ok('TEST 28 이전 원리금균등 값 잔존 없음', prevEP !== null && !txt('result-section').includes(prevEP[0]));
eq('TEST 28 부제 원금균등상환', /원금균등상환/.test(txt('res-sub')), true);
eq('TEST 28 스케줄 1회차 1,600,000 / 2회차 1,595,000', [$('lrc-sched-table').querySelectorAll('tbody tr')[0].children[1].textContent, $('lrc-sched-table').querySelectorAll('tbody tr')[1].children[1].textContent], ['1,600,000원', '1,595,000원']);
// TEST 14 원금균등 월소득 = 첫 달 기준
type('lrc-income', '4000000');
eq('TEST 14 "첫 달 상환액 기준" 명시·40.0%', incVal('기준 금리 (첫 달 상환액 기준)'), '40.0%1,600,000원 ÷ 4,000,000원');
eq('TEST 14 평균 월 부담률 참고', incVal('참고: 월평균 상환액 기준'), '기준 32.6% → 비교 35.1%');
type('lrc-income', '');

// ── TEST 29 원리금균등 → 만기일시 ──
click('lrc-type-equalPayment');
const prevEP2 = tableRow('월 상환액');
type('lrc-principal', '100000000'); type('lrc-term', '5');
click('lrc-type-bullet');
eq('TEST 29 월 상환액 행 없음, 매월 이자·만기 원금 표시', tableLabels(), ['금리', '매월 이자', '만기 상환 원금', '첫 1년 이자', '총 이자', '총 상환액']);
eq('케이스 C 매월 이자', tableRow('매월 이자'), ['500,000원', '666,667원', '+166,667원']);
eq('케이스 C 만기 원금', tableRow('만기 상환 원금'), ['100,000,000원', '100,000,000원', '0원']);
eq('케이스 C 총이자', tableRow('총 이자'), ['30,000,000원', '40,000,000원', '+10,000,000원']);
eq('케이스 C 총상환', tableRow('총 상환액'), ['130,000,000원', '140,000,000원', '+10,000,000원']);
eq('TEST 29 핵심 라벨 = 매월 이자 차이', keyLabels()[2], '매월 이자 차이');
eq('TEST 29 만기 원금 강한 경고', [$('lrc-bullet-warn').classList.contains('show'), /만기에 원금 100,000,000원을 한 번에 갚아야 합니다/.test(txt('lrc-bullet-warn'))], [true, true]);
ok('TEST 29 원리금균등 결과 잔존 없음', !txt('result-section').includes(prevEP2[0]) && !txt('result-section').includes('월 상환액 차이'));
type('lrc-income', '4000000');
eq('TEST 15 만기일시 부담률 = 월 이자 기준', incVal('기준 금리 (월 이자 기준)'), '12.5%500,000원 ÷ 4,000,000원');
ok('TEST 15 만기 원금 부담 별도 표시', /100,000,000원/.test(incVal('만기 원금 상환') || '') && /월 부담률에 포함되지 않음/.test(incVal('만기 원금 상환')));
type('lrc-income', '');
eq('만기일시 → 원리금균등 복귀 시 경고 사라짐', (click('lrc-type-equalPayment'), $('lrc-bullet-warn').classList.contains('show')), false);

// ── TEST 30 금리 교환 (4 ↔ 7) ──
type('lrc-base-rate', '4'); type('lrc-comp-rate', '7');
const up = [txt('res-total'), keyVal('총 이자 차이')];
eq('TEST 8 비교금리 높음 → 추가 부담', [/^\+/.test(up[0]), /더 부담$/.test(up[1]), /더 발생합니다/.test(txt('res-msg'))], [true, true, true]);
type('lrc-base-rate', '7'); type('lrc-comp-rate', '4');
const down = [txt('res-total'), keyVal('총 이자 차이')];
eq('TEST 30 교환 → 절감 방향', [/절감$/.test(down[0]), /절감$/.test(down[1]), /줄일 수 있습니다/.test(txt('res-msg'))], [true, true, true]);
eq('TEST 30 절대금액 동일', up[0].replace(/[^\d]/g, ''), down[0].replace(/[^\d]/g, ''));
eq('TEST 9 금리차 −3.0%p', keyVal('금리 차이').slice(0, 6), '−3.0%p');
ok('TEST 9 "추가 이자 -" 같은 음수 표기 없음', !/-\d|추가 이자 −|\+−/.test(txt('result-section')));
eq('TEST 9 비교표 차이 = 절감 표기', tableRow('총 이자')[2].endsWith(' 절감'), true);

// ── TEST 7 동일 금리 ──
type('lrc-base-rate', '5'); type('lrc-comp-rate', '5');
eq('TEST 7 금리차 0.0%p', keyVal('금리 차이').slice(0, 5), '0.0%p');
eq('TEST 7 차이 전부 0원', ['총 이자 차이', '월 상환액 차이', '첫 1년 이자 차이', '총 상환액 차이'].map(keyVal).map(s => s.replace(/1~12회차.*/, '')), ['0원 (차이 없음)', '0원 (차이 없음)', '0원 (차이 없음)', '0원 (차이 없음)']);
eq('TEST 7 강조 0원·문구', [txt('res-total'), txt('res-msg')], ['0원', '두 금리로 계산한 총 이자가 같습니다.']);

// ── TEST 11 6개월 ──
pick('lrc-term-unit', 'month'); type('lrc-term', '6');
eq('TEST 11 라벨 = 전체 기간(6개월) 이자 차이', keyLabels()[3], '전체 기간(6개월) 이자 차이');
ok('TEST 11 안내 문구', /대출기간이 1년 미만이라 전체 기간 기준입니다/.test(keyVal('전체 기간(6개월) 이자 차이')));
type('lrc-comp-rate', '7');
const R6 = eng(1e8, 5, 7, 6, 'equalPayment');
eq('TEST 11 값 = 전체 이자 차이', tableRow('전체 기간(6개월) 이자'), [W(R6.base.totalInterest), W(R6.compare.totalInterest), '+' + W(Math.round(R6.compare.totalInterest) - Math.round(R6.base.totalInterest))]);
eq('TEST 11 문구 6개월', /6개월 동안/.test(txt('res-msg')), true);

// ── TEST 16 소수 금리 ──
pick('lrc-term-unit', 'year'); type('lrc-term', '5'); type('lrc-base-rate', '4.35'); type('lrc-comp-rate', '6.85');
eq('TEST 16 4.35% 그대로 표시', tableRow('금리'), ['4.35%', '6.85%', '+2.5%p']);
eq('TEST 16 4.35% 월 상환 = 엔진', tableRow('월 상환액')[0], W(E.calculateEqualPaymentLoan(1e8, 4.35, 60).monthlyPayment));

// ── TEST 17 장기 ──
type('lrc-principal', '300000000'); type('lrc-base-rate', '4'); type('lrc-comp-rate', '6'); type('lrc-term', '30');
eq('TEST 17 30년 월상환', tableRow('월 상환액'), ['1,432,246원', '1,798,652원', '+366,406원']);
eq('TEST 17 스케줄 360행·마지막 잔액 0원', [$('lrc-sched-table').querySelectorAll('tbody tr').length, $('lrc-sched-table').querySelectorAll('tbody tr')[359].children[4].textContent], [360, '0원']);
ok('TEST 17 NaN 없음', clean());
eq('TEST 17 총이자 차 1억 문구', /약 1억 3,191만원/.test(txt('res-msg')), true);

// ── TEST 26 (정책 변경): 연 20% 초과 입력 차단 ──
const OVER_MSG = '입력한 금리가 국내 일반 개인대출의 법정 최고금리(연 20%) 범위를 초과합니다. 금리를 다시 확인해주세요.';
for (const r of ['100', '25']) {
  type('lrc-comp-rate', r);
  eq(`TEST 26 비교금리 ${r}% → 결과 숨김·오류 표시`, [resultShown(), errShown(), txt('res-total'), $('lrc-table').innerHTML], [false, true, '', '']);
  ok(`TEST 26 비교금리 ${r}% 안내 문구`, txt('lrc-errors').includes(OVER_MSG));
}
type('lrc-comp-rate', '6');
eq('정상 금리 복귀 → 결과 복귀·오류 사라짐·경고 없음', [resultShown(), errShown(), $('lrc-warn').classList.contains('show')], [true, false, false]);
ok('입력 안내에 0%~20% 범위 표시', /연 0%~20%\(법정 최고금리\)까지 입력할 수 있습니다/.test(d.getElementById('calc').textContent));

// ── TEST 36 금리 20% → 정상 계산 ──
type('lrc-principal', '100000000'); type('lrc-term', '5');
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) {
  click('lrc-type-' + t);
  type('lrc-base-rate', '4'); type('lrc-comp-rate', '20');
  const R = eng(1e8, 4, 20, 60, t);
  eq(`TEST 36 비교금리 20% (${t}) 결과 표시·오류 없음·경고 없음`, [resultShown(), errShown(), $('lrc-warn').classList.contains('show')], [true, false, false]);
  eq(`TEST 36 비교금리 20% (${t}) 금리·총이자 표시`, [tableRow('금리'), tableRow('총 이자').slice(0, 2)], [['4.0%', '20.0%', '+16.0%p'], [W(R.base.totalInterest), W(R.compare.totalInterest)]]);
  ok(`TEST 36 (${t}) NaN 없음`, clean());
  type('lrc-base-rate', '20'); type('lrc-comp-rate', '4');
  eq(`TEST 36 기준금리 20% (${t}) 정상·절감 방향`, [resultShown(), errShown(), /절감$/.test(txt('res-total'))], [true, false, true]);
}
click('lrc-type-equalPayment'); type('lrc-base-rate', '4'); type('lrc-comp-rate', '20');
eq('TEST 36 20% 원리금균등 월상환 2,649,388원', tableRow('월 상환액')[1], '2,649,388원');

// ── TEST 37 금리 20.01% → 입력 차단 ──
type('lrc-comp-rate', '20.01');
eq('TEST 37 비교금리 20.01% → 결과 즉시 숨김·오류', [resultShown(), errShown()], [false, true]);
eq('TEST 37 이전 결과 DOM 제거', [txt('res-total'), $('lrc-table').innerHTML, $('lrc-sched-table').innerHTML], ['', '', '']);
ok('TEST 37 안내 문구(비교할 금리)', txt('lrc-errors').includes('비교할 금리 연 20.01% — ' + OVER_MSG));
type('lrc-comp-rate', '7'); type('lrc-base-rate', '20.01');
eq('TEST 37 기준금리 20.01% 차단', [resultShown(), errShown()], [false, true]);
ok('TEST 37 안내 문구(기준 금리)', txt('lrc-errors').includes('기준 금리 연 20.01% — ' + OVER_MSG));
ok('TEST 37 NaN 없음', clean());
type('lrc-base-rate', '4');
eq('TEST 37 20% 이하로 고치면 자동 재계산', [resultShown(), errShown(), tableRow('금리')], [true, false, ['4.0%', '7.0%', '+3.0%p']]);
await fresh();
fill({ P: '100000000', a: '20.01', b: '7' }); calc();
eq('TEST 37 첫 계산부터 20.01%면 결과 없음', [resultShown(), errShown()], [false, true]);

// ── TEST 38 금리 0% → 정상 계산 ──
type('lrc-base-rate', '0');
const R0 = eng(1e8, 0, 7, 60, 'equalPayment');
eq('TEST 38 기준금리 0% 정상 계산', [resultShown(), errShown(), tableRow('금리')[0], tableRow('월 상환액')[0], tableRow('총 이자')[0]], [true, false, '0.0%', W(1e8 / 60), '0원']);
eq('TEST 38 비교 7% 값 = 엔진', tableRow('총 이자')[1], W(R0.compare.totalInterest));
type('lrc-base-rate', '7'); type('lrc-comp-rate', '0');
eq('TEST 38 비교금리 0% 정상·절감', [resultShown(), errShown(), tableRow('총 이자')[1], /절감$/.test(txt('res-total'))], [true, false, '0원', true]);
for (const t of ['equalPrincipal', 'bullet']) { click('lrc-type-' + t); ok(`TEST 38 비교금리 0% (${t}) 총이자 0원·NaN 없음`, resultShown() && tableRow('총 이자')[1] === '0원' && clean()); }
await fresh();
fill({ P: '300000000', a: '4', b: '6', term: '30' }); calc();

// ── TEST 31 비교금리 삭제 → 즉시 숨김 ──
type('lrc-comp-rate', '');
eq('TEST 31 결과 즉시 숨김 + 오류', [resultShown(), errShown()], [false, true]);
eq('TEST 31 이전 비교 결과 DOM 제거', [txt('res-total'), $('lrc-table').innerHTML, $('lrc-sched-table').innerHTML], ['', '', '']);
eq('TEST 31 금리차 안내도 비움', txt('lrc-rate-diff'), '');
type('lrc-comp-rate', '6');
eq('비교금리 재입력 → 결과 복귀', [resultShown(), errShown()], [true, false]);

// ── TEST 23~25 입력 오류 ──
const blockedBy = (fn, restore) => { fn(); const r = [resultShown(), errShown(), clean()]; restore(); return r; };
eq('TEST 23 원금 0 차단', blockedBy(() => type('lrc-principal', '0'), () => type('lrc-principal', '300000000')), [false, true, true]);
eq('TEST 23 원금 빈값 차단', blockedBy(() => type('lrc-principal', ''), () => type('lrc-principal', '300000000')), [false, true, true]);
eq('TEST 23 원금 문자 → 콤마포맷이 숫자만 남김 → 빈값 차단', blockedBy(() => type('lrc-principal', 'abc'), () => type('lrc-principal', '300000000')), [false, true, true]);
eq('TEST 24 기간 0 차단', blockedBy(() => type('lrc-term', '0'), () => type('lrc-term', '30')), [false, true, true]);
eq('TEST 24 기간 빈값 차단', blockedBy(() => type('lrc-term', ''), () => type('lrc-term', '30')), [false, true, true]);
eq('TEST 24 기간 음수 차단', blockedBy(() => type('lrc-term', '-5'), () => type('lrc-term', '30')), [false, true, true]);
eq('TEST 24 41년 차단', blockedBy(() => type('lrc-term', '41'), () => type('lrc-term', '30')), [false, true, true]);
eq('TEST 25 음수 기준금리 차단', blockedBy(() => type('lrc-base-rate', '-1'), () => type('lrc-base-rate', '4')), [false, true, true]);
eq('TEST 25 음수 비교금리 차단', blockedBy(() => type('lrc-comp-rate', '-0.5'), () => type('lrc-comp-rate', '6')), [false, true, true]);
type('lrc-base-rate', '0');
eq('TEST 25 0% 허용', [resultShown(), errShown()], [true, false]);
// TEST 2(UI) 0% 원리금균등
type('lrc-principal', '120000000'); type('lrc-term', '10');
eq('TEST 2(UI) 0% 월상환 1,000,000원·총이자 0원', [tableRow('월 상환액')[0], tableRow('총 이자')[0], tableRow('총 상환액')[0]], ['1,000,000원', '0원', '120,000,000원']);
ok('TEST 2(UI) NaN 없음', clean());
click('lrc-type-bullet');
eq('TEST 6(UI) 만기일시 0% 월이자 0원', [tableRow('매월 이자')[0], tableRow('총 이자')[0], tableRow('만기 상환 원금')[0]], ['0원', '0원', '120,000,000원']);

// ── 계산 전(첫 클릭 전) 입력 오류 → 결과 없음 ──
await fresh();
calc();
eq('빈 폼 계산 → 오류·결과 없음', [resultShown(), errShown()], [false, true]);
ok('빈 폼 오류 메시지에 원금·금리', /대출원금/.test(txt('lrc-errors')) && /기준 금리/.test(txt('lrc-errors')) && /비교할 금리/.test(txt('lrc-errors')));
fill({ P: '100,000,000', a: '4.5', b: '7' });
eq('오류 후 입력하면 자동 재계산', [resultShown(), errShown()], [true, false]);

// ── 새로고침(bfcache) 초기화 ──
const ev = new w.Event('pageshow'); ev.persisted = true; w.dispatchEvent(ev);
eq('bfcache 복귀 → 입력·결과 초기화', [resultShown(), $('lrc-principal').value, $('lrc-base-rate').value, $('lrc-term').value, txt('res-total')], [false, '', '', '5', '']);

// ── 신용점수·제외비용 안내문 (페이지 고정) ──
const page = d.body.textContent;
ok('TEST 25(안내) 신용점수 안내문', page.includes('신용점수는 대출금리에 영향을 줄 수 있는 여러 요소 중 하나입니다.') && page.includes('실제 금융사에서 확인한 금리를 입력해 비교하는 용도로 사용하세요.'));
ok('TEST 26(안내) 고정 연이율 가정 문구', page.includes('본 계산은 입력한 고정 연이율이 상환기간 동안 유지된다는 가정의 단순 비교입니다.'));
ok('TEST 29(안내) 일할이자 문구', page.includes('실제 금융기관 상환금액은 대출 실행일, 납입일, 일할이자 계산방식 등에 따라 일부 차이가 날 수 있습니다.'));
ok('TEST 77(안내) 결과 하단 안내문', page.includes('본 계산기는 입력한 금리가 전체 대출기간 동안 변하지 않는다는 가정으로 계산한 참고용 결과입니다.'));
ok('SEO: 점수→금리 약속 문구 없음', !/신용점수 \d+점|점수만으로 금리를|점수별 금리표/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));

console.log(`\nUI 테스트: ${pass + fail}건 / 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
