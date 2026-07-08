/* ═══════════════════════════════════════════════════════════════
 *  prerender-hubs.mjs — 홈·허브 정적 프리렌더 (SEO/애드센스용)
 *  ───────────────────────────────────────────────────────────────
 *  홈(index)·계산기허브(tools)·카테고리(category)·브리핑(briefing)은
 *  콘텐츠를 JS로만 그려 크롤러엔 빈 페이지로 보였음. 이 스크립트가
 *  정본 데이터(calcs.js·briefing-data.js·news-data.js·search-index.json)를
 *  읽어 각 빈 컨테이너에 "크롤러가 읽을 정적 HTML"을 주입한다.
 *  주입 구간은 <!--PR:id--> ~ <!--/PR:id--> 마커로 감싸 재실행 시 교체.
 *  런타임 JS는 그대로 el.innerHTML=... 로 이 정적본을 덮어써서(동일 데이터)
 *  사용자 기능(필터·검색·북마크)은 손상 없이 유지된다.
 *
 *  실행: node scripts/prerender-hubs.mjs
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);

/* ── 정본 데이터 로드 (window 샌드박스) ── */
const sandbox = { window: {}, localStorage: { getItem: () => null, setItem: () => {} },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} } };
sandbox.self = sandbox.window; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['assets/calcs.js', 'assets/briefing-data.js', 'assets/news-data.js', 'guide-data.js']) {
  try { vm.runInContext(rd(f), sandbox, { filename: f }); } catch (e) { console.error('load fail', f, e.message); }
}
const CALCS = sandbox.window.SOHO_CALCS || [];
const BRIEF = sandbox.window.SOHO_BRIEFING || { cards: [], faqs: [], popular: [] };
const NEWS = sandbox.window.SOHO_NEWS || [];
const VIEWS = sandbox.window.SOHO_GUIDE_VIEWS || {};
const SEARCH = JSON.parse(rd('search-index.json'));

/* ── 가이드 목록: search-index에서 계산기·유틸 제외 → 조회수순 정렬 ── */
const UTIL = new Set(['index.html','about.html','consultation.html','forms.html','tools.html','category.html','briefing.html','search.html','404.html','article.html','components-demo.html','terms.html','privacy.html','contact.html']);
const GUIDES = SEARCH
  .filter(e => e.url && e.url.endsWith('.html') && !/-calc\.html$/.test(e.url) && !UTIL.has(e.url))
  .map(e => ({ url: e.url, title: e.title || '', desc: e.desc || '', cat: e.cat || '가이드', v: VIEWS[e.url] || 0 }))
  .sort((a, b) => b.v - a.v);

/* ── HTML 유틸 ── */
const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const S_WRAP = 'style="margin:0 0 4px"';
const S_ITEM = 'style="display:block;padding:11px 2px;border-bottom:1px solid #EEF0F3;text-decoration:none;color:#1A1A1A;line-height:1.5"';
const S_NAME = 'style="font-weight:700;font-size:14px"';
const S_DESC = 'style="color:#6B7280;font-size:12.5px"';
const S_CAT  = 'style="color:#3D5AFE;font-size:11px;font-weight:700;margin-right:6px"';

function calcItem(c) {
  return `<a ${S_ITEM} href="${esc(c.href)}"><span ${S_NAME}>${esc(c.name)}</span><br><span ${S_DESC}>${esc(c.desc)}</span></a>`;
}
function guideItem(g) {
  return `<a ${S_ITEM} href="${esc(g.url)}"><span ${S_CAT}>${esc(g.cat)}</span><span ${S_NAME}>${esc(g.title)}</span><br><span ${S_DESC}>${esc(g.desc)}</span></a>`;
}
function newsItem(n) {
  return `<div ${S_ITEM}><span ${S_NAME}>${esc(n.title||'')}</span><br><span ${S_DESC}>${esc(n.summary||'')}</span></div>`;
}
function briefItem(c) {
  const sum = String(c.summary||'').replace(/\n/g,' ');
  return `<div ${S_ITEM}><span ${S_CAT}>${esc(c.cat||'')}</span><span ${S_NAME}>${esc(c.title||'')}</span><br><span ${S_DESC}>${esc(sum)}</span></div>`;
}
function faqItem(f) {
  return `<div ${S_ITEM}><span ${S_NAME}>Q. ${esc(f.q||f.question||'')}</span><br><span ${S_DESC}>${esc(f.a||f.answer||'')}</span></div>`;
}
function block(heading, itemsHtml) {
  return `<div class="pr-fallback"><h2 ${S_WRAP} style="font-size:15px;font-weight:800;margin:6px 0 8px">${esc(heading)}</h2>${itemsHtml}</div>`;
}

/* ── 컨테이너 주입: 빈 컨테이너면 여는 태그 뒤에 삽입, 이미 마커 있으면 교체 ── */
function inject(html, id, inner) {
  const start = `<!--PR:${id}-->`, end = `<!--/PR:${id}-->`;
  const payload = start + inner + end;
  const markerRe = new RegExp(start.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&') + '[\\s\\S]*?' + end.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'));
  if (markerRe.test(html)) return html.replace(markerRe, payload);
  // 여는 태그(<tag ... id="ID" ...>) 뒤에 삽입
  const openRe = new RegExp('(<[a-zA-Z]+[^>]*\\bid="' + id + '"[^>]*>)');
  if (!openRe.test(html)) { console.warn('  ! 컨테이너 없음:', id); return html; }
  return html.replace(openRe, '$1' + payload);
}

const topCalcHrefs = ['alba-cost-calc.html','delivery-profit-calc.html','vat-calc.html','bep-calc.html','food-cost-calc.html','severance-calc.html','insurance-4d-calc.html','card-fee-calc.html'];
const usecalc = topCalcHrefs.map(h => CALCS.find(c => c.href === h)).filter(Boolean);

/* ═══ index.html ═══ */
let idx = rd('index.html');
idx = inject(idx, 'rank-list', block('많이 쓰는 계산기', usecalc.slice(0,3).map(calcItem).join('')));
idx = inject(idx, 'usecalc-grid', block('자주 쓰는 계산기', usecalc.map(calcItem).join('')));
idx = inject(idx, 'latest-guides', block('최신 가이드', GUIDES.slice(0,3).map(guideItem).join('')));
idx = inject(idx, 'news-list', block('오늘의 사업 소식', NEWS.slice(0,3).map(newsItem).join('')));
idx = inject(idx, 'feed-calc', block('소상공인 무료 계산기 전체', CALCS.map(calcItem).join('')));
idx = inject(idx, 'feed-guide', block('실전 가이드', GUIDES.slice(0,20).map(guideItem).join('')));
const top5 = GUIDES.slice(0,5).map((g,i)=>`<a ${S_ITEM} href="${esc(g.url)}"><span ${S_NAME}>${i+1}. ${esc(g.title)}</span> <span ${S_DESC}>· ${esc(g.cat)}</span></a>`).join('');
idx = inject(idx, 'check-list', block('사장님 이번 달 체크리스트', usecalc.slice(0,5).map(calcItem).join('')));
// top5-list는 class 컨테이너(<nav class="top5-list">) — id 없음. 별도 처리 생략(feed-guide로 커버).
wr('index.html', idx);
console.log('index.html 프리렌더 완료: 계산기', CALCS.length, '· 가이드', GUIDES.length);

/* ═══ tools.html ═══ */
let tools = rd('tools.html');
tools = inject(tools, 'calc-grid', block('소상공인 무료 계산기 전체', CALCS.map(calcItem).join('')));
wr('tools.html', tools);
console.log('tools.html 프리렌더 완료: 계산기', CALCS.length);

/* ═══ category.html ═══ */
let cat = rd('category.html');
cat = inject(cat, 'feed', block('계산기·가이드 전체', CALCS.map(calcItem).join('') + GUIDES.map(guideItem).join('')));
wr('category.html', cat);
console.log('category.html 프리렌더 완료: 항목', CALCS.length + GUIDES.length);

/* ═══ briefing.html ═══ */
let bri = rd('briefing.html');
bri = inject(bri, 'brief-feed', block('오늘의 사업 브리핑', (BRIEF.cards||[]).map(briefItem).join('')));
if ((BRIEF.faqs||[]).length) bri = inject(bri, 'bfaq-list', block('자주 묻는 질문', BRIEF.faqs.map(faqItem).join('')));
wr('briefing.html', bri);
console.log('briefing.html 프리렌더 완료: 브리핑', (BRIEF.cards||[]).length, '· FAQ', (BRIEF.faqs||[]).length);
