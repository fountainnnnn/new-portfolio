/* Shared drawing helpers for the skill visuals. Each visual draws in the page's
   ink on paper, and runs only while it is on screen. */
export const INK = "#1d1b18", PAPER = "#efece4", ACCENT = "#0071e3";
export const SERIF = '"New York", ui-serif, Georgia, serif';
export const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const ink = (a) => `rgba(29,27,24,${a})`;

// sizes the canvas to its box, tracks the pointer, and runs draw(state, dt) each frame while visible.
// Returns a function that stops it.
export function stage(canvas, draw) {
  const ctx = canvas.getContext("2d");
  const st = { ctx, w: 0, h: 0, px: null, py: null, t: 0 };
  const fit = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    st.w = r.width; st.h = r.height; canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit(); addEventListener("resize", fit);
  canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); st.px = e.clientX - r.left; st.py = e.clientY - r.top; });
  canvas.addEventListener("pointerleave", () => { st.px = st.py = null; });
  let raf = 0, last = 0;
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; st.t += dt; ctx.clearRect(0, 0, st.w, st.h); draw(st, dt); raf = requestAnimationFrame(loop); };
  if (reduce) { requestAnimationFrame(() => { st.t = 3; draw(st, 0.016); }); return () => removeEventListener("resize", fit); }
  const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(loop); } }, { threshold: 0.05 });
  io.observe(canvas);
  return () => { io.disconnect(); cancelAnimationFrame(raf); removeEventListener("resize", fit); };
}
export const label = (ctx, text, x, y, size = 14, font = SERIF, color = INK, align = "center") => { ctx.font = `${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(text, x, y); };
