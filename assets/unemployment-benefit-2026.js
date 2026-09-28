/* 실업급여(구직급여) 계산 엔진 — 2026년 1월 1일 이후 이직자, 일반 상용근로자 기준
   UI 코드와 분리: 페이지는 validateUnemploymentInputs() → calculateUnemploymentBenefit() 만 호출한다.
   2027년 기준 변경 시 UNEMPLOYMENT_BENEFIT_2026 상수만 복제·수정하면 된다. */
(function (root) {
  'use strict';

  var UNEMPLOYMENT_BENEFIT_2026 = {
    year: 2026,
    replacementRate: { num: 6, den: 10 },   // 평균임금 × 60% (정수 연산으로 부동소수 오차 방지)
    dailyMax: 68100,                         // 1일 상한액
    // 1일 하한액 = 최저임금 10,320원 × 80% × 1일 소정근로시간
    dailyMinByHours: { 1: 8256, 2: 16512, 3: 24768, 4: 33024, 5: 41280, 6: 49536, 7: 57792, 8: 66048 },
    seniorAge: 50,                           // 만 50세 이상 → 50세 이상·장애인 지급일수표
    // 지급일수표: [가입기간(개월) 미만 기준, 지급일수]
    benefitDays: {
      general:          [[12, 120], [36, 150], [60, 180], [120, 210], [Infinity, 240]],
      seniorOrDisabled: [[12, 120], [36, 180], [60, 210], [120, 240], [Infinity, 270]]
    },
    limits: { ageMin: 15, ageMax: 100, maxYears: 60, maxMonthsInput: 720, maxWage3m: 1000000000, maxDays3m: 92 }
  };
  var C = UNEMPLOYMENT_BENEFIT_2026;

  /* ── 입력 파싱 ── */
  // 콤마·공백 허용, 0 이상 정수만 통과. 그 외(문자, 소수, 음수, 빈값)는 상태 코드로 돌려준다.
  function parseIntInput(v) {
    var s = String(v == null ? '' : v).replace(/[,\s]/g, '');
    if (s === '') return { ok: false, code: 'empty' };
    if (/^-\d+$/.test(s)) return { ok: false, code: 'negative' };
    if (!/^\d+$/.test(s)) return { ok: false, code: 'nan' };
    var n = Number(s);
    if (!isFinite(n) || n > Number.MAX_SAFE_INTEGER) return { ok: false, code: 'nan' };
    return { ok: true, value: n };
  }

  /* ── 날짜: 시작일·종료일 모두 포함한 일수 ── */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var t = Date.UTC(y, mo - 1, d);
    var dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null; // 2026-02-30 등
    return t;
  }
  function countDaysInclusive(startStr, endStr) {
    var a = parseDate(startStr), b = parseDate(endStr);
    if (a === null || b === null) return { ok: false, code: 'invalid' };
    if (b < a) return { ok: false, code: 'reversed' };
    return { ok: true, value: Math.round((b - a) / 86400000) + 1 };
  }

  /* ── 가입기간: 년+개월 → 총 개월 (12개월 이상은 자동 환산) ── */
  function normalizeInsuredPeriod(years, months) {
    var total = years * 12 + months;
    return { totalMonths: total, years: Math.floor(total / 12), months: total % 12 };
  }

  /* ── 계산 함수 ── */
  // 1일 평균임금 = 3개월 임금총액 ÷ 총일수 (원 미만 절사)
  function calculateAverageWage(wageTotal, days) {
    return Math.floor(wageTotal / days);
  }

  // 1일 구직급여 = max(시간별 하한, min(평균임금 × 60%, 상한))  (원 미만 절사)
  function calculateDailyBenefit(avgWage, hours) {
    var base = Math.floor(avgWage * C.replacementRate.num / C.replacementRate.den);
    var lower = C.dailyMinByHours[hours];
    var capped = Math.min(base, C.dailyMax);
    var final = Math.max(lower, capped);
    var applied = base > C.dailyMax ? 'upper' : (capped < lower ? 'lower' : 'none');
    return { base: base, lower: lower, upper: C.dailyMax, final: final, applied: applied };
  }

  function getBenefitDays(totalMonths, age, disabled) {
    var senior = !!disabled || age >= C.seniorAge;
    var table = senior ? C.benefitDays.seniorOrDisabled : C.benefitDays.general;
    for (var i = 0; i < table.length; i++) {
      if (totalMonths < table[i][0]) return { days: table[i][1], table: senior ? 'seniorOrDisabled' : 'general' };
    }
    return null;
  }

  function calculateTotalBenefit(daily, days) { return daily * days; }

  function periodBandLabel(totalMonths) {
    if (totalMonths < 12) return '1년 미만';
    if (totalMonths < 36) return '1년 이상 3년 미만';
    if (totalMonths < 60) return '3년 이상 5년 미만';
    if (totalMonths < 120) return '5년 이상 10년 미만';
    return '10년 이상';
  }

  /* ── 입력 검증: raw 문자열 → { errors:[], values } ── */
  var REASONS = ['recommended', 'contract', 'closure', 'retirement', 'voluntary', 'justified'];
  var UNIT = ['yes', 'no', 'unknown'];

  function validateUnemploymentInputs(raw) {
    var e = [], v = {}, L = C.limits, p;

    p = parseIntInput(raw.age);
    if (!p.ok) e.push(p.code === 'empty' ? '퇴사 당시 만 나이를 입력하세요.' : '만 나이는 숫자(정수)로만 입력하세요.');
    else if (p.value <= 0) e.push('만 나이는 0보다 커야 합니다.');
    else if (p.value < L.ageMin || p.value > L.ageMax) e.push('만 나이는 ' + L.ageMin + '~' + L.ageMax + '세 범위로 입력하세요.');
    else v.age = p.value;

    if (raw.disabled !== 'yes' && raw.disabled !== 'no') e.push('장애인 여부를 선택하세요.');
    else v.disabled = raw.disabled === 'yes';

    var py = parseIntInput(raw.years), pm = parseIntInput(raw.months);
    if (py.code === 'empty' && pm.code === 'empty') e.push('고용보험 가입기간(년·개월)을 입력하세요.');
    else {
      var yOk = py.ok || py.code === 'empty', mOk = pm.ok || pm.code === 'empty';
      if (!yOk || !mOk) e.push('가입기간은 0 이상의 정수로 입력하세요.');
      else {
        var yy = py.ok ? py.value : 0, mm = pm.ok ? pm.value : 0;
        if (yy > L.maxYears || mm > L.maxMonthsInput || yy * 12 + mm > L.maxYears * 12) e.push('가입기간이 비정상적으로 깁니다. ' + L.maxYears + '년 이하로 입력하세요.');
        else if (yy * 12 + mm <= 0) e.push('가입기간은 1개월 이상이어야 합니다.');
        else { v.inputYears = yy; v.inputMonths = mm; v.period = normalizeInsuredPeriod(yy, mm); }
      }
    }

    p = parseIntInput(raw.wage);
    if (!p.ok) e.push(p.code === 'empty' ? '퇴직 전 3개월 임금총액을 입력하세요.' : p.code === 'negative' ? '임금총액은 음수일 수 없습니다.' : '임금총액은 숫자로만 입력하세요.');
    else if (p.value <= 0) e.push('임금총액은 0원보다 커야 합니다.');
    else if (p.value > L.maxWage3m) e.push('임금총액이 비정상적으로 큽니다. 다시 확인하세요.');
    else v.wage = p.value;

    if (raw.daysMode === 'date') {
      if (!raw.startDate || !raw.endDate) e.push('3개월 기간의 시작일과 종료일을 모두 입력하세요.');
      else {
        var d = countDaysInclusive(raw.startDate, raw.endDate);
        if (!d.ok) e.push(d.code === 'reversed' ? '종료일이 시작일보다 빠릅니다.' : '날짜 형식이 올바르지 않습니다.');
        else if (d.value > L.maxDays3m) e.push('퇴직 전 3개월 기간은 최대 ' + L.maxDays3m + '일입니다. 날짜를 확인하세요. (현재 ' + d.value + '일)');
        else v.days = d.value;
      }
    } else {
      p = parseIntInput(raw.days);
      if (!p.ok) e.push(p.code === 'empty' ? '퇴직 전 3개월 총 일수를 입력하세요.' : p.code === 'negative' ? '총 일수는 음수일 수 없습니다.' : '총 일수는 숫자(정수)로만 입력하세요.');
      else if (p.value <= 0) e.push('총 일수는 1일 이상이어야 합니다.');
      else if (p.value > L.maxDays3m) e.push('퇴직 전 3개월 총 일수는 최대 ' + L.maxDays3m + '일입니다.');
      else v.days = p.value;
    }

    p = parseIntInput(raw.hours);
    if (!p.ok) e.push('1일 소정근로시간을 선택하세요.');
    else if (!C.dailyMinByHours[p.value]) e.push('1일 소정근로시간은 1~8시간 중에서 선택하세요.');
    else v.hours = p.value;

    if (REASONS.indexOf(raw.reason) < 0) e.push('퇴사사유를 선택하세요.');
    else v.reason = raw.reason;

    if (UNIT.indexOf(raw.unitPeriod) < 0) e.push('피보험단위기간 180일 충족 여부를 선택하세요.');
    else v.unitPeriod = raw.unitPeriod;

    return { errors: e, values: e.length ? null : v };
  }

  /* ── 전체 계산 (검증된 values만 받는다) ── */
  function calculateUnemploymentBenefit(v) {
    var avg = calculateAverageWage(v.wage, v.days);
    var daily = calculateDailyBenefit(avg, v.hours);
    var bd = getBenefitDays(v.period.totalMonths, v.age, v.disabled);
    var total = calculateTotalBenefit(daily.final, bd.days);
    var out = {
      averageWage: avg, daily: daily, benefitDays: bd.days, daysTable: bd.table,
      periodBand: periodBandLabel(v.period.totalMonths),
      approxMonths: Math.round(bd.days / 30), per30: daily.final * 30, total: total
    };
    // 화면 노출값 최종 방어: 유한한 0 이상 정수가 아니면 결과를 내지 않는다
    var nums = [avg, daily.base, daily.final, bd.days, out.per30, total];
    for (var i = 0; i < nums.length; i++) if (!isFinite(nums[i]) || nums[i] < 0 || Math.floor(nums[i]) !== nums[i]) return null;
    return out;
  }

  var api = {
    UNEMPLOYMENT_BENEFIT_2026: C,
    parseIntInput: parseIntInput, countDaysInclusive: countDaysInclusive, normalizeInsuredPeriod: normalizeInsuredPeriod,
    calculateAverageWage: calculateAverageWage, calculateDailyBenefit: calculateDailyBenefit,
    getBenefitDays: getBenefitDays, calculateTotalBenefit: calculateTotalBenefit,
    validateUnemploymentInputs: validateUnemploymentInputs, calculateUnemploymentBenefit: calculateUnemploymentBenefit
  };
  root.UnemploymentBenefit2026 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
