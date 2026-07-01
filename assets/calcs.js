/* ============================================================
   소호팁 계산기 마스터 목록 — 단일 소스(Single Source of Truth)
   ★ 계산기를 추가/삭제할 때는 이 배열에만 항목을 넣고 빼세요.
     → tools.html 목록·개수(h1·칩·총N개), index.html "무료 계산기 N종"·"N개"가
       모두 이 배열 길이를 세어 자동으로 갱신됩니다. (하드코딩 금지)
   schema: {cat,name,desc,href,icon,color,tags,views,isHot?,isNew?}
   ============================================================ */
window.SOHO_CALCS = [
    {cat:'인건비',name:'알바 인건비 계산기',desc:'2026년 최저시급 10,320원 기준. 주휴수당·4대보험 포함 총 월 인건비 자동 계산',href:'alba-cost-calc.html',icon:'Users',color:'#3D5AFE',tags:['주휴수당','4대보험','인건비'],views:12840,isHot:true},
    {cat:'인건비',name:'월급 계산기',desc:'시급·주 근무시간 → 주휴수당 포함 세전 월급 자동 계산 (2026 최저월급 2,156,880원)',href:'monthly-salary-calc.html',icon:'Banknote',color:'#3D5AFE',tags:['월급','시급','주휴수당','최저월급'],views:980,isNew:true},
    {cat:'인건비',name:'시급 계산기',desc:'월급·월 근무시간 → 통상시급 역산 + 2026 최저임금(10,320원) 충족 여부 확인',href:'hourly-wage-calc.html',icon:'Clock',color:'#3D5AFE',tags:['시급','통상시급','최저임금','월급환산'],views:640,isNew:true},
    {cat:'인건비',name:'실수령액 계산기',desc:'세전 월급 → 2026 4대보험 공제 + 홈택스 소득세 반영한 세후 실수령액',href:'net-salary-calc.html',icon:'Receipt',color:'#3D5AFE',tags:['실수령액','4대보험','세후','공제'],views:720,isNew:true},
    {cat:'인건비',name:'급여 계산기',desc:'기본급·직책·연장·식대 등 항목 합산 → 총급여 + 과세/비과세 구분 (2026 비과세 한도)',href:'gross-pay-calc.html',icon:'Banknote',color:'#3D5AFE',tags:['급여','총급여','과세','비과세'],views:560,isNew:true},
    {cat:'인건비',name:'근무시간 계산기',desc:'출근·퇴근·휴게 → 실근무시간(자정 넘김) + 야간·연장 시간과 일급 계산',href:'work-hours-calc.html',icon:'Clock',color:'#3D5AFE',tags:['근무시간','실근무','야간','일급'],views:480,isNew:true},
    {cat:'인건비',name:'초과근무 계산기',desc:'연장근로 시간 → 50% 가산 연장수당 (야간 중복 가산·5인 미만 차이 반영)',href:'overtime-pay-calc.html',icon:'Clock',color:'#3D5AFE',tags:['초과근무','연장수당','야간','가산'],views:410,isNew:true},
    {cat:'인건비',name:'야간수당 계산기',desc:'야간(밤10시~새벽6시) 시간 → 50% 가산 야간수당 (연장 중복·5인 미만 차이 반영)',href:'night-pay-calc.html',icon:'Clock',color:'#3D5AFE',tags:['야간수당','야간근로','가산','밤근무'],views:360,isNew:true},
    {cat:'인건비',name:'휴일근무수당 계산기',desc:'휴일 시간 → 8h이내 1.5배·초과 2배 휴일수당 (야간 중복·5인 미만 차이 반영)',href:'holiday-pay-calc.html',icon:'CalendarDays',color:'#3D5AFE',tags:['휴일수당','휴일근로','가산','주말근무'],views:340,isNew:true},
    {cat:'인건비',name:'연봉↔월급 계산기',desc:'연봉↔월급 양방향 변환 + 시급 환산 (연봉÷12=월급, 월급×12=연봉, 세전)',href:'annual-salary-calc.html',icon:'TrendingUp',color:'#3D5AFE',tags:['연봉','월급','환산','변환'],views:520,isNew:true},
    {cat:'인건비',name:'일용직 급여 계산기',desc:'일당·일수 → 총급여 + 일용직 소득세·지방세 원천징수·실수령 (소액부징수 반영)',href:'daily-wage-calc.html',icon:'Briefcase',color:'#3D5AFE',tags:['일용직','원천징수','일당','소득세'],views:430,isNew:true},
    {cat:'인건비',name:'퇴직금 계산기',desc:'입사일·퇴사일·평균임금 → 법정 퇴직금 자동 산출',href:'severance-calc.html',icon:'Briefcase',color:'#00B8D9',tags:['퇴직금','법정','노무'],views:6120},
    {cat:'인건비',name:'주휴수당 계산기',desc:'시급·근무시간 → 주휴수당 지급 여부와 주·월 금액 자동 계산',href:'weekly-pay-calc.html',icon:'Clock',color:'#3D5AFE',tags:['주휴수당','시급'],views:4980,isNew:true},
    {cat:'인건비',name:'4대보험 계산기',desc:'월급 → 직원 공제액과 사업주 부담액 동시 계산 (두루누리 감면 포함)',href:'insurance-4d-calc.html',icon:'Shield',color:'#3D5AFE',tags:['4대보험','직원','사업주'],views:5240,isNew:true},
    {cat:'인건비',name:'직원 연차 계산기',desc:'입사일 → 연차 발생 일수와 미사용 연차수당 자동 계산',href:'annual-leave-calc.html',icon:'CalendarDays',color:'#00B8D9',tags:['연차','휴가','법정'],views:3870,isNew:true},
    {cat:'인건비',name:'해고예고수당 계산기',desc:'월 통상임금 또는 1일 통상임금 → 근로기준법 제26조 30일분 해고예고수당 자동 계산 (3개월 미만 예외 안내)',href:'dismissal-notice-allowance-calc.html',icon:'Briefcase',color:'#F04452',tags:['해고예고수당','통상임금','근로기준법','노무'],views:0,isNew:true},
    {cat:'인건비',name:'체불임금 지연이자 계산기',desc:'밀린 임금·퇴직금 → 근로기준법 제37조 연 20% 지연이자 자동 계산 (재직·퇴직 기산일 반영, 2025.10.23 개정)',href:'unpaid-wage-interest-calc.html',icon:'Clock',color:'#F04452',tags:['체불임금','지연이자','근로기준법','노무'],views:0,isNew:true},
    {cat:'배달',name:'배달 순이익 계산기',desc:'주문 1건당 수수료·배달비·재료비 빼면 실제 남는 돈',href:'delivery-profit-calc.html',icon:'Bike',color:'#FF6B35',tags:['배달앱','수수료','순이익'],views:9310,isHot:true},
    {cat:'배달',name:'배달앱 광고비 ROI 계산기',desc:'광고비·추가 주문 → 배달앱 광고 ROI와 손익분기 주문 수 계산',href:'delivery-ads-calc.html',icon:'Megaphone',color:'#FF6B35',tags:['배달광고','ROI'],views:2980,isNew:true},
    {cat:'매출',name:'메뉴 원가율 계산기',desc:'재료비·판매가 → 원가율·마진율·권장 판매가 계산',href:'food-cost-calc.html',icon:'UtensilsCrossed',color:'#E040FB',tags:['원가율','마진율','판매가'],views:4470},
    {cat:'매출',name:'손익분기점(BEP) 계산기',desc:'고정비·변동비율 → 최소 목표 매출과 일 매출 목표 계산',href:'bep-calc.html',icon:'TrendingUp',color:'#FFB800',tags:['BEP','손익분기','고정비'],views:5180},
    {cat:'매출',name:'매장 수익성 계산기',desc:'월 매출·비용 → 영업이익률·순이익·목표 손님 수 계산',href:'store-profit-calc.html',icon:'BarChart2',color:'#3D5AFE',tags:['매출','이익률','순이익'],views:3320,isNew:true},
    {cat:'매출',name:'네이버 플레이스 광고비 계산기',desc:'예산·CPC·전환율 → 예상 방문 고객과 고객 1명당 광고비 계산',href:'naver-ads-calc.html',icon:'MapPin',color:'#00C471',tags:['플레이스','CPC','광고'],views:2740,isNew:true},
    {cat:'세금',name:'부가세 계산기',desc:'매출·매입 입력 → 납부세액 또는 환급액 즉시 계산',href:'vat-calc.html',icon:'Receipt',color:'#00C471',tags:['부가세','납부세액','환급'],views:7625,isHot:true},
    {cat:'세금',name:'임대료 인상 상한 계산기',desc:'현재 월세 → 법정 5% 상한 기준 최대 인상 가능액',href:'rent-increase-calc.html',icon:'Home',color:'#F04452',tags:['임대료','5%상한'],views:4110},
    {cat:'세금',name:'정책자금 이자 계산기',desc:'대출금·금리·기간 → 월 상환액·총이자·총 상환액 계산',href:'loan-interest-calc.html',icon:'Banknote',color:'#00B8D9',tags:['정책자금','대출','이자'],views:3560},
    {cat:'세금',name:'카드수수료 계산기',desc:'월 카드매출 → 우대수수료율 구간 자동 적용, 월·연 수수료 계산',href:'card-fee-calc.html',icon:'CreditCard',color:'#00B8D9',tags:['카드수수료','단말기'],views:3180,isNew:true},
    {cat:'창업',name:'권리금 계산기',desc:'월 순이익·시설 잔존가치 → 시설+영업 권리금 적정 범위 계산',href:'premium-calc.html',icon:'KeyRound',color:'#FFB800',tags:['권리금','시설가치'],views:2890,isNew:true},
    {cat:'창업',name:'폐업 비용 계산기',desc:'철거비·퇴직금·재고 + 폐업 지원금 차감한 실제 부담액 계산',href:'closure-cost-calc.html',icon:'Package',color:'#6B7684',tags:['폐업','철거','지원금'],views:2530,isNew:true},
    {cat:'창업',name:'창업 초기비용 계산기',desc:'업종·평수 → 인테리어·보증금·권리금 등 창업비용 + 월 BEP 매출 추정',href:'startup-cost-calc.html',icon:'Rocket',color:'#F04452',tags:['창업','초기자금'],views:3940,isNew:true},
    {cat:'주식',name:'주식 평단가 계산기',desc:'분할매수 매수가·수량으로 평균단가·총매입·평가손익·수익률 자동 계산',href:'stock-average-calc.html',icon:'TrendingUp',color:'#3D5AFE',tags:['평단가','물타기','수익률'],views:1280,isNew:true},
    {cat:'주식',name:'물타기 계산기',desc:'보유 수량·평단가 + 추가매수 → 물타기 후 새 평단가·총수량·평가손익 자동 계산',href:'averaging-down-calc.html',icon:'BarChart2',color:'#00B8D9',tags:['물타기','추가매수','평단가'],views:640,isNew:true},
    {cat:'주식',name:'불타기 계산기',desc:'보유 수량·평단가 + 상승 추가매수 → 불타기 후 새 평단가·총수량·평가손익 자동 계산',href:'averaging-up-calc.html',icon:'TrendingUp',color:'#FF6B35',tags:['불타기','상승추가매수','평단가'],views:520,isNew:true},
    {cat:'주식',name:'주식 수익률 계산기',desc:'매수가·매도가·수량 + 수수료·거래세 → 수익금·수익률과 실수익률 자동 계산',href:'stock-return-calc.html',icon:'TrendingUp',color:'#00C471',tags:['수익률','실수익','손익'],views:480,isNew:true},
    {cat:'주식',name:'주식 목표가 계산기',desc:'평단가 + 목표 수익률 → 목표 매도가, 손절 수익률 넣으면 손절가·손익비까지 계산',href:'target-price-calc.html',icon:'Tag',color:'#F04452',tags:['목표가','손절가','손익비'],views:430,isNew:true},
    {cat:'주식',name:'미국주식 계산기',desc:'달러 매수가·수량 + 실시간 USD/KRW 환율 → 원화 환산 금액·수익률, 환율 효과까지 계산',href:'us-stock-calc.html',icon:'Banknote',color:'#00B8D9',tags:['미국주식','환율','달러환산'],views:560,isNew:true}
];
