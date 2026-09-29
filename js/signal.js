/* ============================================================
   SIGNAL.JS - generative channel media + WebGL signal-lock shader
   - GenCanvas: DPR-aware 2D canvases that only run while started.
       revenant : "calibration chamber" - bootstrap draws fall through a
                  Galton board into a histogram against the frozen true
                  lift; a hash-chained audit log conveyor refuses edits.
       replay   : "trace scope" - five recorded runs braid into a contract;
                  the live run is traced by a beam and diverges (or locks).
     Reduced motion gets one composed still frame.
   - Signal: one WebGL canvas that re-projects the active channel
     (video or generative canvas) through a CRT: barrel, cursor lens,
     chromatic split, scanlines, and a tear/static burst on tune.
   Exposes window.PSFX for the inline engine in index.html.
   ============================================================ */
(function () {
  'use strict';

  var AMBER = '255,166,61', GLOW = '255,206,133', TEAL = '52,226,214', PAPER = '234,232,224', MUTE = '135,141,152', FAINT = '84,90,101';
  var MONO = '"IBM Plex Mono",monospace', DISP = '"Bricolage Grotesque",serif';
  var BG = '#07080B';
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function rgba(c, a) { return 'rgba(' + c + ',' + a + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += '0123456789abcdef'[(Math.random() * 16) | 0]; return s; }
  function pad(n, l) { return String(n).padStart(l, '0'); }
  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 }; }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function outCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function font(g, px, weight, fam) { g.font = (weight || 500) + ' ' + px.toFixed(1) + 'px ' + (fam || MONO); }

  // soft light sprites, drawn additively
  var sprites = {};
  function sprite(rgb) {
    if (sprites[rgb]) return sprites[rgb];
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(rgb, 1)); gr.addColorStop(0.18, rgba(rgb, 0.55)); gr.addColorStop(0.5, rgba(rgb, 0.12)); gr.addColorStop(1, rgba(rgb, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (sprites[rgb] = c);
  }
  function glow(g, rgb, x, y, r, a) {
    if (a <= 0.01) return;
    g.globalAlpha = Math.min(1, a); g.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
  }

  // Where the visual content lives. On the desktop stage a channel is full-bleed behind the copy,
  // so keep clear of the text on the left and the tuner on the right.
  function region(el, w, h) {
    if (document.body.classList.contains('stage') && el.closest('.scene--work') && w > 900) {
      return box(w * 0.46, h * 0.19, w - Math.max(200, w * 0.13), h - 118);
    }
    var px = Math.max(14, w * 0.05), py = Math.max(14, h * 0.07);
    return box(px, py, w - px, h - py);
  }
  function grid(g, w, h, step) {
    g.strokeStyle = 'rgba(255,255,255,0.028)'; g.lineWidth = 1; g.beginPath();
    for (var x = 0; x <= w; x += step) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
    for (var y = 0; y <= h; y += step) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
    g.stroke();
  }
  function wash(g, w, h, rgb, x, y, r, a) { // a big faint atmospheric bloom behind the piece
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(rgb, a)); gr.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }

  /* ---------------- GenCanvas ---------------- */
  var registry = [];
  function GenCanvas(canvas, painter) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.p = painter;
    this.st = { el: canvas }; this.on = false; this.raf = null; this.t = 0; this.last = 0; this.w = 0; this.h = 0; this.dpr = 1;
    var self = this; this._tick = function (ts) { self.tick(ts); };
    registry.push(this);
  }
  GenCanvas.prototype.resize = function () {
    // layout size, not the painted rect: scenes dolly/scale in, and that must not shrink the backing store
    var w = Math.max(1, this.c.offsetWidth), h = Math.max(1, this.c.offsetHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr; this.st.dpr = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.st.geo = null;
    if (!this.on || reduce) this.still();
  };
  GenCanvas.prototype.still = function () { if (this.w > 1) this.p(this.g, this.w, this.h, 12, 0, this.st, true); };
  GenCanvas.prototype.start = function () {
    if (this.on) return; this.on = true; this.resize();
    if (reduce) { this.still(); return; }
    this.last = 0; this.raf = requestAnimationFrame(this._tick);
  };
  GenCanvas.prototype.stop = function () { this.on = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; };
  GenCanvas.prototype.tick = function (ts) {
    if (!this.on) return;
    var dt = this.last ? Math.min((ts - this.last) / 1000, 0.05) : 0.016; this.last = ts; this.t += dt;
    if (this.w < 2) this.resize();
    if (this.w > 1) this.p(this.g, this.w, this.h, this.t, dt, this.st, false);
    this.raf = requestAnimationFrame(this._tick);
  };
  var rT = null;
  window.addEventListener('resize', function () {
    clearTimeout(rT); rT = setTimeout(function () { registry.forEach(function (gc) { gc.resize(); }); Signal.resize(); }, 120);
  });
  document.addEventListener('visibilitychange', function () {
    registry.forEach(function (gc) {
      if (document.hidden) { if (gc.raf) { cancelAnimationFrame(gc.raf); gc.raf = null; } }
      else if (gc.on && !gc.raf && !reduce) { gc.last = 0; gc.raf = requestAnimationFrame(gc._tick); }
    });
  });

  /* ================= REVENANT - calibration chamber ================= */
  var LAND = 360; // draws per calibration cycle (shown scaled to the real 2,000 runs)
  function binom(n) { var row = [1]; for (var i = 0; i < n; i++) { var nx = [1]; for (var j = 1; j <= i; j++) nx.push(row[j - 1] + row[j]); nx.push(1); row = nx; } var s = Math.pow(2, n); return row.map(function (v) { return v / s; }); }

  function paintRevenant(g, w, h, t, dt, st, still) {
    var R = region(st.el, w, h);
    var fs = clamp(R.w / 48, 8, 11.5), lh = fs * 1.55, small = R.w < 440;
    var NR = small ? 9 : 12;

    // ---- geometry (cached per size) ----
    var G = st.geo;
    if (!G || G.NR !== NR) {
      G = st.geo = { NR: NR };
      G.top = R.y0 + lh * 2.1;
      G.boardH = R.h * 0.34;
      G.dy = G.boardH / NR;
      G.dx = Math.min(R.w * 0.84 / (NR + 1), G.dy * 1.7);
      G.cx = R.x0 + R.w * 0.5;
      G.binTop = G.top + G.boardH + G.dy * 0.2;
      G.binBot = R.y0 + R.h * 0.64;
      G.pegs = [];
      for (var r = 0; r < NR; r++) for (var j = 0; j <= r; j++) G.pegs.push([G.cx + (j - r / 2) * G.dx, G.top + r * G.dy + G.dy * 0.5]);
      G.expect = binom(NR);
      G.cap = LAND * G.expect[NR >> 1] * 1.18;
      if (!st.bins || st.bins.length !== NR + 1) { st.bins = new Float32Array(NR + 1); st.disp = new Float32Array(NR + 1); st.flash = new Float32Array(NR + 1); st.ps = []; st.spawned = 0; st.landed = 0; st.phase = 0; st.hold = 0; st.q1 = NR * 0.3; st.q2 = NR * 0.7; }
      st.hit = new Float32Array(G.pegs.length).fill(-9);
    }
    var pegIndex = function (r, j) { return r * (r + 1) / 2 + j; };

    // ---- simulation ----
    if (still && st.phase === 0) {
      for (var k = 0; k <= NR; k++) { st.bins[k] = Math.round(LAND * G.expect[k] * (0.92 + ((k * 7) % 5) * 0.03)); st.disp[k] = st.bins[k]; }
      st.landed = LAND; st.phase = 1; st.hold = 2;
    }
    if (!still) {
      if (st.phase === 0) {
        var want = Math.min(LAND - st.spawned, Math.floor((st.acc = (st.acc || 0) + dt * 46)));
        if (want > 0) { st.acc -= want; for (var s = 0; s < want; s++) { st.ps.push({ r: -1, j: 0, nj: 0, f: Math.random() * 0.4, sp: 7.5 + Math.random() * 2.5 }); st.spawned++; } }
      }
      // each draw hops peg to peg: r = row it leaves, j = its column there, nj = where it lands next
      for (var i = st.ps.length - 1; i >= 0; i--) {
        var p = st.ps[i];
        p.f += dt * p.sp;
        while (p.f >= 1) {
          p.f -= 1; p.r++; p.j = p.nj;
          if (p.r >= NR) { st.bins[p.j]++; st.flash[p.j] = 1; st.landed++; st.ps.splice(i, 1); break; }
          st.hit[pegIndex(p.r, p.j)] = t;
          p.nj = p.j + (Math.random() < 0.5 ? 0 : 1);
        }
      }
      if (st.phase === 0 && st.landed >= LAND) { st.phase = 1; st.hold = 0; }
      else if (st.phase === 1) {
        st.hold += dt;
        if (st.hold > 4.4) { st.phase = 2; st.hold = 0; }
      } else if (st.phase === 2) { // drain and restart
        st.hold += dt;
        for (k = 0; k <= NR; k++) st.bins[k] = 0;
        if (st.hold > 0.7) { st.phase = 0; st.spawned = 0; st.landed = 0; st.ps.length = 0; }
      }
      for (k = 0; k <= NR; k++) { st.disp[k] += (st.bins[k] - st.disp[k]) * Math.min(1, dt * (st.phase === 2 ? 9 : 14)); st.flash[k] *= Math.exp(-dt * 6); }
    }

    // ---- draw ----
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    wash(g, w, h, AMBER, G.cx, G.binBot, R.w * 0.7, 0.07);
    wash(g, w, h, TEAL, G.cx, G.top, R.w * 0.5, 0.035);
    grid(g, w, h, Math.max(38, w / 30));
    g.textBaseline = 'top'; g.textAlign = 'left';

    // header + side readouts (the Galton triangle leaves both top corners free)
    font(g, fs); g.fillStyle = rgba(AMBER, 0.95); g.fillText('REVENANT · CALIBRATION CHAMBER', R.x0, R.y0);
    var run = Math.min(2000, Math.round(st.landed / LAND * 2000));
    g.fillStyle = rgba(MUTE, 0.95);
    g.fillText('RUN ' + (run < 1000 ? '0' : '') + run.toLocaleString() + ' / 2,000', R.x0, G.top + lh * 0.2);
    if (!small) {
      g.fillStyle = rgba(FAINT, 1);
      g.fillText('HOLDOUT 50/50 · STRATIFIED', R.x0, G.top + lh * 1.3);
      g.fillText('BOOTSTRAP · 95% INTERVAL', R.x0, G.top + lh * 2.3);
    }
    // coverage readout, top right
    g.textAlign = 'right';
    if (st.phase === 1) {
      var cu = still ? 1 : outCubic(clamp(st.hold / 0.9, 0, 1)), jit = !still && st.hold < 0.35 ? (Math.random() - 0.5) * 6 : 0;
      font(g, fs * (small ? 2.4 : 3.3), 700, DISP);
      if (jit) { g.fillStyle = rgba(AMBER, 0.6); g.fillText((93.8 * cu).toFixed(1) + '%', R.x1 + jit, G.top - fs * 0.3); }
      g.fillStyle = rgba(TEAL, 1); g.fillText((93.8 * cu).toFixed(1) + '%', R.x1, G.top - fs * 0.3);
      font(g, fs); g.fillStyle = rgba(MUTE, 0.95);
      g.fillText('COVERAGE OF THE TRUE LIFT', R.x1, G.top + fs * (small ? 2.3 : 3.1));
      if (!small && st.hold > 1.1) { g.fillStyle = rgba(AMBER, 0.9); g.fillText('INTERVAL WAS 38% TOO WIDE → FIXED', R.x1, G.top + fs * 4.8); }
    } else {
      font(g, fs); g.fillStyle = rgba(AMBER, 0.85);
      g.fillText('CALIBRATING' + '...'.slice(0, 1 + ((t * 3) | 0) % 3), R.x1, G.top + lh * 0.2);
    }
    g.textAlign = 'left';

    // true-lift laser (frozen in code before any experiment runs)
    g.globalCompositeOperation = 'lighter';
    var lx = G.cx, flick = 0.85 + 0.15 * Math.sin(t * 13);
    g.strokeStyle = rgba(TEAL, 0.18 * flick); g.lineWidth = 6; g.beginPath(); g.moveTo(lx, G.top - G.dy); g.lineTo(lx, G.binBot); g.stroke();
    g.strokeStyle = rgba(TEAL, 0.85 * flick); g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(lx, G.top - G.dy); g.lineTo(lx, G.binBot); g.stroke(); g.setLineDash([]);
    glow(g, TEAL, lx, G.top - G.dy, 14, 0.8);
    g.globalCompositeOperation = 'source-over';
    font(g, fs * 0.92); g.fillStyle = rgba(TEAL, 0.95);
    g.fillText(small ? 'TRUE LIFT' : 'TRUE LIFT · FROZEN IN CODE', lx + 8, G.top - G.dy - fs * 0.4);

    // pegs
    for (var q = 0; q < G.pegs.length; q++) {
      var pg = G.pegs[q], e = clamp(1 - (t - st.hit[q]) / 0.32, 0, 1);
      g.fillStyle = e > 0 ? rgba(GLOW, 0.5 + e * 0.5) : 'rgba(234,232,224,0.22)';
      g.beginPath(); g.arc(pg[0], pg[1], 1.4 + e * 0.8, 0, 6.2832); g.fill();
    }
    // bins / histogram
    var cum = 0, tot = 0, bw = G.dx, qa = -1, qb = -1;
    for (k = 0; k <= NR; k++) tot += st.disp[k];
    for (k = 0; k <= NR; k++) { cum += st.disp[k]; if (qa < 0 && cum >= tot * 0.025) qa = k; if (qb < 0 && cum >= tot * 0.975) qb = k; }
    if (tot > 8) { st.q1 += (qa - st.q1) * Math.min(1, dt * 6 || 1); st.q2 += (qb - st.q2) * Math.min(1, dt * 6 || 1); }
    var hMax = G.binBot - G.binTop;
    for (k = 0; k <= NR; k++) {
      var bx = G.cx + (k - NR / 2) * G.dx - bw / 2, bh = Math.min(1, st.disp[k] / G.cap) * hMax;
      var inCI = tot > 8 && k >= Math.round(st.q1) && k <= Math.round(st.q2);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(bx + bw - 1, G.binTop, 1, hMax);
      if (bh > 0.5) {
        var gr = g.createLinearGradient(0, G.binBot - bh, 0, G.binBot);
        gr.addColorStop(0, rgba(AMBER, inCI ? 0.85 : 0.35)); gr.addColorStop(1, rgba(AMBER, inCI ? 0.18 : 0.06));
        g.fillStyle = gr; g.fillRect(bx + 2, G.binBot - bh, bw - 4, bh);
        g.fillStyle = rgba(GLOW, 0.5 + st.flash[k] * 0.5); g.fillRect(bx + 2, G.binBot - bh, bw - 4, 1.5);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(G.cx - (NR / 2 + 0.5) * G.dx, G.binBot, (NR + 1) * G.dx, 1);
    // falling draws
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < st.ps.length; i++) {
      p = st.ps[i];
      var ax, ay, bx2, by, f = p.f;
      if (p.r < 0) { ax = G.cx; ay = G.top - G.dy * 1.2; bx2 = G.pegs[0][0]; by = G.pegs[0][1] - 3; }
      else {
        var a0 = G.pegs[pegIndex(p.r, p.j)];
        ax = a0[0]; ay = a0[1] - 3;
        var nj = p.nj;
        if (p.r + 1 < NR) { var b0 = G.pegs[pegIndex(p.r + 1, nj)]; bx2 = b0[0]; by = b0[1] - 3; }
        else { bx2 = G.cx + (nj - NR / 2) * G.dx; by = G.binBot - Math.min(1, st.disp[nj] / G.cap) * hMax - 2; }
      }
      var px = ax + (bx2 - ax) * ease(f), py = ay + (by - ay) * f * f - Math.sin(Math.PI * f) * G.dy * 0.28;
      glow(g, AMBER, px, py, 7, 0.55);
      g.fillStyle = rgba(GLOW, 1); g.fillRect(px - 1, py - 1, 2, 2);
    }
    g.globalCompositeOperation = 'source-over';
    // interval bracket
    if (tot > 8) {
      var c0 = G.cx + (st.q1 - NR / 2) * G.dx - bw / 2 + 2, c1 = G.cx + (st.q2 - NR / 2) * G.dx + bw / 2 - 2, cy = G.binBot + lh * 0.55;
      g.strokeStyle = rgba(AMBER, 0.95); g.lineWidth = 1.2; g.beginPath();
      g.moveTo(c0, cy - 5); g.lineTo(c0, cy); g.lineTo(c1, cy); g.lineTo(c1, cy - 5); g.stroke();
      font(g, fs * 0.92); g.fillStyle = rgba(AMBER, 0.95); g.fillText('95% INTERVAL', c0, cy + 5);
    }

    // ---- hash-chained audit log: a receding conveyor; edits are refused ----
    var chTop = R.y0 + R.h * 0.79, chBot = R.y1;
    var bhc = clamp((chBot - chTop) * 0.74, 24, 58), bwc = bhc * 2.05;
    var fx = R.x1 - bwc, fy = chBot - bhc, vx = R.x0 + R.w * 0.04, vy = chTop - bhc * 0.25;
    var push = function () {
      var prev = st.chain.length ? st.chain[st.chain.length - 1].h : hex(8);
      st.chain.push({ h: hex(8), p: prev, i: st.idx++, b: t }); if (st.chain.length > 11) st.chain.shift();
    };
    if (!st.chain) { st.chain = []; st.idx = 4207; for (k = 0; k < 9; k++) push(); st.chain.forEach(function (b) { b.b = -9; }); st.off = 0; st.spawn = 0.6; st.tamper = null; st.tt = 2.6; }
    if (!still) {
      st.spawn += dt; if (st.spawn > 1.55) { st.spawn = 0; push(); st.off = 1; }
      st.off = Math.max(0, st.off - dt * 2.6);
      st.tt -= dt;
      if (st.tt <= 0) { st.tt = 4 + Math.random() * 2.5; var pick = st.chain[st.chain.length - 3 - ((Math.random() * 3) | 0)]; st.tamper = { k: pick.i, t: t }; }
    } else if (!st.tamper) st.tamper = { k: st.chain[st.chain.length - 3].i, t: t };
    font(g, fs * 0.88); g.fillStyle = rgba(FAINT, 1);
    g.fillText(small ? 'APPEND-ONLY AUDIT LOG' : 'APPEND-ONLY AUDIT LOG · HASH-CHAINED · POSTGRES REFUSES EDITS', R.x0, chTop - lh * 1.2);
    var N = st.chain.length, off = outCubic(st.off), refused = null, pos = [];
    for (var z = N - 1; z >= 0; z--) { // far to near
      var blk = st.chain[N - 1 - z], depth = Math.max(-0.5, z - off), sc = 1 / (1 + 0.36 * depth);
      var x = vx + (fx - vx) * sc, y = vy + (fy - vy) * sc, bw3 = bwc * sc, bh3 = bhc * sc;
      var al = clamp(sc * 1.25 - 0.15, 0, 1) * (z === 0 ? clamp(1 - st.off * 1.3, 0, 1) : 1);
      if (al <= 0.02) continue;
      pos[z] = [x, y, bw3, bh3, al];
      var tam = st.tamper && st.tamper.k === blk.i && (still || t - st.tamper.t < 1.4);
      var jx = tam && !still ? (Math.random() - 0.5) * 7 : 0;
      g.globalAlpha = al;
      g.fillStyle = tam ? 'rgba(255,166,61,0.12)' : '#0C0E14'; g.fillRect(x + jx, y, bw3, bh3);
      g.strokeStyle = tam ? rgba(AMBER, (still || ((t * 10) | 0) % 2) ? 1 : 0.4) : (z === 0 ? rgba(TEAL, 0.55) : 'rgba(255,255,255,0.16)');
      g.lineWidth = 1; g.strokeRect(x + jx + 0.5, y + 0.5, bw3 - 1, bh3 - 1);
      if (sc > 0.5) {
        var f2 = clamp(bh3 / 4.4, 6.5, 10.5);
        font(g, f2); g.fillStyle = rgba(PAPER, 0.92); g.fillText('#' + blk.i, x + jx + f2 * 0.7, y + f2 * 0.6);
        var age = t - blk.b;
        g.fillStyle = rgba(AMBER, 0.95); g.fillText('h ' + (age < 0.45 && !still ? hex(6) : blk.h.slice(0, 6)), x + jx + f2 * 0.7, y + f2 * 2);
        if (tam && jx) { g.fillStyle = rgba(TEAL, 0.5); g.fillText('#' + blk.i, x + jx * -1.4 + f2 * 0.7, y + f2 * 0.6); }
      }
      g.globalAlpha = 1;
      if (tam) refused = [x + bw3 / 2, y + bh3 / 2, bw3, t - st.tamper.t];
    }
    // links between consecutive blocks
    g.globalCompositeOperation = 'lighter';
    for (z = 1; z < N; z++) {
      var A = pos[z], B = pos[z - 1]; if (!A || !B) continue;
      var ya = A[1] + A[3] / 2, yb = B[1] + B[3] / 2;
      g.strokeStyle = rgba(TEAL, 0.45 * Math.min(A[4], B[4])); g.lineWidth = 1;
      g.beginPath(); g.moveTo(A[0] + A[2], ya); g.lineTo(B[0], yb); g.stroke();
      var tp = ((t * 0.9 + z * 0.37) % 1), px2 = A[0] + A[2] + (B[0] - A[0] - A[2]) * tp, py2 = ya + (yb - ya) * tp;
      glow(g, TEAL, px2, py2, 5, 0.6 * Math.min(A[4], B[4]));
    }
    if (st.off > 0.02 && pos[0]) glow(g, TEAL, pos[0][0] + pos[0][2] / 2, pos[0][1] + pos[0][3] / 2, pos[0][2] * 0.8, st.off * 0.5);
    if (refused) {
      var age2 = still ? 0.3 : refused[3], ring = outCubic(clamp(age2 / 0.7, 0, 1));
      g.strokeStyle = rgba(AMBER, 0.8 * (1 - ring)); g.lineWidth = 1.5;
      g.beginPath(); g.arc(refused[0], refused[1], refused[2] * (0.35 + ring * 0.9), 0, 6.2832); g.stroke();
      glow(g, AMBER, refused[0], refused[1], refused[2] * 0.6, 0.35 * (1 - ring));
    }
    g.globalCompositeOperation = 'source-over';
    if (refused) {
      font(g, fs, 600); g.fillStyle = rgba(AMBER, 1);
      var lbl = 'UPDATE ✕ REFUSED', lw = g.measureText(lbl).width;
      g.fillText(lbl, clamp(refused[0] - lw / 2, R.x0, R.x1 - lw), chTop - lh * 0.1 - (small ? 0 : lh * 0.2));
    }
  }

  /* ================= AGENT REPLAY - trace scope ================= */
  var SHORT = ['manifest', 'pkg boto3', 'pkg strands', 'pkg tools', 'vuln boto3', 'vuln strands', 'vuln tools'];
  var CALLS = ['read_manifest(requirements.txt)', 'get_package_info(boto3)', 'get_package_info(strands)', 'get_package_info(strands-tools)', 'check_vulnerabilities(boto3)', 'check_vulnerabilities(strands)', 'check_vulnerabilities(strands-tools)'];
  var SHAPE = [0.05, -0.62, -0.18, 0.44, -0.3, 0.72, -0.08];
  var FAIL = 5;

  function catmull(pts, n) { // smooth polyline through points
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var k = 0; k < n; k++) {
        var t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function stroke(g, pts, upto) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) { if (pts[i][0] > upto) { var a = pts[i - 1], b = pts[i], f = (upto - a[0]) / (b[0] - a[0] || 1); g.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); break; } g.lineTo(pts[i][0], pts[i][1]); }
    g.stroke();
  }
  function yAt(pts, x) { for (var i = 1; i < pts.length; i++) if (pts[i][0] >= x) { var a = pts[i - 1], b = pts[i], f = (x - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * f; } return pts[pts.length - 1][1]; }

  function paintReplay(g, w, h, t, dt, st, still) {
    var R = region(st.el, w, h);
    var fs = clamp(R.w / 52, 8, 11.5), lh = fs * 1.55, wide = R.w > 540, small = R.w < 440;

    // ---- cycle: sweep the live beam, then hold the verdict ----
    if (st.cyc == null) { st.cyc = 1; st.p = 0; st.res = 0; st.flash = new Float32Array(7).fill(-9); st.glitch = -9; }
    var fail = st.cyc % 2 === 1;
    if (still) { fail = true; st.p = 1; st.res = 1; }
    else if (st.res === 0) { st.p += dt * 0.17; if (st.p >= 1) { st.p = 1; st.res = 0.0001; } }
    else { st.res += dt; if (st.res > 3.2) { st.cyc++; st.p = 0; st.res = 0; st.flash.fill(-9); st.glitch = -9; } }

    // ---- geometry ----
    var yx0 = R.x0, yw = wide ? R.w * 0.4 : 0;
    var sx0 = wide ? R.x0 + yw + R.w * 0.04 : R.x0, sx1 = R.x1;
    var sy0 = R.y0 + lh * 2, sy1 = R.y0 + R.h * (small ? 0.62 : 0.66), mid = (sy0 + sy1) / 2, amp = (sy1 - sy0) * 0.34;
    var colX = function (s) { return sx0 + (s + 0.5) * (sx1 - sx0) / 7; };
    var nodes = SHAPE.map(function (v, s) { return [colX(s), mid + v * amp]; });
    var head = sx0 + (sx1 - sx0) * st.p;

    // ---- draw ----
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    wash(g, w, h, TEAL, (sx0 + sx1) / 2, mid, (sx1 - sx0) * 0.7, 0.05);
    grid(g, w, h, Math.max(38, w / 30));
    g.textBaseline = 'top'; g.textAlign = 'left';
    font(g, fs); g.fillStyle = rgba(AMBER, 0.95); g.fillText('AGENT-REPLAY · TRACE SCOPE', R.x0, R.y0);
    if (!small) { g.textAlign = 'right'; g.fillStyle = rgba(MUTE, 0.95); g.fillText('CONTRACT · 7 REQUIRED CALLS · 5 RUNS', R.x1, R.y0); g.textAlign = 'left'; }

    // scope graticule
    g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 1; g.strokeRect(sx0 + 0.5, sy0 + 0.5, sx1 - sx0 - 1, sy1 - sy0 - 1);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.setLineDash([2, 5]); g.beginPath();
    for (var s = 0; s < 7; s++) { g.moveTo(colX(s) + 0.5, sy0); g.lineTo(colX(s) + 0.5, sy1); }
    g.moveTo(sx0, mid + 0.5); g.lineTo(sx1, mid + 0.5); g.stroke(); g.setLineDash([]);
    font(g, fs * 0.85);
    var cwid = (sx1 - sx0) / 7, showNames = !small && g.measureText('vuln strands').width < cwid - 6;
    for (s = 0; s < 7; s++) {
      g.fillStyle = rgba(FAINT, 1); g.textAlign = 'center';
      g.fillText('S' + (s + 1), colX(s), sy1 + fs * 0.5);
      if (showNames) { g.fillStyle = rgba(MUTE, 0.8); g.fillText(SHORT[s], colX(s), sy1 + fs * 1.75); }
    }
    g.textAlign = 'left';

    // recorded runs: a braided bundle through the contract's nodes
    g.globalCompositeOperation = 'lighter';
    var lockGlow = !fail && st.res > 0 ? clamp(1 - st.res / 1.2, 0, 1) : 0;
    for (var r = 0; r < 5; r++) {
      var pts = [[sx0, mid]];
      for (s = 0; s < 7; s++) {
        var jig = Math.sin(t * 0.9 + r * 1.7 + s * 2.1) * amp * 0.07 + (r - 2) * amp * 0.025;
        pts.push([nodes[s][0], nodes[s][1] + jig * 0.35]);
        if (s < 6) pts.push([(nodes[s][0] + nodes[s + 1][0]) / 2, (nodes[s][1] + nodes[s + 1][1]) / 2 + jig]);
      }
      pts.push([sx1, mid]);
      g.strokeStyle = rgba(TEAL, 0.2 + lockGlow * 0.5); g.lineWidth = 1;
      stroke(g, catmull(pts, 8), sx1);
    }
    // contract nodes
    for (s = 0; s < 7; s++) {
      var n = nodes[s], fl = clamp(1 - (t - st.flash[s]) / 0.6, 0, 1), missing = fail && s === FAIL && head > n[0];
      if (missing) {
        var on = still || ((t * 5) | 0) % 2 === 0;
        g.strokeStyle = rgba(AMBER, on ? 1 : 0.35); g.lineWidth = 1.4; g.setLineDash([2, 3]);
        g.beginPath(); g.arc(n[0], n[1], 6.5, 0, 6.2832); g.stroke(); g.setLineDash([]);
        glow(g, AMBER, n[0], n[1], 22, on ? 0.35 : 0.12);
      } else {
        var hitN = head > n[0];
        g.fillStyle = hitN ? rgba(TEAL, 0.95) : BG; g.strokeStyle = rgba(TEAL, 0.9); g.lineWidth = 1.2;
        g.globalCompositeOperation = 'source-over';
        g.beginPath(); g.arc(n[0], n[1], 4, 0, 6.2832); g.fill(); g.stroke();
        g.globalCompositeOperation = 'lighter';
        glow(g, TEAL, n[0], n[1], 12 + fl * 26, 0.25 + fl * 0.75 + lockGlow * 0.6);
      }
    }

    // the live run, traced by the beam
    var live = [[sx0, mid]];
    for (s = 0; s < 7; s++) {
      var nn = nodes[s];
      if (fail && s === FAIL) live.push([nn[0], clamp(nn[1] + amp * (nn[1] < mid ? 1.3 : -1.3), sy0 + 6, sy1 - 6)]);
      else live.push(nn);
      if (s < 6) live.push([(nodes[s][0] + nodes[s + 1][0]) / 2, (live[live.length - 1][1] + nodes[s + 1][1]) / 2]);
    }
    live.push([sx1, mid]);
    var lp = catmull(live, 10);
    var liveCol = !fail && st.res > 0 ? TEAL : AMBER;
    g.strokeStyle = rgba(liveCol, 0.22); g.lineWidth = 6; stroke(g, lp, head);
    g.strokeStyle = rgba(liveCol, 0.95); g.lineWidth = 1.6; stroke(g, lp, head);
    if (st.res === 0) { var hy = yAt(lp, head); glow(g, GLOW, head, hy, 26, 0.95); glow(g, AMBER, head, hy, 60, 0.25); }
    // beam crossing a node: lock flash, or the divergence event
    for (s = 0; s < 7; s++) {
      if (head >= nodes[s][0] && st.flash[s] < -1 && !still) {
        st.flash[s] = t;
        if (fail && s === FAIL) st.glitch = t;
      }
    }
    var ge = still ? 0 : clamp(1 - (t - st.glitch) / 0.9, 0, 1);
    if (ge > 0) {
      var ring = outCubic(1 - ge), fn = nodes[FAIL];
      g.strokeStyle = rgba(AMBER, 0.9 * ge); g.lineWidth = 1.5;
      g.beginPath(); g.arc(fn[0], fn[1], 8 + ring * amp * 1.4, 0, 6.2832); g.stroke();
      glow(g, AMBER, fn[0], fn[1], amp, 0.4 * ge);
    }
    g.globalCompositeOperation = 'source-over';
    // divergence tear: shift slices of the scope for a beat
    if (ge > 0.55 && st.dpr) {
      var d = st.dpr;
      for (var k = 0; k < 5; k++) {
        var yy = sy0 + Math.random() * (sy1 - sy0 - 14), hh = 4 + Math.random() * 12, sh = (Math.random() - 0.5) * 26 * ge;
        g.drawImage(st.el, sx0 * d, yy * d, (sx1 - sx0) * d, hh * d, sx0 + sh, yy, sx1 - sx0, hh);
      }
    }

    // contract YAML, checked line by line as the beam passes
    if (wide) {
      var colW = yw, yfs = clamp(colW / 23, 7.5, 11), ylh = yfs * 1.58, yy0 = sy0;
      var lines = [['requires:', 'k', -1]];
      CALLS.forEach(function (c, i) { lines.push(['  - ' + c, '', i]); });
      lines.push(['order:', 'k', -1], ['  - read_manifest -> get_package_info', '', -1], ['  - get_package_info -> check_vulnerabilities', '', -1], ['runs: 5', 'k', -1]);
      font(g, yfs);
      lines.forEach(function (ln, k2) {
        var y = yy0 + k2 * ylh, si = ln[2];
        var passed = si >= 0 && head > nodes[si][0], miss = fail && si === FAIL && passed, cur = si >= 0 && st.res === 0 && head <= nodes[si][0] && (si === 0 || head > nodes[si - 1][0]);
        if (miss) { g.fillStyle = rgba(AMBER, 0.15); g.fillRect(yx0 - 5, y - 3, colW + 5, ylh); }
        else if (cur) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(yx0 - 5, y - 3, colW + 5, ylh); g.fillStyle = rgba(AMBER, 0.9); g.fillRect(yx0 - 5, y - 3, 2, ylh); }
        g.fillStyle = miss ? rgba(AMBER, 1) : ln[1] === 'k' ? rgba(TEAL, 0.9) : rgba(PAPER, passed ? 0.9 : 0.55);
        var txt = ln[0];
        if (miss && !still && ((t * 12) | 0) % 7 === 0) txt = txt.replace(/[aeiou]/g, function () { return '!<>/#'[(Math.random() * 5) | 0]; });
        g.fillText(txt, yx0, y);
        if (passed) { g.textAlign = 'right'; g.fillStyle = miss ? rgba(AMBER, 1) : rgba(TEAL, 0.95); g.fillText(miss ? '✕' : '✓', yx0 + colW - 2, y); g.textAlign = 'left'; }
      });
    }

    // verdict / live status
    var vy = sy1 + (small ? fs * 2 : fs * 3.4);
    if (st.res === 0) {
      var cur2 = 0; for (s = 0; s < 7; s++) if (head > nodes[s][0]) cur2 = s + 1;
      font(g, fs); g.fillStyle = rgba(PAPER, 0.85);
      var stat = '› replaying step ' + Math.min(7, cur2 + 1) + '/7', more = ' · ' + CALLS[Math.min(6, cur2)];
      if (g.measureText(stat + more).width <= sx1 - sx0) stat += more; // detail only when it fits the scope width
      g.fillText(stat, sx0, vy);
    } else {
      var big = fs * (small ? 1.25 : 1.6), head2 = fail ? 'FAIL · FIRST DIVERGENCE: STEP 6' : 'PASS · CONTRACT HELD';
      font(g, big, 700, DISP);
      while (g.measureText(head2).width > sx1 - sx0 && big > fs) { big *= 0.92; font(g, big, 700, DISP); }
      g.fillStyle = fail ? rgba(AMBER, 1) : rgba(TEAL, 1);
      g.fillText(head2, sx0, vy);
      font(g, fs); g.fillStyle = rgba(PAPER, 0.85);
      var det = fail ? 'MISSING_STEP check_vulnerabilities → PR blocked · exit 1' : 'exit 0 · merge allowed';
      if (g.measureText(det).width > sx1 - sx0) det = fail ? 'MISSING_STEP · exit 1' : 'exit 0';
      g.fillText(det, sx0, vy + big * 1.3);
    }

    // footer: the CI path, with a packet running it
    var fy = R.y1 - lh;
    font(g, fs * 0.88);
    if (small) { g.fillStyle = rgba(FAINT, 1); g.fillText('SET LOGIC, NOT AN LLM', R.x0, fy); return; }
    var hops = ['PR', 'ACTIONS', 'OIDC', 'AWS ROLE', 'VERDICT'], hx = R.x0, xs = [], i;
    hops.forEach(function (hp, i) {
      g.fillStyle = rgba(i === 4 ? (fail ? AMBER : TEAL) : MUTE, 0.9); g.fillText(hp, hx, fy);
      var wdt = g.measureText(hp).width; xs.push([hx, wdt]); hx += wdt + fs * 3.2;
    });
    g.globalCompositeOperation = 'lighter';
    var pk = (t * 0.45) % 1, seg = Math.min(3, Math.floor(pk * 4)), pf = pk * 4 - seg;
    var ax = xs[seg][0] + xs[seg][1] + 5, bx = xs[seg + 1][0] - 5;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (i = 0; i < 4; i++) g.fillRect(xs[i][0] + xs[i][1] + 5, fy + fs * 0.5, xs[i + 1][0] - xs[i][0] - xs[i][1] - 10, 1);
    glow(g, TEAL, ax + (bx - ax) * pf, fy + fs * 0.5, 8, 0.9);
    g.globalCompositeOperation = 'source-over';
    var tag = '339 PYTEST · SET LOGIC, NOT AN LLM';
    if (hx + g.measureText(tag).width < R.x1) { g.textAlign = 'right'; g.fillStyle = rgba(FAINT, 1); g.fillText(tag, R.x1, fy); g.textAlign = 'left'; }
  }

  var PAINTERS = { revenant: paintRevenant, replay: paintReplay };

  /* ---------------- Signal: WebGL CRT re-projection of the active channel ---------------- */
  var Signal = (function () {
    var cv = null, gl = null, U = {}, src = null, poster = null, host = null, raf = null, running = false, dead = false;
    var S = { tear: 0, vel: 0, mx: -4, my: -4, tmx: -4, tmy: -4 }, t0 = performance.now(), crisp = false;
    var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    var FS = [
      'precision mediump float;',
      'varying vec2 v;',
      'uniform sampler2D uTex;uniform vec2 uRes,uSrc,uMouse;uniform float uTime,uTear,uVel;',
      'float h1(float n){return fract(sin(n)*43758.5453);}',
      'float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
      'vec2 cover(vec2 uv){float ar=uRes.x/uRes.y,as=uSrc.x/uSrc.y;vec2 s=ar>as?vec2(1.,as/ar):vec2(ar/as,1.);return (uv-.5)*s+.5;}',
      'void main(){',
      '  vec2 uv=v;float t=uTime;',
      '  float amt=clamp(uTear+uVel*.45,0.,1.);',
      '  vec2 c=uv-.5;float d=dot(c,c);',
      '  uv=.5+c*(1.+d*(.03+.22*amt));',
      '  vec2 m=uv-uMouse;m.x*=uRes.x/uRes.y;float lens=smoothstep(.24,0.,length(m));',
      '  uv-=(uv-uMouse)*.06*lens;',
      '  float rows=14.+70.*amt;float band=floor(uv.y*rows);',
      '  float pick=step(1.-amt*.85,h1(band*13.1+floor(t*18.)));',
      '  uv.x+=(h1(band+floor(t*24.))-.5)*.22*amt*pick;',
      '  uv.x+=sin(uv.y*38.+t*9.)*.0035*amt;',
      '  uv.y=fract(uv.y+uTear*uTear*.16*sin(t*2.7));',
      '  float ab=.0012+.018*amt+.006*lens;',
      '  vec3 col;',
      '  col.r=texture2D(uTex,cover(uv+vec2(ab,0.))).r;',
      '  col.g=texture2D(uTex,cover(uv)).g;',
      '  col.b=texture2D(uTex,cover(uv-vec2(ab,0.))).b;',
      '  col*=.93+.07*sin(gl_FragCoord.y*3.14159);',
      '  float n=h2(gl_FragCoord.xy+fract(t*37.)*vec2(97.,57.));',
      '  col=mix(col,vec3(n),.55*uTear+.035*amt);',
      '  col+=pick*amt*vec3(1.,.65,.24)*.12;',
      '  col*=step(0.,uv.x)*step(uv.x,1.);',
      '  col*=1.-d*.85;',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n');

    function compile(type, s) {
      var sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('[signal]', gl.getShaderInfoLog(sh)); return null; }
      return sh;
    }
    function init() {
      if (cv) return !!gl;
      cv = document.createElement('canvas'); cv.className = 'ch-gl'; cv.setAttribute('aria-hidden', 'true');
      try { gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
      if (!gl) return false;
      var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) { gl = null; return false; }
      var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
      gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uTex', 'uRes', 'uSrc', 'uMouse', 'uTime', 'uTear', 'uVel'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([7, 8, 11, 255]));
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.uniform1i(U.uTex, 0); gl.uniform2f(U.uSrc, 1, 1);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); dead = true; gl = null; if (cv.parentNode) cv.parentNode.removeChild(cv); });
      window.addEventListener('mousemove', function (e) {
        if (!host) return; var r = cv.getBoundingClientRect(); if (!r.width) return;
        S.tmx = (e.clientX - r.left) / r.width; S.tmy = 1 - (e.clientY - r.top) / r.height;
      }, { passive: true });
      document.addEventListener('mouseleave', function () { S.tmx = S.tmy = -4; }); // lens rests off-screen
      return true;
    }
    function isReady(el) {
      if (!el) return false;
      if (el.tagName === 'VIDEO') return el.readyState >= 2 && el.videoWidth > 0;
      if (el.tagName === 'IMG') return el.complete && el.naturalWidth > 0;
      return el.width > 1;
    }
    function sizeOf(el) {
      if (el.tagName === 'VIDEO') return [el.videoWidth, el.videoHeight];
      if (el.tagName === 'IMG') return [el.naturalWidth, el.naturalHeight];
      return [el.width, el.height];
    }
    function resize() {
      if (!gl || !host) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(2, Math.round(host.offsetWidth * dpr)), h = Math.max(2, Math.round(host.offsetHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
    }
    function attach(media, source, posterImg) {
      host = media; src = source; poster = posterImg || null;
      // generative panels carry small type: the CRT pass plays over the tune, then steps aside so they stay crisp
      crisp = !!source && source.tagName === 'CANVAS';
      media.insertBefore(cv, media.querySelector('.ch-scan'));
      resize();
    }
    function frame() {
      if (!running || !gl) return;
      S.mx += (S.tmx - S.mx) * 0.08; S.my += (S.tmy - S.my) * 0.08; S.vel *= 0.93;
      var show = !crisp || S.tear > 0.02 || S.vel > 0.05;
      if (show !== !cv.classList.contains('rest')) cv.classList.toggle('rest', !show);
      if (!show) { raf = requestAnimationFrame(frame); return; }
      var el = isReady(src) ? src : (isReady(poster) ? poster : null);
      if (el) {
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); var sz = sizeOf(el); gl.uniform2f(U.uSrc, sz[0], sz[1]); } catch (e) {}
      }
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform2f(U.uMouse, S.mx, S.my);
      gl.uniform1f(U.uTime, (performance.now() - t0) / 1000);
      gl.uniform1f(U.uTear, S.tear); gl.uniform1f(U.uVel, S.vel);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!gl || running || !host) return; running = true; resize(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    function tune(media, source, posterImg) {
      if (!gl || dead) return;
      if (!host || !window.gsap) { attach(media, source, posterImg); S.tear = 0.7; if (window.gsap) window.gsap.to(S, { tear: 0, duration: 0.8, ease: 'power3.out' }); return; }
      if (host === media) return;
      window.gsap.killTweensOf(S, 'tear');
      window.gsap.timeline()
        .to(S, { tear: 1, duration: 0.16, ease: 'power2.in' })
        .add(function () { attach(media, source, posterImg); })
        .to(S, { tear: 0, duration: 0.85, ease: 'power3.out' });
    }
    function kick(v) { S.vel = Math.max(S.vel, clamp(v, 0, 1)); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } } else if (running && !raf) raf = requestAnimationFrame(frame); });
    return { init: init, start: start, stop: stop, tune: tune, kick: kick, resize: resize, ok: function () { return !!gl && !dead; } };
  })();

  window.PSFX = {
    gen: function (canvas) {
      if (!canvas || canvas._gen) return canvas && canvas._gen;
      var p = PAINTERS[canvas.dataset.gen]; if (!p) return null;
      canvas._gen = new GenCanvas(canvas, p); return canvas._gen;
    },
    signal: Signal
  };
})();
