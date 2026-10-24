/* Mini Mervin: a small cartoon of me who runs to the empty space next to whatever you're
   reading, introduces each section, and never covers content. Clicking him opens his chat.
   Poses were drawn by Codex from my photo; walk and point have separate left-facing art.

   startMascot(el) returns { api, stop }. The chat and contact form drive him through api:
   open (window showing), thinking (waiting on a reply), cheer (seconds to wave),
   goTo(node) (walk to it and point), say(text, ms) (speech bubble). */
export function startMascot(el) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = matchMedia("(max-width: 960px)");   // phones: smaller, with the chat above him
  const POSES = ["idle", "walk1", "walk2", "wave", "point", "think", "laptop", "walk1-l", "walk2-l", "point-l", "climb", "jump", "land"];
  const SIDED = ["walk1", "walk2", "point"];   // drawn facing right, with separate left-facing art; the rest face the viewer
  const SRC = (p) => `/img/mascot/${p}-cut.png`;
  const FEET = 0.985;   // where his feet sit, as a fraction of the image height

  // place: "below" = stand in the empty space under the element
  //        "right" = stand beside it, on the same floor
  //        "rule"  = stand on the element's bottom edge, at x = ax across it
  //        "top"   = stand on the element's top edge, at x = ax across it
  //        "beside" = stand just outside its right edge (left edge if there's no room), on its bottom
  const SPOTS = [
    { sel: ".det .photo", place: "beside", pose: "wave", say: "Hi! I'm mini Mervin." },
    { sel: ".about .side .btn", place: "right", pose: "idle", say: "A bit about me." },
    { sel: ".skill:nth-of-type(1)", place: "gap", pose: "laptop", say: "I build AI agents." },
    { sel: ".skill:nth-of-type(2)", place: "gap", pose: "think", say: "And machine learning." },
    { sel: ".skill:nth-of-type(3)", place: "gap", pose: "point", say: "Computer vision too." },
    { sel: ".skill:nth-of-type(4)", place: "gap", pose: "think", say: "Plus RAG and search." },
    { sel: ".skill:nth-of-type(5)", place: "gap", pose: "laptop", say: "And full-stack apps." },
    { sel: ".tiles .tile:nth-child(2) .mat", place: "top", ax: 0.18, pose: "point", say: "My best projects." },
    { sel: "#experience .sh", place: "rule", ax: 0.5, pose: "idle", say: "Where I've worked." },
    { sel: "#hon-h", up: ".sh", place: "rule", ax: 0.5, pose: "wave", say: "Some hackathon wins." },
    { sel: "#cert-h", up: ".sh", place: "rule", ax: 0.5, pose: "point", say: "And certifications." },
    { sel: ".contact .pills .btn:last-child", place: "right", pose: "wave", say: "Let's talk!" },
  ];

  const flip = el.querySelector(".flip"), bubble = el.querySelector(".say"), mini = el.querySelector(".mini");
  const imgs = {};
  let loaded = 0;
  POSES.forEach((p) => {
    const im = new Image(); im.src = SRC(p); im.alt = ""; im.onload = () => { if (++loaded === POSES.length) start(); };
    flip.appendChild(im); imgs[p] = im;
  });
  let left = false;   // facing the viewer's left
  const setPose = (p) => { if (left && SIDED.includes(p)) p += "-l"; for (const k in imgs) imgs[k].classList.toggle("on", k === p); };

  // state the chat drives: open = mini chat showing, thinking = waiting for a reply,
  // focus = an element he should walk to and point at while answering
  const api = { open: false, thinking: false, cheer: 0, focus: null, active: null, say: () => {}, goTo: () => {} };
  let stopped = false;

  function start() {
    el.hidden = false;
    const spots = SPOTS.map((s) => { let n = document.querySelector(s.sel); if (n && s.up) n = n.closest(s.up); return { ...s, node: n }; }).filter((s) => s.node);
    let sayTimer = null;
    const say = (text, ms = 3200) => { bubble.textContent = text; bubble.classList.add("on"); clearTimeout(sayTimer); sayTimer = setTimeout(() => bubble.classList.remove("on"), ms); };
    api.say = say;

    // a spot's standing point, in page (document) coordinates
    const docTarget = (s, S) => {
      const r = s.node.getBoundingClientRect();
      let x, feet;
      if (s.place === "gap") {
        // the bigger empty gap above or below the text column, with room for his speech bubble
        const t = s.node.querySelector(".txt").getBoundingClientRect(), BUB = 44;
        const below = r.bottom - t.bottom, above = t.top - r.top;
        x = t.left;
        // no room above or below the text: stand in the empty gutter beside it, level with its end
        if (Math.max(below, above) < S + BUB && t.right + 24 + S < innerWidth - 8) { x = t.right + 24; feet = t.bottom; }
        else if (below >= above) feet = t.bottom + BUB + (below - BUB) / 2 + S * FEET / 2;
        else feet = r.top + BUB + (above - BUB) / 2 + S * FEET / 2;
      }
      else if (s.place === "below") { x = r.left + r.width * (s.ax || 0); feet = r.bottom + 20 + S * FEET; }
      else if (s.place === "right") { x = r.right + 18; feet = r.bottom; }
      else if (s.place === "beside") { x = r.right + 12 + S < innerWidth - 8 ? r.right + 12 : r.left - S - 12; feet = r.bottom - 6; }
      else if (s.place === "rule") { x = r.left + r.width * s.ax - S / 2; feet = r.bottom; }
      else { x = r.left + r.width * s.ax - S / 2; feet = r.top; }
      return { x: x + scrollX, y: feet - S * FEET + scrollY };
    };
    // standing next to something he's talking about: on its top edge if there's room, else beside it
    const focusTarget = (node, S) => {
      const r = node.getBoundingClientRect();
      if (r.top > S + 60) return { x: r.left + Math.min(r.width * 0.12, 60) + scrollX, y: r.top - S * FEET + scrollY };
      return { x: Math.min(r.right + 14, innerWidth - S - 8) + scrollX, y: Math.max(r.top, 60) + scrollY };
    };
    api.goTo = (node) => { api.focus = node; };
    // free space: when no preset spot is on screen, run to the nearest patch of the viewport
    // that covers nothing. If the screen is full, settle for covering the least:
    // card backgrounds are fine to stand on, text, images and controls are not.
    const HARD = "h1,h2,h3,p,b,img,canvas,input,button,dl,.tags span,.built,.lead-win,.cgrid > .cert-card,.pages,.meta,.magnet,.menu-btn,.drawer,.to-top";
    const SOFT = "a,figure,.viz,.tile,.xrow,.wgrid,.belt,.det";
    // content boxes in page coordinates, refreshed a few times a second
    let boxes = null, boxesAt = -1;
    const collect = (sel) => [...document.querySelectorAll(sel)].filter((n) => !el.contains(n) && (!n.checkVisibility || n.checkVisibility({ visibilityProperty: true, opacityProperty: false })))
      .map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ l: r.left + scrollX, r: r.right + scrollX, t: r.top + scrollY, b: r.bottom + scrollY }));
    const content = (now) => { if (!boxes || now - boxesAt > 300) { boxes = { hard: collect(HARD), soft: collect(SOFT) }; boxesAt = now; } return boxes; };
    const hits = (list, l, r, t, b) => list.some((q) => q.l < r && q.r > l && q.t < b && q.b > t);
    // how much of a box the content covers, 0 to 1, so on a full screen he picks the emptiest patch
    const covered = (list, l, r, t, b) => { let a = 0; for (const q of list) { const w = Math.min(r, q.r) - Math.max(l, q.l), h = Math.min(b, q.b) - Math.max(t, q.t); if (w > 0 && h > 0) a += w * h; } return Math.min(1, a / ((r - l) * (b - t))); };
    // what standing at (vx, vy) would cover: his body, plus room for a bubble above unless bodyOnly
    const cost = (vx, vy, S, bodyOnly = false) => {
      const { hard, soft } = content(performance.now());
      const l = vx + S * 0.2 + scrollX, r = vx + S * 0.8 + scrollX, t = vy + S * 0.04 + scrollY, b = vy + S * 0.98 + scrollY;
      // covering content with his body is far worse than his bubble overlapping something for a moment
      let c = vx < 0 || vy < 0 || vx + S > innerWidth || vy + S > innerHeight ? 100 : 0;
      const k = covered(hard, l, r, t, b);
      if (k > 0) c += 100 + k * 100; else if (hits(soft, l, r, t, b)) c += 1;
      if (!bodyOnly && hits(hard, vx + S / 2 - 100 + scrollX, vx + S / 2 + 100 + scrollX, t - S * 0.32, t)) c += 5;
      return c;
    };
    // the spot nearest the middle of the screen whose standing area is on screen and covers no text or images
    const pick = (S) => {
      const ok = [];
      for (const s of spots) {
        const t = docTarget(s, S), top = t.y - scrollY;
        if (top < 40 || top + S > innerHeight - 10) continue;
        ok.push([Math.abs(top + S / 2 - innerHeight * 0.55), s, t]);
      }
      ok.sort((a, b) => a[0] - b[0]);
      for (const [, s, t] of ok) if (cost(t.x - scrollX, t.y - scrollY, S, true) < 100) return s;
      return null;
    };

    let freeCache = null, freeAt = 0;
    const findFree = (S, now) => {
      if (freeCache && now - freeAt < 400) return freeCache;
      freeAt = now;
      if (freeCache) { const v = { x: freeCache.x - scrollX, y: freeCache.y - scrollY }; if (v.y > 60 && v.y < innerHeight - S && Math.abs(v.y + S / 2 - innerHeight / 2) < innerHeight * 0.3 && cost(v.x, v.y, S) <= freeCache.c) return freeCache; }   // drifted toward an edge: find a spot nearer the middle
      const cx = innerWidth / 2 - S / 2, cy = innerHeight * 0.5 - S / 2, cands = [];   // prefer empty space near the middle of the screen, not where he happens to be
      for (let vy = 70; vy <= innerHeight - S - 10; vy += 40) for (let vx = 10; vx <= innerWidth - S - 10; vx += 40) cands.push([vx, vy, Math.hypot(vx - cx, vy - cy)]);
      cands.sort((a, b) => a[2] - b[2]);
      let best = null;
      for (const [vx, vy, d] of cands) {
        const c = cost(vx, vy, S);
        if (!best || c + d / 1500 < best.c + best.d / 1500) best = { x: vx + scrollX, y: vy + scrollY, c, d };
        if (c === 0) break;   // nearest fully empty spot
      }
      return (freeCache = best);
    };

    let x = 0, y = 0, placed = false, active = null, lastSaid = null, walkT = 0, step = 0, override = null, overrideT = 0, running = false;
    el.addEventListener("pointerenter", () => { if (!api.open) { override = "wave"; overrideT = 1.2; say("Click me to chat or get a tour.", 3000); } });
    el.addEventListener("click", () => document.dispatchEvent(new Event("mascot:click")));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.dispatchEvent(new Event("mascot:click")); } });


    // intro: he climbs up out of my photo, growing as he comes toward you, then jumps out and lands beside it
    const photo = document.querySelector(".det .photo"), heroSpot = spots.find((s) => s.place === "beside");
    let intro = !reduce && photo && heroSpot && scrollY < innerHeight * 0.4 ? { t: -0.9 } : null;
    const ease = (u) => 1 - (1 - u) ** 3;
    const runIntro = (dt, S) => {
      if (document.body.classList.contains("loading")) { el.style.visibility = "hidden"; return true; }
      intro.t += dt;
      const r = photo.getBoundingClientRect(), R = r.width / 2, cx = r.left + R, cy = r.top + R;
      const end = docTarget(heroSpot, S), ex = end.x - scrollX, ey = end.y - scrollY;
      const t = intro.t, sx = cx + R * 0.2 - S / 2, peak = cy - S * 0.62;   // where the climb ends, inside the circle
      let vx, vy, sc = 1, pose, clip = "none";
      if (t < 0) { el.style.visibility = "hidden"; return true; }
      if (t < 1.1) {   // climb: rise from below the rim, scaled down as if far inside the picture
        const u = ease(t / 1.1); sc = 0.4 + 0.6 * u; pose = "climb";
        vx = sx; vy = cy + R - S + (peak - (cy + R - S)) * u;
        // clip to the photo circle, mapped into his own (scaled, bottom-centre origin) box
        const lx = S / 2 + (cx - vx - S / 2) / sc, ly = S + (cy - vy - S) / sc;
        clip = `circle(${R / sc}px at ${lx}px ${ly}px)`;
      } else if (t < 1.75) {   // jump: an arc out of the frame to his spot
        const u = (t - 1.1) / 0.65; pose = "jump";
        vx = sx + (ex - sx) * u; vy = peak + (ey - peak) * u - Math.sin(u * Math.PI) * 90;
        left = ex < sx;
      } else if (t < 2.05) { vx = ex; vy = ey; pose = "land"; }
      else { intro = null; x = end.x; y = end.y; placed = true; el.style.clipPath = ""; el.style.transform = ""; el.style.pointerEvents = ""; lastSaid = null; setTimeout(() => { if (scrollY < 60 && !api.open) say("Scroll down, I'll show you around.", 3400); }, 3000); return false; }
      x = vx + scrollX; y = vy + scrollY; placed = true;
      el.style.visibility = "visible"; el.style.pointerEvents = "none";
      el.style.transformOrigin = "50% 100%"; el.style.transform = sc < 1 ? `scale(${sc})` : "";
      el.style.clipPath = clip;
      setPose(pose);
      el.style.left = `${vx}px`; el.style.top = `${vy}px`;
      return true;
    };

    let last = performance.now(), wasOpen = false;
    const frame = (now) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const S = el.offsetWidth;
      if (intro && api.open) intro = null;
      if (intro && runIntro(dt, S)) { requestAnimationFrame(frame); return; }
      el.classList.toggle("compact", compact.matches);
      el.classList.toggle("chatting", api.open);
      if (api.open !== wasOpen) { wasOpen = api.open; bubble.classList.remove("on"); if (!api.open) { api.focus = null; override = "wave"; overrideT = 1.2; lastSaid = null; } }
      let tx, ty, moving = false;

      const s = pick(S);
      active = s || null;
      api.active = active;
      let free = null;
      if (api.focus) ({ x: tx, y: ty } = focusTarget(api.focus, S));
      else if (active) ({ x: tx, y: ty } = docTarget(active, S));
      else if ((free = findFree(S, now))) ({ x: tx, y: ty } = free);

      if (tx != null) {
        if (!placed) { x = tx; y = ty; placed = true; }
        // if scrolling left him off screen, he re-enters from the nearest edge and runs from there
        if (!reduce) { x = Math.max(scrollX + 8, Math.min(scrollX + innerWidth - S - 8, x)); y = Math.max(scrollY + 8, Math.min(scrollY + innerHeight - S - 8, y)); }
        const dx = tx - x, dy = ty - y, dist = Math.hypot(dx, dy);
        if (reduce) { x = tx; y = ty; }
        else if (dist > 1) {
          running = dist > 260;                                    // far: run, near: walk
          const sp = Math.min(dist, (running ? 1500 : 520) * dt);   // px per second
          x += (dx / dist) * sp; y += (dy / dist) * sp; moving = dist > 4;
          if (Math.abs(dx) > 2) left = dx < 0;
        }
      }

      // phones: a small chat centred on him, kept inside the screen
      if (compact.matches) { const W = Math.min(280, innerWidth - 24), mx = x - scrollX; mini.style.left = `${Math.max(12, Math.min(innerWidth - 12 - W, mx + S / 2 - W / 2)) - mx}px`; }
      else mini.style.left = "";
      // keep his speech bubble inside the screen; its tail still points at him
      if (bubble.classList.contains("on")) {
        bubble.style.marginLeft = "0px";
        const b = bubble.getBoundingClientRect(), shift = b.right > innerWidth - 8 ? innerWidth - 8 - b.right : b.left < 8 ? 8 - b.left : 0;
        bubble.style.marginLeft = `${shift}px`; bubble.style.setProperty("--shift", `${shift}px`);
      }
      el.classList.toggle("mini-left", x - scrollX + S + 320 > innerWidth);
      el.classList.toggle("mini-down", y - scrollY < 330);
      if (api.cheer > 0) { api.cheer -= dt; setPose("wave"); }
      else if (overrideT > 0) { overrideT -= dt; setPose(override); }
      else if (moving) { walkT += dt; if (walkT > (running ? 0.07 : 0.13)) { walkT = 0; step ^= 1; } setPose(step ? "walk2" : "walk1"); }
      else if (api.open) {
        if (api.focus) { const r = api.focus.getBoundingClientRect(); left = r.left + r.width / 2 < x - scrollX + S / 2; }
        setPose(api.thinking ? "think" : api.focus ? "point" : "idle");
      }
      else if (active) {
        // once he stops, face the thing this spot is about so a point lands on it
        const look = (active.place === "gap" ? active.node.querySelector(".viz") : api.focus || active.node);
        if (look) { const r = look.getBoundingClientRect(); left = r.left + r.width / 2 < x - scrollX + S / 2; }
        setPose(active.pose); if (lastSaid !== active) { lastSaid = active; say(active.say, 2800); }
      }
      else setPose("idle");

      const bob = moving ? Math.abs(Math.sin(now / (running ? 55 : 85))) * (running ? -7 : -4) : 0;
      el.style.left = `${x - scrollX}px`; el.style.top = `${y - scrollY + bob}px`;
      el.style.visibility = tx != null ? "visible" : "hidden";
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  return { api, stop: () => { stopped = true; } };
}
