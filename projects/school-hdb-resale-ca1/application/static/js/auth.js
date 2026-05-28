document.addEventListener("DOMContentLoaded", () => {
  const authSection = document.querySelector("[data-auth-shell]");
  if (!authSection) return;

  const shell = authSection.querySelector(".auth-shell");
  const modeButtons = authSection.querySelectorAll("[data-auth-mode-btn]");
  const forms = authSection.querySelectorAll(".auth-form-card");

  if (!shell || !modeButtons.length || !forms.length) return;

  const setMode = (mode) => {
    const normalized = mode === "login" ? "login" : "signup";
    shell.setAttribute("data-auth-mode", normalized);
    authSection.setAttribute("data-auth-mode", normalized);

    forms.forEach(form => {
      const isActive = form.getAttribute("data-mode") === normalized;
      form.setAttribute("aria-hidden", (!isActive).toString());
    });
  };

  const updateFooterOffset = () => {
    const footer = document.querySelector(".footer-bar");
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--footer-height", `${footerHeight}px`);
  };

  modeButtons.forEach(btn => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const mode = btn.getAttribute("data-auth-mode-btn");
      setMode(mode);
    });
  });

  const initialMode = authSection.getAttribute("data-initial-mode");
  setMode(initialMode === "login" ? "login" : "signup");
  updateFooterOffset();
  window.addEventListener("resize", updateFooterOffset);
});
