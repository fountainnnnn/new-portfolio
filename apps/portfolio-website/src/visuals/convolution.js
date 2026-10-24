/* A 3x3 convolution sliding over my portrait, writing each feature map pixel by pixel */
import { stage, label, ink, INK, PAPER, ACCENT, SERIF, SANS, reduce } from "./stage.js";

export default function convolution(canvas) {
  const KERNELS = [
    ["Vertical edges", [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]],
    ["Horizontal edges", [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]],
    ["Outline", [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]]],
  ];
  const COLS = 96, ROWS = 92;
  let I = null, maps = [], kIdx = 0, pos = 0, hold = 0;
  const img = new Image(); img.src = "/img/myself.png";
  img.onload = () => {
    const off = document.createElement("canvas"); off.width = COLS; off.height = ROWS; const o = off.getContext("2d");
    o.drawImage(img, 0, 0, COLS, ROWS); const d = o.getImageData(0, 0, COLS, ROWS).data;
    I = new Float32Array(COLS * ROWS); for (let i = 0; i < COLS * ROWS; i++) { const lum = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255; I[i] = (1 - lum) * (d[i * 4 + 3] / 255); }
    maps = KERNELS.map(([, K]) => { const out = new Float32Array(COLS * ROWS); for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += K[j + 1][i + 1] * I[(y + j) * COLS + x + i]; out[y * COLS + x] = Math.min(1, Math.abs(s) / 2.2); } return out; });
  };
  const inImg = document.createElement("canvas"), fmImg = document.createElement("canvas"); inImg.width = fmImg.width = COLS; inImg.height = fmImg.height = ROWS;
  let inReady = false; const fctx = fmImg.getContext("2d"), fdata = fctx.createImageData(COLS, ROWS);
  const reset = () => { for (let i = 0; i < fdata.data.length; i += 4) { fdata.data[i] = 29; fdata.data[i + 1] = 27; fdata.data[i + 2] = 24; fdata.data[i + 3] = 0; } pos = 0; };
  reset();
  return stage(canvas, (s, dt) => {
    const { ctx, w, h } = s;
    if (!I) { label(ctx, "Loading…", w / 2, h / 2, 13, SANS, ink(0.5)); return; }
    if (!inReady) { const c = inImg.getContext("2d"), id = c.createImageData(COLS, ROWS); for (let i = 0; i < COLS * ROWS; i++) { id.data[i * 4] = 29; id.data[i * 4 + 1] = 27; id.data[i * 4 + 2] = 24; id.data[i * 4 + 3] = I[i] * 255; } c.putImageData(id, 0, 0); inReady = true; }
    // advance the kernel along the image, writing each result into the feature map
    const total = COLS * ROWS, M = maps[kIdx];
    if (reduce) { for (let i = 0; i < total; i++) fdata.data[i * 4 + 3] = M[i] * 255; pos = total; }
    else if (hold > 0) { hold -= dt; if (hold <= 0) { kIdx = (kIdx + 1) % KERNELS.length; reset(); } }
    else { const step = Math.ceil(total * dt / 3.2); for (let k = 0; k < step && pos < total; k++, pos++) fdata.data[pos * 4 + 3] = M[pos] * 255; if (pos >= total) hold = 1.6; }
    fctx.putImageData(fdata, 0, 0);
    const pad = w * 0.05, pw = Math.min((w - pad * 3) / 2, (h - 150) * COLS / ROWS), ph = pw * ROWS / COLS, top = Math.max(40, (h - ph) / 2 - 40), lx = (w - pw * 2 - pad) / 2;
    ctx.imageSmoothingEnabled = false;
    const L = lx, Rx = lx + pw + pad;
    ctx.fillStyle = "#fff"; ctx.fillRect(L, top, pw, ph); ctx.fillRect(Rx, top, pw, ph);
    ctx.drawImage(inImg, L, top, pw, ph); ctx.drawImage(fmImg, Rx, top, pw, ph);
    ctx.strokeStyle = ink(0.3); ctx.lineWidth = 1; ctx.strokeRect(L, top, pw, ph); ctx.strokeRect(Rx, top, pw, ph);
    // the 3x3 window on the input, and the pixel it writes on the output
    const cx = pos % COLS, cy = Math.floor(pos / COLS), sx = pw / COLS, sy = ph / ROWS;
    if (pos < total) {
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.strokeRect(L + (cx - 1) * sx, top + (cy - 1) * sy, sx * 3, sy * 3);
      ctx.fillStyle = ACCENT; ctx.fillRect(Rx + cx * sx, top + cy * sy, sx, sy);
      ctx.beginPath(); ctx.moveTo(L + (cx + 1.5) * sx, top + cy * sy); ctx.lineTo(Rx + cx * sx, top + cy * sy); ctx.strokeStyle = "rgba(0,113,227,.35)"; ctx.lineWidth = 1; ctx.stroke();
    }
    label(ctx, "Input", L, top - 14, 13, SERIF, INK, "left");
    label(ctx, `Feature map: ${KERNELS[kIdx][0].toLowerCase()}`, Rx, top - 14, 13, SERIF, INK, "left");
    // the kernel itself
    const K = KERNELS[kIdx][1], cell = 24, kx = w / 2 - cell * 1.5, ky = top + ph + 26;
    K.forEach((row, j) => row.forEach((v, i) => { ctx.strokeStyle = ink(0.4); ctx.strokeRect(kx + i * cell, ky + j * cell, cell, cell); label(ctx, String(v), kx + i * cell + cell / 2, ky + j * cell + cell / 2 + 1, 11.5, SANS, v === 0 ? ink(0.35) : INK); }));
    label(ctx, "3×3 kernel", kx - 14, ky + cell * 1.5, 12, SANS, ink(0.55), "right");
  });
}