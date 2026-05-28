document.addEventListener('DOMContentLoaded', function () {
  const loader = document.getElementById('prediction-loader');
  const resultsContainer = document.querySelector('.prediction-results');
  const lightbox = document.getElementById('shap-lightbox');
  const lightboxImage = lightbox ? lightbox.querySelector('.shap-lightbox__image') : null;
  const averageDataElement = document.getElementById('floor-area-lookup-data');
  let averageData = {};

  if (averageDataElement) {
    try {
      averageData = JSON.parse(averageDataElement.textContent || '{}');
    } catch (err) {
      console.warn('Unable to parse floor area lookup data', err);
    }
  }

  // --- Progress bar updater ---
  function updateProgressBars() {
    document.querySelectorAll('.progress-bar[data-progress]').forEach(bar => {
      const value = parseFloat(bar.getAttribute('data-progress') || '0');
      bar.style.width = Math.max(0, Math.min(100, value)) + '%';
    });
  }

  // --- Chart lightbox handlers ---
  function setLoaderVisibility(isLoading) {
    if (!loader) return;
    if (isLoading) {
      loader.classList.remove('d-none');
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    } else {
      loader.classList.add('d-none');
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
  }

  function initLightbox(scope = document) {
    if (!lightbox || !lightboxImage) return;
    const triggers = scope.querySelectorAll('[data-lightbox-src]');
    if (!triggers.length) return;

    triggers.forEach(trigger => {
      if (trigger.dataset.lightboxBound === '1') return;
      trigger.addEventListener('click', () => {
        const src = trigger.getAttribute('data-lightbox-src');
        if (!src) return;
        const label = trigger.getAttribute('data-lightbox-label') || 'Expanded chart';
        lightboxImage.setAttribute('src', src);
        lightboxImage.setAttribute('alt', label);
        lightbox.classList.remove('d-none');
        document.body.classList.add('modal-open');
      });
      trigger.dataset.lightboxBound = '1';
    });

    if (lightbox.dataset.bound === '1') return;
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox || e.target.classList.contains('shap-lightbox__backdrop')) closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !lightbox.classList.contains('d-none')) closeLightbox();
    });
    lightbox.dataset.bound = '1';
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImage) return;
    lightbox.classList.add('d-none');
    lightboxImage.removeAttribute('src');
    document.body.classList.remove('modal-open');
  }

  function setupAverageControls() {
    const floorAreaInput = document.getElementById('field-floor_area_sqm');
    const useAverageButton = document.getElementById('use-average-floor-area');
    const averageFlagInput = document.getElementById('use-average-floor-area-flag');
    const averageStatus = document.getElementById('average-floor-area-status');
    const flatTypeSelect = document.getElementById('field-flat_type');
    const flatModelSelect = document.getElementById('field-flat_model');
    const townSelect = document.getElementById('field-town');

    function getAverageFloorArea() {
      const explain = (reason) => ({ value: null, reason });
      if (!flatTypeSelect || !townSelect) return explain('Required select inputs are missing.');
      const flatType = flatTypeSelect.value;
      const flatModel = flatModelSelect ? flatModelSelect.value : '';
      const town = townSelect.value;
      if (!flatType) return explain('Flat type not selected.');
      if (!town) return explain('Town not selected.');
      const flatTypeMap = averageData?.[flatType];
      if (!flatTypeMap) return explain(`No lookup entry for flat type "${flatType}".`);
      const modelMap = flatModel ? flatTypeMap?.[flatModel] : null;
      const value = modelMap ? modelMap?.[town] : undefined;
      if (typeof value === 'number' && !Number.isNaN(value)) return { value, reason: null };

      const fallbackMap = flatTypeMap?.__ANY__;
      const fallbackValue = fallbackMap ? fallbackMap?.[town] : undefined;
      if (typeof fallbackValue === 'number' && !Number.isNaN(fallbackValue)) {
        return { value: fallbackValue, reason: null };
      }

       const typeAverage = flatTypeMap?.__FLAT_TYPE_AVG__;
       if (typeof typeAverage === 'number' && !Number.isNaN(typeAverage)) {
         return { value: typeAverage, reason: null };
       }

      if (flatModel && !modelMap) {
        return explain(`No lookup entry for flat model "${flatModel}" under flat type "${flatType}".`);
      }

      const modelHint = flatModel ? ` and model "${flatModel}"` : '';
      return explain(`No floor area data for town "${town}" with flat type "${flatType}"${modelHint}.`);
    }

    const updateAverageStatus = () => {
      if (!averageStatus) return;
      const avgInfo = getAverageFloorArea();
      const avg = typeof avgInfo === 'number' ? avgInfo : avgInfo?.value;
      const reason = avgInfo && typeof avgInfo === 'object' ? avgInfo.reason : null;
      averageStatus.classList.remove('text-success', 'text-danger');

      const hasAvg = typeof avg === 'number' && !Number.isNaN(avg);
      if (averageFlagInput && averageFlagInput.value === '1') {
        if (hasAvg) {
          averageStatus.textContent = `Using average: ${avg.toFixed(1)} sqm`;
          averageStatus.classList.add('text-success');
        } else {
          averageStatus.textContent = 'Average floor area not available for this selection.';
          averageStatus.classList.add('text-danger');
        }
      } else if (hasAvg) {
        averageStatus.textContent = `Average available: ${avg.toFixed(1)} sqm`;
      } else {
        if (reason) console.debug('[FloorAreaLookup]', reason, { flatType: flatTypeSelect?.value, flatModel: flatModelSelect?.value, town: townSelect?.value });
        averageStatus.textContent = 'Average floor area not available for this selection.';
        averageStatus.classList.add('text-danger');
      }
    };

    const applyAverageFloorArea = () => {
      if (!floorAreaInput) return;
      const avgInfo = getAverageFloorArea();
      const avg = typeof avgInfo === 'number' ? avgInfo : avgInfo?.value;
      if (typeof avg === 'number' && !Number.isNaN(avg)) {
        floorAreaInput.value = avg.toFixed(1);
        if (averageFlagInput) averageFlagInput.value = '1';
      } else if (averageFlagInput) {
        averageFlagInput.value = '';
      }
      updateAverageStatus();
    };

    if (useAverageButton && !useAverageButton.dataset.bound) {
      useAverageButton.addEventListener('click', () => {
        applyAverageFloorArea();
        const avgInfo = getAverageFloorArea();
        const avg = typeof avgInfo === 'number' ? avgInfo : avgInfo?.value;
        if (!(typeof avg === 'number' && !Number.isNaN(avg))) {
          alert('Average floor area is not available for the selected combination.');
        }
      });
      useAverageButton.dataset.bound = '1';
    }

    const bindChangeHandler = (element) => {
      if (!element || element.dataset.avgBound) return;
      element.addEventListener('change', () => {
        if (averageFlagInput && averageFlagInput.value === '1') {
          applyAverageFloorArea();
        } else {
          updateAverageStatus();
        }
      });
      element.dataset.avgBound = '1';
    };

    bindChangeHandler(flatTypeSelect);
    bindChangeHandler(townSelect);
    bindChangeHandler(flatModelSelect);

    if (floorAreaInput && !floorAreaInput.dataset.avgBound) {
      floorAreaInput.addEventListener('input', () => {
        if (averageFlagInput) {
          averageFlagInput.value = '';
        }
        updateAverageStatus();
      });
      floorAreaInput.dataset.avgBound = '1';
    }

    if (averageFlagInput && averageFlagInput.value === '1') {
      applyAverageFloorArea();
    } else {
      updateAverageStatus();
    }
  }

  function activateAnimations(scope) {
    if (!scope) return;
    const targets = scope.querySelectorAll('[data-animate]');
    targets.forEach(target => {
      const direction = target.getAttribute('data-animate');
      target.classList.add('animate-in');
      if (direction) target.classList.add(`from-${direction}`);
      target.classList.remove('animate-out');
      if (direction) target.classList.remove(`to-${direction}`);
      target.style.opacity = 1;
    });
  }

  function initConsoleTabs(scope = document) {
    const tabs = scope.querySelectorAll('.console-tab[data-bs-target]');
    const panes = scope.querySelectorAll('#prediction-input-tabs-content .tab-pane');
    if (!tabs.length || !panes.length) return;

    const setActiveTab = (targetSelector) => {
      tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.bsTarget === targetSelector));
      panes.forEach(pane => {
        if (`#${pane.id}` === targetSelector) {
          pane.classList.add('show', 'active');
        } else {
          pane.classList.remove('show', 'active');
        }
      });
    };

    tabs.forEach(tab => {
      if (tab.dataset.tabBound === '1') return;
      tab.addEventListener('click', (event) => {
        event.preventDefault();
        const target = tab.dataset.bsTarget;
        if (target) setActiveTab(target);
      });
      tab.dataset.tabBound = '1';
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    loader?.classList.remove('d-none');

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const response = await fetch(form.action, {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error("Prediction failed");

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newResults = doc.querySelector('.prediction-results');
      const newFormPane = doc.getElementById('predict-tab-pane');

      if (newResults && resultsContainer) {
        resultsContainer.innerHTML = newResults.innerHTML;
        activateAnimations(resultsContainer);
        initConsoleTabs(resultsContainer.closest('.predict-section') || document);
      }

      if (newFormPane) {
        const currentPane = document.getElementById('predict-tab-pane');
        if (currentPane) {
          currentPane.innerHTML = newFormPane.innerHTML;
        }
      }

      attachFormHandler();
      setupAverageControls();
      updateProgressBars();
      initLightbox();
      initConsoleTabs();
    } catch (err) {
      console.error(err);
      alert("Prediction failed. Please try again.");
    } finally {
      loader?.classList.add('d-none');
    }
  }

  function attachFormHandler() {
    const form = document.getElementById('prediction-form');
    if (!form || form.dataset.ajaxBound === '1') return;
    form.addEventListener('submit', handleSubmit);
    form.dataset.ajaxBound = '1';
  }

  // Initialize defaults
  attachFormHandler();
  setupAverageControls();
  updateProgressBars();
  initLightbox();
  initConsoleTabs();
  activateAnimations(document);
});
