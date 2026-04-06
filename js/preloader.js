var preloaderInitialized = false;

function completePreloader(preloader, onComplete) {
  preloader.classList.add('is-hidden');
  document.body.classList.remove('preloader-lock');

  window.setTimeout(function () {
    if (typeof onComplete === 'function') {
      onComplete();
    }
  }, 420);
}

function runMeter(countNode, duration, done) {
  if (!countNode) {
    done();
    return;
  }

  var startTime = Date.now();
  var timer = window.setInterval(function () {
    var elapsed = Date.now() - startTime;
    var rawProgress = Math.min(elapsed / duration, 1);
    var easedProgress = 1 - Math.pow(1 - rawProgress, 3);
    var value = Math.round(easedProgress * 100);

    countNode.textContent = String(value) + '%';

    if (rawProgress >= 1) {
      window.clearInterval(timer);
      done();
    }
  }, 24);
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

  if (!preloader) {
    if (typeof onComplete === 'function') {
      onComplete();
    }

    return;
  }

  document.body.classList.add('preloader-lock');

  if (countNode) {
    countNode.textContent = '0%';
  }

  runMeter(countNode, reduceMotion ? 160 : 1320, function () {
    completePreloader(preloader, onComplete);
  });
}
