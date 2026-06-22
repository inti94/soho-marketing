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
      '.nf-links a:hover{color:#FF5E00;}',
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
