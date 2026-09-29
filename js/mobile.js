/* ============================================================
   MOBILE.JS — Production mobile experience
   Channel Dial, Ambient Life, Vertical Projects, Glitch Transitions
   This file ONLY runs on mobile. Desktop is untouched.
   ============================================================ */

(function() {
  'use strict';

  // Gate: only run on mobile
  var MOBILE_QUERY = '(max-width: 767px) and (hover: none), (max-width: 767px) and (pointer: coarse)';
  var isMobile = window.matchMedia(MOBILE_QUERY).matches && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  if (!isMobile) {
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var AMBER = '255,166,61';
  var TEAL = '52,226,214';

  // Channels configuration
  var CHANNELS = [
    { id: 'top', label: 'HERO', name: 'Hero' },
    { id: 'now', label: 'NOW', name: 'Now' },
    { id: 'about', label: 'PROFILE', name: 'Profile' },
    { id: 'work', label: 'CHANNELS', name: 'Projects' },
    { id: 'oss', label: 'UPSTREAM', name: 'Open source' },
    { id: 'method', label: 'METHOD', name: 'Method' },
    { id: 'stack', label: 'STACK', name: 'Stack' },
    { id: 'log', label: 'LOG', name: 'Log' },
    { id: 'contact', label: 'CONTACT', name: 'Contact' }
  ];

  // State
  var currentChannel = 0;
  var scrollVelocity = 0;
  var lastScrollY = 0;
  var lastScrollTime = 0;
  var isScrolling = false;
  var scrollTimeout = null;
  var animationsPaused = false;
  var ambientRAF = null;

  // DOM elements (populated on init)
  var dialEl = null;
  var dialRing = null;
  var dialSignal = null;
  var dialTicks = null;
  var dialCh = null;
  var dialLabel = null;
  var glitchEl = null;
  var scanlinesEl = null;
  var grainEl = null;
  var hudScene = null;
  var hudTc = null;
  var hudIdx = null;

  /* ============================================================
     UTILITIES
     ============================================================ */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function vibrate(pattern) {
    if (reduceMotion) return;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Vibration not supported or blocked
      }
    }
  }

  function scrambleTo(el, text, duration) {
    if (reduceMotion || !el) {
      if (el) el.textContent = text;
      return;
    }
    var GLYPHS = '!<>-_\\/[]{}=+*^?#0123456789ABCDEF';
    var frame = 0;
    var total = Math.max(1, Math.round((duration || 400) / 16.7));
    var len = text.length;

    function tick() {
      var reveal = Math.floor(len * (frame / total));
      var out = '';
      for (var i = 0; i < len; i++) {
        out += i < reveal ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (frame++ < total) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = text;
      }
    }
    tick();
  }

  /* ============================================================
     CHANNEL DIAL
     ============================================================ */
  function createChannelDial() {
    // Create dial container
    dialEl = document.createElement('div');
    dialEl.className = 'channel-dial';
    dialEl.setAttribute('role', 'navigation');
    dialEl.setAttribute('aria-label', 'Channel navigation');

    // Ring (with signal meter integrated)
    dialRing = document.createElement('div');
    dialRing.className = 'channel-dial__ring';
    if (!reduceMotion) {
      dialRing.classList.add('is-idle');
    }

    // Signal strength indicator (overlaid on ring)
    dialSignal = document.createElement('div');
    dialSignal.className = 'channel-dial__signal';

    // Ticks container
    dialTicks = document.createElement('div');
    dialTicks.className = 'channel-dial__ticks';

    // Create tick buttons for each channel
    CHANNELS.forEach(function(channel, index) {
      var tick = document.createElement('div');
      tick.className = 'channel-dial__tick';
      // Position tick around the circle
      var angle = (index / CHANNELS.length) * 360 - 90; // Start from top
      tick.style.transform = 'rotate(' + angle + 'deg)';

      var btn = document.createElement('button');
      btn.className = 'channel-dial__tick-btn';
      btn.setAttribute('aria-label', 'CH.0' + (index + 1) + ' ' + channel.name);
      btn.setAttribute('data-channel', index);
      btn.setAttribute('tabindex', '0');

      var dot = document.createElement('span');
      dot.className = 'channel-dial__tick-dot';

      btn.appendChild(dot);
      tick.appendChild(btn);
      dialTicks.appendChild(tick);

      // Click handler
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        jumpToChannel(index);
      });
    });

    // Center display
    var center = document.createElement('div');
    center.className = 'channel-dial__center';

    dialCh = document.createElement('span');
    dialCh.className = 'channel-dial__ch';
    dialCh.textContent = 'CH.01';

    dialLabel = document.createElement('span');
    dialLabel.className = 'channel-dial__label';
    dialLabel.textContent = 'HERO';

    center.appendChild(dialCh);
    center.appendChild(dialLabel);

    // Assemble dial
    dialEl.appendChild(dialRing);
    dialEl.appendChild(dialSignal);
    dialEl.appendChild(dialTicks);
    dialEl.appendChild(center);

    document.body.appendChild(dialEl);

    // Setup vertical drag
    setupDialDrag();
  }

  function setupDialDrag() {
    var startY = 0;
    var dragThreshold = 30;
    var isDragging = false;

    dialEl.addEventListener('touchstart', function(e) {
      startY = e.touches[0].clientY;
      isDragging = false;
    }, { passive: true });

    dialEl.addEventListener('touchmove', function(e) {
      var deltaY = e.touches[0].clientY - startY;
      
      if (Math.abs(deltaY) > dragThreshold && !isDragging) {
        isDragging = true;
        if (deltaY < 0) {
          // Drag up = next channel
          jumpToChannel(Math.min(currentChannel + 1, CHANNELS.length - 1));
        } else {
          // Drag down = previous channel
          jumpToChannel(Math.max(currentChannel - 1, 0));
        }
        startY = e.touches[0].clientY;
      }
    }, { passive: true });
  }

  function jumpToChannel(index) {
    if (index === currentChannel) return;
    
    var channel = CHANNELS[index];
    var target = document.getElementById(channel.id);
    
    if (!target) return;

    // Haptic feedback
    vibrate(15);

    // Trigger glitch
    triggerGlitch();

    // Smooth scroll
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });

    // Update state
    setActiveChannel(index);
  }

  function setActiveChannel(index) {
    if (index === currentChannel) return;
    
    currentChannel = index;
    var channel = CHANNELS[index];

    // Update dial display
    if (dialCh) {
      scrambleTo(dialCh, 'CH.0' + (index + 1), 200);
    }
    if (dialLabel) {
      scrambleTo(dialLabel, channel.label, 250);
    }

    // Update tick active states
    var ticks = dialTicks.querySelectorAll('.channel-dial__tick-btn');
    ticks.forEach(function(tick, i) {
      tick.classList.toggle('is-active', i === index);
    });

    // Update HUD
    if (hudScene) {
      scrambleTo(hudScene, channel.label, 200);
    }
    if (hudIdx) {
      hudIdx.textContent = 'CH ' + String(index + 1).padStart(2, '0') + ' / ' + String(CHANNELS.length).padStart(2, '0');
    }

    // Rotate dial ticks to current channel
    if (dialTicks && !reduceMotion) {
      var rotation = -(index / CHANNELS.length) * 360;
      dialTicks.style.transform = 'rotate(' + rotation + 'deg)';
      dialTicks.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1)';
    }
  }

  function updateDialSignal(velocity) {
    if (!dialSignal || reduceMotion) return;

    var normalizedVelocity = clamp(velocity / 2000, 0, 1);
    
    if (normalizedVelocity > 0.1) {
      dialSignal.classList.add('is-active');
      dialRing.classList.remove('is-idle');
      
      // Scale ring based on velocity
      var scale = 1 + normalizedVelocity * 0.08;
      dialRing.style.transform = 'scale(' + scale + ')';
    } else {
      dialRing.style.transform = 'scale(1)';
      if (!isScrolling) {
        dialRing.classList.add('is-idle');
      }
    }
  }

  /* ============================================================
     GLITCH EFFECT
     ============================================================ */
  function createGlitchOverlay() {
    glitchEl = document.createElement('div');
    glitchEl.className = 'mobile-glitch';
    glitchEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glitchEl);
  }

  function triggerGlitch() {
    if (!glitchEl || reduceMotion) return;
    
    glitchEl.classList.remove('is-active');
    // Force reflow
    void glitchEl.offsetWidth;
    glitchEl.classList.add('is-active');

    setTimeout(function() {
      glitchEl.classList.remove('is-active');
    }, 150);
  }

  /* ============================================================
     AMBIENT LIFE — Scanlines, Grain
     ============================================================ */
  function createAmbientOverlays() {
    if (reduceMotion) return;

    // Scanlines
    scanlinesEl = document.createElement('div');
    scanlinesEl.className = 'mobile-scanlines';
    scanlinesEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scanlinesEl);

    // Grain
    grainEl = document.createElement('div');
    grainEl.className = 'mobile-grain';
    grainEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(grainEl);
  }

  /* ============================================================
     REC TIMECODE
     ============================================================ */
  function updateTimecode() {
    if (!hudTc) return;

    // Calculate progress through current section
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = docHeight > 0 ? scrollTop / docHeight : 0;
    
    var totalSeconds = Math.floor(progress * 60);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    
    hudTc.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  /* ============================================================
     SCROLL TRACKING
     ============================================================ */
  function onScroll() {
    var now = performance.now();
    var scrollY = window.scrollY;
    var deltaY = Math.abs(scrollY - lastScrollY);
    var deltaTime = now - lastScrollTime;

    if (deltaTime > 0) {
      scrollVelocity = (deltaY / deltaTime) * 1000;
    }

    lastScrollY = scrollY;
    lastScrollTime = now;
    isScrolling = true;

    // Update dial signal based on velocity
    updateDialSignal(scrollVelocity);

    // Update timecode
    updateTimecode();

    // Debounce scroll end
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function() {
      isScrolling = false;
      scrollVelocity = 0;
      updateDialSignal(0);
      if (dialRing && !reduceMotion) {
        dialRing.classList.add('is-idle');
      }
    }, 150);

    // Detect current channel from scroll position
    detectCurrentChannel();
  }

  function detectCurrentChannel() {
    var viewportMiddle = window.innerHeight / 2;
    
    for (var i = CHANNELS.length - 1; i >= 0; i--) {
      var el = document.getElementById(CHANNELS[i].id);
      if (!el) continue;
      
      var rect = el.getBoundingClientRect();
      if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
        if (i !== currentChannel) {
          setActiveChannel(i);
        }
        break;
      }
    }
  }

  /* ============================================================
     PROJECT CARDS — Vertical scroll with entry animations
     ============================================================ */
  function initProjectCards() {
    var cards = document.querySelectorAll('.ch');
    if (!cards.length) return;

    var hasGsap = typeof window.gsap !== 'undefined';

    // IntersectionObserver for entry animations
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var card = entry.target;
        var video = card.querySelector('video');
        var sweep = card.querySelector('.sweep');

        if (entry.isIntersecting) {
          // Play video
          if (video) {
            loadVideo(video);
            if (!reduceMotion) {
              video.muted = true;
              video.loop = true;
              video.playsInline = true;
              video.play().catch(function() {});
            }
          }

          // Entry animation
          if (!card.dataset.animated && !reduceMotion && hasGsap) {
            card.dataset.animated = '1';
            
            // Sweep animation
            if (sweep) {
              gsap.fromTo(sweep, 
                { yPercent: -120, opacity: 0.8 },
                { yPercent: 260, opacity: 0, duration: 0.9, ease: 'power2.inOut' }
              );
            }

            // Media zoom
            var media = card.querySelector('.ch-media');
            if (media) {
              gsap.fromTo(media,
                { scale: 1.08 },
                { scale: 1, duration: 0.8, ease: 'power2.out' }
              );
            }

            // Content reveal
            var rv = card.querySelectorAll('.rv');
            if (rv.length) {
              gsap.fromTo(rv,
                { y: 20, autoAlpha: 0 },
                { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out' }
              );
            }
          }

          // Counters are owned by the shared count manager in index.html
        } else {
          // Pause video when out of view
          if (video) {
            try { video.pause(); } catch (e) {}
          }
        }
      });
    }, {
      threshold: 0.3,
      rootMargin: '0px 0px -10% 0px'
    });

    cards.forEach(function(card) {
      observer.observe(card);
    });
  }

  function loadVideo(video) {
    if (!video) return;
    if (navigator.connection && navigator.connection.saveData) return;
    if (video.dataset.src && !video.src) {
      video.src = video.dataset.src;
    }
  }

  /* ============================================================
     VISIBILITY HANDLING — Pause animations when hidden
     ============================================================ */
  function onVisibilityChange() {
    if (document.hidden) {
      pauseAmbientAnimations();
    } else {
      resumeAmbientAnimations();
    }
  }

  function pauseAmbientAnimations() {
    animationsPaused = true;
    
    if (scanlinesEl) {
      scanlinesEl.style.animationPlayState = 'paused';
    }
    if (grainEl) {
      grainEl.style.animationPlayState = 'paused';
    }
    if (dialRing) {
      dialRing.style.animationPlayState = 'paused';
    }
  }

  function resumeAmbientAnimations() {
    animationsPaused = false;
    
    if (scanlinesEl) {
      scanlinesEl.style.animationPlayState = 'running';
    }
    if (grainEl) {
      grainEl.style.animationPlayState = 'running';
    }
    if (dialRing) {
      dialRing.style.animationPlayState = 'running';
    }
  }

  /* ============================================================
     SECTION REVEAL ANIMATIONS
     ============================================================ */
  function initSectionReveals() {
    var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    
    if (!hasGsap || reduceMotion) {
      // Static fallback - show everything
      document.querySelectorAll('.clip > i, .rv, [data-rise]').forEach(function(el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;

    // About section
    var about = document.getElementById('about');
    if (about) {
      var aboutTl = gsap.timeline({
        scrollTrigger: {
          trigger: about,
          start: 'top 80%',
          end: 'top 30%',
          scrub: 0.8
        }
      });

      var clipLines = about.querySelectorAll('.about-copy .clip > i');
      if (clipLines.length) {
        aboutTl.fromTo(clipLines, 
          { yPercent: 100 }, 
          { yPercent: 0, duration: 0.5, stagger: 0.1 }, 
          0
        );
      }

      var metrics = about.querySelectorAll('.metric');
      if (metrics.length) {
        aboutTl.fromTo(metrics,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.08 },
          0.2
        );
      }

    }

    // Method section
    var method = document.getElementById('method');
    if (method) {
      var methodTl = gsap.timeline({
        scrollTrigger: {
          trigger: method,
          start: 'top 80%',
          end: 'top 40%',
          scrub: 0.8
        }
      });

      var principles = method.querySelectorAll('.pr');
      if (principles.length) {
        methodTl.fromTo(principles,
          { y: 40, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.12 },
          0
        );
      }
    }

    // Stack section
    var stack = document.getElementById('stack');
    if (stack) {
      var stackTl = gsap.timeline({
        scrollTrigger: {
          trigger: stack,
          start: 'top 80%',
          end: 'top 40%',
          scrub: 0.8
        }
      });

      var scols = stack.querySelectorAll('.scol');
      scols.forEach(function(col, i) {
        stackTl.fromTo(col,
          { x: i % 2 ? 30 : -30, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.4 },
          0.05 + i * 0.08
        );
      });
    }

    // Log section
    var log = document.getElementById('log');
    if (log) {
      var logTl = gsap.timeline({
        scrollTrigger: {
          trigger: log,
          start: 'top 80%',
          end: 'top 40%',
          scrub: 0.8
        }
      });

      var logrows = log.querySelectorAll('.logrow');
      if (logrows.length) {
        logTl.fromTo(logrows,
          { x: -30, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.4, stagger: 0.1 },
          0
        );
      }
    }

    // Contact section
    var contact = document.getElementById('contact');
    if (contact) {
      var contactTl = gsap.timeline({
        scrollTrigger: {
          trigger: contact,
          start: 'top 80%',
          end: 'top 50%',
          scrub: 0.8
        }
      });

      var contactClips = contact.querySelectorAll('h2 .clip > i');
      if (contactClips.length) {
        contactTl.fromTo(contactClips,
          { yPercent: 100 },
          { yPercent: 0, duration: 0.5, stagger: 0.1 },
          0
        );
      }

      var channels = contact.querySelectorAll('.channel');
      if (channels.length) {
        contactTl.fromTo(channels,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.08 },
          0.2
        );
      }
    }
  }

  /* ============================================================
     HERO ANIMATIONS
     ============================================================ */
  function initHeroMobile() {
    var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    
    if (!hasGsap || reduceMotion) return;

    var gsap = window.gsap;
    var heroInner = document.querySelector('.hero-inner');
    var heroMeta = document.querySelector('[data-hero-meta]');

    if (heroInner) {
      gsap.to(heroInner, {
        yPercent: -8,
        scale: 0.95,
        autoAlpha: 0,
        filter: 'blur(4px)',
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6
        }
      });
    }

    if (heroMeta) {
      gsap.to(heroMeta, {
        autoAlpha: 0,
        y: -15,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: '35% top',
          scrub: 0.6
        }
      });
    }
  }

  /* ============================================================
     FIX: Prevent horizontal scroll
     ============================================================ */
  function preventHorizontalScroll() {
    // Add overflow-x: hidden to html and body
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';

    // Fix any elements that might cause overflow
    var wideElements = document.querySelectorAll('.work-deck, .mq-track, .ghost');
    wideElements.forEach(function(el) {
      el.style.maxWidth = '100vw';
    });
  }

  /* ============================================================
     FIX: Projects vertical layout override
     ============================================================ */
  function fixProjectsLayout() {
    // Remove horizontal deck behavior
    var workDeck = document.querySelector('.work-deck');
    if (workDeck) {
      workDeck.style.display = 'flex';
      workDeck.style.flexDirection = 'column';
      workDeck.style.gap = '32px';
      workDeck.style.overflow = 'visible';
      workDeck.style.scrollSnapType = 'none';
      workDeck.style.touchAction = 'auto';
    }

    var cards = document.querySelectorAll('.work-deck .ch');
    cards.forEach(function(card) {
      card.style.flex = 'none';
      card.style.width = '100%';
      card.style.maxWidth = '100%';
      card.style.scrollSnapAlign = 'none';
      card.classList.remove('live');
    });

    // Hide horizontal navigation elements
    var workFoot = document.querySelector('.work-foot');
    if (workFoot) workFoot.style.display = 'none';
  }

  /* ============================================================
     INITIALIZE
     ============================================================ */
  function init() {
    // Add mobile class to body
    document.body.classList.add('is-mobile');

    // Prevent horizontal scroll
    preventHorizontalScroll();

    // Fix projects layout
    fixProjectsLayout();

    // Create UI elements
    createChannelDial();
    createGlitchOverlay();
    createAmbientOverlays();

    // Get HUD elements
    hudScene = document.getElementById('hud-scene');
    hudTc = document.getElementById('hud-tc');
    hudIdx = document.getElementById('hud-idx');

    // Setup scroll tracking
    window.addEventListener('scroll', onScroll, { passive: true });

    // Setup visibility handling
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Init animations after DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        initProjectCards();
        initSectionReveals();
        initHeroMobile();
      });
    } else {
      initProjectCards();
      initSectionReveals();
      initHeroMobile();
    }

    // Set initial channel
    detectCurrentChannel();

    console.log('[Mobile] Experience initialized');
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
