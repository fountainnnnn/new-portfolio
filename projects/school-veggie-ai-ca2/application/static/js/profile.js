function setupProfileDashboard() {
  const root = document.querySelector("[data-page='profile']");
  if (!root) return;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[ch] || ch;
    });
  }

  function formatPct(value) {
    return `${(value * 100).toFixed(1)}%`;
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
    if (!raw) return "Unknown";
    return raw.replace(/_/g, " ");
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

  function confidenceTier(value) {
    if (value >= 0.95) return { label: "Verified", className: "chip--good", icon: "bi-patch-check" };
    if (value >= 0.85) return { label: "Confident", className: "chip--good", icon: "bi-check2-circle" };
    if (value >= 0.7) return { label: "Uncertain", className: "chip--warn", icon: "bi-exclamation-triangle" };
    return { label: "Low", className: "chip--warn", icon: "bi-exclamation-octagon" };
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

  const exportBtn = root.querySelector("#profileExportHistory");
  const clearBtn = root.querySelector("#profileClearHistory");
  const deleteSelectedBtn = root.querySelector("#profileDeleteSelected");
  const errorHunterBadge = root.querySelector("#profileErrorHunterBadge");
  const activePredictorBadge = root.querySelector("#profileActivePredictorBadge");
  const listEl = root.querySelector("#profileHistoryList");
  const historyPreviewModalEl = document.getElementById("profileHistoryPreviewModal");
  const historyPreviewMetaEl = document.getElementById("historyPreviewMeta");
  const historyPreviewImageEl = document.getElementById("historyPreviewImage");
  const historyPreviewImageEmptyEl = document.getElementById("historyPreviewImageEmpty");
  const historyPreviewLabelEl = document.getElementById("historyPreviewLabel");
  const historyPreviewModelChipEl = document.getElementById("historyPreviewModelChip");
  const historyPreviewConfidenceChipEl = document.getElementById("historyPreviewConfidenceChip");
  const historyPreviewCorrectedChipEl = document.getElementById("historyPreviewCorrectedChip");
  const historyPreviewDescriptionEl = document.getElementById("historyPreviewDescription");
  const historyPreviewBenefitsEl = document.getElementById("historyPreviewBenefits");
  const historyPreviewDonutEl = document.getElementById("historyPreviewDonut");
  const historyPreviewDonutValueEl = document.getElementById("historyPreviewDonutValue");
  const historyPreviewConfidenceLabelEl = document.getElementById("historyPreviewConfidenceLabel");
  const historyPreviewTopkEl = document.getElementById("historyPreviewTopk");
  const historyPreviewCompareCardEl = document.getElementById("historyPreviewCompareCard");
  const historyPreviewCompareBadgeEl = document.getElementById("historyPreviewCompareBadge");
  const historyPreviewCompare23El = document.getElementById("historyPreviewCompare23");
  const historyPreviewCompare23LabelEl = document.getElementById("historyPreviewCompare23Label");
  const historyPreviewCompare101El = document.getElementById("historyPreviewCompare101");
  const historyPreviewCompare101LabelEl = document.getElementById("historyPreviewCompare101Label");

  let historyPreviewModal = null;

  const VEGGIE_INFO = {
    bean: {
      description: "Beans are edible pods or seeds from legumes, commonly used in stir-fries, soups, and stews.",
      benefits: ["High in fiber for digestion", "Provides plant-based protein", "Supports blood sugar control"],
    },
    bittergourd: {
      description: "Bitter gourd is a tropical vegetable with a strong bitter flavor, popular in many Asian dishes.",
      benefits: ["Rich in vitamin C", "Contains antioxidant compounds", "Traditionally used for glucose support"],
    },
    brinjal: {
      description: "Brinjal (eggplant) is a soft-fleshed vegetable that absorbs flavors well in curries and roasts.",
      benefits: ["Good source of fiber", "Contains anthocyanin antioxidants", "Low-calorie, filling ingredient"],
    },
    cabbage: {
      description: "Cabbage is a leafy cruciferous vegetable used raw in slaws or cooked in soups and stir-fries.",
      benefits: ["High in vitamin K and C", "Supports gut health", "Contains anti-inflammatory compounds"],
    },
    capsicum: {
      description: "Capsicum (bell pepper) is a crunchy vegetable available in green, red, and yellow varieties.",
      benefits: ["Very high in vitamin C", "Contains carotenoids", "Adds fiber with low calories"],
    },
    cauliflowerbroccoli: {
      description: "Cauliflower and broccoli are cruciferous vegetables with similar texture and nutritional profiles.",
      benefits: ["High in fiber and folate", "Rich in vitamin C", "Contains beneficial sulfur compounds"],
    },
    cucumberbottlegourd: {
      description: "Cucumber and bottle gourd are water-rich vegetables commonly used for cooling, light dishes.",
      benefits: ["Hydration support", "Low calorie density", "Contains gentle fiber for digestion"],
    },
    potato: {
      description: "Potato is a starchy tuber used worldwide in baked, boiled, fried, and mashed preparations.",
      benefits: ["Source of potassium", "Provides complex carbohydrates", "Contains vitamin B6 and vitamin C"],
    },
    pumpkin: {
      description: "Pumpkin is a mildly sweet squash used in soups, curries, roasting, and desserts.",
      benefits: ["Rich in beta-carotene", "Good source of fiber", "Supports eye and immune health"],
    },
    radishcarrot: {
      description: "Radish and carrot are crunchy root vegetables often eaten raw, pickled, or cooked.",
      benefits: ["Provides antioxidants", "Supports digestive health", "Source of vitamin A precursors"],
    },
    tomato: {
      description: "Tomato is a fruit-vegetable staple used fresh, cooked, or blended into sauces.",
      benefits: ["Contains lycopene antioxidants", "Source of vitamin C and potassium", "Supports heart-friendly diets"],
    },
  };

  function normalizeVeggieKey(label) {
    return String(label || "")
      .toLowerCase()
      .replace(/[_/\s-]+/g, "");
  }

  function getVeggieInfo(label) {
    const rawKey = normalizeVeggieKey(label);
    const aliases = {
      cauliflowerbroccoli: "cauliflowerbroccoli",
      cucumberbottlegourd: "cucumberbottlegourd",
      radishcarrot: "radishcarrot",
      bittergourd: "bittergourd",
    };
    const key = aliases[rawKey] || rawKey;
    return (
      VEGGIE_INFO[key] || {
        description: "This vegetable appears in your prediction history. Use clear framing and lighting for reliable inference.",
        benefits: ["Nutrient-dense whole-food ingredient", "Adds natural fiber to meals", "Supports balanced diet patterns"],
      }
    );
  }

  function normalizeTopK(entry) {
    const raw = entry?.topK || entry?.top_k || [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const label = prettyLabel(item?.label || "");
        const score = toUnitScore(item?.score);
        return { label, score: Number.isFinite(score) ? score : 0 };
      })
      .filter((item) => item.label)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function toUnitScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric > 1 && numeric <= 100) return Math.max(0, Math.min(1, numeric / 100));
    return Math.max(0, Math.min(1, numeric));
  }

  function originalLabelFromEntry(entry) {
    const value = entry?.original_label ?? entry?.originalLabel ?? "";
    return String(value || "").trim();
  }

  function isEntryCorrected(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (Boolean(entry.is_corrected) || Boolean(entry.isCorrected)) return true;
    if (entry.corrected_at || entry.correctedAt) return true;

    const current = String(entry.label || "").trim();
    const original = originalLabelFromEntry(entry);
    return Boolean(current && original && current !== original);
  }

  function ensureHistoryPreviewModal() {
    if (!historyPreviewModalEl || !window.bootstrap || !window.bootstrap.Modal) return null;
    if (!historyPreviewModal) historyPreviewModal = new window.bootstrap.Modal(historyPreviewModalEl);
    return historyPreviewModal;
  }

  function renderHistoryPreview(record) {
    if (!record) return;

    const label = prettyLabel(record.label || "-");
    const model = formatModel(record.model);
    const confidence = toUnitScore(record.confidence || 0);
    const confidencePct = `${(confidence * 100).toFixed(1)}%`;
    const ts = record?.ts ? new Date(record.ts) : null;
    const timeText = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString() : "Unknown time";
    const rawImageUrl = record?.image_url || record?.imageUrl || "";
    const imageUrl = rawImageUrl && window.withAppBasePath ? window.withAppBasePath(rawImageUrl) : rawImageUrl;
    const isCorrected = isEntryCorrected(record);
    const originalLabel = prettyLabel(originalLabelFromEntry(record));
    const info = getVeggieInfo(record.label);
    const topK = normalizeTopK(record);
    const compare = record?.compare || null;
    const modal = ensureHistoryPreviewModal();
    if (!modal) {
      if (imageUrl) window.open(imageUrl, "_blank", "noopener");
      return;
    }

    if (historyPreviewMetaEl) historyPreviewMetaEl.textContent = `${model} - ${timeText}`;
    if (historyPreviewLabelEl) historyPreviewLabelEl.textContent = label;
    if (historyPreviewModelChipEl) historyPreviewModelChipEl.innerHTML = `<i class="bi bi-cpu"></i> ${escapeHtml(model)}`;
    if (historyPreviewConfidenceChipEl) {
      const tier = confidenceTier(confidence);
      historyPreviewConfidenceChipEl.className = `chip ${tier.className}`;
      historyPreviewConfidenceChipEl.innerHTML = `<i class="bi ${tier.icon}"></i> ${escapeHtml(confidencePct)}`;
    }
    if (historyPreviewCorrectedChipEl) {
      historyPreviewCorrectedChipEl.hidden = !isCorrected;
      historyPreviewCorrectedChipEl.title = isCorrected ? `Original label: ${originalLabel}` : "";
    }

    if (historyPreviewDescriptionEl) historyPreviewDescriptionEl.textContent = info.description;
    if (historyPreviewBenefitsEl) {
      historyPreviewBenefitsEl.innerHTML = "";
      for (const text of info.benefits) {
        const li = document.createElement("li");
        li.className = "history-preview-benefit";
        li.innerHTML = `<i class="bi bi-check2-circle"></i><span>${escapeHtml(text)}</span>`;
        historyPreviewBenefitsEl.appendChild(li);
      }
    }

    if (historyPreviewImageEl && historyPreviewImageEmptyEl) {
      if (imageUrl) {
        historyPreviewImageEl.src = imageUrl;
        historyPreviewImageEl.hidden = false;
        historyPreviewImageEmptyEl.hidden = true;
      } else {
        historyPreviewImageEl.hidden = true;
        historyPreviewImageEl.removeAttribute("src");
        historyPreviewImageEmptyEl.hidden = false;
      }
    }

    if (historyPreviewDonutEl) historyPreviewDonutEl.style.setProperty("--pct", String(confidence * 100));
    if (historyPreviewDonutValueEl) historyPreviewDonutValueEl.textContent = confidencePct;
    if (historyPreviewConfidenceLabelEl) {
      const tier = confidenceTier(confidence);
      historyPreviewConfidenceLabelEl.textContent = `${tier.label} prediction confidence`;
    }

    if (historyPreviewTopkEl) {
      const rows = topK.length ? topK : [{ label, score: confidence }];
      historyPreviewTopkEl.innerHTML = rows
        .map(
          (item, idx) => `
            <div class="history-preview-topk-row">
              <div class="history-preview-topk-head">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(formatPct(item.score))}</strong>
              </div>
              <div class="history-preview-bar-track">
                <div class="history-preview-bar-fill ${idx === 0 ? "is-primary" : ""}" style="width:${Math.max(
                  2,
                  Math.round(item.score * 100)
                )}%"></div>
              </div>
            </div>
          `
        )
        .join("");
    }

    if (historyPreviewCompareCardEl && historyPreviewCompare23El && historyPreviewCompare101El) {
      const p23 = toUnitScore(compare?.p23?.confidence || 0);
      const p101 = toUnitScore(compare?.p101?.confidence || 0);
      const hasCompare = Number.isFinite(p23) && Number.isFinite(p101) && (p23 > 0 || p101 > 0);
      historyPreviewCompareCardEl.hidden = !hasCompare;
      if (hasCompare) {
        historyPreviewCompare23El.style.width = `${Math.max(2, Math.round(p23 * 100))}%`;
        historyPreviewCompare101El.style.width = `${Math.max(2, Math.round(p101 * 100))}%`;
        if (historyPreviewCompare23LabelEl) historyPreviewCompare23LabelEl.textContent = formatPct(p23);
        if (historyPreviewCompare101LabelEl) historyPreviewCompare101LabelEl.textContent = formatPct(p101);
        if (historyPreviewCompareBadgeEl) {
          const agrees = Boolean(compare?.agrees);
          historyPreviewCompareBadgeEl.className = `chip ${agrees ? "chip--good" : "chip--warn"}`;
          historyPreviewCompareBadgeEl.innerHTML = agrees
            ? '<i class="bi bi-check2-circle"></i> Models agree'
            : '<i class="bi bi-shuffle"></i> Models disagree';
        }
      }
    }

    modal.show();
  }

  let cachedHistory = null;
  let deletingInProgress = false;
  const selectedIds = new Set();

  async function loadHistory() {
    try {
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/predictions?limit=200") : "/api/predictions?limit=200", {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.ok && Array.isArray(data.predictions)) {
          cachedHistory = data.predictions;
          return cachedHistory;
        }
      }
    } catch {
      // ignore
    }
    cachedHistory = [];
    return cachedHistory;
  }

  function updateSelectionButtons() {
    const hasSelection = selectedIds.size > 0;
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = !hasSelection || deletingInProgress;
    if (clearBtn) clearBtn.disabled = !(cachedHistory && cachedHistory.length) || deletingInProgress;
  }

  async function deleteByIds(ids) {
    if (!ids.length) return;
    deletingInProgress = true;
    updateSelectionButtons();
    await Promise.all(
      ids.map((id) =>
        fetch(window.withAppBasePath ? window.withAppBasePath(`/api/predictions/${id}`) : `/api/predictions/${id}`, {
          method: "DELETE",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }).catch(() => null)
      )
    );
    deletingInProgress = false;
    selectedIds.clear();
    await loadHistory();
    render();
  }

  async function clearAllHistory() {
    deletingInProgress = true;
    updateSelectionButtons();
    await fetch(window.withAppBasePath ? window.withAppBasePath("/api/predictions") : "/api/predictions", {
      method: "DELETE",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    }).catch(() => null);
    deletingInProgress = false;
    selectedIds.clear();
    cachedHistory = [];
    render();
  }

  function bindHistoryActions() {
    if (!listEl) return;
    listEl.querySelectorAll("[data-history-select]").forEach((input) => {
      input.addEventListener("change", (event) => {
        const id = Number(event.target?.getAttribute("data-history-select") || 0);
        if (!id) return;
        if (event.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        const card = event.target.closest(".history-item");
        if (card) card.classList.toggle("history-item--selected", Boolean(event.target.checked));
        const selectEl = card?.querySelector(".history-select");
        if (selectEl) selectEl.classList.toggle("is-selected", Boolean(event.target.checked));
        updateSelectionButtons();
      });
    });

    listEl.querySelectorAll("[data-history-preview]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-history-preview") || 0);
        if (!id || !cachedHistory) return;
        const record = cachedHistory.find((x) => Number(x.id) === id);
        if (!record) return;
        renderHistoryPreview(record);
      });
    });

    listEl.querySelectorAll("[data-history-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-history-delete") || 0);
        if (!id) return;
        await deleteByIds([id]);
      });
    });
  }

  function render() {
    if (!cachedHistory) {
      if (listEl) listEl.innerHTML = '<div class="glass p-4 text-center text-muted">Loading history...</div>';
      loadHistory().then(() => render());
      return;
    }

    const history = cachedHistory;
    const historyIds = new Set(history.map((entry) => Number(entry.id)));
    Array.from(selectedIds).forEach((id) => {
      if (!historyIds.has(id)) selectedIds.delete(id);
    });
    const sample = history.slice(0, 30);

    const correctedCount = history.filter((entry) => isEntryCorrected(entry)).length;
    if (errorHunterBadge) {
      errorHunterBadge.hidden = correctedCount <= 5;
      if (!errorHunterBadge.hidden) {
        errorHunterBadge.title = `Error Hunter: corrected ${correctedCount} predictions`;
        errorHunterBadge.setAttribute("aria-label", `Error Hunter badge. Corrected ${correctedCount} predictions.`);
      }
    }
    const totalCount = history.length;
    if (activePredictorBadge) {
      activePredictorBadge.hidden = totalCount <= 5;
      if (!activePredictorBadge.hidden) {
        activePredictorBadge.title = `Active Predictor: made ${totalCount} predictions`;
        activePredictorBadge.setAttribute("aria-label", `Active Predictor badge. Made ${totalCount} predictions.`);
      }
    }

    const stats = {
      total: history.length,
      avg: 0,
      fav: "-",
      last: history[0]?.ts ? timeLabel(history[0].ts) : "-",
    };

    if (history.length) {
      stats.avg =
        history.reduce((sum, entry) => sum + Number(entry.confidence || 0), 0) / history.length;

      const counts = new Map();
      for (const entry of history) {
        const label = prettyLabel(entry.label || "Unknown");
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
          const id = Number(entry.id || 0);
          const isSelected = selectedIds.has(id);
          item.className = `history-item reveal is-visible${isSelected ? " history-item--selected" : ""}`;

          const conf = Math.max(0, Math.min(1, Number(entry.confidence || 0)));
          const tier = confidenceTier(conf);
          const model = formatModel(entry.model);
          const time = timeLabel(entry.ts);
          const label = escapeHtml(prettyLabel(entry.label || "-"));

          const apiThumbRaw = entry.image_url || entry.imageUrl || null;
          const apiThumb = apiThumbRaw && window.withAppBasePath ? window.withAppBasePath(apiThumbRaw) : apiThumbRaw;
          const thumbUrl = apiThumb || thumbForLabel(entry.label);
          const thumbClass = thumbUrl ? "history-thumb has-image" : "history-thumb";

          const disagrees =
            entry.compare?.p23?.label &&
            entry.compare?.p101?.label &&
            entry.compare.p23.label !== entry.compare.p101.label;

          const mode = entry?.metrics?.client?.predict_mode || entry?.metrics?.predict_mode || "";
          const isFridge = String(mode).toLowerCase() === "fridge";
          const tileIndex = Number(entry?.metrics?.client?.fridge_tile_index || 0);
          const tileTotal = Number(entry?.metrics?.client?.fridge_tile_total || 0);
          const fridgeTitle =
            tileIndex > 0 && tileTotal > 0 ? `Smart Fridge tile ${tileIndex} / ${tileTotal}` : "Smart Fridge prediction";

          const corrected = isEntryCorrected(entry);
          const original = prettyLabel(originalLabelFromEntry(entry));
          const checkedAttr = isSelected ? "checked" : "";

          item.innerHTML =
            `<label class="history-select history-select--left${isSelected ? " is-selected" : ""}" title="Select for delete">` +
            `<input type="checkbox" data-history-select="${id}" ${checkedAttr} aria-label="Select prediction ${id} for delete">` +
            `<i class="bi bi-check2-square"></i></label>` +
            `<div class="${thumbClass}"${thumbUrl ? ` style="--thumb-image: url('${thumbUrl}')"` : ""}>` +
            `<i class="bi bi-image"></i></div>` +
            `<div class="history-main">` +
            `<div style="font-weight: 850;">${label}</div>` +
            `<div class="text-muted small">${time}</div>` +
            `<div class="history-chips">` +
            `${isFridge ? `<span class="chip chip--fridge" title="${escapeHtml(fridgeTitle)}"><i class="bi bi-grid-3x3-gap"></i> Smart Fridge</span>` : ""}` +
            `<span class="chip chip--model"><i class="bi bi-cpu"></i> ${model}</span>` +
            `<span class="chip ${tier.className}"><i class="bi ${tier.icon}"></i> ${tier.label}</span>` +
            `${corrected ? `<span class="chip chip--corrected" title="Original: ${escapeHtml(original)}"><i class="bi bi-wrench-adjustable-circle"></i> Corrected</span>` : ""}` +
            `${disagrees ? `<span class="chip chip--warn"><i class="bi bi-shuffle"></i> Disagrees</span>` : ""}` +
            `</div>` +
            `</div>` +
            `<div class="history-score">` +
            `<strong>${formatPct(conf)}</strong>` +
            `<div class="text-muted small">Confidence</div>` +
            `<div class="history-meter" aria-hidden="true"><div class="history-meter-fill" style="width: 0%"></div></div>` +
            `<div class="history-actions">` +
            `<button class="btn btn-ghost btn-icon btn-sm history-icon-btn" type="button" data-history-preview="${id}" title="Preview prediction"><i class="bi bi-eye"></i></button>` +
            `<button class="btn btn-ghost btn-icon btn-sm history-icon-btn" type="button" data-history-delete="${id}" title="Delete"><i class="bi bi-trash3"></i></button>` +
            `</div>` +
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
    }

    bindHistoryActions();

    const distEl = root.querySelector("#profileConfDist");
    const distHint = root.querySelector("#profileConfDistHint");
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
      } else if (distHint) {
        distHint.hidden = false;
      }
    }

    const confusionEl = root.querySelector("#profileConfusions");
    const confusionHint = root.querySelector("#profileConfusionsHint");
    if (confusionEl) {
      confusionEl.innerHTML = "";
      const pairs = new Map();
      for (const entry of sample) {
        const compare = entry.compare;
        if (!compare?.p23?.label || !compare?.p101?.label) continue;
        if (compare.p23.label === compare.p101.label) continue;
        const key = `${prettyLabel(compare.p23.label)} -> ${prettyLabel(compare.p101.label)}`;
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

    updateSelectionButtons();
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const history = cachedHistory || [];
      downloadJson("veggieai-history.json", history);
    });
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener("click", async () => {
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      await deleteByIds(ids);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      await clearAllHistory();
    });
  }

  render();
}

function setupProfileEditModal() {
  const modalEl = document.getElementById("profileEditModal");
  if (!modalEl) return;

  const verifyUrl = modalEl.getAttribute("data-verify-url") || "";
  const isGoogleAccount = modalEl.getAttribute("data-google-account") === "true";
  let passwordSet = modalEl.getAttribute("data-password-set") === "true";
  const setPasswordUrl = "/profile/set-password";
  const csrfEl = modalEl.querySelector("#profileVerifyCsrf");
  const subtitleEl = modalEl.querySelector("#profileEditSubtitle");
  const verifyCard = modalEl.querySelector("#profileVerifyCard");
  const verifyForm = modalEl.querySelector("#profileVerifyForm");
  const passwordInput = modalEl.querySelector("#profileVerifyPassword");
  const verifyBtn = modalEl.querySelector("#profileVerifyBtn");
  const statusEl = modalEl.querySelector("#profileVerifyStatus");
  const profileUpdateForm = modalEl.querySelector("#profileUpdateForm");
  const phoneRegionSelect = modalEl.querySelector("#editPhoneRegion");
  const phoneLocalInput = modalEl.querySelector("#editPhoneLocal");
  const phoneHelpEl = modalEl.querySelector("#editPhoneHelp");
  const lockables = Array.from(modalEl.querySelectorAll("[data-lockable]"));
  const nonceTargets = Array.from(modalEl.querySelectorAll("[data-verify-nonce]"));
  const lockCards = Array.from(modalEl.querySelectorAll("[data-lock-card]"));

  const setPasswordCard = modalEl.querySelector("#profileSetPasswordCard");
  const setPasswordForm = modalEl.querySelector("#profileSetPasswordForm");
  const setPasswordInput = modalEl.querySelector("#profileSetPassword");
  const setPasswordConfirm = modalEl.querySelector("#profileSetPasswordConfirm");
  const setPasswordBtn = modalEl.querySelector("#profileSetPasswordBtn");
  const setPasswordStatus = modalEl.querySelector("#profileSetPasswordStatus");

  function needsInitialPasswordSetup() {
    return isGoogleAccount && !passwordSet;
  }

  function renderGateMode() {
    const requiresSetup = needsInitialPasswordSetup();
    if (verifyCard) verifyCard.hidden = requiresSetup;
    if (setPasswordCard) setPasswordCard.hidden = !requiresSetup;
    if (subtitleEl) {
      subtitleEl.textContent = requiresSetup
        ? "Set a password before changing account details."
        : "Verify your password before making changes.";
    }
  }

  function setStatus(message, kind = "muted") {
    if (!statusEl) return;
    statusEl.className = `text-${kind} small mt-2`;
    statusEl.textContent = message || "";
  }

  function setSetPasswordStatus(message, kind = "muted") {
    if (!setPasswordStatus) return;
    setPasswordStatus.className = `text-${kind} small mt-2`;
    setPasswordStatus.textContent = message || "";
  }

  function setUnlocked(unlocked) {
    for (const card of lockCards) {
      card.classList.toggle("is-locked", !unlocked);
    }
    for (const el of lockables) {
      el.disabled = !unlocked;
    }
    if (!unlocked) {
      for (const target of nonceTargets) {
        target.value = "";
      }
    }
  }

  function selectedPhoneRule() {
    if (!phoneRegionSelect) return null;
    const option = phoneRegionSelect.options[phoneRegionSelect.selectedIndex];
    if (!option || !option.value) return null;
    const min = Number(option.dataset.min || 0);
    const max = Number(option.dataset.max || 0);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return null;
    return { min, max };
  }

  function setPhoneHelpText(rule) {
    if (!phoneHelpEl) return;
    if (!rule) {
      phoneHelpEl.textContent = "Choose a region code, then enter digits only for the local number.";
      return;
    }
    if (rule.min === rule.max) {
      phoneHelpEl.textContent = `Enter exactly ${rule.min} digits for this region.`;
      return;
    }
    phoneHelpEl.textContent = `Enter ${rule.min}-${rule.max} digits for this region.`;
  }

  function applyPhoneRule() {
    if (!phoneLocalInput) return;
    const rule = selectedPhoneRule();
    phoneLocalInput.maxLength = rule ? rule.max : 15;
    if (rule && phoneLocalInput.value.length > rule.max) {
      phoneLocalInput.value = phoneLocalInput.value.slice(0, rule.max);
    }
    setPhoneHelpText(rule);
  }

  function validatePhoneInput() {
    if (!phoneRegionSelect || !phoneLocalInput) return true;

    const localRaw = String(phoneLocalInput.value || "").trim();
    if (!localRaw) {
      phoneRegionSelect.setCustomValidity("");
      phoneLocalInput.setCustomValidity("");
      return true;
    }

    if (!phoneRegionSelect.value) {
      phoneRegionSelect.setCustomValidity("Select a region code.");
      phoneLocalInput.setCustomValidity("");
      return false;
    }

    phoneRegionSelect.setCustomValidity("");

    if (!/^\d+$/.test(localRaw)) {
      phoneLocalInput.setCustomValidity("Phone number must contain digits only.");
      return false;
    }

    const rule = selectedPhoneRule();
    if (!rule) {
      phoneLocalInput.setCustomValidity("Selected region code is invalid.");
      return false;
    }

    if (localRaw.length < rule.min || localRaw.length > rule.max) {
      if (rule.min === rule.max) {
        phoneLocalInput.setCustomValidity(`Phone number must be exactly ${rule.min} digits.`);
      } else {
        phoneLocalInput.setCustomValidity(`Phone number must be ${rule.min}-${rule.max} digits.`);
      }
      return false;
    }

    phoneLocalInput.setCustomValidity("");
    return true;
  }

  async function verifyPassword(password) {
    if (!verifyUrl) return { ok: false, message: "Verification unavailable." };
    const token = csrfEl ? csrfEl.value : "";
    try {
      const response = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data && data.ok && data.nonce) {
        return { ok: true, nonce: data.nonce };
      }
      if (data && data.error === "password_not_set") {
        return { ok: false, code: "password_not_set", message: "No password set for this account." };
      }
      if (data && data.error === "invalid_password") {
        return { ok: false, message: "Incorrect password." };
      }
      return { ok: false, message: "Unable to verify password." };
    } catch {
      return { ok: false, message: "Network error while verifying password." };
    }
  }

  async function setPassword(newPassword, confirmPassword) {
    const token = csrfEl ? csrfEl.value : "";
    try {
      const response = await fetch(setPasswordUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
        },
        body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data && data.ok && data.nonce) {
        return { ok: true, nonce: data.nonce };
      }
      if (data && data.error === "password_too_short") {
        return { ok: false, message: "Password must be at least 8 characters long." };
      }
      if (data && data.error === "password_mismatch") {
        return { ok: false, message: "Passwords do not match." };
      }
      return { ok: false, message: "Unable to set password." };
    } catch {
      return { ok: false, message: "Network error while setting password." };
    }
  }

  if (verifyForm) {
    verifyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!passwordInput) return;

      const password = String(passwordInput.value || "");
      if (!password) {
        setStatus("Password is required.", "warning");
        return;
      }

      if (verifyBtn) verifyBtn.disabled = true;
      setStatus("Verifying...", "muted");
      const result = await verifyPassword(password);
      if (verifyBtn) verifyBtn.disabled = false;

      if (!result.ok) {
        setUnlocked(false);
        if (result.code === "password_not_set") {
          passwordSet = false;
          modalEl.setAttribute("data-password-set", "false");
          renderGateMode();
          setStatus("Set a password to unlock profile updates.", "warning");
        } else {
          setStatus(result.message || "Verification failed.", "warning");
        }
        return;
      }

      for (const target of nonceTargets) {
        target.value = result.nonce;
      }
      setUnlocked(true);
      setStatus("Verified. You can update your account details now.", "success");
    });
  }

  if (phoneLocalInput) {
    phoneLocalInput.addEventListener("input", () => {
      const digitsOnly = String(phoneLocalInput.value || "").replace(/\D+/g, "");
      if (digitsOnly !== phoneLocalInput.value) {
        phoneLocalInput.value = digitsOnly;
      }
      validatePhoneInput();
    });
    phoneLocalInput.addEventListener("blur", () => {
      if (!validatePhoneInput()) {
        phoneLocalInput.reportValidity();
      }
    });
  }

  if (phoneRegionSelect) {
    phoneRegionSelect.addEventListener("change", () => {
      applyPhoneRule();
      if (phoneLocalInput && phoneLocalInput.value.trim()) {
        validatePhoneInput();
        if (!phoneRegionSelect.checkValidity()) {
          phoneRegionSelect.reportValidity();
        }
      }
    });
    phoneRegionSelect.addEventListener("blur", () => {
      if (!validatePhoneInput()) {
        phoneRegionSelect.reportValidity();
      }
    });
  }

  if (profileUpdateForm) {
    profileUpdateForm.addEventListener("submit", (event) => {
      if (validatePhoneInput()) return;
      event.preventDefault();
      if (phoneRegionSelect && !phoneRegionSelect.checkValidity()) {
        phoneRegionSelect.reportValidity();
        return;
      }
      if (phoneLocalInput) phoneLocalInput.reportValidity();
    });
  }

  if (setPasswordForm) {
    setPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!setPasswordInput || !setPasswordConfirm) return;

      const newPassword = String(setPasswordInput.value || "");
      const confirmPassword = String(setPasswordConfirm.value || "");
      if (!newPassword) {
        setSetPasswordStatus("New password is required.", "warning");
        return;
      }

      if (setPasswordBtn) setPasswordBtn.disabled = true;
      setSetPasswordStatus("Saving...", "muted");
      const result = await setPassword(newPassword, confirmPassword);
      if (setPasswordBtn) setPasswordBtn.disabled = false;

      if (!result.ok) {
        setSetPasswordStatus(result.message || "Unable to set password.", "warning");
        return;
      }

      passwordSet = true;
      modalEl.setAttribute("data-password-set", "true");
      renderGateMode();
      setUnlocked(false);
      setSetPasswordStatus("Password set. Verify with your new password to continue.", "success");
      setStatus("Password set. Verify with your new password to unlock profile updates.", "success");
      if (setPasswordInput) setPasswordInput.value = "";
      if (setPasswordConfirm) setPasswordConfirm.value = "";
      if (passwordInput) passwordInput.focus();
    });
  }

  modalEl.addEventListener("shown.bs.modal", () => {
    setUnlocked(false);
    applyPhoneRule();
    validatePhoneInput();
    setStatus("");
    renderGateMode();
    setSetPasswordStatus("");
    if (setPasswordInput) setPasswordInput.value = "";
    if (setPasswordConfirm) setPasswordConfirm.value = "";
    if (needsInitialPasswordSetup()) {
      if (setPasswordInput) setPasswordInput.focus();
      return;
    }
    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.focus();
    }
  });

  modalEl.addEventListener("hidden.bs.modal", () => {
    setUnlocked(false);
    setStatus("");
    renderGateMode();
    setSetPasswordStatus("");
    if (setPasswordInput) setPasswordInput.value = "";
    if (setPasswordConfirm) setPasswordConfirm.value = "";
    if (passwordInput) passwordInput.value = "";
  });
}

onReady(() => {
  setupProfileDashboard();
  setupProfileEditModal();
});
