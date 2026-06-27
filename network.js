/* ===========================================================
   network.js — 공통 법적 링크(소개·개인정보처리방침·이용약관·연락처)
   를 "기존 푸터 안에" 합쳐주는 스크립트.
   · 페이지에 이미 푸터가 있으면 그 안에 4개 링크를 보강합니다.
     - href="#" 같은 죽은 링크는 실제 경로로 복구
     - 이미 들어있는 링크는 중복 추가하지 않음(예: index)
     - 빠진 링크만 한 줄로 덧붙임(예: 계산기 푸터)
   · 푸터가 아예 없는 페이지(신규 4개 등)에만 단독 푸터 바를 만듭니다.
=========================================================== */
(function () {
  if (window.__sohotipFooterLinks) return;
  window.__sohotipFooterLinks = true;

  // 라벨은 각 페이지 제목과 일치. match = 기존 죽은 링크 텍스트 매칭용 키워드.
  var TARGETS = [
    { href: 'about.html',   label: '소개',            match: ['소개'] },
    { href: 'privacy.html', label: '개인정보처리방침', match: ['개인정보'] },
    { href: 'terms.html',   label: '이용약관',         match: ['이용약관'] },
    { href: 'contact.html', label: '연락처',           match: ['문의', '연락처'] }
  ];

  function basename(href) {
    if (!href) return '';
    return href.split('#')[0].split('?')[0].split('/').pop();
  }

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css = [
      '.nf-links{display:flex;flex-wrap:wrap;justify-content:center;',
      '  gap:8px 18px;margin:16px 0 0;}',
      '.nf-links a{color:rgba(255,255,255,0.6);text-decoration:none;',
      '  font-size:12px;white-space:nowrap;transition:color .2s;}',
      '.nf-links a:hover{color:#3D5AFE;}',
      '#network-footer{background:#111;padding:22px 1.5rem;text-align:center;',
      '  font-family:"Noto Sans KR",sans-serif;margin:0;}',
      '#network-footer .nf-links{margin:0 0 10px;}',
      '#network-footer .nf-copy{color:rgba(255,255,255,0.35);font-size:11px;}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'network-footer-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildLinks(targets) {
    var nav = document.createElement('nav');
    nav.className = 'nf-links';
    nav.setAttribute('aria-label', '사이트 정보');
    nav.innerHTML = targets.map(function (x) {
      return '<a href="' + x.href + '">' + x.label + '</a>';
    }).join('');
    return nav;
  }

  function createStandalone() {
    if (document.getElementById('network-footer')) return;
    injectStyle();
    var year = new Date().getFullYear();
    var footer = document.createElement('footer');
    footer.id = 'network-footer';
    footer.appendChild(buildLinks(TARGETS));
    var copy = document.createElement('div');
    copy.className = 'nf-copy';
    copy.textContent = '© ' + year + ' 소호팁 · sohotip.co.kr';
    footer.appendChild(copy);
    document.body.appendChild(footer);
  }

  function mergeIntoFooter(footer) {
    var anchors = footer.getElementsByTagName('a');

    // 1) 죽은 링크(#/빈값) 복구 — 라벨 키워드가 맞으면 실제 경로로
    for (var j = 0; j < anchors.length; j++) {
      var a = anchors[j];
      var raw = a.getAttribute('href');
      if (raw === '#' || raw === '' || raw === null) {
        var txt = (a.textContent || '').trim();
        for (var t = 0; t < TARGETS.length; t++) {
          var hit = TARGETS[t].match.some(function (m) { return txt.indexOf(m) !== -1; });
          if (hit) { a.setAttribute('href', TARGETS[t].href); break; }
        }
      }
    }

    // 2) 복구 후 현재 푸터에 있는 링크 파일명 수집
    var present = {};
    for (var k = 0; k < anchors.length; k++) {
      present[basename(anchors[k].getAttribute('href'))] = true;
    }

    // 3) 아직 빠진 타깃만 한 줄로 추가
    var missing = TARGETS.filter(function (x) { return !present[x.href]; });
    if (missing.length) {
      injectStyle();
      footer.appendChild(buildLinks(missing));
    }
  }

  function run() {
    var existing = null, all = document.getElementsByTagName('footer');
    for (var i = 0; i < all.length; i++) {
      if (all[i].id !== 'network-footer') { existing = all[i]; break; }
    }
    if (existing) mergeIntoFooter(existing);
    else createStandalone();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();


/* ===========================================================
   network.js — 사이트 네트워크 크로스 추천 위젯
   ---------------------------------------------------------------
   현재 페이지의 키워드(meta keywords·제목)를 읽어, 아래 SITES
   목록 중 주제가 겹치는 "다른 사이트"를 자동으로 골라 본문 하단에
   카드 형태로 보여줍니다.

   ▒ 사이트가 늘어나면 여기 SITES 배열에만 한 줄 추가하세요.
     - network.js는 이미 전 페이지에 로드돼 있어 전체에 자동 반영됩니다.
     - 현재 보고 있는 사이트(sohotip.co.kr)는 자동으로 추천에서 제외됩니다.

   ▒ 항목 형식
     {
       name:     '표시 이름',
       url:      'https://example.com',     // 절대 URL
       tagline:  '한 줄 소개(사장님 눈높이로)',
       emoji:    '🧮',                       // 카드 아이콘(선택)
       keywords: ['세금', '부가세', '환급'], // 이 사이트와 겹치는 주제어
       featured: false,                      // true면 매칭 없어도 후보로 채움
       enabled:  true                        // false면 노출 안 함(작업 중 사이트 숨김)
     }

   ※ 아래 항목들은 "구조 예시"입니다. enabled:false 라서 실제로는
     노출되지 않습니다. 실제 보유 사이트 도메인이 생기면 url을 채우고
     enabled:true 로 바꾸면 그 즉시 전 페이지에 반영됩니다.
=========================================================== */
(function () {
  if (window.__sohotipNetworkReco) return;
  window.__sohotipNetworkReco = true;

  var SITES = [
    // ── 예시(비활성) ─ 실제 사이트가 생기면 url 채우고 enabled:true ──
    {
      name: '소호택스',
      url: 'https://example.com',
      tagline: '부가세·종소세·환급까지, 세금만 따로 모은 곳',
      emoji: '🧾',
      keywords: ['세금', '부가세', '종합소득세', '환급', '간이과세', '세무', '절세'],
      featured: false,
      enabled: false
    },
    {
      name: '소호마케팅',
      url: 'https://example.com',
      tagline: '네이버·인스타·배달앱 광고 실전 가이드',
      emoji: '📣',
      keywords: ['마케팅', '광고', '네이버', '인스타', '블로그', '배달', '플레이스', 'SNS', '리뷰'],
      featured: false,
      enabled: false
    },
    {
      name: '소호창업',
      url: 'https://example.com',
      tagline: '창업비용·인테리어·권리금 따져보기',
      emoji: '🏪',
      keywords: ['창업', '인테리어', '권리금', '임대', '계약', '폐업', '비용', '대출'],
      featured: false,
      enabled: false
    }
    // ── 새 사이트는 위 형식대로 여기에 추가 ──
  ];

  var MAX_CARDS = 3; // 한 번에 보여줄 최대 추천 사이트 수

  function currentHost() {
    try { return location.hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }

  // 현재 페이지의 주제 텍스트(키워드+제목)를 한 덩어리로
  function pageText() {
    var parts = [];
    var mk = document.querySelector('meta[name="keywords"]');
    if (mk && mk.content) parts.push(mk.content);
    var og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) parts.push(og.content);
    if (document.title) parts.push(document.title);
    var h1 = document.querySelector('h1');
    if (h1 && h1.textContent) parts.push(h1.textContent);
    return parts.join(' ');
  }

  // 사이트별 매칭 점수 = 겹치는 키워드 수
  function scoreSite(site, blob) {
    var n = 0;
    for (var i = 0; i < site.keywords.length; i++) {
      if (blob.indexOf(site.keywords[i]) !== -1) n++;
    }
    return n;
  }

  function pickSites() {
    var host = currentHost();
    var blob = pageText();
    var pool = SITES.filter(function (s) {
      return s.enabled && hostOf(s.url) !== host; // 비활성·자기 자신 제외
    });

    var scored = pool.map(function (s) {
      return { site: s, score: scoreSite(s, blob) };
    });

    // 1) 키워드가 겹치는 사이트 우선(점수 내림차순)
    var matched = scored.filter(function (x) { return x.score > 0; })
                        .sort(function (a, b) { return b.score - a.score; });

    var chosen = matched.slice(0, MAX_CARDS).map(function (x) { return x.site; });

    // 2) 자리가 남으면 featured 사이트로 채움(중복 제외)
    if (chosen.length < MAX_CARDS) {
      pool.forEach(function (s) {
        if (chosen.length >= MAX_CARDS) return;
        if (s.featured && chosen.indexOf(s) === -1) chosen.push(s);
      });
    }
    return chosen;
  }

  var recoStyleInjected = false;
  function injectRecoStyle() {
    if (recoStyleInjected) return;
    recoStyleInjected = true;
    var css = [
      '#network-reco{max-width:760px;margin:36px auto 8px;padding:0 1.25rem;',
      '  font-family:"Noto Sans KR",sans-serif;box-sizing:border-box;}',
      '#network-reco .nr-head{font-size:13px;font-weight:700;color:#888;',
      '  letter-spacing:.02em;margin:0 0 12px;display:flex;align-items:center;gap:7px;}',
      '#network-reco .nr-head::before{content:"";width:18px;height:2px;background:#3D5AFE;display:inline-block;}',
      '#network-reco .nr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}',
      '#network-reco .nr-card{display:flex;flex-direction:column;gap:6px;',
      '  padding:16px 16px 15px;border:1px solid #eee;border-radius:12px;',
      '  background:#fff;text-decoration:none;transition:border-color .2s,box-shadow .2s,transform .2s;}',
      '#network-reco .nr-card:hover{border-color:#3D5AFE;box-shadow:0 6px 18px rgba(61,90,254,.10);transform:translateY(-2px);}',
      '#network-reco .nr-name{font-size:15px;font-weight:700;color:#1a1a1a;display:flex;align-items:center;gap:7px;}',
      '#network-reco .nr-tag{font-size:13px;line-height:1.5;color:#666;}',
      '#network-reco .nr-go{font-size:12px;font-weight:600;color:#3D5AFE;margin-top:2px;}',
      '@media(prefers-color-scheme:dark){',
      '  #network-reco .nr-card{background:#1c1c1c;border-color:#2c2c2c;}',
      '  #network-reco .nr-name{color:#f3f3f3;}',
      '  #network-reco .nr-tag{color:#aaa;}}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'network-reco-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildCard(site) {
    var a = document.createElement('a');
    a.className = 'nr-card';
    a.href = site.url;
    a.target = '_blank';
    a.rel = 'noopener';
    var name = document.createElement('div');
    name.className = 'nr-name';
    name.textContent = (site.emoji ? site.emoji + ' ' : '') + site.name;
    var tag = document.createElement('div');
    tag.className = 'nr-tag';
    tag.textContent = site.tagline || '';
    var go = document.createElement('div');
    go.className = 'nr-go';
    go.textContent = '바로가기 →';
    a.appendChild(name);
    a.appendChild(tag);
    a.appendChild(go);
    return a;
  }

  function renderReco() {
    if (document.getElementById('network-reco')) return;
    var sites = pickSites();
    if (!sites.length) return; // 추천할 사이트가 없으면 위젯 자체를 만들지 않음

    injectRecoStyle();
    var box = document.createElement('section');
    box.id = 'network-reco';
    box.setAttribute('aria-label', '함께 보면 좋은 사이트');

    var head = document.createElement('div');
    head.className = 'nr-head';
    head.textContent = '함께 보면 좋은 사이트';
    box.appendChild(head);

    var grid = document.createElement('div');
    grid.className = 'nr-grid';
    sites.forEach(function (s) { grid.appendChild(buildCard(s)); });
    box.appendChild(grid);

    // 법적 푸터(#network-footer / 기존 footer) 바로 위에 삽입
    var footer = document.getElementById('network-footer');
    if (!footer) {
      var all = document.getElementsByTagName('footer');
      if (all.length) footer = all[all.length - 1];
    }
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(box, footer);
    } else {
      document.body.appendChild(box);
    }
  }

  // 푸터 모듈(위 IIFE)이 먼저 footer를 만들 수 있도록 살짝 뒤에 실행
  function runReco() { setTimeout(renderReco, 0); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runReco);
  } else {
    runReco();
  }
})();
