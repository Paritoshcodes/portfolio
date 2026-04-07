var preloaderInitialized = false;

function getSplashSeen() {
  try {
    return window.sessionStorage.getItem('splashSeen') === 'true';
  } catch (error) {
    return false;
  }
}

function setSplashSeen() {
  try {
    window.sessionStorage.setItem('splashSeen', 'true');
  } catch (error) {
    // Ignore sessionStorage issues in restricted environments.
  }
}

function completePreloader(preloader, onComplete) {
  preloader.classList.add('is-hidden');
  document.body.classList.remove('preloader-lock');
  setSplashSeen();

  window.setTimeout(function () {
    if (typeof onComplete === 'function') {
      onComplete();
    }
  }, 420);
}

function hidePreloaderImmediately(preloader, onComplete) {
  preloader.classList.add('is-hidden');
  preloader.style.display = 'none';
  document.body.classList.remove('preloader-lock');
  setSplashSeen();

  if (typeof onComplete === 'function') {
    onComplete();
  }
}

function runMeter(countNode, duration, done) {
  if (!countNode) {
    done();
    return function () {};
  }

  var active = true;
  var startTime = Date.now();
  var timer = window.setInterval(function () {
    if (!active) {
      return;
    }

    var elapsed = Date.now() - startTime;
    var rawProgress = Math.min(elapsed / duration, 1);
    var easedProgress = 1 - Math.pow(1 - rawProgress, 3);
    var value = Math.round(easedProgress * 100);

    countNode.textContent = String(value) + '%';

    if (rawProgress >= 1) {
      active = false;
      window.clearInterval(timer);
      done();
    }
  }, 24);

  return function () {
    if (!active) {
      return;
    }

    active = false;
    window.clearInterval(timer);
  };
}

export function initPreloader(options) {
  if (preloaderInitialized) {
    if (options && typeof options.onComplete === 'function') {
      options.onComplete();
    }

    return;
  }

  preloaderInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);
  var onComplete = options && options.onComplete;
  var preloader = document.querySelector('.site-preloader');
  var countNode = document.querySelector('[data-preloader-count]');
  var skipButton = document.querySelector('[data-preloader-skip]');

  if (!preloader) {
    if (typeof onComplete === 'function') {
      onComplete();
    }

    return;
  }

  if (getSplashSeen()) {
    hidePreloaderImmediately(preloader, onComplete);
    return;
  }

  document.body.classList.add('preloader-lock');

  if (countNode) {
    countNode.textContent = '0%';
  }

  var finalized = false;
  var stopMeter = function () {};

  function finalize(immediate) {
    if (finalized) {
      return;
    }

    finalized = true;
    stopMeter();

    if (immediate) {
      hidePreloaderImmediately(preloader, onComplete);
      return;
    }

    completePreloader(preloader, onComplete);
  }

  if (skipButton) {
    skipButton.addEventListener('click', function () {
      finalize(true);
    });
  }

  stopMeter = runMeter(countNode, reduceMotion ? 160 : 1320, function () {
    finalize(false);
  });
}
