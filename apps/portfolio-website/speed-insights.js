(function () {
  const isLocalHost = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  if (isLocalHost || window.location.protocol === "file:") return;

  window.si = window.si || function (...params) {
    window.siq = window.siq || [];
    window.siq.push(params);
  };

  if (document.head.querySelector('script[src*="/_vercel/speed-insights/script.js"]')) return;

  const script = document.createElement("script");
  script.src = "/_vercel/speed-insights/script.js";
  script.defer = true;
  script.dataset.sdkn = "@vercel/speed-insights";
  script.dataset.sdkv = "2.0.0";
  script.onerror = () => {
    console.log("[Vercel Speed Insights] Failed to load. Check content blockers or Vercel project setup.");
  };

  document.head.appendChild(script);
})();
