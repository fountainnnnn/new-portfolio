document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".section");
  const projectsSection = document.querySelector("#projects");
  const footer = document.querySelector("footer");
  const navLinks = [...document.querySelectorAll(".nav-link")]
    .filter(link => link.dataset.section || link.getAttribute("href")?.startsWith("#"));
  const navMenu = document.querySelector(".nav-menu");
  const navbarCollapse = document.getElementById("navbarNav");
  const navTrackedSections = [...sections, ...(projectsSection ? [projectsSection] : [])];
  const getNavSectionId = (link) => link.dataset.section || link.getAttribute("href")?.slice(1);

  const updateNavIndicator = (activeLink = document.querySelector(".nav-link[aria-current='page']")) => {
    if (!navMenu) return;

    if (!activeLink || !navMenu.contains(activeLink)) {
      navMenu.style.setProperty("--nav-indicator-opacity", "0");
      return;
    }

    const menuRect = navMenu.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();

    if (linkRect.width === 0 || linkRect.height === 0) {
      navMenu.style.setProperty("--nav-indicator-opacity", "0");
      return;
    }

    navMenu.style.setProperty("--nav-indicator-x", `${linkRect.left - menuRect.left}px`);
    navMenu.style.setProperty("--nav-indicator-y", `${linkRect.top - menuRect.top}px`);
    navMenu.style.setProperty("--nav-indicator-width", `${linkRect.width}px`);
    navMenu.style.setProperty("--nav-indicator-height", `${linkRect.height}px`);
    navMenu.style.setProperty("--nav-indicator-opacity", "1");
  };

  const setActiveNav = (sectionId) => {
    let activeLink = null;

    navLinks.forEach(link => {
      const targetId = getNavSectionId(link);
      if (targetId === sectionId) {
        link.setAttribute("aria-current", "page");
        activeLink = link;
      } else {
        link.removeAttribute("aria-current");
      }
    });

    requestAnimationFrame(() => updateNavIndicator(activeLink));
  };

  const getCurrentSectionId = () => {
    const marker = Math.min(window.innerHeight * 0.45, window.innerHeight - 1);
    return navTrackedSections.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= marker && rect.bottom > marker;
    })?.id || "";
  };

  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      setActiveNav(getNavSectionId(link));

      if (navbarCollapse?.classList.contains("show") && window.bootstrap?.Collapse) {
        window.bootstrap.Collapse.getOrCreateInstance(navbarCollapse).hide();
      }
    });
  });

  navbarCollapse?.addEventListener("shown.bs.collapse", () => updateNavIndicator());

  window.addEventListener("resize", () => {
    requestAnimationFrame(() => updateNavIndicator());
  });

  requestAnimationFrame(() => updateNavIndicator());

  // Snap targets: sections + projects + footer
  const snapTargets = [...sections, ...projectsSection ? [projectsSection] : [], footer];

  // Fade-in for sections + projects
  const fadeObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  [...sections, ...projectsSection ? [projectsSection] : []].forEach(el => fadeObserver.observe(el));

  let currentIndex = 0;

  const scrollToTarget = (index) => {
    if (index >= 0 && index < snapTargets.length) {
      snapTargets[index].scrollIntoView({ behavior: "smooth" });
      currentIndex = index;
    }
  };

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("modal-open")) return;
    if (e.target.closest("input, textarea, select, button, .portfolio-chat")) return;

    if (e.key === "ArrowDown" || e.key === "PageDown") {
      if (currentIndex < snapTargets.length - 1) {
        e.preventDefault();
        scrollToTarget(currentIndex + 1);
      }
    }
    if (e.key === "ArrowUp" || e.key === "PageUp") {
      if (currentIndex > 0) {
        e.preventDefault();
        scrollToTarget(currentIndex - 1);
      }
    }
  });

  // Active index tracking for sections & projects
  const activeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = snapTargets.indexOf(entry.target);
        if (idx !== -1) {
          currentIndex = idx;
          setActiveNav(getCurrentSectionId() || entry.target.id);
        }
      }
    });
  }, { threshold: 0.6 });
  [...sections, ...projectsSection ? [projectsSection] : []].forEach(el => activeObserver.observe(el));

  let navScrollTicking = false;
  window.addEventListener("scroll", () => {
    if (navScrollTicking) return;

    navScrollTicking = true;
    requestAnimationFrame(() => {
      setActiveNav(getCurrentSectionId());
      navScrollTicking = false;
    });
  }, { passive: true });

  // Separate observer for footer
  if (footer) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          currentIndex = snapTargets.indexOf(footer);
        }
      });
    }, { threshold: 0.2 });
    footerObserver.observe(footer);
  }

  // Opening intro + typewriter effect
  const intro = document.getElementById("siteIntro");
  const text = "Hi, I'm Ng Yu Hang (Mervin)";
  const target = document.getElementById("typewriter");
  let typewriterStarted = false;

  const startTypewriter = () => {
    if (!target || typewriterStarted) return;

    typewriterStarted = true;
    target.textContent = "";
    let i = 0;

    const type = () => {
      if (i < text.length) {
        target.textContent += text.charAt(i);
        i++;
        setTimeout(type, 90);
      }
    };

    type();
  };

  const finishIntro = (() => {
    let isFinishing = false;
    const introFadeOutDuration = 1850;

    return () => {
      if (isFinishing) return;
      isFinishing = true;

      if (!intro) {
        startTypewriter();
        return;
      }

      intro.classList.add("is-hiding");
      document.documentElement.classList.remove("intro-active");
      document.body.classList.remove("intro-active");
      startTypewriter();

      setTimeout(() => {
        intro.hidden = true;
      }, introFadeOutDuration);
    };
  })();

  if (intro) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isIndexPath = !/\.[a-z0-9]+$/i.test(window.location.pathname) || /\/index\.html$/i.test(window.location.pathname);
    const shouldPlayIntro = isIndexPath && !window.location.hash;

    if (!shouldPlayIntro) {
      intro.hidden = true;
      document.documentElement.classList.remove("intro-active");
      document.body.classList.remove("intro-active");
      startTypewriter();
    } else {
      const introDuration = prefersReducedMotion ? 1100 : 8400;
      let introTimer = null;

      const cleanupIntroSkip = () => {
        intro.removeEventListener("click", skipIntro);
        document.removeEventListener("keydown", skipIntroWithKeyboard);
      };

      const skipIntro = () => {
        clearTimeout(introTimer);
        cleanupIntroSkip();
        finishIntro();
      };

      const skipIntroWithKeyboard = (event) => {
        if (!["Enter", " ", "Escape"].includes(event.key)) return;
        skipIntro();
      };

      intro.hidden = false;
      document.documentElement.classList.add("intro-active");
      document.body.classList.add("intro-active");

      requestAnimationFrame(() => intro.classList.add("is-playing"));
      introTimer = setTimeout(() => {
        cleanupIntroSkip();
        finishIntro();
      }, introDuration);

      intro.addEventListener("click", skipIntro);
      document.addEventListener("keydown", skipIntroWithKeyboard);
    }
  } else {
    startTypewriter();
  }

  // Certificate preview modal
  const certModal = document.getElementById("certModal");
  const certModalImage = document.getElementById("certModalImage");
  const certModalFrame = document.getElementById("certModalFrame");
  const certModalLabel = document.getElementById("certModalLabel");

  if (certModal && certModalImage && certModalLabel) {
    const certCloseButton = certModal.querySelector("[data-bs-dismiss='modal']");
    let lastFocusedElement = null;

    const clearCertModal = () => {
      certModalImage.removeAttribute("src");
      certModalImage.alt = "";
      certModalImage.hidden = false;

      if (certModalFrame) {
        certModalFrame.removeAttribute("src");
        certModalFrame.hidden = true;
      }
    };

    const openCertModal = () => {
      lastFocusedElement = document.activeElement;
      certModal.classList.add("show");
      certModal.style.display = "block";
      certModal.removeAttribute("aria-hidden");
      certModal.setAttribute("aria-modal", "true");
      certModal.setAttribute("role", "dialog");
      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";

      if (!document.querySelector(".cert-modal-backdrop")) {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop fade show cert-modal-backdrop";
        document.body.appendChild(backdrop);
      }

      certCloseButton?.focus();
    };

    const closeCertModal = () => {
      certModal.classList.remove("show");
      certModal.style.display = "none";
      certModal.setAttribute("aria-hidden", "true");
      certModal.removeAttribute("aria-modal");
      certModal.removeAttribute("role");
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
      document.querySelectorAll(".cert-modal-backdrop").forEach(backdrop => backdrop.remove());
      clearCertModal();

      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
      }
    };

    document.querySelectorAll(".cert-card").forEach(card => {
      card.addEventListener("click", (event) => {
        event.preventDefault();

        const certTitle = card.querySelector("strong")?.textContent?.trim() || "Certificate";
        const certSrc = card.getAttribute("href");
        if (!certSrc) return;

        certModalLabel.textContent = certTitle;

        if (/\.pdf(?:$|[?#])/i.test(certSrc) && certModalFrame) {
          certModalImage.hidden = true;
          certModalFrame.hidden = false;
          certModalFrame.src = certSrc;
        } else {
          certModalImage.hidden = false;
          certModalImage.src = certSrc;
          certModalImage.alt = `${certTitle} certificate`;
        }

        openCertModal();
      });
    });

    certModal.addEventListener("click", (event) => {
      if (event.target === certModal) {
        closeCertModal();
      }
    });

    certCloseButton?.addEventListener("click", closeCertModal);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && certModal.classList.contains("show")) {
        closeCertModal();
      }
    });
  }

  // Portfolio chat
  const chatRoot = document.getElementById("portfolioChat");
  const chatToggle = document.getElementById("chatToggle");
  const chatClose = document.getElementById("chatClose");
  const chatPanel = document.getElementById("chatPanel");
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatStatus = document.getElementById("chatStatus");

  if (chatRoot && chatToggle && chatClose && chatPanel && chatMessages && chatForm && chatInput && chatStatus) {
    const conversation = [];
    let isSending = false;
    const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000";
    const chatApiUrl = window.CHAT_API_URL || (window.location.protocol === "file:" || isLocalPreview
      ? "http://localhost:3000/api/chat"
      : "/api/chat");

    chatMessages.querySelectorAll(".chat-message").forEach(message => {
      message.textContent = message.textContent.trim();
    });

    const setChatOpen = (isOpen) => {
      chatRoot.classList.toggle("is-open", isOpen);
      chatToggle.setAttribute("aria-expanded", String(isOpen));
      chatPanel.setAttribute("aria-hidden", String(!isOpen));
      if (isOpen) {
        setTimeout(() => chatInput.focus(), 120);
      } else {
        chatToggle.focus();
      }
    };

    const scrollChatToBottom = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const addMessage = (role, content, extraClass = "") => {
      const row = document.createElement("div");
      row.className = `chat-row chat-row-${role}`;

      const message = document.createElement("article");
      message.className = `chat-message chat-message-${role} ${extraClass}`.trim();
      message.textContent = content;

      if (role === "assistant") {
        const avatar = document.createElement("img");
        avatar.className = "chat-message-avatar";
        avatar.src = "img/myself.png";
        avatar.alt = "";
        avatar.setAttribute("aria-hidden", "true");
        row.appendChild(avatar);
      }

      row.appendChild(message);
      chatMessages.appendChild(row);
      scrollChatToBottom();
      return message;
    };

    const removeMessageRow = (message) => {
      const row = message.closest(".chat-row");
      if (row) {
        row.remove();
      } else {
        message.remove();
      }
    };

    const autosizeInput = () => {
      chatInput.style.height = "auto";
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 118)}px`;
    };

    chatToggle.addEventListener("click", () => {
      setChatOpen(!chatRoot.classList.contains("is-open"));
    });

    chatClose.addEventListener("click", () => setChatOpen(false));

    chatInput.addEventListener("input", autosizeInput);

    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && chatRoot.classList.contains("is-open")) {
        setChatOpen(false);
      }
    });

    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = chatInput.value.trim();
      if (!text || isSending) return;

      isSending = true;
      chatStatus.textContent = "";
      chatInput.value = "";
      autosizeInput();
      chatInput.disabled = true;
      chatForm.querySelector("button").disabled = true;

      conversation.push({ role: "user", content: text });
      addMessage("user", text);
      const thinkingMessage = addMessage("assistant", "Thinking...", "is-thinking");

      try {
        const response = await fetch(chatApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: conversation.slice(-10) })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.reply) {
          throw new Error(data.error || "Chat is unavailable right now.");
        }

        thinkingMessage.classList.remove("is-thinking");
        thinkingMessage.textContent = data.reply;
        conversation.push({ role: "assistant", content: data.reply });
      } catch (error) {
        removeMessageRow(thinkingMessage);
        chatStatus.textContent = error.message === "Failed to fetch"
          ? "Chat server is not reachable. Open this from http://localhost:3000/ or run npm start."
          : error.message || "Chat is unavailable right now.";
      } finally {
        isSending = false;
        chatInput.disabled = false;
        chatForm.querySelector("button").disabled = false;
        chatInput.focus();
        scrollChatToBottom();
      }
    });
  }
});
