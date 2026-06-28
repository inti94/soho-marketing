/* ===========================================
   sohotip.js — 소호팁 공통 기능
   2026-06-20 전면 개편
   · 스크롤 진행바
   · 상단 이동 버튼
   · 사이트 내 검색 (자동완성·최근검색·하이라이트)
   · TOC 스크롤 연동
   · 관련글 동적 렌더링
   · 하단 고정 CTA
   · 카테고리 페이지 URL 검색 파라미터
   · URL 복사 (공유)
=========================================== */
'use strict';

/* PART 2: 계산기 페이지의 "관련 계산기/가이드" 추천은 inline-calc.js(영수증형
   '함께 보면 좋은')가 담당한다. 중복 렌더 방지용 플래그(아래 renderCalcPage에서 사용). */
window.SOHO_RECO_V2 = true;

/* ── 검색 인덱스 전역 ──────────────────── */
let _searchIndex = null;
let _indexLoading = false;

/* 인기 검색어 (고정) */
const POPULAR_KEYWORDS = [
  '알바 인건비', '배달 수수료', '부가세 계산', '손익분기점',
  '네이버 플레이스', '소상공인 지원금', '퇴직금', '원가율'
];

/* 카테고리별 이모지 */
const CAT_EMOJI = {
  '네이버 플레이스': '📍',
  '배달앱': '🛵',
  'SNS · 숏폼': '📱',
  '소상공인 지원금': '💰',
  '창업·세금': '🏪',
  '창업 세금': '🏪',
  '계산기': '🧮',
  'default': '📄'
};
function getEmoji(cat) {
  for (var k in CAT_EMOJI) {
    if (cat && cat.includes(k.replace('·', '').replace(' ', ''))) return CAT_EMOJI[k];
  }
  return CAT_EMOJI.default;
}

/* 카테고리 → 인라인 SVG 라인 아이콘 (이모지 대체, 검색 결과용) */
function getCatSvg(cat) {
  var P = {
    place:    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    delivery: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3.5 11.5L9 9l3-3 4 4h3"/>',
    sns:      '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    support:  '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    startup:  '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
    calc:     '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="16" y2="18"/>',
    def:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
  };
  var key = 'def';
  if (cat) {
    if (cat.indexOf('플레이스') >= 0) key = 'place';
    else if (cat.indexOf('배달') >= 0) key = 'delivery';
    else if (cat.indexOf('SNS') >= 0 || cat.indexOf('숏폼') >= 0) key = 'sns';
    else if (cat.indexOf('지원금') >= 0) key = 'support';
    else if (cat.indexOf('창업') >= 0 || cat.indexOf('세금') >= 0) key = 'startup';
    else if (cat.indexOf('계산기') >= 0) key = 'calc';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true">' + P[key] + '</svg>';
}

/* ── 1. 검색 인덱스 로드 ────────────────── */
async function loadSearchIndex() {
  if (_searchIndex) return _searchIndex;
  if (_indexLoading) {
    return new Promise(function(resolve) {
      var t = setInterval(function() {
        if (_searchIndex) { clearInterval(t); resolve(_searchIndex); }
      }, 50);
    });
  }
  _indexLoading = true;
  try {
    var base = location.pathname.includes('/') ?
      location.pathname.replace(/\/[^/]*$/, '/') : '/';
    var res = await fetch(base + 'search-index.json');
    if (!res.ok) throw new Error('fetch failed');
    _searchIndex = await res.json();
  } catch(e) {
    _searchIndex = [];
  }
  _indexLoading = false;
  return _searchIndex;
}

/* ── 2. 검색 로직 ───────────────────────── */
function searchArticles(q, index, limit) {
  limit = limit || 8;
  if (!q || q.length < 1 || !index || !index.length) return [];
  var terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  var results = index.map(function(item) {
    var text = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.kw || '') + ' ' + (item.cat || '')).toLowerCase();
    var score = 0;
    terms.forEach(function(t) {
      if ((item.title || '').toLowerCase().includes(t)) score += 10;
      else if (text.includes(t)) score += 3;
    });
    return { item: item, score: score };
  })
  .filter(function(r) { return r.score > 0; })
  .sort(function(a, b) { return b.score - a.score; })
  .slice(0, limit)
  .map(function(r) { return r.item; });
  return results;
}

/* 텍스트 하이라이트 */
function highlight(text, q) {
  if (!q || !text) return text;
  var terms = q.trim().split(/\s+/).filter(Boolean);
  var result = text;
  terms.forEach(function(t) {
    if (!t) return;
    var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    result = result.replace(re, '<mark>$1</mark>');
  });
  return result;
}

/* ── 3. 최근 검색어 관리 (localStorage) ── */
var RECENT_KEY = 'sohotip_recent_q';
var RECENT_MAX = 5;

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch(e) { return []; }
}
function addRecentSearch(q) {
  if (!q || q.trim().length < 2) return;
  try {
    var arr = getRecentSearches().filter(function(x) { return x !== q; });
    arr.unshift(q);
    arr = arr.slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  } catch(e) {}
}
function removeRecentSearch(q) {
  try {
    var arr = getRecentSearches().filter(function(x) { return x !== q; });
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  } catch(e) {}
}

/* ── 4. 드롭다운 렌더링 ──────────────────── */
function renderDropdown(input, dropdown, q) {
  if (!dropdown) return;

  if (!q || q.length < 1) {
    var recent = getRecentSearches();
    if (!recent.length && !POPULAR_KEYWORDS.length) {
      dropdown.classList.remove('active');
      return;
    }
    var html = '';
    if (recent.length) {
      html += '<div class="search-section-title">최근 검색어</div>';
      recent.forEach(function(r) {
        html += '<div class="recent-search-item" data-q="' + escHtml(r) + '">' +
          '<span class="recent-search-text">' + escHtml(r) + '</span>' +
          '<button class="recent-search-del" data-del="' + escHtml(r) + '" aria-label="삭제">×</button>' +
          '</div>';
      });
    }
    html += '<div class="search-section-title">인기 검색어</div>';
    POPULAR_KEYWORDS.slice(0, 4).forEach(function(kw) {
      html += '<div class="recent-search-item" data-q="' + escHtml(kw) + '">' +
        '<span class="recent-search-text">' + escHtml(kw) + '</span>' +
        '</div>';
    });
    dropdown.innerHTML = html;
    dropdown.classList.add('active');
    return;
  }

  loadSearchIndex().then(function(index) {
    var results = searchArticles(q, index, 7);
    if (!results.length) {
      dropdown.innerHTML = '<div class="search-no-result">검색 결과가 없습니다.</div>' +
        '<a href="category.html?q=' + encodeURIComponent(q) + '" class="search-footer-link">전체에서 검색하기 →</a>';
      dropdown.classList.add('active');
      return;
    }
    var html = results.map(function(r) {
      var ic = getCatSvg(r.cat);
      return '<a href="' + escHtml(r.url) + '" class="search-result-item">' +
        '<span class="search-result-icon" style="color:#3D5AFE">' + ic + '</span>' +
        '<div class="search-result-body">' +
          '<div class="search-result-cat">' + escHtml(r.cat || '') + '</div>' +
          '<div class="search-result-title">' + highlight(escHtml(r.title || ''), q) + '</div>' +
          '<div class="search-result-desc">' + escHtml((r.desc || '').slice(0, 60)) + '</div>' +
        '</div>' +
        '</a>';
    }).join('');
    html += '<a href="category.html?q=' + encodeURIComponent(q) + '" class="search-footer-link">더 많은 결과 보기 →</a>';
    dropdown.innerHTML = html;
    dropdown.classList.add('active');
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 5. 검색창 초기화 ───────────────────── */
function initSearchInput(inputId, dropdownId) {
  var input = document.getElementById(inputId);
  var dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  var timer = null;

  /* 포커스 → 인기/최근 검색어 표시 */
  input.addEventListener('focus', function() {
    loadSearchIndex();
    renderDropdown(input, dropdown, input.value.trim());
  });

  /* 타이핑 */
  input.addEventListener('input', function() {
    clearTimeout(timer);
    var q = input.value.trim();
    timer = setTimeout(function() {
      renderDropdown(input, dropdown, q);
    }, 180);
  });

  /* 키보드 네비게이션 */
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var q = input.value.trim();
      if (q.length >= 1) {
        addRecentSearch(q);
        window.location.href = 'category.html?q=' + encodeURIComponent(q);
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('active');
      input.blur();
    }
  });

  /* 드롭다운 내부 클릭 */
  dropdown.addEventListener('click', function(e) {
    /* 최근 검색어 삭제 버튼 */
    var delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      e.preventDefault();
      e.stopPropagation();
      removeRecentSearch(delBtn.dataset.del);
      renderDropdown(input, dropdown, input.value.trim());
      return;
    }
    /* 최근/인기 검색어 클릭 */
    var item = e.target.closest('[data-q]');
    if (item) {
      e.preventDefault();
      var q = item.dataset.q;
      input.value = q;
      addRecentSearch(q);
      window.location.href = 'category.html?q=' + encodeURIComponent(q);
      return;
    }
    /* 결과 링크 클릭 */
    var link = e.target.closest('a.search-result-item');
    if (link) {
      addRecentSearch(input.value.trim());
    }
  });

  /* 외부 클릭 시 닫기 */
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });
}

function initSearch() {
  initSearchInput('search-input', 'search-dropdown');
  initSearchInput('search-input-mobile', 'search-dropdown-mobile');
}

/* ── 6. 스크롤 진행바 ───────────────────── */
function initProgressBar() {
  var bar = document.getElementById('progress-bar');
  if (!bar) return;
  function onScroll() {
    var h = document.documentElement;
    var pct = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── 7. 상단 이동 버튼 ──────────────────── */
function initBackToTop() {
  var btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── 8. TOC 스크롤 연동 ─────────────────── */
function initTOC() {
  var links = document.querySelectorAll('.toc-list a');
  var headings = document.querySelectorAll('.article-content h2[id], .article-content h3[id]');
  if (!links.length || !headings.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        links.forEach(function(l) { l.classList.remove('toc-active'); });
        var active = document.querySelector('.toc-list a[href="#' + entry.target.id + '"]');
        if (active) active.classList.add('toc-active');
      }
    });
  }, { rootMargin: '-10% 0px -70% 0px' });

  headings.forEach(function(h) { observer.observe(h); });
}

/* ── 9. 관련글 동적 렌더링 ────────────────── */
function initRelatedPosts() {
  var container = document.getElementById('related-dynamic');
  if (!container) return;

  var currentUrl = location.pathname.split('/').pop() || 'index.html';
  var tagEl = document.querySelector('.article-tag');
  var currentCat = tagEl ? tagEl.textContent.trim() : '';
  var currentCatKey = currentCat.replace(/[^\w가-힣]/g, '').toLowerCase();

  loadSearchIndex().then(function(index) {
    if (!index || !index.length) return;

    var sameCat = index.filter(function(a) {
      if (a.url === currentUrl) return false;
      var aCat = (a.cat || '').replace(/[^\w가-힣]/g, '').toLowerCase();
      return aCat && currentCatKey && aCat.includes(currentCatKey.slice(0, 4));
    });

    /* 부족하면 전체에서 채우기 */
    var pool = sameCat.length >= 3 ? sameCat : index.filter(function(a) { return a.url !== currentUrl; });
    /* 섞기 */
    pool = pool.slice().sort(function() { return Math.random() - 0.5; }).slice(0, 3);

    container.innerHTML = pool.map(function(r) {
      return '<a href="' + escHtml(r.url) + '" class="related-card">' +
        '<div>' +
          '<div class="related-card-tag">' + escHtml(r.cat || '') + '</div>' +
          '<div class="related-card-title">' + escHtml(r.title || '') + '</div>' +
        '</div>' +
        '<div class="related-arrow">→</div>' +
        '</a>';
    }).join('');
  });
}

/* ── 10. 하단 고정 CTA ──────────────────── */
function initStickyCTA() {
  var cta = document.getElementById('sticky-cta');
  if (!cta) return;
  var closeBtn = document.getElementById('sticky-cta-close');
  var closed = false;

  window.addEventListener('scroll', function() {
    if (closed) return;
    var pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    cta.classList.toggle('visible', pct > 35);
  }, { passive: true });

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      cta.classList.remove('visible');
      closed = true;
    });
  }
}

/* ── 11. 카테고리 페이지 검색 파라미터 ─── */
function initCategorySearch() {
  var params = new URLSearchParams(location.search);
  var q = params.get('q');
  if (!q) return;

  /* PC, 모바일 검색창에 쿼리 넣기 */
  ['search-input', 'search-input-mobile'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = q;
  });

  var section = document.getElementById('search-results-section');
  var container = document.getElementById('search-results-list');
  var label = document.getElementById('search-query-label');
  if (!section || !container) return;

  loadSearchIndex().then(function(index) {
    var results = searchArticles(q, index, 20);
    if (label) {
      label.textContent = '"' + q + '" 검색 결과 ' + results.length + '개';
    }
    if (!results.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">검색 결과가 없습니다. 다른 키워드로 시도해보세요.</p>';
    } else {
      container.innerHTML = results.map(function(r) {
        return '<a href="' + escHtml(r.url) + '" class="search-result-full-item">' +
          '<div class="sr-title">' + highlight(escHtml(r.title || ''), q) + '</div>' +
          '<div class="sr-desc">' + escHtml(r.desc || '') + '</div>' +
          '<div class="sr-meta">' + escHtml(r.cat || '') + ' · ' + escHtml(r.date || '') + '</div>' +
          '</a>';
      }).join('');
    }
    section.style.display = 'block';
    setTimeout(function() {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });
}

/* ── 12. 이미지 Lazy Load ──────────────── */
function initLazyLoad() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('img[data-src]').forEach(function(img) {
      img.src = img.dataset.src;
    });
    return;
  }
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        var img = e.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        io.unobserve(img);
      }
    });
  }, { rootMargin: '300px' });
  document.querySelectorAll('img[data-src]').forEach(function(img) { io.observe(img); });
}

/* ── 13. URL 복사 (공유) ────────────────── */
function copyURL() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(location.href).then(function() {
      var btn = document.querySelector('[onclick="copyURL()"]');
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = '✅ 복사됨!';
        setTimeout(function() { btn.textContent = orig; }, 2000);
      }
    });
  } else {
    /* 구형 브라우저 폴백 */
    var ta = document.createElement('textarea');
    ta.value = location.href;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/* ── 초기화 ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  initProgressBar();
  initBackToTop();
  initSearch();
  initTOC();
  initRelatedPosts();
  initStickyCTA();
  initCategorySearch();
  initLazyLoad();
});


/* ===========================================
   체류시간 극대화 모듈 (engage)
   ─────────────────────────────────────────
   1. 계산기 페이지 → 관련 계산기/가이드/인기 TOP5 자동 추천
   2. 게시글 → 관련 계산기 + 같은 카테고리 글 자동 추천
   3. 게시글 본문 안 인라인 계산기 자동 삽입 (페이지 이동 없이 계산)
   4. 인라인 계산기 → "전체 화면으로 열기" 버튼
   5. 데이터(아래 RECO_CALCS / 매핑)만 추가하면 자동 생성
   6. 카드형 반응형 UI
   7. 이전 글 / 다음 글
   8. 같은 카테고리 5개 이상 노출
   9. 계산 완료 영역 하단 추천
  10. 순환형 탐색 구조
   ─────────────────────────────────────────
   · 기존 sohotip.js(전면 개편본)의 loadSearchIndex() 반환값을 사용합니다.
   · 모든 식별자/클래스는 reco / inline-calc 네임스페이스로 무충돌.
=========================================== */

/* 검색 인덱스 (loadSearchIndex 반환값 캐시) */
let _engageIndex = null;

/* ── [데이터] 계산기 레지스트리 ───────────────
   slug   : 파일명 (URL)
   inline : 인라인 계산기 타입 키 (INLINE_CALCS 와 매칭)
   cats   : 연관 콘텐츠 카테고리 (search-index.json 의 cat 값)
   pop    : 인기 순위 (작을수록 인기) — TOP5 정렬용
*/
const RECO_CALCS = [
  { slug: 'alba-cost-calc.html',       icon: '🧮', title: '알바 인건비 계산기',      badge: '인사·노무', desc: '2026 최저시급 기준, 주휴수당·4대보험 포함 월 인건비 자동 계산', cats: ['창업·세금', '소상공인 지원금'], inline: 'wage',      pop: 1 },
  { slug: 'delivery-profit-calc.html', icon: '🛵', title: '배달 순이익 계산기',      badge: '매출·수익', desc: '주문 1건당 수수료·배달비·재료비 빼고 실제 남는 돈 계산',        cats: ['배달앱'],                    inline: 'delivery',  pop: 2 },
  { slug: 'vat-calc.html',             icon: '💰', title: '부가세 계산기',          badge: '세무·법률', desc: '매출·매입 입력 → 납부세액 또는 환급액 즉시 계산',              cats: ['창업·세금'],                 inline: 'vat',       pop: 3 },
  { slug: 'severance-calc.html',       icon: '💼', title: '퇴직금 계산기',          badge: '인사·노무', desc: '근속기간·평균임금 입력 → 법정 퇴직금 자동 산출',              cats: ['창업·세금'],                 inline: 'severance', pop: 4 },
  { slug: 'food-cost-calc.html',       icon: '🍽️', title: '메뉴 원가율 계산기',     badge: '매출·수익', desc: '재료비·판매가 → 원가율·마진율·권장 판매가 계산',              cats: ['배달앱', '창업·세금'],        inline: 'foodcost',  pop: 5 },
  { slug: 'bep-calc.html',             icon: '📈', title: '손익분기점(BEP) 계산기',  badge: '매출·수익', desc: '고정비·변동비율 → 최소 목표 매출과 일 매출 목표 계산',         cats: ['창업·세금'],                 inline: 'bep',       pop: 6 },
  { slug: 'rent-increase-calc.html',   icon: '🏠', title: '임대료 인상 상한 계산기', badge: '세무·법률', desc: '현재 월세 → 법정 5% 상한 기준 최대 인상 가능액 계산',          cats: ['창업·세금'],                 inline: 'rent',      pop: 7 },
  { slug: 'loan-interest-calc.html',   icon: '💳', title: '정책자금 이자 계산기',    badge: '세무·법률', desc: '대출금·금리·기간 → 월 상환액·총이자·총 상환액 계산',           cats: ['소상공인 지원금', '창업·세금'], inline: 'loan',      pop: 8 },
  { slug: 'weekly-pay-calc.html',      icon: '📅', title: '주휴수당 계산기',        badge: '인사·노무', desc: '시급·근무시간 → 주휴수당 지급 여부와 주·월 금액 자동 계산',      cats: ['창업·세금', '소상공인 지원금'], inline: 'wage',      pop: 9 },
  { slug: 'insurance-4d-calc.html',    icon: '🛡️', title: '4대보험 계산기',         badge: '인사·노무', desc: '월급 → 직원 공제액과 사업주 부담액 동시 계산(두루누리 포함)',     cats: ['창업·세금', '소상공인 지원금'], inline: 'wage',      pop: 10 },
  { slug: 'premium-calc.html',         icon: '🔑', title: '권리금 계산기',          badge: '세무·법률', desc: '월 순이익·시설 잔존가치 → 시설+영업 권리금 적정 범위 계산',       cats: ['창업·세금'],                 inline: 'bep',       pop: 11 },
  { slug: 'closure-cost-calc.html',    icon: '📦', title: '폐업 비용 계산기',        badge: '세무·법률', desc: '철거비·퇴직금·재고 + 폐업 지원금 차감한 실부담 계산',            cats: ['창업·세금', '소상공인 지원금'], inline: 'severance', pop: 12 },
  { slug: 'store-profit-calc.html',    icon: '🏪', title: '매장 수익성 계산기',      badge: '매출·수익', desc: '월 매출·비용 → 영업이익률·순이익·목표 손님 수 계산',             cats: ['창업·세금', '배달앱'],        inline: 'bep',       pop: 13 },
  { slug: 'card-fee-calc.html',        icon: '💳', title: '카드수수료 계산기',       badge: '세무·법률', desc: '월 카드매출 → 우대수수료율 구간 자동 적용, 월·연 수수료 계산',    cats: ['창업·세금'],                 inline: 'vat',       pop: 14 },
  { slug: 'delivery-ads-calc.html',    icon: '📣', title: '배달앱 광고비 ROI 계산기', badge: '매출·수익', desc: '광고비·추가 주문 → 배달앱 광고 ROI와 손익분기 주문 수 계산',      cats: ['배달앱'],                    inline: 'delivery',  pop: 15 },
  { slug: 'annual-leave-calc.html',    icon: '🌴', title: '직원 연차 계산기',        badge: '인사·노무', desc: '입사일 → 연차 발생 일수와 미사용 연차수당 자동 계산',            cats: ['창업·세금'],                 inline: 'severance', pop: 16 },
  { slug: 'naver-ads-calc.html',       icon: '📍', title: '네이버 플레이스 광고비 계산기', badge: '매출·수익', desc: '예산·CPC·전환율 → 예상 방문 고객과 고객 1명당 광고비 계산',   cats: ['네이버 플레이스'],            inline: 'bep',       pop: 17 },
  { slug: 'startup-cost-calc.html',    icon: '🚀', title: '창업 초기비용 계산기',     badge: '세무·법률', desc: '업종·평수 → 창업비용(인테리어·보증금·권리금 등)+월 BEP 추정',     cats: ['창업·세금'],                 inline: 'bep',       pop: 18 },
];

/* 카테고리별 추천 계산기 매핑 (게시글 → 함께 쓰는 계산기) */
const CAT_TO_CALCS = {
  '창업·세금':       ['vat-calc.html', 'alba-cost-calc.html', 'severance-calc.html', 'bep-calc.html'],
  '배달앱':          ['delivery-profit-calc.html', 'food-cost-calc.html', 'bep-calc.html'],
  '네이버 플레이스': ['delivery-profit-calc.html', 'food-cost-calc.html', 'bep-calc.html'],
  '소상공인 지원금': ['loan-interest-calc.html', 'vat-calc.html', 'alba-cost-calc.html'],
  'SNS · 숏폼':      ['food-cost-calc.html', 'bep-calc.html', 'delivery-profit-calc.html'],
};

/* 인기글 TOP5 후보 (검색 인덱스에 존재하는 것만 사용, 부족하면 최신순 보충) */
const POP_ARTICLE_SLUGS = [
  'baemin-vs-coupang.html',
  'soho-minimum-wage.html',
  'soho-jiwongeum-2026.html',
  'naver-place-ranking-2026.html',
  'delivery-fee-real-calc.html',
  'general-vs-simple-tax.html',
  'restaurant-startup-cost.html',
];

/* 게시글 slug → 인라인 계산기 타입 명시적 매핑 (예시로 제시된 핵심 글)
   여기에 없으면 제목·키워드로 자동 감지 (detectInlineType) */
const SLUG_TO_INLINE = {
  'soho-minimum-wage.html': 'wage',
  'soho-minimum-wage (2).html': 'wage',
  'parttime-hiring-solution.html': 'wage',
  'employee-insurance-cost.html': 'wage',
  'employee-termination-guide.html': 'severance',
  'general-vs-simple-tax.html': 'vat',
  'card-sales-tax-audit.html': 'vat',
  'tax-refund-soho.html': 'vat',
  'store-transfer-tax.html': 'vat',
  'solo-shop-tax-deduction.html': 'vat',
  'baemin-vs-coupang.html': 'delivery',
  'baemin-takeout-vs-delivery.html': 'delivery',
  'baemin-ultraol-vs-openlist.html': 'delivery',
  'delivery-fee-real-calc.html': 'delivery',
  'public-vs-private-delivery.html': 'delivery',
  'coupangeats-review.html': 'delivery',
  'delivery-ad-reduce.html': 'delivery',
  'restaurant-startup-cost.html': 'bep',
  'cafe-startup-real-cost.html': 'bep',
  'food-cost-control.html': 'foodcost',
  'menu-design-tips.html': 'foodcost',
  'rent-increase-refusal.html': 'rent',
  'premium-money-dispute.html': 'rent',
  'policy-loan-guide.html': 'loan',
  'noran-umbrella.html': 'loan',
  'durunuri-application.html': 'loan',
  'soho-jiwongeum-2026.html': 'loan',
};

/* 제목·키워드 기반 자동 감지 규칙 (위에서부터 우선) */
const INLINE_KEYWORD_RULES = [
  { type: 'wage',      re: /주휴|최저임금|시급|아르바이트|알바|인건비|급여|주급|시간당/ },
  { type: 'severance', re: /퇴직금|해고|권고사직|퇴사/ },
  { type: 'vat',       re: /부가세|부가가치세|간이과세|일반과세|세금\s?신고|매입세액|환급/ },
  { type: 'delivery',  re: /배달\s?수수료|배달앱|배달의민족|배민|쿠팡이츠|쿠팡|울트라콜|오픈리스트|배달비|순이익/ },
  { type: 'bep',       re: /손익분기|BEP|고정비|창업\s?비용|초기\s?비용|손익/ },
  { type: 'foodcost',  re: /원가율|원가\s?관리|재료비|마진|메뉴\s?가격/ },
  { type: 'rent',      re: /임대료|월세|상가\s?임대|환산보증금|권리금|임대차/ },
  { type: 'loan',      re: /대출|이자|정책자금|상환|융자|보증/ },
];

/* ── 포맷 헬퍼 (reco 네임스페이스) ───────────── */
const recoWon = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const recoPct = (n) => (Math.round(n * 10) / 10) + '%';
function recoEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── [데이터] 인라인 계산기 정의 ──────────────
   각 타입: title, sub, full(전체 계산기 URL), fields[], compute(vals)->{main,rows}
   compute 는 순수 함수 — 입력 객체를 받아 결과를 반환합니다.
*/
const INLINE_CALCS = {
  wage: {
    title: '🧮 주휴수당·주급 바로 계산하기',
    sub: '시급과 주 근무시간만 입력하면 주휴수당 포함 주급과 월 예상 급여를 바로 계산합니다. (2026년 최저시급 10,320원)',
    full: 'alba-cost-calc.html',
    fields: [
      { id: 'wage', label: '시급', hint: '(원)', value: 10320, suffix: '원' },
      { id: 'hours', label: '주 근무시간', hint: '(시간)', value: 40, suffix: '시간' },
    ],
    compute: (v) => {
      const wage = v.wage, hours = v.hours;
      const basePay = wage * hours;
      const holiday = hours >= 15 ? (Math.min(hours, 40) / 40) * 8 * wage : 0;
      const weekTotal = basePay + holiday;
      const monthly = weekTotal * 4.345;
      return {
        main: { label: '예상 월급 (주휴 포함)', value: recoWon(monthly) },
        rows: [
          { k: '기본 주급 (시급 × 시간)', v: recoWon(basePay) },
          { k: '주휴수당 (주 1회)', v: hours >= 15 ? recoWon(holiday) : '대상 아님(주 15시간 미만)' },
          { k: '주급 합계', v: recoWon(weekTotal) },
          { k: '월 환산 (4.345주)', v: recoWon(monthly) },
        ],
      };
    },
  },
  severance: {
    title: '🧮 퇴직금 바로 계산하기',
    sub: '월 평균임금과 근속연수를 입력하면 법정 퇴직금을 바로 계산합니다. (1년 이상 근무 시 발생)',
    full: 'severance-calc.html',
    fields: [
      { id: 'avg', label: '월 평균임금', hint: '(원)', value: 2500000, suffix: '원' },
      { id: 'years', label: '근속연수', hint: '(년)', value: 3, suffix: '년' },
    ],
    compute: (v) => {
      const avg = v.avg, years = v.years;
      const daily = (avg * 3) / 91.25; // 1일 평균임금 ≈ 3개월 임금 / 평균일수
      const days = Math.round(years * 365);
      const severance = days >= 365 ? daily * 30 * (days / 365) : 0;
      return {
        main: { label: '예상 퇴직금', value: recoWon(severance) },
        rows: [
          { k: '1일 평균임금(추정)', v: recoWon(daily) },
          { k: '총 재직일수', v: days.toLocaleString('ko-KR') + '일' },
          { k: '계산식', v: '1일평균 × 30 × (재직일/365)' },
          { k: '퇴직금', v: days >= 365 ? recoWon(severance) : '1년 미만 — 지급의무 없음' },
        ],
      };
    },
  },
  vat: {
    title: '🧮 부가세 바로 계산하기',
    sub: '공급가액(부가세 별도 금액)을 입력하면 부가세 10%와 합계금액을 바로 계산합니다.',
    full: 'vat-calc.html',
    fields: [
      { id: 'supply', label: '공급가액', hint: '(부가세 별도)', value: 1000000, suffix: '원' },
    ],
    compute: (v) => {
      const supply = v.supply;
      const vat = supply * 0.1;
      const total = supply + vat;
      return {
        main: { label: '부가세 (10%)', value: recoWon(vat) },
        rows: [
          { k: '공급가액', v: recoWon(supply) },
          { k: '부가세 (10%)', v: recoWon(vat) },
          { k: '합계금액 (공급가+부가세)', v: recoWon(total) },
          { k: '합계금액에서 역산 시 공급가', v: recoWon(total / 1.1) },
        ],
      };
    },
  },
  delivery: {
    title: '🧮 배달 순이익 바로 계산하기',
    sub: '주문금액에서 배달앱 수수료·배달비·재료비를 빼고 실제 남는 순이익을 바로 계산합니다.',
    full: 'delivery-profit-calc.html',
    fields: [
      { id: 'order', label: '주문금액', hint: '(원)', value: 20000, suffix: '원' },
      { id: 'comm', label: '중개수수료율', hint: '(%)', value: 6.8, suffix: '%' },
      { id: 'delivery', label: '업주부담 배달비', hint: '(원)', value: 2400, suffix: '원' },
      { id: 'food', label: '재료비 원가율', hint: '(%)', value: 35, suffix: '%' },
    ],
    compute: (v) => {
      const order = v.order;
      const commission = order * (v.comm / 100);
      const payment = order * 0.012; // 결제수수료 약 1.2%
      const foodCost = order * (v.food / 100);
      const profit = order - commission - payment - v.delivery - foodCost;
      const margin = order ? (profit / order) * 100 : 0;
      return {
        main: { label: '주문 1건당 순이익', value: recoWon(profit) },
        rows: [
          { k: '주문금액', v: recoWon(order) },
          { k: '중개수수료 (' + v.comm + '%)', v: '-' + recoWon(commission), minus: true },
          { k: '결제수수료 (1.2%)', v: '-' + recoWon(payment), minus: true },
          { k: '업주부담 배달비', v: '-' + recoWon(v.delivery), minus: true },
          { k: '재료비 (' + v.food + '%)', v: '-' + recoWon(foodCost), minus: true },
          { k: '순이익률', v: recoPct(margin) },
        ],
      };
    },
  },
  bep: {
    title: '🧮 손익분기점(BEP) 바로 계산하기',
    sub: '월 고정비와 변동비율(원가율)을 입력하면 손익분기 매출과 하루 목표 매출을 바로 계산합니다.',
    full: 'bep-calc.html',
    fields: [
      { id: 'fixed', label: '월 고정비', hint: '(임대료+인건비 등)', value: 5000000, suffix: '원' },
      { id: 'variable', label: '변동비율(원가율)', hint: '(%)', value: 40, suffix: '%' },
    ],
    compute: (v) => {
      const fixed = v.fixed;
      const cmRate = 1 - (v.variable / 100); // 공헌이익률
      const bep = cmRate > 0 ? fixed / cmRate : 0;
      const daily = bep / 30;
      return {
        main: { label: '손익분기 월 매출', value: cmRate > 0 ? recoWon(bep) : '변동비율 100% 미만으로 입력' },
        rows: [
          { k: '월 고정비', v: recoWon(fixed) },
          { k: '공헌이익률 (1 - 변동비율)', v: recoPct(cmRate * 100) },
          { k: '손익분기 월 매출', v: cmRate > 0 ? recoWon(bep) : '-' },
          { k: '하루 목표 매출 (÷30일)', v: cmRate > 0 ? recoWon(daily) : '-' },
        ],
      };
    },
  },
  foodcost: {
    title: '🧮 메뉴 원가율 바로 계산하기',
    sub: '재료비와 판매가를 입력하면 원가율과 마진율을 바로 계산합니다. (외식업 권장 원가율 30~35%)',
    full: 'food-cost-calc.html',
    fields: [
      { id: 'cost', label: '재료비(원가)', hint: '(원)', value: 3500, suffix: '원' },
      { id: 'price', label: '판매가', hint: '(원)', value: 10000, suffix: '원' },
    ],
    compute: (v) => {
      const cost = v.cost, price = v.price;
      const rate = price ? (cost / price) * 100 : 0;
      const margin = price - cost;
      const marginRate = price ? (margin / price) * 100 : 0;
      const recommend = cost / 0.33; // 원가율 33% 기준 권장가
      return {
        main: { label: '원가율', value: recoPct(rate) },
        rows: [
          { k: '재료비', v: recoWon(cost) },
          { k: '판매가', v: recoWon(price) },
          { k: '마진(판매가-재료비)', v: recoWon(margin) },
          { k: '마진율', v: recoPct(marginRate) },
          { k: '권장 판매가 (원가율 33%)', v: recoWon(recommend) },
        ],
      };
    },
  },
  rent: {
    title: '🧮 임대료 인상 상한 바로 계산하기',
    sub: '현재 월세를 입력하면 상가임대차보호법상 연 5% 인상 상한 기준 최대 인상액을 바로 계산합니다.',
    full: 'rent-increase-calc.html',
    fields: [
      { id: 'rent', label: '현재 월세', hint: '(원)', value: 2000000, suffix: '원' },
    ],
    compute: (v) => {
      const rent = v.rent;
      const maxUp = rent * 0.05;
      const after = rent + maxUp;
      return {
        main: { label: '인상 후 최대 월세', value: recoWon(after) },
        rows: [
          { k: '현재 월세', v: recoWon(rent) },
          { k: '법정 상한 인상률', v: '5%' },
          { k: '최대 인상 가능액', v: recoWon(maxUp) },
          { k: '인상 후 월세', v: recoWon(after) },
        ],
      };
    },
  },
  loan: {
    title: '🧮 대출 상환액 바로 계산하기',
    sub: '대출금·연이자율·기간을 입력하면 원리금균등 기준 월 상환액과 총이자를 바로 계산합니다.',
    full: 'loan-interest-calc.html',
    fields: [
      { id: 'principal', label: '대출금', hint: '(원)', value: 10000000, suffix: '원' },
      { id: 'rate', label: '연이자율', hint: '(%)', value: 4.5, suffix: '%' },
      { id: 'months', label: '대출기간', hint: '(개월)', value: 36, suffix: '개월' },
    ],
    compute: (v) => {
      const P = v.principal, n = Math.max(1, Math.round(v.months));
      const r = (v.rate / 100) / 12;
      let monthly;
      if (r === 0) monthly = P / n;
      else monthly = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      const totalPay = monthly * n;
      const totalInterest = totalPay - P;
      return {
        main: { label: '월 상환액 (원리금균등)', value: recoWon(monthly) },
        rows: [
          { k: '대출원금', v: recoWon(P) },
          { k: '월 상환액', v: recoWon(monthly) },
          { k: '총 이자', v: recoWon(totalInterest) },
          { k: '총 상환액', v: recoWon(totalPay) },
        ],
      };
    },
  },
};

/* ── 현재 페이지 slug ─────────────────────────── */
function recoCurrentSlug() {
  let p = location.pathname.split('/').pop();
  if (!p) p = 'index.html';
  return decodeURIComponent(p);
}

/* ── 계산기 조회 헬퍼 ─────────────────────────── */
function calcBySlug(slug) { return RECO_CALCS.find(c => c.slug === slug); }

/* 인라인 계산기 타입 자동 감지 */
function detectInlineType(slug, text) {
  if (SLUG_TO_INLINE[slug]) return SLUG_TO_INLINE[slug];
  const t = (text || '').toLowerCase();
  for (const rule of INLINE_KEYWORD_RULES) {
    if (rule.re.test(text) || rule.re.test(t)) return rule.type;
  }
  return null;
}

/* ── 카드 렌더 헬퍼 ──────────────────────────── */
function calcCardHTML(c) {
  return `<a href="${c.slug}" class="reco-card">
    <div class="reco-card-icon">${c.icon}</div>
    <div class="reco-card-body">
      <span class="reco-card-badge">${recoEsc(c.badge)}</span>
      <div class="reco-card-title">${recoEsc(c.title)}</div>
      <div class="reco-card-desc">${recoEsc(c.desc)}</div>
    </div>
  </a>`;
}
function articleCardHTML(a) {
  return `<a href="${a.url}" class="reco-card">
    <div class="reco-card-icon">📄</div>
    <div class="reco-card-body">
      <span class="reco-card-badge">${recoEsc(a.cat)}</span>
      <div class="reco-card-title">${recoEsc(a.title)}</div>
      <div class="reco-card-desc">${recoEsc(a.desc || '')}</div>
    </div>
  </a>`;
}
function rankItemHTML(item, i, isCalc) {
  const title = item.title;
  const tag = isCalc ? item.badge : (item.cat + (item.rt ? ' · ' + item.rt : ''));
  const url = isCalc ? item.slug : item.url;
  return `<a href="${url}" class="reco-rank-item">
    <span class="reco-rank-num">${i + 1}</span>
    <div class="reco-rank-body">
      <div class="reco-rank-title">${recoEsc(title)}</div>
      <div class="reco-rank-tag">${recoEsc(tag)}</div>
    </div>
    <span class="reco-rank-arrow">→</span>
  </a>`;
}
function recoSectionHTML(title, sub, innerHTML) {
  return `<section class="reco-section">
    <h3 class="reco-section-title">${title}${sub ? `<span class="reco-section-sub">${recoEsc(sub)}</span>` : ''}</h3>
    ${innerHTML}
  </section>`;
}

/* ── 추천 데이터 산출 ────────────────────────── */
function popularCalcs(excludeSlug, n) {
  return RECO_CALCS
    .filter(c => c.slug !== excludeSlug)
    .sort((a, b) => a.pop - b.pop)
    .slice(0, n);
}
function popularArticles(excludeSlug, n) {
  if (!_engageIndex || !_engageIndex.length) return [];
  const seen = new Set();
  const out = [];
  POP_ARTICLE_SLUGS.forEach(slug => {
    if (slug === excludeSlug) return;
    const a = _engageIndex.find(x => x.url === slug);
    if (a && !seen.has(a.url)) { seen.add(a.url); out.push(a); }
  });
  if (out.length < n) {
    _engageIndex
      .filter(a => a.url !== excludeSlug && !seen.has(a.url))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach(a => { if (out.length < n) { seen.add(a.url); out.push(a); } });
  }
  return out.slice(0, n);
}
/* 같은 카테고리 글 (최소 limit개, 부족하면 최신순 보충) */
function sameCategoryArticles(cat, excludeSlug, limit) {
  if (!_engageIndex || !_engageIndex.length) return [];
  const same = _engageIndex.filter(a => a.url !== excludeSlug && a.cat === cat);
  same.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (same.length >= limit) return same.slice(0, limit);
  const have = new Set(same.map(a => a.url));
  const extra = _engageIndex
    .filter(a => a.url !== excludeSlug && !have.has(a.url))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return same.concat(extra).slice(0, limit);
}
/* 게시글에 추천할 계산기 (카테고리 + 키워드 기반) */
function calcsForArticle(cat, inlineType, n) {
  const order = [];
  const push = (slug) => { const c = calcBySlug(slug); if (c && !order.find(x => x.slug === c.slug)) order.push(c); };
  if (inlineType) { const c = RECO_CALCS.find(x => x.inline === inlineType); if (c) push(c.slug); }
  (CAT_TO_CALCS[cat] || []).forEach(push);
  popularCalcs(null, RECO_CALCS.length).forEach(c => push(c.slug));
  return order.slice(0, n);
}
/* 계산기 페이지에서 추천할 다른 계산기 (cats 겹침 우선) */
function relatedCalcs(current, n) {
  return RECO_CALCS
    .filter(c => c.slug !== current.slug)
    .map(c => ({ c, score: c.cats.filter(x => current.cats.includes(x)).length }))
    .sort((a, b) => (b.score - a.score) || (a.c.pop - b.c.pop))
    .slice(0, n)
    .map(x => x.c);
}
/* 계산기 페이지에서 추천할 가이드 글 (cats 매칭) */
function guidesForCalc(current, n) {
  if (!_engageIndex || !_engageIndex.length) return [];
  const inCat = _engageIndex.filter(a => current.cats.includes(a.cat));
  inCat.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (inCat.length >= n) return inCat.slice(0, n);
  const have = new Set(inCat.map(a => a.url));
  const extra = _engageIndex.filter(a => !have.has(a.url)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return inCat.concat(extra).slice(0, n);
}

/* ── 이전 글 / 다음 글 ──────────────────────── */
function prevNextHTML(cat, slug, isCalc) {
  let list, idx, makeLink;
  if (isCalc) {
    list = RECO_CALCS.slice().sort((a, b) => a.pop - b.pop);
    idx = list.findIndex(c => c.slug === slug);
    makeLink = (c) => ({ url: c.slug, title: c.title });
  } else {
    if (!_engageIndex || !_engageIndex.length) return '';
    list = _engageIndex.filter(a => a.cat === cat).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    idx = list.findIndex(a => a.url === slug);
    if (idx === -1) { // 카테고리 매칭 실패 시 전체 기준
      list = _engageIndex.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      idx = list.findIndex(a => a.url === slug);
    }
    makeLink = (a) => ({ url: a.url, title: a.title });
  }
  if (idx === -1) return '';
  const prev = idx > 0 ? makeLink(list[idx - 1]) : null;
  const next = idx < list.length - 1 ? makeLink(list[idx + 1]) : null;
  const prevHTML = prev
    ? `<a href="${prev.url}" class="reco-nav-item reco-nav-prev"><span class="reco-nav-dir">← 이전 글</span><span class="reco-nav-title">${recoEsc(prev.title)}</span></a>`
    : `<span class="reco-nav-item reco-nav-prev reco-nav-empty"><span class="reco-nav-dir">← 이전 글</span><span class="reco-nav-title">처음 글입니다</span></span>`;
  const nextHTML = next
    ? `<a href="${next.url}" class="reco-nav-item reco-nav-next"><span class="reco-nav-dir">다음 글 →</span><span class="reco-nav-title">${recoEsc(next.title)}</span></a>`
    : `<span class="reco-nav-item reco-nav-next reco-nav-empty"><span class="reco-nav-dir">다음 글 →</span><span class="reco-nav-title">마지막 글입니다</span></span>`;
  return `<div class="reco-nav">${prevHTML}${nextHTML}</div>`;
}

/* ── 인라인 계산기 빌드 + 동작 연결 ──────────── */
function buildInlineCalc(type) {
  const def = INLINE_CALCS[type];
  if (!def) return null;
  const wrap = document.createElement('div');
  wrap.className = 'inline-calc';
  wrap.dataset.calcType = type;

  const fieldsHTML = def.fields.map(f => `
    <div class="inline-calc-field${def.fields.length === 1 ? ' full' : ''}">
      <label>${recoEsc(f.label)}${f.hint ? `<span class="ic-hint">${recoEsc(f.hint)}</span>` : ''}</label>
      <div class="inline-calc-input-wrap">
        <input type="number" id="ic-${type}-${f.id}" value="${f.value}" step="any" inputmode="decimal" class="${f.suffix ? 'has-suffix' : ''}">
        ${f.suffix ? `<span class="ic-suffix">${recoEsc(f.suffix)}</span>` : ''}
      </div>
    </div>`).join('');

  wrap.innerHTML = `
    <div class="inline-calc-head">${recoEsc(def.title)}</div>
    <div class="inline-calc-sub">${recoEsc(def.sub)}</div>
    <div class="inline-calc-fields">${fieldsHTML}</div>
    <button type="button" class="inline-calc-btn">계산하기</button>
    <div class="inline-calc-result" id="ic-result-${type}"></div>
    <a href="${def.full}" class="inline-calc-full">🖥️ 고급 계산기 전체 화면으로 열기 →</a>
  `;

  const runCalc = () => {
    const vals = {};
    def.fields.forEach(f => {
      const el = wrap.querySelector(`#ic-${type}-${f.id}`);
      vals[f.id] = parseFloat(el && el.value) || 0;
    });
    const res = def.compute(vals);
    const rowsHTML = res.rows.map(r =>
      `<div class="ic-res-row"><span class="k">${recoEsc(r.k)}</span><span class="v${r.minus ? ' minus' : ''}">${recoEsc(r.v)}</span></div>`
    ).join('');
    const out = wrap.querySelector('#ic-result-' + type);
    out.innerHTML = `
      <div class="ic-res-main">
        <div class="ic-res-label">${recoEsc(res.main.label)}</div>
        <div class="ic-res-value">${recoEsc(res.main.value)}</div>
      </div>
      <div class="ic-res-rows">${rowsHTML}</div>`;
    out.classList.add('show');
    // 계산 결과 공유 바 (링크 복사 / 공유 / 이미지 저장)
    const shareBar = buildShareBar({
      getTarget: () => wrap,
      getUrl: () => location.href,
      getTitle: () => (def.title.replace(/^🧮\s*/, '') + ' — ' + document.title),
      fileBase: def.title.replace(/[^가-힣A-Za-z0-9() ]/g, '').trim() + ' 결과',
    });
    out.appendChild(shareBar);
  };

  wrap.querySelector('.inline-calc-btn').addEventListener('click', runCalc);
  wrap.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCalc(); });
  });
  return wrap;
}

/* 글 본문 중간에 인라인 계산기 삽입 */
function injectInlineCalc(type) {
  const content = document.querySelector('.article-content');
  if (!content || content.querySelector('.inline-calc')) return;
  const node = buildInlineCalc(type);
  if (!node) return;
  const heads = content.querySelectorAll('h2');
  if (heads.length >= 2) {
    const target = heads[Math.min(Math.floor(heads.length / 2), heads.length - 1)];
    content.insertBefore(node, target);
  } else if (heads.length === 1) {
    heads[0].insertAdjacentElement('afterend', node);
  } else {
    const ps = content.querySelectorAll('p');
    if (ps.length >= 2) ps[1].insertAdjacentElement('afterend', node);
    else content.appendChild(node);
  }
}

/* ── 추천 영역 삽입 (계산기 페이지) ──────────── */
function renderCalcPage(current) {
  const host = document.querySelector('.page-wrap') || document.querySelector('main') || document.body;
  if (!host || document.getElementById('reco-root')) return;

  const calcs = relatedCalcs(current, 3);
  const guides = guidesForCalc(current, 5);
  const popC = popularCalcs(null, 5);
  const popA = popularArticles(current.slug, 5);

  const root = document.createElement('div');
  root.id = 'reco-root';
  root.className = 'reco-root';
  let html = '';

  html += prevNextHTML(null, current.slug, true);

  /* 관련 계산기·가이드는 PART 2 inline-calc.js('함께 보면 좋은')가 영수증형으로 렌더.
     중복 방지를 위해 V2가 켜져 있으면 여기서는 생략하고 인기 TOP5/이전·다음만 유지. */
  if (!window.SOHO_RECO_V2) {
    if (calcs.length) {
      html += recoSectionHTML('🧮 다른 사장님들이 함께 많이 사용한 계산기', '',
        `<div class="reco-grid">${calcs.map(calcCardHTML).join('')}</div>`);
    }
    if (guides.length) {
      html += recoSectionHTML('📚 함께 많이 읽은 실전 가이드', '',
        `<div class="reco-grid">${guides.map(articleCardHTML).join('')}</div>`);
    }
  }
  if (popC.length) {
    html += recoSectionHTML('지금 인기 있는 계산기 TOP5', '',
      `<div class="reco-rank-list">${popC.map((c, i) => rankItemHTML(c, i, true)).join('')}</div>`);
  }
  if (popA.length) {
    html += recoSectionHTML('📈 지금 많이 읽는 인기글 TOP5', '',
      `<div class="reco-rank-list">${popA.map((a, i) => rankItemHTML(a, i, false)).join('')}</div>`);
  }
  root.innerHTML = html;
  host.appendChild(root);
}

/* ── 추천 영역 삽입 (게시글) ─────────────────── */
function renderArticlePage(slug) {
  const main = document.querySelector('.article-main') || document.querySelector('.article-content');
  if (!main || document.getElementById('reco-root')) return;

  const meta = (_engageIndex && _engageIndex.length) ? _engageIndex.find(a => a.url === slug) : null;
  let cat = meta ? meta.cat
    : ((document.querySelector('.article-tag') && document.querySelector('.article-tag').textContent) || '').replace(/[^가-힣·\s]/g, '').trim();
  const titleEl = document.querySelector('.article-title');
  const titleText = (meta ? (meta.title + ' ' + (meta.kw || '')) : '')
    + ' ' + ((titleEl && titleEl.textContent) || '');

  // (3) 인라인 계산기 본문 삽입
  const inlineType = detectInlineType(slug, titleText);
  if (inlineType) injectInlineCalc(inlineType);

  // 추천 데이터
  const calcs = calcsForArticle(cat, inlineType, 3);
  const sameCat = sameCategoryArticles(cat, slug, 5);
  const popC = popularCalcs(null, 5);
  const popA = popularArticles(slug, 5);

  const root = document.createElement('div');
  root.id = 'reco-root';
  root.className = 'reco-root';
  let html = '';

  if (calcs.length) {
    html += recoSectionHTML('🧮 이 글을 읽은 사장님들이 함께 사용한 계산기', '',
      `<div class="reco-grid">${calcs.map(calcCardHTML).join('')}</div>`);
  }
  if (sameCat.length) {
    html += recoSectionHTML('📚 함께 읽으면 좋은 글', cat ? cat + ' 카테고리' : '',
      `<div class="reco-grid">${sameCat.map(articleCardHTML).join('')}</div>`);
  }
  if (popC.length) {
    html += recoSectionHTML('지금 인기 있는 계산기 TOP5', '',
      `<div class="reco-rank-list">${popC.map((c, i) => rankItemHTML(c, i, true)).join('')}</div>`);
  }
  if (popA.length) {
    html += recoSectionHTML('📈 오늘 많이 읽는 인기글 TOP5', '',
      `<div class="reco-rank-list">${popA.map((a, i) => rankItemHTML(a, i, false)).join('')}</div>`);
  }
  html += prevNextHTML(cat, slug, false);

  root.innerHTML = html;
  main.appendChild(root);
}

/* ── engage 진입점 ───────────────────────────── */
let _engageStarted = false;
async function initEngage() {
  if (_engageStarted) return; // 중복 실행 방지
  _engageStarted = true;
  const slug = recoCurrentSlug();
  const calc = calcBySlug(slug);
  const isArticle = !!document.querySelector('.article-content');

  if (!calc && !isArticle) return; // 목록·홈·진단 등은 제외

  try { _engageIndex = await loadSearchIndex(); } catch (e) { _engageIndex = []; }

  if (calc) {
    setupCalcShare(slug); // 결과 공유 바 (링크/공유/이미지)
    renderCalcPage(calc);
  } else if (isArticle) {
    renderArticlePage(slug);
  }
}

/* DOMContentLoaded 시점에 따라 안전하게 실행 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngage);
} else {
  initEngage();
}

/* ── 금액 입력 콤마 포맷 (계산기 공통) ─────────────
   input[data-money] 인 금액 필드만 3자리 콤마 자동 표시.
   계산식에서는 getRawNumber('id') 로 콤마 제거 후 숫자를 읽는다. */
function formatNumber(n) {
  return String(n == null ? '' : n).replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function getRawNumber(id) {
  var el = document.getElementById(id);
  return el ? (parseFloat(String(el.value).replace(/,/g, '')) || 0) : 0;
}
function initFormatInput(id) {
  var el = document.getElementById(id);
  if (!el) return;
  if (el.value !== '') el.value = formatNumber(el.value);
  var ph = el.getAttribute('placeholder');
  if (ph) el.setAttribute('placeholder', formatNumber(ph));
  el.addEventListener('input', function () {
    var pos = this.selectionStart || 0, prev = this.value.length;
    this.value = formatNumber(this.value);
    var np = Math.max(0, pos + (this.value.length - prev));
    try { this.setSelectionRange(np, np); } catch (e) {}
  });
}
function initMoneyInputs() {
  var els = document.querySelectorAll('input[data-money]');
  for (var i = 0; i < els.length; i++) if (els[i].id) initFormatInput(els[i].id);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMoneyInputs);
} else {
  initMoneyInputs();
}


/* ===========================================
   계산 결과 공유 모듈 (share)
   ─────────────────────────────────────────
   · 링크 복사 (모든 환경)
   · 공유하기 (모바일: Web Share API → 카카오톡·문자 등 기본 공유창,
              PC: 링크 복사 폴백) — 별도 앱 키 불필요
   · 이미지 저장 (PNG / JPG) — html2canvas 를 CDN 에서 필요할 때만 로드
   ─────────────────────────────────────────
   · share-/toast 네임스페이스로 기존 스타일과 무충돌
=========================================== */

/* 계산기 페이지별 결과 컨테이너 선택자 (페이지마다 다름) */
const CALC_RESULT_SEL = {
  'alba-cost-calc.html': '#result-section',
  'severance-calc.html': '#sev-result',
  'delivery-profit-calc.html': '#result-section',
  'food-cost-calc.html': '#food-result',
  'bep-calc.html': '#bep-result',
  'vat-calc.html': '#g-result',
  'rent-increase-calc.html': '#rent-result',
  'loan-interest-calc.html': '#loan-result',
};

/* ── 토스트 알림 ─────────────────────────────── */
let _toastTimer = null;
function recoToast(msg) {
  let t = document.getElementById('reco-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'reco-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ── 링크 복사 ───────────────────────────────── */
async function recoCopyLink(url) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    recoToast('🔗 링크를 복사했어요! 카카오톡·문자에 붙여넣기 하세요.');
  } catch (e) {
    recoToast('복사에 실패했어요. 주소창의 URL을 직접 복사해 주세요.');
  }
}

/* ── 공유하기 (Web Share → 폴백 복사) ───────────── */
async function recoShare(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title, text: title, url: url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // 사용자가 닫음
    }
  }
  // PC 등 미지원 환경 → 링크 복사로 대체
  await recoCopyLink(url);
}

/* ── html2canvas 지연 로드 ───────────────────── */
let _h2cPromise = null;
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (_h2cPromise) return _h2cPromise;
  _h2cPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.async = true;
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });
  return _h2cPromise;
}

/* ── 이미지 저장 (PNG/JPG) ───────────────────── */
async function recoSaveImage(target, fmt, fileBase, btn) {
  if (!target) { recoToast('저장할 결과가 없어요. 먼저 계산해 주세요.'); return; }
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.textContent = '저장 중…'; btn.disabled = true; }
  try {
    const h2c = await loadHtml2Canvas();
    const canvas = await h2c(target, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
    const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    const data = canvas.toDataURL(mime, 0.95);
    const a = document.createElement('a');
    a.href = data;
    a.download = (fileBase || 'sohotip-결과') + '.' + (fmt === 'jpg' ? 'jpg' : 'png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    recoToast('🖼️ 이미지를 저장했어요!');
  } catch (e) {
    recoToast('이미지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
  } finally {
    if (btn) { btn.textContent = orig; btn.disabled = false; }
  }
}

/* ── 공유 바 생성 ────────────────────────────── */
/* opts: { getTarget(), getUrl(), getTitle(), fileBase } */
function buildShareBar(opts) {
  const bar = document.createElement('div');
  bar.className = 'reco-share';
  bar.innerHTML = `
    <span class="reco-share-label">📤 결과 공유하기</span>
    <div class="reco-share-btns">
      <button type="button" class="reco-share-btn" data-act="copy">🔗 링크 복사</button>
      <button type="button" class="reco-share-btn" data-act="share">💬 공유하기</button>
      <button type="button" class="reco-share-btn" data-act="png">📷 이미지(PNG)</button>
      <button type="button" class="reco-share-btn" data-act="jpg">📷 이미지(JPG)</button>
    </div>`;
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.reco-share-btn');
    if (!b) return;
    const act = b.dataset.act;
    const url = opts.getUrl ? opts.getUrl() : location.href;
    const title = opts.getTitle ? opts.getTitle() : document.title;
    if (act === 'copy') recoCopyLink(url);
    else if (act === 'share') recoShare(url, title);
    else if (act === 'png') recoSaveImage(opts.getTarget(), 'png', opts.fileBase, b);
    else if (act === 'jpg') recoSaveImage(opts.getTarget(), 'jpg', opts.fileBase, b);
  });
  return bar;
}

/* ── 표준 계산기 페이지에 공유 바 연결 ──────────── */
function setupCalcShare(slug) {
  const sel = CALC_RESULT_SEL[slug];
  const result = (sel && document.querySelector(sel)) ||
    document.querySelector('[id*="result"]') ||
    document.querySelector('.result-card, .result-wrap');
  if (!result || document.querySelector('.reco-share')) return;

  const fileBase = (calcBySlug(slug) ? calcBySlug(slug).title : slug.replace('.html', '')) + ' 결과';
  const bar = buildShareBar({
    getTarget: () => result,
    getUrl: () => location.href,
    getTitle: () => document.title,
    fileBase: fileBase,
  });
  bar.style.display = 'none';
  result.insertAdjacentElement('afterend', bar);

  const isVisible = () => {
    if (result.offsetParent !== null) return true;
    try { return getComputedStyle(result).display !== 'none'; } catch (e) { return true; }
  };
  const reveal = () => { if (isVisible()) bar.style.display = ''; };

  // 결과 영역이 표시(계산 완료)되는 순간 공유 바 노출
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(reveal);
    mo.observe(result, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  // 계산 버튼 클릭도 함께 감지 (폴백)
  document.querySelectorAll('.page-wrap button, .calc-card button').forEach(b => {
    b.addEventListener('click', () => setTimeout(reveal, 60));
  });
  reveal();
}

/* 최신 정보 기준 년·월 자동 표시 (.auto-ym) — 매달 방문 시점 기준으로 자동 갱신 */
(function () {
  function setAutoYM() {
    var now = new Date();
    var label = now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월';
    document.querySelectorAll('.auto-ym').forEach(function (el) {
      el.textContent = label;
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setAutoYM);
  } else {
    setAutoYM();
  }
})();

/* ── 실시간 인기글: 최근 30일 조회수 기준 (Firebase Firestore) ──────────────────
   ▷ 설정 전에는 아무 동작도 하지 않으며, HTML에 적힌 기존 인기글 목록이 그대로 보입니다.
   ▷ Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹 </>)에서 받은 값을 아래 firebaseConfig에 붙여넣으면
     그 순간부터 글 조회수가 쌓이고, 홈/카테고리 '인기글'이 최근 30일 조회순으로 자동 표시됩니다. */
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyA4fEgjXaqteKZKQPyF3jixRNOSgt2j-cY",
    authDomain: "sohotip.firebaseapp.com",
    projectId: "sohotip",
    storageBucket: "sohotip.firebasestorage.app",
    messagingSenderId: "709592565992",
    appId: "1:709592565992:web:3bec305682fdb379eb615d"
  };
  var WINDOW_DAYS = 30; // 인기글 집계 기간(일)
  var TOP5_FALLBACK = ["baemin-vs-coupang","naver-place-ranking-2026","soho-jiwongeum-2026","solo-shop-tax-deduction","rent-increase-refusal"];
  var POP_FALLBACK  = ["article","baemin-vs-coupang","soho-jiwongeum-2026","instagram-restaurant","card-terminal-compare"];

  // 설정 전이면 종료 → 기존 정적 인기글 목록 유지
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("PASTE") === 0) return;

  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function ymd(d){ return '' + d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()); }
  function cutoff(){ var d = new Date(); d.setDate(d.getDate() - (WINDOW_DAYS - 1)); return ymd(d); }
  function slugOf(file){ return file.replace(/\.html$/,''); }
  function pageFile(){ var p = location.pathname.split('/').pop() || 'index.html'; return p === '' ? 'index.html' : p; }
  function loadScript(src){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function esc(s){ return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtMeta(a){ var d = (a.date || '').replace(/-/g,'.'); return d + (a.rt ? ' · ' + a.rt : ''); }
  function splitTag(t){ t = (t || '').trim(); var i = t.indexOf(' '); return i > 0 ? { emoji: t.slice(0,i), text: t.slice(i+1) } : { emoji: '📄', text: t }; }

  function renderTop5(el, slugs, meta){
    el.innerHTML = slugs.map(function(slug, idx){
      var a = meta[slug], n = idx + 1, tg = splitTag(a.tag), rank = n <= 3 ? ' rank' + n : '';
      return '<a href="' + a.url + '" class="top5-item">' +
        '<span class="top5-num' + rank + '">' + n + '</span>' +
        '<div class="top5-body">' +
          '<div class="top5-tag">' + esc(tg.text) + '</div>' +
          '<div class="top5-title">' + esc(a.title) + '</div>' +
          '<div class="top5-meta">' + esc(fmtMeta(a)) + '</div>' +
        '</div>' +
        '<div class="top5-icon">' + tg.emoji + '</div>' +
      '</a>';
    }).join('');
  }
  function renderPop(el, slugs, meta){
    el.innerHTML = slugs.map(function(slug, idx){
      var a = meta[slug];
      return '<li><span class="popular-num">' + (idx+1) + '</span><a href="' + a.url + '">' + esc(a.title) + '</a></li>';
    }).join('');
  }

  var BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
  loadScript(BASE + 'firebase-app-compat.js')
    .then(function(){ return loadScript(BASE + 'firebase-firestore-compat.js'); })
    .then(function(){
      firebase.initializeApp(firebaseConfig);
      var db = firebase.firestore();
      var ref = db.collection('stats').doc('pageviews');
      var file = pageFile();

      // 1) 글 페이지: 오늘자 조회수 +1
      var skip = ['index.html','category.html','consultation.html','tools.html'];
      if (/\.html$/.test(file) && skip.indexOf(file) === -1) {
        var counts = {}; counts[slugOf(file)] = {}; counts[slugOf(file)][ymd(new Date())] = firebase.firestore.FieldValue.increment(1);
        ref.set({ counts: counts }, { merge: true }).catch(function(){});
      }

      // 2) 홈/카테고리: 최근 30일 합산 인기글 렌더
      var top5 = document.querySelector('.top5-list');
      var popList = document.querySelector('.popular-list');
      if (!top5 && !popList) return;

      Promise.all([ ref.get(), fetch('search-data.json').then(function(r){ return r.json(); }) ])
        .then(function(arr){
          var snap = arr[0], data = arr[1], meta = {};
          data.forEach(function(a){ meta[slugOf(a.url)] = a; });
          var co = cutoff(), ranked = [];
          if (snap.exists && snap.data().counts){
            var c = snap.data().counts;
            Object.keys(c).forEach(function(slug){
              var sum = 0, days = c[slug] || {};
              Object.keys(days).forEach(function(d){ if (d >= co) sum += (days[d] || 0); });
              if (sum > 0 && meta[slug]) ranked.push({ slug: slug, v: sum });
            });
            ranked.sort(function(a,b){ return b.v - a.v; });
          }
          function fill(fb, n){
            var out = ranked.map(function(x){ return x.slug; });
            for (var i = 0; i < fb.length && out.length < n; i++){ if (out.indexOf(fb[i]) === -1 && meta[fb[i]]) out.push(fb[i]); }
            return out.slice(0, n);
          }
          if (top5) renderTop5(top5, fill(TOP5_FALLBACK, 5), meta);
          if (popList) renderPop(popList, fill(POP_FALLBACK, 5), meta);
        }).catch(function(){});
    }).catch(function(){});
})();

/* ── PART 2 로더: 계산기 매핑 + 미니 계산기/함께보면좋은 ──────────────
   모든 계산기·글 페이지에 이 파일(sohotip.js)이 이미 로드되므로,
   여기서 inline-calc.js 를 한 번만 주입하면 페이지별 수정 없이 적용된다.
   (inline-calc.js 가 필요 시 calc-map.js 를 스스로 로드함) */
(function () {
  if (window.__sohoPart2Loaded) return;
  window.__sohoPart2Loaded = true;
  /* PART 2: 미니 계산기 + "함께 보면 좋은"  /  PART 4: 상담 전환 + 6사이트 네트워크.
     모두 자체 게이트(문맥 맞을 때만 렌더)되므로 전 페이지 로드해도 안전. */
  ['assets/inline-calc.js?v=20260628',
   'assets/consult.js?v=20260628',
   'assets/network.js?v=20260628'].forEach(function (src) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    document.head.appendChild(s);
  });
})();
