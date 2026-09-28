// 연차 계산 엔진 독립 검산 — 엔진 코드를 복사하지 않고 다른 방식으로 구한 기준값과 무작위·경계 입력을 대조한다.
//  · 날짜: 민법 기간 말일(해당일 전날, 해당일 없으면 그 달 말일)을 Date(UTC) 연산으로 구하고 "다음 날" 권리 발생
//  · 연차표: 공식 대신 3·5·7…년마다 1일씩 누적 후 25일 한도
//  · 단시간 시간·수당: 소수 입력을 정수(0.01 단위)로 바꿔 유리수 정수 연산으로 올림·반올림
// 실행: node scripts/tests/annual-leave-crosscheck.cjs [engine.js] [반복 수]
const path = require('path');
const L = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../../assets/annual-leave-2026.js'));
const N = +process.argv[3] || 20000;
let seed = 20260929; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);   // 재현 가능한 난수
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DAY = 864e5, U = (y, m, d) => Date.UTC(y, m - 1, d);
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const results = [];
function section(name, fn) { let n = 0, bad = 0, ex = []; fn((ok, info) => { n++; if (!ok) { bad++; if (ex.length < 3) ex.push(info); } }); results.push({ name, n, bad }); console.log(`${bad ? 'FAIL' : 'PASS'} ${name}: ${n}건, 불일치 ${bad}건`); ex.forEach(e => console.log('   ', JSON.stringify(e))); }

// ── 기준값(참조 구현) ──
function ariseRef(hy, hm, hd, months) {
  const t = hm - 1 + months, y = hy + Math.floor(t / 12), m = t % 12 + 1;
  const end = hd <= dim(y, m) ? U(y, m, hd) - DAY : U(y, m, dim(y, m));
  return end + DAY;
}
function refYears(hy, hm, hd, bms) { let y = 0; while (ariseRef(hy, hm, hd, (y + 1) * 12) <= bms) y++; return y; }
function refMonths(hy, hm, hd, bms) { let k = 0; while (ariseRef(hy, hm, hd, k + 1) <= bms) k++; return k; }
function refDays(y) { let d = 15; for (let k = 3; k <= y; k += 2) d++; return Math.min(d, 25); }
const c100 = x => Math.round(x * 100);
function refPartHours(days, w, ft) { const num = days * c100(w) * 8, den = c100(ft); return Math.floor((num + den - 1) / den); }   // 올림
function refPay(wage, hoursEq100, base) { const num = wage * hoursEq100, den = c100(base) ; return Math.floor((2 * num + den) / (2 * den)); } // hoursEq100 = 시간×100, 반올림(0.5 올림)

const BASE = { size: 'ge5', workerType: 'full', weeklyHours: '40', dailyHours: '8', fullTimeWeeklyHours: '40', used: '0', expired: '0', monthlyWage: '2500000', baseHours: '209' };
const run = o => { const r = L.validateAnnualLeaveInputs(Object.assign({}, BASE, o)); return { errors: r.errors, r: r.values ? L.calculateAnnualLeave(r.values) : null }; };

section('무작위 날짜(2000~2025 입사, 0~30년) 근속연수·1개월 구간', ok => {
  for (let i = 0; i < N; i++) {
    const hy = ri(2000, 2025), hm = ri(1, 12), hd = ri(1, dim(hy, hm));
    const bms = U(hy, hm, hd) + ri(0, 365 * 30) * DAY, b = L.parseDate(iso(bms)), h = { y: hy, m: hm, d: hd };
    const ey = L.calculateCompletedYears(h, b), em = L.calculateCompletedMonthlyPeriods(h, b);
    const ry = refYears(hy, hm, hd, bms), rm = refMonths(hy, hm, hd, bms);
    ok(ey === ry && em === rm, { h: iso(U(hy, hm, hd)), b: iso(bms), ey, ry, em, rm });
  }
});
section('1·3·21주년 전날/당일/다음날 + 월말·윤일 입사', ok => {
  const hires = [];
  for (let y = 2000; y <= 2025; y++) for (const [m, d] of [[1, 31], [2, 28], [3, 31], [4, 30], [8, 31], [12, 31], [1, 1], [6, 15]]) hires.push([y, m, d]);
  for (const y of [2000, 2004, 2008, 2012, 2016, 2020, 2024]) hires.push([y, 2, 29]);
  for (const [hy, hm, hd] of hires) for (const n of [1, 3, 21]) {
    const a = ariseRef(hy, hm, hd, n * 12);
    for (const off of [-1, 0, 1]) {
      const bms = a + off * DAY, b = L.parseDate(iso(bms));
      const got = L.calculateCompletedYears({ y: hy, m: hm, d: hd }, b), exp = off < 0 ? n - 1 : n;
      ok(got === exp && got === refYears(hy, hm, hd, bms), { h: `${hy}-${hm}-${hd}`, b: iso(bms), got, exp });
      if (n === 1 && off < 0) ok(L.calculateCompletedMonthlyPeriods({ y: hy, m: hm, d: hd }, b) === 11, { h: `${hy}-${hm}-${hd}`, b: iso(bms), msg: '1주년 전날 11구간' });
    }
  }
});
section('28~31일 입사 × 1~24개월 경계(전날/당일/다음날), 2월·30/31일 월', ok => {
  for (let hy = 2019; hy <= 2028; hy++) for (let hm = 1; hm <= 12; hm++) for (let hd = 28; hd <= dim(hy, hm); hd++) for (let k = 1; k <= 24; k++) {
    const a = ariseRef(hy, hm, hd, k);
    for (const off of [-1, 0, 1]) {
      const bms = a + off * DAY, b = L.parseDate(iso(bms)), h = { y: hy, m: hm, d: hd };
      const got = L.calculateCompletedMonthlyPeriods(h, b), exp = refMonths(hy, hm, hd, bms);
      ok(got === exp && got === (off < 0 ? k - 1 : k), { h: `${hy}-${hm}-${hd}`, b: iso(bms), k, got, exp });
    }
  }
});
section('근속 1~60년 연차일수(누적식)', ok => { for (let y = 1; y <= 60; y++) ok(L.calculateAnnualLeaveDays(y) === refDays(y), { y, got: L.calculateAnnualLeaveDays(y), exp: refDays(y) }); });
section('무작위 날짜 전체 계산(80% 이상) 발생일수', ok => {
  for (let i = 0; i < 3000; i++) {
    const hy = ri(1990, 2025), hm = ri(1, 12), hd = ri(1, dim(hy, hm)), bms = U(hy, hm, hd) + ri(365, 365 * 36) * DAY;
    const ry = refYears(hy, hm, hd, bms); if (ry < 1) continue;
    const x = run({ hireDate: iso(U(hy, hm, hd)), baseDate: iso(bms), attendance: 'ge80' });
    ok(x.r && x.r.days === refDays(ry), { h: iso(U(hy, hm, hd)), b: iso(bms), got: x.r && x.r.days, exp: refDays(ry) });
  }
});
section('주 15시간 경계(0.01~40시간 무작위 + 14.99/15/15.01)', ok => {
  const ws = [14.99, 15, 15.01, 0.01, 40]; for (let i = 0; i < 2000; i++) ws.push(ri(1, 4000) / 100);
  for (const w of ws) { const x = run({ hireDate: '2023-03-15', baseDate: '2026-03-15', attendance: 'ge80', weeklyHours: String(w) }); ok(x.r && x.r.status === (w < 15 ? 'excluded15' : 'ok'), { w, got: x.r && x.r.status }); }
});
section('5인 경계(규모 × 근로시간 무작위)', ok => {
  for (let i = 0; i < 500; i++) {
    const size = rnd() < 0.5 ? 'lt5' : 'ge5', w = ri(1, 4000) / 100;
    const x = run({ hireDate: '2023-03-15', baseDate: '2026-03-15', attendance: 'ge80', size, weeklyHours: String(w) });
    const exp = size === 'lt5' ? 'excluded5' : (w < 15 ? 'excluded15' : 'ok');
    ok(x.r && x.r.status === exp && (exp !== 'excluded5' || x.r.days === undefined), { size, w, got: x.r && x.r.status });
  }
});
section('단시간근로자 시간 환산(1시간 미만 올림)', ok => {
  for (let i = 0; i < 5000; i++) {
    const days = ri(0, 25), ft = ri(2000, 4000) / 100, w = ri(1500, Math.max(1500, c100(ft) - 1)) / 100;
    if (w >= ft) continue;
    const got = L.calculatePartTimeLeaveHours(days, w, ft), exp = refPartHours(days, w, ft);
    ok(got === exp, { days, w, ft, got, exp });
  }
});
section('단시간근로자 전체 계산(발생시간·남은시간·수당)', ok => {
  for (let i = 0; i < 2000; i++) {
    const yrs = ri(1, 25), w = ri(1500, 3900) / 100, ft = 40, wage = ri(300000, 4000000), base = ri(600, 2090) / 10;
    const hours = refPartHours(refDays(yrs), w, ft), used = ri(0, hours), expired = ri(0, hours - used);
    const x = run({ hireDate: `${2026 - yrs}-03-15`, baseDate: '2026-03-15', attendance: 'ge80', workerType: 'part', weeklyHours: String(w), fullTimeWeeklyHours: '40', used: String(used), expired: String(expired), monthlyWage: String(wage), baseHours: String(base) });
    const expPay = refPay(wage, (hours - used - expired) * 100, base);
    ok(x.r && x.r.hours === hours && x.r.remainingHours === hours - used - expired && x.r.pay === expPay, { yrs, w, wage, base, used, got: x.r && [x.r.hours, x.r.pay], exp: [hours, expPay] });
  }
});
section('일반근로자 수당(남은 일수 × 1일 소정근로시간, 최종 반올림)', ok => {
  for (let i = 0; i < 3000; i++) {
    const yrs = ri(1, 25), days = refDays(yrs), used = ri(0, days * 2) / 2, expired = ri(0, (days - used) * 2) / 2, daily = ri(1, 8), wage = ri(300000, 6000000), base = ri(600, 2090) / 10;
    const x = run({ hireDate: `${2026 - yrs}-03-15`, baseDate: '2026-03-15', attendance: 'ge80', used: String(used), expired: String(expired), dailyHours: String(daily), monthlyWage: String(wage), baseHours: String(base) });
    const expPay = refPay(wage, Math.round((days - used - expired) * daily * 100), base);
    ok(x.r && x.r.pay === expPay && x.r.remainingDays === days - used - expired, { yrs, used, daily, wage, base, got: x.r && x.r.pay, exp: expPay });
  }
});

section('사용+소멸 합계 초과는 항상 차단(음수 잔여 없음)', ok => {
  for (let i = 0; i < 1000; i++) {
    const yrs = ri(1, 25), days = refDays(yrs), used = ri(0, days * 2) / 2, expired = (days - used) + ri(1, 10) / 2;
    const x = run({ hireDate: `${2026 - yrs}-03-15`, baseDate: '2026-03-15', attendance: 'ge80', used: String(used), expired: String(expired) });
    ok(x.r === null && x.errors.length === 1, { yrs, used, expired, r: x.r });
  }
});
const bad = results.reduce((a, r) => a + r.bad, 0), tot = results.reduce((a, r) => a + r.n, 0);
console.log(`\n검산 ${tot}건, 불일치 ${bad}건`);
process.exit(bad ? 1 : 0);
