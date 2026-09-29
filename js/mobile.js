/* ============================================================
   MOBILE.JS - "Signal Pocket": the phone / tablet experience.
   Runs whenever the desktop stage is not in use and owns the
   whole touch experience (desktop code paths are untouched).

   setup()  - layout + interaction that also works without GSAP
              or with reduced motion: header readout, the sticky
              project deck, details sheet, menu, touch feedback.
   run(api) - choreography, called by the inline engine once the
              boot finishes (motion allowed, GSAP present).

   Reveal rule: everything plays ONCE on the way down; anything
   the viewer walks back into from below is already complete.
   ============================================================ */
(function () {
  'use strict';

  var DESKTOP_Q = '(min-width:861px) and (hover:hover) and (pointer:fine)';
  var forced = (location.search.match(/[?&]engine=(stage|mobile|static)\b/) || [])[1];
  var isM = forced ? forced !== 'stage' : !window.matchMedia(DESKTOP_Q).matches;
  window.PSMobile = { run: function () {} };
  if (!isM) return;

  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var NAMES = { top: 'HERO', now: 'NOW', about: 'PROFILE', work: 'CHANNELS', oss: 'OPEN SOURCE', method: 'METHOD', stack: 'STACK', log: 'LOG', contact: 'CONTACT' };
  var ORDER = ['top', 'now', 'about', 'work', 'oss', 'method', 'stack', 'log', 'contact'];
  var GLYPHS = '!<>-_\\/[]{}=+*^?#0123456789ABCDEF';
  var API = null, G = null, ST = null;
  var chans = [], activeCard = -1, deckOn = false, sheetOpen = false;
  var readNum = null, readTxt = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function scramble(node, text, dur) {
    if (!node) return;
    if (reduce) { node.textContent = text; return; }
    var total = Math.max(1, Math.round((dur || 320) / 16.7)), f = 0, len = text.length;
    (function tick() {
      var rev = Math.floor(len * (f / total)), out = '';
      for (var i = 0; i < len; i++) out += i < rev || text[i] === ' ' ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      node.textContent = out;
      if (f++ < total) requestAnimationFrame(tick); else node.textContent = text;
    })();
  }
  // haptics only after the visitor has touched the page (browsers block it before), never with reduced motion
  var touched = false;
  function buzz(ms) {
    if (reduce || !touched || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) {}
  }

  /* ================= SETUP (static-safe) ================= */
  function setup() {
    document.body.classList.add('m');
    buildReadout();
    buildDeck();
    buildSheet();
    buildMenu();
    buildTouch();
    buildStackTips();
    buildLogLine();
    buildRewind();
    buildScopeReadout();
    watchSections();
  }

  /* header channel readout: CH 03 · PROFILE, or P/02 · REVENANT inside the deck */
  function buildReadout() {
    var nav = $('.nav'), btn = $('#menuBtn');
    if (!nav || !btn) return;
    var r = el('div', 'm-read', '<i></i><b>CH 01</b><span>HERO</span>');
    r.setAttribute('aria-hidden', 'true');
    nav.insertBefore(r, btn);
    readNum = r.querySelector('b'); readTxt = r.querySelector('span');
  }
  var lastRead = '';
  function setRead(num, txt) {
    var key = num + '|' + txt;
    if (!readNum || key === lastRead) return;
    lastRead = key; readNum.textContent = num; scramble(readTxt, txt, 300);
    var h = document.getElementById('hdr');
    if (h && !reduce) { h.classList.remove('tune'); void h.offsetWidth; h.classList.add('tune'); }
  }
  var currentSec = 'top';
  function watchSections() {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id; currentSec = id;
        if (id === 'work' && activeCard >= 0) { readCard(activeCard); }
        else setRead('CH ' + pad2(ORDER.indexOf(id) + 1), NAMES[id] || '');
        $$('.menu-overlay nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ORDER.forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
  function readCard(i) {
    var ch = chans[i]; if (!ch) return;
    var name = ($('h3 a', ch) || {}).firstChild; name = name ? name.textContent.trim() : '';
    setRead('P/' + pad2(i + 1), name.toUpperCase());
  }

  /* ---------- the sticky project deck ---------- */
  function buildDeck() {
    var pin = $('#work .work-pin'); if (!pin) return;
    chans = $$('.ch', pin);
    chans.forEach(function (ch, i) {
      ch.style.setProperty('--i', i);
      // a zero-height marker in normal flow where each card would sit unstuck: scroll maths reads these
      var mark = el('div', 'm-mark'); mark.setAttribute('aria-hidden', 'true');
      pin.insertBefore(mark, ch); ch._mark = mark;
      ch.appendChild(el('div', 'm-dim'));
      var media = $('.ch-media', ch);
      if (media) {
        media.appendChild(el('span', 'm-num', pad2(i + 1)));
        media.appendChild(el('span', 'm-cid', 'CH.<b>' + pad2(i + 1) + '</b> / ' + pad2(chans.length)));
        media.addEventListener('click', function () { openSheet(ch); });
        // the footage tilts under the finger like a handheld screen
        if (!reduce) {
          var tiltTo = function (e) {
            var t = e.touches[0], r = media.getBoundingClientRect();
            media.style.setProperty('--ry', ((t.clientX - r.left) / r.width - 0.5) * 10 + 'deg');
            media.style.setProperty('--rx', (0.5 - (t.clientY - r.top) / r.height) * 8 + 'deg');
          };
          media.addEventListener('touchstart', function (e) { media.classList.add('touching'); tiltTo(e); }, { passive: true });
          media.addEventListener('touchmove', tiltTo, { passive: true });
          var untilt = function () { media.classList.remove('touching'); media.style.setProperty('--rx', '0deg'); media.style.setProperty('--ry', '0deg'); };
          media.addEventListener('touchend', untilt); media.addEventListener('touchcancel', untilt);
        }
      }
      var link = $('h3 a', ch), body = $('.ch-body', ch);
      var live = link && link.dataset.cursor === 'live';
      var acts = el('div', 'm-actions',
        '<button class="m-btn pri" type="button">Details <span class="ar">↑</span></button>' +
        (link ? '<a class="m-btn" href="' + link.getAttribute('href') + '" target="_blank" rel="noopener">' + (live ? 'Live' : 'Code') + ' ↗</a>' : ''));
      acts.querySelector('button').addEventListener('click', function () { openSheet(ch); });
      body.appendChild(acts);
    });
  }

  /* ---------- details bottom sheet (drag to dismiss, back button closes) ---------- */
  var sheet, panel, sBody, sTag, sheetCh = null, scrollY0 = 0, pushed = false;
  function buildSheet() {
    sheet = el('div', 'm-sheet');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = '<div class="m-sheet__scrim"></div><div class="m-sheet__panel"><div class="m-sheet__handle"><div class="m-sheet__grab"></div></div>' +
      '<div class="m-sheet__head"><span class="m-sheet__tag"></span><button class="m-sheet__x" type="button" aria-label="Close details">✕</button></div><div class="m-sheet__body"></div></div>';
    document.body.appendChild(sheet);
    panel = $('.m-sheet__panel', sheet); sBody = $('.m-sheet__body', sheet); sTag = $('.m-sheet__tag', sheet);
    $('.m-sheet__scrim', sheet).addEventListener('click', function () { closeSheet(); });
    $('.m-sheet__x', sheet).addEventListener('click', function () { closeSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
    window.addEventListener('popstate', function () { if (sheetOpen) { pushed = false; closeSheet(true); } });
    // drag the handle/header (or the body when it is scrolled to the top) down to dismiss
    var y0 = 0, dy = 0, t0 = 0, dragging = false;
    function start(e) {
      if (!sheetOpen) return;
      var fromBody = sBody.contains(e.target);
      if (fromBody && sBody.scrollTop > 0) return;
      dragging = true; y0 = e.touches[0].clientY; dy = 0; t0 = performance.now();
    }
    function move(e) {
      if (!dragging) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) { panel.classList.remove('drag'); panel.style.transform = ''; return; }
      if (e.cancelable) e.preventDefault();
      panel.classList.add('drag'); panel.style.transform = 'translateY(' + (dy < 0 ? dy * 0.2 : dy) + 'px)';
    }
    function end() {
      if (!dragging) return; dragging = false;
      panel.classList.remove('drag');
      var v = dy / Math.max(1, performance.now() - t0);
      panel.style.transform = '';
      if (dy > 110 || v > 0.6) closeSheet();
    }
    panel.addEventListener('touchstart', start, { passive: true });
    panel.addEventListener('touchmove', move, { passive: false });
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
  }
  function openSheet(ch) {
    if (sheetOpen || !ch) return;
    sheetCh = ch;
    var i = chans.indexOf(ch), link = $('h3 a', ch), num = $('.metric-num', ch), unit = $('.metric-unit', ch);
    var name = link && link.firstChild ? link.firstChild.textContent.trim() : '';
    var desc = $('.ch-body > p:not(.m-sum)', ch), specs = $$('.ch-specs span', ch), chips = $('.chips', ch);
    var live = link && link.dataset.cursor === 'live';
    sheet.dataset.acc = (i === 1 || i === 3) ? '2' : '1';
    sTag.textContent = ($('.ch-tag', ch) || {}).textContent || '';
    var metricTxt = num ? (num.dataset.final || num.textContent) : '';
    if (num && num.dataset.count) { // show the final figure, never a mid-count value
      var dec = +(num.dataset.dec || 0), v = +num.dataset.count;
      metricTxt = (num.dataset.prefix || '') + (dec ? v.toFixed(dec) : v.toLocaleString()) + (num.dataset.suffix || '');
    }
    sBody.innerHTML =
      '<h3>' + name + '</h3>' +
      (desc ? '<p>' + desc.innerHTML + '</p>' : '') +
      (num ? '<div class="ms-metric"><span class="n">' + metricTxt + '</span><span class="u">' + (unit ? unit.textContent : '') + '</span></div>' : '') +
      (specs.length ? '<ul class="ms-specs">' + specs.map(function (s, k) { return '<li><span>' + pad2(k + 1) + '</span>' + s.textContent + '</li>'; }).join('') + '</ul>' : '') +
      (chips ? '<div class="chips">' + chips.innerHTML + '</div>' : '') +
      '<div class="ms-actions">' +
      (link ? '<a class="m-btn pri" href="' + link.getAttribute('href') + '" target="_blank" rel="noopener">' + (live ? 'Open the live app' : 'Read the code') + ' ↗</a>' : '') +
      ($('#consoleOpen', ch) ? '<button class="m-btn" type="button" data-console>Try the console ›_</button>' : '') +
      '</div>';
    var cbtn = $('[data-console]', sBody);
    if (cbtn) cbtn.addEventListener('click', function () { closeSheet(); setTimeout(function () { var o = document.getElementById('consoleOpen'); if (o) o.click(); }, 420); });
    sBody.scrollTop = 0;
    // lock the page behind without losing its scroll position
    scrollY0 = window.scrollY;
    document.body.classList.add('sheet-open');
    sheet.setAttribute('aria-hidden', 'false');
    sheetOpen = true;
    requestAnimationFrame(function () { sheet.classList.add('open'); });
    try { history.pushState({ psSheet: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
    buzz(8);
    if (G && !reduce) G.fromTo(sBody.children, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out', delay: 0.12 });
    setTimeout(function () { var x = $('.m-sheet__x', sheet); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function closeSheet(fromPop) {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove('open'); sheet.classList.add('closing');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    if (Math.abs(window.scrollY - scrollY0) > 2) window.scrollTo({ top: scrollY0, behavior: 'instant' });
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (e) {} }
    setTimeout(function () { sheet.classList.remove('closing'); }, 620);
    var b = sheetCh && $('.m-actions .m-btn', sheetCh); if (b) b.focus({ preventScroll: true });
  }

  /* ---------- menu: live trace + Bengaluru clock ---------- */
  var menuScope = null, menuRAF = null, menuNow = null;
  function buildMenu() {
    var ov = $('#menuOverlay'); if (!ov) return;
    var nav = $('nav', ov);
    // the empty top of the menu: what the set is tuned to right now
    var now = el('div', 'm-menu-now', '<small>● <b>Now tuned</b> · channel</small><strong>01</strong><span>HERO</span>');
    now.setAttribute('aria-hidden', 'true'); ov.insertBefore(now, ov.firstChild);
    menuNow = now;
    menuScope = el('canvas', 'm-menu-scope'); menuScope.setAttribute('aria-hidden', 'true');
    ov.insertBefore(menuScope, $('.menu-foot', ov));
    var foot = $('.menu-foot', ov);
    if (foot) {
      var left = el('div', null, foot.innerHTML);
      var clk = el('div', 'm-clock', 'BLR <b>--:--:--</b> IST<br>ON AIR');
      foot.innerHTML = ''; foot.appendChild(left); foot.appendChild(clk);
      var b = $('b', clk), fmt = null;
      try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); } catch (e) {}
      if (fmt) { var tk = function () { b.textContent = fmt.format(new Date()); }; tk(); setInterval(tk, 1000); }
    }
    // the menu trace runs only while the menu is open
    var mo = new MutationObserver(function () {
      var open = document.body.classList.contains('menu-open');
      if (open && menuNow && readNum) {
        var n = readNum.textContent.replace(/[^0-9]/g, '');
        $('strong', menuNow).textContent = n || '01';
        $('span', menuNow).textContent = (readNum.textContent.charAt(0) === 'P' ? 'Project · ' : '') + readTxt.textContent;
      }
      if (open && !menuRAF && !reduce) { buzz(6); drawMenuScope(); }
      if (!open && menuRAF) { cancelAnimationFrame(menuRAF); menuRAF = null; }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // swipe down anywhere on the open menu to close it
    var y0 = null;
    ov.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    ov.addEventListener('touchend', function (e) {
      if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null;
      if (dy > 90) { var mb = $('#menuBtn'); if (mb && document.body.classList.contains('menu-open')) mb.click(); }
    });
    if (nav) nav.setAttribute('aria-label', 'Sections');
  }
  function drawMenuScope() {
    var c = menuScope, g = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), t0 = performance.now();
    function frame(ts) {
      var w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      var t = (ts - t0) / 1000;
      [['52,226,214', 0.45, 1.3, 0.6], ['255,166,61', 0.95, 0, 1]].forEach(function (tr) {
        g.beginPath();
        for (var x = 0; x <= w; x += 3) {
          var u = x / w, env = Math.sin(u * Math.PI);
          var y = h / 2 + env * h * 0.34 * tr[3] * (Math.sin(u * 14 + t * 3 + tr[2]) * 0.7 + Math.sin(u * 31 - t * 5) * 0.3);
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.strokeStyle = 'rgba(' + tr[0] + ',' + tr[1] + ')'; g.lineWidth = 1.4; g.shadowColor = 'rgba(' + tr[0] + ',.6)'; g.shadowBlur = 8; g.stroke();
      });
      g.shadowBlur = 0;
      menuRAF = requestAnimationFrame(frame);
    }
    menuRAF = requestAnimationFrame(frame);
  }

  /* ---------- touch: pulse ring + haptic tick on anything tappable ---------- */
  function buildTouch() {
    var SEL = 'a,button,.chip,.scol li,.ch-media,.metric';
    document.addEventListener('pointerdown', function (e) {
      touched = true;
      if (e.pointerType === 'mouse' || reduce) return;
      var t = e.target.closest && e.target.closest(SEL); if (!t) return;
      var p = el('span', 'pulse'); p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px';
      document.body.appendChild(p); setTimeout(function () { p.remove(); }, 700);
    }, { passive: true });
  }

  /* ---------- stack: tap a skill to see the project that proves it ---------- */
  function buildStackTips() {
    var tip = el('div', 'm-tip'); document.body.appendChild(tip);
    var cur = null, tT = null;
    function hide() { tip.classList.remove('on'); if (cur) cur.classList.remove('tip'); cur = null; }
    $$('.scol li').forEach(function (li) {
      li.addEventListener('click', function () {
        var x = li.getAttribute('data-x'); if (!x) return;
        if (cur === li) { hide(); return; }
        hide(); cur = li; li.classList.add('tip');
        var r = li.getBoundingClientRect();
        tip.textContent = '→ ' + x;
        tip.style.left = clamp(r.left + r.width / 2, 90, window.innerWidth - 90) + 'px'; tip.style.top = r.top + 'px';
        requestAnimationFrame(function () { tip.classList.add('on'); });
        buzz(5); clearTimeout(tT); tT = setTimeout(hide, 2200);
      });
    });
    window.addEventListener('scroll', function () { if (cur) hide(); }, { passive: true });
  }

  /* ---------- log: signal line + nodes ---------- */
  var logLine = null;
  function buildLogLine() {
    var logs = $('#log .logs'); if (!logs) return;
    logLine = el('span', 'm-line'); logLine.setAttribute('aria-hidden', 'true');
    logs.insertBefore(logLine, logs.firstChild);
    if (reduce) { logLine.style.transform = 'scaleY(1)'; $$('.logrow', logs).forEach(function (r) { r.classList.add('lit'); }); }
  }

  /* ---------- contact: VHS rewind to the top ---------- */
  function buildRewind() {
    var wrap = $('#contact .wrap'); if (!wrap) return;
    var b = el('button', 'm-btn m-rewind', '<span class="ar">◀◀</span> Rewind to the top');
    b.type = 'button'; wrap.appendChild(b);
    var vhs = el('div', 'm-vhs', '<span>◀◀ REWIND</span><span class="tc">00:00:00</span>');
    vhs.setAttribute('aria-hidden', 'true'); document.body.appendChild(vhs);
    b.addEventListener('click', function () {
      buzz([6, 40, 6]);
      if (reduce) { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
      var tc = $('.tc', vhs), start = window.scrollY, t0 = performance.now(), dur = Math.min(1600, 500 + start / 8);
      vhs.classList.add('on');
      (function step(ts) {
        var p = Math.min(1, (ts - t0) / dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo({ top: start * (1 - e), behavior: 'instant' }); // the page is smooth-scroll by default; each frame must land exactly
        var s = Math.round((1 - p) * start / 40);
        tc.textContent = '00:' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60);
        if (p < 1) requestAnimationFrame(step); else setTimeout(function () { vhs.classList.remove('on'); }, 160);
      })(t0);
    });
  }

  /* ---------- hero: live scope readout ---------- */
  var scopeRead = null;
  function buildScopeReadout() {
    var hero = $('.hero'); if (!hero) return;
    scopeRead = el('div', 'm-scope-read', '<span>CH1 <b>AMBER</b> · CH2 <em>TEAL</em></span><span class="v">SIG 00.0 HZ</span>');
    scopeRead.setAttribute('aria-hidden', 'true');
    hero.appendChild(scopeRead);
  }

  /* ================= RUN (choreography) ================= */
  function run(api) {
    API = api; G = api.gsap; ST = api.ScrollTrigger;
    if (!G || !ST || reduce) { staticDeck(); return; }
    deck();
    hero();
    reveals();
    about();
    oss();
    method();
    stack();
    log();
    contact();
    tilt();
    ST.refresh();
  }

  // play once going down; if first met from below (or already scrolled past) show it complete
  function onReveal(trigger, build, start) {
    if (!trigger) return;
    var tl = build(); if (!tl) return;
    tl.pause(0);
    var done = false;
    function play() { if (done) return; done = true; tl.play(); }
    function finish() { done = true; tl.progress(1).pause(); }
    if (trigger.getBoundingClientRect().bottom < 0) { finish(); return; }
    ST.create({ trigger: trigger, start: start || 'top 86%', onEnter: play, onEnterBack: function () { if (!done || tl.progress() < 1) finish(); } });
  }

  function staticDeck() { // no GSAP / reduced motion: still play the right video and keep the readout honest
    watchActiveCard(function (i) { setActive(i, true); });
  }

  /* ---------- deck choreography ---------- */
  function deckTopFor(i) {
    var cs = getComputedStyle(document.body), hdr = parseFloat(cs.getPropertyValue('--hdr')) || 58;
    return hdr + 12 + i * 9;
  }
  function watchActiveCard(cb) {
    // active = the last card whose marker has crossed its own sticky line
    var ticking = false;
    function check() {
      ticking = false;
      var a = -1;
      for (var i = 0; i < chans.length; i++) { if (chans[i]._mark.getBoundingClientRect().top <= deckTopFor(i) + 2) a = i; }
      var w = document.getElementById('work'), r = w.getBoundingClientRect();
      var inView = r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.3;
      if (a < 0 && inView) a = 0;
      deckOn = inView;
      cb(inView ? a : -1);
      if (inView) syncMedia();
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    window.addEventListener('resize', check);
    check();
  }
  function setActive(i, quiet) {
    if (i === activeCard) return;
    var prev = activeCard; activeCard = i;
    syncMedia();
    if (i < 0) return;
    if (currentSec === 'work') readCard(i);
    if (quiet || prev === -1 && i === 0 && !G) return;
    var ch = chans[i];
    ch.classList.remove('tuned'); void ch.offsetWidth; ch.classList.add('tuned');
    var sw = $('.sweep', ch);
    if (G && sw) G.fromTo(sw, { yPercent: -120, opacity: 0.9 }, { yPercent: 260, opacity: 0, duration: 0.9, ease: 'power2.inOut' });
    var num = $('.metric-num', ch);
    if (num && API && API.animateCount && prev < i) API.animateCount(num); // counting forward; the shared manager settles it on the way up
    buzz(7);
    if (API && API.sfx) API.sfx(760, 0.06);
  }
  // footage runs on the active card and on the next one as soon as it peeks in (so it never rises blank);
  // cards fully covered behind the stack are paused
  function syncMedia() {
    chans.forEach(function (ch, k) {
      var v = $('video', ch), gc = genOf(ch);
      var on = activeCard >= 0 && (k === activeCard || (k === activeCard + 1 && ch._mark.getBoundingClientRect().top < window.innerHeight));
      if (v) {
        if (on) {
          // phones get the light 720p cut (blank stretches removed); desktop keeps the originals
          if (v.dataset.src && !v.src && !(navigator.connection && navigator.connection.saveData)) v.src = v.dataset.srcM || v.dataset.src;
          if (!reduce) { v.muted = true; v.loop = true; v.playsInline = true; if (v.paused) { var pr = v.play && v.play(); if (pr && pr.catch) pr.catch(function () {}); } } else v.controls = true;
        } else if (!v.paused) { try { v.pause(); } catch (e) {} }
      }
      if (gc) { if (on) gc.start(); else gc.stop(); }
    });
  }
  function genOf(ch) { var c = $('canvas[data-gen]', ch); return c && window.PSFX ? window.PSFX.gen(c) : null; }

  function deck() {
    watchActiveCard(setActive);
    chans.forEach(function (ch, i) {
      var media = $('.ch-media', ch), src = media && $('video, .ch-gen', media), dim = $('.m-dim', ch);
      // parallax: the footage drifts inside its window as the card rises into place
      if (src) G.fromTo(src, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: ch._mark, start: 'top bottom', end: function () { return 'top ' + deckTopFor(i) + 'px'; }, scrub: true } });
      // the card's content arrives once
      onReveal(ch._mark, function () {
        var t = G.timeline();
        t.fromTo($$('.ch-tag, h3, .m-sum', ch), { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, 0);
        t.fromTo($$('.ch-metric, .chips, .m-actions', ch), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.06, ease: 'power3.out' }, 0.18);
        if (media) t.fromTo(media, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'power3.inOut' }, 0);
        return t;
      }, 'top 92%');
      // covered by the next card: recede, tilt back and dim (reversible: it is geometry, not content)
      var next = chans[i + 1];
      if (next) {
        var tl = G.timeline({ scrollTrigger: { trigger: next._mark, start: 'top bottom', end: function () { return 'top ' + deckTopFor(i + 1) + 'px'; }, scrub: true } });
        tl.fromTo(ch, { scale: 1, rotationX: 0, transformPerspective: 1100 }, { scale: 0.9, rotationX: 9, ease: 'none' }, 0);
        if (dim) tl.fromTo(dim, { opacity: 0 }, { opacity: 0.62, ease: 'none' }, 0);
      }
    });
  }

  /* ---------- hero ---------- */
  function hero() {
    var inner = $('.hero-inner'), lines = $$('.hero h1 .ln');
    if (lines.length === 2) {
      G.to(lines[0], { xPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      G.to(lines[1], { xPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
    if (inner) G.to(inner, { autoAlpha: 0, yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });
    // touch the hero to excite the trace; the readout reports what the scope is doing
    var hero = $('.hero'), lastY = null, lastT = 0, level = 0;
    hero.addEventListener('touchstart', function (e) { lastY = e.touches[0].clientY; lastT = performance.now(); if (API.kick) API.kick(2600); }, { passive: true });
    hero.addEventListener('touchmove', function (e) {
      var y = e.touches[0].clientY, t = performance.now();
      if (lastY != null && API.kick) API.kick(Math.min(6000, Math.abs(y - lastY) / Math.max(1, t - lastT) * 2600));
      lastY = y; lastT = t;
    }, { passive: true });
    var v = scopeRead && $('.v', scopeRead), lastS = window.scrollY, heroOn = true;
    new IntersectionObserver(function (es) { heroOn = es[0].isIntersecting; }).observe(hero);
    (function tick() {
      if (heroOn && v) {
        var s = window.scrollY, d = Math.abs(s - lastS); lastS = s;
        level += (Math.min(1, d / 40) - level) * 0.1;
        v.textContent = 'SIG ' + (48 + level * 32 + Math.sin(performance.now() / 700) * 1.6).toFixed(1) + ' HZ';
      }
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- section headers + ghosts ---------- */
  function reveals() {
    $$('[data-mh]').forEach(function (mh) {
      var rule = $('[data-draw]', mh), lab = $('.label', mh), idx = $('.idx', mh);
      onReveal(mh, function () {
        var t = G.timeline();
        if (rule) t.fromTo(rule, { scaleX: 0, transformOrigin: 'left' }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, 0);
        t.fromTo([lab, idx], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 0.15);
        t.add(function () { if (lab) scramble(lab, lab.textContent, 420); if (idx) scramble(idx, idx.textContent, 520); }, 0.15);
        return t;
      });
    });
    $$('.ghost').forEach(function (g) {
      G.fromTo(g, { xPercent: 12 }, { xPercent: -18, ease: 'none', scrollTrigger: { trigger: g.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    var now = $('#now');
    if (now) onReveal(now, function () {
      return G.timeline().fromTo($$('.now-l, .now-r', now), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, stagger: 0.14, ease: 'power3.inOut' });
    }, 'top 80%');
  }

  /* ---------- about: the statement lights word by word, and never un-lights ---------- */
  function about() {
    var p = $('.about-copy p'); if (!p) return;
    var words = [];
    $$('.clip > i', p).forEach(function (line) {
      var txt = line.textContent; line.textContent = '';
      txt.split(/(\s+)/).forEach(function (w) {
        if (!w.trim()) { line.appendChild(document.createTextNode(w)); return; }
        var s = el('span', 'w'); s.textContent = w; line.appendChild(s); words.push(s);
      });
    });
    var hot = ['abstract', 'prove', 'works.'];
    var lit = 0;
    function paint(n) {
      if (n <= lit) return; // latch: scrolling up never dims what was read
      for (var i = lit; i < n; i++) { words[i].classList.add('on'); if (hot.indexOf(words[i].textContent) >= 0) words[i].classList.add('hot'); }
      lit = n;
    }
    if (p.getBoundingClientRect().bottom < window.innerHeight * 0.5) paint(words.length);
    ST.create({ trigger: p, start: 'top 82%', end: 'bottom 45%', onUpdate: function (s) { paint(Math.round(s.progress * words.length)); }, onLeave: function () { paint(words.length); }, onEnterBack: function () { paint(words.length); } });
    var body = $('.about-body');
    if (body) onReveal(body, function () { return G.timeline().fromTo(body, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' }); });
    var mets = $$('.metric');
    if (mets.length) onReveal($('.metrics'), function () {
      return G.timeline().fromTo(mets, { y: 28, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out' });
    });
  }

  /* ---------- open source: graph draws, stamp slams (with a thud) ---------- */
  function oss() {
    var lede = $('[data-o-rise]');
    if (lede) onReveal(lede, function () { return G.timeline().fromTo(lede, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' }); });
    $$('[data-o-row]').forEach(function (row) {
      onReveal(row, function () {
        var t = G.timeline();
        t.fromTo($$('.pr-meta, h3, p', row), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, 0);
        if (API.gitGraphIn) { var gtl = API.gitGraphIn(row); gtl.pause(0); t.add(gtl.play(), 0.05); }
        t.add(function () { buzz(12); G.fromTo(row, { x: -3 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.3)' }); }, 1.05);
        return t;
      }, 'top 82%');
    });
  }

  /* ---------- method: cards flip up; the searchlight follows the thumb (and drifts when idle) ---------- */
  function method() {
    var cards = $$('.principles .pr');
    cards.forEach(function (c) {
      onReveal(c, function () { return G.timeline().fromTo(c, { rotationX: -55, y: 50, autoAlpha: 0, transformOrigin: '50% 0' }, { rotationX: 0, y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out' }); }, 'top 90%');
    });
    var wrap = $('.principles'); if (!wrap) return;
    var tx = null, ty = null, last = 0, on = false;
    function place(x, y) { cards.forEach(function (c) { var r = c.getBoundingClientRect(); c.style.setProperty('--px', (x - r.left) + 'px'); c.style.setProperty('--py', (y - r.top) + 'px'); }); }
    wrap.addEventListener('touchmove', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; last = performance.now(); place(tx, ty); }, { passive: true });
    wrap.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; last = performance.now(); place(tx, ty); }, { passive: true });
    new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (on) drift(); }).observe(wrap);
    function drift() {
      if (!on) return;
      if (performance.now() - last > 1600) { // idle: the beam sweeps across the cards on its own
        var t = performance.now() / 1000, r = wrap.getBoundingClientRect();
        place(r.left + r.width * (0.5 + 0.42 * Math.sin(t * 0.9)), r.top + r.height * (0.5 + 0.45 * Math.sin(t * 0.55)));
      }
      requestAnimationFrame(drift);
    }
  }

  /* ---------- stack: rows slide, pills pop ---------- */
  function stack() {
    $$('.scol').forEach(function (col, k) {
      onReveal(col, function () {
        var t = G.timeline();
        t.fromTo($$('h4, .sub', col), { x: k % 2 ? 24 : -24, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, 0);
        t.fromTo($$('li', col), { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.035, ease: 'back.out(2)' }, 0.1);
        return t;
      }, 'top 88%');
    });
  }

  /* ---------- log: the signal line runs down and lights each entry (latched) ---------- */
  function log() {
    var logs = $('#log .logs'); if (!logs || !logLine) return;
    var rows = $$('.logrow', logs), best = 0;
    function paint(p) {
      if (p <= best) return; best = p;
      logLine.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      var lr = logs.getBoundingClientRect(), tip = lr.top + 8 + (lr.height - 16) * p;
      rows.forEach(function (r) { if (!r.classList.contains('lit') && r.getBoundingClientRect().top + 20 <= tip) { r.classList.add('lit'); buzz(4); } });
    }
    if (logs.getBoundingClientRect().bottom < window.innerHeight * 0.6) paint(1);
    ST.create({ trigger: logs, start: 'top 70%', end: 'bottom 60%', onUpdate: function (s) { paint(s.progress); }, onLeave: function () { paint(1); }, onEnterBack: function () { paint(1); } });
    rows.forEach(function (r) {
      onReveal(r, function () { return G.timeline().fromTo($$('.yr, .ttl, .meta', r), { x: -16, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' }); }, 'top 92%');
    });
  }

  /* ---------- contact ---------- */
  function contact() {
    var c = $('#contact'); if (!c) return;
    var h2 = $('h2', c);
    if (h2) onReveal(h2, function () {
      var chars = splitWords(h2);
      var t = G.timeline();
      if (chars.length) t.fromTo(chars, { yPercent: 120, rotate: G.utils.wrap([-8, 8]), autoAlpha: 0 }, { yPercent: 0, rotate: 0, autoAlpha: 1, duration: 0.8, stagger: { each: 0.018, from: 'random' }, ease: 'power4.out' });
      return t;
    }, 'top 85%');
    var chs = $$('.channel', c);
    if (chs.length) onReveal($('.channels', c), function () { return G.timeline().fromTo(chs, { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.7, stagger: 0.09, ease: 'power3.out' }); });
    var so = $('#signoff');
    // the flatline is a one-shot draw that always ends flat, so it simply plays whenever it is first reached
    if (so && API.playFlatline) {
      if (so.getBoundingClientRect().top < window.innerHeight) API.playFlatline();
      else ST.create({ trigger: so, start: 'top 95%', once: true, onEnter: API.playFlatline, onEnterBack: API.playFlatline });
    }
  }

  // split text into chars grouped by word, so lines only ever break between words (skips the rotator)
  function splitWords(root) {
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (!part.trim()) { frag.appendChild(document.createTextNode(' ')); return; }
            var wd = el('span', 'wd');
            part.split('').forEach(function (c) { var s = el('span', 'cc'); s.textContent = c; wd.appendChild(s); out.push(s); });
            frag.appendChild(wd);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !(n.classList && n.classList.contains('rot-mask'))) walk(n);
      });
    })(root);
    return out;
  }

  /* ---------- tilt: the phone's own motion moves the channel numerals (Android; iOS needs a prompt we skip) ---------- */
  function tilt() {
    if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission === 'function') return;
    var root = document.documentElement, qx = 0, qy = 0, raf = null;
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma == null) return;
      qx = clamp(e.gamma / 30, -1, 1); qy = clamp((e.beta - 45) / 30, -1, 1);
      if (!raf) raf = requestAnimationFrame(function () { raf = null; root.style.setProperty('--tx', qx.toFixed(3)); root.style.setProperty('--ty', qy.toFixed(3)); });
    }, { passive: true });
  }

  window.PSMobile = { run: run };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
