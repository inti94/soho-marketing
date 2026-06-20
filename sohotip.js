/* ===========================================
   sohotip.js — 소호팁 공통 기능 모음
   · 사이트 내 검색 (Fuse.js 기반)
   · 이미지 Lazy Load
   · 스크롤 진행바
   · 상단 이동 버튼
   · 관련 글 동적 렌더링
   · 읽기 시간 추적 + 이탈 방지 배너
=========================================== */

'use strict';

/* ── 1. 이미지 Lazy Load ───────────────── */
function initLazyLoad() {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          io.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
  } else {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
    });
  }
}

/* ── 2. 스크롤 진행바 ───────────────────── */
function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  }, { passive: true });
}

/* ── 3. 상단 이동 버튼 ──────────────────── */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.style.opacity = window.scrollY > 400 ? '1' : '0';
    btn.style.pointerEvents = window.scrollY > 400 ? 'auto' : 'none';
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ── 4. TOC 활성화 (스크롤 연동) ─────────── */
function initTocHighlight() {
  const links = document.querySelectorAll('.toc-list a');
  const headings = document.querySelectorAll('.article-content h2[id]');
  if (!links.length || !headings.length) return;

  window.addEventListener('scroll', () => {
    let current = '';
    headings.forEach(h => {
      if (window.scrollY >= h.offsetTop - 120) current = h.id;
    });
    links.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  }, { passive: true });
}

/* ── 5. 사이트 내 검색 ──────────────────── */
let searchIndex = null;
let fuse = null;

async function loadSearchIndex() {
  if (searchIndex) return;
  try {
    const res = await fetch('/search-index.json');
    searchIndex = await res.json();
    // 간단한 자체 검색 (Fuse.js 없이 키워드 매칭)
    fuse = {
      search: (q) => {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        return searchIndex
          .map(item => {
            const text = (item.title + ' ' + item.desc + ' ' + item.kw + ' ' + item.cat).toLowerCase();
            const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
            return { item, score };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map(r => r.item);
      }
    };
  } catch(e) {
    console.warn('검색 인덱스 로드 실패:', e);
  }
}

function renderSearchResults(results, container) {
  if (!results.length) {
    container.innerHTML = '<div class="search-no-result">검색 결과가 없습니다.</div>';
    return;
  }
  container.innerHTML = results.map(r => `
    <a href="${r.url}" class="search-result-item">
      <div class="search-result-cat">${r.cat}</div>
      <div class="search-result-title">${r.title}</div>
      <div class="search-result-desc">${r.desc}</div>
    </a>
  `).join('');
}

function bindSearchInput(input, dropdown) {
  if (!input || !dropdown) return;
  let timer;
  input.addEventListener('focus', loadSearchIndex);
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      await loadSearchIndex();
      if (!fuse) return;
      const results = fuse.search(q);
      renderSearchResults(results, dropdown);
      dropdown.style.display = 'block';
    }, 200);
  });
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      window.location.href = `category.html?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

function initSearch() {
  // PC 검색창
  bindSearchInput(
    document.getElementById('search-input'),
    document.getElementById('search-dropdown')
  );
  // 모바일 검색창
  bindSearchInput(
    document.getElementById('search-input-mobile'),
    document.getElementById('search-dropdown-mobile')
  );
}

/* ── 6. 관련 글 동적 렌더링 ─────────────── */
async function initRelatedPosts() {
  const container = document.getElementById('related-dynamic');
  if (!container) return;

  await loadSearchIndex();
  if (!searchIndex) return;

  // 현재 페이지 정보
  const currentUrl = location.pathname.split('/').pop();
  const currentCat = document.querySelector('.article-tag')?.textContent?.trim() || '';
  const currentTitle = document.querySelector('.article-title')?.textContent?.trim() || '';

  // 같은 카테고리 글 중 현재 글 제외, 랜덤 3개
  const catClean = currentCat.replace(/[^\w\s·가-힣]/g, '').trim();
  const sameCat = searchIndex.filter(a =>
    a.url !== currentUrl &&
    a.cat.includes(catClean.slice(-4)) // 카테고리 끝 4글자로 매칭
  );

  // 섞어서 3개 선택
  const shuffled = sameCat.sort(() => Math.random() - 0.5).slice(0, 3);
  // 부족하면 전체에서 추가
  if (shuffled.length < 3) {
    const extra = searchIndex
      .filter(a => a.url !== currentUrl && !shuffled.find(s => s.url === a.url))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3 - shuffled.length);
    shuffled.push(...extra);
  }

  container.innerHTML = shuffled.map(r => `
    <a href="${r.url}" class="related-card">
      <div>
        <div class="related-card-title">${r.title}</div>
        <div class="related-card-tag">${r.cat} · ${r.rt}</div>
      </div>
      <div class="related-arrow">→</div>
    </a>
  `).join('');
}

/* ── 7. 이탈 방지 하단 고정 배너 ──────────── */
function initStickyCTA() {
  const cta = document.getElementById('sticky-cta');
  if (!cta) return;

  let shown = false;
  window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    if (pct > 40 && !shown) {
      cta.style.transform = 'translateY(0)';
      shown = true;
    }
  }, { passive: true });

  document.getElementById('sticky-cta-close')?.addEventListener('click', () => {
    cta.style.transform = 'translateY(110%)';
  });
}

/* ── 8. 카테고리 페이지 URL 검색 파라미터 처리 ── */
function initCategorySearch() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (!q) return;

  const input = document.getElementById('search-input');
  if (input) input.value = q;

  // 검색 결과 섹션 표시
  loadSearchIndex().then(() => {
    if (!fuse) return;
    const results = fuse.search(q);
    const section = document.getElementById('search-results-section');
    const container = document.getElementById('search-results-list');
    if (section && container) {
      document.getElementById('search-query-label').textContent = `"${q}" 검색 결과 ${results.length}개`;
      renderSearchResults(results, container);
      section.style.display = 'block';
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

/* ── 9. 공유 버튼 ───────────────────────── */
function copyURL() {
  navigator.clipboard.writeText(location.href).then(() => {
    const btn = document.querySelector('.share-btn[onclick]');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ 복사됨';
      setTimeout(() => btn.textContent = orig, 2000);
    }
  });
}

/* ── 초기화 ────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initLazyLoad();
  initProgressBar();
  initBackToTop();
  initTocHighlight();
  initSearch();
  initRelatedPosts();
  initStickyCTA();
  initCategorySearch();
});
