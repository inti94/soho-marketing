// 연차·연차수당 계산 엔진 자동 테스트 — 명세 TEST 1~50(엔진으로 검증 가능한 항목) + 날짜 경계·입력 방어
// 실행: node scripts/tests/annual-leave-test.cjs [engine.js 경로]
// UI 전용 항목(TEST 11·22·42~47 상태 전환)은 annual-leave-ui-test.cjs, TEST 49 날짜 무작위 검산은 annual-leave-crosscheck.cjs.
const path = require('path');
const L = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../../assets/annual-leave-2026.js'));

let pass = 0, fail = 0, curFail = 0;
const eq = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (ok) pass++; else { fail++; curFail++; console.log(`  FAIL ${name}  got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`); }
};
const test = (name, fn) => { curFail = 0; fn(); console.log(`TEST ${name}: ${curFail ? '실패' : '통과'}`); };
const near = (a, b, tol = 0.005) => Math.abs(a - b) < tol;

const BASE = { hireDate: '', baseDate: '', size: 'ge5', workerType: 'full', weeklyHours: '40', dailyHours: '8',
  fullTimeWeeklyHours: '40', attendance: '', fullMonths: '', used: '0', expired: '0', monthlyWage: '2,500,000', baseHours: '209' };
const run = o => {
  const res = L.validateAnnualLeaveInputs(Object.assign({}, BASE, o));
  const r = res.values ? L.calculateAnnualLeave(res.values) : null;
  const s = JSON.stringify({ res, r });
  if (/NaN|Infinity/.test(s) || (r && Object.values(r).some(x => typeof x === 'number' && (!isFinite(x) || x < 0)))) { fail++; console.log('  FAIL NaN/Infinity/음수 노출', s); }
  return { errors: res.errors, v: res.values, r };
};
const PART = { workerType: 'part', weeklyHours: '20', fullTimeWeeklyHours: '40', monthlyWage: '1,200,000', baseHours: '104' };
const years = (n, extra) => run(Object.assign({ hireDate: `${2026 - n}-03-15`, baseDate: '2026-03-15', attendance: 'ge80' }, extra));
const ONE = { hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80' };

test('1 (1년 미만 개근3·사용1 → 191,388원)', () => {
  const { r } = run({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '3', used: '1' });
  eq('발생·사용·소멸·남음', [r.days, r.usedDays, r.expiredDays, r.remainingDays], [3, 1, 0, 2]);
  eq('통상시급 ≈ 11,961.72', near(r.hourly, 11961.72), true);
  eq('1일 가치 ≈ 95,693.78', near(r.dailyValue, 95693.78), true);
  eq('수당 191,388원', r.pay, 191388);
});
test('2 (1주년 당일 15일, 26일 아님)', () => { const { r } = run({ hireDate: '2025-09-29', baseDate: '2026-09-29', attendance: 'ge80' }); eq('완료 1년·15일', [r.completedYears, r.days], [1, 15]); });
test('3 (2년 15일)', () => { eq('날짜', years(2).r.days, 15); eq('함수', L.calculateAnnualLeaveDays(2), 15); });
test('4 (3년 16일)', () => { eq('날짜', years(3).r.days, 16); eq('함수', L.calculateAnnualLeaveDays(3), 16); });
test('5 (4년 16일)', () => { eq('날짜', years(4).r.days, 16); });
test('6 (5년 17일)', () => { eq('날짜', years(5).r.days, 17); });
test('7 (장기근속 전체표)', () => {
  const T = { 1: 15, 2: 15, 3: 16, 4: 16, 5: 17, 6: 17, 7: 18, 8: 18, 9: 19, 10: 19, 11: 20, 12: 20, 13: 21, 14: 21, 15: 22, 16: 22, 17: 23, 18: 23, 19: 24, 20: 24, 21: 25, 22: 25, 30: 25 };
  for (const [y, d] of Object.entries(T)) { eq(`${y}년 함수`, L.calculateAnnualLeaveDays(+y), d); eq(`${y}년 날짜`, years(+y).r.days, d); }
  for (let y = 1; y <= 80; y++) if (L.calculateAnnualLeaveDays(y) > 25) eq(`${y}년 25 초과`, L.calculateAnnualLeaveDays(y), 25);
});
test('8 (21년 25일)', () => { eq('21년', years(21).r.days, 25); });
test('9 (30년 25일)', () => { eq('30년', years(30).r.days, 25); });
test('10 (3년·80% 미만·개근7 → 7일)', () => { const { r } = years(3, { attendance: 'lt80', fullMonths: '7' }); eq('7일·가산0·방식', [r.days, r.bonus, r.basis], [7, 0, 'lowAttendance']); });
test('11 (80% 이상↔미만 방식 전환, 엔진)', () => {
  eq('이상 → 16', years(3, { attendance: 'ge80', fullMonths: '7' }).r.days, 16);
  eq('미만 → 7', years(3, { attendance: 'lt80', fullMonths: '7' }).r.days, 7);
  eq('이상이면 개근월 무시', years(3, { attendance: 'ge80', fullMonths: '' }).r.days, 16);
});
test('12 (5인 미만 → 중단, 0일 단정 없음)', () => {
  const x = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', size: 'lt5' });
  eq('상태', [x.errors, x.r.status], [[], 'excluded5']); eq('일수·금액 없음', [x.r.days, x.r.pay], [undefined, undefined]);
  eq('근로시간 미입력이어도 판정', run({ hireDate: '2023-01-01', baseDate: '2026-06-01', size: 'lt5', weeklyHours: '' }).r.status, 'excluded5');
});
test('13 (주14시간 제외)', () => { const { r } = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', weeklyHours: '14', attendance: 'ge80' }); eq('제외·일수 없음', [r.status, r.days], ['excluded15', undefined]); });
test('14 (주15시간 적용)', () => { const { r } = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', weeklyHours: '15', attendance: 'ge80' }); eq('적용·16일', [r.status, r.days], ['ok', 16]); });
test('15 (단시간 20/40 → 60시간)', () => {
  const { r } = run(Object.assign({}, ONE, PART)); eq('15일 상당·60시간', [r.days, r.hours], [15, 60]);
  eq('공식', L.calculatePartTimeLeaveHours(15, 20, 40), 60);
});
test('16 (단시간 60−8−0=52 → 600,000원)', () => { const { r } = run(Object.assign({}, ONE, PART, { used: '8' })); eq('남음·수당', [r.remainingHours, r.pay], [52, 600000]); });
test('17 (1주년 전날 개근11 → 11일)', () => {
  const x = run({ hireDate: '2025-09-29', baseDate: '2026-09-28', fullMonths: '11' });
  eq('0년·최대11·11일', [x.r.completedYears, x.r.maxFirstYearMonths, x.r.days], [0, 11, 11]);
});
test('18 (1주년 당일 80% 이상 → 15일)', () => { eq('15일', run({ hireDate: '2025-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r.days, 15); });
test('19 (3주년 전날 15·당일 16)', () => {
  eq('전날', run({ hireDate: '2023-09-29', baseDate: '2026-09-28', attendance: 'ge80' }).r.days, 15);
  eq('당일', run({ hireDate: '2023-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r.days, 16);
});
test('20 (사용16 > 발생15 → 오류)', () => {
  const x = run(Object.assign({}, ONE, { used: '16' }));
  eq('차단·문구', [x.r, x.errors], [null, ['사용한 연차가 현재 계산된 발생 연차보다 많습니다. 입력값 또는 전년도 이월연차 여부를 확인해주세요.']]);
});
test('21 (15−10−0=5 → 478,469원)', () => { const { r } = run(Object.assign({}, ONE, { used: '10' })); eq('남음·수당', [r.remainingDays, r.pay], [5, 478469]); });
test('22 (1주년 전날 11 → 당일 15, 엔진)', () => {
  eq('전날 11', run({ hireDate: '2025-09-29', baseDate: '2026-09-28', fullMonths: '11' }).r.days, 11);
  eq('당일·출근율 미선택 → 계산 안 함', run({ hireDate: '2025-09-29', baseDate: '2026-09-29', fullMonths: '11' }).r, null);
  eq('당일 80% 이상 → 15(개근월 11 무시)', run({ hireDate: '2025-09-29', baseDate: '2026-09-29', fullMonths: '11', attendance: 'ge80' }).r.days, 15);
});
test('23 (3년·80% 미만·개근7 → 7일, 가산 없음)', () => { const { r } = years(3, { attendance: 'lt80', fullMonths: '7' }); eq('7일', [r.days, r.bonus], [7, 0]); });
test('24 (14.99 제외 / 15 적용)', () => {
  const o = { hireDate: '2023-01-01', baseDate: '2026-06-01', attendance: 'ge80' };
  eq('14.99', run(Object.assign({ weeklyHours: '14.99' }, o)).r.status, 'excluded15');
  eq('15', run(Object.assign({ weeklyHours: '15' }, o)).r.status, 'ok');
  eq('15.00', run(Object.assign({ weeklyHours: '15.00' }, o)).r.status, 'ok');
});
test('25 (5인 미만 제외 / 5인 이상 정상)', () => {
  const o = { hireDate: '2023-01-01', baseDate: '2026-06-01', attendance: 'ge80' };
  eq('미만', run(Object.assign({ size: 'lt5' }, o)).r.status, 'excluded5');
  eq('이상', run(Object.assign({ size: 'ge5' }, o)).r.status, 'ok');
  eq('미선택 오류', run(Object.assign({ size: '' }, o)).r, null);
});
test('26 (사용16 > 15 → 오류)', () => { const x = run(Object.assign({}, ONE, { used: '16' })); eq('차단', [x.r, x.errors.length], [null, 1]); });
test('27 (기준시간 0 → 차단)', () => { const x = run(Object.assign({}, ONE, { baseHours: '0' })); eq('차단·문구', [x.r, x.errors], [null, ['월 통상임금 산정 기준시간은(는) 0보다 커야 합니다.']]); });
test('28 (단시간 전체 → 600,000원)', () => {
  const { r } = run(Object.assign({}, ONE, PART, { used: '8' }));
  eq('15일 상당·60·8·0·52', [r.days, r.hours, r.usedHours, r.expiredHours, r.remainingHours], [15, 60, 8, 0, 52]);
  eq('시급·수당', [near(r.hourly, 11538.46), r.pay], [true, 600000]);
});
test('29 (80% 미만 + 개근12 → 모순 오류)', () => {
  const x = years(3, { attendance: 'lt80', fullMonths: '12' });
  eq('차단·문구', [x.r, x.errors], [null, ['12개월 모두 개근한 경우 출근율 80% 미만과 동시에 선택할 수 없습니다. 입력값을 다시 확인해주세요.']]);
});
test('30 (80% 미만 + 개근11 → 허용·11일)', () => { const x = years(3, { attendance: 'lt80', fullMonths: '11' }); eq('허용', [x.errors, x.r.days], [[], 11]); });
test('31 (1/31 입사: 2/28 권리 전, 3/1 1일)', () => {
  const a = run({ hireDate: '2026-01-31', baseDate: '2026-02-28', fullMonths: '1' });
  eq('2/28 끝난 구간 0 → 개근1 입력 거부', [a.r, a.errors], [null, ['현재 날짜 기준으로 개근 가능한 최대 개월 수를 초과했습니다. (최대 0개월)']]);
  eq('2/28 개근0 → 0일', run({ hireDate: '2026-01-31', baseDate: '2026-02-28', fullMonths: '0' }).r.days, 0);
  const b = run({ hireDate: '2026-01-31', baseDate: '2026-03-01', fullMonths: '1' });
  eq('3/1 최대1·1일', [b.r.maxFirstYearMonths, b.r.days], [1, 1]);
  eq('첫 권리 발생일 3/1', L.getAnniversaryDate(L.parseDate('2026-01-31'), 1), { y: 2026, m: 3, d: 1 });
});
test('32 (2/29 입사: 2025-02-28 권리 전, 3/1 15일)', () => {
  const a = run({ hireDate: '2024-02-29', baseDate: '2025-02-28', fullMonths: '11' });
  eq('2/28 아직 1년 미만(11일)', [a.r.completedYears, a.r.days], [0, 11]);
  const b = run({ hireDate: '2024-02-29', baseDate: '2025-03-01', attendance: 'ge80' });
  eq('3/1 1년·15일', [b.r.completedYears, b.r.days], [1, 15]);
  eq('1년 권리 발생일 2025-03-01', L.getAnniversaryDate(L.parseDate('2024-02-29'), 12), { y: 2025, m: 3, d: 1 });
});
test('33 (소멸: 7−2−1=4)', () => { const { r } = years(3, { attendance: 'lt80', fullMonths: '7', used: '2', expired: '1' }); eq('발생·사용·소멸·남음', [r.days, r.usedDays, r.expiredDays, r.remainingDays], [7, 2, 1, 4]); });
test('34 (사용5+소멸3 > 7 → 오류)', () => {
  const x = years(3, { attendance: 'lt80', fullMonths: '7', used: '5', expired: '3' });
  eq('차단·합계 문구', [x.r, x.errors], [null, ['사용한 연차와 소멸·정산된 연차의 합계가 현재 발생 연차보다 많습니다. 입력값 또는 전년도 이월연차 여부를 확인해주세요.']]);
  eq('합계가 딱 같으면 허용(0일)', years(3, { attendance: 'lt80', fullMonths: '7', used: '4', expired: '3' }).r.remainingDays, 0);
  const p = run(Object.assign({}, ONE, PART, { used: '50', expired: '11' }));
  eq('단시간 시간 합계 초과 문구', p.errors, ['사용한 연차시간과 소멸·정산된 연차시간의 합계가 현재 발생 연차시간보다 많습니다. 입력값 또는 전년도 이월연차 여부를 확인해주세요.']);
});
test('35 (단시간 3년: 16×20÷40×8=64)', () => { const { r } = run(Object.assign({ hireDate: '2023-03-15', baseDate: '2026-03-15', attendance: 'ge80' }, PART)); eq('16일 상당·64시간', [r.days, r.hours], [16, 64]); });
test('36 (단시간 17.5시간: 52.5 → 53)', () => {
  eq('함수', L.calculatePartTimeLeaveHours(15, 17.5, 40), 53);
  eq('전체 계산', run(Object.assign({}, ONE, PART, { weeklyHours: '17.5' })).r.hours, 53);
  eq('roundLeaveHours(52.5)', L.roundLeaveHours(52.5), 53);
  eq('부동소수 오차로 +1시간 안 함', L.roundLeaveHours(60.0000000001), 60);
});
test('37 (11일 → 1,052,632원)', () => { const { r } = years(3, { used: '5' }); eq('11일·수당', [r.remainingDays, r.pay], [11, 1052632]); eq('반올림 전', near(r.payRaw, 1052631.5789), true); });
test('38 (월 통상임금 빈값 → 계산 금지)', () => { const x = run(Object.assign({}, ONE, { monthlyWage: '' })); eq('차단·문구', [x.r, x.errors], [null, ['월 통상임금을(를) 입력하세요.']]); });
test('39 (출근율 모름 → 확정값 없음·80% 이상 예상값만)', () => {
  const { r } = years(5, { attendance: 'unknown', used: '', monthlyWage: '' });
  eq('상태·확정값 없음·예상 17', [r.status, r.days, r.pay, r.estimateDays], ['unknownAttendance', undefined, undefined, 17]);
});
test('40 (상시근로자 모름 → 확인 필요)', () => {
  const x = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', size: 'unknown', attendance: 'ge80' });
  eq('상태·일수 없음', [x.errors, x.r.status, x.r.days, x.r.pay], [[], 'sizeUnknown', undefined, undefined]);
});
test('41 (첫해 11 후 1주년 → 15, 26 아님)', () => {
  const a = run({ hireDate: '2025-06-10', baseDate: '2026-06-09', fullMonths: '11' }), b = run({ hireDate: '2025-06-10', baseDate: '2026-06-10', fullMonths: '11', attendance: 'ge80' });
  eq('전날 11 → 당일 15', [a.r.days, b.r.days], [11, 15]);
});
test('42 (소멸 2 → 0: 남음 8 → 10, 엔진)', () => {
  eq('소멸2', years(3, { used: '5', expired: '2', hireDate: '2025-03-15' }).r.remainingDays, 8);
  eq('소멸0', years(3, { used: '5', expired: '0', hireDate: '2025-03-15' }).r.remainingDays, 10);
});
test('48 (날짜 역전 → 오류)', () => { const x = run({ hireDate: '2026-10-01', baseDate: '2026-09-29' }); eq('차단·문구', [x.r, x.errors], [null, ['계산 기준일이 입사일보다 빠릅니다. 날짜를 확인하세요.']]); });
test('50 (숫자 입력 방어)', () => {
  for (const [f, val] of [['monthlyWage', ''], ['monthlyWage', 'abc'], ['monthlyWage', '-100'], ['monthlyWage', '0'], ['monthlyWage', '999,999,999,999'], ['monthlyWage', 'NaN'], ['monthlyWage', 'Infinity'], ['monthlyWage', null], ['monthlyWage', undefined],
    ['baseHours', ''], ['baseHours', 'x'], ['baseHours', '-1'], ['baseHours', '100000'], ['weeklyHours', '-5'], ['weeklyHours', '0'], ['weeklyHours', '41'], ['weeklyHours', 'abc'],
    ['dailyHours', '0'], ['dailyHours', '9'], ['used', '-1'], ['used', '1e3'], ['used', 'x'], ['expired', '-1'], ['expired', ''], ['expired', 'abc']]) {
    const x = run(Object.assign({}, ONE, { [f]: val }));
    eq(`${f}=${val} 차단`, [x.r, x.errors.length > 0, x.errors.every(s => typeof s === 'string' && !/NaN|Infinity|undefined|null/.test(s))], [null, true, true]);
  }
  eq('콤마 금액 허용', run(Object.assign({}, ONE, { monthlyWage: '2,500,000', used: '10' })).r.pay, 478469);
  eq('통상근로자 주시간 0 차단', run(Object.assign({}, ONE, PART, { fullTimeWeeklyHours: '0' })).r, null);
  eq('개근월 음수·소수 차단', [run({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '-1' }).r, run({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '2.5' }).r], [null, null]);
});

// ── 날짜 경계(달력 기준) ──
console.log('--- 날짜 경계·추가');
const P = s => L.parseDate(s), Y = (h, b) => L.calculateCompletedYears(P(h), P(b)), M = (h, b) => L.calculateCompletedMonthlyPeriods(P(h), P(b));
eq('6/20 입사: 7/19 0구간, 7/20 1구간', [M('2026-06-20', '2026-07-19'), M('2026-06-20', '2026-07-20')], [0, 1]);
eq('1/31 입사 → 3/30 1, 3/31 2', [M('2026-01-31', '2026-03-30'), M('2026-01-31', '2026-03-31')], [1, 2]);
eq('1/31 입사 → 4/30 2, 5/1 3(4월 31일 없음)', [M('2026-01-31', '2026-04-30'), M('2026-01-31', '2026-05-01')], [2, 3]);
eq('1/30 입사(평년) → 2/28 0, 3/1 1', [M('2026-01-30', '2026-02-28'), M('2026-01-30', '2026-03-01')], [0, 1]);
eq('1/29 입사(윤년 2028) → 2/28 0, 2/29 1', [M('2028-01-29', '2028-02-28'), M('2028-01-29', '2028-02-29')], [0, 1]);
eq('2/29 입사 → 윤년 2028-02-28 3년, 2/29 4년', [Y('2024-02-29', '2028-02-28'), Y('2024-02-29', '2028-02-29')], [3, 4]);
eq('21주년 전날 24 / 당일 25', [run({ hireDate: '2005-09-29', baseDate: '2026-09-28', attendance: 'ge80' }).r.days, run({ hireDate: '2005-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r.days], [24, 25]);
eq('12/31 입사 → 12/30 0년, 12/31 1년', [Y('2025-12-31', '2026-12-30'), Y('2025-12-31', '2026-12-31')], [0, 1]);
eq('입사 당일 0년·0구간', [Y('2026-05-05', '2026-05-05'), M('2026-05-05', '2026-05-05')], [0, 0]);
eq('5개월 시점 개근 8 거부', run({ hireDate: '2026-01-10', baseDate: '2026-06-10', fullMonths: '8' }).errors, ['현재 날짜 기준으로 개근 가능한 최대 개월 수를 초과했습니다. (최대 5개월)']);
eq('없는 날짜(2/30) 거부', run({ hireDate: '2026-02-30', baseDate: '2026-05-04' }).errors[0], '입사일을 입력하세요.');
eq('validateDates 단독', L.validateDates('2026-10-01', '2026-09-29').errors, ['계산 기준일이 입사일보다 빠릅니다. 날짜를 확인하세요.']);
eq('반차 0.5 사용 → 14.5', run(Object.assign({}, ONE, { used: '0.5' })).r.remainingDays, 14.5);
eq('반차 사용 0.5 + 소멸 0.5 → 14', run(Object.assign({}, ONE, { used: '0.5', expired: '0.5' })).r.remainingDays, 14);
eq('1년 미만 단시간 3개월 20/40 → 12시간', run(Object.assign({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '3' }, PART)).r.hours, 12);
eq('단시간이 통상근로자 이상 시간이면 거부', run(Object.assign({}, ONE, PART, { weeklyHours: '40' })).r, null);
eq('5인 모름은 근로시간 무관하게 확인 필요', run({ hireDate: '2023-01-01', baseDate: '2026-06-01', size: 'unknown', weeklyHours: '10' }).r.status, 'sizeUnknown');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
