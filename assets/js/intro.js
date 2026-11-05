/* الشاشة الافتتاحية: شبكة نقاط وخطوط موزّعة بانتظام على خلفية زرقاء ليلية، تتموّج بهدوء،
   تسري على خطوطها نبضات ضوء، وتتفاعل بنعومة مع الفأرة، وتتخللها كلمات مرتبطة بحقوق الإنسان.
   الشبكة تخفّ خلف النص حتى يبقى مقروءًا. مستقلة تمامًا عن app.js.
   لإيقافها: احذف عنصر #intro من index.html أو اجعل SHOW = false. */
(function () {
  "use strict";
  var SHOW = true;                 // false = إيقاف الشاشة الافتتاحية
  var ONCE_PER_SESSION = false;    // false = تظهر عند كل فتح أو تحديث للموقع؛ true = مرة واحدة فقط في كل جلسة تصفح
  var KEY = "yrl:intro-seen";
  // الكلمات المدمجة في الشبكة ومواضعها (نسبة من العرض والارتفاع)؛ على الهاتف تُعرض الخمس الأولى
  // كل الكلمات تمرّ بالتناوب: عدد محدود ظاهر في كل لحظة، وكل بضع ثوانٍ تُستبدل كلمة بأخرى
  var WORDS = ["Human Rights", "Dignity", "Freedom", "Justice", "Equality", "Democracy", "Rule of Law", "Expression",
    "Non-discrimination", "Accountability", "Privacy", "Fair Trial", "Education", "Health",
    "Women's Rights", "Children's Rights", "Asylum", "Anti-Torture", "Solidarity", "Peace"];
  var SLOTS = [[.15, .17], [.85, .15], [.09, .5], [.91, .52], [.2, .86], [.8, .86], [.5, .06], [.5, .95]];
  var SLOTS_SMALL = [[.24, .08], [.76, .13], [.24, .9], [.76, .86], [.5, .96]];
  var SWAP_EVERY = 2400, FADE = 0.035;

  var root = document.documentElement, el = document.getElementById("intro");
  if (!el) return;
  var seen = false; try { seen = ONCE_PER_SESSION && sessionStorage.getItem(KEY) === "1"; } catch (e) {}
  if (!SHOW || seen) { el.remove(); root.classList.remove("intro-on"); root.classList.add("intro-skip"); return; }
  root.classList.add("intro-on");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1, pts = [], words = [], links = [], pulses = [], raf = 0, running = true, t0 = 0, lastSpawn = 0, lastSwap = 0, nextWord = 0, lastSlot = -1;
  var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false, k: 0 };
  var par = { x: 0, y: 0, tx: 0, ty: 0 };
  var R = 200, LINK = 150, FONT = 12, CX = 0, CY = 0, EX = 1, EY = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth; H = el.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var small = W < 600;
    // balanced density: a jittered grid, so points never clump or leave holes
    var cell = small ? 74 : Math.max(84, Math.min(110, Math.sqrt(W * H / 120)));
    LINK = cell * 1.62; R = Math.min(230, Math.max(150, W / 6.5)); FONT = small ? 10.5 : 12.5;
    var cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
    pts = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var d = [0.4, 0.7, 1][(r * 7 + c * 3) % 3];
      pts.push({ ax: (c - .5 + Math.random()) * cell, ay: (r - .5 + Math.random()) * cell, d: d,
        a1: 10 + Math.random() * 16, a2: 8 + Math.random() * 14, f1: (0.6 + Math.random() * .6) / 10000, f2: (0.5 + Math.random() * .6) / 10000,
        p1: Math.random() * 6.28, p2: Math.random() * 6.28, r: (0.8 + Math.pow(Math.random(), 2) * 1.9) * (0.6 + d * 0.6), ox: 0, oy: 0, vx: 0, vy: 0 });
    }
    // the area behind the text, where the network thins out
    CX = W / 2; CY = H / 2; EX = Math.min(W * 0.42, 520); EY = Math.min(H * 0.3, 270);
    var slots = small ? SLOTS_SMALL : SLOTS;
    ctx.font = "500 " + FONT + "px 'IBM Plex Sans Arabic', system-ui, sans-serif";
    words = slots.map(function (sl, i) {
      return { text: WORDS[i], ax: sl[0] * W, ay: sl[1] * H, ph: Math.random() * 6.28, sp: 0.00016 + Math.random() * 0.0001, amp: small ? 8 : 14,
        d: 0.8, tw: ctx.measureText(WORDS[i]).width, al: 1, to: 1, ox: 0, oy: 0, vx: 0, vy: 0 };
    });
    nextWord = slots.length % WORDS.length;
    pulses = [];
    if (reduce) draw(0);
  }
  function clearZone(x, y) { // 0 inside the text area .. 1 outside
    var nx = (x - CX) / EX, ny = (y - CY) / EY, q = nx * nx + ny * ny;
    return q >= 1 ? 1 : 0.18 + 0.82 * q * q;
  }
  function react(o, px, py, s) {
    var tx = 0, ty = 0;
    if (mouse.k > 0.01) {
      var dx = px - mouse.x, dy = py - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < R && dist > 0.5) { var f = Math.pow(1 - dist / R, 2) * s * o.d * mouse.k; tx = dx / dist * f; ty = dy / dist * f; }
    }
    o.vx += (tx - o.ox) * 0.05; o.vy += (ty - o.oy) * 0.05; o.vx *= 0.85; o.vy *= 0.85; o.ox += o.vx; o.oy += o.vy;
  }
  function near(x, y) { if (mouse.k < 0.01) return 0; var dx = x - mouse.x, dy = y - mouse.y, d = Math.sqrt(dx * dx + dy * dy); return d < R ? (1 - d / R) * mouse.k : 0; }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    mouse.x += (mouse.tx - mouse.x) * 0.1; mouse.y += (mouse.ty - mouse.y) * 0.1;
    mouse.k += ((mouse.active ? 1 : 0) - mouse.k) * 0.05;
    par.x += (par.tx - par.x) * 0.04; par.y += (par.ty - par.y) * 0.04;
    var i, j, p, q, L2 = LINK * LINK;

    // pointer light: a soft pool of light under the cursor
    if (mouse.k > 0.01) {
      var g0 = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, R * 1.2);
      g0.addColorStop(0, "rgba(150,140,255," + (0.13 * mouse.k).toFixed(3) + ")"); g0.addColorStop(1, "rgba(150,140,255,0)");
      ctx.fillStyle = g0; ctx.fillRect(mouse.x - R * 1.2, mouse.y - R * 1.2, R * 2.4, R * 2.4);
    }
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      var wx = reduce ? 0 : Math.sin(t * p.f1 * 6.28 + p.p1) * p.a1, wy = reduce ? 0 : Math.cos(t * p.f2 * 6.28 + p.p2) * p.a2;
      p.x = p.ax + wx; p.y = p.ay + wy;
      if (!reduce) react(p, p.x, p.y, 38);
      p.sx = p.x + p.ox + par.x * p.d * 26; p.sy = p.y + p.oy + par.y * p.d * 26;
      p.z = clearZone(p.sx, p.sy);
    }
    for (i = 0; i < words.length; i++) {
      q = words[i];
      var ang = reduce ? q.ph : t * q.sp * 6.28 + q.ph;
      q.x = q.ax + Math.cos(ang) * q.amp; q.y = q.ay + Math.sin(ang * 1.3) * q.amp * 0.6;
      if (!reduce) react(q, q.x, q.y, 22);
      q.sx = q.x + q.ox + par.x * q.d * 26; q.sy = q.y + q.oy + par.y * q.d * 26;
      var half = q.tw / 2 + 17; q.sx = Math.max(half, Math.min(W - half, q.sx));
      if (!reduce) {
        q.al += (q.to - q.al) * FADE * 2;
        if (q.to === 0 && q.al < 0.02) { // swap in the next word once this one has faded out
          q.text = WORDS[nextWord]; nextWord = (nextWord + 1) % WORDS.length;
          ctx.font = "500 " + FONT + "px 'IBM Plex Sans Arabic', system-ui, sans-serif"; q.tw = ctx.measureText(q.text).width; q.to = 1;
        }
      }
    }
    if (!reduce && t - lastSwap > SWAP_EVERY && t > 3000) {
      var pick = (Math.random() * words.length) | 0; if (pick === lastSlot) pick = (pick + 1) % words.length;
      if (words[pick].al > 0.95) { words[pick].to = 0; lastSlot = pick; lastSwap = t; }
    }
    // links
    links = []; ctx.lineWidth = 1;
    for (i = 0; i < pts.length; i++) {
      var A = pts[i];
      for (j = i + 1; j < pts.length; j++) {
        var B = pts[j], ex = A.sx - B.sx, ey = A.sy - B.sy, dd = ex * ex + ey * ey;
        if (dd < L2) {
          var k = 1 - Math.sqrt(dd) / LINK, depth = (A.d + B.d) / 2, glow = near((A.sx + B.sx) / 2, (A.sy + B.sy) / 2);
          var o = (k * (0.12 + depth * 0.3) + glow * 0.4) * Math.min(A.z, B.z);
          if (o < 0.015) continue;
          ctx.strokeStyle = glow > 0.05 ? "rgba(214,210,255," + Math.min(o, .85).toFixed(3) + ")" : "rgba(169,178,238," + o.toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
          if (k > 0.25 && A.z > 0.6 && B.z > 0.6) links.push([A, B]);
        }
      }
    }
    // words tied into the network
    for (i = 0; i < words.length; i++) {
      q = words[i];
      var cand = [];
      for (j = 0; j < pts.length; j++) { var vx = pts[j].sx - q.sx, vy = pts[j].sy - q.sy, wd = vx * vx + vy * vy; if (wd < L2 * 1.4) cand.push([wd, pts[j]]); }
      cand.sort(function (a, b) { return a[0] - b[0]; });
      var gw = near(q.sx, q.sy);
      for (j = 0; j < Math.min(3, cand.length); j++) {
        var oo = ((1 - Math.sqrt(cand[j][0]) / (LINK * 1.2)) * 0.42 + gw * 0.3) * cand[j][1].z * q.al;
        if (oo <= 0) continue;
        ctx.strokeStyle = "rgba(196,200,248," + oo.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(q.sx, q.sy); ctx.lineTo(cand[j][1].sx, cand[j][1].sy); ctx.stroke();
      }
    }
    // pulses of light running along links: knowledge moving between references
    if (!reduce) {
      if (t - lastSpawn > 420 && pulses.length < (W < 600 ? 4 : 8) && links.length) {
        var L = links[(Math.random() * links.length) | 0], fw = Math.random() < .5;
        pulses.push({ a: fw ? L[0] : L[1], b: fw ? L[1] : L[0], s: t, dur: 1500 + Math.random() * 1200 });
        lastSpawn = t;
      }
      for (i = pulses.length - 1; i >= 0; i--) {
        var P = pulses[i], u = (t - P.s) / P.dur;
        if (u >= 1) { pulses.splice(i, 1); continue; }
        var e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, fade = Math.sin(u * Math.PI);
        var px = P.a.sx + (P.b.sx - P.a.sx) * e, py = P.a.sy + (P.b.sy - P.a.sy) * e;
        var tx2 = P.a.sx + (P.b.sx - P.a.sx) * Math.max(0, e - .18), ty2 = P.a.sy + (P.b.sy - P.a.sy) * Math.max(0, e - .18);
        var lg = ctx.createLinearGradient(tx2, ty2, px, py);
        lg.addColorStop(0, "rgba(230,226,255,0)"); lg.addColorStop(1, "rgba(236,232,255," + (0.75 * fade).toFixed(3) + ")");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(px, py); ctx.stroke(); ctx.lineWidth = 1;
        var rg = ctx.createRadialGradient(px, py, 0, px, py, 7);
        rg.addColorStop(0, "rgba(255,255,255," + (0.9 * fade).toFixed(3) + ")"); rg.addColorStop(1, "rgba(190,180,255,0)");
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 7, 0, 6.283); ctx.fill();
      }
    }
    // pointer lines
    if (mouse.k > 0.01) {
      for (i = 0; i < pts.length; i++) {
        p = pts[i]; var mx = p.sx - mouse.x, my = p.sy - mouse.y, md = Math.sqrt(mx * mx + my * my);
        if (md < R * .8) { ctx.strokeStyle = "rgba(220,216,255," + ((1 - md / (R * .8)) * 0.42 * mouse.k * p.d * p.z).toFixed(3) + ")"; ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.sx, p.sy); ctx.stroke(); }
      }
    }
    // points
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; var g = near(p.sx, p.sy), al = (0.3 + p.d * 0.5 + g * 0.3) * (0.35 + p.z * 0.65);
      if (g > 0.15) { ctx.fillStyle = "rgba(170,160,255," + (g * 0.18).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r * 4.5, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = "rgba(" + (190 + g * 50 | 0) + "," + (196 + g * 40 | 0) + ",245," + al.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r * (1 + g * 0.5), 0, 6.283); ctx.fill();
    }
    // words
    ctx.font = "500 " + FONT + "px 'IBM Plex Sans Arabic', system-ui, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    for (i = 0; i < words.length; i++) {
      q = words[i]; var gl = near(q.sx, q.sy), br = reduce ? 0.72 : 0.64 + Math.sin(t * 0.0008 + q.ph) * 0.12, a = Math.min(1, br + gl * 0.35);
      var pw = q.tw + 18, ph = FONT + 11, k2 = q.al;
      if (k2 < 0.01) continue;
      ctx.fillStyle = "rgba(12,20,84," + (0.78 * k2).toFixed(3) + ")"; rr(q.sx - pw / 2, q.sy - ph / 2, pw, ph, ph / 2); ctx.fill();
      ctx.strokeStyle = "rgba(184,190,240," + ((0.24 + gl * 0.45) * k2).toFixed(3) + ")"; ctx.stroke();
      ctx.fillStyle = "rgba(230,232,255," + (a * k2).toFixed(3) + ")"; ctx.fillText(q.text, q.sx, q.sy + 0.5);
    }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -1.571, 1.571); ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, 1.571, 4.712); ctx.closePath(); }
  function loop(t) { if (!running) return; if (!t0) t0 = t; draw(t - t0); raf = requestAnimationFrame(loop); }

  function point(x, y) {
    var b = el.getBoundingClientRect();
    mouse.tx = x - b.left; mouse.ty = y - b.top; mouse.active = true;
    if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    par.tx = (mouse.tx / W - 0.5) * -2; par.ty = (mouse.ty / H - 0.5) * -2;
  }
  el.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") point(e.clientX, e.clientY); }, { passive: true });
  el.addEventListener("pointerleave", function () { mouse.active = false; par.tx = 0; par.ty = 0; });

  var done = false;
  function enter() {
    if (done) return; done = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
    el.classList.add("leaving");
    // let the page know, so the homepage network can assemble as the welcome screen fades
    setTimeout(function () { try { document.dispatchEvent(new CustomEvent("yrl:intro-leave")); } catch (e) {} }, reduce ? 0 : 280);
    setTimeout(function () {
      running = false; cancelAnimationFrame(raf); el.remove(); root.classList.remove("intro-on");
      var m = document.getElementById("main"); if (m) { try { m.focus({ preventScroll: true }); } catch (e) { m.focus(); } }
    }, reduce ? 350 : 1150);
  }
  el.addEventListener("click", enter);
  document.addEventListener("keydown", function (e) { if (!done && (e.key === "Enter" || e.key === " " || e.key === "Escape")) { e.preventDefault(); enter(); } });
  document.addEventListener("visibilitychange", function () {
    if (done || reduce) return;
    if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running) { running = true; raf = requestAnimationFrame(loop); }
  });
  window.addEventListener("resize", function () { if (!done) resize(); });
  resize();
  if (!reduce) raf = requestAnimationFrame(loop);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!done) { resize(); if (reduce) draw(0); } });
})();
