// 매일 자동으로 SEO 최적화 글 1편을 생성·통합하는 스크립트 (GitHub Actions에서 실행)
// 무료: Google Gemini 사용. 필요한 시크릿: GEMINI_API_KEY
//   → https://aistudio.google.com 에서 신용카드 없이 무료 발급 후
//     저장소 Settings > Secrets and variables > Actions 에 등록
import fs from 'node:fs';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('❌ GEMINI_API_KEY 시크릿이 없습니다. 저장소 Settings에서 추가하세요.'); process.exit(1); }

const MODEL = 'gemini-2.5-flash';             // 무료 한도가 넉넉한 모델
const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD

// 1) 기존 글 수집 (중복 회피)
const searchData = JSON.parse(fs.readFileSync('search-data.json', 'utf8'));
const existingSlugs = searchData.map(a => a.url.replace(/\.html$/, ''));
const existingTitles = searchData.map(a => a.title);
const template = fs.readFileSync('naver-place-ranking-2026.html', 'utf8');

// 2) 프롬프트
const system = '너는 한국 소상공인 블로그 sohotip.co.kr의 자동 발행 에디터다. 검색 노출(SEO)이 최우선이며, 양산형 스팸이 아니라 사람에게 진짜 도움 되는 독창적·충실한 글만 쓴다.';

const userPrompt = `오늘(${today}) 발행할 한국 소상공인 대상 새 글 1편을 만들어라.

## 최우선 원칙
검색 노출(SEO) 1순위. 검색 수요가 실재하고 경쟁이 약해 상위 노출이 현실적인 주제를 골라라. 절대 양산형 금지 — 구체적 정보·수치·절차로 채운 독창적 글.

## 중복 금지 (아래 기존 글과 주제가 겹치면 안 됨)
슬러그: ${existingSlugs.join(', ')}
※ 아래 <<<TEMPLATE_START 안의 글(naver-place-ranking-2026)은 '구조 견본'일 뿐이다. 그 슬러그·제목·주제를 절대 그대로 쓰지 말고, 완전히 다른 새 주제를 골라라.

## 품질 기준(모두 충족)
1. 본문 2,500~3,500자, 일반론 금지.
2. 주제에 맞는 계산기 자연 연결(alba-cost-calc, severance-calc, vat-calc, food-cost-calc, bep-calc, delivery-profit-calc, delivery-fee-real-calc, loan-interest-calc, rent-increase-calc 중).
3. 내부 링크 5개 이상(관련 기존 글 + 계산기, 위 슬러그 중 실존하는 것만).
4. FAQ 4~5문항 + head에 FAQPage 타입 JSON-LD 별도 추가.
5. 실제 숫자 예시·사례 여러 번.

## 말투 — 이 블로그의 핵심. SEO보다 이걸 절대 어기지 마라
독자는 40~50대 소상공인 사장님이다. 너는 "30년 경력 세무사이면서 30년 장사도 해본, 옆 가게에서 장사 잘되는 선배 사장님"이다. 책에서 본 게 아니라 네가 직접 겪은 경험을, 후배 사장님과 커피 한 잔 하며 들려주듯 써라. 법조문체·기사체·블로그 전문가체 절대 금지(이게 가장 흔한 실패다).
독자가 읽으면서 "맞아", "나도 그랬는데", "어? 내 얘기네" 하고 고개 끄덕이게 만드는 게 1순위. 정보 전달보다 공감이 먼저다.

## 각 h2 섹션은 이 5단계 흐름으로
1) 실제로 겪을 법한 상황(장면 묘사) → 2) 감정 공감("답답하시죠?", "억울하셨을 거예요") → 3) 왜 그런지 원인 설명(쉽게) → 4) 그래서 어떻게 하면 되는지 해결 → 5) 바로 써먹을 팁.

지킬 것:
- 교과서식 정의·설명보다 현실 사례를 먼저. "원칙은 이렇습니다" 대신 "저는 이렇게 했더니…", "제 단골 사장님 한 분은…" 처럼 실제 겪은 일처럼 풀어라.
- 독자가 "맞아, 우리 가게도 그런데" 하고 무릎 칠 사례를 자주 넣어라.
- 인터넷 자영업 커뮤니티(아프니까 사장이다 같은 곳)에서 사장님들이 실제로 쓰는 자연스러운 말투로. AI가 쓴 티 나는 매끈하고 균일한 문장은 최대한 빼라.
- 쉬운 말. 어려운 용어(예: 임대차·권리금·주휴수당)는 나오자마자 한 줄로 풀어준다. 문장은 짧게, 문단은 2~4줄.
- 공감 질문을 자주 던져 다음 줄이 궁금하게. 예) "혹시 이런 적 없으셨나요?", "매출은 느는데 통장은 그대로인 경험, 있으시죠?", "여기서 손해 보는 사장님 정말 많습니다."
- 실제 숫자·사례를 계속 든다. 추상적 설명만 금지. 예) "월세 200만원짜리 가게를 3개월 남기고 나간다면…", "12,000원짜리 메뉴를 하루 80개 팔면…".
- 짧은 문장과 대화체. 소설처럼 과장하지 말고, 현실적인 에피소드·사례로 채운다.
- 가벼운 위트 1~2번 허용(피식 정도). 예) "사장님 통장보다 배달앱이 더 배부른 구조일 수도 있어요." 과한 드립·밈 금지.
- 글 끝(마무리 단락)은 "그래서 우리 가게는 얼마나 아낄 수 있을까?" 식으로 자연스럽게 관련 계산기나 다른 글을 눌러보고 싶게 연결한다. 억지 광고 문구 금지.
- 과장 금지. ❌"무조건 대박/100% 성공" → ⭕"효과 본 사례가 많습니다".
[나쁜 예] "주휴수당은 근로기준법에 따라 지급되는 법정수당입니다. 다음은 계산 방법입니다."
[좋은 예] "알바 쓰다 보면 주휴수당 때문에 헷갈리시죠? 생각보다 어렵지 않아요. 예를 들어 시급 1만원에 하루 5시간, 주 5일이면…"

## AI 티·딱딱한 전문가체 어미 금지 (이런 말투 쓰면 실패)
아래 표현을 쓰지 말고 오른쪽 구어체로 바꿔라. 어미는 ~요/~죠/~거든요/~잖아요 위주로, "~입니다/~합니다"만 줄줄이 늘어놓지 마라.
- "~알려드리겠습니다" → "~알려드릴게요" / "같이 볼까요?"
- "~중요합니다" / "~유의해야 합니다" → "여기서 많이들 놓쳐요" / "이거 놓치면 손해예요"
- "~해야 합니다" → "~하시면 돼요" / "~하는 게 좋아요"
- "~할 수 있습니다" → "~할 수 있어요" / "~하면 됩니다"
- "결론적으로 / 정리하자면 / 다음과 같습니다 / 살펴보겠습니다" 같은 보고서식 연결어 금지. 그냥 사람처럼 자연스럽게 이어가라.

## 반드시 넣을 시각·말투 요소 (아래 클래스를 템플릿 그대로 사용)
- 말풍선 1~2개: <div class="talk-bubble"><div class="tb-face">🧑‍🍳</div><div class="tb-body">…공감 한마디…</div></div>  ← tb-face 아바타 이모지는 허용
- 체크리스트 최소 1개: <div class="check-box"><div class="cb-title">…제목…</div><ul><li>…</li><li>…</li></ul></div>
- TIP 박스 2개 이상: <div class="tip-inline"><strong>…</strong> …</div>
- 숫자 비교 표 최소 1개: <table class="article-table">…</table>
- h2마다 id 부여하고 사이드바 목차와 일치.
- ※ 제목·항목·박스 라벨 **선두에 장식 이모지(💡📌✅🔥🧮 등)를 넣지 마라** — 발행 시 자동 제거된다. 카테고리 태그(article-tag)도 이모지 없이 카테고리명만(아이콘은 SVG로 자동 주입). 단, 본문 예시 속 의미 있는 이모지(가게 예시 📍, 비교표 ✅/❌ 마커)와 tb-face 아바타는 그대로 써도 된다.

## 계산기·상담·관련글 — 맥락에서만 자연스럽게 (광고처럼 보이면 실패)
신뢰도가 클릭률보다 먼저다. 아래 셋은 글 흐름에 맞을 때만 넣고, 맥락이 안 맞으면 과감히 뺀다.
- 계산기: "○○ 계산기를 이용해보세요" 같은 광고 문구 금지. 흐름 속에서 → "말로만 들으면 감이 잘 안 오죠. 우리 가게 기준으로 실제 얼마 남는지 보는 게 제일 빨라요. 아래 ○○ 계산기에 △△만 넣어보세요." 식으로 연결.
- 상담: 무조건 넣지 마라. 독자가 '혼자 해결이 어렵다 / 전문가 도움이 필요하다 / 광고비는 쓰는데 성과가 없다 / 매출 문제로 고민' 인 맥락일 때만 → "여기까지 했는데도 안 되면 문제가 다른 데 있을 수 있어요. 광고비는 나가는데 효과가 없거나 어디부터 손볼지 감이 안 잡히면, 전문가 도움이 오히려 시간을 아끼기도 합니다." 식으로 운을 뗀 뒤 상담으로 연결. "상담 문의하기 / 지금 바로 문의하세요 / 무료 상담 신청" 같은 뜬금없는 문구 금지.
- 관련글: 주제와 직접 연결되는 글만(예: 배민 수수료→배달 순이익 계산·메뉴 원가율 / 네이버 플레이스→리뷰 관리·사진 등록 / 창업→손익분기점·원가율). 관련 없는 글 금지.
목표: 독자가 "광고 보는 느낌"이 아니라 "진짜 도움받는 느낌"이 들게. 클릭률보다 신뢰도 우선.

날짜 하드코딩 금지: 본문 freshness 라인은 정확히 → 최신 정보 기준 · <span class="auto-ym">2026년 6월</span> — 최신 정보를 반영했습니다.  (단 JSON-LD datePublished/dateModified는 ${today})

## 구조 — 아래 템플릿을 그대로 따라 완성된 HTML 1장을 만들 것
광고 <ins> 블록, naver-site-verification 코드, sohotip.css·Pretendard·theme.css·sohotip.js·layout.js·consult.js 링크/스크립트, breadcrumb·목차·관련글·공유바 구조를 템플릿에서 그대로 복사하고 내용만 새로 채워라. canonical과 og:url은 새 글 주소(https://sohotip.co.kr/<슬러그>.html)로 바꿔라.
검색·공유 메타 정확히 채울 것(템플릿 구조 유지):
- og:image / twitter:image 는 https://sohotip.co.kr/og-image.png 그대로 둔다(바꾸지 마라). og:title·og:description·twitter:title·twitter:description 는 새 글 내용으로.
- Article JSON-LD: headline·description=새 글, image="https://sohotip.co.kr/og-image.png", author·publisher 그대로, datePublished·dateModified=${today}, mainEntityOfPage=새 글 주소.
- BreadcrumbList JSON-LD: position2 는 이 글의 카테고리(name/item=category.html#앵커), position3 name 은 새 글 제목으로 바꿔라.

<<<TEMPLATE_START
${template}
TEMPLATE_END

## 출력 형식 (반드시 이 형식만, 다른 말 금지)
<META>
{"slug":"영문-소문자-하이픈(기존과 중복금지)","searchEntry":{"url":"<슬러그>.html","title":"...","desc":"...","tag":"🏪 창업·세금 같은 형식","date":"${today}","rt":"8분","keywords":"쉼표구분 키워드"},"rssItem":"<item>\\n<title>...</title>\\n<link>https://sohotip.co.kr/<슬러그>.html</link>\\n<description>...</description>\\n<pubDate>RFC822 날짜</pubDate>\\n</item>"}
</META>
<HTML>
<!DOCTYPE html> ...완성된 전체 페이지...
</HTML>`;

// 3) API 호출 + 파싱 + 검증 (일시 오류·불량 응답이면 재시도 = 새로 생성)
//    무료 모델은 가끔 503 과부하가 나거나, 드물게 템플릿 슬러그를 베끼는 등 헛나온다.
//    한 번 실패해도 죽지 않고 다시 굴려서 통과시킨다.
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function attempt() {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 32768, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  // 인증·요청 자체가 잘못된 4xx(429 제외)는 재시도해도 소용없음 → 복구 불가로 표시
  if (!res.ok && res.status >= 400 && res.status < 500 && res.status !== 429) {
    throw { fatal: true, msg: `API ${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  if (!res.ok) throw { msg: `API ${res.status}(일시 오류)` };       // 429/5xx → 재시도

  const data = await res.json();
  const cand = (data.candidates || [])[0];
  if (!cand) throw { msg: '응답 비어있음' };
  if (cand.finishReason && cand.finishReason !== 'STOP') throw { msg: `비정상 종료 ${cand.finishReason}` };
  const text = (cand.content?.parts || []).map(p => p.text || '').join('');

  // 파싱
  const metaM = text.match(/<META>([\s\S]*?)<\/META>/);
  const htmlM = text.match(/<HTML>([\s\S]*?)<\/HTML>/);
  if (!metaM || !htmlM) throw { msg: '형식 불량(META/HTML 누락)' };
  let meta;
  try { meta = JSON.parse(metaM[1].trim()); } catch { throw { msg: 'META JSON 파싱 실패' }; }
  const fullHtml = htmlM[1].trim();
  const slug = (meta.slug || '').trim();

  // 검증 (불량이면 새로 생성)
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw { msg: `슬러그 불량: ${slug}` };
  if (existingSlugs.includes(slug)) throw { msg: `중복 슬러그: ${slug}` };
  if (!/class="article-content"/.test(fullHtml) || !/sohotip\.js/.test(fullHtml) || !/<ins/.test(fullHtml))
    throw { msg: 'HTML 구조 검증 실패(필수 요소 누락)' };

  return { meta, fullHtml, slug };
}

const MAX_TRIES = 4;
let result;
for (let i = 1; i <= MAX_TRIES; i++) {
  try { result = await attempt(); break; }
  catch (e) {
    console.warn(`⚠ 시도 ${i}/${MAX_TRIES} 실패: ${e.msg || e}`);
    if (e.fatal) { console.error('❌ 복구 불가 오류(키/요청 문제) — 중단'); process.exit(1); }
    if (i < MAX_TRIES) await sleep(5000 * i);  // 5s, 10s, 15s 백오프
  }
}
if (!result) { console.error('❌ 모든 재시도 실패 — 오늘 발행 건너뜀'); process.exit(1); }
const { meta, fullHtml, slug } = result;

// ── 인디고 통일 후처리(Gemini 출력 보정): 자산 링크/스크립트 주입 + 이모지 정규화 ──
//    Gemini는 boilerplate를 불안정하게 내므로, 여기서 강제로 사이트 표준에 맞춘다.
const ASSET_V = '20260702';
const _CONT = '(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|\\p{Extended_Pictographic})*';
const _ANY = `(?:\\p{Extended_Pictographic}${_CONT})+`;
const _DECOR = '[💡📌✅✔☑🔥🧮🎯👉📝⚠❗💬📂🙅💸🚀📊📈🗓🕒🛡🔑]';
const _DECOR_CLUSTER = _DECOR + _CONT;
const _P = {
  MapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  Bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3.5 11.5L9 9l3-3 4 4h3"/>',
  Camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  Banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  Megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  CreditCard: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  FileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  Bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14c.2-1 .6-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.8.8 1.2 1.5 1.4 2.5"/>'
};
function _iconFor(cat) {
  cat = cat || '';
  if (/플레이스/.test(cat)) return ['MapPin', '#00C471'];
  if (/배달/.test(cat)) return ['Bike', '#FF6B35'];
  if (/SNS|숏폼|인스타|블로그/.test(cat)) return ['Camera', '#E040FB'];
  if (/지원금|정책|보험/.test(cat)) return ['Banknote', '#3D5AFE'];
  if (/마케팅|광고/.test(cat)) return ['Megaphone', '#FF6B35'];
  if (/직원|알바|노무|채용/.test(cat)) return ['Users', '#3D5AFE'];
  if (/안전/.test(cat)) return ['Shield', '#F04452'];
  if (/카드|결제/.test(cat)) return ['CreditCard', '#00B8D9'];
  return ['FileText', '#6B7684'];
}
function _svgTag(cat) {
  const [ic, col] = _iconFor(cat);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;vertical-align:-2px;margin-right:5px" aria-hidden="true">${_P[ic]}</svg>`;
}
const _BULB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em" aria-hidden="true">${_P.Bulb}</svg>`;
function normalizeEmoji(html) {
  // article-tag/related-card-tag 선두 이모지 → 카테고리 SVG (텍스트 유지)
  html = html.replace(new RegExp(`(<(?:div|span)[^>]*class="(?:article-tag|related-card-tag)"[^>]*>)\\s*(${_ANY})\\s*([^<]*)`, 'gu'),
    (m, open, emo, text) => open + _svgTag(text.trim()) + text.trim());
  // step-num-badge/tb-face/top5-icon 단독 장식 이모지 → 전구 SVG(💡) / 그 외 제거
  html = html.replace(new RegExp(`(<div[^>]*class="(?:step-num-badge|tb-face|top5-icon)"[^>]*>)\\s*(${_DECOR_CLUSTER})\\s*(</div>)`, 'gu'),
    (m, open, cl, close) => open + (/^💡/u.test(cl) ? _BULB : '') + close);
  // 콜아웃 박스(tip-inline/warn-box/cb-title/step-box-title) 선두 장식 제거
  html = html.replace(new RegExp(`(<[^>]*class="(?:tip-inline|warn-box|cb-title|step-box-title)"[^>]*>)\\s*(${_DECOR_CLUSTER})\\s*`, 'gu'), '$1');
  // 제목/본문 li·p·strong·b·h1~4 선두 장식 이모지 제거 (td/a/예시·표 보존)
  html = html.replace(new RegExp(`(<(?:li|p|strong|b|h[1-4])(?=[ >/])[^>]*>)\\s*(${_DECOR_CLUSTER})\\s*`, 'gu'), '$1');
  return html;
}
function normalize(html) {
  // head: Pretendard + theme.css (sohotip.css 뒤, 없을 때만)
  if (!/assets\/theme\.css/.test(html))
    html = html.replace(/(<link[^>]*href="sohotip\.css[^"]*">)/,
      `$1\n  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">\n  <link rel="stylesheet" href="assets/theme.css?v=${ASSET_V}">`);
  // scripts: sohotip.js 앞 layout.js, 뒤 consult.js (없을 때만)
  if (!/assets\/layout\.js/.test(html))
    html = html.replace(/(<script src="sohotip\.js[^"]*"><\/script>)/,
      `<script src="assets/layout.js?v=${ASSET_V}"></script>\n$1\n<script src="assets/consult.js?v=${ASSET_V}"></script>`);
  else if (!/assets\/consult\.js/.test(html))
    html = html.replace(/(<script src="sohotip\.js[^"]*"><\/script>)/, `$1\n<script src="assets/consult.js?v=${ASSET_V}"></script>`);
  return normalizeEmoji(html);
}

// 6) 파일 작성 + 사이트 통합
fs.writeFileSync(`${slug}.html`, normalize(fullHtml));

const entry = meta.searchEntry || { url: `${slug}.html`, title: slug, desc: '', tag: '', date: today, rt: '8분', keywords: '' };
searchData.unshift(entry);
fs.writeFileSync('search-data.json', JSON.stringify(searchData, null, 2));

try {
  const si = JSON.parse(fs.readFileSync('search-index.json', 'utf8'));
  // search-index.json은 스키마가 다름: tag→cat(이모지 제거), keywords→kw
  const cat = (entry.tag || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const indexEntry = {
    url: entry.url, title: entry.title, desc: entry.desc,
    cat, kw: entry.keywords || '', date: entry.date, rt: entry.rt,
  };
  si.unshift(indexEntry); fs.writeFileSync('search-index.json', JSON.stringify(si, null, 2));
} catch (e) { console.warn('⚠ search-index.json 갱신 건너뜀:', e.message); }

let sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const urlBlock = `  <url>\n    <loc>https://sohotip.co.kr/${slug}.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
sitemap = sitemap.replace('</urlset>', urlBlock + '</urlset>');
fs.writeFileSync('sitemap.xml', sitemap);

if (meta.rssItem) {
  let rss = fs.readFileSync('rss.xml', 'utf8');
  rss = rss.replace(/(\n\s*<item>)/, '\n    ' + meta.rssItem + '$1'); // 최신 글을 맨 위에
  fs.writeFileSync('rss.xml', rss);
}

console.log(`✅ 발행 완료: ${slug}.html — ${entry.title}`);
