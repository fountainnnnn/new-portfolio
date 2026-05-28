function setupHomeDashboardPreview() {
  const root = document.querySelector("[data-page='home']");
  if (!root) return;

  const listEl = root.querySelector("#homeRecentList");
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

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[ch] || ch;
    });
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

  async function loadRecent() {
    try {
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/predictions?limit=3") : "/api/predictions?limit=3", {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.ok && Array.isArray(data.predictions)) {
        return data.predictions;
      }
    } catch {
      // ignore
    }
    return null;
  }

  function renderEmpty(message, actionHref, actionLabel) {
    const empty = document.createElement("div");
    empty.className = "glass p-4 text-center";
    empty.innerHTML =
      '<div class="feature-icon mx-auto mb-3"><i class="bi bi-clock-history"></i></div>' +
      `<p class="mb-1" style="font-weight: 850;">${escapeHtml(message)}</p>` +
      (actionHref
        ? `<a class="btn btn-primary btn-glow mt-3" href="${window.withAppBasePath ? window.withAppBasePath(actionHref) : actionHref}"><i class="bi bi-magic me-1"></i> ${escapeHtml(
            actionLabel || "Open"
          )}</a>`
        : "");
    listEl.appendChild(empty);
  }

  if (root.dataset.userAuthenticated !== "1") {
    listEl.innerHTML = "";
    renderEmpty("Sign in to see recent predictions", "/login", "Sign in");
    return;
  }

  loadRecent().then((predictions) => {
    listEl.innerHTML = "";
    if (!predictions) {
      renderEmpty("Sign in to see recent predictions", "/login", "Sign in");
      return;
    }

    const slice = predictions.slice(0, 3);
    if (!slice.length) {
      renderEmpty("No recent predictions yet", "/predictor", "Open Predictor");
      return;
    }

    for (const entry of slice) {
      const item = document.createElement("div");
      item.className = "history-item reveal is-visible";
      const conf = Math.max(0, Math.min(1, Number(entry.confidence || 0)));

      const apiThumbRaw = entry.image_url || entry.imageUrl || null;
      const apiThumb = apiThumbRaw && window.withAppBasePath ? window.withAppBasePath(apiThumbRaw) : apiThumbRaw;
      const thumbUrl = apiThumb || thumbForLabel(entry.label);
      const thumbClass = thumbUrl ? "history-thumb has-image" : "history-thumb";

      const label = escapeHtml(entry.label || "-");
      const time = timeLabel(entry.ts);
      const model = formatModel(entry.model);

      item.innerHTML =
        `<div class="${thumbClass}"${thumbUrl ? ` style="--thumb-image: url('${thumbUrl}')"` : ""}>` +
        `<i class="bi bi-image"></i></div>` +
        `<div><div style="font-weight: 850;">${label}</div>` +
        `<div class="text-muted small">${time} - ${model}</div></div>` +
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
  });
}

function setupHomeModelWarmup() {
  const root = document.querySelector("[data-page='home']");
  if (!root) return;

  const warmupKey = "veggieai_model_warmup_sent";
  try {
    if (window.sessionStorage && window.sessionStorage.getItem(warmupKey) === "1") return;
    if (window.sessionStorage) window.sessionStorage.setItem(warmupKey, "1");
  } catch {
    // Ignore storage access errors and continue best-effort warmup.
  }

  const triggerWarmup = () => {
    fetch(window.withAppBasePath ? window.withAppBasePath("/api/model/warmup") : "/api/model/warmup", {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    }).catch(() => {
      // Warmup is best-effort only; ignore failures.
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(triggerWarmup, { timeout: 1500 });
  } else {
    window.setTimeout(triggerWarmup, 200);
  }
}

onReady(() => {
  setupHomeDashboardPreview();
  setupHomeModelWarmup();
});
