# 상담 전화·CTA 제거 기록 (2026-07-24)

정보 제공 사이트로 포지션 전환을 위해 상담 전화번호·상담 유도 CTA·상담 페이지 색인을 사이트 전체에서 제거함.
**전체 복구는 이 작업 커밋 하나를 `git revert` 하면 됨.** 아래는 무엇을 어디서 뺐는지의 요약(부분 복구용).

## 유지한 것 (건드리지 않음)
- `contact.html` 이메일 문의(`mailto:sap01257@gmail.com`) — 애드센스 연락 수단
- `about.html` 운영자 정보(인티/멘토마케팅) — E-A-T
- `assets/consult.js` **파일 자체는 저장소에 보존**(호출 `<script>` 태그만 제거). 복구 시 각 HTML `sohotip.js` 태그 뒤에 `<script src="assets/consult.js?v=..."></script>` 재삽입.
- `010-000-1234` (국세청 현금영수증 지정번호, 예시) — `soho-cash-receipt-guide.html`에 보존
- 광고 슬롯 마커(`<!-- ADSLOT:* -->`), 카카오 애드핏, 계산기, SEO 구조

## 제거한 것 (제거 대상 010-2901-7789 / consultation.html CTA)

### 전화번호·tel: 링크
- `consultation.html` — `.call-box`, `.bottom-cta` 블록 통째(전화 2곳)
- `naver-ads-vs-organic.html` — 하단 `linear-gradient` 상담 전용 섹션 통째(전화 2곳)

### 상담 CTA (consultation.html 링크) — 균일 패턴 (스크립트 처리)
- `consult.js` `<script>` 태그: **157개 파일**에서 제거
- nav 버튼 `<a class="nav-cta">무료 진단</a>`: **42개 파일**
- 요약박스 `ais-btn`(consultation) 앵커: **45개**(plain 38 + svg중첩 7) + 비게 된 `.ais-cta` div 정리 **17개**
- 계산기/허브 푸터 링크 `<a href="consultation.html">무료 진단</a>`: **35개**
- 기사 하단 상담 유도 문단(pitch `<p>`) 통째: **6개** (google-ai-overview-seo, instagram-algorithm-2026, owner-fast-execution, portal-ai-search-2026, reels-account-setup, tmap-shortform-store)

### 상담 CTA — 개별(bespoke) 처리
- `category.html` — 플로팅 상담 버튼(`.fab`)
- `forms.html` — `<section class="f-consult">` 상담 섹션
- `dismissal-notice-allowance-calc.html`, `unpaid-wage-interest-calc.html` — `.cta-box` 상담 블록
- `soho-digital-marketing-agency-selection.html` — 상담 유도 문단 + 가짜 관련글 카드(consultation) 제거
- `soho-cash-receipt-guide.html` — 마지막 문단의 "무료 진단 컨설팅" 상담 권유 문장만 트림(본문 요약은 보존)

### 색인·데이터
- `consultation.html` — `robots` `index,follow` → **`noindex, follow`** (페이지는 복구용으로 보존)
- `sitemap.xml` — consultation.html `<url>` 블록 제거
- `llms.txt` — "1:1 무료 진단 상담" 링크 제거

### 자동발행 봇 재발 방지 (`scripts/generate-article.mjs`)
- 프롬프트의 "상담" 생성 지시 bullet 제거(계산기·관련글만 유지)
- 템플릿 복사 지시에서 `consult.js` 항목 제거
- `injectAiSummary`의 상담 CTA 생성 로직 제거(계산기 버튼만; 계산기 없으면 CTA 없음, 빈 `.ais-cta` div 미생성)
- `normalize`의 `consult.js` `<script>` 자동 주입 로직 제거(`layout.js` 주입은 유지)
- ※ 봇은 `naver-place-ranking-2026.html`을 구조 템플릿으로 복사하므로, 위 정리로 그 파일이 깨끗해진 것도 중요.

## 복구 방법
- **전체:** 이 작업 커밋을 `git revert`.
- **상담 injector만 다시 켜기(승인 후):** 각 HTML의 `<script src="sohotip.js...">` 뒤에 `<script src="assets/consult.js?v=최신"></script>` 재삽입 + `generate-article.mjs`의 봇 로직 되돌리기.
