/* Everything that moves on the home page apart from the canvases and mini Mervin:
   the opening lines, the typed name, the detector on my photo, scroll reveals, the menu,
   the tools belt and the clock. Runs once after the page renders. */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function startHome() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  gsap.registerPlugin(ScrollTrigger);
  /* ---------- work tiles: the first two flip through their pages on hover (or when in view on touch) ---------- */
  document.querySelectorAll(".tiles .tile[data-pages]").forEach((a) => {
    const names = JSON.parse(a.dataset.pages);
    if (names.length < 2 || reduce) return;
    let i = 0, timer = null;
    const show = () => { const imgs = a.querySelectorAll(".stack img"), dots = a.querySelectorAll(".pages i"); i = (i + 1) % imgs.length; imgs.forEach((im, k) => im.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i)); a.querySelector(".pages em").textContent = names[i]; };
    const go = () => { if (!timer) { show(); timer = setInterval(show, 1100); } }, halt = () => { clearInterval(timer); timer = null; };
    if (fine) { a.addEventListener("pointerenter", go); a.addEventListener("pointerleave", halt); }
    else new IntersectionObserver(([e]) => (e.isIntersecting ? go() : halt()), { threshold: 0.6 }).observe(a);
  });

  /* ---------- menu (appears after the hero) ---------- */
  const mb = document.querySelector(".menu-btn"), drawer = document.querySelector(".drawer");
  function closeMenu() { mb.classList.remove("open"); drawer.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); }
  mb.addEventListener("click", () => { const o = !drawer.classList.contains("open"); drawer.classList.toggle("open", o); mb.classList.toggle("open", o); mb.setAttribute("aria-expanded", o); });
  drawer.querySelectorAll("a[href^='#']").forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("click", (e) => { if (drawer.classList.contains("open") && !drawer.contains(e.target) && !mb.contains(e.target)) closeMenu(); });
  ScrollTrigger.create({ trigger: ".hero", start: "bottom 15%", onEnter: () => gsap.to(mb, { scale: 1, duration: 0.4, ease: "back.out(2)" }), onLeaveBack: () => { closeMenu(); gsap.to(mb, { scale: 0, duration: 0.3 }); } });

  /* ---------- scroll cue and back to top ---------- */
  const cue = document.querySelector(".cue");
  const toTop = document.querySelector(".to-top");
  addEventListener("scroll", () => { cue.classList.toggle("gone", scrollY > 40); toTop.classList.toggle("on", scrollY > innerHeight); }, { passive: true });
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));

  /* ---------- certificate previews open full size ---------- */
  const certView = document.querySelector(".cert-view");
  document.querySelectorAll(".cert-card").forEach((c) => c.addEventListener("click", () => { const im = certView.querySelector("img"); im.src = c.dataset.full; im.alt = c.querySelector(".mat img").alt; certView.showModal(); }));
  certView.addEventListener("click", () => certView.close());

  /* ---------- hero intro, after the opening lines ---------- */
  const startDetector = () => setTimeout(() => document.dispatchEvent(new Event("hero:ready")), 0);
  function typeTitle() {
    const el = document.querySelector(".hero .type"), text = el.dataset.text;
    if (reduce) { el.textContent = text; return; }
    let i = 0; const id = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(id); }, 90);
  }
  function intro() {
    typeTitle();
    if (!reduce) gsap.from(".hero .body > div > *:not(h1)", { y: 24, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.07, delay: 0.3 });
    startDetector();
  }
  (function siteIntro() {
    const el = document.querySelector(".site-intro");
    if (document.documentElement.classList.contains("no-intro")) { el.style.display = "none"; intro(); return; }
    document.body.classList.add("loading");
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      el.classList.add("is-hiding"); document.body.classList.remove("loading");
      removeEventListener("keydown", skip); clearTimeout(timer);
      intro(); setTimeout(() => (el.style.display = "none"), 1900);
    };
    const skip = (e) => { if (["Enter", " ", "Escape"].includes(e.key)) finish(); };
    const timer = setTimeout(finish, reduce ? 1100 : 8400);   // same length as the current site
    addEventListener("keydown", skip); el.addEventListener("click", finish);
  })();

  /* ---------- detector: scan, boxes, caption ---------- */
  document.addEventListener("hero:ready", () => {
    const boxes = [...document.querySelectorAll(".det .box")], cap = document.querySelector(".det .cap-text");
    const CAPTION = "a young engineer in a dark suit, looking straight at you";
    const show = (b, v) => (b.dataset.show = `${b.dataset.l} ${v.toFixed(2)}`);
    if (reduce) { boxes.forEach((b) => { b.style.opacity = 1; show(b, +b.dataset.c); }); cap.textContent = CAPTION; return; }
    boxes.forEach((b) => show(b, 0));
    const tl = gsap.timeline({ delay: 0.3 });
    tl.fromTo(".det .scan", { top: "0%", opacity: 1 }, { top: "100%", duration: 1.3, ease: "power1.inOut" }).to(".det .scan", { opacity: 0, duration: 0.2 });
    boxes.forEach((b, k) => { const c = { v: 0.35 }; tl.fromTo(b, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" }, 1.1 + k * 0.32).to(c, { v: +b.dataset.c, duration: 0.7, ease: "power2.out", onUpdate: () => show(b, c.v) }, "<"); });
    tl.add(() => { let n = 0; const id = setInterval(() => { cap.textContent = CAPTION.slice(0, ++n); if (n >= CAPTION.length) clearInterval(id); }, 34); });
    setTimeout(() => setInterval(() => boxes.forEach((b) => {
      if (b.matches(":hover")) return;
      gsap.to(b, { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3, scaleX: 1 + (Math.random() - 0.5) * 0.012, scaleY: 1 + (Math.random() - 0.5) * 0.012, duration: 0.18, ease: "none" });
      show(b, b.classList.contains("main") ? 0.99 : Math.min(0.99, +b.dataset.c + (Math.random() - 0.5) * 0.02));
    }), 220), 3600);
  }, { once: true });

  /* ---------- reveals ---------- */
  if (!reduce) {
    gsap.to(".about .lead .w", { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: ".about .lead", start: "top 75%", end: "bottom 55%", scrub: true } });
    gsap.utils.toArray(".sh, .tile, .xrow, .wgrid div, .skill .txt").forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } }));
    document.querySelectorAll(".tile .stack").forEach((s) => gsap.fromTo(s, { yPercent: 4 }, { yPercent: -4, ease: "none", scrollTrigger: { trigger: s.parentElement, start: "top bottom", end: "bottom top", scrub: true } }));
    gsap.fromTo(".curve div", { height: "400%" }, { height: "0%", ease: "none", scrollTrigger: { trigger: ".contact", start: "top bottom", end: "top 35%", scrub: true } });
  }

  /* ---------- tools belt ---------- */
  let dir = 1;
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (s) => { dir = s.direction; } });
  const belt = document.querySelector(".belt");
  if (!reduce) { let bx = 0; gsap.ticker.add(() => { const w = belt.firstElementChild.offsetWidth; if (!w) return; bx -= 0.6 * dir; if (bx <= -w) bx += w; if (bx > 0) bx -= w; belt.style.transform = `translateX(${bx}px)`; }); }

  /* ---------- clock ---------- */
  const clock = document.querySelector(".clock");
  const tickClock = () => (clock.textContent = new Intl.DateTimeFormat("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" }).format(new Date()));
  tickClock(); setInterval(tickClock, 15000);

  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  addEventListener("load", () => ScrollTrigger.refresh());
}
