/* 소호팁 공유 모듈 — 카카오톡 / 링크 복사 / 네이티브 Web Share API
 * React ShareButton.tsx 의 바닐라 이식판.
 * 사용: const btn = SohoShare.button({ title, description, url, iconOnly, size });
 *       container.appendChild(btn);
 * 전역 SohoShare 노출. 의존성 없음(빌드 불필요).
 */
(function (global) {
  'use strict';

  var DEFAULT_DESC = '소호팁에서 소상공인에게 유용한 정보를 확인하세요.';

  /* ── 토스트 (sonner 대체) ───────────────────── */
  function ensureToastHost() {
    var host = document.getElementById('sc-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'sc-toast-host';
      host.className = 'sc-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }
  function toast(msg, type) {
    var host = ensureToastHost();
    var el = document.createElement('div');
    el.className = 'sc-toast sc-toast--' + (type || 'success');
    el.textContent = msg;
    host.appendChild(el);
    // reflow → 등장 애니메이션
    void el.offsetWidth;
    el.classList.add('is-on');
    setTimeout(function () {
      el.classList.remove('is-on');
      setTimeout(function () { el.remove(); }, 220);
    }, 2000);
  }

  /* ── SVG 아이콘 (lucide 동등) ─────────────────── */
  function svg(paths, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICON = {
    share2: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    link: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    kakao: '<path d="M12 3C6.477 3 2 6.582 2 11c0 2.793 1.665 5.25 4.2 6.75L5.1 21l4.35-2.85c.83.15 1.69.23 2.55.23 5.523 0 10-3.582 10-8S17.523 3 12 3z" fill="#3C1E1E" stroke="none"/>'
  };

  /* ── 카카오톡 공유 ──────────────────────────── */
  function shareKakao(title, description, url) {
    var picker = 'https://sharer.kakao.com/talk/friends/picker/easylink?app_key=none' +
      '&shimless_url=' + encodeURIComponent(url) +
      '&title=' + encodeURIComponent(title) +
      '&description=' + encodeURIComponent(description);
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      var appUrl = 'kakaolink://send?msg=' +
        encodeURIComponent(title + '\n' + description + '\n' + url);
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = appUrl;
      document.body.appendChild(iframe);
      setTimeout(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        window.open(picker, '_blank');
      }, 1000);
    } else {
      window.open(picker, '_blank', 'width=500,height=600');
    }
  }

  /* ── 링크 복사 ──────────────────────────────── */
  function copyLink(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  }

  /* ── 네이티브 공유 ──────────────────────────── */
  function hasNativeShare() {
    return typeof navigator !== 'undefined' && !!navigator.share;
  }
  function nativeShare(title, description, url) {
    if (!navigator.share) return Promise.resolve();
    return navigator.share({ title: title, text: description, url: url })
      .catch(function () {}); // 사용자가 취소해도 조용히 무시
  }

  /* ── 버튼 빌더 ──────────────────────────────── */
  function button(opts) {
    opts = opts || {};
    var title = opts.title || document.title;
    var description = opts.description || DEFAULT_DESC;
    var url = opts.url || (typeof window !== 'undefined' ? window.location.href : '');
    var iconOnly = !!opts.iconOnly;

    // 모바일 네이티브 공유 + iconOnly → 단일 버튼 (메뉴 없음)
    if (hasNativeShare() && iconOnly) {
      var direct = document.createElement('button');
      direct.type = 'button';
      direct.className = 'sc-share-trigger sc-share-trigger--icon';
      direct.setAttribute('aria-label', '공유하기');
      direct.innerHTML = svg(ICON.share2, 18);
      direct.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        nativeShare(title, description, url);
      });
      return direct;
    }

    var wrap = document.createElement('div');
    wrap.className = 'sc-share';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    if (iconOnly) {
      trigger.className = 'sc-share-trigger sc-share-trigger--icon';
      trigger.setAttribute('aria-label', '공유하기');
      trigger.innerHTML = svg(ICON.share2, 18);
    } else {
      trigger.className = 'sc-share-trigger sc-share-trigger--pill';
      trigger.innerHTML = svg(ICON.share2, 15) + '<span>공유</span>';
    }
    wrap.appendChild(trigger);

    var menu, backdrop;
    function close() {
      if (menu) { menu.remove(); menu = null; }
      if (backdrop) { backdrop.remove(); backdrop = null; }
    }
    function open() {
      backdrop = document.createElement('div');
      backdrop.className = 'sc-share-backdrop';
      backdrop.addEventListener('click', function (e) { e.stopPropagation(); close(); });
      wrap.appendChild(backdrop);

      menu = document.createElement('div');
      menu.className = 'sc-share-menu';

      var rowKakao =
        '<button type="button" class="sc-share-item sc-share-item--kakao" data-act="kakao">' +
          '<span class="sc-share-ic sc-share-ic--kakao">' + svg(ICON.kakao, 18) + '</span>' +
          '<span class="sc-share-label">카카오톡</span></button>';
      var rowCopy =
        '<button type="button" class="sc-share-item" data-act="copy">' +
          '<span class="sc-share-ic" data-ic="copy">' + svg(ICON.link, 16) + '</span>' +
          '<span class="sc-share-label" data-label="copy">링크 복사</span></button>';
      var rowMore = hasNativeShare() ?
        '<button type="button" class="sc-share-item sc-share-item--more" data-act="native">' +
          '<span class="sc-share-ic sc-share-ic--more">' + svg(ICON.share2, 16) + '</span>' +
          '<span class="sc-share-label">더 보기</span></button>' : '';

      menu.innerHTML =
        '<div class="sc-share-head"><p>공유하기</p></div>' + rowKakao + rowCopy + rowMore;

      menu.addEventListener('click', function (e) {
        var b = e.target.closest('.sc-share-item');
        if (!b) return;
        e.stopPropagation();
        var act = b.getAttribute('data-act');
        if (act === 'kakao') { shareKakao(title, description, url); close(); }
        else if (act === 'native') { nativeShare(title, description, url); close(); }
        else if (act === 'copy') {
          copyLink(url).then(function () {
            var ic = menu && menu.querySelector('[data-ic="copy"]');
            var lb = menu && menu.querySelector('[data-label="copy"]');
            if (ic) { ic.innerHTML = svg(ICON.check, 16); ic.classList.add('is-copied'); }
            if (lb) lb.textContent = '복사됨!';
            toast('링크가 복사되었습니다', 'success');
            setTimeout(close, 600);
          }).catch(function () {
            toast('링크 복사에 실패했습니다', 'error');
            close();
          });
        }
      });

      wrap.appendChild(menu);
    }

    trigger.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (menu) close(); else open();
    });

    return wrap;
  }

  global.SohoShare = {
    button: button,
    toast: toast,
    shareKakao: shareKakao,
    copyLink: copyLink,
    nativeShare: nativeShare,
    hasNativeShare: hasNativeShare
  };
})(window);
