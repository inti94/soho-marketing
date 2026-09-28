// 연차·연차수당 계산 엔진 자동 테스트 (TEST 1~30 + 날짜 경계·오류 입력)
// 실행: node scripts/tests/annual-leave-test.cjs [engine.js 경로]
const path = require('path');
const L = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../../assets/annual-leave-2026.js'));

let pass = 0, fail = 0, cur = null, curFail = 0;
const eq = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (ok) pass++; else { fail++; curFail++; console.log(`  FAIL ${name}  got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`); }
};
const test = (name, fn) => { cur = name; curFail = 0; fn(); console.log(`TEST ${name}: ${curFail ? '실패' : '통과'}`); };
const near = (a, b, tol = 0.005) => Math.abs(a - b) < tol;

const BASE = { hireDate: '', baseDate: '', size: 'ge5', workerType: 'full', weeklyHours: '40', dailyHours: '8',
  fullTimeWeeklyHours: '40', attendance: '', fullMonths: '', used: '0', monthlyWage: '2,500,000', baseHours: '209' };
const run = o => {
  const res = L.validateAnnualLeaveInputs(Object.assign({}, BASE, o));
  const r = res.values ? L.calculateAnnualLeave(res.values) : null;
  const s = JSON.stringify({ res, r });
  if (/NaN|Infinity/.test(s) || (r && Object.values(r).some(x => typeof x === 'number' && !isFinite(x)))) { fail++; console.log('  FAIL NaN/Infinity 노출', s); }
  return { errors: res.errors, v: res.values, r };
};
const PART = { workerType: 'part', weeklyHours: '20', fullTimeWeeklyHours: '40', monthlyWage: '1,200,000', baseHours: '104' };
const years = (n, extra) => run(Object.assign({ hireDate: `${2026 - n}-03-15`, baseDate: '2026-03-15', attendance: 'ge80' }, extra));

test('1', () => {
  const { r } = run({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '3', used: '1' });
  eq('발생', r.days, 3); eq('사용', r.usedDays, 1); eq('남음', r.remainingDays, 2);
  eq('통상시급 ≈ 11,961.72', near(r.hourly, 11961.72), true);
  eq('1일 가치 ≈ 95,693.78', near(r.dailyValue, 95693.78), true);
  eq('예상수당', r.pay, 191388);
});
test('2', () => {
  const { r } = run({ hireDate: '2025-09-29', baseDate: '2026-09-29', attendance: 'ge80' });
  eq('완료근속 1년', r.completedYears, 1); eq('15일(26일 아님)', r.days, 15);
});
test('3', () => { eq('2년 → 15', years(2).r.days, 15); eq('함수', L.calculateAnnualLeaveDays(2), 15); });
test('4', () => { eq('3년 → 16', years(3).r.days, 16); eq('함수', L.calculateAnnualLeaveDays(3), 16); });
test('5', () => { eq('4년 → 16', years(4).r.days, 16); eq('함수', L.calculateAnnualLeaveDays(4), 16); });
test('6', () => { eq('5년 → 17', years(5).r.days, 17); eq('함수', L.calculateAnnualLeaveDays(5), 17); });
test('7', () => {
  const T = { 1: 15, 2: 15, 3: 16, 4: 16, 5: 17, 6: 17, 7: 18, 8: 18, 9: 19, 10: 19, 11: 20, 12: 20, 13: 21, 14: 21, 15: 22, 17: 23, 19: 24, 21: 25, 23: 25, 30: 25 };
  for (const [y, d] of Object.entries(T)) { eq(`${y}년 함수`, L.calculateAnnualLeaveDays(+y), d); eq(`${y}년 날짜`, years(+y).r.days, d); }
});
test('8', () => { eq('21년 → 25', years(21).r.days, 25); });
test('9', () => {
  eq('30년 → 25', years(30).r.days, 25);
  for (let y = 1; y <= 60; y++) if (L.calculateAnnualLeaveDays(y) > 25) eq(`${y}년 25 초과`, L.calculateAnnualLeaveDays(y), 25);
});
test('10', () => {
  const { r } = years(3, { attendance: 'lt80', fullMonths: '7' });
  eq('7일', r.days, 7); eq('가산 0', r.bonus, 0); eq('방식', r.basis, 'lowAttendance');
});
test('11', () => {
  eq('80% 이상 → 16', years(3, { attendance: 'ge80', fullMonths: '7' }).r.days, 16);
  eq('80% 미만 → 7', years(3, { attendance: 'lt80', fullMonths: '7' }).r.days, 7);
  eq('80% 이상은 개근월 무시', years(3, { attendance: 'ge80', fullMonths: '' }).r.days, 16);
});
test('12', () => {
  const { r, errors } = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', size: 'lt5', attendance: 'ge80' });
  eq('오류 없음', errors, []); eq('적용 제외', r.status, 'excluded5');
  eq('0일로 단정하지 않음(일수 없음)', [r.days, r.pay], [undefined, undefined]);
  eq('5인 미만은 근로시간 미입력이어도 제외 판정', run({ hireDate: '2023-01-01', baseDate: '2026-06-01', size: 'lt5', weeklyHours: '' }).r.status, 'excluded5');
});
test('13', () => {
  const { r } = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', weeklyHours: '14', attendance: 'ge80' });
  eq('주14시간 적용 제외', r.status, 'excluded15'); eq('일수 없음', r.days, undefined);
});
test('14', () => {
  const { r } = run({ hireDate: '2023-01-01', baseDate: '2026-06-01', weeklyHours: '15', attendance: 'ge80' });
  eq('주15시간 적용', r.status, 'ok'); eq('3년 16일', r.days, 16);
});
test('15', () => {
  const { r } = run(Object.assign({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80' }, PART));
  eq('15일 상당', r.days, 15); eq('60시간', r.hours, 60);
  eq('공식', L.calculatePartTimeLeaveHours(15, 20, 40), 60);
});
test('16', () => {
  const { r } = run(Object.assign({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '8' }, PART));
  eq('남음 52', r.remainingHours, 52); eq('600,000원', r.pay, 600000);
});
test('17', () => {
  const ok = run({ hireDate: '2025-09-29', baseDate: '2026-09-28', fullMonths: '11' });
  eq('1년 미만', ok.r.completedYears, 0); eq('최대 개근월 11', ok.r.maxFirstYearMonths, 11); eq('11일', ok.r.days, 11);
  eq('12개월 입력 거부', run({ hireDate: '2025-09-29', baseDate: '2026-09-28', fullMonths: '12' }).r, null);
});
test('18', () => { eq('기준일 당일 → 15', run({ hireDate: '2025-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r.days, 15); });
test('19', () => {
  const a = run({ hireDate: '2023-09-29', baseDate: '2026-09-28', attendance: 'ge80' }).r;
  const b = run({ hireDate: '2023-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r;
  eq('전날: 2년·15일', [a.completedYears, a.days], [2, 15]); eq('당일: 3년·16일', [b.completedYears, b.days], [3, 16]);
});
test('20', () => {
  const x = run({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '17' });
  eq('계산 차단', x.r, null);
  eq('안내 문구', x.errors, ['사용한 연차가 현재 계산된 발생 연차보다 많습니다. 입력값 또는 전년도 이월연차 여부를 확인해주세요.']);
});
test('21', () => {
  const { r } = run({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '10' });
  eq('발생·사용·남음', [r.days, r.usedDays, r.remainingDays], [15, 10, 5]); eq('478,469원', r.pay, 478469);
});
test('22', () => {
  eq('전날 11일', run({ hireDate: '2025-09-29', baseDate: '2026-09-28', fullMonths: '11' }).r.days, 11);
  eq('당일·출근율 미선택 → 계산 안 함', run({ hireDate: '2025-09-29', baseDate: '2026-09-29', fullMonths: '11' }).r, null);
  const d = run({ hireDate: '2025-09-29', baseDate: '2026-09-29', fullMonths: '11', attendance: 'ge80' }).r;
  eq('당일 80% 이상 → 15(11 합산 없음)', d.days, 15);
});
test('23', () => {
  const { r } = years(3, { attendance: 'lt80', fullMonths: '7' });
  eq('7일(8·16 아님)', r.days, 7);
  eq('80% 미만 13개월 거부', years(3, { attendance: 'lt80', fullMonths: '13' }).r, null);
  eq('80% 미만 개근월 필수', years(3, { attendance: 'lt80', fullMonths: '' }).r, null);
});
test('24', () => {
  const o = { hireDate: '2023-01-01', baseDate: '2026-06-01', attendance: 'ge80' };
  eq('14.99 제외', run(Object.assign({ weeklyHours: '14.99' }, o)).r.status, 'excluded15');
  eq('15 대상', run(Object.assign({ weeklyHours: '15' }, o)).r.status, 'ok');
});
test('25', () => {
  const o = { hireDate: '2023-01-01', baseDate: '2026-06-01', attendance: 'ge80' };
  eq('5인 미만 제외', run(Object.assign({ size: 'lt5' }, o)).r.status, 'excluded5');
  eq('5인 이상 정상', run(Object.assign({ size: 'ge5' }, o)).r.status, 'ok');
  eq('규모 미선택 오류', run(Object.assign({ size: '' }, o)).r, null);
});
test('26', () => {
  const x = run({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '16' });
  eq('오류', [x.r, x.errors.length], [null, 1]);
  eq('단시간 시간 초과도 차단', run(Object.assign({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '61' }, PART)).r, null);
  eq('단시간 60시간 전부 사용은 허용', run(Object.assign({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '60' }, PART)).r.pay, 0);
});
test('27', () => {
  const x = run({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', baseHours: '0' });
  eq('계산 차단', x.r, null); eq('문구', x.errors, ['월 통상임금 산정 기준시간은(는) 0보다 커야 합니다.']);
});
test('28', () => {
  const { r } = run(Object.assign({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '8' }, PART));
  eq('15일 상당·60시간·사용8·남음52', [r.days, r.hours, r.usedHours, r.remainingHours], [15, 60, 8, 52]);
  eq('통상시급 ≈ 11,538.46', near(r.hourly, 11538.46), true); eq('600,000원', r.pay, 600000);
});

test('29', () => {
  const x = years(3, { attendance: 'lt80', fullMonths: '12' });
  eq('80% 미만 + 개근 12 → 차단', x.r, null);
  eq('모순 안내 문구', x.errors, ['12개월 모두 개근한 경우 출근율 80% 미만과 동시에 선택할 수 없습니다. 입력값을 다시 확인해주세요.']);
});
test('30', () => {
  const x = years(3, { attendance: 'lt80', fullMonths: '11' });
  eq('80% 미만 + 개근 11 → 허용·11일', [x.errors, x.r.days, x.r.bonus], [[], 11, 0]);
});

// ── 날짜 경계(달력 기준: 30일·365일 근사 금지) ──
console.log('--- 날짜 경계');
const P = s => L.parseDate(s), Y = (h, b) => L.calculateCompletedYears(P(h), P(b)), M = (h, b) => L.calculateCompletedMonthlyPeriods(P(h), P(b));
eq('6/20 입사: 7/19까지 0구간', M('2026-06-20', '2026-07-19'), 0);
eq('6/20 입사: 7/20(첫 1개월 근로 마친 다음 날) 1구간', M('2026-06-20', '2026-07-20'), 1);
eq('6/20 입사 1개월 권리 발생일 = 7/20', L.anniversary(P('2026-06-20'), 1), { y: 2026, m: 7, d: 20 });
eq('1/31 입사 → 3/1 첫 권리(2월 31일 없음)', L.anniversary(P('2026-01-31'), 1), { y: 2026, m: 3, d: 1 });
eq('1/31 입사 → 3/31 2구간', M('2026-01-31', '2026-03-31'), 2);
eq('1/31 입사 → 3/30 1구간', M('2026-01-31', '2026-03-30'), 1);
eq('1/31 입사 → 5/1(4월 31일 없음) 3구간', [M('2026-01-31', '2026-04-30'), M('2026-01-31', '2026-05-01')], [2, 3]);
eq('1/30 입사(평년 2월) → 2/28 0, 3/1 1', [M('2026-01-30', '2026-02-28'), M('2026-01-30', '2026-03-01')], [0, 1]);
eq('1/29 입사(윤년 2028) → 2/29 1구간', M('2028-01-29', '2028-02-29'), 1);
eq('2/29 입사 → 평년 2/28 0년, 3/1 1년', [Y('2024-02-29', '2025-02-28'), Y('2024-02-29', '2025-03-01')], [0, 1]);
eq('2/29 입사 → 윤년 2028-02-28 3년, 2/29 4년', [Y('2024-02-29', '2028-02-28'), Y('2024-02-29', '2028-02-29')], [3, 4]);
eq('2/29 입사 1년 미만 구간: 2025-02-28까지 11구간', M('2024-02-29', '2025-02-28'), 11);
eq('1주년 전날/당일', [Y('2025-09-29', '2026-09-28'), Y('2025-09-29', '2026-09-29')], [0, 1]);
eq('3주년 전날/당일 연차', [run({ hireDate: '2023-09-29', baseDate: '2026-09-28', attendance: 'ge80' }).r.days, run({ hireDate: '2023-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r.days], [15, 16]);
eq('21주년 전날/당일 연차(24 → 25)', [run({ hireDate: '2005-09-29', baseDate: '2026-09-28', attendance: 'ge80' }).r.days, run({ hireDate: '2005-09-29', baseDate: '2026-09-29', attendance: 'ge80' }).r.days], [24, 25]);
eq('12/31 입사 → 다음 해 12/31 1년', [Y('2025-12-31', '2026-12-30'), Y('2025-12-31', '2026-12-31')], [0, 1]);
eq('5개월 경과 시점 개근 8 입력 거부', run({ hireDate: '2026-01-10', baseDate: '2026-06-10', fullMonths: '8' }).errors, ['개근월은 입사일부터 계산 기준일까지 끝난 1개월 구간 수(5개월)보다 클 수 없습니다.']);

// ── 추가: 날짜 경계 ──
console.log('--- 추가 검증');
eq('월말 입사 1/31 → 2/28: 0개월', L.calculateCompletedMonthlyPeriods(L.parseDate('2026-01-31'), L.parseDate('2026-02-28')), 0);
eq('월말 입사 1/31 → 3/1: 1개월', L.calculateCompletedMonthlyPeriods(L.parseDate('2026-01-31'), L.parseDate('2026-03-01')), 1);
eq('윤일 입사 2024-02-29 → 2025-02-28: 0년', L.calculateCompletedYears(L.parseDate('2024-02-29'), L.parseDate('2025-02-28')), 0);
eq('윤일 입사 2024-02-29 → 2025-03-01: 1년', L.calculateCompletedYears(L.parseDate('2024-02-29'), L.parseDate('2025-03-01')), 1);
eq('입사 당일 기준: 0년·0개월', [L.calculateCompletedYears(L.parseDate('2026-05-05'), L.parseDate('2026-05-05')), L.calculateCompletedMonthlyPeriods(L.parseDate('2026-05-05'), L.parseDate('2026-05-05'))], [0, 0]);
eq('6개월 경과 전 개근 6 입력 거부(최대 5)', run({ hireDate: '2026-01-10', baseDate: '2026-07-09', fullMonths: '6' }).errors, ['개근월은 입사일부터 계산 기준일까지 끝난 1개월 구간 수(5개월)보다 클 수 없습니다.']);
eq('6개월 경과 당일 개근 6 허용', run({ hireDate: '2026-01-10', baseDate: '2026-07-10', fullMonths: '6' }).r.days, 6);
eq('기준일 < 입사일 거부', run({ hireDate: '2026-05-05', baseDate: '2026-05-04', fullMonths: '0' }).errors, ['계산 기준일이 입사일보다 빠릅니다. 날짜를 확인하세요.']);
eq('없는 날짜 거부', run({ hireDate: '2026-02-30', baseDate: '2026-05-04' }).errors[0], '입사일을 입력하세요.');
// ── 추가: 단시간 시간 반올림(한 함수) ──
eq('18.5시간 3년: 16×18.5/40×8=59.2 → 60(1시간 미만 올림)', L.calculatePartTimeLeaveHours(16, 18.5, 40), 60);
eq('15시간 1년: 15×15/40×8=45', L.calculatePartTimeLeaveHours(15, 15, 40), 45);
eq('17.5시간 3년: 16×17.5/40×8=56', L.calculatePartTimeLeaveHours(16, 17.5, 40), 56);
eq('22시간 5년: 17×22/40×8=74.8 → 75(1시간 미만 올림)', L.calculatePartTimeLeaveHours(17, 22, 40), 75);
eq('부동소수 오차로 1시간 더하지 않음', L.roundLeaveHours(60.0000000001), 60);
eq('1년 미만 단시간 3개월 개근 20/40 → 12시간', run(Object.assign({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '3' }, PART)).r.hours, 12);
eq('단시간이 통상근로자 이상 시간이면 거부', run(Object.assign({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80' }, PART, { weeklyHours: '40' })).r, null);
// ── 추가: 출근율 미확인 ──
const u = years(5, { attendance: 'unknown', used: '', monthlyWage: '' }).r;
eq('출근율 미확인: 확정 계산 안 함 + 80% 이상 예상값', [u.status, u.days, u.pay, u.estimateDays], ['unknownAttendance', undefined, undefined, 17]);
// ── 추가: 반차·수당 계산 ──
eq('반차 0.5일 사용 → 남음 14.5', run({ hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '0.5' }).r.remainingDays, 14.5);
eq('예시(3년·사용5): 11일 → 1,052,632원', run({ hireDate: '2023-03-15', baseDate: '2026-03-15', attendance: 'ge80', used: '5' }).r.pay, Math.round(2500000 * 8 * 11 / 209));
eq('0개월 개근·사용 0 → 0일·0원', [run({ hireDate: '2026-01-10', baseDate: '2026-01-20', fullMonths: '0' }).r.days, run({ hireDate: '2026-01-10', baseDate: '2026-01-20', fullMonths: '0' }).r.pay], [0, 0]);
// ── 추가: 잘못된 입력은 전부 차단(NaN·Infinity 없이 오류 문구만) ──
const ok1 = { hireDate: '2025-03-15', baseDate: '2026-03-15', attendance: 'ge80' };
for (const [f, val] of [['monthlyWage', '0'], ['monthlyWage', '-100'], ['monthlyWage', 'abc'], ['monthlyWage', ''], ['monthlyWage', null], ['monthlyWage', undefined], ['monthlyWage', 'Infinity'],
  ['baseHours', '-1'], ['baseHours', 'NaN'], ['weeklyHours', '-5'], ['weeklyHours', '41'], ['dailyHours', '0'], ['dailyHours', '9'], ['used', '-1'], ['used', '1e3']]) {
  const x = run(Object.assign({}, ok1, { [f]: val }));
  eq(`${f}=${val} 차단`, [x.r, x.errors.length > 0, x.errors.every(s => typeof s === 'string' && !/NaN|Infinity|undefined|null/.test(s))], [null, true, true]);
}
const pz = run(Object.assign({}, ok1, PART, { fullTimeWeeklyHours: '0' }));
eq('통상근로자 주 소정근로 0 차단', pz.r, null);
const fmN = run({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '-1' });
eq('개근월 음수 차단', fmN.r, null);
eq('개근월 소수 차단', run({ hireDate: '2026-01-10', baseDate: '2026-04-10', fullMonths: '2.5' }).r, null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
