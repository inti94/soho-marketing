// 연차·연차수당 계산기 UI 자동 테스트 — 실제 페이지 + 실제 스크립트를 jsdom에서 실행
// 실행: NODE_PATH=<jsdom 설치 경로> node scripts/tests/annual-leave-ui-test.cjs [page.html] [engine.js] [sohotip.js]
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '../../');
const html = fs.readFileSync(process.argv[2] || ROOT + 'annual-leave-calc.html', 'utf8');
const engine = fs.readFileSync(process.argv[3] || ROOT + 'assets/annual-leave-2026.js', 'utf8');
const sohotip = fs.readFileSync(process.argv[4] || ROOT + 'sohotip.js', 'utf8');

async function boot() {
  const stripped = html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const inline = [...stripped.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.includes('AnnualLeave2026'))[0];
  const dom = new JSDOM(stripped.replace(/<script>[\s\S]*?<\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.alert = m => { throw new Error('alert: ' + m); };
  try { w.eval(sohotip); } catch (e) {}
  w.eval(engine); w.eval(inline);
  // 실제 브라우저처럼 DOMContentLoaded 이후 상태(금액 콤마 포맷 등 바인딩 완료)에서 테스트한다
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r));
  return w;
}
(async () => {
let w = await boot(), d = w.document;
let pass = 0, fail = 0;
const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : `  got=${JSON.stringify(g)} exp=${JSON.stringify(e)}`)); };
const $ = id => d.getElementById(id);
const type = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
const pick = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
const click = id => $(id).click();
const vis = id => { let e = $(id); while (e) { if (e.style && e.style.display === 'none') return false; e = e.parentElement; } return true; };
const txt = id => $(id).textContent;
const rows = () => [...$('al-rows').querySelectorAll('.breakdown-row')].map(r => [...r.children].map(c => c.textContent.trim()).join(' '));
const rowVal = label => { const r = [...$('al-rows').querySelectorAll('.breakdown-row')].find(x => x.children[0].textContent.trim() === label); return r ? r.children[1].textContent.trim() : null; };
const clean = () => !/NaN|Infinity|undefined|null/.test(txt('result-section') + txt('al-errors'));
const errShown = () => $('al-errors').classList.contains('show');
const blocked = () => $('al-blocked').classList.contains('show') && vis('al-blocked');
async function fresh() { w = await boot(); d = w.document; }
function fill(o) {   // 순서: 날짜 → 규모 → 형태 → 시간 → 출근율 → 개근월 → 나머지
  if (o.hire != null) pick('al-hire', o.hire);
  if (o.base != null) pick('al-base', o.base);
  if (o.size != null) pick('al-size', o.size);
  if (o.part) click('al-type-part');
  if (o.weekly != null) type('al-weekly', o.weekly);
  if (o.ft != null) type('al-ftweekly', o.ft);
  if (o.daily != null) type('al-daily', o.daily);
  if (o.att != null) pick('al-att', o.att);
  if (o.months != null) type('al-months', o.months);
  if (o.used != null) type('al-used', o.used);
  if (o.wage != null) type('al-wage', o.wage);
  if (o.bh != null) type('al-base-hours', o.bh);
}

// ── 초기 상태 ──
const t = new Date(); const todayStr = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
eq('초기: 결과 숨김', vis('result-section'), false);
eq('초기: 기준일 = 오늘', $('al-base').value, todayStr);
eq('초기: 일반근로자 선택·1일 시간 표시·통상근로자 시간 숨김', [$('al-type-full').textContent, $('al-type-full').classList.contains('active'), vis('al-daily-field'), vis('al-ftweekly-field')], ['일반근로자', true, true, false]);
eq('초기: 출근율·개근월 숨김', [vis('al-att-field'), vis('al-months-field')], [false, false]);
eq('초기: 기본값 40·8·209·0·0', [$('al-weekly').value, $('al-daily').value, $('al-base-hours').value, $('al-used').value, $('al-expired').value], ['40', '8', '209', '0', '0']);
eq('초기: 상시근로자 질문·잘 모르겠어요 선택지', [d.querySelector('label[for="al-size"]').textContent, [...$('al-size').options].map(o => o.value)], ['근로기준법상 상시근로자 5인 이상 사업장인가요?', ['', 'ge5', 'lt5', 'unknown']]);
click('al-calc-btn');
eq('빈값 → 오류·결과 없음', [errShown(), vis('result-section')], [true, false]);
eq('빈값 오류에 NaN 등 없음', clean(), true);

// ── TEST 1 ──
await fresh();
fill({ hire: '2026-01-10', base: '2026-04-10', size: 'ge5' });
eq('T1 개근월 질문(1년 미만 문구)·출근율 숨김', [vis('al-months-field'), txt('al-months-label'), vis('al-att-field')], [true, '입사일부터 현재까지 개근한 1개월 구간은 몇 개월인가요?', false]);
eq('T1 최대 개근월 안내 3개월', txt('al-months-hint').startsWith('날짜상 끝난 1개월 구간은 3개월입니다'), true);
fill({ months: '3', used: '1', wage: '2500000' }); click('al-calc-btn');
eq('T1 콤마 자동', $('al-wage').value, '2,500,000');
eq('T1 발생 3일', txt('res-total'), '3일');
eq('T1 행', [rowVal('현재 발생 연차'), rowVal('이미 사용한 연차'), rowVal('남은 연차'), rowVal('통상시급'), rowVal('연차 1일 예상 가치'), rowVal('통상임금 기준 예상 미사용 연차수당')],
  ['3일', '1일', '2일', '약 11,962원', '약 95,694원', '약 191,388원']);
eq('T1 NaN 없음', clean(), true);
type('al-months', '4');
eq('개근월 날짜상 최대 초과(4) → 오류·결과 숨김', [errShown(), vis('result-section'), txt('al-errors').includes('3개월')], [true, false, true]);
type('al-months', '3');
eq('정상값 복귀 → 재계산', [vis('result-section'), txt('res-total')], [true, '3일']);

// ── TEST 17 → 18 → 22: 입사기념일 전날 → 당일 (상태변경 9) ──
await fresh();
fill({ hire: '2025-09-29', base: '2026-09-28', size: 'ge5', months: '11', wage: '2,500,000' }); click('al-calc-btn');
eq('T17 전날: 1년 미만 11일', [txt('res-total'), rowVal('근속')], ['11일', '1년 미만 (날짜상 끝난 1개월 구간 11개월)']);
pick('al-base', '2026-09-29');
eq('T22 당일: 개근월 질문 숨김·값 삭제', [vis('al-months-field'), $('al-months').value], [false, '']);
eq('T22 당일: 출근율 질문 표시', vis('al-att-field'), true);
eq('T22 출근율 미선택 → 이전 11일 결과 숨김·비움', [vis('result-section'), txt('res-total'), txt('al-rows')], [false, '', '']);
pick('al-att', 'ge80');
eq('T18/T22 당일 80% 이상 → 15일', [txt('res-total'), rowVal('근속'), rowVal('현재 발생 연차')], ['15일', '완료 근속 1년', '15일']);
eq('T22 11일·26일 흔적 없음', /11일|26일/.test(txt('al-rows') + txt('res-total') + txt('res-sub')), false);
pick('al-base', '2026-09-28');
eq('다시 전날로: 출근율 숨김·값 삭제, 개근월 빈칸', [vis('al-att-field'), $('al-att').value, vis('al-months-field'), $('al-months').value], [false, '', true, '']);
eq('다시 전날로: 개근월 미입력 → 결과 숨김', vis('result-section'), false);

// ── TEST 19 ──
await fresh();
fill({ hire: '2023-09-29', base: '2026-09-28', size: 'ge5', att: 'ge80', wage: '2,500,000' }); click('al-calc-btn');
eq('T19 전날 2년·15일', [rowVal('근속'), txt('res-total')], ['완료 근속 2년', '15일']);
pick('al-base', '2026-09-29');
eq('T19 당일 3년·16일', [rowVal('근속'), txt('res-total')], ['완료 근속 3년', '16일']);

// ── TEST 10/11/23: 80% 이상 ↔ 미만 (상태변경 1·2) ──
await fresh();
fill({ hire: '2023-03-15', base: '2026-03-15', size: 'ge5', att: 'ge80', used: '5', wage: '2,500,000' }); click('al-calc-btn');
eq('T4 3년 80% 이상 16일', txt('res-total'), '16일');
const steps = txt('al-steps');
eq('계산과정: 기본 15 + 가산 1 → 16', steps.includes('기본 15일 + 장기근속 가산 1일 → 16일'), true);
eq('계산과정: 16 − 5 = 11일', steps.includes('16 − 사용 5 − 소멸·정산 0 = 11일'), true);
eq('계산과정: 통상시급', steps.includes('2,500,000원 ÷ 209시간 = 11,961.72원 → 약 11,962원'), true);
eq('계산과정: 1일 가치(반올림 전 → 표시값)', steps.includes('11,961.72원 × 8시간 = 95,693.78원 → 약 95,694원'), true);
eq('계산과정: 수당(반올림 전 → 최종 반올림)', steps.includes('95,693.78원 × 11일 = 1,052,631.58원 → 최종 반올림 1,052,632원'), true);
eq('결과 행: 예상 수당 약 1,052,632원', rowVal('통상임금 기준 예상 미사용 연차수당'), '약 1,052,632원');
pick('al-att', 'lt80');
eq('상태1: 80% 미만 → 개근월 질문(직전 1년 문구)·빈칸', [vis('al-months-field'), txt('al-months-label'), $('al-months').value], [true, '직전 1년 중 개근한 월은 몇 개월인가요?', '']);
eq('상태1: 개근월 미입력 → 이전 16일 숨김', [vis('result-section'), txt('res-total')], [false, '']);
type('al-months', '7'); type('al-used', '0');
eq('T10/T23 80% 미만 7일(가산 없음)', [txt('res-total'), rowVal('현재 발생 연차')], ['7일', '7일']);
eq('T10 계산과정에 가산 없음', /가산 \d/.test(txt('al-steps')), false);
type('al-months', '13');
eq('80% 미만 개근월 13 → 오류', [errShown(), vis('result-section')], [true, false]);
type('al-months', '11');
eq('상태12/T30: 80% 미만 개근 11 → 허용·11일', [errShown(), txt('res-total')], [false, '11일']);
type('al-months', '12');
eq('상태12/T29: 개근 12 → 차단·모순 문구·이전 11일 숨김', [vis('result-section'), txt('al-errors').includes('12개월 모두 개근한 경우 출근율 80% 미만과 동시에 선택할 수 없습니다. 입력값을 다시 확인해주세요.'), txt('res-total')], [false, true, '']);
type('al-months', '11');
eq('상태12: 다시 11 → 11일·오류문구 사라짐', [txt('res-total'), errShown(), txt('al-errors')], ['11일', false, '']);
type('al-months', '7');
pick('al-att', 'ge80');
eq('상태2: 80% 이상 복귀 → 즉시 16일·개근월 숨김·삭제', [txt('res-total'), vis('al-months-field'), $('al-months').value], ['16일', false, '']);
pick('al-att', 'lt80');
eq('다시 80% 미만: 이전 개근월 7 재사용 안 함', $('al-months').value, '');
pick('al-att', 'unknown');
eq('출근율 모름 → 확정 결과 없음·안내', [blocked(), vis('al-result-body'), txt('al-blocked').includes('정확한 근태자료를 확인해주세요'), txt('al-blocked').includes('80% 이상일 경우 예상값: 근속 3년 기준 16일')], [true, false, true, true]);
eq('출근율 모름: 개근월 질문 숨김', vis('al-months-field'), false);
eq('출근율 모름: 이전 금액 잔존 없음', [txt('res-total'), txt('al-rows'), /원/.test(txt('al-blocked'))], ['', '', false]);
pick('al-att', 'ge80');
eq('모름 → 80% 이상 복귀 16일', [txt('res-total'), blocked()], ['16일', false]);

// ── T13/14/24: 주 15시간 경계 (상태변경 3·4) ──
type('al-weekly', '14');
eq('상태4/T13: 주14시간 → 적용 제외 안내·결과 숨김', [blocked(), txt('al-blocked').includes('15시간 미만인 근로자는 근로기준법상 연차유급휴가 규정이 적용되지 않습니다'), vis('al-result-body'), txt('res-total')], [true, true, false, '']);
type('al-weekly', '14.99');
eq('T24: 14.99 → 적용 제외', blocked(), true);
type('al-weekly', '15');
eq('상태3/T14: 15시간 → 정상 계산', [blocked(), txt('res-total')], [false, '16일']);
type('al-weekly', '14.99');
eq('상태4/T46: 정상 결과 후 15 → 14.99 → 결과 즉시 제거', [blocked(), vis('al-result-body'), txt('res-total'), txt('al-rows')], [true, false, '', '']);
type('al-weekly', '15');
eq('상태5: 14.99 → 15 → 정상 재계산', [blocked(), txt('res-total')], [false, '16일']);
type('al-weekly', '40');

// ── T12/25: 5인 경계 (상태변경 5·6) ──
pick('al-size', 'lt5');
eq('상태6/T12: 5인 미만 → 계산 중단 안내', [blocked(), txt('al-blocked').includes('상시근로자 5인 미만 사업장은 근로기준법 제60조에 따른 법정 연차유급휴가 의무 적용 대상이 아닙니다')], [true, true]);
eq('T12: 0일로 단정하지 않음·금액 없음', [/0일/.test(txt('result-section')), txt('res-total'), txt('al-rows')], [false, '', '']);
pick('al-size', 'ge5');
eq('상태5/T25: 5인 이상 → 정상 계산', [blocked(), txt('res-total')], [false, '16일']);

// ── T20/26: 사용연차 초과 (상태변경 10) ──
type('al-used', '17');
eq('상태10/T20: 사용 17 > 발생 16 → 차단·문구', [vis('result-section'), txt('al-errors').includes('사용한 연차가 현재 계산된 발생 연차보다 많습니다. 입력값 또는 전년도 이월연차 여부를 확인해주세요.')], [false, true]);
eq('T20: 음수 잔여 표시 없음', /-\d|−\d+일/.test(txt('res-total') + txt('al-rows')), false);
type('al-used', '16');
eq('사용 16 = 발생 16 → 남은 0일·0원', [rowVal('남은 연차'), rowVal('통상임금 기준 예상 미사용 연차수당')], ['0일', '0원']);
type('al-used', '0.5');
eq('반차 0.5 → 남은 15.5일', rowVal('남은 연차'), '15.5일');

// ── T27: 기준시간 209 → 0 → 209 (상태변경 11) ──
type('al-used', '5');
const before = rows();
type('al-base-hours', '0');
eq('상태11/T27: 0 → 차단·Infinity 없음', [vis('result-section'), errShown(), clean()], [false, true, true]);
type('al-base-hours', '209');
eq('상태11: 209 복귀 → 같은 결과', rows(), before);
type('al-wage', 'abc');
eq('문자만 입력 → 계산 안 함', [vis('result-section'), clean()], [false, true]);
type('al-wage', '2,500,000');

// ── 소멸·정산 (TEST 33·34·42, 상태변경 13) ──
await fresh();
fill({ hire: '2025-03-15', base: '2026-03-15', size: 'ge5', att: 'ge80', used: '5', wage: '2,500,000' }); type('al-expired', '2'); click('al-calc-btn');
eq('T42 소멸2: 15−5−2 = 남음 8', [rowVal('소멸·정산된 연차'), rowVal('남은 연차'), txt('al-steps').includes('15 − 사용 5 − 소멸·정산 2 = 8일')], ['2일', '8일', true]);
eq('적용 산정방식 표시', rowVal('적용 산정방식'), '1년 이상 · 출근율 80% 이상 · 15일 + 장기근속 가산');
type('al-expired', '0');
eq('T42 소멸 0으로 변경 → 남음 10(이전 8 잔존 없음)', [rowVal('남은 연차'), /8일/.test(rowVal('남은 연차'))], ['10일', false]);
type('al-expired', '11');
eq('상태13/T34: 사용5+소멸11 > 15 → 차단·합계 문구', [vis('result-section'), txt('al-errors').includes('사용한 연차와 소멸·정산된 연차의 합계가 현재 발생 연차보다 많습니다')], [false, true]);
type('al-expired', '1');
eq('소멸 정상 복귀 → 남음 9·오류 사라짐', [rowVal('남은 연차'), errShown()], ['9일', false]);
// 상태변경 16: 입사일 변경 → 근속·결과 즉시 갱신
pick('al-hire', '2023-03-15');
eq('상태16: 입사일 3년 전으로 → 16일·남음 10', [txt('res-total'), rowVal('근속'), rowVal('남은 연차')], ['16일', '완료 근속 3년', '10일']);
pick('al-hire', '2025-10-15');
eq('상태16: 1년 미만으로 → 출근율 숨김·개근월 질문·결과 숨김', [vis('al-att-field'), $('al-att').value, vis('al-months-field'), vis('result-section')], [false, '', true, false]);
// TEST 40: 상시근로자 모름
await fresh();
fill({ hire: '2023-03-15', base: '2026-03-15', size: 'ge5', att: 'ge80', wage: '2,500,000' }); click('al-calc-btn');
eq('정상 16일', txt('res-total'), '16일');
pick('al-size', 'unknown');
eq('T40: 상시근로자 모름 → 확인 필요·확정 결과 없음', [blocked(), txt('al-blocked').includes('상시근로자 수 확인 필요'), txt('res-total'), txt('al-rows'), /원/.test(txt('al-blocked'))], [true, true, '', '', false]);
pick('al-size', 'ge5');
eq('모름 → 5인 이상 복귀 16일', [blocked(), txt('res-total')], [false, '16일']);

// ── T15/16/28: 단시간근로자 (상태변경 7·8) ──
await fresh();
fill({ hire: '2025-03-15', base: '2026-03-15', size: 'ge5', att: 'ge80', used: '3', wage: '2,500,000' }); click('al-calc-btn');
eq('통상근로자 15일', txt('res-total'), '15일');
click('al-type-part');
eq('상태7: 단시간 → 통상근로자 시간 표시(40)·1일 시간 숨김', [vis('al-ftweekly-field'), $('al-ftweekly').value, vis('al-daily-field')], [true, '40', false]);
eq('상태7: 사용량 단위 시간·이전 일수 삭제', [txt('al-used-unit'), $('al-used').value], ['시간', '0']);
eq('상태7/T43: 소멸 단위 시간·기준시간 209 자동적용 안 함(빈칸)', [txt('al-expired-unit'), $('al-expired').value, $('al-base-hours').value, txt('al-base-hours-hint').includes('209시간을 그대로 쓰지 않습니다')], ['시간', '0', '', true]);
eq('T43: 일 단위 결과 잔존 없음', [vis('result-section'), txt('res-total'), rowVal('연차 1일 예상 가치')], [false, '', null]);
eq('상태7: 단시간이 통상근로자와 같은 40시간 → 오류', [errShown(), vis('result-section')], [true, false]);
type('al-weekly', '20'); type('al-used', '8'); type('al-wage', '1,200,000');
eq('단시간 기준시간 미입력 → 계산 안 함', [vis('result-section'), txt('al-errors').includes('월 통상임금 산정 기준시간을(를) 입력하세요.')], [false, true]);
type('al-base-hours', '104');
eq('T15/T28 60시간', [txt('res-total'), txt('res-sub').startsWith('법정 연차 15일 상당 / 실제 연차시간 60시간')], ['60시간', true]);
eq('단시간 소멸 시간 행 0시간', rowVal('소멸·정산된 연차시간'), '0시간');
eq('T16/T28 행', [rowVal('법정 연차일수 상당'), rowVal('실제 법정 연차시간'), rowVal('이미 사용한 연차시간'), rowVal('남은 연차시간'), rowVal('통상시급 (연차 1시간 가치)'), rowVal('통상임금 기준 예상 미사용 연차수당')],
  ['15일', '60시간', '8시간', '52시간', '약 11,538원', '600,000원']);
eq('T15 계산과정', txt('al-steps').includes('15일 × 주 20시간 ÷ 통상근로자 주 40시간 × 8시간 = 60시간 → 60시간'), true);
eq('일반근로자 전용 행 없음', [rowVal('연차 1일 예상 가치'), rowVal('현재 발생 연차')], [null, null]);
type('al-used', '61');
eq('사용시간 61 > 60 → 차단', [vis('result-section'), txt('al-errors').includes('사용한 연차시간이 현재 계산된 발생 연차시간보다 많습니다')], [false, true]);
type('al-used', '8');
type('al-weekly', '17.5');
eq('T36 1시간 미만 올림: 15×17.5/40×8=52.5 → 53시간', [txt('res-total'), txt('al-steps').includes('52.5시간 → 1시간 미만은 1시간으로 봄 → 53시간')], ['53시간', true]);
type('al-expired', '5');
eq('단시간 소멸 5시간 → 53−8−5=40', rowVal('남은 연차시간'), '40시간');
type('al-expired', '0');
type('al-weekly', '20');
type('al-ftweekly', '35');
eq('통상근로자 35시간 → 15×20/35×8=68.57 → 69시간', txt('res-total'), '69시간');
click('al-type-full');
eq('상태8: 통상근로자 복귀 → 단시간 값 초기화(40)·숨김, 1일 시간 8 표시', [vis('al-ftweekly-field'), $('al-ftweekly').value, vis('al-daily-field'), $('al-daily').value], [false, '40', true, '8']);
eq('상태8: 사용 시간 값 삭제(0일)·단위 일', [$('al-used').value, txt('al-used-unit')], ['0', '일']);
eq('상태8/T44: 기준시간 209 복귀·소멸 0일', [$('al-base-hours').value, $('al-expired').value, txt('al-expired-unit')], ['209', '0', '일']);
eq('상태8: 일 단위 결과·시간 결과 잔존 없음', [txt('res-total'), /시간\s*$/.test(txt('res-total')), rowVal('실제 법정 연차시간')], ['15일', false, null]);
click('al-type-part');
eq('다시 단시간: 이전 35시간 재사용 안 함', $('al-ftweekly').value, '40');

// ── 기준일 < 입사일 ──
await fresh();
fill({ hire: '2026-05-05', base: '2026-05-04', size: 'ge5', wage: '2,500,000' }); click('al-calc-btn');
eq('기준일 < 입사일 → 오류·질문 숨김', [errShown(), txt('al-errors').includes('계산 기준일이 입사일보다 빠릅니다'), vis('al-att-field'), vis('al-months-field')], [true, true, false, false]);

// ── 새로고침/뒤로가기 초기화 ──
await fresh();
fill({ hire: '2023-03-15', base: '2026-03-15', size: 'ge5', att: 'ge80', wage: '2,500,000' }); click('al-calc-btn');
eq('bfcache 전 결과 표시', vis('result-section'), true);
const ev = new w.Event('pageshow'); ev.persisted = true; w.dispatchEvent(ev);
eq('bfcache 복원 → 초기화', [vis('result-section'), $('al-hire').value, $('al-wage').value, $('al-size').value, txt('res-total')], [false, '', '', '', '']);

// ── 사이트 공통 입력 저장·복원(inline-calc.js)이 이 계산기 상태를 덮어쓰지 않는지 ──
// 실제 inline-calc.js·calc-map.js 를 실행하고, 이전 방문에서 저장된 값이 localStorage 에 있는 상황을 만든다.
async function bootWithPersist(pageHtml) {
  const stripped = pageHtml.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const inline = [...stripped.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(x => x.includes('AnnualLeave2026'))[0];
  const dom = new JSDOM(stripped.replace(/<script>[\s\S]*?<\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://sohotip.co.kr/annual-leave-calc.html' });
  const ww = dom.window;
  ww.HTMLElement.prototype.scrollIntoView = function () {};
  const saved = { 'al-weekly': '20', 'al-base-hours': '104', 'al-used': '5', 'al-att': 'ge80', 'al-months': '11', 'al-wage': '2,500,000', 'al-size': 'ge5', 'al-ftweekly': '35' };
  for (const [k, v] of Object.entries(saved)) ww.localStorage.setItem('sohotip_full_annual-leave-calc_' + k, v);
  try { ww.eval(sohotip); } catch (e) {}
  ww.eval(engine); ww.eval(inline);
  ww.eval(fs.readFileSync(ROOT + 'assets/calc-map.js', 'utf8'));
  ww.SohoCards = ww.SohoCards || {};
  ww.eval(fs.readFileSync(ROOT + 'assets/inline-calc.js', 'utf8'));
  if (ww.document.readyState === 'loading') await new Promise(r => ww.document.addEventListener('DOMContentLoaded', r));
  await new Promise(r => setTimeout(r, 50));
  return ww;
}
{
  const ww = await bootWithPersist(html), g = id => ww.document.getElementById(id).value;
  eq('저장값 복원 안 함(data-no-persist): 기본값 유지', [g('al-weekly'), g('al-base-hours'), g('al-used'), g('al-wage'), g('al-size'), g('al-ftweekly'), g('al-months'), g('al-att')], ['40', '209', '0', '', '', '40', '', '']);
  const ctl = await bootWithPersist(html.replace(' data-no-persist', ''));
  eq('대조군: 속성을 빼면 실제로 복원됨(테스트 유효성)', ctl.document.getElementById('al-base-hours').value, '104');
}

// ── 정적 문구 ──
eq('회계연도 안내 문구', d.body.textContent.includes('이 계산기는 입사일 기준으로 계산합니다. 회사가 회계연도 기준으로 연차를 운영하는 경우 입사 첫해 비례부여, 연도별 정산 방식 등에 따라 회사 시스템의 연차와 차이가 발생할 수 있습니다.'), true);
eq('연차사용촉진 안내 문구', d.body.textContent.includes('회사가 근로기준법상 연차사용촉진 절차를 적법하게 완료한 경우 미사용 연차에 대한 금전보상 의무가 발생하지 않을 수 있습니다.'), true);
eq('"확정액"·"받을 연차수당" 표현 없음', [d.body.textContent.includes('확정액'), d.body.textContent.includes('받을 연차수당'), d.body.textContent.includes('확정 연차수당')], [false, false, false]);
eq('지급시점 오인 방지 문구', d.body.textContent.replace(/\s+/g, ' ').includes('현재 남은 연차의 금전적 가치를 통상임금 기준으로 추정한 금액입니다. 실제 미사용 연차수당 지급 여부와 시점은 연차 사용기간 종료, 퇴직 여부, 회사 규정, 연차사용촉진 절차 등에 따라 달라질 수 있습니다.'), true);
eq('통상임금 방식만 계산 문구', d.body.textContent.includes('통상임금 방식만 계산'), true);
eq('통상임금 입력 도움말(기본급 ≠ 통상임금)', d.body.textContent.includes('통상임금은 기본급만 의미하지 않을 수 있습니다.'), true);
eq('상시근로자 안내 문구', d.body.textContent.includes('상시근로자 수는 오늘 출근한 사람 수나 단순 재직자 수와 반드시 같은 개념이 아닙니다. 법정 상시근로자 수 산정기준에 따라 판단해야 합니다.'), true);
eq('출근 간주기간 안내 문구', d.body.textContent.includes('업무상 재해로 휴업한 기간, 출산전후휴가·육아휴직 등 법에서 출근한 것으로 보는 기간이 있을 수 있으므로 회사의 공식 근태자료를 기준으로 확인해주세요.'), true);
eq('숫자 입력칸 키패드 속성(inputmode)', ['al-weekly', 'al-daily', 'al-ftweekly', 'al-months', 'al-used', 'al-expired', 'al-wage', 'al-base-hours'].map(id => $(id).getAttribute('inputmode')), ['decimal', 'decimal', 'decimal', 'numeric', 'decimal', 'decimal', 'numeric', 'decimal']);
eq('기타 안내 문구', d.body.textContent.replace(/s+/g, ' ').includes('본 계산기는 일반적인 법정 연차 기준에 따른 예상 계산입니다. 실제 연차 발생일수와 연차수당은 근로계약, 취업규칙, 회계연도 기준 운영, 출근율, 개근 여부, 단시간근로 형태, 연차사용촉진 여부 등에 따라 달라질 수 있습니다.'), true);
eq('209시간 안내 문구', d.body.textContent.includes('209시간은 일반적인 주40시간 근로형태에서 흔히 사용하는 값이며 모든 근로자에게 동일하지 않습니다.'), true);
const ld = [...d.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent));
const faq = ld.find(x => x['@type'] === 'FAQPage');
const visQ = [...d.querySelectorAll('.faq-q')].map(x => x.textContent.trim());
const visA = [...d.querySelectorAll('.faq-a')].map(x => x.textContent.trim());
eq('FAQ 스키마 = 화면 FAQ', [faq.mainEntity.map(q => q.name), faq.mainEntity.map(q => q.acceptedAnswer.text)], [visQ, visA]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
