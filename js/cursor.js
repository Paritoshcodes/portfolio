var cursorInitialized = false;

function supportsSmartCursor(reduceMotion) {
  if (reduceMotion) {
    return false;
  }

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function getCursorLabel(target) {
  var explicit = target.getAttribute('data-cursor-label');

  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  if (target.tagName === 'A') {
    return 'Open';
  }

  if (target.tagName === 'BUTTON') {
    return 'Select';
  }

  return 'Interact';
}

export function initSmartCursor(options) {
  if (cursorInitialized) {
    return;
  }

  cursorInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);

  if (!supportsSmartCursor(reduceMotion)) {
    return;
  }

  var cursor = document.querySelector('.smart-cursor');

  if (!cursor) {
    return;
  }

  var label = cursor.querySelector('.smart-cursor-label');
  var mediaWrap = cursor.querySelector('.smart-cursor-media-wrap');
  var mediaNode = cursor.querySelector('.smart-cursor-media');
  var interactiveSelector = '[data-cursor-label], [data-cursor-media], a, button';
  var activeTarget = null;
  var targetX = window.innerWidth * 0.5;
  var targetY = window.innerHeight * 0.5;
  var cursorX = targetX;
  var cursorY = targetY;

  document.body.classList.add('has-smart-cursor');

  function setMedia(source) {
    if (!mediaNode || !mediaWrap) {
      return;
    }

    if (!source) {
      cursor.classList.remove('has-media');
      return;
    }

    mediaNode.src = source;
    cursor.classList.add('has-media');
  }

  function activateTarget(target) {
    activeTarget = target;
    cursor.classList.add('is-active');

    if (label) {
      label.textContent = getCursorLabel(target);
    }

    setMedia(target.getAttribute('data-cursor-media'));
  }

  function clearTarget() {
    activeTarget = null;
    cursor.classList.remove('is-active');
    cursor.classList.remove('has-media');

    if (label) {
      label.textContent = 'Scroll';
    }
  }

  function render() {
    cursorX += (targetX - cursorX) * 0.2;
    cursorY += (targetY - cursorY) * 0.2;
    cursor.style.transform = 'translate(' + cursorX + 'px, ' + cursorY + 'px)';
    window.requestAnimationFrame(render);
  }

  window.requestAnimationFrame(render);

  window.addEventListener('mousemove', function (event) {
    targetX = event.clientX;
    targetY = event.clientY;
    cursor.classList.add('is-visible');
  });

  document.addEventListener('mouseover', function (event) {
    var target = event.target.closest(interactiveSelector);

    if (!target) {
      return;
    }

    activateTarget(target);
  });

  document.addEventListener('mouseout', function (event) {
    if (!activeTarget) {
      return;
    }

    var related = event.relatedTarget;

    if (related && activeTarget.contains(related)) {
      return;
    }

    if (event.target === activeTarget || activeTarget.contains(event.target)) {
      clearTarget();
    }
  });

  window.addEventListener('mouseleave', function () {
    cursor.classList.remove('is-visible');
    clearTarget();
  });

  window.addEventListener('blur', function () {
    cursor.classList.remove('is-visible');
    clearTarget();
  });
}
