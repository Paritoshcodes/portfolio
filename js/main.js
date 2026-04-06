import { initDotGridBackground } from './utils.js';
import { initHeroAnimations } from './hero.js';
import { initProjectScenes } from './projects.js';
import { initAboutReveals } from './about.js';
import { initPreloader } from './preloader.js';
import { initSmartCursor } from './cursor.js';
import { initSectionTransitions } from './transitions.js';

var manualGsapTickerId = null;

function ensureGsapTicker() {
  if (typeof window.gsap === 'undefined') {
    return;
  }

  var gsap = window.gsap;

  if (gsap.ticker && typeof gsap.ticker.wake === 'function') {
    gsap.ticker.wake();
  }

  var initialTime = gsap.globalTimeline.time();

  window.setTimeout(function () {
    if (typeof window.gsap === 'undefined') {
      return;
    }

    var advancedTime = window.gsap.globalTimeline.time();

    if (advancedTime > initialTime + 0.001 || manualGsapTickerId !== null) {
      return;
    }

    var manualTime = initialTime;

    manualGsapTickerId = window.setInterval(function () {
      manualTime += 0.016;
      window.gsap.updateRoot(manualTime);
    }, 16);
  }, 260);
}

window.addEventListener('beforeunload', function () {
  if (manualGsapTickerId === null) {
    return;
  }

  window.clearInterval(manualGsapTickerId);
  manualGsapTickerId = null;
});

window.addEventListener('load', function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  if (
    typeof window.ScrollTrigger !== 'undefined' &&
    typeof window.ScrollTrigger.clearScrollMemory === 'function'
  ) {
    window.ScrollTrigger.clearScrollMemory();
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  initDotGridBackground();

  if (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined') {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  ensureGsapTicker();

  function startExperience() {
    ensureGsapTicker();

    initHeroAnimations({ reduceMotion: reduceMotion });
    initAboutReveals({ reduceMotion: reduceMotion });
    initProjectScenes({ reduceMotion: reduceMotion });
    initSectionTransitions({ reduceMotion: reduceMotion });
    initSmartCursor({ reduceMotion: reduceMotion });

    if (typeof window.ScrollTrigger !== 'undefined') {
      window.ScrollTrigger.refresh();
    }
  }

  initPreloader({
    reduceMotion: reduceMotion,
    onComplete: startExperience
  });
});
