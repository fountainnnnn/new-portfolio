document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector(".chatbot-widget");
  if (!widget) {
    return;
  }

  const isEnabled = widget.dataset.chatbot === "enabled";

  const panel = widget.querySelector(".chatbot-panel");
  const toggleButton = widget.querySelector(".chatbot-toggle");
  const closeButton = widget.querySelector(".chatbot-close");
  const form = widget.querySelector(".chatbot-form");
  const input = widget.querySelector(".chatbot-input");
  const sendButton = widget.querySelector(".chatbot-send");
  const spinner = sendButton?.querySelector(".spinner-border");
  const sendLabel = sendButton?.querySelector(".send-label");
  const messagesContainer = widget.querySelector(".chatbot-messages");
  let typingBubble = null;

  const ensurePanelOpen = () => {
    panel?.classList.add("open");
    toggleButton?.setAttribute("aria-expanded", "true");
    input?.focus();
  };

  toggleButton?.addEventListener("click", () => {
    panel?.classList.toggle("open");
    const isOpen = panel?.classList.contains("open");
    toggleButton?.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });

  closeButton?.addEventListener("click", () => {
    panel?.classList.remove("open");
    toggleButton?.setAttribute("aria-expanded", "false");
  });

  const escapeHtml = (unsafe) =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatInlineMarkdown = (text) => {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.+?)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/`([^`]+?)`/g, "<code>$1</code>");
    return escaped;
  };

  const renderMarkdown = (markdown) => {
    const lines = markdown.replace(/\r/g, "").split("\n");
    let html = "";
    let listType = null;
    let paragraphBuffer = [];

    const closeList = () => {
      if (listType) {
        html += listType === "ul" ? "</ul>" : "</ol>";
        listType = null;
      }
    };

    const flushParagraph = () => {
      if (paragraphBuffer.length) {
        html += `<p>${formatInlineMarkdown(paragraphBuffer.join(" "))}</p>`;
        paragraphBuffer = [];
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        closeList();
        const level = headingMatch[1].length;
        const content = formatInlineMarkdown(headingMatch[2]);
        html += `<h${level}>${content}</h${level}>`;
        continue;
      }

      const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);
      if (unorderedMatch) {
        flushParagraph();
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          html += "<ul>";
        }
        html += `<li>${formatInlineMarkdown(unorderedMatch[1])}</li>`;
        continue;
      }

      const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
      if (orderedMatch) {
        flushParagraph();
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          html += "<ol>";
        }
        html += `<li>${formatInlineMarkdown(orderedMatch[1])}</li>`;
        continue;
      }

      paragraphBuffer.push(line);
    }

    flushParagraph();
    closeList();
    if (!html.trim()) {
      return `<p>${formatInlineMarkdown(markdown)}</p>`;
    }
    return html;
  };

  const appendMessage = (text, type = "bot", options = {}) => {
    if (!messagesContainer) return;
    const bubble = document.createElement("div");
    bubble.className = `chatbot-message chatbot-message--${type}`;
    const trimmed = text.trim();
    if (options.markdown) {
      bubble.innerHTML = renderMarkdown(trimmed);
    } else {
      bubble.textContent = trimmed;
    }
    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return bubble;
  };

  const showTypingIndicator = () => {
    if (!messagesContainer || typingBubble) return;
    typingBubble = document.createElement("div");
    typingBubble.className = "chatbot-message chatbot-message--bot chatbot-message--typing";
    typingBubble.innerHTML = `
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    `;
    messagesContainer.appendChild(typingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const hideTypingIndicator = () => {
    if (typingBubble) {
      typingBubble.remove();
      typingBubble = null;
    }
  };

  const gatherPageContext = () => {
    const main = document.querySelector("main");
    if (!main) return "";
    return main.innerText.replace(/\s+/g, " ").trim().slice(0, 2000);
  };

  const setLoading = (isLoading) => {
    if (!sendButton || !spinner || !sendLabel) return;
    sendButton.disabled = isLoading;
    spinner.classList.toggle("d-none", !isLoading);
    sendLabel.classList.toggle("d-none", isLoading);
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!input) return;

    const message = input.value.trim();
    if (!message) {
      input.focus();
      return;
    }

    appendMessage(message, "user");
    input.value = "";
    if (!isEnabled) {
      appendMessage("Chatbot is offline until an API key is configured.", "bot");
      return;
    }

    setLoading(true);
    ensurePanelOpen();
    showTypingIndicator();

    try {
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/chatbot/message") : "/chatbot/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          page_context: gatherPageContext(),
        }),
      });

      const payload = await response.json();
      if (payload?.reply) {
        hideTypingIndicator();
        appendMessage(payload.reply, "bot", { markdown: true });
      } else {
        const suffix = payload?.code ? ` (${payload.code})` : "";
        throw new Error(`${payload?.error || "Sorry, I could not reply right now."}${suffix}`);
      }
    } catch (error) {
      hideTypingIndicator();
      appendMessage(String(error), "bot");
    } finally {
      hideTypingIndicator();
      setLoading(false);
    }
  });
});
