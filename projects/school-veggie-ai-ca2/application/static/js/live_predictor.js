function setupLivePredictor() {
  const root = document.querySelector("[data-page='live-predictor']");
  if (!root) return;

  const elements = {
    video: root.querySelector("#liveVideo"),
    captureCanvas: root.querySelector("#liveCaptureCanvas"),
    startBtn: root.querySelector("#liveStartBtn"),
    stopBtn: root.querySelector("#liveStopBtn"),
    flipBtn: root.querySelector("#liveFlipBtn"),
    modelInput: root.querySelector("#liveModel"),
    modelCards: Array.from(root.querySelectorAll("[data-live-model]")),
    serviceBadge: root.querySelector("#liveServiceBadge"),
    statusText: root.querySelector("#liveStatusText"),
    resultBanner: root.querySelector("#liveResultBanner"),
    resultLabel: root.querySelector("#liveResultLabel"),
    resultMeta: root.querySelector("#liveResultMeta"),
    topList: root.querySelector("#liveTopList"),
    metricCameraFps: root.querySelector("#liveMetricCameraFps"),
    metricInferRate: root.querySelector("#liveMetricInferRate"),
    metricLatency: root.querySelector("#liveMetricLatency"),
  };

  const LABEL_MAP = {
    Bitter_Gourd: "Bitter gourd",
    Cauliflower_Broccoli: "Cauliflower / Broccoli",
    Cucumber_BottleGourd: "Cucumber / Bottle gourd",
    Radish_Carrot: "Radish / Carrot",
  };

  const LABEL_TONE_KEY = {
    Bean: "bean",
    Bitter_Gourd: "bitter-gourd",
    Brinjal: "brinjal",
    Cabbage: "cabbage",
    Capsicum: "capsicum",
    Cauliflower_Broccoli: "cauliflower-broccoli",
    Cucumber_BottleGourd: "cucumber-bottlegourd",
    Potato: "potato",
    Pumpkin: "pumpkin",
    Radish_Carrot: "radish-carrot",
    Tomato: "tomato",
  };

  const state = {
    stream: null,
    running: false,
    starting: false,
    facingMode: "environment",
    model: "23",

    loopTimer: null,
    inFlight: false,
    inFlightController: null,
    captureCount: 0,
    errorStreak: 0,

    lastCaptureAt: 0,
    lastResultAt: 0,
    latencyEmaMs: 0,
    inferRateEma: 0,

    fpsTimer: null,
    lastFrameCount: 0,
    lastFrameCheckAt: 0,
    cameraFps: 0,
  };

  function prettyLabel(raw) {
    const key = String(raw || "").trim();
    if (!key) return "Unknown";
    return LABEL_MAP[key] || key.replace(/_/g, " ");
  }

  function toneKey(raw) {
    const key = String(raw || "").trim();
    return LABEL_TONE_KEY[key] || "unknown";
  }

  function formatPct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.0%";
    return `${(Math.max(0, Math.min(1, n)) * 100).toFixed(1)}%`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function getTargetIntervalMs() {
    const base = state.model === "23" ? 120 : 180;
    const latencyAdjusted = state.latencyEmaMs > 0 ? state.latencyEmaMs * 0.88 : base;
    const withErrors = latencyAdjusted + state.errorStreak * 120;
    return clamp(Math.max(base, withErrors), 100, 1200);
  }

  function captureResolution() {
    return state.model === "23" ? 160 : 224;
  }

  function captureQuality() {
    return state.model === "23" ? 0.66 : 0.75;
  }

  function setServiceBadge(message, tone) {
    if (!elements.serviceBadge) return;
    const dot = '<span class="status-dot"></span>';
    elements.serviceBadge.innerHTML = `${dot}${message}`;
    elements.serviceBadge.classList.remove("status-badge--good", "status-badge--warn");
    if (tone === "warn") {
      elements.serviceBadge.classList.add("status-badge--warn");
    } else {
      elements.serviceBadge.classList.add("status-badge--good");
    }
  }

  function setStatusText(message) {
    if (elements.statusText) elements.statusText.textContent = message;
  }

  function updateMetrics() {
    if (elements.metricCameraFps) {
      elements.metricCameraFps.textContent =
        state.cameraFps > 0 ? `${state.cameraFps.toFixed(1)} fps` : "-";
    }

    if (elements.metricInferRate) {
      elements.metricInferRate.textContent =
        state.inferRateEma > 0 ? `${state.inferRateEma.toFixed(1)} / sec` : "-";
    }

    if (elements.metricLatency) {
      elements.metricLatency.textContent =
        state.latencyEmaMs > 0 ? `${Math.round(state.latencyEmaMs)} ms` : "-";
    }
  }

  function renderTopList(topK) {
    if (!elements.topList) return;
    elements.topList.innerHTML = "";

    const list = Array.isArray(topK) ? topK.slice(0, 3) : [];
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "text-muted small";
      li.textContent = "No alternatives returned for this frame.";
      elements.topList.appendChild(li);
      return;
    }

    for (const item of list) {
      const rawLabel = item?.label || "Unknown";
      const li = document.createElement("li");
      li.className = "result-metric live-top-item";
      li.setAttribute("data-label-key", toneKey(rawLabel));

      const label = document.createElement("span");
      label.className = "live-top-label";

      const dot = document.createElement("span");
      dot.className = "live-label-dot";
      dot.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.textContent = prettyLabel(rawLabel);
      label.appendChild(dot);
      label.appendChild(text);

      const score = document.createElement("strong");
      score.className = "live-top-score";
      score.textContent = formatPct(Number(item?.score) || 0);

      li.appendChild(label);
      li.appendChild(score);
      elements.topList.appendChild(li);
    }
  }

  function renderBanner(prediction) {
    const rawLabel = prediction?.label;
    const label = prettyLabel(rawLabel);
    const confidence = Number(prediction?.confidence) || 0;

    if (elements.resultLabel) elements.resultLabel.textContent = label;
    if (elements.resultMeta) {
      elements.resultMeta.textContent = `${formatPct(confidence)} confidence | ${state.model}x${state.model}`;
    }

    if (elements.resultBanner) {
      elements.resultBanner.classList.remove("is-warn", "is-good");
      elements.resultBanner.classList.add(confidence < 0.6 ? "is-warn" : "is-good");
      elements.resultBanner.setAttribute("data-label-key", toneKey(rawLabel));
    }
  }

  function renderIdleBanner(message) {
    if (elements.resultLabel) elements.resultLabel.textContent = "Camera idle";
    if (elements.resultMeta) elements.resultMeta.textContent = message;
    if (elements.resultBanner) {
      elements.resultBanner.classList.remove("is-warn", "is-good");
      elements.resultBanner.removeAttribute("data-label-key");
    }
  }

  function clearLoopTimer() {
    if (!state.loopTimer) return;
    window.clearTimeout(state.loopTimer);
    state.loopTimer = null;
  }

  function scheduleInferenceLoop(delayMs = 0) {
    clearLoopTimer();
    if (!state.running) return;
    state.loopTimer = window.setTimeout(runInferenceLoop, delayMs);
  }

  function currentFrameCount() {
    if (!elements.video) return 0;

    const quality = elements.video.getVideoPlaybackQuality?.();
    if (quality && Number.isFinite(quality.totalVideoFrames)) {
      return Number(quality.totalVideoFrames);
    }

    const webkitCount = Number(elements.video.webkitDecodedFrameCount);
    if (Number.isFinite(webkitCount)) return webkitCount;

    return 0;
  }

  function startFpsMonitor() {
    stopFpsMonitor();
    state.lastFrameCount = 0;
    state.lastFrameCheckAt = 0;

    state.fpsTimer = window.setInterval(() => {
      if (!state.running) return;
      const now = performance.now();
      const frames = currentFrameCount();

      if (frames > 0 && state.lastFrameCount > 0 && state.lastFrameCheckAt > 0) {
        const frameDiff = frames - state.lastFrameCount;
        const timeDiff = now - state.lastFrameCheckAt;
        if (frameDiff >= 0 && timeDiff > 50) {
          const instant = (frameDiff * 1000) / timeDiff;
          state.cameraFps = state.cameraFps > 0 ? state.cameraFps * 0.7 + instant * 0.3 : instant;
        }
      }

      state.lastFrameCount = frames;
      state.lastFrameCheckAt = now;
      updateMetrics();
    }, 900);
  }

  function stopFpsMonitor() {
    if (!state.fpsTimer) return;
    window.clearInterval(state.fpsTimer);
    state.fpsTimer = null;
  }

  function stopStream() {
    clearLoopTimer();

    if (state.inFlightController) {
      try {
        state.inFlightController.abort();
      } catch {
        // Ignore abort failures.
      }
      state.inFlightController = null;
    }

    state.inFlight = false;
    state.running = false;
    state.starting = false;

    if (state.stream) {
      for (const track of state.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop failures.
        }
      }
      state.stream = null;
    }

    if (elements.video) {
      elements.video.pause();
      elements.video.srcObject = null;
    }

    stopFpsMonitor();
    state.cameraFps = 0;
    updateMetrics();

    if (elements.startBtn) elements.startBtn.disabled = false;
    if (elements.stopBtn) elements.stopBtn.disabled = true;
    if (elements.flipBtn) elements.flipBtn.disabled = true;

    renderIdleBanner("Press Start camera to begin live inference");
    setServiceBadge("Ready", "good");
    setStatusText("Camera stopped. Start again to resume live predictions.");
  }

  async function getCameraStream() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("Camera API unavailable in this browser.");
    }

    const preferred = {
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
    };

    try {
      return await navigator.mediaDevices.getUserMedia(preferred);
    } catch {
      const fallback = {
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      return navigator.mediaDevices.getUserMedia(fallback);
    }
  }

  async function startStream() {
    if (!elements.video || state.starting || state.running) return;

    state.starting = true;
    if (elements.startBtn) elements.startBtn.disabled = true;

    setServiceBadge("Starting camera", "good");
    setStatusText("Requesting camera permission...");

    try {
      const stream = await getCameraStream();
      state.stream = stream;

      elements.video.srcObject = stream;
      await elements.video.play();

      state.running = true;
      state.lastCaptureAt = 0;
      state.lastResultAt = 0;
      state.errorStreak = 0;

      if (elements.stopBtn) elements.stopBtn.disabled = false;
      if (elements.flipBtn) elements.flipBtn.disabled = false;

      startFpsMonitor();
      setServiceBadge("Live inference", "good");
      setStatusText("Live mode active. Keep the vegetable inside the center ring.");
      scheduleInferenceLoop(120);
    } catch (error) {
      if (elements.startBtn) elements.startBtn.disabled = false;
      const message = error && error.message ? String(error.message) : "Unable to access camera.";
      setServiceBadge("Camera blocked", "warn");
      setStatusText(message);
      renderIdleBanner(message);
    } finally {
      state.starting = false;
    }
  }

  function setModel(nextModel, triggerFastRefresh) {
    const value = nextModel === "101" ? "101" : "23";
    state.model = value;
    if (elements.modelInput) elements.modelInput.value = value;

    for (const card of elements.modelCards) {
      const selected = card.getAttribute("data-live-model") === value;
      card.classList.toggle("is-selected", selected);
    }

    if (state.running && triggerFastRefresh) {
      scheduleInferenceLoop(10);
    }
  }

  function bindModelCards() {
    for (const card of elements.modelCards) {
      const select = () => setModel(card.getAttribute("data-live-model"), true);
      card.addEventListener("click", select);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });
    }
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Unable to read camera frame."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    });
  }

  async function captureCenterFrameBlob() {
    if (!elements.video || !elements.captureCanvas) {
      throw new Error("Camera frame capture unavailable.");
    }

    const vw = Number(elements.video.videoWidth) || 0;
    const vh = Number(elements.video.videoHeight) || 0;
    if (vw < 8 || vh < 8) {
      throw new Error("Camera is not ready yet.");
    }

    const capturePx = captureResolution();
    const centerCrop = Math.floor(Math.min(vw, vh) * 0.64);
    const sx = Math.floor((vw - centerCrop) * 0.5);
    const sy = Math.floor((vh - centerCrop) * 0.5);

    const canvas = elements.captureCanvas;
    canvas.width = capturePx;
    canvas.height = capturePx;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(elements.video, sx, sy, centerCrop, centerCrop, 0, 0, capturePx, capturePx);

    return canvasToBlob(canvas, captureQuality());
  }

  async function inferCurrentFrame() {
    state.inFlight = true;

    try {
      const frameBlob = await captureCenterFrameBlob();
      const form = new FormData();
      form.append("image", frameBlob, "live-frame.jpg");
      form.append("model", state.model);
      form.append("save", "0");
      form.append("predict_mode", "single");

      const controller = new AbortController();
      state.inFlightController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 3800);

      const startedAt = performance.now();
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/infer") : "/api/infer", {
        method: "POST",
        body: form,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      window.clearTimeout(timeoutId);

      const latency = performance.now() - startedAt;
      state.latencyEmaMs = state.latencyEmaMs > 0 ? state.latencyEmaMs * 0.78 + latency * 0.22 : latency;

      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !data.ok || !data.prediction) {
        const fallback = data && data.message ? String(data.message) : "Inference service unavailable.";
        throw new Error(fallback);
      }

      const prediction = data.prediction;
      renderBanner(prediction);
      renderTopList(prediction.topK);

      const now = performance.now();
      if (state.lastResultAt > 0) {
        const dt = now - state.lastResultAt;
        if (dt > 20) {
          const instantRate = 1000 / dt;
          state.inferRateEma = state.inferRateEma > 0 ? state.inferRateEma * 0.75 + instantRate * 0.25 : instantRate;
        }
      }
      state.lastResultAt = now;

      state.captureCount += 1;
      state.errorStreak = 0;
      setServiceBadge("Live inference", "good");
      setStatusText("Live predictions updating continuously.");
      updateMetrics();
    } finally {
      state.inFlight = false;
      state.inFlightController = null;
    }
  }

  async function runInferenceLoop() {
    if (!state.running) return;

    if (document.visibilityState !== "visible") {
      scheduleInferenceLoop(420);
      return;
    }

    if (state.inFlight) {
      scheduleInferenceLoop(24);
      return;
    }

    const now = performance.now();
    const elapsed = now - state.lastCaptureAt;
    const waitMs = getTargetIntervalMs() - elapsed;
    if (waitMs > 6) {
      scheduleInferenceLoop(Math.min(waitMs, 80));
      return;
    }

    state.lastCaptureAt = now;

    try {
      await inferCurrentFrame();
      scheduleInferenceLoop(0);
    } catch (error) {
      state.errorStreak += 1;
      const message = error && error.message ? String(error.message) : "Live inference failed.";
      setServiceBadge("Service issue", "warn");
      setStatusText(message);
      scheduleInferenceLoop(clamp(260 + state.errorStreak * 180, 260, 1400));
    }
  }

  async function flipCamera() {
    state.facingMode = state.facingMode === "environment" ? "user" : "environment";
    if (!state.running) return;

    setStatusText("Switching camera...");
    const keepModel = state.model;
    stopStream();
    setModel(keepModel, false);
    await startStream();
  }

  function bindControls() {
    if (elements.startBtn) {
      elements.startBtn.addEventListener("click", () => {
        startStream().catch(() => null);
      });
    }

    if (elements.stopBtn) {
      elements.stopBtn.addEventListener("click", () => {
        stopStream();
      });
    }

    if (elements.flipBtn) {
      elements.flipBtn.addEventListener("click", () => {
        flipCamera().catch(() => null);
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (!state.running) return;
      if (document.visibilityState === "visible") {
        scheduleInferenceLoop(30);
      }
    });

    window.addEventListener("pagehide", () => {
      stopStream();
    });
  }

  setModel("23", false);
  bindModelCards();
  bindControls();
  updateMetrics();

  if (window.isSecureContext === false) {
    setServiceBadge("Requires HTTPS", "warn");
    setStatusText("Camera access needs HTTPS or localhost in most browsers.");
  }
}

if (typeof onReady === "function") {
  onReady(() => {
    setupLivePredictor();
  });
} else {
  document.addEventListener("DOMContentLoaded", () => {
    setupLivePredictor();
  });
}
