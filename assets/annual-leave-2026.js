/* 연차·연차수당 계산 엔진 — 근로기준법 제60조, 같은 법 시행령 제9조·별표2 기준 (입사일 기준 산정)
   UI 코드와 분리: 페이지는 validateAnnualLeaveInputs() → calculateAnnualLeave() 만 호출한다.
   결과의 '발생 연차'는 입사일 기준 "현재 연차 산정기간"에 새로 발생한 법정 연차만 뜻한다(과거 기간 누적·이월 미포함). */
(function (root) {
  'use strict';

  var ANNUAL_LEAVE = {
    BASE_DAYS: 15,            // 1년간 80% 이상 출근 시 (제60조 ①)
    MAX_DAYS: 25,             // 가산 포함 한도 (제60조 ④)
    FIRST_YEAR_MAX: 11,       // 1년 미만: 1개월 개근당 1일, 최대 11일 (제60조 ②)
    LOW_ATTENDANCE_MAX: 11,   // 1년 이상·출근율 80% 미만: 직전 1년 개근월 수만큼 (제60조 ②). 12개월 개근은 80% 미만과 모순
    MIN_WEEKLY_HOURS: 15,     // 4주 평균 주 소정근로 15시간 미만은 적용 제외 (제18조 ③)
    MAX_WEEKLY_HOURS: 40,     // 소정근로시간은 법정근로시간(주 40시간) 범위 안 (제2조 ① 8호)
    MAX_DAILY_HOURS: 8,
    PART_TIME_DAY_HOURS: 8,   // 단시간근로자 환산식의 8시간 (시행령 별표2 제4호 나목)
    DEFAULT_BASE_HOURS: 209,
    DEFAULT_FULLTIME_WEEKLY: 40,
    MAX_WAGE: 100000000,      // 비정상 입력 방지(월 1억원)
    MAX_BASE_HOURS: 744       // 한 달 최대 시간(31일 × 24)
  };
  var A = ANNUAL_LEAVE;

  /* ── 날짜: 'YYYY-MM-DD' 를 정수로만 다룬다(시간대 영향 없음) ── */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return { y: y, m: mo, d: d };
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function key(dt) { return dt.y * 10000 + dt.m * 100 + dt.d; }

  /* 입사일로부터 k개월이 끝나고 다음 날(= 권리가 생기는 날).
     민법 기간 계산: 기간 말일은 기산일에 해당하는 날의 전날, 해당일이 없으면 그 달 말일.
     → 해당일이 있으면 그 날, 없으면(예: 1/31 입사의 2월) 다음 달 1일. */
  function anniversary(hire, months) {
    var t = hire.m - 1 + months, y = hire.y + Math.floor(t / 12), m = t % 12 + 1;
    if (hire.d <= daysInMonth(y, m)) return { y: y, m: m, d: hire.d };
    return m === 12 ? { y: y + 1, m: 1, d: 1 } : { y: y, m: m + 1, d: 1 };
  }

  // 완료한 계속근로연수: 입사 N주년(해당일) 당일부터 N년 완료로 본다.
  function calculateCompletedYears(hire, base) {
    var n = base.y - hire.y + 1;
    while (n > 0 && key(anniversary(hire, n * 12)) > key(base)) n--;
    return Math.max(0, n);
  }

  // 입사일부터 기준일까지 날짜상 끝난 1개월 구간 수(달력 기준, 30일 근사 없음).
  // k번째 구간의 권리는 그 구간 근로를 마친 다음 날(anniversary) 생긴다. 1년 미만이면 결과는 0~11.
  function calculateCompletedMonthlyPeriods(hire, base) {
    var k = Math.max(0, (base.y - hire.y) * 12 + (base.m - hire.m) + 1);
    while (k > 0 && key(anniversary(hire, k)) > key(base)) k--;
    return k;
  }

  // 1년 이상 + 출근율 80% 이상: 15일 + 최초 1년 초과 근속 2년마다 1일, 최대 25일
  function calculateAnnualLeaveDays(completedYears) {
    if (!(completedYears >= 1)) return null;
    return Math.min(A.BASE_DAYS + Math.floor((completedYears - 1) / 2), A.MAX_DAYS);
  }

  // 1년 미만 또는 1년 이상·출근율 80% 미만: 1개월 개근마다 1일(장기근속 가산 없음)
  function calculateLowAttendanceLeave(fullMonths, cap) {
    return Math.min(fullMonths, cap);
  }

  /* ── 단시간근로자 1시간 미만 처리: 이 함수 한 곳에서만 한다 ──
     시행령 별표2 제4호 나목 후단 "1시간 미만은 1시간으로 본다" → 올림.
     부동소수 오차(예: 59.99999999)로 한 시간이 더 붙지 않도록 미세 오차는 먼저 걷어낸다. */
  function roundLeaveHours(h) {
    var r = Math.round(h * 1e6) / 1e6;
    return Math.ceil(r);
  }

  // 통상근로자 연차일수 × 단시간 주 소정근로 ÷ 통상근로자 주 소정근로 × 8시간
  function calculatePartTimeLeaveHours(days, weeklyHours, fullTimeWeeklyHours) {
    return roundLeaveHours(days * weeklyHours * A.PART_TIME_DAY_HOURS / fullTimeWeeklyHours);
  }

  function calculateHourlyOrdinaryWage(monthlyWage, baseHours) { return monthlyWage / baseHours; }
  function calculateDailyLeaveValue(monthlyWage, baseHours, dailyHours) { return monthlyWage * dailyHours / baseHours; }

  /* 예상 미사용 연차수당: 중간 반올림 없이 곱한 뒤 마지막에 원 단위 반올림(계산기 표시정책).
     일반: 월 통상임금 × 1일 소정근로시간 × 남은 일수 ÷ 기준시간
     단시간: 월 통상임금 × 남은 시간 ÷ 기준시간 */
  function calculateUnusedLeavePay(monthlyWage, baseHours, remainingHoursEquivalent) {
    return Math.round(monthlyWage * remainingHoursEquivalent / baseHours);
  }

  // 법정 연차 적용 대상 여부(5인·주15시간). 대상이면 null, 아니면 사유 코드.
  function validateAnnualLeaveEligibility(size, weeklyHours) {
    if (size === 'lt5') return 'excluded5';
    if (weeklyHours < A.MIN_WEEKLY_HOURS) return 'excluded15';
    return null;
  }

  // 사용량이 발생량을 넘으면 오류 문구, 아니면 null
  function validateLeaveUsage(accrued, used, unit) {
    if (used > accrued) return (unit === 'hour' ? '사용한 연차시간이 현재 계산된 발생 연차시간' : '사용한 연차가 현재 계산된 발생 연차') +
      '보다 많습니다. 입력값 또는 전년도 이월연차 여부를 확인해주세요.';
    return null;
  }

  /* ── 입력 검증 ── */
  function parseNum(s) {
    var t = String(s == null ? '' : s).replace(/,/g, '').trim();
    if (t === '') return { empty: true };
    if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(t)) return { bad: true };
    var n = parseFloat(t);
    return isFinite(n) ? { n: n } : { bad: true };
  }

  // 숫자 한 칸 검사. opt: {label, min(초과 조건), minInclusive, max, int}
  function num(raw, label, opt, e) {
    var p = parseNum(raw);
    if (p.empty) { e.push(label + '을(를) 입력하세요.'); return null; }
    if (p.bad) { e.push(label + '은(는) 숫자로 입력하세요.'); return null; }
    var n = p.n;
    if (n < 0) { e.push(label + '은(는) 음수일 수 없습니다.'); return null; }
    if (opt.positive && n <= 0) { e.push(label + '은(는) 0보다 커야 합니다.'); return null; }
    if (opt.int && Math.floor(n) !== n) { e.push(label + '은(는) 정수로 입력하세요.'); return null; }
    if (opt.max != null && n > opt.max) { e.push(opt.maxMsg || (label + '은(는) ' + opt.max + ' 이하로 입력하세요.')); return null; }
    return n;
  }

  /* raw: { hireDate, baseDate, size('ge5'|'lt5'), workerType('full'|'part'), weeklyHours, fullTimeWeeklyHours,
            dailyHours, attendance('ge80'|'lt80'|'unknown'), fullMonths, used, monthlyWage, baseHours }
     반환: { errors, values, stage } — stage 는 검증이 어디서 끝났는지(적용 제외면 뒤 항목은 묻지 않는다). */
  function validateAnnualLeaveInputs(raw) {
    var e = [], v = {};
    var hire = parseDate(raw.hireDate), base = parseDate(raw.baseDate);
    if (!hire) e.push('입사일을 입력하세요.');
    if (!base) e.push('계산 기준일을 입력하세요.');
    if (hire && base && key(base) < key(hire)) e.push('계산 기준일이 입사일보다 빠릅니다. 날짜를 확인하세요.');
    if (raw.size !== 'ge5' && raw.size !== 'lt5') e.push('상시근로자 규모를 선택하세요.');
    if (raw.workerType !== 'full' && raw.workerType !== 'part') e.push('근로형태를 선택하세요.');
    if (e.length) return { errors: e, values: null };
    v.hire = hire; v.base = base; v.size = raw.size; v.workerType = raw.workerType;
    v.completedYears = calculateCompletedYears(hire, base);
    v.maxFirstYearMonths = v.completedYears === 0 ? calculateCompletedMonthlyPeriods(hire, base) : null;

    // 적용 제외면 여기서 끝(임금 등 나머지 입력은 요구하지 않는다). 5인 미만은 근로시간과 무관하게 제외.
    if (v.size === 'lt5') { v.excluded = 'excluded5'; return { errors: [], values: v }; }
    var weekly = num(raw.weeklyHours, '주 소정근로시간', { positive: true, max: A.MAX_WEEKLY_HOURS,
      maxMsg: '주 소정근로시간은 법정근로시간(주 40시간) 범위에서 정하므로 40시간 이하로 입력하세요.' }, e);
    if (e.length) return { errors: e, values: null };
    v.weeklyHours = weekly;
    v.excluded = validateAnnualLeaveEligibility(v.size, weekly);
    if (v.excluded) return { errors: [], values: v };

    if (v.workerType === 'part') {
      v.fullTimeWeeklyHours = num(raw.fullTimeWeeklyHours, '동종 통상근로자의 주 소정근로시간', { positive: true, max: A.MAX_WEEKLY_HOURS,
        maxMsg: '동종 통상근로자의 주 소정근로시간은 40시간 이하로 입력하세요.' }, e);
      if (v.fullTimeWeeklyHours != null && weekly >= v.fullTimeWeeklyHours)
        e.push('단시간근로자는 주 소정근로시간이 동종 통상근로자보다 짧아야 합니다. 같다면 근로형태를 \'일반근로자\'로 선택하세요.');
    } else {
      v.dailyHours = num(raw.dailyHours, '1일 소정근로시간', { positive: true, max: A.MAX_DAILY_HOURS,
        maxMsg: '1일 소정근로시간은 법정근로시간(1일 8시간) 범위에서 정하므로 8시간 이하로 입력하세요.' }, e);
    }

    // 산정 방식 결정: 1년 미만 / 1년 이상 + 출근율
    if (v.completedYears === 0) {
      v.basis = 'firstYear';
      var fm = num(raw.fullMonths, '개근한 1개월 구간 수', { int: true, max: A.FIRST_YEAR_MAX }, e);
      if (fm != null && fm > v.maxFirstYearMonths)
        e.push('개근월은 입사일부터 계산 기준일까지 끝난 1개월 구간 수(' + v.maxFirstYearMonths + '개월)보다 클 수 없습니다.');
      else v.fullMonths = fm;
    } else {
      if (['ge80', 'lt80', 'unknown'].indexOf(raw.attendance) < 0) e.push('직전 1년 출근율을 선택하세요.');
      else v.attendance = raw.attendance;
      if (v.attendance === 'lt80') {
        v.basis = 'lowAttendance';
        if (parseNum(raw.fullMonths).n === 12) e.push('12개월 모두 개근한 경우 출근율 80% 미만과 동시에 선택할 수 없습니다. 입력값을 다시 확인해주세요.');
        else v.fullMonths = num(raw.fullMonths, '직전 1년 동안 개근한 월 수', { int: true, max: A.LOW_ATTENDANCE_MAX,
          maxMsg: '직전 1년 동안 개근한 월 수는 0~11개월로 입력하세요.' }, e);
      } else if (v.attendance === 'ge80') v.basis = 'regular';
      else if (v.attendance === 'unknown') v.basis = 'unknown';
    }
    // 출근율 미확인: 확정 계산을 하지 않으므로 사용량·임금은 요구하지 않는다
    if (v.basis === 'unknown') return e.length ? { errors: e, values: null } : { errors: [], values: v };

    v.used = num(raw.used, v.workerType === 'part' ? '이미 사용한 연차시간' : '이미 사용한 연차 일수', {}, e);
    v.monthlyWage = num(raw.monthlyWage, '월 통상임금', { positive: true, max: A.MAX_WAGE, maxMsg: '월 통상임금은 1억원 이하로 입력하세요.' }, e);
    v.baseHours = num(raw.baseHours, '월 통상임금 산정 기준시간', { positive: true, max: A.MAX_BASE_HOURS }, e);
    if (e.length) return { errors: e, values: null };

    // 사용량 > 발생량 은 계산 단계가 아니라 입력 오류로 막는다(음수 잔여 표시 금지)
    var acc = accrue(v);
    var usageErr = validateLeaveUsage(v.workerType === 'part' ? acc.hours : acc.days, v.used, v.workerType === 'part' ? 'hour' : 'day');
    if (usageErr) return { errors: [usageErr], values: null };
    return { errors: [], values: v };
  }

  // 발생 연차(일, 단시간이면 시간까지)
  function accrue(v) {
    var days;
    if (v.basis === 'firstYear') days = calculateLowAttendanceLeave(v.fullMonths, A.FIRST_YEAR_MAX);
    else if (v.basis === 'lowAttendance') days = calculateLowAttendanceLeave(v.fullMonths, A.LOW_ATTENDANCE_MAX);
    else days = calculateAnnualLeaveDays(v.completedYears);
    var out = { days: days, bonus: v.basis === 'regular' ? days - A.BASE_DAYS : 0 };
    if (v.workerType === 'part') out.hours = calculatePartTimeLeaveHours(days, v.weeklyHours, v.fullTimeWeeklyHours);
    return out;
  }

  function calculateAnnualLeave(v) {
    if (!v) return null;
    var out = { completedYears: v.completedYears, maxFirstYearMonths: v.maxFirstYearMonths, workerType: v.workerType };
    if (v.excluded) { out.status = v.excluded; return out; }
    if (v.basis === 'unknown') {
      out.status = 'unknownAttendance';
      out.estimateDays = calculateAnnualLeaveDays(v.completedYears);   // 80% 이상일 경우 예상값(참고)
      if (v.workerType === 'part' && v.fullTimeWeeklyHours) out.estimateHours = calculatePartTimeLeaveHours(out.estimateDays, v.weeklyHours, v.fullTimeWeeklyHours);
      return out;
    }
    out.status = 'ok';
    out.basis = v.basis;
    var acc = accrue(v);
    out.days = acc.days; out.bonus = acc.bonus;
    out.hourly = calculateHourlyOrdinaryWage(v.monthlyWage, v.baseHours);
    if (v.workerType === 'part') {
      out.hours = acc.hours; out.usedHours = v.used; out.remainingHours = acc.hours - v.used;
      out.payRaw = v.monthlyWage * out.remainingHours / v.baseHours;
      out.pay = calculateUnusedLeavePay(v.monthlyWage, v.baseHours, out.remainingHours);
    } else {
      out.usedDays = v.used; out.remainingDays = Math.round((acc.days - v.used) * 1e6) / 1e6;
      out.dailyValue = calculateDailyLeaveValue(v.monthlyWage, v.baseHours, v.dailyHours);
      out.payRaw = v.monthlyWage * v.dailyHours * out.remainingDays / v.baseHours;
      out.pay = calculateUnusedLeavePay(v.monthlyWage, v.baseHours, v.dailyHours * out.remainingDays);
    }
    // 노출 전 최종 방어: 숫자는 모두 유한한 0 이상이어야 한다
    var nums = [out.days, out.hourly, out.pay, out.payRaw, out.hours, out.remainingHours, out.remainingDays, out.dailyValue];
    for (var i = 0; i < nums.length; i++) if (nums[i] !== undefined && (!isFinite(nums[i]) || nums[i] < 0)) return null;
    return out;
  }

  var api = {
    ANNUAL_LEAVE: A,
    parseDate: parseDate, anniversary: anniversary,
    calculateCompletedYears: calculateCompletedYears,
    calculateCompletedMonthlyPeriods: calculateCompletedMonthlyPeriods,
    calculateAnnualLeaveDays: calculateAnnualLeaveDays,
    calculateLowAttendanceLeave: calculateLowAttendanceLeave,
    roundLeaveHours: roundLeaveHours,
    calculatePartTimeLeaveHours: calculatePartTimeLeaveHours,
    calculateHourlyOrdinaryWage: calculateHourlyOrdinaryWage,
    calculateDailyLeaveValue: calculateDailyLeaveValue,
    calculateUnusedLeavePay: calculateUnusedLeavePay,
    validateAnnualLeaveEligibility: validateAnnualLeaveEligibility,
    validateLeaveUsage: validateLeaveUsage,
    validateAnnualLeaveInputs: validateAnnualLeaveInputs,
    calculateAnnualLeave: calculateAnnualLeave
  };
  root.AnnualLeave2026 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
