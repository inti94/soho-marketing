// 신용점수별 대출비용 비교 계산기 — 엔진 자동 테스트 (의존성 없음)
// 실행: node scripts/tests/loan-rate-compare-test.cjs
const path = require('path');
const E = require(path.join(__dirname, '../../assets/loan-rate-compare.js'));
let pass = 0, fail = 0;
const ok = (n, c, info) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + (info || ''))); };
const eq = (n, g, e) => ok(n, JSON.stringify(g) === JSON.stringify(e), `got=${JSON.stringify(g)} exp=${JSON.stringify(e)}`);
const near = (n, g, e, tol = 1e-6) => ok(n, Number.isFinite(g) && Math.abs(g - e) <= tol, `got=${g} exp=${e} tol=${tol}`);
const sum = (s, k, from = 0, to = s.length) => s.slice(from, to).reduce((a, x) => a + x[k], 0);
const finiteAll = r => { const vals = []; (function walk(o) { for (const k in o) { const v = o[k]; if (typeof v === 'number') vals.push(v); else if (v && typeof v === 'object') walk(v); } })(r); return vals.every(Number.isFinite); };
const noNeg = s => s.every(x => x.remainingPrincipal >= 0 && x.principalPayment >= -1e-9 && x.interest >= 0);
const V = o => E.validateLoanInputs(Object.assign({ principal: '100,000,000', baseRate: '4.5', compareRate: '7', term: '5', termUnit: 'year', repaymentType: 'equalPayment', income: '' }, o));
const cmp = o => E.calculateLoanComparison(V(o).values);
// 독립 검산용 닫힌 공식
const pmt = (P, a, n) => { const r = a / 1200; return r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n)); };
const balAfter = (P, a, n, k) => { const r = a / 1200, M = pmt(P, a, n); return r === 0 ? P - M * k : P * Math.pow(1 + r, k) - M * (Math.pow(1 + r, k) - 1) / r; };

// ── TEST 1 원리금균등 기본 ──
{
  const r = E.calculateEqualPaymentLoan(100000000, 5, 120), M = pmt(100000000, 5, 120);
  near('TEST 1 월상환액 = 독립 공식 (1,060,655.2…원)', r.monthlyPayment, M, 1e-6);
  eq('TEST 1 월상환액 표시 1,060,655원', E.formatMoney(r.monthlyPayment), '1,060,655원');
  near('TEST 1 총이자 = 스케줄 이자합', r.totalInterest, sum(r.schedule, 'interest'), 1e-6);
  near('TEST 1 총이자 = M×n − P (공식)', r.totalInterest, M * 120 - 100000000, 1e-4);
  eq('TEST 1 스케줄 120회', r.schedule.length, 120);
  near('TEST 1 첫 달 이자 = P × 5%/12', r.schedule[0].interest, 100000000 * 0.05 / 12, 1e-9);
  ok('TEST 1 모든 회차 납입액 동일(오차 1e-6원)', r.schedule.every(x => Math.abs(x.payment - M) < 1e-6));
  ok('TEST 1 반올림 월상환액×n 방식과 다른 정밀값 사용', Math.abs(r.totalPayment - Math.round(M) * 120) > 1);
}
// ── TEST 2 원리금균등 0% ──
{
  const r = E.calculateEqualPaymentLoan(120000000, 0, 120);
  eq('TEST 2 월상환 1,000,000원', r.monthlyPayment, 1000000);
  eq('TEST 2 총이자 0', r.totalInterest, 0);
  eq('TEST 2 총상환 120,000,000', r.totalPayment, 120000000);
  ok('TEST 2 NaN/Infinity 없음', finiteAll(r));
  eq('TEST 2 최종 잔액 0', r.schedule[119].remainingPrincipal, 0);
}
// ── TEST 3 원금균등 ──
const ep = E.calculateEqualPrincipalLoan(120000000, 6, 120);
{
  const s = ep.schedule;
  near('TEST 3 월 원금 1,000,000', s[0].principalPayment, 1000000, 1e-9);
  near('TEST 3 첫 달 이자 600,000', s[0].interest, 600000, 1e-6);
  near('TEST 3 첫 달 상환 1,600,000', s[0].payment, 1600000, 1e-6);
  near('TEST 3 둘째 달 이자 595,000', s[1].interest, 595000, 1e-6);
  near('TEST 3 둘째 달 상환 1,595,000', s[1].payment, 1595000, 1e-6);
  ok('TEST 3 월 상환액 매월 감소', s.every((x, i) => i === 0 || x.payment < s[i - 1].payment));
  near('TEST 3 마지막 달 상환 1,005,000', ep.lastMonthlyPayment, 1005000, 1e-6);
  near('TEST 3 월평균 상환 = 총상환/120 = 1,302,500', ep.averageMonthlyPayment, 1302500, 1e-6);
  near('TEST 3 월 부담 기준 = 첫 달 상환액', ep.monthlyBurden, 1600000, 1e-6);
}
// ── TEST 4 원금균등 총이자 ──
near('TEST 4 총이자 36,300,000', ep.totalInterest, 36300000, 1e-5);
near('TEST 4 공식 P×r×(n+1)/2 교차검산', ep.totalInterest, 120000000 * 0.005 * 121 / 2, 1e-5);
near('TEST 4 총상환 156,300,000', ep.totalPayment, 156300000, 1e-5);
// ── TEST 5 만기일시 ──
{
  const r = E.calculateBulletLoan(100000000, 6, 60);
  near('TEST 5 월 이자 500,000', r.monthlyInterest, 500000, 1e-9);
  near('TEST 5 총이자 30,000,000', r.totalInterest, 30000000, 1e-5);
  near('TEST 5 총상환 130,000,000', r.totalPayment, 130000000, 1e-5);
  eq('TEST 5 만기 원금 100,000,000', r.maturityPrincipal, 100000000);
  eq('TEST 5 1~59회차 원금 0', r.schedule.slice(0, 59).every(x => x.principalPayment === 0), true);
  near('TEST 5 마지막 회차 = 원금 + 이자', r.lastMonthlyPayment, 100500000, 1e-6);
  near('TEST 5 월 부담 기준 = 월 이자', r.monthlyBurden, 500000, 1e-9);
}
// ── TEST 6 만기일시 0% ──
{
  const r = E.calculateBulletLoan(100000000, 0, 60);
  eq('TEST 6 월이자 0·총이자 0·만기원금·총상환', [r.monthlyInterest, r.totalInterest, r.maturityPrincipal, r.totalPayment], [0, 0, 100000000, 100000000]);
  ok('TEST 6 NaN/Infinity 없음', finiteAll(r));
}
// ── TEST 7 동일금리 ──
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) {
  const c = cmp({ baseRate: '5', compareRate: '5', repaymentType: t }).comparison;
  eq(`TEST 7 동일금리(${t}) 차이 전부 0`, [c.rateDifference, c.monthlyPaymentDifference, c.totalInterestDifference, c.firstYearInterestDifference, c.totalPaymentDifference], [0, 0, 0, 0, 0]);
  eq(`TEST 7 동일금리(${t}) 표시 0.0%p`, E.formatPoint(c.rateDifference), '0.0%p');
}
// ── TEST 8 비교금리 높음 / TEST 9 낮음 ──
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) {
  const hi = cmp({ baseRate: '4', compareRate: '7', repaymentType: t }), c = hi.comparison;
  ok(`TEST 8 (${t}) 비교 쪽 이자·월부담·첫1년·총상환 모두 큼`, c.monthlyPaymentDifference > 0 && c.totalInterestDifference > 0 && c.firstYearInterestDifference > 0 && c.totalPaymentDifference > 0 && hi.compare.totalInterest > hi.base.totalInterest);
  eq(`TEST 8 (${t}) 금리차 +3.0%p`, E.formatPoint(c.rateDifference), '+3.0%p');
  const lo = cmp({ baseRate: '7', compareRate: '4', repaymentType: t }).comparison;
  ok(`TEST 9 (${t}) 차이 음수(절감)`, lo.monthlyPaymentDifference < 0 && lo.totalInterestDifference < 0 && lo.firstYearInterestDifference < 0 && lo.totalPaymentDifference < 0);
  eq(`TEST 9 (${t}) 금리차 −3.0%p`, E.formatPoint(lo.rateDifference), '−3.0%p');
  near(`TEST 30 (${t}) 금리 교환 시 절대금액 동일·부호 반대`, lo.totalInterestDifference, -c.totalInterestDifference, 1e-6);
}
eq('TEST 3(표기) 4.5 vs 7.0 → +2.5%p', E.formatPoint(cmp({}).comparison.rateDifference), '+2.5%p');
eq('금리 표기 4.35% / 7.0% / 4.125%', [E.formatRate(4.35), E.formatRate(7), E.formatRate(4.125)], ['4.35%', '7.0%', '4.125%']);
// ── TEST 10 첫 1년 이자 차이 ──
{
  const R = cmp({ principal: '100000000', baseRate: '4.5', compareRate: '7', term: '5', repaymentType: 'equalPayment' });
  const a = sum(R.base.schedule, 'interest', 0, 12), b = sum(R.compare.schedule, 'interest', 0, 12);
  near('TEST 10 기준 첫 1년 이자 = 1~12회차 합', R.base.firstYearInterest, a, 1e-9);
  near('TEST 10 비교 첫 1년 이자 = 1~12회차 합', R.compare.firstYearInterest, b, 1e-9);
  near('TEST 10 차이 = 두 합의 차', R.comparison.firstYearInterestDifference, b - a, 1e-9);
  ok('TEST 10 원금×금리차(2,500,000) 단순계산과 다름', Math.abs(R.comparison.firstYearInterestDifference - 100000000 * 0.025) > 1000);
  near('TEST 10 독립 공식(12M − (P − 잔액12))과 일치(기준)', R.base.firstYearInterest, 12 * pmt(1e8, 4.5, 60) - (1e8 - balAfter(1e8, 4.5, 60, 12)), 1e-5);
}
// ── TEST 11 6개월 대출 ──
{
  const R = cmp({ term: '6', termUnit: 'month' });
  eq('TEST 11 기간 6개월', R.base.months, 6);
  eq('TEST 11 전체 기간 기준 플래그', R.comparison.firstYearIsWholeTerm, true);
  near('TEST 11 첫1년 이자차 = 전체 이자차', R.comparison.firstYearInterestDifference, R.comparison.totalInterestDifference, 1e-9);
  eq('TEST 11 첫1년 이자 개월수 6', R.base.firstYearMonths, 6);
  eq('TEST 11 12개월 이상은 플래그 false', cmp({ term: '12', termUnit: 'month' }).comparison.firstYearIsWholeTerm, false);
}
// ── TEST 12·13 월소득 ──
near('TEST 12 1,000,000 / 4,000,000 = 25%', E.calculateIncomeBurden(1000000, 4000000), 25, 1e-12);
eq('TEST 13 소득 없음 → null', E.calculateIncomeBurden(1000000, null), null);
eq('TEST 13 소득 0 → null', E.calculateIncomeBurden(1000000, 0), null);
{
  const v = V({ income: '' });
  ok('TEST 13 소득 미입력도 검증 통과·계산 정상', v.errors.length === 0 && v.values.income === null && finiteAll(E.calculateLoanComparison(v.values)));
  const z = V({ income: '0' });
  ok('TEST 30 소득 0 → 오류 아님·부담률 제외 안내', z.errors.length === 0 && z.values.income === null && /계산하지 않았습니다/.test(z.incomeNote));
  eq('TEST 30 소득 음수 → 제외', V({ income: '-100' }).values.income, null);
  eq('TEST 30 소득 문자 → 오류', V({ income: 'abc' }).values, null);
  eq('TEST 27 소득 콤마 4,000,000 파싱', V({ income: '4,000,000' }).values.income, 4000000);
}
// ── TEST 14·15 부담 기준 ──
{
  const R = cmp({ principal: '120000000', baseRate: '6', compareRate: '8', term: '10', repaymentType: 'equalPrincipal' });
  near('TEST 14 원금균등 부담률 기준 = 첫 달 상환액', E.calculateIncomeBurden(R.base.monthlyBurden, 4000000), 1600000 / 4000000 * 100, 1e-9);
  const B = cmp({ baseRate: '6', compareRate: '8', repaymentType: 'bullet' });
  near('TEST 15 만기일시 부담률 기준 = 월 이자', E.calculateIncomeBurden(B.base.monthlyBurden, 4000000), 500000 / 4000000 * 100, 1e-9);
  eq('TEST 15 비교 기준 이름', [cmp({}).comparison.monthlyBasis, R.comparison.monthlyBasis, B.comparison.monthlyBasis], ['monthlyPayment', 'firstMonthlyPayment', 'monthlyInterest']);
}
// ── TEST 16 금리 소수 ──
{
  const v = V({ baseRate: '4.35', compareRate: '6.85' }).values;
  eq('TEST 16 4.35 그대로 유지', [v.baseRate, v.compareRate], [4.35, 6.85]);
  near('TEST 16 4.35% 월상환액 = 독립 공식', E.calculateLoanComparison(v).base.monthlyPayment, pmt(1e8, 4.35, 60), 1e-6);
  eq('TEST 16 금리차 +2.5%p (부동소수 오차 제거)', E.formatPoint(E.calculateLoanComparison(v).comparison.rateDifference), '+2.5%p');
  eq('TEST 16 0.1 vs 0.3 → +0.2%p', E.calculateLoanComparison(V({ baseRate: '0.1', compareRate: '0.3' }).values).comparison.rateDifference, 0.2);
}
// ── TEST 17 장기대출 ──
{
  const R = cmp({ principal: '300,000,000', baseRate: '4', compareRate: '6', term: '30' });
  ok('TEST 17 NaN/Infinity 없음', finiteAll(R));
  eq('TEST 17 스케줄 360회(두 금리)', [R.base.schedule.length, R.compare.schedule.length], [360, 360]);
  eq('TEST 17 마지막 잔액 정확히 0', [R.base.schedule[359].remainingPrincipal, R.compare.schedule[359].remainingPrincipal], [0, 0]);
  near('TEST 17 4% 월상환 = 독립 공식', R.base.monthlyPayment, pmt(3e8, 4, 360), 1e-6);
  near('TEST 17 6% 월상환 = 독립 공식', R.compare.monthlyPayment, pmt(3e8, 6, 360), 1e-6);
  near('TEST 17 총이자 = M×n − P (6%)', R.compare.totalInterest, pmt(3e8, 6, 360) * 360 - 3e8, 1e-3);
  ok('TEST 17 중간 잔액 = 닫힌 공식 잔액', [60, 120, 240, 359].every(k => Math.abs(R.base.schedule[k - 1].remainingPrincipal - balAfter(3e8, 4, 360, k)) < 1e-3));
}
// ── TEST 18~21 전 방식 공통 불변식 ──
const cases = [];
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) for (const [P, a, n] of [[100000000, 5, 120], [300000000, 4, 360], [7777777, 13.9, 37], [50000000, 0, 24], [1, 3, 1], [123456789, 100, 480]]) cases.push([t, P, a, n]);
for (const [t, P, a, n] of cases) {
  const r = E.calculateLoan(P, a, n, t), s = r.schedule, tag = `${t} P=${P} ${a}% ${n}개월`;
  eq(`TEST 18 최종 잔액 0 (${tag})`, s[n - 1].remainingPrincipal, 0);
  ok(`TEST 18 음수 잔액·음수 원금 없음 (${tag})`, noNeg(s));
  near(`TEST 19 원금상환 합 = 원금 (${tag})`, sum(s, 'principalPayment'), P, Math.max(1e-6, P * 1e-12));
  near(`TEST 20 이자 합 = 총이자 (${tag})`, sum(s, 'interest'), r.totalInterest, 1e-9 * Math.max(1, r.totalInterest));
  near(`TEST 21 총상환 = 원금 + 총이자 (${tag})`, r.totalPayment, P + r.totalInterest, 1e-9);
  near(`TEST 21 납입액 합 = 총상환 (${tag})`, sum(s, 'payment'), r.totalPayment, 1e-6 * Math.max(1, r.totalPayment / 1e6));
  ok(`NaN/Infinity 없음 (${tag})`, finiteAll(r));
}
// ── TEST 22 비교 총상환 차이 = 총이자 차이 ──
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) for (const [a, b] of [[4.5, 7], [7, 4], [5, 5], [0, 12.5]]) {
  const c = cmp({ baseRate: String(a), compareRate: String(b), repaymentType: t }).comparison;
  near(`TEST 22 (${t} ${a}→${b}) 총상환차 = 총이자차`, c.totalPaymentDifference, c.totalInterestDifference, 1e-6);
}
// ── TEST 12(독립 계산) B를 A에서 비례 계산하지 않음 ──
{
  const R = cmp({});
  near('TEST 12(독립) 비교 결과 = 단독 calculateLoan(7%)', R.compare.totalInterest, E.calculateLoan(1e8, 7, 60, 'equalPayment').totalInterest, 0);
  ok('TEST 12(독립) 비례(이자×7/4.5)와 다름', Math.abs(R.compare.totalInterest - R.base.totalInterest * 7 / 4.5) > 1000);
}
// ── TEST 23~26 입력 검증 ──
for (const p of ['0', '-1000', '', 'abc', '1.5', '10,000,000,001', null, undefined]) eq(`TEST 23 원금 ${JSON.stringify(p)} 차단`, V({ principal: p }).values, null);
for (const [tm, u] of [['0', 'year'], ['-1', 'year'], ['', 'year'], ['0', 'month'], ['-3', 'month'], ['41', 'year'], ['481', 'month'], ['1.5', 'year'], ['x', 'month']]) eq(`TEST 24 기간 ${tm}${u === 'year' ? '년' : '개월'} 차단`, V({ term: tm, termUnit: u }).values, null);
eq('TEST 24 40년 = 480개월 허용', V({ term: '40' }).values.months, 480);
eq('TEST 24 480개월 허용', V({ term: '480', termUnit: 'month' }).values.months, 480);
eq('TEST 24 5년 → 60개월, 10년 → 120, 30년 → 360', ['5', '10', '30'].map(y => V({ term: y }).values.months), [60, 120, 360]);
for (const r of ['-0.1', '-5']) { eq(`TEST 25 기준금리 ${r} 차단`, V({ baseRate: r }).values, null); eq(`TEST 25 비교금리 ${r} 차단`, V({ compareRate: r }).values, null); }
eq('TEST 25 0% 허용', V({ baseRate: '0', compareRate: '0' }).values.baseRate, 0);
eq('TEST 31(엔진) 비교금리 빈값 차단', V({ compareRate: '' }).values, null);
eq('상환방식 미선택 차단', V({ repaymentType: '' }).values, null);
// ── TEST 26 (정책 변경 2026-09-29): 연 20% 초과는 입력 차단 — 계산기 입력 정책이며 수학적 한계가 아님 ──
const OVER_MSG = '입력한 금리가 국내 일반 개인대출의 법정 최고금리(연 20%) 범위를 초과합니다. 금리를 다시 확인해주세요.';
eq('TEST 26 상한 정책값 = 20', E.LIMITS.MAX_RATE, 20);
for (const r of ['25', '100', '100.01']) {
  const vb = V({ baseRate: r }), vc = V({ compareRate: r });
  ok(`TEST 26 기준금리 ${r}% 차단 + 법정 최고금리 안내`, vb.values === null && vb.errors.length === 1 && vb.errors[0].includes(OVER_MSG) && vb.errors[0].startsWith('기준 금리'));
  ok(`TEST 26 비교금리 ${r}% 차단 + 법정 최고금리 안내`, vc.values === null && vc.errors.length === 1 && vc.errors[0].includes(OVER_MSG) && vc.errors[0].startsWith('비교할 금리'));
}
// 엔진 계산 함수 자체의 고금리 수치 안정성(입력 정책과 무관) — 점화식 방식은 여기서 수천~수십만원 틀렸다 (기대값은 BigInt 60자리 고정밀 계산)
for (const t of ['equalPayment', 'equalPrincipal', 'bullet'])
  ok(`엔진 수치 안정성 100% (${t}) NaN/Infinity 없음·금리 보정 없음`, (R => finiteAll(R) && R.compare.annualRate === 100)(E.calculateLoanComparison({ principal: 1e8, baseRate: 4.5, compareRate: 100, months: 60, repaymentType: t })));
near('엔진 수치 안정성 회귀 100%·360개월 총이자 = 29,000,000.00', E.calculateEqualPaymentLoan(1000000, 100, 360).totalInterest, 29000000.000009, 0.01);
near('엔진 수치 안정성 회귀 74.807%·480개월 총이자 = 8,676,840,000.00', E.calculateEqualPaymentLoan(300000000, 74.807, 480).totalInterest, 8676840000.002222, 0.01);
near('엔진 수치 안정성 회귀 100%·360개월 마지막 회차 = 월상환액', E.calculateEqualPaymentLoan(1000000, 100, 360).lastMonthlyPayment, E.calculateEqualPaymentLoan(1000000, 100, 360).monthlyPayment, 1e-6);
eq('경고 목록 항상 비어 있음(20% 이하는 경고 없이 계산)', [V({ compareRate: '20' }).warnings, V({ baseRate: '19.99' }).warnings], [[], []]);
// ── TEST 36 금리 20% → 정상 계산 ──
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) for (const side of ['baseRate', 'compareRate']) {
  const v = V({ [side]: '20', repaymentType: t });
  ok(`TEST 36 ${side === 'baseRate' ? '기준' : '비교'}금리 20% (${t}) 검증 통과·오류 0·값 보정 없음`, v.values !== null && v.errors.length === 0 && v.values[side] === 20);
  const R = E.calculateLoanComparison(v.values), res = side === 'baseRate' ? R.base : R.compare;
  ok(`TEST 36 ${side === 'baseRate' ? '기준' : '비교'}금리 20% (${t}) 결과 NaN/Infinity 없음·잔액 0`, finiteAll(R) && res.schedule[59].remainingPrincipal === 0);
}
{
  const R = E.calculateLoanComparison(V({ compareRate: '20' }).values);
  near('TEST 36 20% 원리금균등 월상환 = 독립 공식', R.compare.monthlyPayment, pmt(1e8, 20, 60), 1e-6);
  eq('TEST 36 20% 원리금균등 월상환 표시 2,649,388원', E.formatMoney(R.compare.monthlyPayment), '2,649,388원');
  near('TEST 36 20% 만기일시 월이자 = 1,666,666.67', E.calculateLoanComparison(V({ compareRate: '20', repaymentType: 'bullet' }).values).compare.monthlyInterest, 1e8 * 0.2 / 12, 1e-6);
  near('TEST 36 20% 원금균등 총이자 = P×r×(n+1)/2', E.calculateLoanComparison(V({ compareRate: '20', repaymentType: 'equalPrincipal' }).values).compare.totalInterest, 1e8 * (0.2 / 12) * 61 / 2, 1e-5);
}
// ── TEST 37 금리 20.01% → 입력 차단 ──
for (const side of ['baseRate', 'compareRate']) for (const r of ['20.01', '20.001', '20.0001']) {
  const v = V({ [side]: r });
  ok(`TEST 37 ${side === 'baseRate' ? '기준' : '비교'}금리 ${r}% 차단 + 안내 문구`, v.values === null && v.errors.length === 1 && v.errors[0].includes(OVER_MSG));
}
ok('TEST 37 두 금리 모두 초과 → 오류 2건', V({ baseRate: '21', compareRate: '20.01' }).errors.filter(e => e.includes(OVER_MSG)).length === 2);
ok('TEST 37 "20.00"은 20과 같아 허용', V({ compareRate: '20.00' }).values !== null);
// ── TEST 38 금리 0% → 정상 계산 ──
for (const t of ['equalPayment', 'equalPrincipal', 'bullet']) for (const side of ['baseRate', 'compareRate']) {
  const v = V({ [side]: '0', repaymentType: t });
  ok(`TEST 38 ${side === 'baseRate' ? '기준' : '비교'}금리 0% (${t}) 검증 통과`, v.values !== null && v.errors.length === 0 && v.values[side] === 0);
  const R = E.calculateLoanComparison(v.values), res = side === 'baseRate' ? R.base : R.compare;
  ok(`TEST 38 ${side === 'baseRate' ? '기준' : '비교'}금리 0% (${t}) 총이자 0·총상환 = 원금·NaN 없음`, res.totalInterest === 0 && res.totalPayment === 1e8 && finiteAll(R));
}
eq('TEST 38 0% 원리금균등 월상환 = 원금/개월', E.calculateLoanComparison(V({ baseRate: '0' }).values).base.monthlyPayment, 1e8 / 60);
// ── TEST 27 콤마 ──
eq('TEST 27 100,000,000 파싱', V({ principal: '100,000,000' }).values.principal, 100000000);
eq('TEST 27 공백 포함 파싱', V({ principal: ' 30,000,000 ' }).values.principal, 30000000);
// ── 표시 포맷 ──
eq('formatMoney 반올림·-0 방지', [E.formatMoney(1060655.21), E.formatMoney(-0.4), E.formatMoney(0.5)], ['1,060,655원', '0원', '1원']);
eq('formatManwon', [E.formatManwon(4320000), E.formatManwon(-4324999), E.formatManwon(123456789), E.formatManwon(200000000), E.formatManwon(9999)], ['432만원', '432만원', '1억 2,346만원', '2억원', '9,999원']);

console.log(`\n엔진 테스트: ${pass + fail}건 / 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
