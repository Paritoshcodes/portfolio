var aboutRevealsInitialized = false;
var aboutRevealed = false;
var aboutObserver = null;

function showImmediately(stats, copy) {
  stats.style.opacity = '1';
  stats.style.transform = 'translateY(0)';
  copy.style.opacity = '1';
  copy.style.transform = 'translateY(0)';
}

function animateWithCss(stats, copy) {
  stats.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
  copy.style.transition = 'opacity 0.55s ease 0.12s, transform 0.55s ease 0.12s';

  window.requestAnimationFrame(function () {
    stats.style.opacity = '1';
    stats.style.transform = 'translateY(0)';
    copy.style.opacity = '1';
    copy.style.transform = 'translateY(0)';
  });
}

function setInitialState(stats, copy) {
  stats.style.opacity = '0';
  stats.style.transform = 'translateY(34px)';
  copy.style.opacity = '0';
  copy.style.transform = 'translateY(34px)';
}

function revealAbout(stats, copy, hasGsap) {
  if (aboutRevealed) {
    return;
  }

  aboutRevealed = true;

  if (aboutObserver) {
    aboutObserver.disconnect();
    aboutObserver = null;
  }

  if (hasGsap) {
    var gsap = window.gsap;
    gsap.to(stats, {
      y: 0,
      opacity: 1,
      duration: 0.55,
      ease: 'power2.out'
    });
    gsap.to(copy, {
      y: 0,
      opacity: 1,
      duration: 0.55,
      delay: 0.12,
      ease: 'power2.out'
    });
  } else {
    animateWithCss(stats, copy);
  }
}

export function initAboutReveals(options) {
  if (aboutRevealsInitialized) {
    return;
  }

  aboutRevealsInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);
  var aboutSection = document.querySelector('#about');
  var stats = document.querySelector('.about-stats');
  var copy = document.querySelector('.about-copy');

  if (!aboutSection || !stats || !copy) {
    return;
  }

  if (reduceMotion) {
    showImmediately(stats, copy);
    return;
  }

  setInitialState(stats, copy);

  var hasGsap = typeof window.gsap !== 'undefined';

  function shouldReveal() {
    var rect = aboutSection.getBoundingClientRect();
    var viewportHeight = window.innerHeight || 0;
    return rect.top < (viewportHeight * 0.9) && rect.bottom > 0;
  }

  function onVisibilityCheck() {
    if (!aboutRevealed && shouldReveal()) {
      revealAbout(stats, copy, hasGsap);

      window.removeEventListener('scroll', onVisibilityCheck);
      window.removeEventListener('resize', onVisibilityCheck);
    }
  }

  if (typeof window.IntersectionObserver !== 'undefined') {
    aboutObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          revealAbout(stats, copy, hasGsap);

          window.removeEventListener('scroll', onVisibilityCheck);
          window.removeEventListener('resize', onVisibilityCheck);
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -4% 0px'
      }
    );

    aboutObserver.observe(aboutSection);
  }

  window.addEventListener('scroll', onVisibilityCheck, { passive: true });
  window.addEventListener('resize', onVisibilityCheck);
  onVisibilityCheck();
}
