var sectionTransitionsInitialized = false;

function setMasksStatic(masks) {
  masks.forEach(function (mask) {
    mask.style.opacity = '0';
    mask.style.transform = 'translateY(-100%)';
  });
}

export function initSectionTransitions(options) {
  if (sectionTransitionsInitialized) {
    return;
  }

  sectionTransitionsInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);
  var masks = Array.prototype.slice.call(document.querySelectorAll('.section-mask'));

  if (!masks.length) {
    return;
  }

  if (reduceMotion) {
    setMasksStatic(masks);
    return;
  }

  if (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined') {
    var gsap = window.gsap;

    masks.forEach(function (mask) {
      var section = mask.parentElement;

      if (!section) {
        return;
      }

      gsap.set(mask, { yPercent: 0, opacity: 0.82 });

      gsap.to(mask, {
        yPercent: -108,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 88%',
          end: 'top 38%',
          scrub: 1
        }
      });
    });

    return;
  }

  if (typeof window.IntersectionObserver === 'undefined') {
    setMasksStatic(masks);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        var mask = entry.target;
        mask.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        mask.style.opacity = '0';
        mask.style.transform = 'translateY(-100%)';
        observer.unobserve(mask);
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -20% 0px'
    }
  );

  masks.forEach(function (mask) {
    observer.observe(mask);
  });
}
