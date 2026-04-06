var projectsInitialized = false;

function syncVideoPlayback(video, shouldPlay) {
  if (!video) {
    return;
  }

  video.muted = true;
  video.playsInline = true;

  if (shouldPlay) {
    var playPromise = video.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {});
    }

    return;
  }

  video.pause();

  try {
    video.currentTime = 0;
  } catch (error) {
    // Ignore currentTime assignment until metadata is ready.
  }
}

function initSceneVideoPlayback(video) {
  if (!video) {
    return;
  }

  video.playbackRate = 0.92;
  syncVideoPlayback(video, true);

  if (video.readyState >= 1) {
    return;
  }

  video.addEventListener(
    'loadedmetadata',
    function () {
      syncVideoPlayback(video, true);
    },
    { once: true }
  );
}

function getCategoryTokens(node) {
  var value = (node.getAttribute('data-category') || '').trim();

  if (!value) {
    return [];
  }

  return value.split(/\s+/);
}

function matchesFilter(node, filterValue) {
  if (filterValue === 'all') {
    return true;
  }

  var tokens = getCategoryTokens(node);
  return tokens.indexOf(filterValue) !== -1;
}

function setSceneStaticLayout(scene) {
  var spacer = scene.querySelector('.scene-spacer');
  var sticky = scene.querySelector('.scene-sticky');

  if (spacer) {
    spacer.style.height = '0';
  }

  if (sticky) {
    sticky.style.position = 'relative';
    sticky.style.top = 'auto';
    sticky.style.height = 'auto';
  }
}

function showSceneContent(scene, options) {
  var overlay = scene.querySelector('.scene-overlay');
  var glass = scene.querySelector('.scene-glass');
  var sceneMedia = scene.querySelector('.scene-screenshot, .scene-video');
  var sceneVideo = scene.querySelector('.scene-video');
  var pauseVideo = Boolean(options && options.pauseVideo);
  var details = glass ? glass.querySelectorAll('.scene-tag, .scene-title, .scene-desc, .scene-stack span, .scene-link') : [];

  if (overlay) {
    overlay.style.opacity = '0.62';
  }

  if (sceneMedia) {
    sceneMedia.style.transform = 'scale(1)';
  }

  if (sceneVideo) {
    syncVideoPlayback(sceneVideo, !pauseVideo);

    if (!pauseVideo) {
      sceneVideo.style.filter = 'brightness(0.92) saturate(1.08) contrast(1.06)';
    }
  }

  if (glass) {
    glass.style.opacity = '1';
    glass.style.transform = 'translateY(0)';
  }

  details.forEach(function (item) {
    item.style.opacity = '1';
    item.style.transform = 'translateY(0)';
  });
}

function applyFilterState(filterValue, scenes, archiveItems, reduceMotion) {
  var hasGsap = !reduceMotion && typeof window.gsap !== 'undefined';
  var gsap = hasGsap ? window.gsap : null;

  scenes.forEach(function (scene) {
    var match = matchesFilter(scene, filterValue);

    scene.classList.toggle('is-muted', !match);
  });

  archiveItems.forEach(function (item) {
    var match = matchesFilter(item, filterValue);

    item.classList.toggle('is-hidden', !match);

    if (!hasGsap) {
      return;
    }

    gsap.to(item, {
      opacity: match ? 1 : 0.28,
      y: match ? 0 : 6,
      duration: 0.24,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  });
}

function initProjectFilters(scenes, reduceMotion) {
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.project-filter'));
  var archiveItems = Array.prototype.slice.call(document.querySelectorAll('.archive-item'));

  if (!filterButtons.length) {
    return;
  }

  function setActiveFilter(nextFilter) {
    filterButtons.forEach(function (button) {
      var isActive = button.getAttribute('data-filter') === nextFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    applyFilterState(nextFilter, scenes, archiveItems, reduceMotion);
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var nextFilter = button.getAttribute('data-filter') || 'all';
      setActiveFilter(nextFilter);
    });
  });

  setActiveFilter('all');
}

function initArchiveReveal(reduceMotion) {
  var archive = document.querySelector('.projects-archive');

  if (!archive) {
    return;
  }

  if (
    reduceMotion ||
    typeof window.gsap === 'undefined' ||
    typeof window.ScrollTrigger === 'undefined'
  ) {
    archive.style.opacity = '1';
    archive.style.transform = 'translateY(0)';
    return;
  }

  var gsap = window.gsap;

  gsap.set(archive, { opacity: 0, y: 28 });

  gsap.to(archive, {
    opacity: 1,
    y: 0,
    duration: 0.58,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: archive,
      start: 'top 84%'
    }
  });
}

function initMobileObserver(scenes, gsap) {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        var scene = entry.target;
        var glass = scene.querySelector('.scene-glass');
        var video = scene.querySelector('.scene-video');
        var details = glass ? glass.querySelectorAll('.scene-tag, .scene-title, .scene-desc, .scene-stack span, .scene-link') : [];

        if (video) {
          syncVideoPlayback(video, true);
        }

        if (glass) {
          gsap.to(glass, {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: 'power2.out'
          });
        }

        if (details.length) {
          gsap.to(details, {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.06,
            ease: 'power2.out'
          });
        }

        observer.unobserve(scene);
      });
    },
    {
      threshold: 0.26,
      rootMargin: '0px 0px -12% 0px'
    }
  );

  scenes.forEach(function (scene) {
    setSceneStaticLayout(scene);

    var glass = scene.querySelector('.scene-glass');
    var details = glass ? glass.querySelectorAll('.scene-tag, .scene-title, .scene-desc, .scene-stack span, .scene-link') : [];

    if (glass) {
      gsap.set(glass, { opacity: 0, y: 32 });
    }

    if (details.length) {
      gsap.set(details, { opacity: 0, y: 18 });
    }

    observer.observe(scene);
  });
}

export function initProjectScenes(options) {
  if (projectsInitialized) {
    return;
  }

  projectsInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.project-scene'));

  if (!scenes.length) {
    return;
  }

  initProjectFilters(scenes, reduceMotion);
  initArchiveReveal(reduceMotion);

  if (
    reduceMotion ||
    typeof window.gsap === 'undefined' ||
    typeof window.ScrollTrigger === 'undefined'
  ) {
    scenes.forEach(function (scene) {
      setSceneStaticLayout(scene);
      showSceneContent(scene, { pauseVideo: true });
    });
    return;
  }

  var gsap = window.gsap;
  var mm = gsap.matchMedia();

  mm.add('(min-width: 768px)', function () {
    scenes.forEach(function (scene) {
      var spacer = scene.querySelector('.scene-spacer');
      var sticky = scene.querySelector('.scene-sticky');
      var overlay = scene.querySelector('.scene-overlay');
      var glass = scene.querySelector('.scene-glass');
      var sceneMedia = scene.querySelector('.scene-screenshot, .scene-video');
      var video = scene.querySelector('.scene-video');
      var details = glass ? glass.querySelectorAll('.scene-tag, .scene-title, .scene-desc, .scene-stack span, .scene-link') : [];

      if (!sticky || !overlay || !glass || !sceneMedia) {
        return;
      }

      if (spacer) {
        spacer.style.height = '0';
      }

      sticky.style.position = 'relative';
      sticky.style.top = 'auto';
      sticky.style.height = '100vh';

      initSceneVideoPlayback(video);

      var timeline = gsap.timeline({
        scrollTrigger: {
          trigger: scene,
          start: 'top top',
          end: '+=300%',
          scrub: 1,
          pin: sticky,
          anticipatePin: 1
        }
      });

      timeline.to(overlay, { opacity: video ? 0.14 : 0, duration: 0.3 }, 0);

      if (video) {
        timeline.fromTo(
          video,
          { scale: 1.12, filter: 'brightness(0.62) saturate(0.94) contrast(1.02)' },
          { scale: 1.02, filter: 'brightness(0.96) saturate(1.16) contrast(1.08)', duration: 0.72, ease: 'power2.out' },
          0
        );

        timeline.from(glass, { x: -34, y: 96, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0.08);
      } else {
        timeline.from(sceneMedia, { scale: 1.06, duration: 0.6, ease: 'power2.out' }, 0);
        timeline.from(glass, { y: 80, opacity: 0, duration: 0.4 }, 0.1);
      }

      timeline.from(details, { y: 20, opacity: 0, stagger: 0.07, duration: 0.3 }, 0.2);
    });
  });

  mm.add('(max-width: 767px)', function () {
    initMobileObserver(scenes, gsap);
  });
}
