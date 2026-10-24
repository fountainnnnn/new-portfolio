/* The agent loop: plan, act (calling a tool), observe, reflect; the first check fails, the retry passes */
import { stage, label, ink, INK, PAPER, ACCENT, SERIF, SANS, reduce } from "./stage.js";

export default function agentLoop(canvas) {
  const STEPS = ["Plan", "Act", "Observe", "Reflect"];
  const TOOLS = ["Search", "Code", "Browser", "Files"];
  const GOALS = ["Summarise 40 PDFs", "Fix the failing test", "Reply to a booking", "Find a cheaper supplier"];
  let p = 0, goal = 0, lap = 0, tool = -1, toolT = 0, holding = false, verdict = null, verdictT = 0, done = 0;
  return stage(canvas, (s, dt) => {
    const { ctx, w, h } = s, cx = w * 0.42, cy = h * 0.5, R = Math.min(w, h) * 0.3;
    // advance: hold at Act while a tool call runs; first pass fails the check, second passes
    if (done > 0) { done -= dt; if (done <= 0) { goal = (goal + 1) % GOALS.length; lap = 0; p = 0; verdict = null; } }
    else if (holding) { toolT += dt * 1.3; if (toolT >= 2) { holding = false; } }
    else {
      const before = p; p += dt * 0.55;
      if (before < 1 && p >= 1) { holding = true; toolT = 0; tool = (tool + 1 + Math.floor(Math.random() * 2)) % TOOLS.length; p = 1; }
      if (before < 2 && p >= 2) { verdict = lap === 0 ? "fail" : "pass"; verdictT = 1.6; if (verdict === "pass") { done = 2.2; p = 2; } }
      if (p >= 4) { p -= 4; lap++; }
    }
    if (verdictT > 0) verdictT -= dt;
    // engraved ring: a few fine concentric strokes
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R + k * 2.2, 0, Math.PI * 2); ctx.strokeStyle = ink(k === 0 ? 0.55 : 0.12); ctx.lineWidth = k === 0 ? 1.4 : 0.6; ctx.stroke(); }
    // arrowheads between steps
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i + 0.5) * Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(4, 0); ctx.lineTo(-6, 5); ctx.strokeStyle = ink(0.7); ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
    }
    // tools hang off the Act node
    const ax = cx + R, ay = cy, tx = Math.min(w - 54, cx + R + Math.max(90, w * 0.2));
    TOOLS.forEach((name, i) => {
      const ty = cy + (i - 1.5) * Math.min(58, h * 0.13), active = holding && i === tool;
      ctx.beginPath(); ctx.moveTo(ax + 30, ay); ctx.bezierCurveTo(ax + 70, ay, tx - 70, ty, tx - 36, ty);
      ctx.setLineDash(active ? [] : [3, 4]); ctx.strokeStyle = ink(active ? 0.9 : 0.25); ctx.lineWidth = active ? 1.6 : 1; ctx.stroke(); ctx.setLineDash([]);
      if (active) { // a packet travels out to the tool and back
        const q = toolT < 1 ? toolT : 2 - toolT, bx = (u) => (1 - u) ** 3 * (ax + 30) + 3 * (1 - u) ** 2 * u * (ax + 70) + 3 * (1 - u) * u * u * (tx - 70) + u ** 3 * (tx - 36), by = (u) => (1 - u) ** 3 * ay + 3 * (1 - u) ** 2 * u * ay + 3 * (1 - u) * u * u * ty + u ** 3 * ty;
        ctx.beginPath(); ctx.arc(bx(q), by(q), 4, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill();
      }
      ctx.beginPath(); ctx.roundRect(tx - 36, ty - 15, 72, 30, 15); ctx.fillStyle = active ? INK : PAPER; ctx.fill(); ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1; ctx.stroke();
      label(ctx, name, tx, ty + 1, 12.5, SANS, active ? PAPER : INK);
    });
    // the four steps
    const cur = done > 0 ? 2 : Math.floor(p) % 4;
    STEPS.forEach((name, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = i === cur;
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fillStyle = on ? INK : PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      label(ctx, name, x, y + 1, 13, SERIF, on ? PAPER : INK);
    });
    // the agent itself, travelling the loop
    const a = -Math.PI / 2 + (p % 4) * Math.PI / 2;
    for (let k = 0; k < 14; k++) { const ak = a - k * 0.035; ctx.beginPath(); ctx.arc(cx + Math.cos(ak) * R, cy + Math.sin(ak) * R, 5 - k * 0.3, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,113,227,${0.9 - k * 0.06})`; ctx.fill(); }
    // centre: the goal, the attempt, the verdict
    label(ctx, "GOAL", cx, cy - 26, 10.5, SANS, ink(0.5));
    label(ctx, GOALS[goal], cx, cy - 4, Math.max(13, Math.min(18, R * 0.12)), SERIF);
    if (done > 0) label(ctx, "Done ✓", cx, cy + 24, 14, SANS, ACCENT);
    else if (verdictT > 0 && verdict === "fail") label(ctx, "Check failed, retrying", cx, cy + 24, 12, SANS, "#b0472f");
    else label(ctx, `attempt ${lap + 1}`, cx, cy + 24, 12, SANS, ink(0.5));
  });
}