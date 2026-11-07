/* The agent crew: five cursors (layout, type, media, ui, qa) build the home page in front of the visitor as they
   scroll, coordinated by mini Mervin. Every target is tagged and hidden before the first paint; the nearest free cursor
   flies to it and reveals it (wipe, drop or pop with the Web Animations API, never `transform`: GSAP owns that).
   Opening: a fourth screen after the three lines, where he brings the crew out of his laptop. He is the real .mascot;
   the crew only reads his box and, for the opening and the finish, holds him at a point through api.hold.
   If anything throws, bail() reveals the whole page and removes the overlay.

   startCrew(el, api) takes the .mascot element and the engine's api, and returns a function that stops it. */
export function startCrew(el, api) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const html = document.documentElement;

  /* ================= config: agents, timings ================= */
  const FEET = 0.985;   // where mini Mervin's feet sit, as a fraction of his height (same as the engine's)
  const SEP = 70;       // minimum gap between free cursors, px (idle ones keep at least 64)
  const EASE_OUT = "cubic-bezier(.16,1,.3,1)", POP = "cubic-bezier(.34,1.56,.64,1)";

  // The fourth opening screen. The three lines end at ~8.7 s; home.js (crew-on) finishes at ~12.8 s.
  const T_OUT = 8.6, JUMP = 0.65, T_CREW = T_OUT + JUMP + 0.3, T_FORM = 12.0;
  // beats, in seconds (base values; the hero's long queues, qa's checks and a heavy backlog scale them down). After the
  // hero the reveal runs at these lengths from the moment its cursor arrives; only the marquee's growth (0.1 s) is shorter.
  const D = { drag: 0.16, wipe: 0.26, drop: 0.3, pop: 0.22, hold: 0.2 };
  const FLY = 13, FLY_STIFF = 17, FLY_SCROLL = 26;   // flight spring w: the hero, the hero with a queue, everything after it

  // dir/spd: orbit direction and angular speed (rad/s); fx/fy: where in the radius range its ellipse sits (0..1);
  // burst: the direction (deg) it flies out of mini Mervin's laptop; orbit: its idle ring radius (70..130)
  const AGENTS = [
    { id: "layout", color: "#1d1b18", burst: -125, dir: 1,  spd: 0.42, fx: 0.35, fy: 0.80, orbit: 84 },
    { id: "type",   color: "#0071e3", burst: -55,  dir: -1, spd: 0.66, fx: 0.90, fy: 0.30, orbit: 104 },
    { id: "media",  color: "#9a6233", burst: -165, dir: 1,  spd: 0.36, fx: 0.60, fy: 1.00, orbit: 130 },
    { id: "ui",     color: "#1f7a3d", burst: -15,  dir: -1, spd: 0.58, fx: 0.15, fy: 0.55, orbit: 70 },
    { id: "qa",     color: "#b3261e", burst: -90,  dir: 1,  spd: 0.50, fx: 0.75, fy: 0.15, orbit: 116 },
  ];

  /* ================= helpers ================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mk = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const V = (x, y) => ({ x: clamp(x, 8, innerWidth - 8), y: clamp(y, 8, innerHeight - 8) });   // keep cursors on screen
  const dragEase = (u) => 1 - (1 - u) ** 3;

  // CSS cubic-bezier as a function, so a cursor can ride the same curve the wipe uses
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 24; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; if (e > 0) hi = t; else lo = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  const wipeEase = bezier(0.16, 1, 0.3, 1);

  // Critically damped spring, solved exactly (same ODE as a = w*w*(target - x) - 2*w*v) so it is stable at any dt
  function spring(p, v, target, w, dt) {
    const d = p - target, e = Math.exp(-w * dt), j = v + w * d;
    return [target + (d + j * dt) * e, (v - w * j * dt) * e];
  }

  const CURSOR_PATH = "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z";   // Lucide mouse-pointer-2
  const PRESS = [{ scale: 1 }, { scale: 0.85, offset: 0.2 }, { scale: 0.85, offset: 0.65 }, { scale: 1 }];

  /* ================= state ================= */
  const S = { phase: "boot", dead: false, t0: 0, last: 0, loadingSeen: false, scanAt: 0, scrollY: 0, scrollV: 0, downAt: -1e9, moveAt: 0, jump: false, held: [], crewSet: false, backlog: 0 };
  const intro = { out: false, formed: false, say1: false };
  const recs = new Set();    // build targets still hidden
  const anims = new Set();   // running Web Animations, cancelled on bail
  // his box in viewport px, read from the real element each frame (from the held point while the crew holds him);
  // shown = he is on screen, script = the finish jump, bubTop = his bubble's top edge
  const merv = { vx: 0, vy: 0, S: 108, shown: false, script: null, bubTop: 0 };
  const bubble = el.querySelector(".say");
  let root, crew, units, heroU, hero, io, bodyObs, raf;
  const compactMQ = matchMedia("(max-width: 960px)");

  /* ================= overlay DOM ================= */
  function buildOverlay() {
    root = mk("div", "crew-root");
    root.setAttribute("aria-hidden", "true");
    // marquees first, cursors after, so a cursor is never under a box
    crew = AGENTS.map((d, i) => {
      const mq = mk("div", "crew-mq", root), chip = mk("span", "crew-mqc", mq);
      mq.style.setProperty("--ac", d.color); mq.style.setProperty("--ac6", hexA(d.color, 0.06));
      return { ...d, i, side: i % 2 ? -1 : 1, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, w: 4.5, q: [], task: null, free: false,
        out: false, outAt: null, outT: 0, outV: 800, th0: i * 2.513 + 0.4, idle: false, cw: 0, flipX: false, flipY: false,
        mq: { el: mq, chip, on: false, fading: false, fadeS: 0.2, a: 0, p: 1, box: null, bw: 1.5, cw: 0 } };
    });
    crew.forEach((a) => {
      a.el = mk("div", "crew-cur", root);
      a.el.dataset.a = a.id; a.el.style.setProperty("--ac", a.color); a.el.style.visibility = "hidden";   // hidden until it comes out of mini Mervin
      const NS = "http://www.w3.org/2000/svg", path = document.createElementNS(NS, "path");
      a.svg = document.createElementNS(NS, "svg");
      a.svg.setAttribute("viewBox", "0 0 24 24"); a.svg.setAttribute("aria-hidden", "true");
      path.setAttribute("d", CURSOR_PATH); a.svg.appendChild(path); a.el.appendChild(a.svg);
      a.chip = mk("span", "crew-chip", a.el); a.chip.textContent = a.id;
    });
    document.body.appendChild(root);
  }

  /* ================= build plan: units and tasks ================= */
  // task = { el, agent, kind: wipe | drop | click | follow | check | sweep }; unit = a group the crew builds together.
  // A sweep (after the hero only) is one task over a card or row: parts = the element tasks it builds top to bottom in one
  // pass, each with its own rec and reveal kind; el = the container, for the marquee's label.
  function plan() {
    const U = [], by = (id) => crew.find((a) => a.id === id);
    const tk = (el, agent, kind, o) => el && { el, agent: by(agent), kind, ...o };
    const sweep = (agent, el, parts) => {
      parts = parts.filter(Boolean);
      if (parts.length < 2) return parts[0];   // nothing to sweep: a plain task
      const s = { el: el || parts[0].el, agent: by(agent), kind: "sweep", parts };
      parts.forEach((p) => { p.sweep = s; });
      return s;
    };
    const leaves = (t) => t.parts || [t];
    const add = (name, trigger, tasks, o = {}) => {
      tasks = tasks.filter(Boolean);
      if (!trigger || !tasks.length) return;
      const u = { name, trigger, tasks, els: tasks.flatMap((t) => leaves(t).map((p) => p.el)), started: false, pending: 0, checked: false, ...o };
      tasks.forEach((t) => { t.unit = u; t.over = false; leaves(t).forEach((p) => { p.unit = u; p.over = false; }); });
      U.push(u);
    };
    const header = (name, sec) => add(name, $(".sh", sec), [tk($(".sh", sec), "layout", "wipe")]);

    hero = $(".hero");
    add("hero", hero, [
      tk($(".det .frame", hero), "media", "drop"),    // first: the detector scan starts ~0.3 s after finish
      tk($(".det figcaption", hero), "media", "wipe"),
      tk($("h1.display", hero), "type", "follow"),    // revealed at once; its cursor rides the caret while the name types
      tk($("p.intro", hero), "type", "wipe"),
      tk($(".bar", hero), "layout", "wipe"),
      tk($("p.role", hero), "layout", "wipe"),
      tk($("p.loc", hero), "layout", "wipe"),
      ...$$(".ctas .btn", hero).map((b) => tk(b, "ui", "click")),
      tk($(".social", hero), "ui", "drop"),
      tk($(".cue", hero), "ui", "drop"),
    ], { isHero: true, grace: 2600 });   // grace: the name takes ~2.4 s to type

    const about = $("#about");
    add("about", about, [
      tk($(".sh", about), "layout", "wipe"),
      tk($(".lead", about), "type", "wipe"),
      sweep("ui", $(".side dl", about), $$(".side dl > div", about).map((r) => tk(r, "ui", "wipe"))),
      tk($(".side .btn", about), "ui", "click"),
    ]);

    const skills = $("#skills");
    header("skills header", skills);
    $$("article.skill", skills).forEach((s, i) => add(`skill ${i + 1}`, s, [
      tk($(".viz", s), "media", "drop"),
      sweep("type", $(".txt", s), [
        tk($(".txt h3", s), "type", "wipe"),
        tk($(".txt > p:not(.built)", s), "type", "wipe"),
        tk($(".tags", s), "ui", "drop"),
        tk($(".built", s), "ui", "wipe"),
      ]),
    ]));

    const work = $("#work");
    header("work header", work);
    $$(".tiles a.tile", work).forEach((t, i) => add(`tile ${i + 1}`, t, [
      sweep("media", t, [tk($(".mat", t), "media", "drop"), tk($(".row", t), "layout", "wipe"), tk($(".one", t), "type", "wipe")]),
    ]));

    const xp = $("#experience");
    header("experience header", xp);
    $$(".xrow", xp).forEach((r, i) => add(`experience ${i + 1}`, r, [
      sweep("type", r, [tk($(".meta", r), "type", "wipe"), tk($(".co", r), "layout", "wipe"), tk($(":scope > p:last-child", r), "type", "wipe")]),
    ]));

    const hon = $('section[aria-labelledby="hon-h"]');
    if (hon) {
      header("competitions header", hon);
      $$(".wgrid > div", hon).forEach((c, i) => add(`award ${i + 1}`, c, [
        c.classList.contains("lead-win") ? sweep("layout", c, [tk(c, "layout", "wipe"), tk($("img", c), "media", "drop")]) : tk(c, "layout", "wipe"),
      ]));
    }

    const certs = $("section.certs");
    if (certs) {
      header("certifications header", certs);
      $$(".cert-card", certs).forEach((c, i) => add(`certificate ${i + 1}`, c, [tk(c, "media", "drop")]));
      add("all certificates", $(".more", certs), [tk($(".more .btn", certs), "ui", "click")]);
    }

    add("tools belt", $(".belt-wrap"), [tk($(".belt-wrap"), "media", "drop", { pad: true })]);   // pad: leave its top padding out of the box

    const foot = $("footer.contact");
    add("footer", foot, [   // the footer's dark background stays put
      tk($("h2", foot), "type", "wipe"),
      ...$$(".pills .btn", foot).map((b) => tk(b, "ui", "click")),
      tk($(".foot", foot), "layout", "wipe"),
    ]);

    // hide every target before the browser paints React's output
    U.forEach((u) => u.tasks.forEach((t) => leaves(t).forEach((p) => {
      p.rec = { el: p.el, task: p, unit: u, state: "hidden", seen: 0 };
      p.el.setAttribute("data-crew", "");
      recs.add(p.rec);
    })));
    return U;
  }

  /* ================= boxes ================= */
  function boxOf(t) {
    if (t.kind === "check") return unitBox(t.unit);
    if (t.kind === "sweep") return union(t.parts.map((p) => p.el));   // the whole card or row
    const r = t.el.getBoundingClientRect();
    if (t.pad && t.padTop == null) t.padTop = parseFloat(getComputedStyle(t.el).paddingTop) || 0;
    const p = t.pad ? t.padTop : 0;
    return { l: r.left, t: r.top + p, w: r.width, h: Math.max(0, r.height - p) };
  }
  function union(els) {
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const el of els) {
      const q = el.getBoundingClientRect();
      if (!q.width && !q.height) continue;
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    return r < l ? null : { l, t, w: r - l, h: b - t };
  }
  const unitBox = (u) => union(u.els);
  const caretBox = () => { const c = $(".hero .display .cursor"); if (!c) return null; const r = c.getBoundingClientRect(); return { l: r.right, t: r.top, w: 0, h: r.height }; };
  const inView = (b) => b.t < innerHeight - 4 && b.t + b.h > 24;   // a cursor starts the moment an element's top edge shows
  const labelOf = (el) => { const c = [...el.classList].find((n) => !n.startsWith("crew-")); return el.tagName.toLowerCase() + (c ? "." + c : ""); };

  /* ================= mini Mervin ================= */
  // He is the real .mascot, walked about by the engine. The crew reads his box every frame, and in the opening and the finish
  // holds him at a viewport point through api.hold (the engine puts him exactly there, then lets go when it is null).
  const restPos = (sz) => ({ x: innerWidth / 2 - sz / 2, y: innerHeight * 0.5 + 34 - sz * FEET });   // opening screen 4: centred, feet a little below the middle
  const torso = () => ({ x: merv.vx + merv.S / 2, y: merv.vy + merv.S * 0.58 });   // around his laptop
  // while held the point is his box already (the engine applies it in the same frame, or once its pose art has loaded)
  const hold = (x, y, pose, left = false) => { api.hold = { x, y, pose, left }; merv.vx = x; merv.vy = y; };
  const release = () => { api.hold = null; merv.script = null; };

  function mervStep(dt, now) {
    const m = merv, sz = el.offsetWidth || (compactMQ.matches ? 68 : 108), r = el.getBoundingClientRect();
    m.S = sz; m.vx = r.left; m.vy = r.top;
    m.shown = !!api.hold || (!el.hidden && el.style.visibility === "visible");
    if (api.open && api.hold) release();   // his window opened in the opening or the finish jump: let go so it can be clicked
    const end = m.script && api.heroSpot();
    if (S.phase === "intro") {
      // screen 4: jumps up from below the bottom edge, meets the crew, then points them at the hero
      if (!api.open) {
        const T = (now - S.t0) / 1000, rest = restPos(sz);
        let iy = rest.y, pose = "jump";
        if (T < T_OUT) iy = innerHeight + 30;   // waiting below the screen
        else if (T < T_OUT + JUMP) { const u = (T - T_OUT) / JUMP; iy = lerp(innerHeight + 30, rest.y, 1 - (1 - u) ** 3) - Math.sin(u * Math.PI) * 90; }
        else pose = T < T_CREW ? "land" : T < T_FORM ? "laptop" : "point";
        hold(rest.x, iy, pose);
      }
    }
    else if (end) {
      // finish: a beat at the centre if he never came out, then the jump to his hero spot and a landing; then the engine has him
      const sc = m.script, lf = end.x < sc.fx;
      sc.t += dt;
      if (sc.kind === "beat") { hold(sc.fx, sc.fy, "idle"); if (sc.t >= 0.35) { sc.kind = "jump"; sc.t = 0; } }
      else if (sc.kind === "jump") {
        const u = Math.min(1, sc.t / JUMP);
        hold(lerp(sc.fx, end.x, u), lerp(sc.fy, end.y, u) - Math.sin(u * Math.PI) * 90, "jump", lf);
        if (u >= 1) { sc.kind = "land"; sc.t = 0; }
      }
      else { hold(end.x, end.y, "land", lf); if (sc.t >= 0.3) release(); }
    }
    else if (api.hold || m.script) release();   // no hero spot to jump to: let go where he is
    m.bubTop = m.vy - (bubble.offsetHeight || 29);   // his bubble's top edge, for the formation arc
  }

  /* ================= opening screen 4 and finish ================= */
  function introStep(now) {
    if (S.phase !== "intro") return;
    const T = (now - S.t0) / 1000;
    intro.out = T >= T_OUT;
    if (T >= T_CREW && !intro.say1) { intro.say1 = true; api.say("Meet my crew.", 1600); }
    if (T >= T_FORM && !intro.formed) { intro.formed = true; api.say("Okay crew, let's build it!", 2800); }
    if (!S.loadingSeen && T > 2) goLive();   // home.js never started its intro; do not wait for it
  }

  // crew members come out of his laptop one after another
  function scheduleCrew(start, step, v) { crew.forEach((a, i) => { a.outAt = start + step * i; a.outV = v; }); S.crewSet = true; }
  function emerge(a, now) {
    const c = torso(), ang = (a.burst * Math.PI) / 180;
    a.out = true; a.outT = now;
    a.x = c.x; a.y = c.y; a.vx = Math.cos(ang) * a.outV; a.vy = Math.sin(ang) * a.outV;   // full size, flung outward
    a.el.style.visibility = "visible"; a.el.style.opacity = ""; a.el.style.scale = "";
  }

  // body.loading removed (timer or skip): the crew launches to the hero, mini Mervin jumps to his spot.
  // With no opening (a #hash or a reload) he is already where the engine put him, and the crew pops out of him (see frame).
  function goLive() {
    if (S.phase === "live") return;
    const wasIntro = S.phase === "intro", now = performance.now(), m = merv;
    S.phase = "live";
    startUnit(heroU);
    if (wasIntro) {
      const early = !intro.out;   // skipped before he had come out
      crew.forEach((a, i) => { if (!a.out) { a.outAt = now + 30 * i; a.outV = 800; } });   // burst out of him straight to their tasks
      S.crewSet = true;
      const hb = hero.getBoundingClientRect();
      if (hb.bottom > 0 && hb.top < innerHeight && api.heroSpot()) {
        bubble.classList.remove("on");
        const from = early ? restPos(m.S) : { x: m.vx, y: m.vy };
        if (early) play(el, [{ opacity: 0 }, { opacity: 1 }], 300, "linear");   // he appears at the centre
        m.script = { kind: early ? "beat" : "jump", t: 0, fx: from.x, fy: from.y };
      }
      else release();
    }
    S.held.splice(0).forEach(startUnit);
  }

  /* ================= cursors ================= */
  function introTarget(a, now) {
    const T = (now - S.t0) / 1000, W = innerWidth, H = innerHeight, c = torso();
    a.free = true; a.w = 4.5;
    if (T >= T_FORM) {
      // a wide, shallow arc wholly above his bubble: the lowest chip ends 28 px above the bubble's top edge,
      // and the spacing is wider than a chip, so no chip touches the bubble or another chip
      const span = Math.min(520, 0.8 * W), gap = span / 4, k = a.i - 2, sag = 14, CHIP_B = 38;
      const yc = merv.bubTop - 28 - CHIP_B - sag;
      a.tx = clamp(c.x + k * gap - 33 + 3 * Math.sin(0.7 * T + a.i), 16, W - 16);   // -33: centre the tips-plus-chips block
      a.ty = clamp(yc + sag * (k / 2) ** 2 + 3 * Math.cos(0.6 * T + a.i * 1.3), 16, H - 16);
      a.w = 8;
      return;
    }
    // wide, flowing ellipses around him: each its own speed and direction, radii wobbling slowly
    a.w = lerp(4.5, 7.5, clamp(1 - (now - a.outT) / 1000, 0, 1));   // pulled in quicker just after coming out
    const Tr = T - T_CREW, phone = W <= 600;
    const rx = lerp((phone ? 0.35 : 0.3) * W, (phone ? 0.46 : 0.45) * W, a.fx) * (1 + 0.08 * Math.sin(0.55 * Tr + a.i * 1.7));
    const ry = lerp((phone ? 0.14 : 0.18) * H, (phone ? 0.24 : 0.32) * H, a.fy) * (1 + 0.1 * Math.sin(0.8 * Tr + a.i * 2.3));
    const th = a.th0 + a.dir * a.spd * Tr;
    a.tx = clamp(c.x + rx * Math.cos(th), 16, W - 16); a.ty = clamp(c.y + ry * Math.sin(th), 16, H - 16);
  }
  // nothing to build: while the reader scrolls down (and for 0.7 s after) wait on a "ready line" 70 px above the bottom
  // edge, spread across the width, where new content comes in, so the nearest cursor is never far from it. Otherwise
  // drift back toward him and loosely orbit. The ring is centred 110 px from him toward the middle of the screen, so
  // it never piles up against an edge, and all five share one slow angular speed with evenly spaced phases, so
  // neighbours never close up.
  function idleTarget(a, now) {
    if (S.phase === "live" && now - S.downAt < 700) {
      const idle = crew.filter((o) => o.out && !o.task);   // slots by index among the idle, so they cover the width
      a.tx = (innerWidth * (idle.indexOf(a) + 0.5)) / idle.length; a.ty = innerHeight - 70 + 8 * Math.sin(0.9 * (now / 1000) + a.i * 1.7);
      a.w = 6; a.free = true; a.idle = true;
      return;
    }
    const c = torso(), dx = innerWidth / 2 - c.x, dy = innerHeight / 2 - c.y, d = Math.hypot(dx, dy) || 1, k = Math.min(110, d) / d;
    const ang = (a.i * 2 * Math.PI) / 5 + 0.28 * (now / 1000), r = a.orbit + 6 * Math.sin(0.8 * (now / 1000) + a.i);
    a.tx = c.x + dx * k + r * Math.cos(ang); a.ty = c.y + dy * k + r * 0.85 * Math.sin(ang);
    a.w = 3.2; a.free = true; a.idle = true;
  }
  function aim(a, p, w) { a.tx = p.x; a.ty = p.y; a.w = w; }
  // A flight with a gentle arc: a sideways offset (12% of the way left) that fades as it arrives. While the page scrolls
  // the target moves, so a spring trails it by 2/w seconds; aim that far ahead of it and judge "arrived" by the speed
  // relative to the target, otherwise a flight at a scrolling element would never finish. Returns the target's velocity.
  function flyTo(a, t, p, dt) {
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
    if (!t.fly) t.fly = { d0: d, px: -dy / (d || 1), py: dx / (d || 1) };
    if (t.pp) {
      const mx = p.x - t.pp.x, my = p.y - t.pp.y;
      if (Math.hypot(mx, my) > 80) t.pv = null;   // a jump, not a scroll: do not extrapolate it
      else { const vx = mx / dt, vy = my / dt; t.pv = t.pv ? { x: lerp(t.pv.x, vx, 0.35), y: lerp(t.pv.y, vy, 0.35) } : { x: vx, y: vy }; }
    }
    t.pp = p;
    const pv = t.pv || { x: 0, y: 0 }, ahead = Math.min(2 / t.fw, 0.2), off = t.fly.d0 > 30 ? 0.12 * Math.min(d, t.fly.d0) * a.side : 0;
    aim(a, { x: p.x + t.fly.px * off + pv.x * ahead, y: p.y + t.fly.py * off + pv.y * ahead }, t.fw);
    return pv;
  }
  const arrived = (a, p, pv, tol) => Math.hypot(a.x - p.x, a.y - p.y) < tol[0] && Math.hypot(a.vx - pv.x, a.vy - pv.y) < tol[1];

  // work this cursor could take is on screen: a task after the hero in any queue (see near), or one in its own (qa's checks)
  const workFor = (a) => queued() || a.q.some((x) => { const b = boxOf(x); return b && inView(b); });
  // Phones: once the hero is built and the page has been still for 1.2 s, a cursor with nothing to do flies home into his
  // laptop, shrinking and fading as it arrives, and hides (as before it first came out); the desktop keeps its orbit.
  // It comes back out of him (see agentStep) when the page scrolls down or work shows up.
  function goHome(a, now) {
    if (a.task || innerWidth > 600 || S.phase !== "live" || heroU.pending > 0 || now - S.moveAt < 1200 || workFor(a)) {
      if (a.homing) { a.homing = false; a.el.style.opacity = ""; a.el.style.scale = ""; }
      return false;
    }
    const c = torso(), d = Math.hypot(a.x - c.x, a.y - c.y), f = clamp((d - 24) / 90, 0, 1);
    aim(a, c, 7); a.homing = true;
    a.el.style.opacity = f.toFixed(2); a.el.style.scale = (0.4 + 0.6 * f).toFixed(2);
    if (d < 24) { a.out = false; a.outAt = null; a.docked = true; a.homing = false; a.el.style.visibility = "hidden"; a.mq.on = false; a.mq.el.style.opacity = "0"; }
    return true;
  }
  function agentStep(a, dt, now) {
    a.free = false; a.idle = false;
    if (a.docked && (innerWidth > 600 || S.scrollV > 10 || workFor(a))) { a.docked = false; a.outAt = now + 70 * a.i; a.outV = 420; }   // out of his laptop again, one after another
    if (!a.out) { if (a.outAt != null && now >= a.outAt) emerge(a, now); else return; }
    if (S.phase === "intro") return introTarget(a, now);
    if (!a.task && !(a.q.length && pick(a)) && !steal(a)) near(a);   // looks for work every frame: a section that just scrolled in starts at once
    if (a.task) runTask(a, dt);
    if (!goHome(a, now) && !a.task) idleTarget(a, now);
  }
  // keep free cursors SEP apart: first their targets (so they settle apart), then a nudge for any that are close now.
  // Idle ones are also kept out of mini Mervin's box (+12 px, chip included) and 16 px inside the screen edges.
  function spread(f) {
    for (let it = 0; it < 3; it++) for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
      const a = f[i], b = f[j];
      let dx = a.tx - b.tx, dy = a.ty - b.ty, d = Math.hypot(dx, dy);
      if (d >= SEP) continue;
      if (d < 1) { dx = a.i - b.i; dy = 1; d = Math.hypot(dx, dy); }
      const push = (SEP - d) / 2 / d;
      a.tx += dx * push; a.ty += dy * push; b.tx -= dx * push; b.ty -= dy * push;
    }
  }
  // where to stand instead if (x, y) puts the cursor or its chip within 12 px of mini Mervin; null if it is clear.
  // The chip is on the cursor's right, or on its left where that would cross the screen edge (as place() does).
  function exitFrom(x, y, cw) {
    const m = merv, l = m.vx - 12, r = m.vx + m.S + 12, t = m.vy - 12, b = m.vy + m.S + 12;
    const hit = (px, py) => {
      const cl = px + 14 + cw > innerWidth - 4 && px - 14 - cw > 2 ? px - 14 - cw : px + 14;
      return Math.max(px + 20, cl + cw) > l && Math.min(px, cl) < r && py + 38 > t && py < b;
    };
    if (!hit(x, y)) return null;
    const opts = [[l - 14 - cw, y], [r, y], [x, t - 38], [x, b]]
      .map(([px, py]) => [clamp(px, 16, innerWidth - 16), clamp(py, 16, innerHeight - 16)]).filter(([px, py]) => !hit(px, py));
    if (!opts.length) return null;
    opts.sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y));
    return opts[0];
  }
  // The straight path to a target may run through him (the spring would just be ejected from his box and stick to its
  // edge, on top of whoever else is there): go round via the nearest free corner of the keep-out area instead.
  function detour(a) {
    const m = merv, cw = a.cw || 52, L = m.vx - 12 - 14 - cw, R = m.vx + m.S + 12, T = m.vy - 12 - 38, B = m.vy + m.S + 12;
    const hits = (x0, y0, x1, y1) => {   // does the segment cross the (slightly shrunk) rectangle?
      let t0 = 0, t1 = 1;
      const dx = x1 - x0, dy = y1 - y0;
      for (const [p, q] of [[-dx, x0 - (L + 1)], [dx, R - 1 - x0], [-dy, y0 - (T + 1)], [dy, B - 1 - y0]]) {
        if (p === 0) { if (q < 0) return false; continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      }
      return t0 < t1;
    };
    if (!hits(a.x, a.y, a.tx, a.ty)) return;
    let best = null;
    for (const [cx, cy] of [[L, T], [R, T], [L, B], [R, B]]) {
      const px = clamp(cx, 16, innerWidth - 16), py = clamp(cy, 16, innerHeight - 16);
      if (hits(a.x, a.y, px, py)) continue;
      const len = Math.hypot(a.x - px, a.y - py) + Math.hypot(px - a.tx, py - a.ty);
      if (!best || len < best.len) best = { px, py, len };
    }
    if (best) { a.tx = best.px; a.ty = best.py; }
  }
  function clearOfMerv(a) { const o = exitFrom(a.tx, a.ty, a.cw || 52); if (o) [a.tx, a.ty] = o; }
  function separate() {
    const f = crew.filter((a) => a.out && a.free), idle = f.filter((a) => a.idle), busy = crew.filter((a) => a.out && !a.free);
    spread(f);
    // the idle ring runs through his box: alternate "step out of it" and "keep apart" until they agree, so the
    // cursors that get pushed out end up spaced along his edge instead of stacked on it
    const keepOut = () => { for (const a of idle) { clearOfMerv(a); a.tx = clamp(a.tx, 16, innerWidth - 16); a.ty = clamp(a.ty, 16, innerHeight - 16); } };
    // a cursor that is busy building cannot move aside, so the idle ones keep clear of where it is
    const clearOfBusy = () => { for (const a of idle) for (const b of busy) {
      const dx = a.tx - b.x, dy = a.ty - b.y, d = Math.hypot(dx, dy);
      if (d < SEP) { const k = (SEP - d) / (d || 1); a.tx += (d ? dx : 1) * k; a.ty += dy * k; }
    } };
    for (let it = 0; it < 6; it++) { keepOut(); clearOfBusy(); spread(idle); }
    keepOut();
    for (const a of idle) detour(a);
    spread(idle);   // two detours can share a corner
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {   // any pair that is physically close right now
      const a = f[i], b = f[j];
      if (a.idle && b.idle) continue;   // idle pairs are already spaced by their targets
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      if (d >= SEP) continue;
      if (d < 1) { dx = a.i - b.i; dy = 1; d = Math.hypot(dx, dy); }
      const push = ((SEP - d) * 0.6) / d;
      a.tx += dx * push; a.ty += dy * push; b.tx -= dx * push; b.ty -= dy * push;
    }
  }
  function move(a, dt) {
    if (!isFinite(a.tx) || !isFinite(a.ty)) { a.tx = a.x; a.ty = a.y; }
    [a.x, a.vx] = spring(a.x, a.vx, a.tx, a.w, dt);
    [a.y, a.vy] = spring(a.y, a.vy, a.ty, a.w, dt);
  }
  // Guarantees for idle cursors, enforced on their actual positions every frame after the springs have moved them:
  // SEP apart (also from busy cursors, which cannot step aside), outside mini Mervin's box, 16 px inside the screen edges.
  function relax() {
    if (S.phase !== "live") return;
    const idle = crew.filter((a) => a.out && a.idle), busy = crew.filter((a) => a.out && !a.idle);
    if (!idle.length) return;
    const pair = (a, b, wa, wb) => {
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      if (d >= SEP) return;
      if (d < 0.5) { dx = a.i - b.i || 1; dy = 0.5; d = Math.hypot(dx, dy); }
      const k = (SEP - d) / d;
      a.x += dx * k * wa; a.y += dy * k * wa; b.x -= dx * k * wb; b.y -= dy * k * wb;
    };
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < idle.length; i++) {
        for (let j = i + 1; j < idle.length; j++) pair(idle[i], idle[j], 0.5, 0.5);
        for (const b of busy) pair(idle[i], b, 1, 0);
      }
      for (const a of idle) {
        const o = exitFrom(a.x, a.y, a.cw || 52);
        if (o) [a.x, a.y] = o;
        a.x = clamp(a.x, 16, innerWidth - 16); a.y = clamp(a.y, 16, innerHeight - 16);
      }
    }
  }
  function place(a) {
    a.el.style.transform = `translate3d(${a.x.toFixed(2)}px, ${a.y.toFixed(2)}px, 0)`;
    // the name chip flips to the left of the cursor (or above it) rather than crossing a screen edge; hysteresis stops flicker
    const cw = a.cw || (a.cw = a.chip.offsetWidth || 0), over = a.x + 14 + cw - innerWidth, under = a.y + 18 + 21 - innerHeight;
    if (!a.flipX && over > -4 && a.x - 14 - cw > 2) { a.flipX = true; a.el.classList.add("fx"); }
    else if (a.flipX && over < -28) { a.flipX = false; a.el.classList.remove("fx"); }
    if (!a.flipY && under > -2 && a.y - 30 > 2) { a.flipY = true; a.el.classList.add("fy"); }
    else if (a.flipY && under < -24) { a.flipY = false; a.el.classList.remove("fy"); }
  }

  /* ================= marquees ================= */
  function mqShow(a, t) {
    const m = a.mq, check = t.kind === "check", line = check || a.id === "qa";
    m.on = true; m.fading = false; m.a = 1; m.p = 0; m.cw = 0;
    m.fadeS = check ? 0.15 : 0.2; m.bw = line ? 1 : 1.5;
    m.box = check ? () => unitBox(t.unit) : () => boxOf(t);
    m.chip.textContent = check ? `✓ ${t.unit.name}` : labelOf(t.el);
    m.el.classList.toggle("crew-ck", line);   // qa: an outline only, no fill, for a check and for anything it builds
    m.el.classList.toggle("crew-inv", a.id === "layout" && !!t.unit.trigger.closest(".contact"));   // ink on the dark footer would vanish
  }
  const mqFade = (a) => { if (a.mq.on) a.mq.fading = true; };
  function mqRender(a, dt) {
    const m = a.mq;
    if (!m.on) return;
    if (m.fading && (m.a -= dt / m.fadeS) <= 0) { m.on = false; m.el.style.opacity = "0"; return; }
    const b = m.box();
    if (!b) { m.on = false; m.el.style.opacity = "0"; return; }
    m.el.style.transform = `translate3d(${b.l.toFixed(1)}px, ${b.t.toFixed(1)}px, 0)`;
    m.el.style.width = `${(b.w * m.p).toFixed(1)}px`; m.el.style.height = `${(b.h * m.p).toFixed(1)}px`;
    m.el.style.opacity = m.a.toFixed(2);
    // the chip sits above the top-left corner, or inside it at the top edge, and slides to stay on screen
    const inside = b.t < 22, cw = m.cw || (m.cw = m.chip.offsetWidth || 0);
    m.chip.classList.toggle("in", inside);
    m.chip.style.left = `${clamp(inside ? 0 : -m.bw, 4 - b.l, innerWidth - 4 - cw - b.l).toFixed(1)}px`;
    m.chip.style.top = inside ? `${Math.max(0, 4 - b.t).toFixed(1)}px` : "";
  }

  /* ================= task runner ================= */
  function play(el, kf, ms, easing) {
    const an = el.animate(kf, { duration: ms, easing, fill: "backwards" });
    anims.add(an);
    an.onfinish = an.oncancel = () => anims.delete(an);
    return an;
  }
  // only clip-path / opacity / scale / translate are animated, never `transform`, so GSAP's transforms are safe
  function reveal(t, how) {
    const rec = t.rec;
    if (!rec || rec.state === "done") return;
    rec.state = "done"; recs.delete(rec);
    const el = rec.el, k = t.k || 1;
    el.classList.add("crew-done");
    if (how === "now") return;
    if (t.kind === "wipe") play(el, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], D.wipe * 1000 * k, EASE_OUT);
    else if (t.kind === "drop") {   // a full-bleed element (the tools belt) skips the 1.03 scale so it never widens the page
      const wide = el.getBoundingClientRect().width > innerWidth - 40;
      play(el, [{ opacity: 0, scale: wide ? "1" : "1.03", translate: "0 -8px" }, { opacity: 1, scale: "1", translate: "0 0" }], D.drop * 1000 * k, EASE_OUT);
    }
    else play(el, [{ opacity: 0, scale: "0.94" }, { opacity: 1, scale: "1" }], D.pop * 1000 * k, POP);   // click: pops in
  }

  // After the hero a cursor always gets to its element first: it flies in on a stiff spring, and when it is close the
  // content starts building (phase "build": the marquee grows, the cursor rides the build edge, or moves on after 0.12 s
  // if another element is waiting and no cursor is free; the reveal plays out by itself). Beats stay at full
  // length (k 1) unless 6 or more unbuilt elements are on screen at once (a fast scroll through dense rows): then they
  // shorten (k 0.6) and "arrived" is judged more loosely, so content keeps up with reading. The hero's opening keeps
  // fly, drag, reveal and stays unhurried: n (how many hero tasks were queued for its owner) above 2 is what shortens
  // its beats. A qa check has nothing to reveal and keeps fly, drag, hold at short beats.
  function begin(a, t, n) {
    const opening = t.unit.isHero, heavy = S.backlog >= 6 && !opening, brisk = !opening || n > 2, build = !opening && t.kind !== "check";
    Object.assign(t, { ph: "fly", t: 0, fly: null, began: false, pp: null, pv: null, build,
      k: build ? (heavy ? 0.6 : 1) : heavy ? 0.4 : brisk ? 0.6 : 1,
      fw: heavy ? 30 : !brisk ? FLY : opening ? FLY_STIFF : FLY_SCROLL, tol: heavy ? [12, 240] : brisk ? [6, 120] : [3, 40] });
    a.task = t;
  }
  const heroQ = (v) => v.q.filter((x) => x.unit.isHero);   // the lookahead queues later sections too; only the hero's count for its timing and steal order
  const firstStop = (t, b) => (t.kind === "click" ? V(b.l + b.w / 2, b.t + b.h / 2) : V(b.l, b.t));   // where a cursor goes first
  // the hero's and qa's own queue, FIFO: the first queued task whose element is actually on screen
  function pick(a) {
    for (let i = 0; i < a.q.length; i++) {
      const t = a.q[i], b = boxOf(t);
      if (!b || (t.kind === "check" && b.t + b.h < 0)) { a.q.splice(i--, 1); done(t); continue; }
      if (!inView(b) || !(t.unit.isHero || t.kind === "check")) continue;
      const n = heroQ(a).length;
      a.q.splice(i, 1);
      begin(a, t, n);
      return true;
    }
    return false;
  }
  // Work stealing, for the hero: an agent with nothing to do takes the oldest on-screen task from the busiest queue. It keeps
  // its own name and colour (the task simply becomes its own); the roles stay the default assignment. Check and caret tasks stay put.
  const stealable = (t) => t.kind === "wipe" || t.kind === "drop" || t.kind === "click" || t.kind === "sweep";
  function steal(a) {
    const from = crew.filter((v) => v !== a && heroQ(v).some(stealable)).sort((x, y) => heroQ(y).length - heroQ(x).length);
    for (const v of from) {
      if (!v.task && heroQ(v).length < 2) continue;   // it is about to take that one itself
      for (let i = 0; i < v.q.length; i++) {
        const t = v.q[i];
        if (!t.unit.isHero || !stealable(t)) continue;
        const b = boxOf(t);
        if (!b || !inView(b)) continue;
        const n = heroQ(v).length;
        v.q.splice(i, 1);
        t.agent = a;
        begin(a, t, n);
        return true;
      }
    }
    return false;
  }
  // After the hero the nearest cursor takes the work: of the on-screen wipe/drop/click/sweep tasks in any queue, its own or
  // another's (checks stay with qa), the one whose first stop is closest to it, unless another idle cursor is closer to
  // that one. The role colours are only the default assignment, as with stealing.
  function near(a) {
    let best = null, from = null, bd = 1e9;
    for (const v of crew) for (const t of v.q) {
      if (t.unit.isHero || !stealable(t)) continue;
      const b = boxOf(t);
      if (!b || !inView(b)) continue;
      const p = firstStop(t, b), d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d >= bd || crew.some((o) => o !== a && o.out && !o.task && Math.hypot(o.x - p.x, o.y - p.y) < d)) continue;
      best = t; from = v; bd = d;
    }
    if (!best) return;
    from.q.splice(from.q.indexOf(best), 1);
    best.agent = a;
    begin(a, best, 0);
  }
  // an on-screen wipe/drop/click/sweep task after the hero is queued; and when no cursor is free to take it, busy ones hand off
  const queued = () => crew.some((v) => v.q.some((x) => !x.unit.isHero && stealable(x) && inView(boxOf(x))));
  const waiting = () => !crew.some((o) => o.out && !o.task) && queued();
  function endTask(a) { const t = a.task; a.task = null; mqFade(a); if (t) done(t); }
  // A sweep is one pass over a card or row. Its marquee grows over the whole group (0.2 s, the cursor riding the corner),
  // and each element starts its own reveal the moment the corner passes its top edge, so the card builds top to bottom
  // under the cursor. Elements still below the screen are not built early: when the pass is over they become plain tasks
  // for the next free cursor (and the unit's pending count grows to match). Once the last element has started, the
  // hand-off rule applies as for any task.
  function sweepStep(a, t, b, dt) {
    const k = t.k, T = 0.2 * k, p = dragEase(Math.min(1, t.t / T)), cy = b.t + b.h * p, q = V(b.l + b.w * p, b.t + b.h * p);
    let left = 0;
    for (const s of t.parts) {
      if (s.rec.state === "done") continue;
      const top = s.el.getBoundingClientRect().top;
      if (top <= cy && top < innerHeight - 4) { s.k = k; reveal(s); } else left++;
    }
    a.mq.p = p;
    const pv = flyTo(a, t, q, dt), ok = arrived(a, q, pv, t.tol);
    if (left) {
      if (t.t < T) return;
      const rest = t.parts.filter((s) => s.rec.state !== "done");
      t.over = true; t.unit.pending += rest.length - 1;
      rest.forEach((s) => { s.sweep = null; s.agent = t.agent; t.agent.q.push(s); });
      a.task = null; mqFade(a);
    }
    else if ((t.t >= 0.12 && waiting()) || (t.t >= T && (ok || t.t >= T + 0.15))) endTask(a);
  }

  function runTask(a, dt) {
    const t = a.task, k = t.k;
    t.t += dt;
    const b = t.kind === "follow" ? caretBox() : boxOf(t);
    if (!b) return endTask(a);
    const mid = V(b.l + b.w / 2, b.t + b.h / 2);

    if (t.kind === "follow") {
      // the name is typed by home.js; show it at once and ride the caret as if typing it
      if (!t.began) { t.began = true; reveal(t, "now"); }
      aim(a, V(b.l + 2, b.t + b.h * 0.8), 12);
      const typed = $(".hero .type"), n = typed ? typed.textContent.length : 0;
      if ((n > 0 && typed && n >= (typed.dataset.text || "").length && t.t > 0.4) || t.t > 5 || b.t + b.h < 0) endTask(a);
      return;
    }
    switch (t.ph) {
      case "build": {   // after the hero: the cursor has arrived and the reveal has just started; it rides the build edge
        if (t.kind === "sweep") { sweepStep(a, t, b, dt); break; }
        const dur = (t.kind === "wipe" ? D.wipe : t.kind === "drop" ? D.drop : D.pop) * k;
        const p = t.kind === "wipe" ? V(b.l + b.w * wipeEase(Math.min(1, t.t / dur)), b.t + b.h / 2) : t.kind === "drop" ? V(b.l + b.w, b.t + b.h) : mid;
        const pv = flyTo(a, t, p, dt), ok = arrived(a, p, pv, t.tol);
        const next = t.t >= 0.12 && waiting();   // another element needs a cursor: move on, the reveal plays out by itself
        if (t.kind === "click") { if (!t.pressed && (ok || next || t.t > 0.2)) { t.pressed = true; a.svg.animate(PRESS, { duration: 140 }); } }
        else a.mq.p = dragEase(Math.min(1, t.t / 0.1));   // the selection grows out over 0.1 s
        if (next || (t.t >= dur && (ok || t.t >= dur + 0.15))) endTask(a);
        break;
      }
      case "fly": {
        const p = firstStop(t, b), pv = flyTo(a, t, p, dt), opening = t.unit.isHero;
        // the hero judges arrival by speed too; after the hero, close enough (28 px) is enough, and a flight never takes over 0.3 s
        if (opening ? arrived(a, p, pv, t.tol) || t.t > k : Math.hypot(a.x - p.x, a.y - p.y) < 28 || t.t > 0.3) {
          t.t = 0;
          if (t.build) { t.ph = "build"; t.pp = null; reveal(t); if (t.kind !== "click") mqShow(a, t); }   // it appears when its cursor gets there; a click has no selection box
          else if (t.kind === "click") { t.ph = "press"; a.svg.animate(PRESS, { duration: 140 }); }
          else { t.ph = "drag"; mqShow(a, t); }
        }
        break;
      }
      case "drag": {   // drag the selection out to the far corner
        const u = Math.min(1, t.t / (D.drag * t.k)), p = dragEase(u);
        a.mq.p = p;
        aim(a, V(b.l + b.w * p, b.t + b.h * p), 16);
        if (u >= 1) {
          t.t = 0;
          if (t.kind === "check") t.ph = "hold";
          else { t.ph = "reveal"; mqFade(a); reveal(t); }
        }
        break;
      }
      case "reveal": {
        if (t.kind === "wipe") {   // ride the wipe edge at mid height
          const dur = D.wipe * t.k, pr = wipeEase(Math.min(1, t.t / dur));
          aim(a, V(b.l + b.w * pr, b.t + b.h / 2), 16);
          if (t.t >= dur) endTask(a);
        } else {                   // drop: wait at the box's bottom-right
          aim(a, V(b.l + b.w, b.t + b.h), 16);
          if (t.t >= D.drop * t.k) endTask(a);
        }
        break;
      }
      case "press":
        aim(a, mid, 16);
        if (t.t >= 0.07) { t.ph = "pop"; t.t = 0; reveal(t); }
        break;
      case "pop":
        aim(a, mid, 16);
        if (t.t >= D.pop * t.k) endTask(a);
        break;
      case "hold":   // qa: a quick check box around the whole unit
        aim(a, V(b.l + b.w, b.t + b.h), 16);
        if (t.t >= D.hold) endTask(a);
        break;
    }
  }

  /* ================= units: trigger, finish, check ================= */
  function done(t) {
    if (t.over) return;
    t.over = true;
    const u = t.unit;
    if (t.kind === "check" || !u.started) return;
    if (--u.pending <= 0 && !u.checked) {   // all built: qa checks the whole unit
      u.checked = true;
      const qa = crew[4];
      qa.q.push({ kind: "check", agent: qa, unit: u, rec: null, over: false });
    }
  }
  function dropTask(t) {
    const a = t.agent;
    if (a.task === t) { a.task = null; mqFade(a); }
    else { const i = a.q.indexOf(t); if (i >= 0) a.q.splice(i, 1); }
    done(t);
  }
  // reveal a target without its cursor: "now" instantly, "fade" over 200 ms (the hero), "build" with its own animation
  // at k 0.6 (a task after the hero that waited a second with no cursor); its task is dropped, so the unit's check still happens.
  // An element of a sweep only marks itself done: the sweep is dropped with its last one.
  function settle(rec, how) {
    if (rec.state === "done") return;
    const t = rec.task, s = t.sweep;
    if (how === "build") { t.k = 0.6; reveal(t); }   // reveal() marks the record done and plays the build
    else {
      rec.state = "done"; recs.delete(rec);
      rec.el.classList.add("crew-done");
      if (how === "fade") play(rec.el, [{ opacity: 0 }, { opacity: 1 }], 200, "linear");
    }
    if (!s) dropTask(t);
    else if (s.parts.every((p) => p.rec.state === "done")) dropTask(s);
  }
  function startUnit(u) {
    if (u.started) return;
    u.started = true;
    u.tasks = u.tasks.filter((t) => !t.over);
    u.pending = u.tasks.length;
    if (!u.pending) return;   // everything was already revealed
    u.tasks.forEach((t) => t.agent.q.push(t));
  }
  const trigger = (u) => (S.phase === "live" ? startUnit(u) : S.held.push(u));

  // Never block reading: pass over what was scrolled past, and reveal whatever sat unbuilt on screen for too long
  // (after the hero: 1 s, built with its own animation, a last resort for a pile-up in a hard flick through dense rows,
  // since a cursor normally gets to its element first; the hero: 2.2 s plus its grace, a fade). Every element is judged on
  // its own, also those of a sweep (they wait on the sweep's cursor, so only a queued sweep lets them time out).
  function scan(now) {
    const jumped = S.jump; S.jump = false;
    if (!jumped && now - S.scanAt < 50) return;
    S.scanAt = now;
    const live = S.phase === "live", H = innerHeight;
    let backlog = 0;
    for (const rec of recs) {
      const r = rec.el.getBoundingClientRect();
      if (r.bottom < 0 || (live && !r.width && !r.height)) { settle(rec, "now"); continue; }   // above the viewport (or not rendered)
      if (!live || r.top > H - 4) { rec.seen = 0; continue; }
      backlog++;
      if (!rec.seen) { rec.seen = now; continue; }
      const t = rec.task.sweep || rec.task, opening = rec.unit.isHero;   // a sweep's element waits on its sweep's cursor
      if (now - rec.seen > (opening ? 2200 + (rec.unit.grace || 0) : 1000) && !(t.agent.task === t)) settle(rec, opening ? "fade" : "build");
    }
    S.backlog = backlog;
  }

  /* ================= frame loop ================= */
  function frame(now) {
    if (S.dead) return;
    try {
      const dt = clamp((now - S.last) / 1000, 0.001, 0.05);
      S.last = now;
      if (!hero.isConnected) return bail(null);   // the page was swapped out (route change)
      if (Math.abs(scrollY - S.scrollY) > innerHeight * 0.6) S.jump = true;   // anchor jump: catch up at once
      S.scrollV = lerp(S.scrollV, (scrollY - S.scrollY) / dt, 0.2);   // smoothed px/s; idleTarget wants the last time it ran down
      if (S.scrollV > 150) S.downAt = now;
      if (Math.abs(S.scrollV) > 10) S.moveAt = now;   // the page is "still" 1.2 s after this: idle cursors on a phone go home
      S.scrollY = scrollY;
      scan(now);
      introStep(now);
      mervStep(dt, now);
      if (!S.crewSet && S.phase === "live" && merv.shown) scheduleCrew(now, 100, 700);   // no intro: they come out once the engine has him on screen
      for (const a of crew) agentStep(a, dt, now);
      separate();
      for (const a of crew) if (a.out) move(a, dt);
      relax();
      for (const a of crew) if (a.out) { place(a); mqRender(a, dt); }
    } catch (e) { return bail(e); }
    raf = requestAnimationFrame(frame);
  }

  /* ================= startup and safety ================= */
  function boot() {
    html.classList.add("crew-on");   // from here the targets are hidden, before the first paint; bail() takes it off again
    api.crew = true;                 // the engine skips its own climb-out-of-the-photo opening and says the crew's lines
    buildOverlay();
    units = plan();
    heroU = units.find((u) => u.isHero);
    if (!heroU) throw new Error("hero not found");
    const byTrigger = new Map(units.filter((u) => !u.isHero).map((u) => [u.trigger, u]));
    io = new IntersectionObserver((es) => {
      try {
        for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); const u = byTrigger.get(e.target); if (u) trigger(u); }
      } catch (err) { bail(err); }
    }, { rootMargin: "0px 0px 75% 0px" });   // lookahead: a section is queued before it scrolls in, so its cursors start the moment its top edge shows
    byTrigger.forEach((u, node) => io.observe(node));

    // body.loading is home.js's "intro is running" flag; its removal is the finish signal (timer or skip)
    bodyObs = new MutationObserver(() => {
      try {
        const loading = document.body.classList.contains("loading");
        if (loading) S.loadingSeen = true;
        else if (S.loadingSeen && S.phase === "intro") goLive();
      } catch (e) { bail(e); }
    });
    bodyObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    S.t0 = S.last = performance.now();
    S.scrollY = scrollY;
    if (document.body.classList.contains("loading")) S.loadingSeen = true;
    if (html.classList.contains("no-intro")) goLive();
    else {
      S.phase = "intro"; scheduleCrew(S.t0 + T_CREW * 1000, 150, 1800);   // flung hard so they reach their ellipses quickly
      hold(restPos(merv.S).x, innerHeight + 30, "jump");                  // he waits below the screen, held before his pose art has even loaded
    }
    raf = requestAnimationFrame(frame);
  }

  // anything goes wrong, or the page goes away: show the whole page and get out of the way
  function bail(err) {
    if (S.dead) return;
    S.dead = true;
    html.classList.remove("crew-on");
    cancelAnimationFrame(raf);
    for (const o of [bodyObs, io]) if (o) o.disconnect();
    anims.forEach((an) => an.cancel());
    $$("[data-crew]").forEach((n) => { n.removeAttribute("data-crew"); n.classList.remove("crew-done"); });
    api.crew = false; api.hold = null;
    if (root) root.remove();
    if (err) console.warn("[crew] stopped, page revealed:", err);
  }

  try { boot(); } catch (e) { bail(e); }
  return () => bail(null);
}
