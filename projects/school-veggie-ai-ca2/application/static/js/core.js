function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }
  callback();
}

function enablePageTransitions() {
  const body = document.body;
  if (!body) return;

  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOADER_MIN_VISIBLE_MS = prefersReduced ? 0 : 260;
  const prefetched = new Set();

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  const slowNetwork = Boolean(connection && /(^|-)2g$/.test(String(connection.effectiveType || "")));
  const allowPrefetch = !saveData && !slowNetwork;

  const supportsPrefetch = (() => {
    const link = document.createElement("link");
    return Boolean(link.relList && typeof link.relList.supports === "function" && link.relList.supports("prefetch"));
  })();

  const shouldSkipUrl = (url) => {
    if (!url || url.origin !== window.location.origin) return true;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return true;
    if (/^(mailto:|tel:)/i.test(String(url.href || ""))) return true;
    return false;
  };

  const prefetchUrl = (href) => {
    if (!allowPrefetch || !supportsPrefetch) return;
    if (!href) return;
    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (shouldSkipUrl(url)) return;

    const key = `${url.origin}${url.pathname}${url.search}`;
    if (prefetched.has(key)) return;
    prefetched.add(key);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = url.toString();
    document.head.appendChild(link);
  };

  const collectLikelyLinks = () => {
    const anchors = Array.from(document.querySelectorAll(".nav-links a[href], .nav-actions a[href]"));
    const urls = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#")) continue;
      urls.push(href);
    }
    return urls;
  };

  const warmLikelyPages = () => {
    const links = collectLikelyLinks();
    if (!links.length) return;
    links.forEach((href, idx) => {
      window.setTimeout(() => prefetchUrl(href), 40 + idx * 90);
    });
  };

  const enterReady = () => {
    body.classList.remove("is-loading", "is-leaving");
    body.classList.add("is-ready");
  };

  const leaveReady = () => {
    body.classList.remove("is-ready");
    body.classList.add("is-loading", "is-leaving");
  };

  window.setTimeout(enterReady, LOADER_MIN_VISIBLE_MS);
  if (allowPrefetch) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => warmLikelyPages(), { timeout: 900 });
    } else {
      window.setTimeout(warmLikelyPages, 220);
    }
  }

  const navigateWithLoader = (url) => {
    leaveReady();
    window.setTimeout(
      () => {
        window.location.href = url.toString();
      },
      prefersReduced ? 0 : 220
    );
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest("a");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
      return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    navigateWithLoader(url);
  });

  document.addEventListener(
    "pointerover",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;
      prefetchUrl(link.getAttribute("href") || "");
    },
    { capture: true }
  );

  document.addEventListener(
    "focusin",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;
      prefetchUrl(link.getAttribute("href") || "");
    },
    { capture: true }
  );

  document.addEventListener("submit", (event) => {
    if (event.defaultPrevented) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.target && form.target !== "_self") return;
    if (typeof form.checkValidity === "function" && !form.checkValidity()) return;
    leaveReady();
  });

  window.addEventListener("pageshow", () => {
    window.setTimeout(enterReady, 0);
  });
}

function enableRevealOnScroll() {
  const items = Array.from(document.querySelectorAll(".reveal"));
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );

  items.forEach((el) => observer.observe(el));
}

function enableParallaxBackgrounds() {
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  const elements = Array.from(document.querySelectorAll(".hero, .scenic"));
  if (!elements.length) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const viewportHeight = window.innerHeight || 1;
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height * 0.45;
      const progress = (centerY - viewportHeight * 0.5) / viewportHeight;
      const offset = Math.max(-22, Math.min(22, Math.round(progress * -26)));
      el.style.setProperty("--bg-offset", `${offset}px`);
    }
  };

  const requestTick = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  requestTick();
}

function setupCountUp() {
  const items = Array.from(document.querySelectorAll("[data-countup]"));
  if (!items.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) {
    items.forEach((el) => {
      const target = Number(el.getAttribute("data-countup") || 0);
      el.textContent = String(Number.isFinite(target) ? Math.round(target) : 0);
    });
    return;
  }

  const animate = (el) => {
    const target = Number(el.getAttribute("data-countup") || 0);
    if (!Number.isFinite(target)) return;

    const duration = 900;
    const start = performance.now();
    const from = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      el.textContent = String(value);
      if (t < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.counted === "1") return;
        el.dataset.counted = "1";
        animate(el);
        observer.unobserve(el);
      });
    },
    { root: null, threshold: 0.25 }
  );

  items.forEach((el) => observer.observe(el));
}

function setupMockForms() {
  // Legacy placeholder hook removed.
}

onReady(() => {
  enablePageTransitions();
  enableRevealOnScroll();
  enableParallaxBackgrounds();
  setupCountUp();
});
