/* A full-stack AI app: one request from the browser, through the API, to the model and databases, and the answer streamed back */
import { stage, label, ink, INK, PAPER, ACCENT, SERIF, SANS, reduce } from "./stage.js";

export default function fullStack(canvas) {
  const PROMPT = "Summarise this week's bookings", ANSWER = "42 bookings, up 8 on last week. Friday is nearly full; Monday has 6 open slots.";
  const box = (ctx, x, y, w, h, title, sub, on) => {
    ctx.fillStyle = on ? "rgba(0,113,227,.08)" : "rgba(255,255,255,.55)"; ctx.strokeStyle = on ? ACCENT : ink(0.22); ctx.lineWidth = on ? 1.6 : 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
    const fs = Math.min(14, w / 6.5), small = w < 80;   // narrow boxes on phones drop the subtitle
    label(ctx, title, x + w / 2, y + h / 2 - (sub && !small ? 8 : 0), fs, SERIF, INK);
    if (sub && !small) label(ctx, sub, x + w / 2, y + h / 2 + 11, Math.min(11, w / 8.5), SANS, ink(0.55));
  };
  const wrap = (ctx, text, x, y, maxW, lh) => { let line = ""; for (const word of text.split(" ")) { const t = line ? line + " " + word : word; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); line = word; y += lh; } else line = t; } ctx.fillText(line, x, y); };
  return stage(canvas, (s) => {
    const { ctx, w, h } = s, T = s.t % 7.5;
    // layout: browser on the left, API in the middle, services on the right
    const bx = w * 0.04, bw = w * 0.38, by = h * 0.1, bh = h * 0.8;
    const ax = w * 0.49, aw = w * 0.18, ay = h * 0.38, ah = h * 0.24;
    const sx = w * 0.74, sw = w * 0.22, sh = h * 0.17;
    const svc = [["LLM + tools", "agents", h * 0.14], ["Vector DB", "embeddings", h * 0.415], ["Postgres", "Supabase", h * 0.69]];
    const phase = T < 1.4 ? 0 : T < 2.1 ? 1 : T < 3.3 ? 2 : T < 3.9 ? 3 : T < 6.6 ? 4 : 5;
    // wires
    const mid = (y) => y + sh / 2;
    ctx.lineWidth = 1;
    [[bx + bw, h * 0.5, ax, ay + ah / 2, phase === 1 || phase === 4], ...svc.map(([, , y]) => [ax + aw, ay + ah / 2, sx, mid(y), phase === 2 || phase === 3])].forEach(([x1, y1, x2, y2, on]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2); ctx.strokeStyle = on ? "rgba(0,113,227,.55)" : ink(0.16); ctx.stroke();
    });
    // packets travelling along the active wires
    const dot = (x1, y1, x2, y2, u) => { const mx = (x1 + x2) / 2, x = (1 - u) ** 3 * x1 + 3 * (1 - u) ** 2 * u * mx + 3 * (1 - u) * u * u * mx + u ** 3 * x2, y = (1 - u) ** 3 * y1 + 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3 * y2; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill(); };
    if (phase === 1) dot(bx + bw, h * 0.5, ax, ay + ah / 2, (T - 1.4) / 0.7);
    if (phase === 2) svc.forEach(([, , y], k) => dot(ax + aw, ay + ah / 2, sx, mid(y), Math.min(1, (T - 2.1 - k * 0.15) / 0.6)));
    if (phase === 3) svc.forEach(([, , y]) => dot(sx, mid(y), ax + aw, ay + ah / 2, (T - 3.3) / 0.6));
    if (phase === 4) for (let k = 0; k < 3; k++) dot(ax, ay + ah / 2, bx + bw, h * 0.5, ((T - 3.9) * 1.6 + k / 3) % 1);
    // the API and the services
    box(ctx, ax, ay, aw, ah, "API", "FastAPI · auth", phase >= 1 && phase <= 4);
    svc.forEach(([t, sub, y]) => box(ctx, sx, y, sw, sh, t, sub, phase === 2 || phase === 3));
    // the browser: a prompt typed in, the answer streamed back
    ctx.fillStyle = "#fff"; ctx.strokeStyle = ink(0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by + 26); ctx.lineTo(bx + bw, by + 26); ctx.stroke();
    [0, 1, 2].forEach((k) => { ctx.beginPath(); ctx.arc(bx + 14 + k * 12, by + 13, 3.5, 0, Math.PI * 2); ctx.fillStyle = ink(0.18); ctx.fill(); });
    label(ctx, "React app", bx + bw - 12, by + 13, 11, SANS, ink(0.5), "right");
    const pad = 12, fs = Math.max(11, Math.min(13.5, bw / 17));
    const typed = PROMPT.slice(0, Math.floor(Math.min(T, 1.4) / 1.4 * PROMPT.length));
    ctx.font = `${fs}px ${SANS}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = ink(0.06); ctx.beginPath(); ctx.roundRect(bx + pad, by + 40, bw - pad * 2, fs * 2 + 18, 8); ctx.fill();
    ctx.fillStyle = INK; wrap(ctx, typed, bx + pad + 8, by + 48, bw - pad * 2 - 16, fs + 4);
    const shown = phase < 4 ? "" : ANSWER.slice(0, phase === 5 ? ANSWER.length : Math.floor((T - 3.9) / 2.7 * ANSWER.length));
    ctx.font = `${fs + 1}px ${SERIF}`; ctx.fillStyle = INK; wrap(ctx, shown, bx + pad, by + 40 + fs * 2 + 34, bw - pad * 2, fs + 7);
    if (phase === 2 || phase === 3) label(ctx, "thinking…", bx + pad, by + 40 + fs * 2 + 42, fs, SANS, ink(0.45), "left");
    // what is happening, in one line
    const STEP = ["Typing a request", "Request to the API", "Retrieve and call the model", "Results back to the API", "Streaming the answer", "Done"][phase];
    label(ctx, STEP, ax + aw / 2, h * 0.9, 12, SANS, ink(0.55));
  });
}