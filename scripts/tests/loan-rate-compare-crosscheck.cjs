// 신용점수별 대출비용 비교 계산기 — 독립 검산 (무작위 조합)
// 엔진의 월별 스케줄 결과를, 엔진 코드를 쓰지 않는 닫힌 공식(closed form)과 대조한다.
//   원리금균등: M = P·r/(1−(1+r)^−n), k회차 후 잔액 B_k = P·((1+r)^n − (1+r)^k)/((1+r)^n − 1) (닫힌 공식), m개월 이자합 = r·Σ_{k<m} B_k
//     ※ mM − (P − B_m) 형태는 저금리·단기에서 자릿수 상쇄로 정밀도를 잃어(BigInt 고정밀 계산으로 확인) expm1/log1p 형태를 쓴다.
//   원금균등:   m개월 이자합 = r·(mP − (P/n)·m(m−1)/2), 총이자 = P·r·(n+1)/2
//   만기일시:   m개월 이자합 = P·r·m
// 실행: node scripts/tests/loan-rate-compare-crosscheck.cjs [건수=20000] [seed=20260929]
const path = require('path');
const E = require(path.join(__dirname, '../../assets/loan-rate-compare.js'));
const N = +process.argv[2] || 20000;
let seed = +process.argv[3] || 20260929;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];

function interestUpTo(type, P, a, n, m) {
  const r = a / 1200;
  if (type === 'bullet') return P * r * m;
  if (type === 'equalPrincipal') return r * (m * P - (P / n) * m * (m - 1) / 2);
  if (r === 0) return 0;
  const L = Math.log1p(r), gn = Math.expm1(n * L);
  let acc = 0;
  for (let k = 0; k < m; k++) acc += P * (gn - Math.expm1(k * L)) / gn;
  return r * acc;
}
function firstBurden(type, P, a, n) {
  const r = a / 1200;
  if (type === 'bullet') return P * r;
  if (type === 'equalPrincipal') return P / n + P * r;
  return r === 0 ? P / n : P * r / -Math.expm1(-n * Math.log1p(r));
}

let checks = 0, bad = 0;
const fails = [];
function chk(label, got, exp, tol) {
  checks++;
  if (!(Number.isFinite(got) && Math.abs(got - exp) <= tol)) { bad++; if (fails.length < 20) fails.push(`${label} got=${got} exp=${exp}`); }
}
const types = ['equalPayment', 'equalPrincipal', 'bullet'];
for (let i = 0; i < N; i++) {
  const type = types[i % 3];
  const P = pick([1, 999, 1e6, 3e7, 1e8, 3e8, 1e9, 1e10, Math.floor(rnd() * 1e9) + 1]);
  const rate = () => pick([0, 0.01, 1, 3.5, 4.35, 5, 7, 12.9, 19.99, 20, 35, 100, Math.round(rnd() * 3000) / 100, Math.round(rnd() * 100000) / 1000]);
  const a = rate(), b = rate();
  const n = pick([1, 2, 6, 11, 12, 13, 24, 60, 120, 240, 360, 480, 1 + Math.floor(rnd() * 480)]);
  const R = E.calculateLoanComparison({ principal: P, baseRate: a, compareRate: b, months: n, repaymentType: type });
  const tag = `#${i} ${type} P=${P} ${a}%/${b}% n=${n}`;
  const tolFor = x => 1e-7 * Math.max(1, Math.abs(x));    // 부동소수점 수준(상대 1e-7)
  for (const [side, rate_, res] of [['A', a, R.base], ['B', b, R.compare]]) {
    const s = res.schedule;
    chk(`${tag} ${side} 스케줄 길이`, s.length, n, 0);
    chk(`${tag} ${side} 원금합`, s.reduce((x, y) => x + y.principalPayment, 0), P, tolFor(P));
    const ti = interestUpTo(type, P, rate_, n, n);
    chk(`${tag} ${side} 총이자(스케줄 합)`, s.reduce((x, y) => x + y.interest, 0), ti, tolFor(ti));
    chk(`${tag} ${side} 총이자(결과)`, res.totalInterest, ti, tolFor(ti));
    chk(`${tag} ${side} 최종잔액`, s[n - 1].remainingPrincipal, 0, 0);
    chk(`${tag} ${side} 음수잔액 없음`, s.every(x => x.remainingPrincipal >= 0) ? 1 : 0, 1, 0);
    chk(`${tag} ${side} 총상환`, res.totalPayment, P + ti, tolFor(P + ti));
    const fy = interestUpTo(type, P, rate_, n, Math.min(12, n));
    chk(`${tag} ${side} 첫12개월이자`, res.firstYearInterest, fy, tolFor(fy));
    const fb = firstBurden(type, P, rate_, n);
    chk(`${tag} ${side} 월부담 기준값`, res.monthlyBurden, fb, tolFor(fb));
  }
  const c = R.comparison;
  const dI = interestUpTo(type, P, b, n, n) - interestUpTo(type, P, a, n, n);
  const dY = interestUpTo(type, P, b, n, Math.min(12, n)) - interestUpTo(type, P, a, n, Math.min(12, n));
  const tolD = 1e-7 * Math.max(1, interestUpTo(type, P, Math.max(a, b), n, n));
  chk(`${tag} 총이자 차액`, c.totalInterestDifference, dI, tolD);
  chk(`${tag} 총상환 차액`, c.totalPaymentDifference, dI, tolD);
  chk(`${tag} 첫1년 차액`, c.firstYearInterestDifference, dY, tolD);
  chk(`${tag} 월부담 차액`, c.monthlyPaymentDifference, firstBurden(type, P, b, n) - firstBurden(type, P, a, n), 1e-7 * Math.max(1, P));
  chk(`${tag} 금리차`, c.rateDifference, Math.round((b - a) * 1e6) / 1e6, 1e-9);
  chk(`${tag} 방향 일관(이자차 부호 = 금리차 부호)`, Math.sign(Math.round(c.totalInterestDifference * 1e4)) === Math.sign(Math.round((b - a) * 1e6)) || P * Math.abs(b - a) < 1e3 ? 1 : 0, 1, 0);
}
// 입력 정책 검산: 금리는 0 이상 20 이하만 통과(국내 일반 개인대출 계산기 정책). 무작위 금리 문자열로 대조
const RATE_N = 20000;
for (let i = 0; i < RATE_N; i++) {
  const r = pick([0, 20, 20.01, 20.001, -0.01, 19.999, Math.round((rnd() * 30 - 2) * 1000) / 1000, Math.round(rnd() * 2000) / 100]);
  const s = String(r), side = i % 2 ? 'baseRate' : 'compareRate';
  const v = E.validateLoanInputs(Object.assign({ principal: '100000000', baseRate: '5', compareRate: '5', term: '5', termUnit: 'year', repaymentType: 'equalPayment' }, { [side]: s }));
  const expectOk = Number(s) >= 0 && Number(s) <= 20;
  chk(`금리정책 ${side}=${s}`, v.values ? 1 : 0, expectOk ? 1 : 0, 0);
  if (expectOk) chk(`금리정책 값 보정 없음 ${s}`, v.values[side], Number(s), 0);
}
fails.forEach(f => console.log('MISMATCH ' + f));
console.log(`독립 검산: 계산 조합 ${N}건 + 금리 입력정책 ${RATE_N}건 · 비교 항목 ${checks}건 / 불일치 ${bad}`);
process.exit(bad ? 1 : 0);
