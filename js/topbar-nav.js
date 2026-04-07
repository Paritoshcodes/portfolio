var topbarSectionStateInitialized = false;

function collectSectionLinkTargets() {
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.topbar-nav a[href^="#"]')
  );

  return links
    .map(function (link) {
      var hash = link.getAttribute('href') || '';

      if (!hash || hash.charAt(0) !== '#') {
        return null;
      }

      var id = hash.slice(1);
      var section = document.getElementById(id);

      if (!section) {
        return null;
      }

      return {
        id: id,
        link: link,
        section: section
      };
    })
    .filter(function (item) {
      return item !== null;
    });
}

function setActiveNavLink(targets, activeId) {
  targets.forEach(function (target) {
    var isActive = target.id === activeId;

    target.link.classList.toggle('is-section-active', isActive);

    if (isActive) {
      target.link.setAttribute('aria-current', 'location');
      return;
    }

    target.link.removeAttribute('aria-current');
  });
}

function findTargetById(targets, id) {
  var matched = null;

  targets.forEach(function (target) {
    if (matched || target.id !== id) {
      return;
    }

    matched = target;
  });

  return matched;
}

function updateActivePill(targets, activeId) {
  var nav = document.querySelector('.topbar-nav');
  var pill = nav ? nav.querySelector('.topbar-active-pill') : null;
  var activeTarget = activeId ? findTargetById(targets, activeId) : null;

  if (!pill || !nav || !activeTarget || activeTarget.link.hidden) {
    if (pill) {
      pill.classList.remove('is-visible');
    }

    return;
  }

  var navRect = nav.getBoundingClientRect();
  var linkRect = activeTarget.link.getBoundingClientRect();
  var x = linkRect.left - navRect.left;

  pill.style.width = String(linkRect.width) + 'px';
  pill.style.transform = 'translate3d(' + String(x) + 'px, -50%, 0)';
  pill.classList.add('is-visible');
}

function detectActiveSectionId(targets, topbar) {
  var topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
  var viewportAnchor = topbarHeight + window.innerHeight * 0.32;
  var bestId = null;
  var bestDistance = Number.POSITIVE_INFINITY;

  targets.forEach(function (target) {
    var rect = target.section.getBoundingClientRect();

    if (rect.bottom <= topbarHeight + 6 || rect.top >= window.innerHeight) {
      return;
    }

    var clampedAnchor = Math.max(rect.top, Math.min(viewportAnchor, rect.bottom));
    var distance = Math.abs(clampedAnchor - viewportAnchor);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = target.id;
    }
  });

  if (bestId) {
    return bestId;
  }

  var scrollAnchor = window.scrollY + topbarHeight + 24;

  targets.forEach(function (target) {
    if (target.section.offsetTop <= scrollAnchor) {
      bestId = target.id;
    }
  });

  return bestId;
}

function shouldHideProjectsLink(projectsSection, topbar) {
  if (!projectsSection) {
    return false;
  }

  var topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
  var rect = projectsSection.getBoundingClientRect();
  var startLine = topbarHeight + window.innerHeight * 0.2;
  var endLine = window.innerHeight * 1.05;

  return rect.top <= startLine && rect.bottom >= endLine;
}

function initSectionHighlighting(targets, topbar, projectsSection) {
  var projectsTarget = findTargetById(targets, 'projects');

  function updateSectionState() {
    var activeId = detectActiveSectionId(targets, topbar);
    var hideProjectsLink = shouldHideProjectsLink(projectsSection, topbar);

    if (projectsTarget) {
      projectsTarget.link.hidden = hideProjectsLink;

      if (hideProjectsLink) {
        projectsTarget.link.setAttribute('aria-hidden', 'true');
      } else {
        projectsTarget.link.removeAttribute('aria-hidden');
      }
    }

    setActiveNavLink(targets, activeId);
    updateActivePill(targets, activeId);
    topbar.classList.toggle('is-projects-nav-hidden', hideProjectsLink);
  }

  function requestUpdate() {
    updateSectionState();
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('orientationchange', requestUpdate);
  window.addEventListener('visibilitychange', requestUpdate);

  requestUpdate();
  window.setTimeout(requestUpdate, 120);
}

function initProjectsMorphAnimation(options) {
  var reduceMotion = Boolean(options && options.reduceMotion);
  var projectsSection = document.getElementById('projects');
  var projectsHead = document.querySelector('#projects .projects-head');
  var projectsLink = document.querySelector('.topbar-nav a[href="#projects"]');

  if (!projectsSection || !projectsHead || !projectsLink) {
    return;
  }

  if (
    reduceMotion ||
    typeof window.gsap === 'undefined' ||
    typeof window.ScrollTrigger === 'undefined'
  ) {
    return;
  }

  var gsap = window.gsap;
  var mm = gsap.matchMedia();

  mm.add('(min-width: 768px)', function () {
    projectsHead.classList.add('is-topbar-morphing');
    var topbar = document.querySelector('.site-topbar');
    var projectsNav = projectsLink.parentElement;
    var cachedMetrics = null;

    function readMorphMetrics() {
      if (projectsLink.hidden && cachedMetrics) {
        return cachedMetrics;
      }

      var sourceRect = projectsLink.getBoundingClientRect();
      var sourceWidth = sourceRect.width;
      var sourceHeight = sourceRect.height;
      var sourceLeft = sourceRect.left;
      var sourceTop = sourceRect.top;

      if ((!sourceWidth || !sourceHeight) && projectsNav && topbar) {
        var navRect = projectsNav.getBoundingClientRect();
        var topbarRect = topbar.getBoundingClientRect();
        sourceWidth = 108;
        sourceHeight = 32;
        sourceLeft = navRect.left + Math.max((navRect.width - sourceWidth) * 0.34, 0);
        sourceTop = topbarRect.top + (topbarRect.height - sourceHeight) * 0.5;
      }

      var targetRect = projectsHead.getBoundingClientRect();
      var x = sourceLeft - targetRect.left;
      var y = sourceTop - targetRect.top;
      var scaleX = targetRect.width ? sourceWidth / targetRect.width : 1;
      var scaleY = targetRect.height ? sourceHeight / targetRect.height : 1;

      cachedMetrics = {
        x: x,
        y: y,
        scaleX: Math.max(scaleX, 0.12),
        scaleY: Math.max(scaleY, 0.12)
      };

      return cachedMetrics;
    }

    var entryTimeline = gsap.timeline({
      defaults: {
        ease: 'none'
      },
      scrollTrigger: {
        trigger: projectsSection,
        start: 'top 94%',
        end: 'top 54%',
        scrub: 1,
        invalidateOnRefresh: true
      }
    });

    entryTimeline.fromTo(
      projectsHead,
      {
        x: function () {
          return readMorphMetrics().x;
        },
        y: function () {
          return readMorphMetrics().y;
        },
        scaleX: function () {
          return readMorphMetrics().scaleX;
        },
        scaleY: function () {
          return readMorphMetrics().scaleY;
        },
        opacity: 0.14,
        transformOrigin: 'left top'
      },
      {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1
      },
      0
    );

    var exitTimeline = gsap.timeline({
      defaults: {
        ease: 'none'
      },
      scrollTrigger: {
        trigger: projectsSection,
        start: 'bottom bottom',
        end: 'bottom top',
        scrub: 1,
        invalidateOnRefresh: true
      }
    });

    exitTimeline.fromTo(
      projectsHead,
      {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        immediateRender: false
      },
      {
        x: function () {
          return readMorphMetrics().x;
        },
        y: function () {
          return readMorphMetrics().y;
        },
        scaleX: function () {
          return readMorphMetrics().scaleX;
        },
        scaleY: function () {
          return readMorphMetrics().scaleY;
        },
        opacity: 0.2
      },
      0
    );

    return function () {
      projectsHead.classList.remove('is-topbar-morphing');
      projectsHead.style.transform = '';
      projectsHead.style.opacity = '';
    };
  });
}

export function initTopbarSectionState(options) {
  if (topbarSectionStateInitialized) {
    return;
  }

  topbarSectionStateInitialized = true;

  var topbar = document.querySelector('.site-topbar');
  var projectsSection = document.getElementById('projects');
  var targets = collectSectionLinkTargets();

  if (!topbar || !projectsSection || !targets.length) {
    return;
  }

  initSectionHighlighting(targets, topbar, projectsSection);
  initProjectsMorphAnimation(options);
}
