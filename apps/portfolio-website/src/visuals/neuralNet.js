/* A small network running a real forward pass; the cursor drives its inputs */
import { stage, label, ink, INK, PAPER, ACCENT, SERIF, SANS, reduce } from "./stage.js";

export default function neuralNet(canvas) {
  const SIZES = [4, 7, 7, 5, 3], OUT = ["Cat", "Dog", "Bird"], IN = ["x", "y", "sin t", "cos t"];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const W = SIZES.slice(1).map((n, l) => Array.from({ length: n }, () => Array.from({ length: SIZES[l] }, () => gauss() * 1.1)));
  const pulses = []; let spawn = 0;
  return stage(canvas, (s, dt) => {
    const { ctx, w, h, t } = s;
    const mx = s.px == null ? Math.sin(t * 0.6) : (s.px / w) * 2 - 1, my = s.py == null ? Math.cos(t * 0.45) : (s.py / h) * 2 - 1;
    // forward pass: tanh hidden layers, softmax output
    const A = [[mx, my, Math.sin(t * 1.3), Math.cos(t * 0.9)]];
    W.forEach((layer, l) => { A.push(layer.map((row) => { const z = row.reduce((sum, wv, j) => sum + wv * A[l][j], 0); return l === W.length - 1 ? z : Math.tanh(z); })); });
    const last = A[A.length - 1], ex = last.map((z) => Math.exp(z - Math.max(...last))), sm = ex.map((v) => v / ex.reduce((a, b) => a + b, 0));
    const left = Math.max(w * 0.12, 70), right = w * (w < 520 ? 0.6 : 0.72), X = (l) => left + (l / (SIZES.length - 1)) * (right - left);
    const Y = (l, i) => h / 2 + (i - (SIZES[l] - 1) / 2) * Math.min(46, (h * 0.78) / Math.max(...SIZES));
    // weights, drawn by how much signal they carry right now
    W.forEach((layer, l) => layer.forEach((row, i) => row.forEach((wv, j) => {
      const v = Math.abs(wv * A[l][j]); ctx.beginPath(); ctx.moveTo(X(l), Y(l, j)); ctx.lineTo(X(l + 1), Y(l + 1, i));
      ctx.strokeStyle = wv > 0 ? ink(0.06 + Math.min(0.6, v * 0.45)) : `rgba(0,113,227,${0.05 + Math.min(0.45, v * 0.35)})`; ctx.lineWidth = 0.6 + Math.min(2.2, v * 1.4); ctx.stroke();
    })));
    // signal pulses hop forward along the strongest weights
    spawn -= dt; if (spawn <= 0 && !reduce) { spawn = 0.12; pulses.push({ l: 0, i: Math.floor(Math.random() * SIZES[0]), u: 0 }); }
    for (let k = pulses.length - 1; k >= 0; k--) {
      const q = pulses[k]; if (q.next == null) { const row = W[q.l].map((r, i) => Math.abs(r[q.i] * A[q.l][q.i]) + Math.random() * 0.3); q.next = row.indexOf(Math.max(...row)); }
      q.u += dt * 2.6; const x = X(q.l) + (X(q.l + 1) - X(q.l)) * q.u, y = Y(q.l, q.i) + (Y(q.l + 1, q.next) - Y(q.l, q.i)) * q.u;
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      if (q.u >= 1) { if (q.l + 1 >= W.length) pulses.splice(k, 1); else { q.l++; q.i = q.next; q.next = null; q.u = 0; } }
    }
    // neurons sized and shaded by activation
    A.forEach((layer, l) => layer.forEach((v, i) => {
      const a = l === A.length - 1 ? sm[i] : Math.abs(Math.tanh(v)); ctx.beginPath(); ctx.arc(X(l), Y(l, i), 9 + a * 6, 0, Math.PI * 2);
      ctx.fillStyle = PAPER; ctx.fill(); ctx.beginPath(); ctx.arc(X(l), Y(l, i), 9 + a * 6, 0, Math.PI * 2); ctx.fillStyle = ink(0.12 + a * 0.85); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    }));
    IN.forEach((n, i) => label(ctx, n, X(0) - 28, Y(0, i), 12, SANS, ink(0.6), "right"));
    // softmax read-out
    OUT.forEach((n, i) => {
      const y = Y(SIZES.length - 1, i), bx = X(SIZES.length - 1) + 26, bw = Math.max(28, w - bx - 48);
      label(ctx, n, bx, y - 11, 13, SERIF, INK, "left");
      ctx.fillStyle = ink(0.1); ctx.fillRect(bx, y - 1, bw, 6); ctx.fillStyle = INK; ctx.fillRect(bx, y - 1, bw * sm[i], 6);
      label(ctx, `${Math.round(sm[i] * 100)}%`, bx + bw + 8, y + 2, 11.5, SANS, ink(0.6), "left");
    });
  });
}