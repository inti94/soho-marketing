/* 소호팁 카드 모듈 — 딥 인디고 디자인, 이모지 없이 SVG 아이콘
 * React ArticleCard.tsx / CalculatorCard.tsx 의 바닐라 이식판.
 *
 * 사용:
 *   container.innerHTML = articles.map(SohoCards.article).join('');
 *   container.innerHTML += SohoCards.calculator(calc, { variant:'rank', rank:1 });
 *   SohoCards.mount(container);   // 북마크 토글 + 공유버튼 주입 연결
 *
 * 의존성: soho-share.js (SohoShare). 빌드 불필요.
 */
(function (global) {
  'use strict';

  /* ── 유틸 ──────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 10000) return String((n / 10000).toFixed(1)).replace('.0', '') + '만';
    if (n >= 1000) return String((n / 1000).toFixed(1)).replace('.0', '') + 'k';
    return n.toLocaleString();
  }

  /* ── 북마크 저장소 (localStorage, sohotip_ 접두사) ──── */
  var BM_KEY = 'sohotip_bookmarks';
  var _bmCache = null;
  function getBookmarks() {
    if (_bmCache) return _bmCache;
    var o = {};
    try { o = JSON.parse(localStorage.getItem(BM_KEY)) || {}; } catch (e) { o = {}; }
    /* 구버전 키(soho_bookmarks) 1회 마이그레이션 */
    try {
      var old = JSON.parse(localStorage.getItem('soho_bookmarks'));
      if (old && typeof old === 'object') {
        var changed = false;
        for (var k in old) { if (old[k] && !o[k]) { o[k] = 1; changed = true; } }
        if (changed) localStorage.setItem(BM_KEY, JSON.stringify(o));
      }
    } catch (e) {}
    _bmCache = o;
    return o;
  }
  function isBookmarked(id) { return !!(id && getBookmarks()[id]); }
  function toggleBookmark(id) {
    if (!id) return false;
    var o = getBookmarks();
    if (o[id]) delete o[id]; else o[id] = 1;
    _bmCache = o;
    try { localStorage.setItem(BM_KEY, JSON.stringify(o)); } catch (e) {}
    return !!o[id];
  }

  /* ── SVG 아이콘 레지스트리 (lucide 동등 path) ──── */
  var P = {
    Eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z"/>',
    Bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    ArrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    Bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3.5 11.5L9 9l3-3 4 4h3"/>',
    Receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    TrendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    UtensilsCrossed: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.7 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
    Briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    Home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    CreditCard: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    BarChart2: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    FileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    Building2: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
    Tag: '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    Package: '<path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    CalendarDays: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    UserCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
    Calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/>',
    FolderOpen: '<path d="M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6A2 2 0 0 1 18.46 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
    MapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    Megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    KeyRound: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    Banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    Rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    Camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'
  };
  function icon(name, size, opts) {
    opts = opts || {};
    var paths = P[name] || P.Calculator;
    var sw = opts.strokeWidth || 2;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  /* CategoryIcon 대체: 색상 라운드 배경 + 아이콘
   * size: 'sm'(32) | 'md'(40) | 'lg'(44) | 숫자(px). radius는 CSS .sc-cicon(12px) 고정. */
  function categoryIcon(name, color, size) {
    var px = typeof size === 'number' ? size
      : size === 'sm' ? 32
      : size === 'lg' ? 44
      : 40;                                    // md(기본)
    var ipx = Math.round(px * 0.5);            // 40→20, 44→22, 36→18, 32→16
    return '<span class="sc-cicon" ' +
      'style="color:' + esc(color) + ';background:' + esc(color) + '14;width:' + px + 'px;height:' + px + 'px">' +
      icon(name, ipx) + '</span>';
  }

  /* ── 계산기 색/아이콘 매핑 (CalculatorCard.tsx 이식) ── */
  var CALC_COLORS = {
    'labor-cost': '#3D5AFE', 'delivery-profit': '#FF6B35', 'vat': '#00C471', 'bep': '#FFB800',
    'menu-cost': '#E040FB', 'severance': '#00B8D9', 'rent-ratio': '#F04452', 'card-fee': '#00B8D9',
    'monthly-target': '#3D5AFE', 'income-tax': '#6B7684', 'insurance': '#3D5AFE', 'startup-cost': '#F04452',
    'discount': '#FFB800', 'inventory': '#00C471', 'hourly': '#3D5AFE', 'annual-leave': '#00B8D9',
    'shipping': '#6B7684', 'freelance-tax': '#E040FB'
  };
  var CALC_ICONS = {
    'labor-cost': 'Users', 'delivery-profit': 'Bike', 'vat': 'Receipt', 'bep': 'TrendingUp',
    'menu-cost': 'UtensilsCrossed', 'severance': 'Briefcase', 'rent-ratio': 'Home', 'card-fee': 'CreditCard',
    'monthly-target': 'BarChart2', 'income-tax': 'FileText', 'insurance': 'Shield', 'startup-cost': 'Building2',
    'discount': 'Tag', 'inventory': 'Package', 'hourly': 'Clock', 'annual-leave': 'CalendarDays',
    'shipping': 'Package', 'freelance-tax': 'UserCheck'
  };

  /* 공유 슬롯: mount 시 SohoShare 버튼으로 대체 */
  function shareSlot(title, desc, url) {
    return '<span class="sc-share-slot" data-share-title="' + esc(title) + '" ' +
      'data-share-desc="' + esc(desc) + '" data-share-url="' + esc(url) + '"></span>';
  }
  function bookmarkBtn(size, id) {
    var on = isBookmarked(id);
    return '<button type="button" class="sc-bm' + (on ? ' is-on' : '') + '" data-bm' +
      (id ? ' data-bm-id="' + esc(id) + '"' : '') +
      ' aria-label="' + (on ? '북마크 해제' : '북마크') + '" aria-pressed="' + (on ? 'true' : 'false') +
      '" data-bmsize="' + (size || 16) + '">' +
      icon('Bookmark', size || 16) + '</button>';
  }
  function badges(isNew, isHot, inline) {
    var cls = inline ? ' sc-badge--inline' : '';
    var out = '';
    if (isNew) out += '<span class="sc-badge sc-badge--new' + cls + '">NEW</span>';
    if (isHot) out += '<span class="sc-badge sc-badge--hot' + cls + '">HOT</span>';
    return out;
  }
  function tags(list, kind) {
    if (!list || !list.length) return '';
    var pre = kind === 'article' ? '#' : '';
    var items = list.slice(0, 3).map(function (t, i) {
      return '<span class="sc-tag' + (i === 0 ? ' sc-tag--first' : '') + '">' + pre + esc(t) + '</span>';
    }).join('');
    return '<div class="sc-tags">' + items + '</div>';
  }

  /* ── ArticleCard 이식 ──────────────────────── */
  function article(a) {
    a = a || {};
    var color = a.categoryColor || '#3D5AFE';
    var url = a.url || ('https://sohotip.co.kr/guide/' + (a.id || ''));
    var head =
      '<div class="sc-card-top">' +
        '<div class="sc-cat">' + categoryIcon(a.categoryIcon || 'FileText', color, 'md') +
          '<span class="sc-cat-name">' + esc(a.categoryName || '') + '</span></div>' +
        '<div class="sc-actions">' + bookmarkBtn(16, url) +
          shareSlot(a.title || '', a.desc || '', url) + '</div>' +
      '</div>';
    var body =
      '<div class="sc-art-body">' +
        '<h3 class="sc-title sc-title--art">' + badges(a.isNew, a.isHot, true) + esc(a.title || '') + '</h3>' +
        '<p class="sc-desc sc-desc--art">' + esc(a.desc || '') + '</p>' +
      '</div>';
    /* 썸네일(있을 때만) 우측 80x80 */
    var thumb = a.thumb ? '<div class="sc-art-thumb"><img src="' + esc(a.thumb) + '" alt="" loading="lazy"></div>' : '';
    var mainBlock = thumb ? ('<div class="sc-art-main">' + body + thumb + '</div>') : body;
    var foot =
      '<div class="sc-art-foot">' +
        '<span class="sc-stat">' + icon('Eye', 13) + formatCount(a.views) + '</span>' +
        '<span class="sc-stat">' + icon('Heart', 13) + formatCount(a.likes) + '</span>' +
        '<span class="sc-date">' + esc(a.date || '') + '</span>' +
      '</div>';
    return '<article class="sc-card sc-card--art" data-href="' + esc(url) + '">' +
      head + mainBlock + tags(a.tags, 'article') + foot + '</article>';
  }

  /* ── CalculatorCard 이식 (default / rank / compact) ── */
  function calculator(c, opts) {
    c = c || {}; opts = opts || {};
    var variant = opts.variant || 'default';
    var rank = opts.rank;
    var color = c.color || CALC_COLORS[c.id] || '#3D5AFE';
    var iconName = c.icon || CALC_ICONS[c.id] || 'Calculator';
    var href = c.href || ('/calculator/' + (c.id || ''));

    if (variant === 'rank') {
      return '<a class="sc-rank" href="' + esc(href) + '">' +
        '<span class="sc-rank-num">' + esc(rank) + '</span>' +
        categoryIcon(iconName, color, 44) +
        '<span class="sc-rank-body"><span class="sc-rank-name">' + esc(c.name || '') + '</span>' +
        '<span class="sc-rank-desc">' + esc(c.desc || '') + '</span></span>' +
        '<span class="sc-rank-right"><span class="sc-rank-views">' + formatCount(c.views) + '회</span>' +
        '<span class="sc-rank-arrow">' + icon('ArrowRight', 16) + '</span></span></a>';
    }

    if (variant === 'compact') {
      return '<a class="sc-compact" href="' + esc(href) + '">' +
        categoryIcon(iconName, color, 36) +
        '<span class="sc-compact-body"><span class="sc-compact-name">' + esc(c.name || '') + '</span>' +
        '<span class="sc-compact-desc">' + esc(c.desc || '') + '</span></span>' +
        '<span class="sc-compact-arrow">' + icon('ArrowRight', 16) + '</span></a>';
    }

    // default
    var top =
      '<div class="sc-card-top">' + categoryIcon(iconName, color, 'md') +
        '<div class="sc-actions">' + badges(c.isNew, c.isHot) + bookmarkBtn(15, href) +
          shareSlot((c.name || '') + ' — 소호팁 무료 계산기', c.desc || '', c.href || ('https://sohotip.co.kr/calculator/' + (c.id || ''))) +
        '</div></div>';
    var mid =
      '<a class="sc-calc-link" href="' + esc(href) + '">' +
        '<h3 class="sc-title">' + esc(c.name || '') + '</h3>' +
        '<p class="sc-desc">' + esc(c.desc || '') + '</p></a>';
    var foot =
      '<div class="sc-calc-foot">' +
        '<span class="sc-use">' + formatCount(c.views) + '회 사용</span>' +
        '<a class="sc-go" href="' + esc(href) + '">계산하기' + icon('ArrowRight', 12) + '</a></div>';
    return '<article class="sc-card sc-card--calc" style="--sc-accent:' + esc(color) + '">' +
      top + mid + tags(c.tags, 'calc') + foot + '</article>';
  }

  /* ── 마운트: 북마크 토글 + 공유 슬롯 → SohoShare 버튼 ── */
  function mount(root) {
    root = root || document;

    // 공유 슬롯 주입
    var slots = root.querySelectorAll('.sc-share-slot');
    Array.prototype.forEach.call(slots, function (slot) {
      if (slot.getAttribute('data-mounted')) return;
      slot.setAttribute('data-mounted', '1');
      if (!global.SohoShare) return;
      var btn = global.SohoShare.button({
        title: slot.getAttribute('data-share-title') || '',
        description: slot.getAttribute('data-share-desc') || '',
        url: slot.getAttribute('data-share-url') || '',
        iconOnly: true
      });
      // 카드 클릭 전파 방지
      btn.addEventListener('click', function (e) { e.stopPropagation(); });
      slot.replaceWith(btn);
    });

    // 렌더 직후 저장된 북마크 상태 반영(마크업이 상태 없이 들어온 경우 대비)
    var btns = root.querySelectorAll('.sc-bm[data-bm-id]');
    Array.prototype.forEach.call(btns, function (b) {
      var on = isBookmarked(b.getAttribute('data-bm-id'));
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? '북마크 해제' : '북마크');
    });

    // 북마크 토글 (이벤트 위임) — localStorage 저장 + 같은 id 버튼 동기화 + 이벤트 발행
    if (!root.__scBmBound) {
      root.__scBmBound = true;
      root.addEventListener('click', function (e) {
        var bm = e.target.closest('[data-bm]');
        if (bm && root.contains(bm)) {
          e.preventDefault(); e.stopPropagation();
          var id = bm.getAttribute('data-bm-id');
          var on = id ? toggleBookmark(id) : !bm.classList.contains('is-on');
          // 같은 id 의 모든 북마크 버튼 동기화
          var all = id ? root.querySelectorAll('.sc-bm[data-bm-id]') : [bm];
          Array.prototype.forEach.call(all, function (b) {
            if (id && b.getAttribute('data-bm-id') !== id) return;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            b.setAttribute('aria-label', on ? '북마크 해제' : '북마크');
          });
          try {
            document.dispatchEvent(new CustomEvent('sohocards:bookmark', { detail: { id: id, on: on } }));
          } catch (ev) {}
          return;
        }
        // 카드 전체 클릭 → data-href 이동 (article 카드)
        var card = e.target.closest('.sc-card--art[data-href]');
        if (card && root.contains(card) && !e.target.closest('a,button')) {
          window.location.href = card.getAttribute('data-href');
        }
      });
    }
  }

  global.SohoCards = {
    article: article,
    calculator: calculator,
    mount: mount,
    icon: icon,
    categoryIcon: categoryIcon,
    formatCount: formatCount,
    getBookmarks: getBookmarks,
    isBookmarked: isBookmarked,
    toggleBookmark: toggleBookmark,
    CALC_COLORS: CALC_COLORS,
    CALC_ICONS: CALC_ICONS
  };
})(window);
