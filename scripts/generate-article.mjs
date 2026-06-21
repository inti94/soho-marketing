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

## 말투
30년 세무사+20년 장사한 사장님이 후배에게 알려주듯 친근한 존댓말. 공감→예시→해결→팁. 문단 2~4줄, 공감 질문 자주. 과장 금지('무조건 대박/100%' → '효과 본 사례가 많습니다'). h2마다 id 부여하고 사이드바 목차와 일치.
날짜 하드코딩 금지: 본문 freshness 라인은 정확히 → 📌 최신 정보 기준 · <span class="auto-ym">2026년 6월</span> — 최신 정보를 반영했습니다.  (단 JSON-LD datePublished/dateModified는 ${today})

## 구조 — 아래 템플릿을 그대로 따라 완성된 HTML 1장을 만들 것
광고 <ins> 블록, naver-site-verification 코드, sohotip.js/sohotip.css 링크, breadcrumb·목차·관련글·공유바 구조를 템플릿에서 그대로 복사하고 내용만 새로 채워라. canonical과 og:url은 새 글 주소(https://sohotip.co.kr/<슬러그>.html)로 바꿔라.

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

// 6) 파일 작성 + 사이트 통합
fs.writeFileSync(`${slug}.html`, fullHtml);

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
