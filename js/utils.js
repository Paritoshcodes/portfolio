var dotGridInitialized = false;

function createDotGridCanvas() {
  var existingCanvas = document.querySelector('canvas[data-dot-grid]');
  if (existingCanvas) {
    return existingCanvas;
  }

  var canvas = document.createElement('canvas');
  canvas.className = 'dot-grid-canvas';
  canvas.setAttribute('data-dot-grid', 'true');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-1';

  if (document.body.firstChild) {
    document.body.insertBefore(canvas, document.body.firstChild);
  } else {
    document.body.appendChild(canvas);
  }

  return canvas;
}

function getRootToken(tokenName, fallbackValue) {
  var value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallbackValue;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(from, to, alpha) {
  return from + ((to - from) * alpha);
}

function buildDots(state) {
  var dots = [];
  var cols = Math.ceil(state.width / state.spacing) + 3;
  var rows = Math.ceil(state.height / state.spacing) + 3;

  for (var row = -1; row < rows; row += 1) {
    for (var col = -1; col < cols; col += 1) {
      var baseX = col * state.spacing;
      var baseY = row * state.spacing;

      dots.push({
        baseX: baseX,
        baseY: baseY,
        x: baseX,
        y: baseY,
        vx: 0,
        vy: 0,
        scale: 1,
        phase: ((row * 17) + (col * 31)) * 0.08
      });
    }
  }

  state.dots = dots;
}

function resizeCanvas(state) {
  var dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  var width = Math.max(window.innerWidth, 1);
  var height = Math.max(window.innerHeight, 1);

  state.width = width;
  state.height = height;

  state.canvas.width = Math.floor(width * dpr);
  state.canvas.height = Math.floor(height * dpr);
  state.canvas.style.width = width + 'px';
  state.canvas.style.height = height + 'px';

  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.pointer.x = width * 0.5;
  state.pointer.y = height * 0.5;
  state.pointer.smoothX = width * 0.5;
  state.pointer.smoothY = height * 0.5;

  buildDots(state);
}

function pushTrail(state, x, y, power) {
  if (state.trails.length >= state.maxTrails) {
    state.trails.shift();
  }

  state.trails.push({
    x: x,
    y: y,
    life: 1,
    power: power
  });
}

function setPointerTarget(state, x, y, strength) {
  var pointer = state.pointer;
  var now = performance.now();
  var dx = x - pointer.x;
  var dy = y - pointer.y;
  var speed = clamp(Math.sqrt((dx * dx) + (dy * dy)) / 26, 0.55, 2.8);

  pointer.x = x;
  pointer.y = y;
  pointer.active = true;
  pointer.lastMove = now;

  if (now - pointer.lastTrailTime > 18) {
    pushTrail(state, x, y, speed * strength);
    pointer.lastTrailTime = now;
  }
}

function setPointerIdle(state) {
  state.pointer.active = false;
}

function updatePointer(state, delta) {
  var pointer = state.pointer;
  var targetIntensity = pointer.active ? 1 : 0;

  pointer.intensity = lerp(pointer.intensity, targetIntensity, 0.12 * delta);
  pointer.smoothX = lerp(pointer.smoothX, pointer.x, 0.22 * delta);
  pointer.smoothY = lerp(pointer.smoothY, pointer.y, 0.22 * delta);
}

function updateTrails(state, delta) {
  for (var i = state.trails.length - 1; i >= 0; i -= 1) {
    var trail = state.trails[i];
    trail.life -= state.trailDecay * delta;
    trail.power = lerp(trail.power, 0.5, 0.08 * delta);

    if (trail.life <= 0) {
      state.trails.splice(i, 1);
    }
  }
}

function addAmbientTrail(state, timestamp) {
  if (timestamp - state.lastAmbientTrailTime < state.ambientTrailInterval) {
    return;
  }

  state.lastAmbientTrailTime = timestamp;

  var orbitRadius = Math.min(state.width, state.height) * 0.26;
  var angle = timestamp * 0.00034;
  var x = (state.width * 0.5) + (Math.cos(angle) * orbitRadius * 0.72);
  var y = (state.height * 0.44) + (Math.sin(angle * 1.27) * orbitRadius * 0.54);

  pushTrail(state, x, y, state.ambientTrailPower);
}

function drawReducedFrame(state) {
  var ctx = state.ctx;
  var dots = state.dots;

  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = state.dotColor;

  for (var i = 0; i < dots.length; i += 1) {
    var dot = dots[i];
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.arc(dot.baseX, dot.baseY, state.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawFrame(state, timestamp) {
  var ctx = state.ctx;
  var dots = state.dots;
  var pointer = state.pointer;
  var trails = state.trails;
  var t = timestamp * 0.001;
  var delta = state.lastTime ? Math.min((timestamp - state.lastTime) / 16.666, 2.1) : 1;

  state.lastTime = timestamp;

  updatePointer(state, delta);
  updateTrails(state, delta);

  if (pointer.intensity < 0.02) {
    addAmbientTrail(state, timestamp);
  }

  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = state.dotColor;

  for (var i = 0; i < dots.length; i += 1) {
    var dot = dots[i];

    var waveX = Math.sin((dot.baseY * 0.018) + (t * 0.65) + dot.phase) * state.idleDrift;
    var waveY = Math.cos((dot.baseX * 0.015) + (t * 0.52) + dot.phase) * state.idleDrift;

    var globalShiftX = Math.sin(t * state.globalDriftSpeedX) * state.globalDriftX;
    var globalShiftY = Math.cos(t * state.globalDriftSpeedY) * state.globalDriftY;

    var anchorX = dot.baseX + waveX + globalShiftX;
    var anchorY = dot.baseY + waveY + globalShiftY;

    var ax = (anchorX - dot.x) * state.spring;
    var ay = (anchorY - dot.y) * state.spring;

    var flowX = Math.sin((dot.baseY * 0.0052) + (t * state.idleFlowSpeedX) + dot.phase) * state.idleFlowStrength;
    var flowY = Math.cos((dot.baseX * 0.0047) + (t * state.idleFlowSpeedY) + dot.phase) * state.idleFlowStrength;
    ax += flowX;
    ay += flowY;

    var pulseA = Math.sin((t * 0.98) + dot.phase) * state.idlePulseA;
    var pulseB = Math.cos((t * 0.58) + (dot.phase * 0.72)) * state.idlePulseB;
    var targetScale = 1 + pulseA + pulseB;

    if (pointer.intensity > 0.01) {
      var pdx = dot.x - pointer.smoothX;
      var pdy = dot.y - pointer.smoothY;
      var pDistSq = (pdx * pdx) + (pdy * pdy);

      if (pDistSq < state.influenceRadiusSq) {
        var pDist = Math.sqrt(pDistSq) || 0.001;
        var pFalloff = 1 - (pDist / state.influenceRadius);
        var pForce = pFalloff * pFalloff * state.pushForce * pointer.intensity;

        ax += (pdx / pDist) * pForce;
        ay += (pdy / pDist) * pForce;
        targetScale += pFalloff * state.scaleBoost * pointer.intensity;
      }
    }

    for (var trailIndex = 0; trailIndex < trails.length; trailIndex += 1) {
      var trail = trails[trailIndex];
      var tdx = dot.x - trail.x;
      var tdy = dot.y - trail.y;
      var tDistSq = (tdx * tdx) + (tdy * tdy);

      if (tDistSq >= state.trailRadiusSq) {
        continue;
      }

      var tDist = Math.sqrt(tDistSq) || 0.001;
      var tFalloff = 1 - (tDist / state.trailRadius);
      var tEnergy = tFalloff * tFalloff * trail.life * trail.power;
      var tForce = tEnergy * state.trailPushForce;

      ax += (tdx / tDist) * tForce;
      ay += (tdy / tDist) * tForce;
      targetScale += tEnergy * state.trailScaleBoost;
    }

    dot.vx = (dot.vx + ax) * state.damping;
    dot.vy = (dot.vy + ay) * state.damping;
    dot.x += dot.vx * delta;
    dot.y += dot.vy * delta;
    dot.scale = lerp(dot.scale, targetScale, 0.18 * delta);

    var radius = state.radius * dot.scale;
    var alpha = clamp(
      state.dotAlphaBase + ((dot.scale - 1) * state.dotAlphaGain),
      0.08,
      0.78
    );

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export function initDotGridBackground() {
  if (dotGridInitialized) {
    return;
  }

  dotGridInitialized = true;

  var canvas = createDotGridCanvas();
  var ctx = canvas.getContext('2d', { alpha: true });

  if (!ctx) {
    return;
  }

  var state = {
    canvas: canvas,
    ctx: ctx,
    width: 0,
    height: 0,
    spacing: 35,
    radius: 0.74,
    idleDrift: 3.1,
    spring: 0.055,
    damping: 0.915,
    globalDriftX: 3.1,
    globalDriftY: 2.25,
    globalDriftSpeedX: 0.55,
    globalDriftSpeedY: 0.42,
    idleFlowStrength: 0.2,
    idleFlowSpeedX: 0.62,
    idleFlowSpeedY: 0.44,
    idlePulseA: 0.06,
    idlePulseB: 0.03,
    influenceRadius: 270,
    influenceRadiusSq: 270 * 270,
    trailRadius: 210,
    trailRadiusSq: 210 * 210,
    pushForce: 2.15,
    trailPushForce: 0.78,
    scaleBoost: 5.9,
    trailScaleBoost: 2.3,
    dotAlphaBase: 0.11,
    dotAlphaGain: 0.3,
    trailDecay: 0.03,
    ambientTrailPower: 0.9,
    ambientTrailInterval: 80,
    lastAmbientTrailTime: 0,
    maxTrails: 10,
    bgColor: getRootToken('--bg', 'rgb(13, 17, 23)'),
    dotColor: getRootToken('--text-primary', 'rgb(230, 237, 243)'),
    dots: [],
    trails: [],
    pointer: {
      x: 0,
      y: 0,
      smoothX: 0,
      smoothY: 0,
      active: false,
      intensity: 0,
      lastMove: 0,
      lastTrailTime: 0
    },
    rafId: null,
    lastTime: 0,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  resizeCanvas(state);

  function render(timestamp) {
    drawFrame(state, timestamp);
    state.rafId = window.requestAnimationFrame(render);
  }

  if (state.reduceMotion) {
    drawReducedFrame(state);
  } else {
    state.rafId = window.requestAnimationFrame(render);
  }

  window.addEventListener('mousemove', function (event) {
    if (state.reduceMotion) {
      return;
    }

    setPointerTarget(state, event.clientX, event.clientY, 1);
  });

  window.addEventListener('mousedown', function (event) {
    if (state.reduceMotion) {
      return;
    }

    setPointerTarget(state, event.clientX, event.clientY, 1.55);
    pushTrail(state, event.clientX, event.clientY, 3.2);
  });

  window.addEventListener(
    'touchstart',
    function (event) {
      if (state.reduceMotion || !event.touches.length) {
        return;
      }

      var touch = event.touches[0];
      setPointerTarget(state, touch.clientX, touch.clientY, 1.15);
      pushTrail(state, touch.clientX, touch.clientY, 1.9);
    },
    { passive: true }
  );

  window.addEventListener(
    'touchmove',
    function (event) {
      if (state.reduceMotion || !event.touches.length) {
        return;
      }

      var touch = event.touches[0];
      setPointerTarget(state, touch.clientX, touch.clientY, 1.05);
    },
    { passive: true }
  );

  window.addEventListener('touchend', function () {
    if (state.reduceMotion) {
      return;
    }

    setPointerIdle(state);
  });

  window.addEventListener('mouseleave', function () {
    if (state.reduceMotion) {
      return;
    }

    setPointerIdle(state);
  });

  window.addEventListener('blur', function () {
    setPointerIdle(state);
  });

  window.addEventListener('resize', function () {
    resizeCanvas(state);

    if (state.reduceMotion) {
      drawReducedFrame(state);
    }
  });
}
