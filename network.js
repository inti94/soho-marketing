/* ===========================================================
   network.js — 공통 푸터(법적 링크) 자동 삽입
   · 모든 페이지 하단에 단 한 번 주입됩니다.
   · 소개 / 개인정보처리방침 / 이용약관 / 연락처 4개 링크 + 저작권.
   · sohotip.css 의존 없이 자체 스타일을 포함해, 어떤 페이지에서도
     동일하게 보이며 기존 푸터와 독립적으로 맨 아래에 붙습니다.
=========================================================== */
(function () {
  if (window.__sohotipNetworkFooter) return;
  window.__sohotipNetworkFooter = true;

  // 푸터에 들어갈 링크 (라벨은 각 페이지 제목과 일치)
  var LINKS = [
    { href: 'about.html',   label: '소개' },
    { href: 'privacy.html', label: '개인정보처리방침' },
    { href: 'terms.html',   label: '이용약관' },
    { href: 'contact.html', label: '연락처' }
  ];

  function injectFooter() {
    if (document.getElementById('network-footer')) return;

    // ── 스타일 (자체 포함) ─────────────────────────────
    var css = [
      '#network-footer{',
      '  background:#111;color:rgba(255,255,255,0.5);',
      '  font-family:"Noto Sans KR",sans-serif;',
      '  font-size:12px;line-height:1.8;text-align:center;',
      '  padding:22px 1.5rem;margin:0;',
      '}',
      '#network-footer .nf-links{',
      '  display:flex;flex-wrap:wrap;justify-content:center;',
      '  gap:8px 18px;margin:0 0 10px;',
      '}',
      '#network-footer .nf-links a{',
      '  color:rgba(255,255,255,0.7);text-decoration:none;',
      '  white-space:nowrap;transition:color .2s;',
      '}',
      '#network-footer .nf-links a:hover{color:#FF5E00;}',
      '#network-footer .nf-copy{color:rgba(255,255,255,0.35);font-size:11px;}'
    ].join('');

    var style = document.createElement('style');
    style.id = 'network-footer-style';
    style.textContent = css;
    document.head.appendChild(style);

    // ── 푸터 DOM ──────────────────────────────────────
    var linksHtml = LINKS.map(function (l) {
      return '<a href="' + l.href + '">' + l.label + '</a>';
    }).join('');

    var year = new Date().getFullYear(); // 연도 자동 갱신

    var footer = document.createElement('footer');
    footer.id = 'network-footer';
    footer.innerHTML =
      '<nav class="nf-links" aria-label="사이트 정보">' + linksHtml + '</nav>' +
      '<div class="nf-copy">© ' + year + ' 소호팁 · sohotip.co.kr</div>';

    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
