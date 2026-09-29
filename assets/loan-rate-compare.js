/* 신용점수별 대출비용 비교 계산 엔진 — 두 금리(기준·비교)를 같은 상환조건으로 각각 계산해 비교한다.
   ※ 신용점수로 금리를 추정하지 않는다. 사용자가 금융사에서 확인한 연이율 두 개를 입력받는다.
   가정: 고정금리, 월 단위 정상 상환, 월이율 = 연이율 ÷ 12 ÷ 100, 수수료·일할이자·금리변동 미반영.
   정밀도: 엔진은 소수 그대로 계산하고(회차별 반올림 없음) 원 단위 반올림은 화면 표시 단계에서만 한다.
   UI 코드와 분리: 페이지는 validateLoanInputs() → calculateLoanComparison() → calculateIncomeBurden() 만 호출한다. */
(function (root) {
  'use strict';

  var LIMITS = {
    MAX_PRINCIPAL: 10000000000,   // 100억원 (계산기 정책)
    MAX_MONTHS: 480,              // 40년 (계산기 정책)
    MAX_RATE: 100,                // 연 100% 초과는 입력 오류로 본다 (계산기 정책)
    WARN_RATE: 20                 // 연 20% 초과는 계산하되 경고
  };
  var TYPES = { equalPayment: '원리금균등상환', equalPrincipal: '원금균등상환', bullet: '만기일시상환' };
  var EPS_BALANCE = 1e-6;         // 부동소수점 잔액(0.0000001원 등)은 0으로 본다

  function monthlyRate(annualRate) { return annualRate / 12 / 100; }

  // 문자열/숫자 → 숫자. 콤마·공백 제거. 빈값·숫자 아님 → NaN
  function parseNum(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    var s = String(v).replace(/[,\s]/g, '');
    if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  /* 입력 검증: raw = { principal, baseRate, compareRate, term, termUnit('year'|'month'), repaymentType, income }
     반환 { errors[], warnings[], values|null, incomeNote|null } */
  function validateLoanInputs(raw) {
    raw = raw || {};
    var errors = [], warnings = [], incomeNote = null;
    var principal = parseNum(raw.principal);
    if (!isFinite(principal)) errors.push('대출원금을 숫자로 입력하세요.');
    else if (principal <= 0) errors.push('대출원금은 0원보다 커야 합니다.');
    else if (Math.floor(principal) !== principal) errors.push('대출원금은 원 단위 정수로 입력하세요.');
    else if (principal > LIMITS.MAX_PRINCIPAL) errors.push('대출원금은 100억원 이하로 입력하세요.');

    function rate(v, name) {
      var r = parseNum(v);
      if (!isFinite(r)) { errors.push(name + '를 입력하세요. (예: 4.5)'); return NaN; }
      if (r < 0) { errors.push(name + '는 0% 이상이어야 합니다.'); return NaN; }
      if (r > LIMITS.MAX_RATE) { errors.push(name + '는 연 100% 이하로 입력하세요.'); return NaN; }
      if (r > LIMITS.WARN_RATE) warnings.push(name + ' 연 ' + r + '%는 일반적인 대출금리 범위(연 20% 이하)를 크게 벗어난 값입니다. 입력값을 다시 확인하세요.');
      return r;
    }
    var baseRate = rate(raw.baseRate, '기준 금리');
    var compareRate = rate(raw.compareRate, '비교할 금리');

    var unit = raw.termUnit === 'month' ? 'month' : 'year';
    var term = parseNum(raw.term), months = NaN;
    if (!isFinite(term)) errors.push('상환기간을 입력하세요.');
    else if (term <= 0) errors.push('상환기간은 0보다 커야 합니다.');
    else if (Math.floor(term) !== term) errors.push('상환기간은 정수로 입력하세요. (1년 6개월은 18개월로)');
    else {
      months = unit === 'year' ? term * 12 : term;
      if (months > LIMITS.MAX_MONTHS) { errors.push('상환기간은 최대 40년(480개월)까지 계산합니다.'); months = NaN; }
    }

    var type = raw.repaymentType;
    if (!TYPES[type]) errors.push('상환방식을 선택하세요.');

    var income = null, s = raw.income == null ? '' : String(raw.income).replace(/[,\s]/g, '');
    if (s !== '') {
      var inc = parseNum(s);
      if (!isFinite(inc)) errors.push('월소득은 숫자로 입력하세요. (입력하지 않아도 계산됩니다)');
      else if (inc <= 0) incomeNote = '월소득이 0원 이하라 소득 대비 부담률은 계산하지 않았습니다.';
      else income = inc;
    }

    if (errors.length) return { errors: errors, warnings: warnings, values: null, incomeNote: incomeNote };
    return {
      errors: [], warnings: warnings, incomeNote: incomeNote,
      values: { principal: principal, baseRate: baseRate, compareRate: compareRate, months: months, term: term, termUnit: unit, repaymentType: type, income: income }
    };
  }

  function cleanBalance(b) { return Math.abs(b) < EPS_BALANCE ? 0 : b; }

  /* 월별 상환 스케줄. principalFor(k, balance)가 k회차 원금을 정한다. 마지막 회차는 남은 잔액 전부를 상환해 잔액을 정확히 0으로 맞춘다. */
  function buildAmortizationSchedule(principal, annualRate, months, principalFor) {
    var r = monthlyRate(annualRate), balance = principal, schedule = [];
    for (var k = 1; k <= months; k++) {
      var interest = balance * r;
      var pay = k === months ? balance : Math.min(principalFor(k, balance), balance);
      balance = k === months ? 0 : Math.max(0, cleanBalance(balance - pay));
      schedule.push({ month: k, payment: pay + interest, principalPayment: pay, interest: interest, remainingPrincipal: balance });
    }
    return schedule;
  }

  function calculateFirstYearInterest(schedule) {
    var sum = 0, m = Math.min(12, schedule.length);
    for (var i = 0; i < m; i++) sum += schedule[i].interest;
    return sum;
  }

  function summarize(principal, annualRate, months, type, schedule, extra) {
    var totalInterest = 0;
    for (var i = 0; i < schedule.length; i++) totalInterest += schedule[i].interest;
    var res = {
      principal: principal, annualRate: annualRate, months: months, repaymentType: type,
      firstMonthlyPayment: schedule[0].payment,
      averageMonthlyPayment: (principal + totalInterest) / months,
      lastMonthlyPayment: schedule[months - 1].payment,
      totalInterest: totalInterest,
      totalPayment: principal + totalInterest,
      firstYearInterest: calculateFirstYearInterest(schedule),
      firstYearMonths: Math.min(12, months),
      schedule: schedule
    };
    for (var key in extra) res[key] = extra[key];
    return res;
  }

  // 원리금균등: M = P·r·(1+r)^n / ((1+r)^n − 1), 0%면 M = P / n
  function equalPaymentAmount(principal, annualRate, months) {
    var r = monthlyRate(annualRate);
    if (r === 0) return principal / months;
    var f = Math.pow(1 + r, months);
    return principal * r * f / (f - 1);
  }
  // k회차 원금은 M·(1+r)^−(n−k+1) 항등식으로 구한다. 'M − 잔액×r' 점화식은 고금리·장기에서
  // 부동소수 오차가 (1+r)^k배로 커져(예: 연 74.8%·480개월에서 총이자 약 35만원 오차) 쓰지 않는다.
  function calculateEqualPaymentLoan(principal, annualRate, months) {
    var M = equalPaymentAmount(principal, annualRate, months), r = monthlyRate(annualRate);
    var schedule = buildAmortizationSchedule(principal, annualRate, months, function (k) { return r === 0 ? M : M * Math.pow(1 + r, k - months - 1); });
    return summarize(principal, annualRate, months, 'equalPayment', schedule, { monthlyPayment: M, monthlyBurden: M });
  }

  // 원금균등: 매월 원금 P/n + 잔액 × 월이율
  function calculateEqualPrincipalLoan(principal, annualRate, months) {
    var mp = principal / months;
    var schedule = buildAmortizationSchedule(principal, annualRate, months, function () { return mp; });
    return summarize(principal, annualRate, months, 'equalPrincipal', schedule, { monthlyPrincipal: mp, monthlyBurden: schedule[0].payment });
  }

  // 만기일시: 매월 이자(P × 월이율)만, 마지막 회차에 원금 P
  function calculateBulletLoan(principal, annualRate, months) {
    var schedule = buildAmortizationSchedule(principal, annualRate, months, function () { return 0; });
    var mi = principal * monthlyRate(annualRate);
    return summarize(principal, annualRate, months, 'bullet', schedule, { monthlyInterest: mi, maturityPrincipal: principal, monthlyBurden: mi });
  }

  function calculateLoan(principal, annualRate, months, type) {
    if (type === 'equalPayment') return calculateEqualPaymentLoan(principal, annualRate, months);
    if (type === 'equalPrincipal') return calculateEqualPrincipalLoan(principal, annualRate, months);
    if (type === 'bullet') return calculateBulletLoan(principal, annualRate, months);
    throw new Error('unknown repaymentType: ' + type);
  }

  // 두 금리를 각각 독립 계산해 비교 (B − A). 월 부담 비교 기준: 원리금균등=월 상환액, 원금균등=첫 달 상환액, 만기일시=월 이자
  function calculateLoanComparison(v) {
    var base = calculateLoan(v.principal, v.baseRate, v.months, v.repaymentType);
    var comp = calculateLoan(v.principal, v.compareRate, v.months, v.repaymentType);
    var comparison = {
      rateDifference: Math.round((v.compareRate - v.baseRate) * 1e10) / 1e10,
      monthlyBasis: v.repaymentType === 'equalPayment' ? 'monthlyPayment' : v.repaymentType === 'equalPrincipal' ? 'firstMonthlyPayment' : 'monthlyInterest',
      monthlyPaymentDifference: comp.monthlyBurden - base.monthlyBurden,
      averageMonthlyPaymentDifference: comp.averageMonthlyPayment - base.averageMonthlyPayment,
      totalInterestDifference: comp.totalInterest - base.totalInterest,
      firstYearInterestDifference: comp.firstYearInterest - base.firstYearInterest,
      totalPaymentDifference: comp.totalPayment - base.totalPayment,
      firstYearIsWholeTerm: v.months < 12
    };
    return { base: base, compare: comp, comparison: comparison };
  }

  // 입력한 월소득 대비 이번 대출의 월 부담(%). 소득 없음·0 이하 → null (DSR 아님)
  function calculateIncomeBurden(monthlyAmount, income) {
    if (!(income > 0) || !isFinite(monthlyAmount)) return null;
    return monthlyAmount / income * 100;
  }

  // 표시용: 원 단위 반올림 + 콤마 (-0 방지)
  function formatMoney(x) {
    var n = Math.round(x);
    if (n === 0) n = 0;
    return n.toLocaleString('ko-KR') + '원';
  }
  // 표시용: 만원 단위 요약 (예: 약 432만원, 약 1억 2,345만원)
  function formatManwon(x) {
    var a = Math.abs(Math.round(x));
    if (a < 10000) return a.toLocaleString('ko-KR') + '원';
    var man = Math.round(a / 10000), eok = Math.floor(man / 10000), rest = man % 10000;
    if (!eok) return man.toLocaleString('ko-KR') + '만원';
    return eok.toLocaleString('ko-KR') + '억' + (rest ? ' ' + rest.toLocaleString('ko-KR') + '만원' : '원');
  }
  // 표시용: 금리 % (정수 금리도 소수 1자리, 최대 3자리)
  function formatRate(x) {
    var s = (Math.round(x * 1000) / 1000).toFixed(3).replace(/0+$/, '');
    if (/\.$/.test(s)) s += '0';
    return s + '%';
  }
  // 표시용: 퍼센트포인트 (+2.5%p, −1.25%p, 0.0%p)
  function formatPoint(x) {
    var v = Math.round(x * 1000) / 1000;
    if (v === 0) return '0.0%p';
    return (v > 0 ? '+' : '−') + formatRate(Math.abs(v)).replace('%', '%p');
  }

  var api = {
    LIMITS: LIMITS, TYPES: TYPES,
    monthlyRate: monthlyRate, parseNum: parseNum,
    validateLoanInputs: validateLoanInputs,
    buildAmortizationSchedule: buildAmortizationSchedule,
    calculateFirstYearInterest: calculateFirstYearInterest,
    equalPaymentAmount: equalPaymentAmount,
    calculateEqualPaymentLoan: calculateEqualPaymentLoan,
    calculateEqualPrincipalLoan: calculateEqualPrincipalLoan,
    calculateBulletLoan: calculateBulletLoan,
    calculateLoan: calculateLoan,
    calculateLoanComparison: calculateLoanComparison,
    calculateIncomeBurden: calculateIncomeBurden,
    formatMoney: formatMoney, formatManwon: formatManwon, formatRate: formatRate, formatPoint: formatPoint
  };
  root.LoanRateCompare = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
