/* 육아휴직급여 계산 엔진 — 2026년 고용보험법·시행령 기준 (일반 근로자, 완전한 개월 단위)
   UI 코드와 분리: 페이지는 validateParentalLeaveInputs() → calculateParentalLeave() 만 호출한다.
   기준 변경 시 PARENTAL_LEAVE_2026 상수만 수정한다. */
(function (root) {
  'use strict';

  var PARENTAL_LEAVE_2026 = {
    GENERAL: {
      MONTH_1_3:    { RATE: 1,   MIN: 700000, MAX: 2500000 },
      MONTH_4_6:    { RATE: 1,   MIN: 700000, MAX: 2000000 },
      MONTH_7_PLUS: { RATE: 0.8, MIN: 700000, MAX: 1600000 }
    },
    TOGETHER: {
      MIN: 700000,
      CAPS: [2500000, 2500000, 3000000, 3500000, 4000000, 4500000]
    },
    SINGLE_PARENT: {
      MONTH_1_3:    { RATE: 1,   MIN: 700000, MAX: 3000000 },
      MONTH_4_6:    { RATE: 1,   MIN: 700000, MAX: 2000000 },
      MONTH_7_PLUS: { RATE: 0.8, MIN: 700000, MAX: 1600000 }
    },
    BASE_MAX_MONTHS: 12,        // 일반 육아휴직 기간
    EXTENDED_MAX_MONTHS: 18,    // 연장요건 충족 시 6개월 추가
    MAX_WAGE_INPUT: 100000000   // 비정상 입력 방지(월 1억원)
  };
  var P = PARENTAL_LEAVE_2026;

  /* ── 금액 계산 단일 함수: 원 단위 처리 규칙을 여기 한 곳에서 통일 ──
     통상임금 × 지급률 → 원 미만 절사. 지급률은 백분율 정수로 바꿔 정수 연산(부동소수 오차 방지). */
  function calculateMonthlyBenefit(wage, rule) {
    var pct = Math.round(rule.RATE * 100);
    var paid = Math.floor(wage * pct / 100);
    return Math.max(rule.MIN, Math.min(paid, rule.MAX));
  }

  function bandRule(table, month) {
    return month <= 3 ? table.MONTH_1_3 : (month <= 6 ? table.MONTH_4_6 : table.MONTH_7_PLUS);
  }
  function bandKey(month) { return month <= 3 ? 'm1_3' : (month <= 6 ? 'm4_6' : 'm7plus'); }

  // 월별 행 목록 → 구간 합계·총액
  function calculateTotalBenefit(rows) {
    var s = { m1_3: 0, m4_6: 0, m7plus: 0, total: 0 };
    rows.forEach(function (r) { s[bandKey(r.month)] += r.amount; s.total += r.amount; });
    return s;
  }

  function scheduleFrom(wage, months, table, label) {
    var rows = [];
    for (var m = 1; m <= months; m++) rows.push({ month: m, amount: calculateMonthlyBenefit(wage, bandRule(table, m)), basis: label });
    return { rows: rows, sums: calculateTotalBenefit(rows) };
  }

  function calculateGeneralParentalLeaveBenefit(wage, months) {
    return scheduleFrom(wage, months, P.GENERAL, 'general');
  }
  function calculateSingleParentBenefit(wage, months) {
    return scheduleFrom(wage, months, P.SINGLE_PARENT, 'single');
  }

  // 특례 적용 개월 = 각자 사용한 개월 중 공통 개월 수(최대 6). 기간이 달력상 겹치는지는 보지 않는다.
  function getTogetherSpecialMonths(myMonths, spouseMonths) {
    return Math.min(myMonths, spouseMonths, P.TOGETHER.CAPS.length);
  }

  // 한 사람의 부모함께 특례 일정: 1~specialMonths는 특례 월별 상한, 이후는 누적 차수 그대로 일반 기준.
  // (특례 종료 후 일반 1개월차로 되돌아가지 않는다. 자녀 월령으로 중간 중단하지 않는다.)
  function calculateTogetherSpecialBenefit(wage, months, specialMonths) {
    var rows = [];
    for (var m = 1; m <= months; m++) {
      if (m <= specialMonths) {
        rows.push({ month: m, amount: calculateMonthlyBenefit(wage, { RATE: 1, MIN: P.TOGETHER.MIN, MAX: P.TOGETHER.CAPS[m - 1] }), basis: 'together' });
      } else {
        rows.push({ month: m, amount: calculateMonthlyBenefit(wage, bandRule(P.GENERAL, m)), basis: 'general' });
      }
    }
    return { rows: rows, sums: calculateTotalBenefit(rows) };
  }

  /* ── 요건 판단 (사용자 직접 확인값 기반) ── */
  // months > 12 이면 연장요건 필요. answer: both3 | single | disabledChild | none | unknown
  function validateExtensionEligibility(maxMonths, answer) {
    if (maxMonths <= P.BASE_MAX_MONTHS) return { needed: false, status: 'ok' };
    if (answer === 'both3' || answer === 'single' || answer === 'disabledChild') return { needed: true, status: 'ok', reason: answer };
    if (answer === 'none') return { needed: true, status: 'blocked' };
    if (answer === 'unknown') return { needed: true, status: 'check' };
    return { needed: true, status: 'missing' };
  }
  // answer: yes | no | unknown
  function validateInsuranceEligibility(answer) {
    if (answer === 'yes') return { status: 'ok' };
    if (answer === 'no') return { status: 'fail' };
    if (answer === 'unknown') return { status: 'check' };
    return { status: 'missing' };
  }

  /* ── 입력 파싱·검증 ── */
  function parseWage(v) {
    var s = String(v == null ? '' : v).replace(/[,\s]/g, '');
    if (s === '') return { ok: false, code: 'empty' };
    if (/^-\d+$/.test(s)) return { ok: false, code: 'negative' };
    if (!/^\d+$/.test(s)) return { ok: false, code: 'nan' };
    var n = Number(s);
    if (!isFinite(n)) return { ok: false, code: 'nan' };
    if (n <= 0) return { ok: false, code: 'zero' };
    if (n > P.MAX_WAGE_INPUT) return { ok: false, code: 'huge' };
    return { ok: true, value: n };
  }
  function parseMonths(v) {
    var s = String(v == null ? '' : v).trim();
    if (s === '') return { ok: false, code: 'empty' };
    if (!/^\d+$/.test(s)) return { ok: false, code: 'nan' };
    var n = Number(s);
    if (n < 1 || n > P.EXTENDED_MAX_MONTHS) return { ok: false, code: 'range' };
    return { ok: true, value: n };
  }
  var YNU = ['yes', 'no', 'unknown'];
  var EXT = ['both3', 'single', 'disabledChild', 'none', 'unknown'];

  function wageErr(who, p) {
    return { empty: who + ' 월 통상임금을 입력하세요.', negative: who + ' 월 통상임금은 음수일 수 없습니다.', nan: who + ' 월 통상임금은 숫자로만 입력하세요.',
      zero: who + ' 월 통상임금은 0원보다 커야 합니다.', huge: who + ' 월 통상임금이 비정상적으로 큽니다. 다시 확인하세요.' }[p.code];
  }
  function monthErr(who, p) {
    return p.code === 'empty' ? who + ' 육아휴직 사용기간을 선택하세요.' : who + ' 육아휴직 사용기간은 1~18개월 사이의 정수로 입력하세요.';
  }

  // raw: { type, wage, months, insured, extension, spouseWage, spouseMonths, spouseInsured, childAge, singleParent }
  function validateParentalLeaveInputs(raw) {
    var e = [], v = { type: raw.type }, p;
    if (['general', 'together', 'single'].indexOf(raw.type) < 0) return { errors: ['계산 유형을 선택하세요.'], values: null };

    p = parseWage(raw.wage); if (p.ok) v.wage = p.value; else e.push(wageErr('본인', p));
    p = parseMonths(raw.months); if (p.ok) v.months = p.value; else e.push(monthErr('본인', p));
    if (YNU.indexOf(raw.insured) < 0) e.push('본인 피보험단위기간 180일 이상 여부를 선택하세요.'); else v.insured = raw.insured;

    if (raw.type === 'together') {
      p = parseWage(raw.spouseWage); if (p.ok) v.spouseWage = p.value; else e.push(wageErr('배우자', p));
      p = parseMonths(raw.spouseMonths); if (p.ok) v.spouseMonths = p.value; else e.push(monthErr('배우자', p));
      if (YNU.indexOf(raw.childAge) < 0) e.push('부모함께 특례 자녀 연령요건 충족 여부를 선택하세요.'); else v.childAge = raw.childAge;
      if (YNU.indexOf(raw.spouseInsured) < 0) e.push('배우자 피보험단위기간 180일 이상 여부를 선택하세요.'); else v.spouseInsured = raw.spouseInsured;
    }
    if (raw.type === 'single') {
      if (YNU.indexOf(raw.singleParent) < 0) e.push('법령상 한부모 해당 여부를 선택하세요.'); else v.singleParent = raw.singleParent;
    }

    // 연장요건: 13개월 이상 입력이 있을 때만 필요. 한부모 유형에서 한부모 '예'면 요건 ②로 자동 충족.
    var maxM = Math.max(v.months || 0, v.spouseMonths || 0);
    if (maxM > P.BASE_MAX_MONTHS) {
      if (raw.type === 'single' && v.singleParent === 'yes') v.extension = 'single';
      else if (EXT.indexOf(raw.extension) < 0) e.push('육아휴직 6개월 추가 사용요건 충족 여부를 선택하세요.');
      else v.extension = raw.extension;
    }
    return { errors: e, values: e.length ? null : v };
  }

  /* ── 전체 계산 ── */
  function calculateParentalLeave(v) {
    var maxM = Math.max(v.months, v.spouseMonths || 0);
    var ext = validateExtensionEligibility(maxM, v.extension);
    var out = { type: v.type, extension: ext, insured: validateInsuranceEligibility(v.insured), notices: [] };
    if (ext.status === 'blocked') { out.blocked = true; return out; }   // 13~18개월인데 연장요건 없음 → 결과 미출력

    if (v.type === 'general') {
      out.me = calculateGeneralParentalLeaveBenefit(v.wage, v.months);
    } else if (v.type === 'single') {
      out.singleStatus = v.singleParent;
      out.me = v.singleParent === 'no' ? calculateGeneralParentalLeaveBenefit(v.wage, v.months) : calculateSingleParentBenefit(v.wage, v.months);
    } else {
      out.spouseInsured = validateInsuranceEligibility(v.spouseInsured);
      out.childAge = v.childAge;
      if (v.childAge === 'no') {
        out.specialMonths = 0;
        out.me = calculateGeneralParentalLeaveBenefit(v.wage, v.months);
        out.spouse = calculateGeneralParentalLeaveBenefit(v.spouseWage, v.spouseMonths);
      } else {
        out.specialMonths = getTogetherSpecialMonths(v.months, v.spouseMonths);
        out.me = calculateTogetherSpecialBenefit(v.wage, v.months, out.specialMonths);
        out.spouse = calculateTogetherSpecialBenefit(v.spouseWage, v.spouseMonths, out.specialMonths);
      }
      out.coupleTotal = out.me.sums.total + out.spouse.sums.total;
    }
    // 노출 전 최종 방어: 모든 금액이 유한한 0 이상 정수여야 한다
    var all = out.me.rows.concat(out.spouse ? out.spouse.rows : []);
    for (var i = 0; i < all.length; i++) { var a = all[i].amount; if (!isFinite(a) || a < 0 || Math.floor(a) !== a) return null; }
    return out;
  }

  var api = {
    PARENTAL_LEAVE_2026: P,
    calculateMonthlyBenefit: calculateMonthlyBenefit, calculateTotalBenefit: calculateTotalBenefit,
    calculateGeneralParentalLeaveBenefit: calculateGeneralParentalLeaveBenefit,
    calculateTogetherSpecialBenefit: calculateTogetherSpecialBenefit,
    calculateSingleParentBenefit: calculateSingleParentBenefit,
    getTogetherSpecialMonths: getTogetherSpecialMonths,
    validateExtensionEligibility: validateExtensionEligibility,
    validateInsuranceEligibility: validateInsuranceEligibility,
    validateParentalLeaveInputs: validateParentalLeaveInputs,
    calculateParentalLeave: calculateParentalLeave
  };
  root.ParentalLeave2026 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
