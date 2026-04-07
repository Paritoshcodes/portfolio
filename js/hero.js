var heroInitialized = false;
var heroPhrases = [
  'I build backend systems and ship ML that works in production.'
];

function setHeroStaticState(name, underline, role, dynamicLine, reelLink, indicator) {
  name.style.opacity = '1';
  name.style.transform = 'translateY(0)';
  underline.style.opacity = '1';
  underline.style.transform = 'scaleX(1)';
  role.style.opacity = '1';
  role.style.transform = 'translateY(0)';
  dynamicLine.style.opacity = '1';
  dynamicLine.style.transform = 'translateY(0)';
  reelLink.style.opacity = '1';
  reelLink.style.transform = 'translateY(0)';
  indicator.style.opacity = '1';
  indicator.style.transform = 'translateY(0)';
}

function initHeroActionLoop(gsap, actionLinks) {
  if (!actionLinks.length) {
    return;
  }

  actionLinks.forEach(function (link, index) {
    gsap.to(link, {
      y: -3,
      duration: 1.15 + (index * 0.16),
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: 1.15 + (index * 0.14)
    });
  });
}

function initHeroWordCycle(gsap, wordNode) {
  if (!wordNode) {
    return;
  }

  var phraseIndex = 0;
  wordNode.textContent = heroPhrases[0];

  if (heroPhrases.length <= 1) {
    return;
  }

  var cycle = gsap.timeline({
    repeat: -1,
    repeatDelay: 1.25,
    delay: 1.35
  });

  cycle.to(wordNode, {
    y: -10,
    opacity: 0,
    duration: 0.28,
    ease: 'power2.in',
    onComplete: function () {
      phraseIndex = (phraseIndex + 1) % heroPhrases.length;
      wordNode.textContent = heroPhrases[phraseIndex];
    }
  });

  cycle.fromTo(
    wordNode,
    { y: 10, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.36, ease: 'power2.out' }
  );
}

export function initHeroAnimations(options) {
  if (heroInitialized) {
    return;
  }

  heroInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);
  var name = document.querySelector('.hero-name');
  var underline = document.querySelector('.hero-underline');
  var role = document.querySelector('.hero-role');
  var dynamicLine = document.querySelector('.hero-dynamic');
  var dynamicWord = document.querySelector('[data-hero-word]');
  var reelLink = document.querySelector('.hero-reel-link');
  var actionLinks = Array.prototype.slice.call(document.querySelectorAll('.hero-action-link'));
  var indicator = document.querySelector('.scroll-indicator');

  if (!name || !underline || !role || !dynamicLine || !reelLink || !indicator || !actionLinks.length) {
    return;
  }

  if (dynamicWord) {
    dynamicWord.textContent = heroPhrases[0];
  }

  if (reduceMotion || typeof window.gsap === 'undefined') {
    setHeroStaticState(name, underline, role, dynamicLine, reelLink, indicator);
    return;
  }

  var gsap = window.gsap;

  gsap.set(name, { y: 44, opacity: 0 });
  gsap.set(role, { y: 22, opacity: 0 });
  gsap.set(dynamicLine, { y: 16, opacity: 0 });
  gsap.set(actionLinks, { y: 12, opacity: 0 });
  gsap.set(underline, { opacity: 1, scaleX: 0, transformOrigin: 'left center' });
  gsap.set(indicator, { y: 12, opacity: 0 });

  var introTimeline = gsap.timeline({ defaults: { ease: 'power2.out' } });

  introTimeline.to(name, { y: 0, opacity: 1, duration: 0.82 }, 0);
  introTimeline.to(role, { y: 0, opacity: 1, duration: 0.52 }, 0.2);
  introTimeline.to(dynamicLine, { y: 0, opacity: 1, duration: 0.46 }, 0.28);
  introTimeline.to(underline, { scaleX: 1, duration: 0.64 }, 0.5);
  introTimeline.to(actionLinks, { y: 0, opacity: 1, duration: 0.42, stagger: 0.08 }, 0.72);
  introTimeline.to(indicator, { y: 0, opacity: 1, duration: 0.4 }, 0.94);

  initHeroWordCycle(gsap, dynamicWord);
  initHeroActionLoop(gsap, actionLinks);

  gsap.to(indicator, {
    y: 6,
    duration: 1.35,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: 1.3
  });
}
