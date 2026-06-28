/* =================================================================
   layout.js — 소호팁 공통 레이아웃 주입기 (딥 인디고)
   2026-06-27 신규 생성
   · 헤더(56px) + 좌측 레일 + 하단 탭바(모바일)를 모든 콘텐츠 페이지에 통일 주입
   · 레거시 <nav>(.nav-logo 포함) 와 .mobile-search-bar 를 제거
   · 검색은 새 헤더의 #search-input 으로 이전 → sohotip.js 가 그대로 바인딩
   · 이모지 금지, 전부 inline SVG 라인 아이콘(stroke-width 1.8 / 활성 2.5)
   · sohotip.js '앞'에 로드되어야 함(검색 바인딩 타이밍 보장)
   ================================================================= */
(function () {
  'use strict';

  // 이미 적용됐거나(중복 방지) 자체 레이아웃 페이지면 건너뜀
  if (document.documentElement.classList.contains('soho-chrome')) return;
  if (document.body && document.body.hasAttribute('data-no-chrome')) return;

  /* ── inline SVG 아이콘 세트 (24x24, currentColor) ── */
  var ICONS = {
    home:   '<path d="M3 10.2 12 3l9 7.2"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>',
    calc:   '<rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11.5" x2="9.01" y2="11.5"/><line x1="12" y1="11.5" x2="12.01" y2="11.5"/><line x1="15" y1="11.5" x2="15.01" y2="11.5"/><line x1="9" y1="15.5" x2="9.01" y2="15.5"/><line x1="12" y1="15.5" x2="12.01" y2="15.5"/><line x1="15" y1="15" x2="15" y2="17.5"/>',
    guide:  '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a1 1 0 0 1 1 1v14.5"/><path d="M5.5 3v18H18a1 1 0 0 0 1-1v-1.5H6a2 2 0 0 0-2 2"/>',
    grid:   '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    doc:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
    bell:   '<path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5"/><path d="M13.6 20.5a1.8 1.8 0 0 1-3.2 0"/>'
  };
  function svg(name) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  /* ── 현재 페이지 키(활성 표시용) ── */
  var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  function activeKey() {
    if (path === '' || path === 'index.html') return 'home';
    if (path === 'tools.html') return 'calc';
    if (path === 'forms.html') return 'forms';
    if (path === 'category.html') return 'category';
    return ''; // 일반 글/계산기 상세는 강조 없음
  }
  var akey = activeKey();

  /* ── 레일 항목(6개) / 탭바 항목(5개) ── */
  // 검색 항목은 href 대신 헤더 검색창을 연다
  var RAIL = [
    { key: 'home',     label: '홈',     icon: 'home',   href: 'index.html' },
    { key: 'calc',     label: '계산기', icon: 'calc',   href: 'tools.html' },
    { key: 'guide',    label: '가이드', icon: 'guide',  href: 'category.html' },
    { key: 'category', label: '카테고리', icon: 'grid', href: 'category.html' },
    { key: 'forms',    label: '서식',   icon: 'doc',    href: 'forms.html' },
    { key: 'search',   label: '검색',   icon: 'search', href: '#', search: true }
  ];
  var TABS = [
    { key: 'home',   label: '홈',     icon: 'home',   href: 'index.html' },
    { key: 'calc',   label: '계산기', icon: 'calc',   href: 'tools.html' },
    { key: 'forms',  label: '서식',   icon: 'doc',    href: 'forms.html' },
    { key: 'guide',  label: '가이드', icon: 'guide',  href: 'category.html' },
    { key: 'search', label: '검색',   icon: 'search', href: '#', search: true }
  ];

  function itemHTML(it, cls) {
    var active = (it.key === akey) ? ' active' : '';
    var attrs = it.search ? ' data-search="1"' : '';
    return '<a class="' + cls + active + '" href="' + it.href + '"' + attrs + '>' +
           svg(it.icon) + '<span>' + it.label + '</span></a>';
  }

  /* ── 레거시 헤더 제거 ── */
  function removeLegacy() {
    // .nav-logo 를 품은 상단 GNB <nav> 들 제거
    var navs = document.querySelectorAll('nav');
    for (var i = 0; i < navs.length; i++) {
      if (navs[i].querySelector('.nav-logo')) navs[i].remove();
    }
    var msb = document.querySelector('.mobile-search-bar');
    if (msb) msb.remove();
  }

  /* ── 헤더 ── */
  function buildHeader() {
    var h = document.createElement('header');
    h.className = 'soho-header';
    h.innerHTML =
      '<a class="soho-logo" href="index.html"><span class="l1">소호</span><span class="l2">팁</span></a>' +
      '<div class="soho-hd-right">' +
        '<div class="soho-search">' +
          '<button class="soho-iconbtn" type="button" aria-label="검색" data-search="1">' + svg('search') + '</button>' +
          '<div class="soho-search-box">' +
            '<input type="text" id="search-input" autocomplete="off" placeholder="궁금한 주제를 검색하세요..." aria-label="검색">' +
            '<div id="search-dropdown" role="listbox"></div>' +
          '</div>' +
        '</div>' +
        '<button class="soho-iconbtn" type="button" aria-label="알림">' + svg('bell') + '<span class="dot"></span></button>' +
      '</div>';
    return h;
  }

  /* ── 레일 ── */
  function buildRail() {
    var n = document.createElement('nav');
    n.className = 'soho-rail';
    n.setAttribute('aria-label', '주요 메뉴');
    n.innerHTML = RAIL.map(function (it) { return itemHTML(it, 'soho-rail-item'); }).join('');
    return n;
  }

  /* ── 탭바 ── */
  function buildTabbar() {
    var n = document.createElement('nav');
    n.className = 'soho-tabbar';
    n.setAttribute('aria-label', '하단 메뉴');
    n.innerHTML = TABS.map(function (it) { return itemHTML(it, 'soho-tab'); }).join('');
    return n;
  }

  /* ── 검색창 열기/포커스 ── */
  function openSearch() {
    var box = document.querySelector('.soho-search');
    if (!box) return;
    box.classList.add('open');
    var input = document.getElementById('search-input');
    if (input) input.focus();
  }
  window.__sohoOpenSearch = openSearch;

  function wireSearch() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-search="1"]');
      if (trigger) {
        e.preventDefault();
        openSearch();
        return;
      }
      // 바깥 클릭 시 닫기
      var box = document.querySelector('.soho-search.open');
      if (box && !box.contains(e.target)) box.classList.remove('open');
    });
  }

  /* ── 본문 목차(가이드 글 전용) 자동 생성 ──
     · .article-content 안의 H2/H3를 추출해 본문 맨 위에 목차 블록 삽입
     · H2가 2개 미만이면 생략(짧은 글). 클릭 시 고정 헤더 높이만큼 보정해 부드럽게 스크롤
     · 데스크톱 레거시 사이드바 목차(.sidebar-toc)는 중복 방지로 숨김(사이드바 광고는 유지) */
  function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function injectArticleCss() {
    if (document.getElementById('soho-toc-css')) return;
    var s = document.createElement('style');
    s.id = 'soho-toc-css';
    s.textContent =
      '#progress{position:fixed;top:0;left:0;height:3px;width:0;max-width:100%;background:#3D5AFE;z-index:1200;transition:width .08s linear;pointer-events:none;}' +
      '.soho-toc{background:#fff;border:1px solid #E5E8EB;border-radius:14px;padding:14px 16px 12px;margin:0 0 24px;}' +
      '.soho-toc-head{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#191F28;letter-spacing:-.01em;margin-bottom:8px;}' +
      '.soho-toc-head svg{width:16px;height:16px;flex:none;stroke:#3D5AFE;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}' +
      '.soho-toc-list{list-style:none;margin:0;padding:0;}' +
      '.soho-toc-list li{margin:0;}' +
      '.soho-toc-list a{display:block;padding:6px 8px;border-radius:8px;font-size:14px;line-height:1.45;color:#4E5968;text-decoration:none;transition:background .12s,color .12s;}' +
      '.soho-toc-list a:hover,.soho-toc-list a:focus{background:#F2F4F6;color:#3D5AFE;}' +
      '.soho-toc-list li.lv3 a{padding-left:24px;font-size:13px;color:#6B7684;}' +
      '.soho-toc-list li.lv3 a::before{content:"";position:relative;left:-12px;display:inline-block;width:4px;height:4px;border-radius:50%;background:#C4CAD1;vertical-align:middle;}' +
      '.article-content h2,.article-content h3{scroll-margin-top:84px;}' +
      '.sidebar-toc{display:none!important;}';
    document.head.appendChild(s);
  }
  /* 읽기 진행바: 글 템플릿의 스크립트가 #progress 를 찾는데 요소가 #progress-bar 로 잘못 박혀
     매 스크롤마다 null.style 에러가 나던 것을 #progress 주입으로 바로잡음(에러 제거 + 진행바 복구) */
  function ensureProgressBar() {
    if (!document.querySelector('.article-content')) return;
    if (document.getElementById('progress')) return;
    injectArticleCss();
    var bar = document.createElement('div');
    bar.id = 'progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }
  function buildTOC() {
    var content = document.querySelector('.article-content');
    if (!content || content.querySelector('.soho-toc')) return;
    var heads = content.querySelectorAll('h2, h3');
    var h2n = 0, i;
    for (i = 0; i < heads.length; i++) if (heads[i].tagName === 'H2') h2n++;
    if (h2n < 2) return;                         // 짧은 글(H2 2개 미만) → 목차 생략
    var lis = '', made = 0, seq = 0;
    for (i = 0; i < heads.length; i++) {
      var h = heads[i];
      var txt = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      if (!h.id) h.id = 'sec-' + (++seq);
      lis += '<li class="lv' + (h.tagName === 'H3' ? 3 : 2) + '"><a href="#' + h.id + '">' + escHtml(txt) + '</a></li>';
      made++;
    }
    if (made < 2) return;
    injectArticleCss();
    var listSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
    var nav = document.createElement('nav');
    nav.className = 'soho-toc';
    nav.setAttribute('aria-label', '목차');
    nav.innerHTML = '<div class="soho-toc-head">' + listSvg + '목차</div><ul class="soho-toc-list">' + lis + '</ul>';
    content.insertBefore(nav, content.firstChild);
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      var t = document.getElementById((a.getAttribute('href') || '').slice(1));
      if (!t) return;
      /* scroll-margin-top(84px)로 고정 헤더 보정 — 브라우저 네이티브라 레이아웃 변동에도 안정적 */
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#' + t.id);
    });
  }

  /* ── 실행 ── */
  function mount() {
    if (document.documentElement.classList.contains('soho-chrome')) return;
    removeLegacy();
    var body = document.body;
    body.insertBefore(buildTabbar(), body.firstChild);
    body.insertBefore(buildRail(), body.firstChild);
    body.insertBefore(buildHeader(), body.firstChild);
    document.documentElement.classList.add('soho-chrome');
    wireSearch();
    ensureProgressBar();
    buildTOC();
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
