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
        '<span class="recent-search-text">🔥 ' + escHtml(kw) + '</span>' +
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
      var emoji = getEmoji(r.cat);
      return '<a href="' + escHtml(r.url) + '" class="search-result-item">' +
        '<span class="search-result-icon">' + emoji + '</span>' +
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
