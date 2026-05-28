// Predictor page module
// Shared behaviors live in `core.js`.
function setupPredictor() {
  const root = document.querySelector("[data-page='predictor']");
  if (!root) return;

  const elements = {
    resolutionInput: root.querySelector("#modelResolution"),
    choiceCards: Array.from(root.querySelectorAll("[data-model-choice]")),
    dropzone: root.querySelector("[data-dropzone]"),
    fileInput: root.querySelector("#imageFile"),
    previewImg: root.querySelector("#previewImg"),
    fileNameEl: root.querySelector("#fileName"),
    predictModeInputs: Array.from(root.querySelectorAll("input[name='predictMode']")),
    predictModeHint: root.querySelector("#predictModeHint"),
    runButton: root.querySelector("#runDemo"),
    clearButton: root.querySelector("#clearImage"),
    addMoreImages: root.querySelector("#addMoreImages"),
    batchCount: root.querySelector("#batchCount"),
    batchQueueEmpty: root.querySelector("#batchQueueEmpty"),
    batchThumbs: root.querySelector("#batchThumbs"),
    sensitivitySlider: root.querySelector("#sensitivitySlider"),
    sensitivityLabel: root.querySelector("#sensitivityLabel"),

    recommendationTitle: root.querySelector("#recommendationTitle"),
    recommendationReason: root.querySelector("#recommendationReason"),
    recommendationBadge: root.querySelector("#recommendationBadge"),
    applyRecommendation: root.querySelector("#applyRecommendation"),

    resultEmpty: root.querySelector("#resultEmpty"),
    resultFilled: root.querySelector("#resultFilled"),
    resultLabel: root.querySelector("#resultLabel"),
    resultConfidence: root.querySelector("#resultConfidence"),
    resultConfidenceDonut: root.querySelector("#resultConfidenceDonut"),
    resultConfidenceDonutValue: root.querySelector("#resultConfidenceDonutValue"),
    resultConfidenceTier: root.querySelector("#resultConfidenceTier"),
    resultProbBars: root.querySelector("#resultProbBars"),
    resultMarginValue: root.querySelector("#resultMarginValue"),
    resultTop3Value: root.querySelector("#resultTop3Value"),
    resultEntropyValue: root.querySelector("#resultEntropyValue"),
    resultModel: root.querySelector("#resultModel"),
    topList: root.querySelector("#topList"),
    whyText: root.querySelector("#whyText"),
    feedbackCard: root.querySelector("#resultFeedbackCard"),
    feedbackLabelSelect: root.querySelector("#feedbackLabelSelect"),
    feedbackApplyBtn: root.querySelector("#feedbackApplyBtn"),
    feedbackStatus: root.querySelector("#feedbackStatus"),
    feedbackCorrectedBadge: root.querySelector("#feedbackCorrectedBadge"),
    openSetBadge: root.querySelector("#openSetBadge"),
    openSetBadgeWarn: root.querySelector("#openSetBadgeWarn"),
    batchSummary: root.querySelector("#batchSummary"),
    batchResultsEmpty: root.querySelector("#batchResultsEmpty"),
    batchResultsShell: root.querySelector("#batchResultsShell"),
    batchResults: root.querySelector("#batchResults"),
    batchPagination: root.querySelector("#batchPagination"),

    compareLabel23: root.querySelector("#compareLabel23"),
    compareConf23: root.querySelector("#compareConf23"),
    compareNote23: root.querySelector("#compareNote23"),
    compareLabel101: root.querySelector("#compareLabel101"),
    compareConf101: root.querySelector("#compareConf101"),
    compareNote101: root.querySelector("#compareNote101"),
    agreementTitle: root.querySelector("#agreementTitle"),
    agreementDetail: root.querySelector("#agreementDetail"),
    stabilityScore: root.querySelector("#stabilityScore"),
    stabilityBadge: root.querySelector("#stabilityBadge"),
    stabilityDetail: root.querySelector("#stabilityDetail"),

    stressButtons: Array.from(root.querySelectorAll("[data-stress]")),
    stressList: root.querySelector("#stressList"),
    stressHint: root.querySelector("#stressHint"),
    startGame: root.querySelector("#startGame"),
    gameArea: root.querySelector("#gameArea"),
    gameRound: root.querySelector("#gameRound"),
    gameOptions: root.querySelector("#gameOptions"),
    gameResult: root.querySelector("#gameResult"),
    nextRound: root.querySelector("#nextRound"),
    endGame: root.querySelector("#endGame"),

    fridgeEmpty: root.querySelector("#fridgeEmpty"),
    fridgeResults: root.querySelector("#fridgeResults"),
    fridgeTiles: root.querySelector("#fridgeTiles"),
    fridgeSummary: root.querySelector("#fridgeSummary"),
    fridgePagination: root.querySelector("#fridgePagination"),

    fridgeCropModal: document.getElementById("fridgeCropModal"),
    fridgeCropCanvas: document.getElementById("fridgeCropCanvas"),
    fridgeCropHelp: document.getElementById("fridgeCropHelp"),
    fridgeToolInputs: Array.from(document.querySelectorAll("input[name='fridgeTool']")),
    fridgeModalPresetInputs: Array.from(document.querySelectorAll("input[name='fridgeModalPreset']")),
    fridgeApplyPreset: document.getElementById("fridgeApplyPreset"),
    fridgeUndo: document.getElementById("fridgeUndo"),
    fridgeClearRegions: document.getElementById("fridgeClearRegions"),
    fridgeRegionCount: document.getElementById("fridgeRegionCount"),
    fridgeRunSelected: document.getElementById("fridgeRunSelected"),
    fridgeRunStatus: document.getElementById("fridgeRunStatus"),
  };

  const CLASS_NAMES = [
    "Bean",
    "Bitter_Gourd",
    "Brinjal",
    "Cabbage",
    "Capsicum",
    "Cauliflower_Broccoli",
    "Cucumber_BottleGourd",
    "Potato",
    "Pumpkin",
    "Radish_Carrot",
    "Tomato",
  ];

  function prettyLabel(label) {
    const raw = String(label || "").trim();
    const map = {
      Bitter_Gourd: "Bitter gourd",
      Cauliflower_Broccoli: "Cauliflower / Broccoli",
      Cucumber_BottleGourd: "Cucumber / Bottle gourd",
      Radish_Carrot: "Radish / Carrot",
    };
    if (map[raw]) return map[raw];
    if (!raw) return "Unknown";
    return raw.replace(/_/g, " ");
  }

  const labels = CLASS_NAMES.map(prettyLabel);
  const classOptions = CLASS_NAMES.map((raw) => ({ raw, pretty: prettyLabel(raw) }));

  const state = {
    batch: [],
    batchPage: 1,
    fridgePage: 1,
    activeId: null,
    imageFile: null,
    imageEl: null,
    imageHash: "",
    metrics: null,
    sensitivity: 1,
    recommendedModel: null,
    predictMode: "single",
    last: {
      single: null,
      compare: null,
    },
    fridgeLast: null,
  };

  const gameState = {
    active: false,
    round: 0,
    locked: false,
  };

  let fridgeRunInFlight = false;
  let fridgeRerunQueued = false;
  let fridgeAutoTimer = null;

  let compareRunInFlight = false;
  let compareRerunQueued = false;
  let compareAutoTimer = null;
  const BATCH_PAGE_SIZE = 2;
  const FRIDGE_PAGE_ROWS = 2;

  function isFridgeTabActive() {
    const pane = root.querySelector("#pane-fridge");
    if (pane && (pane.classList.contains("show") || pane.classList.contains("active"))) return true;
    const tab = root.querySelector("#tab-fridge");
    if (!tab) return false;
    return tab.classList.contains("active") || tab.getAttribute("aria-selected") === "true";
  }

  function isCompareTabActive() {
    const pane = root.querySelector("#pane-compare");
    if (pane && (pane.classList.contains("show") || pane.classList.contains("active"))) return true;
    const tab = root.querySelector("#tab-compare");
    if (!tab) return false;
    return tab.classList.contains("active") || tab.getAttribute("aria-selected") === "true";
  }

  function scheduleFridgeAutoRun() {
    if (fridgeAutoTimer) {
      window.clearTimeout(fridgeAutoTimer);
      fridgeAutoTimer = null;
    }
    fridgeAutoTimer = window.setTimeout(() => {
      fridgeAutoTimer = null;
      if (!isFridgeTabActive()) return;
      runFridgeMode().catch(() => null);
    }, 140);
  }

  async function runCompareAuto() {
    if (!state.imageFile) return;
    if (!isCompareTabActive()) return;
    if (compareRunInFlight) {
      compareRerunQueued = true;
      return;
    }
    compareRunInFlight = true;
    try {
      await runCompareNow();
    } finally {
      compareRunInFlight = false;
      if (compareRerunQueued) {
        compareRerunQueued = false;
        scheduleCompareAutoRun();
      }
    }
  }

  function scheduleCompareAutoRun() {
    if (compareAutoTimer) {
      window.clearTimeout(compareAutoTimer);
      compareAutoTimer = null;
    }
    compareAutoTimer = window.setTimeout(() => {
      compareAutoTimer = null;
      runCompareAuto().catch(() => null);
    }, 140);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function formatPct(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function modelLabel(value) {
    return value === "23" ? "23x23 (fast)" : "101x101 (accurate)";
  }

  function pluralize(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[ch] || ch;
    });
  }

  function getPredictMode() {
    const selected = elements.predictModeInputs.find((el) => el && el.checked);
    const mode = String(selected?.value || "single").trim().toLowerCase();
    return mode === "fridge" ? "fridge" : "single";
  }

  function setPredictMode(mode) {
    state.predictMode = mode === "fridge" ? "fridge" : "single";
    updatePredictModeUI();
    updateBatchUI();
  }

  function updatePredictModeUI() {
    if (elements.predictModeHint) {
      elements.predictModeHint.textContent =
        state.predictMode === "fridge"
          ? "Smart Fridge runs per-region predictions and saves each tile separately (signed-in users)."
          : "Single runs 1 prediction on the active image and saves it (signed-in users).";
    }
  }

  function newId(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  function cloneRegions(list) {
    return Array.isArray(list) ? list.map((r) => ({ ...r })) : [];
  }

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  function normalizeRegion(region) {
    const x = clamp01(region.x);
    const y = clamp01(region.y);
    const w = clamp01(region.w);
    const h = clamp01(region.h);
    return { id: region.id || newId("r"), x, y, w, h };
  }

  function makePresetRegions(grid) {
    const g = grid === 3 ? 3 : 2;
    const regions = [];
    let idx = 0;
    for (let row = 0; row < g; row += 1) {
      for (let col = 0; col < g; col += 1) {
        const x0 = col / g;
        const y0 = row / g;
        const x1 = (col + 1) / g;
        const y1 = (row + 1) / g;
        regions.push({ id: `p_${g}_${idx}`, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        idx += 1;
      }
    }
    return regions;
  }

  const fridgeEditor = {
    modal: null,
    regions: [],
    undo: [],
    selectedId: null,
    drag: null,
    isOpen: false,
    imageHash: "",
  };

  function getFridgeTool() {
    const selected = (elements.fridgeToolInputs || []).find((el) => el && el.checked);
    const v = String(selected?.value || "").toLowerCase();
    return v === "draw" ? "draw" : "select";
  }

  function setFridgeTool(value) {
    const next = value === "draw" ? "draw" : "select";
    (elements.fridgeToolInputs || []).forEach((el) => {
      if (!el) return;
      el.checked = String(el.value).toLowerCase() === next;
    });

    if (elements.fridgeCropCanvas) {
      elements.fridgeCropCanvas.style.cursor = next === "draw" ? "crosshair" : "default";
    }

    if (elements.fridgeCropHelp) {
      elements.fridgeCropHelp.textContent =
        next === "draw"
          ? "Draw tool: drag to create a region. Switch to Select to move/resize. Press Esc to cancel a draw."
          : "Select tool: click a region to select, drag inside to move, drag handles to resize. Hold Shift to draw. Delete removes selected.";
    }
  }

  function updateFridgeEditorControls() {
    const count = fridgeEditor.regions.length;
    if (elements.fridgeRegionCount) elements.fridgeRegionCount.textContent = String(count);
    if (elements.fridgeUndo) elements.fridgeUndo.disabled = fridgeEditor.undo.length === 0;
    if (elements.fridgeClearRegions) elements.fridgeClearRegions.disabled = count === 0;
    if (elements.fridgeRunSelected) elements.fridgeRunSelected.disabled = count === 0 || !state.imageEl || !state.imageFile;
  }

  function pushFridgeUndo() {
    fridgeEditor.undo.push(cloneRegions(fridgeEditor.regions));
    updateFridgeEditorControls();
  }

  function setFridgeRegions(next) {
    fridgeEditor.regions = cloneRegions(next).map(normalizeRegion);
    if (fridgeEditor.selectedId && !fridgeEditor.regions.some((r) => r.id === fridgeEditor.selectedId)) {
      fridgeEditor.selectedId = null;
    }
    updateFridgeEditorControls();
  }

  function undoFridge() {
    if (!fridgeEditor.undo.length) return;
    const prev = fridgeEditor.undo.pop();
    setFridgeRegions(prev);
    drawFridgeEditor();
  }

  function clearFridgeRegions() {
    if (!fridgeEditor.regions.length) return;
    pushFridgeUndo();
    setFridgeRegions([]);
    drawFridgeEditor();
  }

  function ensureFridgeModal() {
    if (!elements.fridgeCropModal) return null;
    if (fridgeEditor.modal) return fridgeEditor.modal;
    if (!window.bootstrap || !window.bootstrap.Modal) return null;
    fridgeEditor.modal = new window.bootstrap.Modal(elements.fridgeCropModal, { backdrop: "static" });
    return fridgeEditor.modal;
  }

  function getCanvasCtx() {
    if (!elements.fridgeCropCanvas) return null;
    return elements.fridgeCropCanvas.getContext("2d");
  }

  function sizeFridgeCanvas() {
    if (!elements.fridgeCropCanvas) return;
    if (!state.imageEl) return;
    const stage = elements.fridgeCropCanvas.parentElement;
    if (!stage) return;

    const maxWidth = Math.max(320, stage.clientWidth || 640);
    const navSpaceVar = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-space") || "96"
    );
    const navSpace = Number.isFinite(navSpaceVar) ? navSpaceVar : 96;
    const viewportH = Math.max(640, window.innerHeight || 900);
    const reserved = 330;
    const maxHeight = Math.max(360, Math.min(560, Math.floor(viewportH - navSpace - reserved)));

    const img = state.imageEl;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const aspect = ih / iw;

    let w = Math.floor(maxWidth);
    let h = Math.floor(w * aspect);
    if (h > maxHeight) {
      h = maxHeight;
      w = Math.floor(h / aspect);
    }

    elements.fridgeCropCanvas.width = Math.max(2, w);
    elements.fridgeCropCanvas.height = Math.max(2, h);
  }

  function drawHandle(ctx, x, y, size, color) {
    const r = Math.max(4, size / 2);
    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,0.2)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(248,250,252,0.96)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.shadowColor = "rgba(16,185,129,0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r - 3), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function traceRoundedRect(ctx, x, y, w, h, radius) {
    const r = Math.max(2, Math.min(radius, Math.min(w, h) / 2));
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const FRIDGE_REGION_SWATCHES = ["#22c55e", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

  function hexToRgba(hex, alpha) {
    const clean = String(hex || "").replace("#", "");
    if (clean.length !== 6) return `rgba(34,197,94,${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawFridgeEditor() {
    if (!fridgeEditor.isOpen) return;
    if (!elements.fridgeCropCanvas) return;
    const ctx = getCanvasCtx();
    if (!ctx) return;
    const img = state.imageEl;
    if (!img) return;

    const cw = elements.fridgeCropCanvas.width;
    const ch = elements.fridgeCropCanvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    const handleSize = 14;
    for (const [index, r] of fridgeEditor.regions.entries()) {
      const x = r.x * cw;
      const y = r.y * ch;
      const w = r.w * cw;
      const h = r.h * ch;

      const selected = r.id === fridgeEditor.selectedId;
      const swatch = FRIDGE_REGION_SWATCHES[index % FRIDGE_REGION_SWATCHES.length];
      const lineColor = selected ? hexToRgba(swatch, 0.95) : hexToRgba(swatch, 0.76);
      const fillColor = selected ? hexToRgba(swatch, 0.2) : hexToRgba(swatch, 0.14);
      const radius = Math.max(8, Math.min(16, Math.min(w, h) * 0.08));

      ctx.save();
      ctx.lineWidth = selected ? 2.8 : 1.8;
      ctx.strokeStyle = lineColor;
      ctx.fillStyle = fillColor;
      ctx.setLineDash(selected ? [] : [8, 6]);
      if (selected) {
        ctx.shadowColor = hexToRgba(swatch, 0.34);
        ctx.shadowBlur = 12;
      }
      traceRoundedRect(ctx, x, y, w, h, radius);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const tag = String(index + 1);
      const tagPaddingX = 8;
      const tagHeight = 20;
      ctx.save();
      ctx.font = "600 12px system-ui, -apple-system, Segoe UI, sans-serif";
      const tagWidth = Math.max(20, Math.ceil(ctx.measureText(tag).width + tagPaddingX * 2));
      const tagX = x + 8;
      const tagY = y + 8;
      ctx.fillStyle = hexToRgba(swatch, 0.88);
      traceRoundedRect(ctx, tagX, tagY, tagWidth, tagHeight, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tag, tagX + tagWidth / 2, tagY + tagHeight / 2 + 0.5);
      ctx.restore();

      if (selected) {
        const color = hexToRgba(swatch, 0.96);
        // Corners
        drawHandle(ctx, x, y, handleSize, color);
        drawHandle(ctx, x + w, y, handleSize, color);
        drawHandle(ctx, x, y + h, handleSize, color);
        drawHandle(ctx, x + w, y + h, handleSize, color);
        // Edges
        drawHandle(ctx, x + w / 2, y, handleSize, color);
        drawHandle(ctx, x + w / 2, y + h, handleSize, color);
        drawHandle(ctx, x, y + h / 2, handleSize, color);
        drawHandle(ctx, x + w, y + h / 2, handleSize, color);
      }
    }
  }

  function canvasPoint(event) {
    if (!elements.fridgeCropCanvas) return { x: 0, y: 0 };
    const rect = elements.fridgeCropCanvas.getBoundingClientRect();
    const xRaw = (event.clientX - rect.left) * (elements.fridgeCropCanvas.width / rect.width);
    const yRaw = (event.clientY - rect.top) * (elements.fridgeCropCanvas.height / rect.height);
    const x = Math.max(0, Math.min(elements.fridgeCropCanvas.width, xRaw));
    const y = Math.max(0, Math.min(elements.fridgeCropCanvas.height, yRaw));
    return { x, y };
  }

  function hitTestRegion(px, py) {
    if (!elements.fridgeCropCanvas) return null;
    const cw = elements.fridgeCropCanvas.width;
    const ch = elements.fridgeCropCanvas.height;
    const handleRadius = 14;

    const regions = [...fridgeEditor.regions].reverse();
    for (const r of regions) {
      const x = r.x * cw;
      const y = r.y * ch;
      const w = r.w * cw;
      const h = r.h * ch;

      const isSelected = r.id === fridgeEditor.selectedId;
      if (isSelected) {
        const handles = [
          { key: "nw", cx: x, cy: y },
          { key: "n", cx: x + w / 2, cy: y },
          { key: "ne", cx: x + w, cy: y },
          { key: "e", cx: x + w, cy: y + h / 2 },
          { key: "se", cx: x + w, cy: y + h },
          { key: "s", cx: x + w / 2, cy: y + h },
          { key: "sw", cx: x, cy: y + h },
          { key: "w", cx: x, cy: y + h / 2 },
        ];
        for (const c of handles) {
          const dx = px - c.cx;
          const dy = py - c.cy;
          if (Math.abs(dx) <= handleRadius && Math.abs(dy) <= handleRadius) {
            return { id: r.id, mode: "resize", handle: c.key };
          }
        }
      }
      if (px >= x && px <= x + w && py >= y && py <= y + h) {
        return { id: r.id, mode: "move" };
      }
    }
    return null;
  }

  function deleteSelectedRegion() {
    if (!fridgeEditor.selectedId) return;
    const idx = fridgeEditor.regions.findIndex((r) => r.id === fridgeEditor.selectedId);
    if (idx < 0) return;
    pushFridgeUndo();
    fridgeEditor.regions.splice(idx, 1);
    fridgeEditor.selectedId = null;
    updateFridgeEditorControls();
    drawFridgeEditor();
  }

  function attachFridgeEditorHandlers() {
    if (!elements.fridgeCropCanvas) return;
    if (elements.fridgeCropCanvas.dataset.bound === "1") return;
    elements.fridgeCropCanvas.dataset.bound = "1";

    elements.fridgeCropCanvas.addEventListener("pointerdown", (event) => {
      if (!fridgeEditor.isOpen) return;
      if (!elements.fridgeCropCanvas) return;
      if (event.button !== 0) return;

      const { x, y } = canvasPoint(event);
      const tool = getFridgeTool();
      const wantsDraw = tool === "draw" || event.shiftKey;

      if (!wantsDraw) {
        const hit = hitTestRegion(x, y);
        if (hit) {
          fridgeEditor.selectedId = hit.id;
          const r = fridgeEditor.regions.find((rr) => rr.id === hit.id);
          if (!r) return;
          elements.fridgeCropCanvas.setPointerCapture(event.pointerId);
          fridgeEditor.drag = {
            mode: hit.mode,
            handle: hit.handle || "",
            startX: x,
            startY: y,
            startRegion: { ...r },
            moveOffsetX: x - r.x * elements.fridgeCropCanvas.width,
            moveOffsetY: y - r.y * elements.fridgeCropCanvas.height,
            id: r.id,
            started: false,
          };
          drawFridgeEditor();
          return;
        }

        // Empty click: deselect only (no accidental draws).
        fridgeEditor.selectedId = null;
        fridgeEditor.drag = null;
        drawFridgeEditor();
        return;
      }

      // Draw new region (only in Draw tool or Shift-drag).
      fridgeEditor.selectedId = null;
      elements.fridgeCropCanvas.setPointerCapture(event.pointerId);
      fridgeEditor.drag = {
        mode: "draw",
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      };
      drawFridgeEditor();
    });

    elements.fridgeCropCanvas.addEventListener("pointermove", (event) => {
      if (!fridgeEditor.isOpen) return;
      if (!elements.fridgeCropCanvas) return;

      const { x, y } = canvasPoint(event);
      if (!fridgeEditor.drag) {
        const tool = getFridgeTool();
        if (tool === "draw") {
          elements.fridgeCropCanvas.style.cursor = "crosshair";
          return;
        }
        const hit = hitTestRegion(x, y);
        if (!hit) {
          elements.fridgeCropCanvas.style.cursor = "default";
          return;
        }
        if (hit.mode === "resize") {
          const k = String(hit.handle || "").toLowerCase();
          const cursorMap = {
            nw: "nwse-resize",
            se: "nwse-resize",
            ne: "nesw-resize",
            sw: "nesw-resize",
            n: "ns-resize",
            s: "ns-resize",
            e: "ew-resize",
            w: "ew-resize",
          };
          elements.fridgeCropCanvas.style.cursor = cursorMap[k] || "nwse-resize";
          return;
        }
        elements.fridgeCropCanvas.style.cursor = "move";
        return;
      }

      const cw = elements.fridgeCropCanvas.width;
      const ch = elements.fridgeCropCanvas.height;
      const minPx = 18;

      if (fridgeEditor.drag.mode === "draw") {
        fridgeEditor.drag.currentX = x;
        fridgeEditor.drag.currentY = y;
        drawFridgeEditor();

        // Draw preview
        const ctx = getCanvasCtx();
        if (!ctx) return;
        const x0 = fridgeEditor.drag.startX;
        const y0 = fridgeEditor.drag.startY;
        const x1 = x;
        const y1 = y;
        const rx = Math.min(x0, x1);
        const ry = Math.min(y0, y1);
        const rw = Math.abs(x1 - x0);
        const rh = Math.abs(y1 - y0);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(34,197,94,0.95)";
        ctx.fillStyle = "rgba(34,197,94,0.12)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
        return;
      }

      const drag = fridgeEditor.drag;
      const r = fridgeEditor.regions.find((rr) => rr.id === drag.id);
      if (!r) return;

      if (drag.mode === "move") {
        if (!drag.started) {
          const dx = x - drag.startX;
          const dy = y - drag.startY;
          if (Math.hypot(dx, dy) < 3) return;
          drag.started = true;
          pushFridgeUndo();
        }
        const nx = (x - drag.moveOffsetX) / cw;
        const ny = (y - drag.moveOffsetY) / ch;
        r.x = clamp01(Math.min(nx, 1 - r.w));
        r.y = clamp01(Math.min(ny, 1 - r.h));
        drawFridgeEditor();
        return;
      }

      if (drag.mode === "resize") {
        if (!drag.started) {
          const dx = x - drag.startX;
          const dy = y - drag.startY;
          if (Math.hypot(dx, dy) < 3) return;
          drag.started = true;
          pushFridgeUndo();
        }
        const start = drag.startRegion;
        const x0 = start.x * cw;
        const y0 = start.y * ch;
        const x1 = (start.x + start.w) * cw;
        const y1 = (start.y + start.h) * ch;

        let nx0 = x0;
        let ny0 = y0;
        let nx1 = x1;
        let ny1 = y1;
        const h = String(drag.handle || "").toLowerCase();
        if (h === "nw") {
          nx0 = x;
          ny0 = y;
        } else if (h === "n") {
          ny0 = y;
        } else if (h === "ne") {
          nx1 = x;
          ny0 = y;
        } else if (h === "e") {
          nx1 = x;
        } else if (h === "se") {
          nx1 = x;
          ny1 = y;
        } else if (h === "s") {
          ny1 = y;
        } else if (h === "sw") {
          nx0 = x;
          ny1 = y;
        } else if (h === "w") {
          nx0 = x;
        }

        // Keep within bounds first.
        nx0 = Math.max(0, Math.min(cw, nx0));
        nx1 = Math.max(0, Math.min(cw, nx1));
        ny0 = Math.max(0, Math.min(ch, ny0));
        ny1 = Math.max(0, Math.min(ch, ny1));

        // Prevent flipping and enforce min size.
        if (h.includes("w")) nx0 = Math.min(nx0, nx1 - minPx);
        if (h.includes("e")) nx1 = Math.max(nx1, nx0 + minPx);
        if (h.includes("n")) ny0 = Math.min(ny0, ny1 - minPx);
        if (h.includes("s")) ny1 = Math.max(ny1, ny0 + minPx);

        nx0 = Math.max(0, Math.min(cw - minPx, nx0));
        ny0 = Math.max(0, Math.min(ch - minPx, ny0));
        nx1 = Math.max(minPx, Math.min(cw, nx1));
        ny1 = Math.max(minPx, Math.min(ch, ny1));

        const rx = nx0;
        const ry = ny0;
        const rw = Math.max(minPx, nx1 - nx0);
        const rh = Math.max(minPx, ny1 - ny0);

        r.x = clamp01(rx / cw);
        r.y = clamp01(ry / ch);
        r.w = clamp01(Math.min(rw / cw, 1 - r.x));
        r.h = clamp01(Math.min(rh / ch, 1 - r.y));
        drawFridgeEditor();
      }
    });

    const endDrag = () => {
      if (!fridgeEditor.drag) return;
      if (!elements.fridgeCropCanvas) return;
      const cw = elements.fridgeCropCanvas.width;
      const ch = elements.fridgeCropCanvas.height;

      if (fridgeEditor.drag.mode === "draw") {
        const x0 = fridgeEditor.drag.startX;
        const y0 = fridgeEditor.drag.startY;
        const x1 = fridgeEditor.drag.currentX;
        const y1 = fridgeEditor.drag.currentY;
        const rx = Math.min(x0, x1);
        const ry = Math.min(y0, y1);
        const rw = Math.abs(x1 - x0);
        const rh = Math.abs(y1 - y0);
        const minPx = 18;
        if (rw >= minPx && rh >= minPx) {
          pushFridgeUndo();
          const region = normalizeRegion({ id: newId("r"), x: rx / cw, y: ry / ch, w: rw / cw, h: rh / ch });
          fridgeEditor.regions.push(region);
          fridgeEditor.selectedId = region.id;
          updateFridgeEditorControls();
        }
      }

      fridgeEditor.drag = null;
      drawFridgeEditor();
    };

    elements.fridgeCropCanvas.addEventListener("pointerup", () => endDrag());
    elements.fridgeCropCanvas.addEventListener("pointercancel", () => endDrag());

    document.addEventListener("keydown", (event) => {
      if (!fridgeEditor.isOpen) return;
      if (event.key === "Escape") {
        if (fridgeEditor.drag) {
          event.preventDefault();
          fridgeEditor.drag = null;
          drawFridgeEditor();
          return;
        }
        if (fridgeEditor.selectedId) {
          event.preventDefault();
          fridgeEditor.selectedId = null;
          drawFridgeEditor();
        }
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedRegion();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoFridge();
      }
    });
  }

  async function cropRegionToTile(region, tileIndex) {
    if (!state.imageEl) return null;
    const img = state.imageEl;
    const srcW = img.naturalWidth || img.width || 0;
    const srcH = img.naturalHeight || img.height || 0;
    if (!srcW || !srcH) return null;

    const sx = Math.round(clamp01(region.x) * srcW);
    const sy = Math.round(clamp01(region.y) * srcH);
    const ex = Math.round(clamp01(region.x + region.w) * srcW);
    const ey = Math.round(clamp01(region.y + region.h) * srcH);
    const sw = Math.max(1, ex - sx);
    const sh = Math.max(1, ey - sy);

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

    let previewUrl = "";
    try {
      previewUrl = canvas.toDataURL("image/png");
    } catch {
      previewUrl = "";
    }

    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
    if (!blob) {
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const response = await fetch(dataUrl);
        blob = await response.blob();
      } catch {
        blob = null;
      }
    }
    if (!blob) return null;
    try {
      return { file: new File([blob], `fridge-tile-${tileIndex}.png`, { type: "image/png" }), previewUrl };
    } catch {
      blob.name = `fridge-tile-${tileIndex}.png`;
      return { file: blob, previewUrl };
    }
  }

  function fnv1a(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function rng() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function apiInfer({
    file,
    model,
    compare = false,
    variant = "base",
    sensitivityPercent = 100,
    save = false,
    meta = null,
  }) {
    const form = new FormData();
    form.append("model", String(model || "101"));
    form.append("sensitivity", String(Math.max(35, Math.min(100, Number(sensitivityPercent) || 100))));
    if (compare) form.append("compare", "1");
    if (variant && variant !== "base") form.append("variant", String(variant));
    if (save) form.append("save", "1");
    if (meta && typeof meta === "object") {
      for (const [k, v] of Object.entries(meta)) {
        if (v === undefined || v === null) continue;
        form.append(String(k), typeof v === "string" ? v : JSON.stringify(v));
      }
    }

    try {
      form.append("image", file, file.name || "upload");
    } catch {
      form.append("image", file);
    }

    let response;
    try {
      response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/infer") : "/api/infer", {
        method: "POST",
        body: form,
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
    } catch {
      const err = new Error("Network issue while contacting inference service. Please retry.");
      err.status = 0;
      err.code = "network_error";
      err.retryable = true;
      throw err;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || !data.ok) {
      const code = String(data?.error || "");
      const msg = (data && data.message) || "Unable to run prediction right now.";
      const err = new Error(msg);
      err.status = Number(response.status || 0);
      err.code = code;
      err.retryable = err.status >= 500 || code.startsWith("inference_") || code === "db_error";
      throw err;
    }
    if (!data.prediction) throw new Error("Missing prediction response.");
    return data.prediction;
  }

  function shouldRetryInferError(err) {
    const status = Number(err?.status || 0);
    const code = String(err?.code || "").toLowerCase();
    if (Boolean(err?.retryable)) return true;
    if (!status || status >= 500) return true;
    if (code.startsWith("inference_")) return true;
    if (code === "network_error") return true;
    return false;
  }

  async function apiInferWithRetry(payload, maxAttempts = 3) {
    let attempt = 0;
    let lastError = null;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await apiInfer(payload);
      } catch (err) {
        lastError = err;
        if (attempt >= maxAttempts || !shouldRetryInferError(err)) throw err;
        await wait(180 * attempt);
      }
    }
    throw lastError || new Error("Unable to run prediction right now.");
  }

  async function apiInferUntilAvailable(payload, { onRetry = null } = {}) {
    let attempt = 0;
    let delayMs = 260;
    while (true) {
      attempt += 1;
      try {
        return await apiInfer(payload);
      } catch (err) {
        if (!shouldRetryInferError(err)) throw err;
        if (typeof onRetry === "function") {
          try {
            onRetry({ attempt, error: err, delayMs });
          } catch {
            // Retry status updates are best-effort only.
          }
        }
        await wait(delayMs);
        delayMs = Math.min(4000, Math.round(delayMs * 1.25 + 120));
      }
    }
  }

  async function apiCorrectPrediction(predictionId, label) {
    const response = await fetch(window.withAppBasePath ? window.withAppBasePath(`/api/predictions/${predictionId}/correct`) : `/api/predictions/${predictionId}/correct`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ label }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || !data.ok || !data.prediction) {
      const msg = (data && data.message) || "Unable to save correction right now.";
      throw new Error(msg);
    }
    return data.prediction;
  }

  function normalizeTopK(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map((x) => ({
        label: prettyLabel(x && x.label),
        score: Number(x && x.score),
      }))
      .filter((x) => x.label && Number.isFinite(x.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function computeMetricsFromImage(imageEl) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(imageEl, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const hist = new Array(32).fill(0);
    const gray = new Float32Array(size * size);

    for (let i = 0; i < size * size; i += 1) {
      const r = data[i * 4 + 0];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const value = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      gray[i] = value;
      hist[Math.min(31, Math.floor(value * 32))] += 1;
    }

    let entropy = 0;
    const total = size * size;
    for (const count of hist) {
      if (!count) continue;
      const p = count / total;
      entropy -= p * Math.log2(p);
    }

    let edgeSum = 0;
    for (let y = 1; y < size - 1; y += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        const idx = y * size + x;
        const gx =
          -gray[idx - size - 1] -
          2 * gray[idx - 1] -
          gray[idx + size - 1] +
          gray[idx - size + 1] +
          2 * gray[idx + 1] +
          gray[idx + size + 1];
        const gy =
          -gray[idx - size - 1] -
          2 * gray[idx - size] -
          gray[idx - size + 1] +
          gray[idx + size - 1] +
          2 * gray[idx + size] +
          gray[idx + size + 1];
        edgeSum += Math.sqrt(gx * gx + gy * gy);
      }
    }
    const edgeDensity = edgeSum / ((size - 2) * (size - 2));

    const hashSource = hist.join(",") + `|${entropy.toFixed(3)}|${edgeDensity.toFixed(4)}`;
    return { entropy, edgeDensity, hash: String(fnv1a(hashSource)) };
  }

  function recommendedModelFor(metrics) {
    if (!metrics) return { model: "101", reason: "Upload an image to analyze texture and edges." };

    const entropyScore = clamp(metrics.entropy / 5, 0, 1);
    const edgeScore = clamp(metrics.edgeDensity / 0.55, 0, 1);
    const texture = (entropyScore * 0.55 + edgeScore * 0.45) * 100;

    if (texture >= 60) {
      return {
        model: "101",
        reason: `High texture detected (score ${texture.toFixed(0)}/100) - 101x101 recommended for finer details.`,
      };
    }

    return {
      model: "23",
      reason: `Lower texture detected (score ${texture.toFixed(0)}/100) - 23x23 recommended for faster feedback.`,
    };
  }

  function openSetGate(confidence, disagreement) {
    const threshold = disagreement ? 0.62 : 0.55;
    return { isVegetable: confidence >= threshold, threshold };
  }

  function setSelectedModel(value) {
    if (!elements.resolutionInput) return;
    elements.resolutionInput.value = value;
    elements.choiceCards.forEach((card) => {
      card.classList.toggle("is-selected", card.getAttribute("data-model-choice") === value);
    });
    if (elements.resultModel) elements.resultModel.textContent = modelLabel(value);

    if (state.imageFile && state.last.single) {
      runSinglePrediction({ quiet: true }).catch(() => null);
    }
  }

  function setSensitivity(percent) {
    const normalized = clamp(percent / 100, 0.35, 1);
    state.sensitivity = normalized;
    if (elements.sensitivityLabel) elements.sensitivityLabel.textContent = `${percent}%`;
  }

  function renderTopList(items) {
    if (!elements.topList) return;
    elements.topList.innerHTML = "";

    normalizeTopK(items).forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = `result-metric ${idx === 0 ? "is-good" : ""}`;
      li.innerHTML = `<span>${item.label}</span><strong>${formatPct(item.score)}</strong>`;
      elements.topList.appendChild(li);
    });
  }

  function confidenceTierLabel(confidence) {
    if (confidence >= 0.95) return "Very strong signal";
    if (confidence >= 0.85) return "Strong signal";
    if (confidence >= 0.7) return "Moderate signal";
    return "Weak signal";
  }

  function buildInsightDataset(prediction) {
    const topK = normalizeTopK(prediction?.topK);
    const confidence = clamp(Number(prediction?.confidence) || 0, 0, 1);
    const label = prettyLabel(prediction?.label || "");

    const ranked = topK.length
      ? topK.slice(0, 5)
      : [{ label: label || "Unknown", score: confidence }];

    if (ranked.length) {
      ranked[0] = { label: ranked[0].label || label || "Unknown", score: confidence || ranked[0].score || 0 };
    }

    const second = ranked[1] ? clamp(Number(ranked[1].score) || 0, 0, 1) : 0;
    const margin = clamp(confidence - second, 0, 1);
    const top3 = clamp(
      ranked.slice(0, 3).reduce((sum, item) => sum + clamp(Number(item.score) || 0, 0, 1), 0),
      0,
      1
    );

    const total = ranked.reduce((sum, item) => sum + Math.max(0, Number(item.score) || 0), 0);
    const probs = total > 0 ? ranked.map((item) => Math.max(0, Number(item.score) || 0) / total) : [1];
    let entropy = 0;
    for (const p of probs) {
      if (p <= 0) continue;
      entropy -= p * Math.log2(p);
    }
    const entropyMax = probs.length > 1 ? Math.log2(probs.length) : 1;
    const uncertainty = clamp(entropy / entropyMax, 0, 1);

    return { ranked, confidence, margin, top3, uncertainty };
  }

  function renderInsightBars(items) {
    if (!elements.resultProbBars) return;
    elements.resultProbBars.innerHTML = "";
    if (!items.length) {
      elements.resultProbBars.innerHTML = '<p class="text-muted small mb-0">No probability data yet.</p>';
      return;
    }

    items.slice(0, 5).forEach((item, idx) => {
      const score = clamp(Number(item.score) || 0, 0, 1);
      const row = document.createElement("div");
      row.className = `result-prob-row is-rank-${Math.min(5, idx + 1)}`;
      row.innerHTML = `
        <span class="result-prob-label">${escapeHtml(item.label)}</span>
        <span class="result-prob-track"><span class="result-prob-fill${idx === 0 ? " is-primary" : ""}"></span></span>
        <strong class="result-prob-value">${escapeHtml(formatPct(score))}</strong>
      `;
      elements.resultProbBars.appendChild(row);
      const fill = row.querySelector(".result-prob-fill");
      if (fill) {
        requestAnimationFrame(() => {
          fill.style.width = `${Math.round(score * 100)}%`;
        });
      }
    });
  }

  function resetInsightCharts() {
    if (elements.resultConfidenceDonut) {
      elements.resultConfidenceDonut.style.setProperty("--pct", "0%");
      elements.resultConfidenceDonut.classList.remove("is-mid", "is-warn");
    }
    if (elements.resultConfidenceDonutValue) elements.resultConfidenceDonutValue.textContent = "-";
    if (elements.resultConfidenceTier) elements.resultConfidenceTier.textContent = "Run prediction to render chart.";
    if (elements.resultProbBars) {
      elements.resultProbBars.innerHTML = '<p class="text-muted small mb-0">No probability data yet.</p>';
    }
    if (elements.resultMarginValue) elements.resultMarginValue.textContent = "-";
    if (elements.resultTop3Value) elements.resultTop3Value.textContent = "-";
    if (elements.resultEntropyValue) elements.resultEntropyValue.textContent = "-";
  }

  function renderInsightCharts(prediction) {
    const insights = buildInsightDataset(prediction);
    const pct = Math.round(insights.confidence * 1000) / 10;

    if (elements.resultConfidenceDonut) {
      elements.resultConfidenceDonut.style.setProperty("--pct", `${pct}%`);
      elements.resultConfidenceDonut.classList.remove("is-mid", "is-warn");
      if (insights.confidence < 0.7) {
        elements.resultConfidenceDonut.classList.add("is-warn");
      } else if (insights.confidence < 0.9) {
        elements.resultConfidenceDonut.classList.add("is-mid");
      }
    }
    if (elements.resultConfidenceDonutValue) elements.resultConfidenceDonutValue.textContent = formatPct(insights.confidence);
    if (elements.resultConfidenceTier) {
      const marginText = formatPct(insights.margin);
      elements.resultConfidenceTier.textContent = `${confidenceTierLabel(insights.confidence)} - margin ${marginText}`;
    }

    renderInsightBars(insights.ranked);

    if (elements.resultMarginValue) elements.resultMarginValue.textContent = formatPct(insights.margin);
    if (elements.resultTop3Value) elements.resultTop3Value.textContent = formatPct(insights.top3);
    if (elements.resultEntropyValue) elements.resultEntropyValue.textContent = `${Math.round(insights.uncertainty * 100)}/100`;
  }

  function renderOpenSetBadge(confidence, disagreement) {
    const gate = openSetGate(confidence, disagreement);

    if (elements.openSetBadge) elements.openSetBadge.hidden = !gate.isVegetable;
    if (elements.openSetBadgeWarn) elements.openSetBadgeWarn.hidden = gate.isVegetable;
    if (elements.openSetBadge) {
      elements.openSetBadge.innerHTML = '<span class="status-dot"></span> Verified';
      elements.openSetBadge.classList.add("status-badge--good");
      elements.openSetBadge.classList.remove("status-badge--warn");
    }
    if (elements.openSetBadgeWarn) {
      elements.openSetBadgeWarn.innerHTML = '<span class="status-dot"></span> Uncertain';
      elements.openSetBadgeWarn.classList.remove("status-badge--good");
      elements.openSetBadgeWarn.classList.add("status-badge--warn");
    }

    return gate;
  }

  function buildWhyText({ isVegetable, disagreement, stabilityScore, recommendation }) {
    if (!isVegetable) {
      return "Low confidence suggests the image may not match any known class strongly. Try better lighting, tighter framing, or a clearer angle.";
    }

    if (disagreement) {
      return "The two model resolutions disagree, which often happens with fine textures, cluttered backgrounds, or partial occlusion. Try the recommended model and compare results.";
    }

    if (stabilityScore !== null && stabilityScore < 70) {
      return "Confidence is sensitive to small changes (crop/noise/resize). For ambiguous images, upload a sharper photo and keep the subject centered.";
    }

    if (recommendation?.model === "101") {
      return "Texture looks detailed - the high-resolution model tends to be more consistent when edges and patterns matter.";
    }

    return "This looks like a clean match. You can still switch models to verify consistency, especially if the photo has mixed ingredients.";
  }

  function setFeedbackStatus(message, kind = "muted") {
    if (!elements.feedbackStatus) return;
    elements.feedbackStatus.className = `text-${kind} small mb-0 mt-2`;
    elements.feedbackStatus.textContent = message || "";
  }

  function buildLabelOptionsHtml(selectedRaw = "") {
    return classOptions
      .map((opt) => {
        const selected = String(opt.raw) === String(selectedRaw) ? " selected" : "";
        return `<option value="${escapeHtml(opt.raw)}"${selected}>${escapeHtml(opt.pretty)}</option>`;
      })
      .join("");
  }

  function fillLabelSelect(selectEl, selectedRaw = "") {
    if (!selectEl) return;
    selectEl.innerHTML = buildLabelOptionsHtml(selectedRaw);
  }

  function normalizeClassRaw(label) {
    const raw = String(label || "").trim();
    if (!raw) return "";
    const exact = classOptions.find((opt) => opt.raw === raw);
    if (exact) return exact.raw;

    const lowerRaw = raw.toLowerCase();
    const byPretty = classOptions.find((opt) => opt.pretty.toLowerCase() === lowerRaw);
    if (byPretty) return byPretty.raw;

    const normalized = raw.replace(/_/g, " ").toLowerCase();
    const fuzzy = classOptions.find((opt) => opt.pretty.toLowerCase() === normalized);
    return fuzzy ? fuzzy.raw : "";
  }

  function ensureFeedbackOption(value) {
    if (!elements.feedbackLabelSelect) return;
    if (!value) return;
    const existing = Array.from(elements.feedbackLabelSelect.options || []).find((opt) => opt.value === value);
    if (existing) return;
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = prettyLabel(value);
    elements.feedbackLabelSelect.appendChild(opt);
  }

  function setupFeedbackOptions() {
    if (!elements.feedbackLabelSelect) return;
    fillLabelSelect(elements.feedbackLabelSelect);
  }

  function renderFeedbackUI(prediction) {
    if (!elements.feedbackCard || !elements.feedbackLabelSelect) return;
    const predictionId = Number(prediction?.id || 0);
    if (!predictionId) {
      elements.feedbackCard.hidden = true;
      return;
    }

    elements.feedbackCard.hidden = false;
    const selectedRaw = normalizeClassRaw(prediction.label) || String(prediction.label || "").trim();
    ensureFeedbackOption(selectedRaw);
    elements.feedbackLabelSelect.value = selectedRaw;

    const corrected = Boolean(prediction?.is_corrected);
    if (elements.feedbackCorrectedBadge) elements.feedbackCorrectedBadge.hidden = !corrected;
    if (corrected) {
      const originalText = prettyLabel(prediction?.original_label || "");
      const currentText = prettyLabel(prediction?.label || "");
      setFeedbackStatus(`Corrected: ${originalText} -> ${currentText}`, "success");
    } else {
      setFeedbackStatus(
        "Corrections update your saved history record and replace the displayed label.",
        "muted"
      );
    }
  }

  async function applyPredictionFeedback() {
    const prediction = state.last.single;
    const predictionId = Number(prediction?.id || 0);
    if (!predictionId) {
      setFeedbackStatus("Sign in and run a saved prediction before applying correction.", "warning");
      return;
    }
    if (!elements.feedbackLabelSelect) return;

    const correctedLabel = String(elements.feedbackLabelSelect.value || "").trim();
    if (!correctedLabel) {
      setFeedbackStatus("Select a corrected label first.", "warning");
      return;
    }

    if (elements.feedbackApplyBtn) elements.feedbackApplyBtn.disabled = true;
    setFeedbackStatus("Saving correction...", "muted");
    try {
      const updated = await apiCorrectPrediction(predictionId, correctedLabel);
      state.last.single = updated;
      const active = getActiveItem();
      if (active) active.lastSingle = updated;
      renderSingleUI(updated);
      setFeedbackStatus("Correction saved. History now uses your corrected label.", "success");
      try {
        window.dispatchEvent(new Event("predictor:recent_refresh"));
      } catch {
        // ignore
      }
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "Unable to save correction.";
      setFeedbackStatus(msg, "warning");
    } finally {
      if (elements.feedbackApplyBtn) elements.feedbackApplyBtn.disabled = false;
    }
  }

  function resetSingleResultUI() {
    if (elements.resultLabel) elements.resultLabel.textContent = "-";
    if (elements.resultConfidence) elements.resultConfidence.textContent = "-";
    if (elements.topList) elements.topList.innerHTML = "";
    if (elements.whyText)
      elements.whyText.textContent =
        "Select an image and run classification to generate a prediction for the active item.";
    if (elements.openSetBadge) elements.openSetBadge.hidden = true;
    if (elements.openSetBadgeWarn) elements.openSetBadgeWarn.hidden = true;
    if (elements.feedbackCard) elements.feedbackCard.hidden = true;
    resetInsightCharts();
  }

  function ensureResultsVisible() {
    if (elements.resultEmpty) elements.resultEmpty.hidden = true;
    if (elements.resultFilled) elements.resultFilled.hidden = false;
    elements.resultFilled?.classList.add("reveal", "is-visible");
  }

  function renderSingleUI(prediction) {
    if (!prediction) return;

    if (elements.resultLabel) elements.resultLabel.textContent = prettyLabel(prediction.label);
    if (elements.resultConfidence) elements.resultConfidence.textContent = formatPct(Number(prediction.confidence) || 0);
    renderTopList(prediction.topK);

    const compare = state.last.compare;
    const disagreement = Boolean(compare && compare.p23.label !== compare.p101.label);
    const gate = renderOpenSetBadge(Number(prediction.confidence) || 0, disagreement);

    const rec = recommendedModelFor(state.metrics);
    const stability = state.last.compare?.stability ?? null;
    if (elements.whyText) {
      elements.whyText.textContent = buildWhyText({
        isVegetable: gate.isVegetable,
        disagreement,
        stabilityScore: stability,
        recommendation: rec,
      });
    }

    if (elements.resultEmpty) elements.resultEmpty.hidden = true;
    if (elements.resultFilled) elements.resultFilled.hidden = false;
    elements.resultFilled?.classList.add("reveal", "is-visible");
    renderInsightCharts(prediction);
    renderFeedbackUI(prediction);
  }

  async function runSinglePrediction({ quiet = false } = {}) {
    if (!state.imageFile) return;

    const model = elements.resolutionInput?.value || "101";
    const sensitivityPercent = Math.round(state.sensitivity * 100);

    if (elements.runButton) {
      elements.runButton.disabled = true;
      elements.runButton.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Running';
    }

    let prediction = null;
    try {
      prediction = await apiInferUntilAvailable(
        {
          file: state.imageFile,
          model,
          compare: false,
          variant: "base",
          sensitivityPercent,
          save: !quiet,
          meta: { predict_mode: "single" },
        },
        {
          onRetry: ({ attempt }) => {
            if (elements.runButton) {
              elements.runButton.innerHTML =
                `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Waking model (retry ${attempt})`;
            }
            if (elements.whyText) {
              elements.whyText.textContent = `Model is waking up. Retrying... (${attempt})`;
            }
          },
        }
      );
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "Unable to run prediction right now.";
      if (elements.whyText) elements.whyText.textContent = msg;
      if (elements.resultEmpty) elements.resultEmpty.hidden = false;
      if (elements.resultFilled) elements.resultFilled.hidden = true;
      return;
    } finally {
      if (elements.runButton) {
        elements.runButton.disabled = false;
        elements.runButton.innerHTML =
          state.batch.length > 1 ? '<i class="bi bi-magic"></i> Classify batch' : '<i class="bi bi-magic"></i> Classify';
      }
    }

    state.last.single = prediction;
    const active = getActiveItem();
    if (active) active.lastSingle = prediction;
    renderSingleUI(prediction);

    if (!quiet) {
      try {
        window.dispatchEvent(new Event("predictor:recent_refresh"));
      } catch {
        // ignore
      }
    }
  }

  async function runCompareNow() {
    if (!state.imageFile) return;

    if (elements.runCompare) elements.runCompare.disabled = true;

    let prediction = null;
    try {
      prediction = await apiInfer({
        file: state.imageFile,
        model: elements.resolutionInput?.value || "101",
        compare: true,
        variant: "base",
        sensitivityPercent: Math.round(state.sensitivity * 100),
        save: false,
      });
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "Unable to run compare right now.";
      if (elements.agreementTitle) elements.agreementTitle.textContent = "Compare unavailable";
      if (elements.agreementDetail) elements.agreementDetail.textContent = msg;
      return;
    } finally {
      if (elements.runCompare) elements.runCompare.disabled = false;
    }

    const p23 = {
      model: "23",
      label: prediction?.compare?.p23?.label || "-",
      confidence: Number(prediction?.compare?.p23?.confidence) || 0,
    };
    const p101 = {
      model: "101",
      label: prediction?.compare?.p101?.label || "-",
      confidence: Number(prediction?.compare?.p101?.confidence) || 0,
    };
    const agrees = Boolean(prediction?.compare?.agrees);
    const gap = Number(prediction?.compare?.gap) || Math.abs(p101.confidence - p23.confidence);

    state.last.compare = { p23, p101, stability: null, stabilityDetail: null, agrees, gap };

    const active = getActiveItem();
    if (active) active.lastCompare = state.last.compare;

    if (elements.compareLabel23) elements.compareLabel23.textContent = prettyLabel(p23.label);
    if (elements.compareConf23) elements.compareConf23.textContent = formatPct(p23.confidence);
    if (elements.compareNote23)
      elements.compareNote23.textContent = p23.confidence < 0.55 ? "Low confidence - image may be ambiguous at low resolution." : "Looks stable for quick checks.";

    if (elements.compareLabel101) elements.compareLabel101.textContent = prettyLabel(p101.label);
    if (elements.compareConf101) elements.compareConf101.textContent = formatPct(p101.confidence);
    if (elements.compareNote101)
      elements.compareNote101.textContent = p101.confidence < 0.6 ? "Moderate confidence - try a tighter crop." : "Strong signal at higher resolution.";

    const agreementTitle = agrees ? "Agreement" : "Disagreement";
    const agreementDetail = agrees
      ? `Both models predict ${prettyLabel(p101.label)}. Confidence gap: ${formatPct(gap)}.`
      : `23x23 predicts ${prettyLabel(p23.label)} (${formatPct(p23.confidence)}), while 101x101 predicts ${prettyLabel(
          p101.label
        )} (${formatPct(
          p101.confidence
        )}). Gap: ${formatPct(gap)}.`;

    if (elements.agreementTitle) elements.agreementTitle.textContent = agreementTitle;
    if (elements.agreementDetail) elements.agreementDetail.textContent = agreementDetail;

    if (elements.stabilityScore) elements.stabilityScore.textContent = "—";
    if (elements.stabilityDetail) elements.stabilityDetail.textContent = "Stability scoring is not enabled for the live model.";
    if (elements.stabilityBadge) elements.stabilityBadge.hidden = true;

    if (state.last.single) renderSingleUI(state.last.single);
    else ensureResultsVisible();
  }

  function updateRecommendationUI() {
    const rec = recommendedModelFor(state.metrics);
    state.recommendedModel = rec.model;

    if (elements.recommendationTitle) {
      elements.recommendationTitle.textContent = `${modelLabel(rec.model)} suggested`;
    }
    if (elements.recommendationReason) elements.recommendationReason.textContent = rec.reason;
    if (elements.recommendationBadge) elements.recommendationBadge.hidden = false;
    if (elements.applyRecommendation) elements.applyRecommendation.disabled = false;
  }

  let nextBatchId = 1;

  function makeBatchId() {
    const id = nextBatchId;
    nextBatchId += 1;
    return `img_${Date.now()}_${id}`;
  }

  function getActiveItem() {
    return state.batch.find((item) => item.id === state.activeId) || null;
  }

  function updateBatchUI() {
    const count = state.batch.length;
    const active = getActiveItem();
    const mode = getPredictMode();
    state.predictMode = mode;

    if (elements.batchCount) elements.batchCount.textContent = pluralize(count, "image");
    if (elements.batchQueueEmpty) elements.batchQueueEmpty.hidden = count > 0;
    if (elements.batchThumbs) elements.batchThumbs.hidden = count === 0;

    if (elements.runButton) {
      elements.runButton.disabled = count === 0;
      if (mode === "fridge") {
        elements.runButton.innerHTML =
          count > 1
            ? '<i class="bi bi-grid-3x3-gap"></i> Smart Fridge (active)'
            : '<i class="bi bi-grid-3x3-gap"></i> Smart Fridge';
      } else {
        elements.runButton.innerHTML =
          count > 1
            ? '<i class="bi bi-magic"></i> Classify batch'
            : '<i class="bi bi-magic"></i> Classify';
      }
    }

    if (elements.clearButton) elements.clearButton.hidden = count === 0;
    if (elements.sensitivitySlider) elements.sensitivitySlider.disabled = count === 0;
    if (elements.startGame) elements.startGame.disabled = count === 0;

    if (elements.fileNameEl) {
      elements.fileNameEl.textContent = active
        ? `Active: ${active.name} (${pluralize(count, "image")} queued)`
        : "No images selected";
    }
  }

  function renderBatchQueue() {
    if (!elements.batchThumbs) return;

    elements.batchThumbs.innerHTML = "";
    for (const item of state.batch) {
      const el = document.createElement("div");
      el.className = `batch-item ${item.id === state.activeId ? "is-active" : ""}`;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Select ${item.name}`);

      const statusHint =
        item.status === "error"
          ? " (failed to load)"
          : item.status === "loading"
          ? " (analyzing...)"
          : "";

      el.innerHTML =
        `<button type="button" class="batch-remove" data-remove="${escapeHtml(
          item.id
        )}" aria-label="Remove image"><i class="bi bi-x"></i></button>` +
        `<img class="batch-thumb" src="${escapeHtml(item.url)}" alt="Preview of ${escapeHtml(
          item.name
        )}">` +
        `<div class="batch-meta">${escapeHtml(item.name)}${escapeHtml(statusHint)}</div>`;

      const removeBtn = el.querySelector("[data-remove]");
      removeBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeBatchItem(item.id);
      });

      const select = () => setActiveItem(item.id);
      el.addEventListener("click", (event) => {
        if (event.target.closest("[data-remove]")) return;
        select();
      });
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });

      elements.batchThumbs.appendChild(el);
    }

    updateBatchUI();
  }

  function setActiveItem(id) {
    const item = state.batch.find((x) => x.id === id) || null;
    state.activeId = item ? item.id : null;
    state.imageFile = item?.file || null;
    state.imageEl = item?.imageEl || null;
    state.metrics = item?.metrics || null;
    state.imageHash = item?.hash || "";
    state.last.single = item?.lastSingle || null;
    state.last.compare = item?.lastCompare || null;

    if (elements.previewImg) {
      elements.previewImg.hidden = true;
      elements.previewImg.removeAttribute("src");
    }

    if (item?.metrics) {
      updateRecommendationUI();
    } else {
      state.recommendedModel = null;
      if (elements.recommendationTitle)
        elements.recommendationTitle.textContent = "Upload an image to get a recommendation";
      if (elements.recommendationReason)
        elements.recommendationReason.textContent =
          "We'll analyze texture and edge detail to suggest the best model.";
      if (elements.recommendationBadge) elements.recommendationBadge.hidden = true;
      if (elements.applyRecommendation) elements.applyRecommendation.disabled = true;
    }

    if (elements.resultFilled && !elements.resultFilled.hidden) {
      if (state.last.single) renderSingleUI(state.last.single);
      else resetSingleResultUI();
    }

    renderBatchQueue();
    scheduleFridgeAutoRun();
    scheduleCompareAutoRun();
  }

  function createBatchItem(file) {
    const id = makeBatchId();
    const url = URL.createObjectURL(file);

    const item = {
      id,
      file,
      name: file.name || "image",
      url,
      status: "loading",
      imageEl: null,
      metrics: null,
      hash: "",
      lastSingle: null,
      lastCompare: null,
      batchResult: null,
    };

    const img = new Image();
    img.onload = () => {
      item.imageEl = img;
      item.metrics = computeMetricsFromImage(img);
      item.hash = item.metrics?.hash || String(fnv1a(`${item.name}|${file.size}`));
      item.status = "ready";

      if (state.activeId === item.id) {
        state.imageEl = item.imageEl;
        state.metrics = item.metrics;
        state.imageHash = item.hash;
        updateRecommendationUI();
      }

      renderBatchQueue();
      scheduleFridgeAutoRun();
      scheduleCompareAutoRun();
    };
    img.onerror = () => {
      item.status = "error";
      renderBatchQueue();
    };
    img.src = url;

    return item;
  }

  function addFiles(files) {
    const list = Array.from(files || []).filter((f) => f && String(f.type || "").startsWith("image/"));
    if (!list.length) return;

    for (const file of list) {
      const item = createBatchItem(file);
      state.batch.push(item);
      if (!state.activeId) state.activeId = item.id;
    }

    setActiveItem(state.activeId);
  }

  function removeBatchItem(id) {
    const idx = state.batch.findIndex((item) => item.id === id);
    if (idx < 0) return;

    const [removed] = state.batch.splice(idx, 1);
    try {
      URL.revokeObjectURL(removed.url);
    } catch {
      // ignore
    }

    if (state.activeId === id) {
      state.activeId = state.batch[0]?.id || null;
    }

    if (!state.batch.length) {
      // full reset
      clearPreview();
      return;
    }

    setActiveItem(state.activeId);
    renderBatchResults();
  }

  function renderBatchPagination(totalPages) {
    if (!elements.batchPagination) return;
    if (totalPages <= 1) {
      elements.batchPagination.hidden = true;
      elements.batchPagination.innerHTML = "";
      return;
    }

    const current = Math.max(1, Math.min(totalPages, Number(state.batchPage) || 1));
    elements.batchPagination.hidden = false;
    elements.batchPagination.innerHTML = "";

    const makeBtn = ({ label, page, active = false, disabled = false, ariaLabel = "" }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `batch-page-btn${active ? " is-active" : ""}`;
      btn.textContent = label;
      btn.disabled = disabled;
      if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
      if (active) btn.setAttribute("aria-current", "page");
      if (!disabled && Number.isFinite(page)) {
        btn.addEventListener("click", () => {
          state.batchPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
          renderBatchResults();
        });
      }
      return btn;
    };

    elements.batchPagination.appendChild(
      makeBtn({
        label: "‹",
        page: current - 1,
        disabled: current <= 1,
        ariaLabel: "Previous batch page",
      })
    );

    const maxButtons = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      elements.batchPagination.appendChild(makeBtn({ label: "1", page: 1 }));
      if (start > 2) {
        const dots = makeBtn({ label: "…", page: NaN, disabled: true, ariaLabel: "More pages" });
        dots.classList.add("is-dots");
        elements.batchPagination.appendChild(dots);
      }
    }

    for (let page = start; page <= end; page += 1) {
      elements.batchPagination.appendChild(
        makeBtn({
          label: String(page),
          page,
          active: page === current,
          ariaLabel: `Batch page ${page}`,
        })
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        const dots = makeBtn({ label: "…", page: NaN, disabled: true, ariaLabel: "More pages" });
        dots.classList.add("is-dots");
        elements.batchPagination.appendChild(dots);
      }
      elements.batchPagination.appendChild(makeBtn({ label: String(totalPages), page: totalPages }));
    }

    elements.batchPagination.appendChild(
      makeBtn({
        label: "›",
        page: current + 1,
        disabled: current >= totalPages,
        ariaLabel: "Next batch page",
      })
    );
  }

  function renderBatchResults() {
    if (!elements.batchResults || !elements.batchResultsEmpty) return;

    const results = state.batch.filter((item) => item.batchResult);
    if (!results.length) {
      if (elements.batchResultsShell) elements.batchResultsShell.hidden = true;
      elements.batchResultsEmpty.hidden = false;
      if (elements.batchSummary) elements.batchSummary.innerHTML = '<i class="bi bi-collection"></i> 0 items';
      renderBatchPagination(1);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(results.length / BATCH_PAGE_SIZE));
    state.batchPage = Math.max(1, Math.min(totalPages, Number(state.batchPage) || 1));
    const startIdx = (state.batchPage - 1) * BATCH_PAGE_SIZE;
    const pageItems = results.slice(startIdx, startIdx + BATCH_PAGE_SIZE);

    const verified = results.filter((item) => item.batchResult?.gate?.isVegetable).length;
    if (elements.batchSummary) {
      elements.batchSummary.innerHTML = `<i class="bi bi-collection"></i> ${pluralize(
        results.length,
        "item"
      )} - ${verified} verified - Page ${state.batchPage}/${totalPages}`;
    }

    elements.batchResults.innerHTML = "";
    for (const item of pageItems) {
      const { primary, gate, recommendation, why, model } = item.batchResult;
      const topK = normalizeTopK(primary.topK);
      const card = document.createElement("div");
      card.className = "glass batch-result";

      const badge = gate.isVegetable
        ? '<span class="status-badge status-badge--good"><span class="status-dot"></span> Verified</span>'
        : '<span class="status-badge status-badge--warn"><span class="status-dot"></span> Uncertain</span>';
      const savedBadge = primary.id
        ? '<span class="status-badge status-badge--info"><span class="status-dot"></span> Saved</span>'
        : "";
      const correctedBadge = primary.isCorrected
        ? `<span class="status-badge status-badge--accent" title="Original: ${escapeHtml(
            prettyLabel(primary.originalLabel || primary.label)
          )}"><span class="status-dot"></span> Corrected</span>`
        : "";
      const batchFeedbackHtml = primary.id
        ? `
              <div class="batch-feedback">
                <div class="batch-feedback-row">
                  <select class="form-select form-select-sm batch-feedback-select" data-batch-correct-select="${escapeHtml(
                    item.id
                  )}">
                    ${buildLabelOptionsHtml(primary.label)}
                  </select>
                  <button type="button" class="btn btn-ghost btn-sm" data-batch-correct-btn="${escapeHtml(item.id)}">
                    <i class="bi bi-check2-circle me-1"></i> Apply
                  </button>
                </div>
                <p class="text-muted small mb-0" data-batch-correct-status="${escapeHtml(item.id)}">
                  Correct this batch result if needed.
                </p>
              </div>
            `
        : `<p class="text-muted small mb-0 mt-2">Sign in to save batch results before correction.</p>`;

      card.innerHTML = `
        <div class="batch-result-header">
          <img class="batch-result-thumb" src="${escapeHtml(item.url)}" alt="Thumbnail for ${escapeHtml(item.name)}">
          <div>
            <p class="batch-result-title mb-0">${escapeHtml(prettyLabel(primary.label))}</p>
            <p class="batch-result-subtitle">${escapeHtml(item.name)} - ${escapeHtml(
              modelLabel(model)
            )}</p>
            <div class="d-flex gap-2 flex-wrap mt-2">
              ${badge}
              ${savedBadge}
              ${correctedBadge}
              <span class="batch-chip"><i class="bi bi-lightbulb"></i> ${escapeHtml(
                modelLabel(recommendation.model)
              )} recommended</span>
            </div>
          </div>
          <div class="text-end batch-confidence">
            <div class="batch-confidence-value">${formatPct(primary.confidence)}</div>
            <div class="batch-confidence-label">Confidence</div>
          </div>
        </div>
        <div class="batch-why mt-3">${escapeHtml(why)}</div>
        <div class="batch-details">
          <div class="row g-3 mt-2">
            <div class="col-12 col-lg-6">
              <div class="batch-panel">
                <p class="batch-panel-title mb-2">Top alternatives</p>
                <ul class="list-unstyled d-grid gap-2 mb-0">
                ${topK
                  .map(
                    (x, idx) =>
                      `<li class="result-metric ${idx === 0 ? "is-good" : ""}"><span>${escapeHtml(
                        x.label
                      )}</span><strong>${escapeHtml(formatPct(x.score))}</strong></li>`
                  )
                  .join("")}
                </ul>
              </div>
            </div>
            <div class="col-12 col-lg-6">
              <div class="batch-panel batch-panel--actions">
                <p class="batch-panel-title mb-2">Actions</p>
              <div class="d-flex gap-2 flex-wrap">
                  <button type="button" class="btn btn-ghost btn-sm" data-remove="${escapeHtml(
                    item.id
                  )}"><i class="bi bi-trash"></i> Remove</button>
                </div>
                ${batchFeedbackHtml}
                <p class="batch-footnote mb-0 mt-2">Use Compare and Smart Fridge tools on the active image.</p>
              </div>
            </div>
          </div>
        </div>
      `;

      card.querySelector(`[data-remove="${item.id}"]`)?.addEventListener("click", () =>
        removeBatchItem(item.id)
      );
      card.querySelector(`[data-batch-correct-btn="${item.id}"]`)?.addEventListener("click", async () => {
        const selectEl = card.querySelector(`[data-batch-correct-select="${item.id}"]`);
        const statusEl = card.querySelector(`[data-batch-correct-status="${item.id}"]`);
        const correctedLabel = String(selectEl?.value || "").trim();
        if (!primary.id || !correctedLabel) return;

        const btnEl = card.querySelector(`[data-batch-correct-btn="${item.id}"]`);
        if (btnEl) btnEl.disabled = true;
        if (statusEl) statusEl.textContent = "Saving correction...";
        try {
          const updated = await apiCorrectPrediction(primary.id, correctedLabel);
          primary.label = updated.label;
          primary.isCorrected = Boolean(updated.is_corrected);
          primary.originalLabel = updated.original_label || primary.originalLabel || primary.label;
          item.lastSingle = updated;
          if (state.activeId === item.id) {
            state.last.single = updated;
            renderSingleUI(updated);
          }
          renderBatchResults();
          try {
            window.dispatchEvent(new Event("predictor:recent_refresh"));
          } catch {
            // ignore
          }
        } catch (err) {
          if (statusEl) {
            statusEl.textContent =
              err && err.message ? String(err.message) : "Unable to save correction right now.";
          }
        } finally {
          if (btnEl) btnEl.disabled = false;
        }
      });

      elements.batchResults.appendChild(card);
    }

    if (elements.batchResultsShell) elements.batchResultsShell.hidden = false;
    elements.batchResultsEmpty.hidden = true;
    renderBatchPagination(totalPages);
  }

  async function runBatchNow() {
    if (!state.batch.length) return;

    const model = elements.resolutionInput?.value || "101";
    const activeBefore = state.activeId;
    const sensitivityPercent = Math.round(state.sensitivity * 100);

    if (elements.runButton) {
      elements.runButton.disabled = true;
      elements.runButton.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Running batch';
    }

    for (const [itemIndex, item] of state.batch.entries()) {
      let pred = null;
      try {
        pred = await apiInferUntilAvailable(
          {
            file: item.file,
            model,
            compare: false,
            variant: "base",
            sensitivityPercent,
            save: true,
            meta: { predict_mode: "single" },
          },
          {
            onRetry: ({ attempt }) => {
              if (elements.runButton) {
                elements.runButton.innerHTML =
                  `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Waking model (${itemIndex + 1}/${state.batch.length}, retry ${attempt})`;
              }
            },
          }
        );
      } catch (err) {
        const msg = err && err.message ? String(err.message) : "Prediction failed.";
        item.lastSingle = null;
        item.batchResult = {
          model,
          primary: { label: "Error", confidence: 0, topK: [] },
          gate: { isVegetable: false, threshold: 0.55 },
          recommendation: recommendedModelFor(item.metrics),
          why: msg,
        };
        continue;
      }

      const primary = {
        label: pred.label,
        confidence: Number(pred.confidence) || 0,
        topK: normalizeTopK(pred.topK),
        id: pred.id || null,
        isCorrected: Boolean(pred.is_corrected),
        originalLabel: pred.original_label || pred.label || "",
      };
      item.lastSingle = pred;

      const disagreement = false;
      const gate = openSetGate(primary.confidence, disagreement);
      const recommendation = recommendedModelFor(item.metrics);
      const why = buildWhyText({
        isVegetable: gate.isVegetable,
        disagreement,
        stabilityScore: null,
        recommendation,
      });

      item.batchResult = { model, primary, gate, recommendation, why };
    }

    state.batchPage = 1;
    renderBatchResults();

    if (elements.resultEmpty) elements.resultEmpty.hidden = true;
    if (elements.resultFilled) elements.resultFilled.hidden = false;
    elements.resultFilled?.classList.add("reveal", "is-visible");

    root.querySelector("#tab-batch")?.click();
    if (activeBefore) setActiveItem(activeBefore);

    if (elements.runButton) {
      elements.runButton.disabled = false;
      elements.runButton.innerHTML = '<i class="bi bi-magic"></i> Classify batch';
    }

    try {
      window.dispatchEvent(new Event("predictor:recent_refresh"));
    } catch {
      // ignore
    }
  }

  function setPreview(file) {
    if (!file) return;
    addFiles([file]);
  }

  function clearPreview() {
    for (const item of state.batch) {
      try {
        URL.revokeObjectURL(item.url);
      } catch {
        // ignore
      }
    }

    state.batch = [];
    state.batchPage = 1;
    state.fridgePage = 1;
    state.activeId = null;
    state.imageFile = null;
    state.imageEl = null;
    state.metrics = null;
    state.imageHash = "";
    state.recommendedModel = null;
    state.last.single = null;
    state.last.compare = null;
    state.fridgeLast = null;

    if (elements.fileInput) elements.fileInput.value = "";
    if (elements.previewImg) {
      elements.previewImg.hidden = true;
      elements.previewImg.removeAttribute("src");
    }
    if (elements.fileNameEl) elements.fileNameEl.textContent = "No images selected";

    if (elements.runButton) elements.runButton.disabled = true;
    if (elements.clearButton) elements.clearButton.hidden = true;

    if (elements.batchCount) elements.batchCount.textContent = "0 images";
    if (elements.batchQueueEmpty) elements.batchQueueEmpty.hidden = false;
    if (elements.batchThumbs) {
      elements.batchThumbs.hidden = true;
      elements.batchThumbs.innerHTML = "";
    }

    if (elements.batchSummary) elements.batchSummary.innerHTML = '<i class="bi bi-collection"></i> 0 items';
    if (elements.batchResults) elements.batchResults.innerHTML = "";
    if (elements.batchResultsShell) elements.batchResultsShell.hidden = true;
    if (elements.batchPagination) {
      elements.batchPagination.hidden = true;
      elements.batchPagination.innerHTML = "";
    }
    if (elements.batchResultsEmpty) elements.batchResultsEmpty.hidden = false;

    if (elements.sensitivitySlider) {
      elements.sensitivitySlider.disabled = true;
      elements.sensitivitySlider.value = "100";
    }
    if (elements.sensitivityLabel) elements.sensitivityLabel.textContent = "100%";
    setSensitivity(100);

    if (elements.recommendationTitle)
      elements.recommendationTitle.textContent = "Upload an image to get a recommendation";
    if (elements.recommendationReason)
      elements.recommendationReason.textContent =
        "We'll analyze texture and edge detail to suggest the best model.";
    if (elements.recommendationBadge) elements.recommendationBadge.hidden = true;
    if (elements.applyRecommendation) elements.applyRecommendation.disabled = true;

    if (elements.stressList) elements.stressList.innerHTML = "";
    if (elements.startGame) elements.startGame.disabled = true;
    if (elements.gameArea) elements.gameArea.hidden = true;
    if (elements.gameOptions) elements.gameOptions.innerHTML = "";
    if (elements.gameResult) elements.gameResult.hidden = true;
    if (elements.previewImg) elements.previewImg.classList.remove("is-blurred");
    gameState.active = false;
    gameState.round = 0;
    gameState.locked = false;

    if (elements.resultEmpty) elements.resultEmpty.hidden = false;
    if (elements.resultFilled) elements.resultFilled.hidden = true;

    if (elements.fridgeResults) elements.fridgeResults.hidden = true;
    if (elements.fridgeEmpty) elements.fridgeEmpty.hidden = false;
    if (elements.fridgeTiles) {
      elements.fridgeTiles.innerHTML = "";
      delete elements.fridgeTiles.dataset.grid;
      delete elements.fridgeTiles.dataset.cols;
    }
    if (elements.fridgeSummary) elements.fridgeSummary.innerHTML = "";
    if (elements.fridgePagination) {
      elements.fridgePagination.hidden = true;
      elements.fridgePagination.innerHTML = "";
    }
  }

  async function renderStressResult(tag) {
    if (!elements.stressList) return;

    if (!state.imageFile) return;

    const model = elements.resolutionInput?.value || "101";
    const sensitivityPercent = Math.round(state.sensitivity * 100);

    const buttons = elements.stressButtons || [];
    buttons.forEach((b) => (b.disabled = true));

    let base = state.last.single;
    if (!base || String(base.model) !== String(model)) {
      try {
        base = await apiInfer({
          file: state.imageFile,
          model,
          compare: false,
          variant: "base",
          sensitivityPercent,
          save: false,
        });
      } catch {
        base = null;
      }
    }

    let stressed = null;
    try {
      stressed = await apiInfer({
        file: state.imageFile,
        model,
        compare: false,
        variant: tag,
        sensitivityPercent,
        save: false,
      });
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "Unable to run stress test.";
      if (elements.stressHint) elements.stressHint.textContent = msg;
      return;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }

    const baseConf = base ? Number(base.confidence) || 0 : Number(stressed.confidence) || 0;
    const stressedConf = Number(stressed.confidence) || 0;
    const delta = clamp(baseConf - stressedConf, -0.5, 0.9);

    const li = document.createElement("li");
    const warn = delta > 0.12 || stressedConf < 0.5;
    li.className = `result-metric ${warn ? "is-warn" : "is-good"}`;
    li.innerHTML = `<span>${String(tag || "").toUpperCase()} -> ${escapeHtml(prettyLabel(stressed.label))}</span><strong>${formatPct(
      stressedConf
    )}</strong>`;

    elements.stressList.prepend(li);
    const items = Array.from(elements.stressList.children);
    items.slice(6).forEach((el) => el.remove());

    if (elements.stressHint) {
      elements.stressHint.textContent = warn
        ? `Noticeable confidence drop (${formatPct(delta)}). Consider a clearer photo or switch models.`
        : `Minor impact (${formatPct(delta)}). Looks robust under ${tag}.`;
    }
  }

  function computeFridgeColumns(count) {
    const n = Number(count) || 0;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    if (n <= 16) return 4;
    return 5;
  }

  function isCountableFridgeLabel(label) {
    const key = String(label || "").trim();
    return Boolean(key) && key !== "Error" && key !== "Unavailable";
  }

  function createFridgeTileUI(tileCount, columns, gridHint) {
    if (!elements.fridgeTiles) return [];
    const preferredCols = columns || computeFridgeColumns(tileCount);
    const containerWidth = elements.fridgeTiles.clientWidth || elements.fridgeTiles.parentElement?.clientWidth || 0;
    const minTileWidth = 184;
    const maxColsByWidth =
      containerWidth > 0 ? Math.max(1, Math.floor((containerWidth + 10) / (minTileWidth + 10))) : preferredCols;
    const cols = Math.max(1, Math.min(preferredCols, maxColsByWidth));
    const hintedCols = Number(gridHint) || preferredCols;
    elements.fridgeTiles.dataset.grid = String(Math.min(hintedCols, cols));
    elements.fridgeTiles.dataset.cols = String(cols);
    elements.fridgeTiles.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    elements.fridgeTiles.innerHTML = "";

    const tiles = [];
    for (let i = 0; i < tileCount; i += 1) {
      const tile = document.createElement("div");
      tile.className = "tile-chip";

      const thumb = document.createElement("img");
      thumb.className = "tile-thumb";
      thumb.alt = `Tile ${i + 1} preview`;

      const chip = document.createElement("span");
      chip.className = "small tile-index";
      chip.textContent = `#${i + 1}`;

      const title = document.createElement("strong");
      title.className = "tile-label";
      title.textContent = "Running...";

      const meta = document.createElement("span");
      meta.className = "small tile-score";
      meta.textContent = "-";

      tile.appendChild(thumb);
      tile.appendChild(chip);
      tile.appendChild(title);
      tile.appendChild(meta);
      const feedbackWrap = document.createElement("div");
      feedbackWrap.className = "tile-feedback";
      feedbackWrap.hidden = true;

      const feedbackRow = document.createElement("div");
      feedbackRow.className = "tile-feedback-row";

      const feedbackSelect = document.createElement("select");
      feedbackSelect.className = "form-select form-select-sm tile-feedback-select";

      const feedbackApply = document.createElement("button");
      feedbackApply.type = "button";
      feedbackApply.className = "btn btn-ghost btn-sm";
      feedbackApply.innerHTML = '<i class="bi bi-check2-circle"></i>';
      feedbackApply.title = "Apply correction";

      const feedbackStatus = document.createElement("p");
      feedbackStatus.className = "text-muted small mb-0";
      feedbackStatus.textContent = "Correction unavailable";

      feedbackRow.appendChild(feedbackSelect);
      feedbackRow.appendChild(feedbackApply);
      feedbackWrap.appendChild(feedbackRow);
      feedbackWrap.appendChild(feedbackStatus);
      tile.appendChild(feedbackWrap);
      elements.fridgeTiles.appendChild(tile);

      tiles.push({ thumb, title, meta, feedbackWrap, feedbackSelect, feedbackApply, feedbackStatus });
    }
    applyFridgeTilePage();
    return tiles;
  }

  function fridgePageSize(totalItems) {
    const tileCount = Number(totalItems) || 0;
    const cols =
      Number(elements.fridgeTiles?.dataset?.cols || 0) || computeFridgeColumns(tileCount || state.fridgeLast?.tiles?.length || 0);
    return Math.max(2, Math.min(8, cols * FRIDGE_PAGE_ROWS));
  }

  function renderFridgePagination(totalPages) {
    if (!elements.fridgePagination) return;
    if (totalPages <= 1) {
      elements.fridgePagination.hidden = true;
      elements.fridgePagination.innerHTML = "";
      return;
    }

    const current = Math.max(1, Math.min(totalPages, Number(state.fridgePage) || 1));
    elements.fridgePagination.hidden = false;
    elements.fridgePagination.innerHTML = "";

    const makeBtn = ({ label, page, active = false, disabled = false, ariaLabel = "" }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `batch-page-btn${active ? " is-active" : ""}`;
      btn.textContent = label;
      btn.disabled = disabled;
      if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
      if (active) btn.setAttribute("aria-current", "page");
      if (!disabled && Number.isFinite(page)) {
        btn.addEventListener("click", () => {
          state.fridgePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
          applyFridgeTilePage();
        });
      }
      return btn;
    };

    elements.fridgePagination.appendChild(
      makeBtn({
        label: "<",
        page: current - 1,
        disabled: current <= 1,
        ariaLabel: "Previous fridge page",
      })
    );

    const maxButtons = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      elements.fridgePagination.appendChild(makeBtn({ label: "1", page: 1 }));
      if (start > 2) {
        const dots = makeBtn({ label: "...", page: NaN, disabled: true, ariaLabel: "More pages" });
        dots.classList.add("is-dots");
        elements.fridgePagination.appendChild(dots);
      }
    }

    for (let page = start; page <= end; page += 1) {
      elements.fridgePagination.appendChild(
        makeBtn({
          label: String(page),
          page,
          active: page === current,
          ariaLabel: `Fridge page ${page}`,
        })
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        const dots = makeBtn({ label: "...", page: NaN, disabled: true, ariaLabel: "More pages" });
        dots.classList.add("is-dots");
        elements.fridgePagination.appendChild(dots);
      }
      elements.fridgePagination.appendChild(makeBtn({ label: String(totalPages), page: totalPages }));
    }

    elements.fridgePagination.appendChild(
      makeBtn({
        label: ">",
        page: current + 1,
        disabled: current >= totalPages,
        ariaLabel: "Next fridge page",
      })
    );
  }

  function applyFridgeTilePage() {
    if (!elements.fridgeTiles) return;
    const cards = Array.from(elements.fridgeTiles.children).filter((el) => el?.classList?.contains("tile-chip"));
    if (!cards.length) {
      renderFridgePagination(1);
      return;
    }

    const pageSize = fridgePageSize(cards.length);
    const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
    state.fridgePage = Math.max(1, Math.min(totalPages, Number(state.fridgePage) || 1));
    const start = (state.fridgePage - 1) * pageSize;
    cards.forEach((card, idx) => {
      card.hidden = idx < start || idx >= start + pageSize;
    });

    renderFridgePagination(totalPages);
  }

  function renderFridgeSummaryFromCounts(counts) {
    if (!elements.fridgeSummary) return;
    elements.fridgeSummary.innerHTML = "";
    const summary = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!summary.length) {
      const li = document.createElement("li");
      li.className = "result-metric";
      const left = document.createElement("span");
      left.textContent = "No successful detections yet";
      const right = document.createElement("strong");
      right.textContent = "Pending";
      li.appendChild(left);
      li.appendChild(right);
      elements.fridgeSummary.appendChild(li);
      return;
    }
    for (const [label, count] of summary) {
      const li = document.createElement("li");
      li.className = "result-metric";
      const left = document.createElement("span");
      left.textContent = `${label} (x${count})`;
      const right = document.createElement("strong");
      right.textContent = "Detected";
      li.appendChild(left);
      li.appendChild(right);
      elements.fridgeSummary.appendChild(li);
    }
  }

  function wireFridgeTileFeedback(uiTile, tileRecord) {
    if (!uiTile || !uiTile.feedbackWrap) return;
    const predictionId = Number(tileRecord?.predictionId || 0);
    if (!predictionId) {
      uiTile.feedbackWrap.hidden = true;
      return;
    }

    uiTile.feedbackWrap.hidden = false;
    fillLabelSelect(uiTile.feedbackSelect, tileRecord?.rawLabel || tileRecord?.label || "");
    uiTile.feedbackStatus.textContent = tileRecord?.isCorrected
      ? `Corrected from ${prettyLabel(tileRecord?.originalLabel || "")}`
      : "Correct this tile label if needed.";

    uiTile.feedbackApply.onclick = async () => {
      const correctedLabel = String(uiTile.feedbackSelect?.value || "").trim();
      if (!correctedLabel) return;
      uiTile.feedbackApply.disabled = true;
      uiTile.feedbackStatus.textContent = "Saving correction...";
      try {
        const updated = await apiCorrectPrediction(predictionId, correctedLabel);
        tileRecord.rawLabel = String(updated.label || correctedLabel);
        tileRecord.label = prettyLabel(updated.label);
        tileRecord.isCorrected = Boolean(updated.is_corrected);
        tileRecord.originalLabel = updated.original_label || tileRecord.originalLabel || tileRecord.rawLabel;
        uiTile.title.textContent = tileRecord.label;
        uiTile.title.title = tileRecord.label;
        fillLabelSelect(uiTile.feedbackSelect, tileRecord.rawLabel);
        uiTile.feedbackStatus.textContent = tileRecord.isCorrected
          ? `Corrected from ${prettyLabel(tileRecord.originalLabel || "")}`
          : "Correction cleared.";
        if (state.fridgeLast && Array.isArray(state.fridgeLast.tiles)) {
          const counts = new Map();
          state.fridgeLast.tiles.forEach((t) => {
            const key = String(t?.label || "").trim();
            if (isCountableFridgeLabel(key)) counts.set(key, (counts.get(key) || 0) + 1);
          });
          renderFridgeSummaryFromCounts(counts);
        }
        try {
          window.dispatchEvent(new Event("predictor:recent_refresh"));
        } catch {
          // ignore
        }
      } catch (err) {
        uiTile.feedbackStatus.textContent =
          err && err.message ? String(err.message) : "Unable to save correction.";
      } finally {
        uiTile.feedbackApply.disabled = false;
      }
    };
  }

  function renderFridgeLast(last) {
    if (!last || !Array.isArray(last.tiles)) return;
    const tiles = createFridgeTileUI(
      last.tiles.length,
      last.columns || computeFridgeColumns(last.tiles.length),
      last.gridHint
    );
    const counts = new Map();
    last.tiles.forEach((t, idx) => {
      if (!tiles[idx]) return;
      if (t.previewUrl) tiles[idx].thumb.src = t.previewUrl;
      tiles[idx].title.textContent = String(t.label || "-");
      tiles[idx].title.title = String(t.label || "");
      tiles[idx].meta.textContent = formatPct(Number(t.confidence) || 0);
      wireFridgeTileFeedback(tiles[idx], t);
      const key = String(t.label || "").trim();
      if (isCountableFridgeLabel(key)) counts.set(key, (counts.get(key) || 0) + 1);
    });
    renderFridgeSummaryFromCounts(counts);
    if (elements.fridgeEmpty) elements.fridgeEmpty.hidden = true;
    if (elements.fridgeResults) elements.fridgeResults.hidden = false;
  }

  async function runFridgeRegions({ regions, save, source, gridHint } = {}) {
    if (!state.imageFile) return;
    if (!elements.fridgeTiles || !elements.fridgeSummary) return;
    if (!state.imageEl) return;

    const list = Array.isArray(regions) ? regions : [];
    if (!list.length) return;

    ensureResultsVisible();

    const model = elements.resolutionInput?.value || "101";
    const sensitivityPercent = Math.round(state.sensitivity * 100);
    const runId = newId("fridge");
    const tileCount = list.length;
    const columns = computeFridgeColumns(tileCount);
    state.fridgePage = 1;

    const uiTiles = createFridgeTileUI(tileCount, columns, gridHint);
    const counts = new Map();
    const tilesOut = [];

    for (let i = 0; i < tileCount; i += 1) {
      const region = list[i];
      const tileData = await cropRegionToTile(region, i + 1);
      if (!tileData) {
        uiTiles[i].title.textContent = "Unavailable";
        uiTiles[i].title.title = "Unable to prepare this tile image. Try running Smart Fridge again.";
        uiTiles[i].meta.textContent = "Retry";
        if (uiTiles[i].feedbackWrap) uiTiles[i].feedbackWrap.hidden = true;
        tilesOut.push({
          previewUrl: "",
          label: "Unavailable",
          rawLabel: "",
          confidence: 0,
          predictionId: null,
          error: "tile_prepare_failed",
        });
        continue;
      }
      if (tileData.previewUrl) uiTiles[i].thumb.src = tileData.previewUrl;

      try {
        const pred = await apiInferWithRetry({
          file: tileData.file,
          model,
          compare: false,
          variant: "base",
          sensitivityPercent,
          save: Boolean(save),
          meta: {
            predict_mode: "fridge",
            fridge_run_id: runId,
            fridge_tile_index: i + 1,
            fridge_tile_total: tileCount,
            fridge_source: source || "custom",
            fridge_crop_norm: region,
          },
        });

        const rawLabel = String(pred.label || "");
        const label = prettyLabel(rawLabel);
        const conf = Number(pred.confidence) || 0;
        if (isCountableFridgeLabel(label)) counts.set(label, (counts.get(label) || 0) + 1);
        uiTiles[i].title.textContent = label;
        uiTiles[i].title.title = label;
        uiTiles[i].meta.textContent = formatPct(conf);
        const tileRecord = {
          previewUrl: tileData.previewUrl,
          label,
          rawLabel,
          confidence: conf,
          predictionId: pred.id || null,
          isCorrected: Boolean(pred.is_corrected),
          originalLabel: pred.original_label || rawLabel,
        };
        tilesOut.push(tileRecord);
        wireFridgeTileFeedback(uiTiles[i], tileRecord);
      } catch (err) {
        uiTiles[i].title.textContent = "Unavailable";
        uiTiles[i].title.title = err?.message ? String(err.message) : "Unable to run prediction for this tile.";
        uiTiles[i].meta.textContent = "Retry";
        if (uiTiles[i].feedbackWrap) uiTiles[i].feedbackWrap.hidden = true;
        tilesOut.push({
          previewUrl: tileData.previewUrl,
          label: "Unavailable",
          rawLabel: "",
          confidence: 0,
          predictionId: null,
          error: err?.message ? String(err.message) : "infer_failed",
        });
      }
    }

    renderFridgeSummaryFromCounts(counts);
    if (elements.fridgeEmpty) elements.fridgeEmpty.hidden = true;
    if (elements.fridgeResults) elements.fridgeResults.hidden = false;

    state.fridgeLast = {
      imageHash: state.imageHash,
      runId,
      regions: cloneRegions(list),
      tiles: tilesOut,
      columns,
      gridHint: gridHint || "",
    };

    if (save) {
      try {
        window.dispatchEvent(new Event("predictor:recent_refresh"));
      } catch {
        // ignore
      }
    }
  }

  async function runFridgeMode() {
    if (!state.imageFile) return;
    if (!elements.fridgeTiles || !elements.fridgeSummary) return;
    if (!state.imageEl) return;
    if (!isFridgeTabActive()) return;

    if (state.fridgeLast && state.fridgeLast.imageHash && state.fridgeLast.imageHash === state.imageHash) {
      renderFridgeLast(state.fridgeLast);
      return;
    }

    if (fridgeRunInFlight) {
      fridgeRerunQueued = true;
      return;
    }

    // Preview uses the preset currently selected in the modal controls.
    const grid = modalPresetGrid();

    fridgeRunInFlight = true;
    try {
      await runFridgeRegions({
        regions: makePresetRegions(grid),
        save: false,
        source: "preset-preview",
        gridHint: String(grid),
      });
    } finally {
      fridgeRunInFlight = false;
      if (fridgeRerunQueued) {
        fridgeRerunQueued = false;
        scheduleFridgeAutoRun();
      }
    }
  }

  function modalPresetGrid() {
    const selected = elements.fridgeModalPresetInputs.find((el) => el && el.checked);
    const grid = Number(selected?.value || 2);
    return grid === 3 ? 3 : 2;
  }

  function regionsLookLikePreset(regions, grid) {
    const list = Array.isArray(regions) ? regions : [];
    const preset = makePresetRegions(grid);
    if (list.length !== preset.length) return false;

    const sorted = [...list].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const sortedPreset = [...preset].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const eps = 0.0015;
    for (let i = 0; i < sorted.length; i += 1) {
      const r = sorted[i];
      const p = sortedPreset[i];
      if (Math.abs(r.x - p.x) > eps) return false;
      if (Math.abs(r.y - p.y) > eps) return false;
      if (Math.abs(r.w - p.w) > eps) return false;
      if (Math.abs(r.h - p.h) > eps) return false;
    }
    return true;
  }

  function applyModalPreset() {
    const grid = modalPresetGrid();
    pushFridgeUndo();
    setFridgeRegions(makePresetRegions(grid));
    drawFridgeEditor();
  }

  async function runSmartFridgeFromModal() {
    if (!state.imageFile || !state.imageEl) return;
    if (!fridgeEditor.regions.length) return;

    if (elements.fridgeRunSelected) elements.fridgeRunSelected.disabled = true;
    if (elements.fridgeApplyPreset) elements.fridgeApplyPreset.disabled = true;
    if (elements.fridgeUndo) elements.fridgeUndo.disabled = true;
    if (elements.fridgeClearRegions) elements.fridgeClearRegions.disabled = true;
    if (elements.fridgeRunStatus) elements.fridgeRunStatus.textContent = "Running...";

    const grid = modalPresetGrid();
    const source = regionsLookLikePreset(fridgeEditor.regions, grid) ? `preset-${grid}` : "custom";

    try {
      await runFridgeRegions({
        regions: fridgeEditor.regions,
        save: true,
        source,
        gridHint: source.startsWith("preset-") ? String(grid) : "",
      });

      // Jump to the Smart Fridge tab to show results.
      root.querySelector("#tab-fridge")?.click();

      const modal = ensureFridgeModal();
      modal?.hide();
    } finally {
      if (elements.fridgeApplyPreset) elements.fridgeApplyPreset.disabled = false;
      updateFridgeEditorControls();
      if (elements.fridgeRunStatus) elements.fridgeRunStatus.textContent = "Ready";
    }
  }

  function openFridgeCropModal() {
    if (!state.imageEl || !state.imageFile) return;
    const modal = ensureFridgeModal();
    if (!modal) return;

    attachFridgeEditorHandlers();

    if (elements.fridgeCropModal && elements.fridgeCropModal.dataset.bound !== "1") {
      elements.fridgeCropModal.dataset.bound = "1";
      elements.fridgeCropModal.addEventListener("shown.bs.modal", () => {
        fridgeEditor.isOpen = true;
        sizeFridgeCanvas();
        if (state.imageHash && fridgeEditor.imageHash !== state.imageHash) {
          fridgeEditor.imageHash = state.imageHash;
          fridgeEditor.undo = [];
          fridgeEditor.selectedId = null;
          setFridgeRegions([]);
        }
        setFridgeTool(getFridgeTool());
        updateFridgeEditorControls();
        drawFridgeEditor();
      });
      elements.fridgeCropModal.addEventListener("hidden.bs.modal", () => {
        fridgeEditor.isOpen = false;
        fridgeEditor.drag = null;
        if (elements.fridgeCropCanvas) elements.fridgeCropCanvas.style.cursor = "default";
        if (elements.fridgeRunStatus) elements.fridgeRunStatus.textContent = "Ready";
      });

      // Keep canvas in sync if the viewport changes while modal is open.
      window.addEventListener(
        "resize",
        () => {
          if (!fridgeEditor.isOpen) return;
          sizeFridgeCanvas();
          drawFridgeEditor();
        },
        { passive: true }
      );
    }

    if (elements.fridgeApplyPreset && elements.fridgeApplyPreset.dataset.bound !== "1") {
      elements.fridgeApplyPreset.dataset.bound = "1";
      elements.fridgeApplyPreset.addEventListener("click", () => applyModalPreset());
    }
    if (elements.fridgeUndo && elements.fridgeUndo.dataset.bound !== "1") {
      elements.fridgeUndo.dataset.bound = "1";
      elements.fridgeUndo.addEventListener("click", () => undoFridge());
    }
    if (elements.fridgeClearRegions && elements.fridgeClearRegions.dataset.bound !== "1") {
      elements.fridgeClearRegions.dataset.bound = "1";
      elements.fridgeClearRegions.addEventListener("click", () => clearFridgeRegions());
    }
    if (elements.fridgeToolInputs && elements.fridgeToolInputs.length) {
      elements.fridgeToolInputs.forEach((el) => {
        if (!el || el.dataset.bound === "1") return;
        el.dataset.bound = "1";
        el.addEventListener("change", () => setFridgeTool(getFridgeTool()));
      });
    }
    if (elements.fridgeRunSelected && elements.fridgeRunSelected.dataset.bound !== "1") {
      elements.fridgeRunSelected.dataset.bound = "1";
      elements.fridgeRunSelected.addEventListener("click", () => runSmartFridgeFromModal().catch(() => null));
    }

    updateFridgeEditorControls();
    modal.show();
  }

  function shuffleInPlace(array, rng) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function startGuessingGame() {
    if (!state.imageFile) return;
    gameState.active = true;
    gameState.round = 0;
    gameState.locked = false;

    if (elements.gameArea) elements.gameArea.hidden = false;
    if (elements.gameResult) elements.gameResult.hidden = true;
    if (elements.previewImg) elements.previewImg.classList.add("is-blurred");

    nextGameRound();
  }

  function nextGameRound() {
    if (!gameState.active || !state.imageFile) return;
    gameState.round += 1;
    gameState.locked = false;
    if (elements.gameRound) elements.gameRound.textContent = String(gameState.round);
    if (elements.gameResult) elements.gameResult.hidden = true;
    if (elements.previewImg) elements.previewImg.classList.add("is-blurred");

    const model = elements.resolutionInput?.value || "101";
    const seed = fnv1a(`${state.imageHash}|game|${gameState.round}`);
    const rng = mulberry32(seed);

    const run = async () => {
      let pred = null;
      try {
        pred = await apiInfer({
          file: state.imageFile,
          model,
          compare: false,
          variant: "blur",
          sensitivityPercent: Math.round(state.sensitivity * 100),
          save: false,
        });
      } catch (err) {
        const msg = err && err.message ? String(err.message) : "Unable to run game round.";
        if (elements.gameResult) {
          elements.gameResult.hidden = false;
          elements.gameResult.textContent = msg;
        }
        return;
      }

      const correctLabel = prettyLabel(pred.label);
      const options = new Set([correctLabel]);
      while (options.size < 4) {
        options.add(labels[Math.floor(rng() * labels.length)]);
      }
      const optionList = Array.from(options);
      shuffleInPlace(optionList, rng);

      if (!elements.gameOptions) return;
      elements.gameOptions.innerHTML = "";

      optionList.forEach((label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-ghost btn-sm";
        btn.textContent = label;
        btn.addEventListener("click", () => {
          if (gameState.locked) return;
          gameState.locked = true;

          const correct = label === correctLabel;
          if (elements.previewImg) elements.previewImg.classList.remove("is-blurred");
          if (elements.gameResult) {
            elements.gameResult.hidden = false;
            elements.gameResult.innerHTML = correct
              ? `<span class="pill"><i class="bi bi-check2-circle"></i> Correct!</span> Model predicted <strong>${escapeHtml(
                  correctLabel
                )}</strong> with <strong>${formatPct(Number(pred.confidence) || 0)}</strong>.`
              : `<span class="pill"><i class="bi bi-x-circle"></i> Not quite</span> Model predicted <strong>${escapeHtml(
                  correctLabel
                )}</strong> with <strong>${formatPct(Number(pred.confidence) || 0)}</strong>.`;
          }
          Array.from(elements.gameOptions.querySelectorAll("button")).forEach((b) => {
            b.disabled = true;
            if (b.textContent === correctLabel) {
              b.classList.remove("btn-ghost");
              b.classList.add("btn-primary");
            }
          });
        });
        elements.gameOptions.appendChild(btn);
      });
    };

    run();
  }

  function endGuessingGame() {
    gameState.active = false;
    gameState.round = 0;
    gameState.locked = false;
    if (elements.gameArea) elements.gameArea.hidden = true;
    if (elements.gameOptions) elements.gameOptions.innerHTML = "";
    if (elements.gameResult) elements.gameResult.hidden = true;
    if (elements.previewImg) elements.previewImg.classList.remove("is-blurred");
  }

  // Wiring
  elements.choiceCards.forEach((card) => {
    const select = () => setSelectedModel(card.getAttribute("data-model-choice"));
    card.addEventListener("click", select);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });

  setSelectedModel(elements.resolutionInput?.value || "101");
  setupFeedbackOptions();
  setSensitivity(100);
  clearPreview();

  elements.applyRecommendation?.addEventListener("click", () => {
    if (!state.recommendedModel) return;
    setSelectedModel(state.recommendedModel);
  });

  elements.sensitivitySlider?.addEventListener("input", (event) => {
    const value = Number(event.target.value || 100);
    setSensitivity(value);
    if (state.imageFile && state.last.single) {
      runCompareNow();
    }
  });

  if (elements.dropzone && elements.fileInput) {
    const openPicker = () => {
      elements.fileInput.value = "";
      elements.fileInput.click();
    };

    elements.dropzone.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input, select, textarea, label, .predict-mode-group")) return;
      openPicker();
    });
    elements.addMoreImages?.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker();
    });

    ["dragenter", "dragover"].forEach((type) => {
      elements.dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        elements.dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      elements.dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove("is-dragover");
      });
    });

    elements.dropzone.addEventListener("drop", (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      addFiles(files);
    });

    elements.fileInput.addEventListener("change", () => {
      const files = Array.from(elements.fileInput.files || []);
      if (!files.length) return;
      addFiles(files);
      elements.fileInput.value = "";
    });
  }

  elements.clearButton?.addEventListener("click", (e) => {
    e.preventDefault();
    clearPreview();
  });

  elements.predictModeInputs.forEach((el) =>
    el.addEventListener("change", () => {
      setPredictMode(getPredictMode());
    })
  );
  setPredictMode(getPredictMode());

  elements.runButton?.addEventListener("click", async () => {
    if (!state.batch.length) return;

    if (getPredictMode() === "fridge") {
      openFridgeCropModal();
      return;
    }

    if (state.batch.length > 1) {
      await runBatchNow();
      return;
    }

    await runSinglePrediction({ quiet: false });
  });

  elements.feedbackApplyBtn?.addEventListener("click", () => {
    applyPredictionFeedback().catch(() => null);
  });

  elements.stressButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!state.imageFile) return;
      renderStressResult(btn.getAttribute("data-stress") || "noise").catch(() => null);
    })
  );

  const fridgeTab = root.querySelector("#tab-fridge");
  fridgeTab?.addEventListener("click", () => scheduleFridgeAutoRun());
  fridgeTab?.addEventListener("shown.bs.tab", () => scheduleFridgeAutoRun());

  const compareTab = root.querySelector("#tab-compare");
  compareTab?.addEventListener("click", () => scheduleCompareAutoRun());
  compareTab?.addEventListener("shown.bs.tab", () => scheduleCompareAutoRun());

  elements.startGame?.addEventListener("click", () => startGuessingGame());
  elements.nextRound?.addEventListener("click", () => nextGameRound());
  elements.endGame?.addEventListener("click", () => endGuessingGame());
}

function setupProfileDashboard() {
  const root = document.querySelector("[data-page='profile']");
  if (!root) return;

  function formatPct(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[ch] || ch;
    });
  }

  function safeParseHistory() {
    return [];
  }

  function formatModel(model) {
    return model === "23" ? "23x23" : "101x101";
  }

  function confidenceTier(value) {
    if (value >= 0.95) {
      return { label: "Verified", className: "chip--good", icon: "bi-patch-check" };
    }
    if (value >= 0.85) {
      return { label: "Confident", className: "chip--good", icon: "bi-check2-circle" };
    }
    if (value >= 0.7) {
      return { label: "Uncertain", className: "chip--warn", icon: "bi-exclamation-triangle" };
    }
    return { label: "Low", className: "chip--warn", icon: "bi-exclamation-octagon" };
  }

  function thumbForLabel(label) {
    const key = String(label || "").trim().toLowerCase();
    const map = {
      carrot:
        "https://images.unsplash.com/photo-1582515073490-39981397c445?auto=format&fit=crop&w=240&q=70",
      garlic:
        "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?auto=format&fit=crop&w=240&q=70",
      potato:
        "https://source.unsplash.com/240x240/?potato",
      broccoli:
        "https://source.unsplash.com/240x240/?broccoli",
      tomato:
        "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=240&q=70",
      spinach:
        "https://source.unsplash.com/240x240/?spinach",
      onion:
        "https://source.unsplash.com/240x240/?onion",
      "bell pepper":
        "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=240&q=70",
      pepper:
        "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=240&q=70",
      cabbage:
        "https://source.unsplash.com/240x240/?cabbage",
      cauliflower:
        "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=240&q=70",
      cucumber:
        "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=240&q=70",
    };

    return map[key] || map[key.replace(/\s+/g, " ")] || null;
  }

  function timeLabel(iso) {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return "-";

    const now = new Date();
    const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString();
  }

  const exportBtn = root.querySelector("#profileExportHistory");
  const clearBtn = root.querySelector("#profileClearHistory");

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  function render() {
    const history = safeParseHistory();
    const stats = {
      total: history.length,
      avg: 0,
      fav: "-",
      last: history[0]?.ts ? timeLabel(history[0].ts) : "-",
    };

    if (history.length) {
      const mean =
        history.reduce((sum, entry) => sum + Number(entry.confidence || 0), 0) / history.length;
      stats.avg = mean;

      const counts = new Map();
      for (const entry of history) {
        const label = entry.label || "Unknown";
        counts.set(label, (counts.get(label) || 0) + 1);
      }
      const fav = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      stats.fav = fav ? fav[0] : "-";
    }

    const totalEl = root.querySelector("#profileStatsTotal");
    const avgEl = root.querySelector("#profileStatsAvg");
    const favEl = root.querySelector("#profileStatsFav");
    const lastEl = root.querySelector("#profileStatsLast");
    if (totalEl) totalEl.textContent = stats.total ? String(stats.total) : "0";
    if (avgEl) avgEl.textContent = history.length ? formatPct(stats.avg) : "-";
    if (favEl) favEl.textContent = stats.fav;
    if (lastEl) lastEl.textContent = stats.last;

    // History list
    const listEl = root.querySelector("#profileHistoryList");
    if (listEl) {
      listEl.innerHTML = "";
      const slice = history.slice(0, 8);
      if (!slice.length) {
        const empty = document.createElement("div");
        empty.className = "glass p-4 text-center";
        empty.innerHTML =
          '<div class="feature-icon mx-auto mb-3"><i class="bi bi-clock-history"></i></div>' +
          '<p class="mb-1" style="font-weight: 850;">No predictions yet</p>' +
          '<p class="text-muted mb-0">Run a few predictions in the Predictor to populate history.</p>';
        listEl.appendChild(empty);
      } else {
        for (const entry of slice) {
          const item = document.createElement("div");
          item.className = "history-item reveal is-visible";

          const conf = Math.max(0, Math.min(1, Number(entry.confidence || 0)));
          const tier = confidenceTier(conf);
          const model = formatModel(entry.model);
          const time = timeLabel(entry.ts);
          const label = escapeHtml(entry.label || "-");
          const thumbUrl = thumbForLabel(entry.label);
          const thumbClass = thumbUrl ? "history-thumb has-image" : "history-thumb";

          item.innerHTML =
            `<div class="${thumbClass}"${thumbUrl ? ` style="--thumb-image: url('${thumbUrl}')"` : ""}>` +
            `<i class="bi bi-image"></i></div>` +
            `<div>` +
            `<div style="font-weight: 850;">${label}</div>` +
            `<div class="text-muted small">${time}</div>` +
            `<div class="history-chips">` +
            `<span class="chip chip--model"><i class="bi bi-cpu"></i> ${model}</span>` +
            `<span class="chip ${tier.className}"><i class="bi ${tier.icon}"></i> ${tier.label}</span>` +
            `${entry.compare?.p23?.label && entry.compare?.p101?.label && entry.compare.p23.label !== entry.compare.p101.label
              ? `<span class="chip chip--warn"><i class="bi bi-shuffle"></i> Disagrees</span>`
              : ""}` +
            `</div>` +
            `</div>` +
            `<div class="history-score">` +
            `<strong>${formatPct(conf)}</strong>` +
            `<div class="text-muted small">Confidence</div>` +
            `<div class="history-meter" aria-hidden="true"><div class="history-meter-fill" style="width: 0%"></div></div>` +
            `</div>`;

          listEl.appendChild(item);
          const fill = item.querySelector(".history-meter-fill");
          if (fill) {
            const target = `${Math.round(conf * 100)}%`;
            requestAnimationFrame(() => {
              fill.style.width = target;
            });
          }
        }
      }
    }

    // Confidence distribution (last 30)
    const distEl = root.querySelector("#profileConfDist");
    const distHint = root.querySelector("#profileConfDistHint");
    const sample = history.slice(0, 30);

    if (distEl) {
      distEl.innerHTML = "";
      if (sample.length) {
        if (distHint) distHint.hidden = true;

        const bins = [
          { label: "0-50%", min: 0, max: 0.5 },
          { label: "50-70%", min: 0.5, max: 0.7 },
          { label: "70-85%", min: 0.7, max: 0.85 },
          { label: "85-95%", min: 0.85, max: 0.95 },
          { label: "95-100%", min: 0.95, max: 1.01 },
        ];

        const counts = bins.map((bin) => ({
          ...bin,
          count: sample.filter(
            (e) => Number(e.confidence || 0) >= bin.min && Number(e.confidence || 0) < bin.max
          ).length,
        }));
        const maxCount = Math.max(...counts.map((c) => c.count), 1);

        const wrapper = document.createElement("div");
        wrapper.className = "mini-bars";

        for (const row of counts) {
          const line = document.createElement("div");
          line.className = "bar-row";

          const labelEl = document.createElement("div");
          labelEl.className = "label";
          labelEl.textContent = row.label;

          const track = document.createElement("div");
          track.className = "bar-track";
          const fill = document.createElement("div");
          fill.className = "bar-fill" + (row.label.startsWith("0-") ? " is-warn" : "");
          track.appendChild(fill);

          const value = document.createElement("div");
          value.className = "value";
          value.textContent = `${row.count}`;

          line.appendChild(labelEl);
          line.appendChild(track);
          line.appendChild(value);
          wrapper.appendChild(line);

          requestAnimationFrame(() => {
            fill.style.width = `${Math.round((row.count / maxCount) * 100)}%`;
          });
        }

        distEl.appendChild(wrapper);
      } else {
        if (distHint) distHint.hidden = false;
      }
    }

    // Confusions from compare disagreements
    const confusionEl = root.querySelector("#profileConfusions");
    const confusionHint = root.querySelector("#profileConfusionsHint");
    if (confusionEl) {
      confusionEl.innerHTML = "";
      const pairs = new Map();
      for (const entry of sample) {
        const compare = entry.compare;
        if (!compare?.p23?.label || !compare?.p101?.label) continue;
        if (compare.p23.label === compare.p101.label) continue;
        const key = `${compare.p23.label} -> ${compare.p101.label}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }

      const sorted = Array.from(pairs.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      if (!sorted.length) {
        if (confusionHint) confusionHint.hidden = false;
      } else {
        if (confusionHint) confusionHint.hidden = true;
        for (const [pair, count] of sorted) {
          const li = document.createElement("li");
          li.className = "result-metric";
          li.innerHTML = `<span>${escapeHtml(pair)}</span><strong>x${count}</strong>`;
          confusionEl.appendChild(li);
        }
      }
    }
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const history = safeParseHistory();
      downloadJson("veggieai-history.json", history);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      render();
    });
  }

  render();
}

function setupHomeDashboardPreview() {
  const root = document.querySelector("[data-page='home']");
  if (!root) return;

  const listEl = root.querySelector("#homeRecentList");
  if (!listEl) return;

  function formatPct(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function safeParseHistory() {
    return [];
  }

  function formatModel(model) {
    return model === "23" ? "23x23" : "101x101";
  }

  function timeLabel(iso) {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return "-";

    const now = new Date();
    const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString();
  }

  function thumbForLabel(label) {
    const key = String(label || "").trim().toLowerCase();
    const map = {
      carrot:
        "https://images.unsplash.com/photo-1582515073490-39981397c445?auto=format&fit=crop&w=240&q=70",
      garlic:
        "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?auto=format&fit=crop&w=240&q=70",
      tomato:
        "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=240&q=70",
      "bell pepper":
        "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=240&q=70",
      pepper:
        "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=240&q=70",
      cauliflower:
        "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=240&q=70",
      cucumber:
        "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=240&q=70",
      broccoli: "https://source.unsplash.com/240x240/?broccoli",
      potato: "https://source.unsplash.com/240x240/?potato",
      spinach: "https://source.unsplash.com/240x240/?spinach",
      onion: "https://source.unsplash.com/240x240/?onion",
      cabbage: "https://source.unsplash.com/240x240/?cabbage",
    };

    return map[key] || map[key.replace(/\s+/g, " ")] || null;
  }

  const history = safeParseHistory();
  const slice = history.slice(0, 3);
  listEl.innerHTML = "";

  if (!slice.length) {
    const empty = document.createElement("div");
    empty.className = "glass p-4 text-center";
    empty.innerHTML =
      '<div class="feature-icon mx-auto mb-3"><i class="bi bi-clock-history"></i></div>' +
      '<p class="mb-1" style="font-weight: 850;">No recent predictions yet</p>' +
      '<p class="text-muted mb-3">Run a prediction to populate your dashboard preview.</p>' +
      `<a class="btn btn-primary btn-glow" href="${window.withAppBasePath ? window.withAppBasePath("/predictor") : "/predictor"}"><i class="bi bi-magic me-1"></i> Open Predictor</a>`;
    listEl.appendChild(empty);
    return;
  }

  for (const entry of slice) {
    const item = document.createElement("div");
    item.className = "history-item reveal is-visible";
    const conf = Math.max(0, Math.min(1, Number(entry.confidence || 0)));
    const corrected = Boolean(entry?.is_corrected);

    const thumbUrl = thumbForLabel(entry.label);
    const thumbClass = thumbUrl ? "history-thumb has-image" : "history-thumb";

    const nameEl = document.createElement("div");
    nameEl.textContent = entry.label || "-";

    item.innerHTML =
      `<div class="${thumbClass}"${thumbUrl ? ` style="--thumb-image: url('${thumbUrl}')"` : ""}>` +
      `<i class="bi bi-image"></i></div>` +
      `<div><div style="font-weight: 850;">${nameEl.innerHTML}${corrected ? ' <span class="chip chip--good"><i class="bi bi-wrench-adjustable-circle"></i> Corrected</span>' : ""}</div>` +
      `<div class="text-muted small">${timeLabel(entry.ts)} - ${formatModel(entry.model)}</div></div>` +
      `<div class="history-score"><strong>${formatPct(conf)}</strong>` +
      `<div class="text-muted small">Confidence</div>` +
      `<div class="history-meter" aria-hidden="true"><div class="history-meter-fill" style="width: 0%"></div></div>` +
      `</div>`;

    listEl.appendChild(item);
    const fill = item.querySelector(".history-meter-fill");
    if (fill) {
      requestAnimationFrame(() => {
        fill.style.width = `${Math.round(conf * 100)}%`;
      });
    }
  }
}

function setupPredictorRecentPanel() {
  const root = document.querySelector("[data-page='predictor']");
  if (!root) return;

  const listEl = root.querySelector("#predictRecentList");
  if (!listEl) return;

  function formatPct(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function timeLabel(iso) {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return "-";

    const now = new Date();
    const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString();
  }

  function formatModel(model) {
    return model === "23" ? "23x23" : "101x101";
  }

  function prettyLabel(label) {
    const raw = String(label || "").trim();
    const map = {
      Bitter_Gourd: "Bitter gourd",
      Cauliflower_Broccoli: "Cauliflower / Broccoli",
      Cucumber_BottleGourd: "Cucumber / Bottle gourd",
      Radish_Carrot: "Radish / Carrot",
    };
    if (map[raw]) return map[raw];
    if (!raw) return "-";
    return raw.replace(/_/g, " ");
  }

  function thumbForLabel(label) {
    const key = String(label || "").trim().toLowerCase();
    const map = {
      carrot:
        "https://images.unsplash.com/photo-1582515073490-39981397c445?auto=format&fit=crop&w=240&q=70",
      garlic:
        "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?auto=format&fit=crop&w=240&q=70",
      tomato:
        "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=240&q=70",
      "bell pepper":
        "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=240&q=70",
      pepper:
        "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=240&q=70",
      cauliflower:
        "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=240&q=70",
      cucumber:
        "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=240&q=70",
      broccoli: "https://source.unsplash.com/240x240/?broccoli",
      potato: "https://source.unsplash.com/240x240/?potato",
      spinach: "https://source.unsplash.com/240x240/?spinach",
      onion: "https://source.unsplash.com/240x240/?onion",
      cabbage: "https://source.unsplash.com/240x240/?cabbage",
    };

    return map[key] || map[key.replace(/\s+/g, " ")] || null;
  }

  function renderList(entries) {
    if (!entries) {
      listEl.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "glass p-4 text-center";
      empty.innerHTML =
        '<div class="feature-icon mx-auto mb-3"><i class="bi bi-clock-history"></i></div>' +
        '<p class="mb-1" style="font-weight: 850;">Sign in to see activity</p>' +
        '<p class="text-muted mb-0">Your recent predictions appear here after you log in.</p>';
      listEl.appendChild(empty);
      return;
    }

    const slice = entries.slice(0, 4);
    listEl.innerHTML = "";

    if (!slice.length) {
      const empty = document.createElement("div");
      empty.className = "glass p-4 text-center";
      empty.innerHTML =
        '<div class="feature-icon mx-auto mb-3"><i class="bi bi-clock-history"></i></div>' +
        '<p class="mb-1" style="font-weight: 850;">No activity yet</p>' +
        '<p class="text-muted mb-0">Run a prediction to populate this list.</p>';
      listEl.appendChild(empty);
      return;
    }

    for (const entry of slice) {
      const item = document.createElement("div");
      item.className = "history-item reveal is-visible";
      const conf = Math.max(0, Math.min(1, Number(entry.confidence || 0)));
      const corrected = Boolean(entry?.is_corrected);

      const mode = entry?.metrics?.client?.predict_mode || entry?.metrics?.predict_mode || "";
      const modePrefix = String(mode).toLowerCase() === "fridge" ? "Smart Fridge - " : "";

      const apiThumbRaw = entry.image_url || entry.imageUrl || null;
      const apiThumb = apiThumbRaw && window.withAppBasePath ? window.withAppBasePath(apiThumbRaw) : apiThumbRaw;
      const thumbUrl = apiThumb || thumbForLabel(entry.label);
      const thumbClass = thumbUrl ? "history-thumb has-image" : "history-thumb";

      const nameEl = document.createElement("div");
      nameEl.textContent = prettyLabel(entry.label) || "-";

      item.innerHTML =
        `<div class="${thumbClass}"${thumbUrl ? ` style="--thumb-image: url('${thumbUrl}')"` : ""}>` +
        `<i class="bi bi-image"></i></div>` +
        `<div><div style="font-weight: 850;">${nameEl.innerHTML}${corrected ? ' <span class="chip chip--good"><i class="bi bi-wrench-adjustable-circle"></i> Corrected</span>' : ""}</div>` +
        `<div class="text-muted small">${timeLabel(entry.ts)} - ${modePrefix}${formatModel(entry.model)}</div></div>` +
        `<div class="history-score"><strong>${formatPct(conf)}</strong>` +
        `<div class="text-muted small">Confidence</div>` +
        `<div class="history-meter" aria-hidden="true"><div class="history-meter-fill" style="width: 0%"></div></div>` +
        `</div>`;

      listEl.appendChild(item);
      const fill = item.querySelector(".history-meter-fill");
      if (fill) {
        requestAnimationFrame(() => {
          fill.style.width = `${Math.round(conf * 100)}%`;
        });
      }
    }
  }

  async function loadEntries() {
    try {
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/predictions?limit=4") : "/api/predictions?limit=4", {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      if (response.status === 401) {
        return null;
      }
      if (response.ok) {
        const data = await response.json();
        if (data && data.ok && Array.isArray(data.predictions)) {
          return data.predictions;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  const refresh = async () => {
    const entries = await loadEntries();
    renderList(entries);
  };

  refresh();
  window.addEventListener("predictor:recent_refresh", refresh);
}

onReady(() => {
  setupPredictor();
  setupPredictorRecentPanel();
});
