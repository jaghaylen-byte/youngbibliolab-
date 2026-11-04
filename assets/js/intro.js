/* الشاشة الافتتاحية: شبكة نقاط وخطوط على خلفية زرقاء داكنة، بثلاث طبقات عمق،
   تتفاعل بسلاسة مع الفأرة أو اللمس، وتتخللها كلمات مرتبطة بحقوق الإنسان موصولة بالشبكة.
   مستقلة تمامًا عن app.js. لإيقافها: احذف عنصر #intro من index.html أو اجعل SHOW = false. */
(function () {
  "use strict";
  var SHOW = true;                 // false = إيقاف الشاشة الافتتاحية
  var ONCE_PER_SESSION = false;    // false = تظهر عند كل فتح أو تحديث للموقع؛ true = مرة واحدة فقط في كل جلسة تصفح
  var KEY = "yrl:intro-seen";
  // الكلمات المدمجة في الشبكة (يمكن تعديلها أو إضافة كلمات)
  var WORDS = ["Human Rights", "Freedom", "Dignity", "Justice", "Equality", "Liberty", "Democracy"];
  // مواضع الكلمات حول النص المركزي (نسبة من العرض والارتفاع) حتى لا تزدحم الواجهة
  var SLOTS = [[.17, .2], [.83, .17], [.09, .55], [.91, .5], [.24, .84], [.76, .86], [.5, .08]];

  var root = document.documentElement, el = document.getElementById("intro");
  if (!el) return;
  var seen = false; try { seen = ONCE_PER_SESSION && sessionStorage.getItem(KEY) === "1"; } catch (e) {}
  if (!SHOW || seen) { el.remove(); root.classList.remove("intro-on"); root.classList.add("intro-skip"); return; }
  root.classList.add("intro-on");

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1, pts = [], words = [], raf = 0, running = true, t0 = 0;
  var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false, k: 0 };
  var par = { x: 0, y: 0, tx: 0, ty: 0 };
  var R = 190, LINK = 170, FONT = 12;

  function spring(o) { o.ox = 0; o.oy = 0; o.vx2 = 0; o.vy2 = 0; return o; }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth; H = el.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    LINK = Math.min(230, Math.max(120, W / 6.8));
    R = Math.min(240, Math.max(140, W / 6));
    var small = W < 600;
    FONT = small ? 10.5 : 12.5;
    var n = Math.max(24, Math.min(90, Math.round(W * H / 15000)));
    pts = [];
    for (var i = 0; i < n; i++) {
      // depth: 0.3 = far (small, dim, slow) … 1 = near (large, bright, more parallax)
      var d = [0.32, 0.6, 1][i % 3] * (0.85 + Math.random() * 0.15);
      pts.push(spring({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .3 * d, vy: (Math.random() - .5) * .3 * d,
        r: (0.7 + Math.pow(Math.random(), 2) * 2.2) * (0.6 + d * 0.7), d: d }));
    }
    var list = small ? WORDS.slice(0, 5) : WORDS;
    var slots = small ? [[.2, .14], [.8, .2], [.16, .82], [.84, .78], [.5, .93]] : SLOTS;
    words = list.map(function (w, i) {
      ctx.font = "500 " + FONT + "px 'IBM Plex Sans Arabic', system-ui, sans-serif";
      return spring({ text: w, ax: slots[i][0] * W, ay: slots[i][1] * H, ph: Math.random() * 6.28, sp: 0.00018 + Math.random() * 0.00012,
        amp: small ? 10 : 18, d: 0.75 + (i % 2) * 0.25, tw: ctx.measureText(w).width, x: 0, y: 0 });
    });
    if (reduce) draw(0);
  }

  // smooth push away from the pointer, with a spring that brings each point back
  function react(o, px, py, strength) {
    var tx = 0, ty = 0;
    if (mouse.k > 0.01) {
      var dx = px - mouse.x, dy = py - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < R && dist > 0.5) { var f = Math.pow(1 - dist / R, 2) * strength * o.d * mouse.k; tx = dx / dist * f; ty = dy / dist * f; }
    }
    o.vx2 += (tx - o.ox) * 0.055; o.vy2 += (ty - o.oy) * 0.055;
    o.vx2 *= 0.84; o.vy2 *= 0.84;
    o.ox += o.vx2; o.oy += o.vy2;
  }
  function near(x, y) { // 0..1 closeness to the pointer
    if (mouse.k < 0.01) return 0;
    var dx = x - mouse.x, dy = y - mouse.y, d = Math.sqrt(dx * dx + dy * dy);
    return d < R ? (1 - d / R) * mouse.k : 0;
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    mouse.x += (mouse.tx - mouse.x) * 0.1; mouse.y += (mouse.ty - mouse.y) * 0.1;
    mouse.k += ((mouse.active ? 1 : 0) - mouse.k) * 0.05;
    par.x += (par.tx - par.x) * 0.045; par.y += (par.ty - par.y) * 0.045;
    var i, j, p, q;

    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      if (!reduce) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -30) p.x = W + 30; if (p.x > W + 30) p.x = -30; if (p.y < -30) p.y = H + 30; if (p.y > H + 30) p.y = -30;
        react(p, p.x, p.y, 46);
      }
      p.sx = p.x + p.ox + par.x * p.d * 34; p.sy = p.y + p.oy + par.y * p.d * 34;
    }
    for (i = 0; i < words.length; i++) {
      q = words[i];
      var ang = reduce ? q.ph : t * q.sp * 6.28 + q.ph;
      q.x = q.ax + Math.cos(ang) * q.amp; q.y = q.ay + Math.sin(ang * 1.3) * q.amp * 0.6;
      if (!reduce) react(q, q.x, q.y, 26);
      q.sx = q.x + q.ox + par.x * q.d * 34; q.sy = q.y + q.oy + par.y * q.d * 34;
    }

    // links between points: fainter for far layers, brighter near the pointer
    ctx.lineWidth = 1;
    var L2 = LINK * LINK;
    for (i = 0; i < pts.length; i++) {
      var A = pts[i];
      for (j = i + 1; j < pts.length; j++) {
        var B = pts[j], ex = A.sx - B.sx, ey = A.sy - B.sy, dd = ex * ex + ey * ey;
        if (dd < L2) {
          var depth = (A.d + B.d) / 2, glow = near((A.sx + B.sx) / 2, (A.sy + B.sy) / 2);
          var o = (1 - Math.sqrt(dd) / LINK) * (0.22 + depth * 0.38) + glow * 0.35;
          ctx.strokeStyle = glow > 0.05 ? "rgba(205,212,250," + Math.min(o, .9).toFixed(3) + ")" : "rgba(170,182,232," + o.toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
        }
      }
    }
    // words are tied into the network: lines to their nearest points
    for (i = 0; i < words.length; i++) {
      q = words[i];
      var cand = [];
      for (j = 0; j < pts.length; j++) {
        var wx = pts[j].sx - q.sx, wy = pts[j].sy - q.sy, wd = wx * wx + wy * wy;
        if (wd < L2 * 1.6) cand.push([wd, pts[j]]);
      }
      cand.sort(function (a, b) { return a[0] - b[0]; });
      var gw = near(q.sx, q.sy);
      for (j = 0; j < Math.min(4, cand.length); j++) {
        var cd = Math.sqrt(cand[j][0]), oo = (1 - cd / (LINK * 1.27)) * 0.5 + gw * 0.3;
        if (oo <= 0) continue;
        ctx.strokeStyle = "rgba(190,198,245," + oo.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(q.sx, q.sy); ctx.lineTo(cand[j][1].sx, cand[j][1].sy); ctx.stroke();
      }
    }
    // lines from the pointer to nearby points
    if (mouse.k > 0.01) {
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var mx = p.sx - mouse.x, my = p.sy - mouse.y, md = Math.sqrt(mx * mx + my * my);
        if (md < R) { ctx.strokeStyle = "rgba(215,222,252," + ((1 - md / R) * 0.5 * mouse.k * p.d).toFixed(3) + ")"; ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.sx, p.sy); ctx.stroke(); }
      }
    }
    // points: size and brightness follow depth
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      var g = near(p.sx, p.sy);
      ctx.fillStyle = "rgba(" + (176 + g * 50 | 0) + "," + (188 + g * 40 | 0) + ",236," + (0.35 + p.d * 0.5 + g * 0.2).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r * (1 + g * 0.6), 0, 6.283); ctx.fill();
    }
    // words: a node dot plus a small label that breathes softly
    ctx.font = "500 " + FONT + "px 'IBM Plex Sans Arabic', system-ui, sans-serif";
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    for (i = 0; i < words.length; i++) {
      q = words[i];
      var gl = near(q.sx, q.sy), br = reduce ? 0.7 : 0.62 + Math.sin(t * 0.0009 + q.ph) * 0.14;
      var a = Math.min(1, br + gl * 0.35);
      ctx.fillStyle = "rgba(16,28,111,.72)";
      var pw = q.tw + 16, ph = FONT + 10;
      roundRect(q.sx - pw / 2, q.sy - ph / 2, pw, ph, ph / 2); ctx.fill();
      ctx.strokeStyle = "rgba(180,190,245," + (0.25 + gl * 0.45).toFixed(3) + ")"; ctx.stroke();
      ctx.fillStyle = "rgba(226,230,255," + a.toFixed(3) + ")";
      ctx.fillText(q.text, q.sx, q.sy + 0.5);
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -1.571, 1.571);
    ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, 1.571, 4.712); ctx.closePath();
  }
  function loop(t) { if (!running) return; if (!t0) t0 = t; draw(t - t0); raf = requestAnimationFrame(loop); }

  function point(x, y) {
    var r = el.getBoundingClientRect();
    mouse.tx = x - r.left; mouse.ty = y - r.top; mouse.active = true;
    if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    par.tx = (mouse.tx / W - 0.5) * -2; par.ty = (mouse.ty / H - 0.5) * -2;
  }
  el.addEventListener("pointermove", function (e) { point(e.clientX, e.clientY); }, { passive: true });
  el.addEventListener("pointerdown", function (e) { point(e.clientX, e.clientY); }, { passive: true });
  el.addEventListener("pointerleave", function () { mouse.active = false; par.tx = 0; par.ty = 0; });

  var done = false;
  function enter() {
    if (done) return; done = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
    el.classList.add("leaving");
    // let the page know, so the homepage network can assemble as the welcome screen fades
    setTimeout(function () { try { document.dispatchEvent(new CustomEvent("yrl:intro-leave")); } catch (e) {} }, reduce ? 0 : 280);
    var finish = function () {
      running = false; cancelAnimationFrame(raf);
      el.remove(); root.classList.remove("intro-on");
      var main = document.getElementById("main"); if (main) { try { main.focus({ preventScroll: true }); } catch (e) { main.focus(); } }
    };
    setTimeout(finish, reduce ? 350 : 1150);
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
  // redraw the static frame once fonts are ready so the words use the right typeface
  if (reduce && document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!done) draw(0); });
})();
