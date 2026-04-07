var resumeRelayInitialized = false;

function normalizeResumeButton() {
  var canonical = document.querySelector('#resume-download-link');

  if (!canonical) {
    canonical = document.querySelector("a[download='Paritosh_Singh_Resume.pdf']");
  }

  if (!canonical) {
    return null;
  }

  canonical.id = 'resume-download-link';
  canonical.classList.add('resume-relay-link');

  if (!canonical.hasAttribute('data-cursor-label')) {
    canonical.setAttribute('data-cursor-label', 'Download resume');
  }

  document.querySelectorAll("a[download='Paritosh_Singh_Resume.pdf']").forEach(function (node) {
    if (node !== canonical) {
      node.remove();
    }
  });

  return canonical;
}

function getTargetSlot(heroSection, contactSection, activeSlot) {
  var viewportHeight = window.innerHeight || 0;
  var contactRect = contactSection.getBoundingClientRect();
  var contactEnter = viewportHeight * 0.64;
  var contactExit = viewportHeight * 0.8;

  if (activeSlot === 'contact' && contactRect.top <= contactExit) {
    return 'contact';
  }

  if (contactRect.top <= contactEnter) {
    return 'contact';
  }

  var heroEnter = Math.max(heroSection.offsetHeight * 0.62, viewportHeight * 0.46);
  var heroExit = Math.max(heroSection.offsetHeight * 0.5, viewportHeight * 0.34);

  if (activeSlot === 'hero' && window.scrollY <= heroEnter) {
    return 'hero';
  }

  if (window.scrollY <= heroExit) {
    return 'hero';
  }

  return 'topbar';
}

function placeInHero(button, heroActions) {
  var quickNav = heroActions.querySelector('.hero-quick-nav');

  if (quickNav) {
    heroActions.insertBefore(button, quickNav);
    return;
  }

  heroActions.appendChild(button);
}

function placeInContact(button, contactCard) {
  var emailText = contactCard.querySelector('.contact-email-text');

  if (!emailText) {
    contactCard.appendChild(button);
    return;
  }

  if (emailText.nextSibling) {
    contactCard.insertBefore(button, emailText.nextSibling);
    return;
  }

  contactCard.appendChild(button);
}

function setPlacementState(button, slotName) {
  button.dataset.resumeSlot = slotName;
  button.classList.toggle('is-in-topbar', slotName === 'topbar');
  button.classList.toggle('is-in-hero', slotName === 'hero');
  button.classList.toggle('is-in-contact', slotName === 'contact');
}

function clearMovingState(button) {
  button.classList.remove('resume-relay-moving');

  if (button._resumeMovingTimeoutId) {
    window.clearTimeout(button._resumeMovingTimeoutId);
    button._resumeMovingTimeoutId = null;
  }
}

function moveButton(button, slotName, nodes, reduceMotion) {
  var targetParent = slotName === 'hero'
    ? nodes.heroActions
    : slotName === 'contact'
      ? nodes.contactCard
      : nodes.topbarActions;

  if (!targetParent || button.parentElement === targetParent) {
    setPlacementState(button, slotName);
    return;
  }

  var fromRect = button.getBoundingClientRect();

  if (slotName === 'hero') {
    placeInHero(button, targetParent);
  } else if (slotName === 'contact') {
    placeInContact(button, targetParent);
  } else {
    targetParent.appendChild(button);
  }

  setPlacementState(button, slotName);

  if (reduceMotion) {
    return;
  }

  var toRect = button.getBoundingClientRect();
  var deltaX = fromRect.left - toRect.left;
  var deltaY = fromRect.top - toRect.top;

  if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
    return;
  }

  var scaleX = fromRect.width / Math.max(toRect.width, 1);
  var scaleY = fromRect.height / Math.max(toRect.height, 1);
  var travelDistance = Math.hypot(deltaX, deltaY);
  var duration = Math.min(760, Math.max(520, 320 + travelDistance * 0.22));

  if (typeof button.getAnimations === 'function') {
    button.getAnimations().forEach(function (animation) {
      animation.cancel();
    });
  }

  clearMovingState(button);
  button.classList.add('resume-relay-moving');

  var animation = button.animate(
    [
      {
        transform: 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(' + scaleX + ', ' + scaleY + ')',
        opacity: 0.8
      },
      {
        transform: 'translate(' + deltaX * -0.06 + 'px, ' + deltaY * -0.06 + 'px) scale(1.03, 1.03)',
        opacity: 1
      },
      { transform: 'translate(0px, 0px)', opacity: 1 }
    ],
    {
      duration: duration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    }
  );

  animation.onfinish = function () {
    clearMovingState(button);
  };

  animation.oncancel = function () {
    clearMovingState(button);
  };

  button._resumeMovingTimeoutId = window.setTimeout(function () {
    clearMovingState(button);
  }, duration + 180);
}

function detectActiveSlot(button, nodes) {
  if (button.parentElement === nodes.topbarActions) {
    return 'topbar';
  }

  if (button.parentElement === nodes.contactCard) {
    return 'contact';
  }

  return 'hero';
}

export function initResumeButtonRelay(options) {
  if (resumeRelayInitialized) {
    return;
  }

  resumeRelayInitialized = true;

  var reduceMotion = Boolean(options && options.reduceMotion);
  var button = normalizeResumeButton();
  var heroSection = document.querySelector('#hero');
  var contactSection = document.querySelector('#contact');
  var heroActions = document.querySelector('.hero-actions');
  var topbarActions = document.querySelector('.topbar-actions');
  var contactCard = document.querySelector('.contact-card');

  if (!button || !heroSection || !contactSection || !heroActions || !topbarActions || !contactCard) {
    return;
  }

  var nodes = {
    heroActions: heroActions,
    topbarActions: topbarActions,
    contactCard: contactCard
  };

  var activeSlot = detectActiveSlot(button, nodes);
  setPlacementState(button, activeSlot);
  function updateSlot() {
    var nextSlot = getTargetSlot(heroSection, contactSection, activeSlot);

    if (nextSlot === activeSlot) {
      return;
    }

    activeSlot = nextSlot;

    moveButton(button, nextSlot, nodes, reduceMotion);
  }

  function requestUpdate() {
    updateSlot();
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('orientationchange', requestUpdate);

  requestUpdate();
}
