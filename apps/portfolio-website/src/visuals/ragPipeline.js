/* Agentic RAG: a question, the agent choosing a source, the nearest chunks, the sources it kept, and a cited answer */
import { stage, label, ink, INK, PAPER, ACCENT, SERIF, SANS, reduce } from "./stage.js";

export default function ragPipeline(canvas) {
  // RAG, left to right: a question, the chunks it lands nearest in embedding space, and the answer built from them
  const TOPICS = [
    { name: "Lecture notes", x: 0.2, y: 0.44, q: "What does backprop do?", src: ["week4.pdf p.12", "week4.pdf p.13", "week5.pdf p.2"], a: "It sends the error back through the network to update every weight." },
    { name: "Invoices", x: 0.44, y: 0.42, q: "What did we bill ACME in March?", src: ["INV-0311.pdf", "INV-0318.pdf", "ledger.xlsx r.42"], a: "$4,820 across two invoices, both paid on time." },
    { name: "Support tickets", x: 0.42, y: 0.79, q: "Why does login keep failing?", src: ["#2231", "#2240", "#2198"], a: "An expired SSO token. Clearing the session fixes it." },
    { name: "Source code", x: 0.18, y: 0.8, q: "Where is the auth token checked?", src: ["auth/guard.ts L18", "api/session.ts L4", "auth/jwt.ts L33"], a: "In the auth guard, before every API route runs." },
  ];
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const P = TOPICS.flatMap((tp, c) => Array.from({ length: 26 }, () => ({ x: tp.x + g() * 0.085, y: tp.y + g() * 0.08, c, ph: rnd() * 6.28 })));
  let topic = -1, since = 0;
  const wrap = (ctx, text, x, y, maxW, lh) => { let line = ""; for (const word of text.split(" ")) { const tryL = line ? line + " " + word : word; if (ctx.measureText(tryL).width > maxW && line) { ctx.fillText(line, x, y); line = word; y += lh; } else line = tryL; } ctx.fillText(line, x, y); };
  return stage(canvas, (s, dt) => {
    const { ctx, w, h, t } = s;
    const split = w * 0.6, fs = Math.max(10.5, Math.min(13, w / 46));
    // the query: your cursor inside the space, otherwise it drifts between topics on its own
    const auto = TOPICS[Math.floor(t / 5) % TOPICS.length];
    const qx = s.px != null && s.px < split ? s.px / w : auto.x + Math.sin(t * 0.9) * 0.03, qy = s.py != null && s.px < split ? s.py / h : auto.y + Math.cos(t * 0.7) * 0.03;
    const pts = P.map((p) => ({ ...p, X: (p.x + Math.sin(t * 0.6 + p.ph) * 0.004) * w, Y: (p.y + Math.cos(t * 0.5 + p.ph) * 0.004) * h }));
    const Q = { X: qx * w, Y: qy * h };
    const near = pts.map((p, i) => [Math.hypot(p.X - Q.X, p.Y - Q.Y), i]).sort((a, b) => a[0] - b[0]).slice(0, 3);
    const counts = [0, 0, 0, 0]; near.forEach(([, i]) => counts[pts[i].c]++);
    const now = counts.indexOf(Math.max(...counts));
    if (now !== topic) { topic = now; since = 0; } else since += dt;
    const T = TOPICS[topic];

    // 1. the question, typed in
    label(ctx, "1  Question", 18, 22, fs - 1, SANS, ink(0.5), "left");
    const typed = T.q.slice(0, Math.floor(since * 38));
    ctx.font = `${fs + 3}px ${SERIF}`; ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`\u201c${typed}${typed.length < T.q.length ? "" : "\u201d"}`, 18, 46);
    // the agent step: it decides where to look before anything is retrieved
    if (typed.length === T.q.length) label(ctx, `Agent: rewrote the query, searching ${T.name.toLowerCase()}`, 18, 68, fs - 1.5, SANS, ACCENT, "left");

    // 2. embedding space: every dot is a chunk of a document
    label(ctx, "2  Nearest chunks in embedding space", 18, 90, fs - 1, SANS, ink(0.5), "left");
    TOPICS.forEach((tp) => label(ctx, tp.name, tp.x * w, (tp.y - 0.12) * h, fs, SERIF, ink(0.55)));
    near.forEach(([, i], r) => { ctx.beginPath(); ctx.moveTo(Q.X, Q.Y); ctx.lineTo(pts[i].X, pts[i].Y); ctx.strokeStyle = `rgba(0,113,227,${0.8 - r * 0.15})`; ctx.lineWidth = 1.3; ctx.stroke(); });
    pts.forEach((p, i) => { const on = near.some(([, j]) => j === i); ctx.beginPath(); ctx.arc(p.X, p.Y, on ? 4.5 : 2.4, 0, Math.PI * 2); ctx.fillStyle = on ? INK : ink(0.32); ctx.fill(); });
    ctx.beginPath(); ctx.arc(Q.X, Q.Y, 8, 0, Math.PI * 2); ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Q.X - 13, Q.Y); ctx.lineTo(Q.X + 13, Q.Y); ctx.moveTo(Q.X, Q.Y - 13); ctx.lineTo(Q.X, Q.Y + 13); ctx.lineWidth = 1; ctx.stroke();

    // 3. what came back, and 4. the answer written from it, with citations
    ctx.beginPath(); ctx.moveTo(split, 84); ctx.lineTo(split, h - 18); ctx.strokeStyle = ink(0.12); ctx.lineWidth = 1; ctx.stroke();
    const rx = split + 16, rw = w - rx - 16;
    label(ctx, "3  Retrieved and checked", rx, 90, fs - 1, SANS, ink(0.5), "left");
    T.src.forEach((src, k) => {
      const y = 108 + k * (fs + 16), score = (0.92 - k * 0.07 - Math.min(near[k][0] / w, 0.2)).toFixed(2);
      ctx.fillStyle = k === 0 ? "rgba(0,113,227,.09)" : ink(0.04); ctx.fillRect(rx, y, rw, fs + 10);
      label(ctx, `[${k + 1}] ${src}`, rx + 8, y + (fs + 10) / 2, fs - 0.5, SANS, INK, "left");
      label(ctx, score, rx + rw - 8, y + (fs + 10) / 2, fs - 1.5, SANS, ink(0.5), "right");
    });
    const ay = 108 + 3 * (fs + 16) + 18;
    label(ctx, "4  Answer", rx, ay, fs - 1, SANS, ink(0.5), "left");
    const full = `${T.a} [1][2]`, shown = full.slice(0, Math.max(0, Math.floor((since - T.q.length / 38 - 0.3) * 45)));
    ctx.font = `${fs + 1}px ${SERIF}`; ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    wrap(ctx, shown, rx, ay + 24, rw, fs + 8);
  });
}