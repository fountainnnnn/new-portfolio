function setupChat() {
  const shellEl = document.querySelector(".chat-shell");
  const isAuthed = (shellEl && shellEl.getAttribute("data-chat-auth") === "1") || false;
  const userId = String((shellEl && shellEl.getAttribute("data-chat-user-id")) || "").trim();
  const chatScope = isAuthed ? `user:${userId || "unknown"}` : "guest";
  const scopedKey = (base) => `${base}::${chatScope}`;

  const messagesEl = document.getElementById("chatMessages");
  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const resetBtn = document.getElementById("chatResetBtn");
  const statusEl = document.getElementById("chatStatusText");
  const csrfEl = document.getElementById("chatCsrf");
  const attachBtn = document.getElementById("chatAttachBtn");
  const imageInputEl = document.getElementById("chatImageInput");
  const attachmentPreviewEl = document.getElementById("chatAttachmentPreview");
  const attachmentThumbEl = document.getElementById("chatAttachmentThumb");
  const attachmentNameEl = document.getElementById("chatAttachmentName");
  const attachmentRemoveBtn = document.getElementById("chatAttachmentRemove");
  const chips = Array.from(document.querySelectorAll("[data-chat-chip]"));

  const threadsEl = document.getElementById("chatThreads");
  const newThreadBtn = document.getElementById("chatNewThreadBtn");

  if (!messagesEl || !inputEl || !sendBtn) return;

  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LEGACY_KEY = scopedKey("veggieai_chat_history_v1");
  const THREADS_KEY = scopedKey("veggieai_chat_threads_v1");
  const ACTIVE_KEY_LOCAL = scopedKey("veggieai_chat_active_thread_v1");
  const ACTIVE_KEY_DB = scopedKey("veggieai_chat_active_thread_db_v1");

  // One-time cleanup for old browser-global keys from pre-scoped chat storage.
  try {
    localStorage.removeItem("veggieai_chat_history_v1");
    localStorage.removeItem("veggieai_chat_threads_v1");
    localStorage.removeItem("veggieai_chat_active_thread_v1");
    localStorage.removeItem("veggieai_chat_active_thread_db_v1");
  } catch {
    // ignore
  }

  // Signed-out chats should not inherit prior signed-in sessions.
  if (!isAuthed) {
    try {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(THREADS_KEY);
      localStorage.removeItem(ACTIVE_KEY_LOCAL);
      localStorage.removeItem(ACTIVE_KEY_DB);
    } catch {
      // ignore
    }
  }

  const MAX_THREAD_MESSAGES = 160;
  const MAX_API_HISTORY = 24;

  let pendingTypingId = null;
  let pendingImageFile = null;
  let pendingImagePreviewUrl = "";

  let currentSendAction = () => setStatus("Loading...");
  let currentNewThreadAction = () => setStatus("Loading...");

  function setChatActions(sendFn, newThreadFn) {
    if (typeof sendFn === "function") currentSendAction = sendFn;
    if (typeof newThreadFn === "function") currentNewThreadAction = newThreadFn;
  }

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const escapeAttr = (value) => escapeHtml(value).replace(/`/g, "&#096;");

  function sanitizeUrl(href) {
    const raw = String(href || "").trim();
    if (!raw) return "#";
    if (raw.startsWith("/") || raw.startsWith("#")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return "#";
  }

  function formatInlineMarkdown(escapedText) {
    let out = String(escapedText || "");

    // Inline code: `...`
    out = out.replace(/`([^`\n]+)`/g, (_m, code) => `<code class="chat-inline-code">${code}</code>`);

    // Links: [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const safeHref = sanitizeUrl(href);
      const rel = safeHref.startsWith("http") ? ' rel="noopener noreferrer"' : "";
      const target = safeHref.startsWith("http") ? ' target="_blank"' : "";
      return `<a class="chat-md-link" href="${escapeAttr(safeHref)}"${target}${rel}>${label}</a>`;
    });

    // Bold: **...**
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic: *...* (avoid **)
    out = out.replace(/\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");

    return out;
  }

  function renderMarkdownToHtml(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = raw.split("\n");
    const parts = [];

    let inCode = false;
    let codeLines = [];
    let listMode = null; // 'ul' | 'ol' | null

    const closeList = () => {
      if (!listMode) return;
      parts.push(`</${listMode}>`);
      listMode = null;
    };

    const openList = (mode) => {
      if (listMode === mode) return;
      closeList();
      listMode = mode;
      parts.push(`<${mode} class="chat-md-list">`);
    };

    for (const lineRaw of lines) {
      const fence = lineRaw.match(/^```/);
      if (fence) {
        if (!inCode) {
          closeList();
          inCode = true;
          codeLines = [];
        } else {
          const codeEscaped = escapeHtml(codeLines.join("\n"));
          parts.push(`<pre class="chat-code-block"><code>${codeEscaped}</code></pre>`);
          inCode = false;
          codeLines = [];
        }
        continue;
      }

      if (inCode) {
        codeLines.push(lineRaw);
        continue;
      }

      const line = String(lineRaw || "");
      if (!line.trim()) {
        closeList();
        parts.push('<div class="chat-md-gap"></div>');
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        const content = formatInlineMarkdown(escapeHtml(heading[2] || ""));
        const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
        parts.push(`<${tag} class="chat-md-heading">${content}</${tag}>`);
        continue;
      }

      const bullet = line.match(/^\s*-\s+(.*)$/);
      if (bullet) {
        openList("ul");
        const content = formatInlineMarkdown(escapeHtml(bullet[1] || ""));
        parts.push(`<li>${content}</li>`);
        continue;
      }

      const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (ordered) {
        openList("ol");
        const content = formatInlineMarkdown(escapeHtml(ordered[2] || ""));
        parts.push(`<li>${content}</li>`);
        continue;
      }

      closeList();
      const content = formatInlineMarkdown(escapeHtml(line));
      parts.push(`<p class="chat-md-p">${content}</p>`);
    }

    if (inCode) {
      const codeEscaped = escapeHtml(codeLines.join("\n"));
      parts.push(`<pre class="chat-code-block"><code>${codeEscaped}</code></pre>`);
    }
    closeList();

    return parts.join("");
  }

  function renderPlainTextToHtml(text) {
    const escaped = escapeHtml(String(text || ""));
    return `<p class="chat-md-p">${escaped.replace(/\n/g, "<br>")}</p>`;
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function clearAttachment({ revokePreviewUrl = true } = {}) {
    if (revokePreviewUrl && pendingImagePreviewUrl) {
      try {
        URL.revokeObjectURL(pendingImagePreviewUrl);
      } catch {
        // ignore
      }
    }
    pendingImageFile = null;
    pendingImagePreviewUrl = "";
    if (imageInputEl) imageInputEl.value = "";
    if (attachmentPreviewEl) attachmentPreviewEl.hidden = true;
    if (attachmentThumbEl) attachmentThumbEl.removeAttribute("src");
    if (attachmentNameEl) attachmentNameEl.textContent = "";
  }

  function setAttachment(file) {
    if (!file) return;
    if (!file.type || !String(file.type).startsWith("image/")) {
      addMessage("assistant", "That file doesn't look like an image. Please upload a JPG, PNG, or WebP.");
      return;
    }
    const maxBytes = 12 * 1024 * 1024;
    if (Number.isFinite(file.size) && file.size > maxBytes) {
      addMessage("assistant", "That image is too large. Please upload an image under 12MB.");
      return;
    }

    clearAttachment({ revokePreviewUrl: true });
    pendingImageFile = file;
    try {
      pendingImagePreviewUrl = URL.createObjectURL(file);
    } catch {
      pendingImagePreviewUrl = "";
    }

    if (attachmentPreviewEl) attachmentPreviewEl.hidden = false;
    if (attachmentThumbEl && pendingImagePreviewUrl) attachmentThumbEl.src = pendingImagePreviewUrl;
    if (attachmentNameEl) attachmentNameEl.textContent = file.name || "selected-image";
  }

  function consumeAttachment() {
    const file = pendingImageFile;
    const previewUrl = pendingImagePreviewUrl;
    pendingImageFile = null;
    pendingImagePreviewUrl = "";
    if (imageInputEl) imageInputEl.value = "";
    if (attachmentPreviewEl) attachmentPreviewEl.hidden = true;
    if (attachmentThumbEl) attachmentThumbEl.removeAttribute("src");
    if (attachmentNameEl) attachmentNameEl.textContent = "";
    return { file, previewUrl };
  }

  function scheduleRevokePreviewUrl(url) {
    if (!url) return;
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 60000);
  }

  function newId(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  function safeString(value) {
    return String(value || "").trim();
  }

  function greetingText() {
    return "Hi! I'm VeggieAI. Ask me anything about veggies, recipes, or how to use the app.";
  }

  function stripChatImageTokensForLlm(content) {
    const raw = String(content || "");
    if (!raw.includes("[[image_")) return raw;
    return raw
      .replace(/\[\[image_prediction:\d+\]\]/g, "[User uploaded an image for prediction]")
      .replace(/\[\[image_data:[^;\]]+;[A-Za-z0-9+/=]+\]\]/g, "[User uploaded an image for prediction]")
      .trim();
  }

  function stripChatImageTokensForTitle(content) {
    const raw = stripChatImageTokensForLlm(content);
    const cleaned = raw.replace(/\[User uploaded an image for prediction\]/g, "").trim();
    return cleaned;
  }

  function parseImageToken(content) {
    const raw = String(content || "");
    const matchData = raw.match(/\[\[image_data:([^;\]]+);([A-Za-z0-9+/=]+)\]\]/);
    if (matchData) {
      const mimeRaw = String(matchData[1] || "").trim().toLowerCase();
      const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
      const mime = allowed.has(mimeRaw) ? mimeRaw : "image/png";
      const b64 = String(matchData[2] || "").trim();
      const remaining = raw.replace(matchData[0], "").replace(/^\s+/, "");
      const imageUrl = b64 ? `data:${mime};base64,${b64}` : null;
      return { text: remaining, imageUrl };
    }
    const match = raw.match(/\[\[image_prediction:(\d+)\]\]/);
    if (!match) return { text: raw, imageUrl: null };
    const id = match[1];
    const remaining = raw.replace(match[0], "").replace(/^\s+/, "");
    const imagePath = `/api/predictions/${encodeURIComponent(id)}/image`;
    return { text: remaining, imageUrl: window.withAppBasePath ? window.withAppBasePath(imagePath) : imagePath };
  }

  function renderBubble(bubble, { role, text, imageUrl, typing }) {
    if (typing) {
      bubble.classList.add("is-typing");
      bubble.innerHTML =
        '<span class="chat-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></span>';
      return;
    }

    bubble.classList.remove("is-typing");
    bubble.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "chat-bubble-content";

    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "chat-bubble-image";
      img.alt = "Uploaded image";
      img.src = imageUrl;
      img.loading = "lazy";
      wrap.appendChild(img);
    }

    const trimmed = String(text || "").trim();
    if (trimmed) {
      const textEl = document.createElement("div");
      textEl.className = "chat-bubble-text";
      textEl.innerHTML = role === "assistant" ? renderMarkdownToHtml(trimmed) : renderPlainTextToHtml(trimmed);
      wrap.appendChild(textEl);
    }

    bubble.appendChild(wrap);
  }

  function addMessage(role, content, { typing = false, imageUrl = "" } = {}) {
    const id = newId("m");
    const wrap = document.createElement("div");
    wrap.className = `chat-row ${role === "user" ? "is-user" : "is-assistant"}`;
    wrap.dataset.msgId = id;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role === "user" ? "chat-bubble--user" : "chat-bubble--assistant"}${
      typing ? " is-typing" : ""
    }`;

    if (!typing) {
      const parsed = parseImageToken(content);
      const resolvedImageUrl = imageUrl || parsed.imageUrl || "";
      renderBubble(bubble, { role, text: parsed.text, imageUrl: resolvedImageUrl, typing: false });
    } else {
      renderBubble(bubble, { role, text: "", imageUrl: "", typing: true });
    }

    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    if (!prefersReduced) wrap.classList.add("is-entering");
    window.setTimeout(() => wrap.classList.remove("is-entering"), 320);
    scrollToBottom();
    return id;
  }

  function updateMessage(id, content) {
    const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
    if (!row) return;
    const bubble = row.querySelector(".chat-bubble");
    if (!bubble) return;
    const role = bubble.classList.contains("chat-bubble--user") ? "user" : "assistant";
    renderBubble(bubble, { role, text: content, imageUrl: "", typing: false });
    scrollToBottom();
  }

  function renderThreadList(items, activeId) {
    if (!threadsEl) return;
    threadsEl.innerHTML = "";

    for (const t of items) {
      const title = safeString(t.title) || "New chat";
      const meta = safeString(t.meta) || "";
      const row = document.createElement("div");
      const threadId = String(t.id);
      const isActive = threadId === String(activeId);
      row.className = `chat-thread${isActive ? " is-active" : ""}`;
      row.setAttribute("role", "listitem");
      row.innerHTML = `
        <button type="button" class="chat-thread-main" data-thread-id="${escapeAttr(threadId)}"${
          isActive ? ' aria-current="true"' : ""
        }>
          <p class="chat-thread-title">${escapeHtml(title)}</p>
          <p class="chat-thread-meta">${escapeHtml(meta)}</p>
        </button>
        <button type="button" class="btn btn-ghost btn-sm chat-thread-delete" data-thread-delete="${escapeAttr(
          threadId
        )}" aria-label="Delete chat thread" title="Delete chat">
          <i class="bi bi-trash3"></i>
        </button>
      `;
      threadsEl.appendChild(row);
    }
  }

  function attachCommonUIHandlers() {
    if (sendBtn.dataset.chatBound === "1") return;
    sendBtn.dataset.chatBound = "1";

    sendBtn.addEventListener("click", () => currentSendAction());

    inputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) return;
      event.preventDefault();
      currentSendAction();
    });

    if (resetBtn) resetBtn.addEventListener("click", () => currentNewThreadAction(true));
    if (newThreadBtn) newThreadBtn.addEventListener("click", () => currentNewThreadAction(true));

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const prompt = chip.getAttribute("data-chat-chip") || "";
        inputEl.value = prompt;
        inputEl.focus();
      });
    });
  }

  function getCsrfToken() {
    return csrfEl ? String(csrfEl.value || "") : "";
  }

  function initAttachmentHandlers() {
    if (attachBtn && imageInputEl) {
      attachBtn.addEventListener("click", () => imageInputEl.click());
    }

    if (imageInputEl) {
      imageInputEl.addEventListener("change", () => {
        const file = imageInputEl.files && imageInputEl.files[0];
        if (file) setAttachment(file);
      });
    }

    if (attachmentRemoveBtn) {
      attachmentRemoveBtn.addEventListener("click", () => clearAttachment({ revokePreviewUrl: true }));
    }

    const panelEl = document.querySelector(".chat-panel");
    const dropTargets = [panelEl, messagesEl, inputEl].filter(Boolean);
    dropTargets.forEach((target) => {
      target.addEventListener("dragover", (event) => {
        if (!event.dataTransfer) return;
        if (!Array.from(event.dataTransfer.items || []).some((i) => i.kind === "file")) return;
        event.preventDefault();
        if (panelEl) panelEl.classList.add("is-drop-target");
      });

      target.addEventListener("dragleave", () => {
        if (panelEl) panelEl.classList.remove("is-drop-target");
      });

      target.addEventListener("drop", (event) => {
        if (panelEl) panelEl.classList.remove("is-drop-target");
        if (!event.dataTransfer) return;
        const file = event.dataTransfer.files && event.dataTransfer.files[0];
        if (!file) return;
        event.preventDefault();
        setAttachment(file);
        inputEl.focus();
      });
    });

    inputEl.addEventListener("paste", (event) => {
      const files = event.clipboardData && event.clipboardData.files ? Array.from(event.clipboardData.files) : [];
      const imageFile = files.find((f) => String(f.type || "").startsWith("image/"));
      if (!imageFile) return;
      event.preventDefault();
      setAttachment(imageFile);
    });
  }

  function formatIso(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function localMode() {
    let threads = [];
    let activeThreadId = null;

    function normalizeMessage(item) {
      if (!item || typeof item !== "object") return null;
      const role = item.role;
      if (role !== "user" && role !== "assistant") return null;
      const content = safeString(item.content);
      if (!content) return null;
      const ts = Number.isFinite(Number(item.ts)) ? Number(item.ts) : Date.now();
      const keepFull = content.includes("[[image_data:") || content.includes("[[image_prediction:");
      return { role, content: keepFull ? content : content.slice(0, 6000), ts };
    }

    function clampMessages(list) {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const item of list) {
        const normalized = normalizeMessage(item);
        if (!normalized) continue;
        out.push(normalized);
      }
      return out.slice(-MAX_THREAD_MESSAGES);
    }

    function computeTitle(thread) {
      const firstUser = (thread.messages || []).find((m) => m.role === "user" && (m.content || "").trim());
      if (firstUser) {
        const cleaned = stripChatImageTokensForTitle(firstUser.content);
        if (cleaned) return cleaned.slice(0, 60);
        return "Image";
      }
      return "New chat";
    }

    function normalizeThread(item) {
      if (!item || typeof item !== "object") return null;
      const id = safeString(item.id);
      if (!id) return null;
      const created_at = Number.isFinite(Number(item.created_at)) ? Number(item.created_at) : Date.now();
      const updated_at = Number.isFinite(Number(item.updated_at)) ? Number(item.updated_at) : created_at;
      const messages = clampMessages(item.messages || []);
      const title = safeString(item.title) || computeTitle({ messages });
      return { id, title, created_at, updated_at, messages };
    }

    function loadThreads() {
      try {
        const raw = localStorage.getItem(THREADS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.map(normalizeThread).filter(Boolean);
        }
      } catch {
        // ignore
      }

      try {
        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed)) {
            const messages = clampMessages(parsed);
            const t = { id: newId("t"), title: computeTitle({ messages }), created_at: Date.now(), updated_at: Date.now(), messages };
            localStorage.removeItem(LEGACY_KEY);
            return [t];
          }
        }
      } catch {
        // ignore
      }
      return [];
    }

    function saveThreads() {
      try {
        localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
      } catch {
        // ignore
      }
    }

    function loadActiveId() {
      try {
        const raw = localStorage.getItem(ACTIVE_KEY_LOCAL);
        return raw ? String(raw) : null;
      } catch {
        return null;
      }
    }

    function saveActiveId(id) {
      try {
        localStorage.setItem(ACTIVE_KEY_LOCAL, id);
      } catch {
        // ignore
      }
    }

    function getThreadById(id) {
      return threads.find((t) => t.id === id) || null;
    }

    function sortThreads(list) {
      return [...list].sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
    }

    function ensureGreeting(thread) {
      if (thread.messages && thread.messages.length) return;
      thread.messages = [{ role: "assistant", content: greetingText(), ts: Date.now() }];
      thread.title = computeTitle(thread);
      thread.created_at = thread.created_at || Date.now();
      thread.updated_at = Date.now();
    }

    function ensureActiveThread() {
      if (!threads.length) {
        const t = { id: newId("t"), title: "New chat", created_at: Date.now(), updated_at: Date.now(), messages: [] };
        ensureGreeting(t);
        threads = [t];
        activeThreadId = t.id;
        saveThreads();
        saveActiveId(activeThreadId);
        return;
      }
      const stored = loadActiveId();
      if (stored && getThreadById(stored)) {
        activeThreadId = stored;
        return;
      }
      activeThreadId = sortThreads(threads)[0].id;
      saveActiveId(activeThreadId);
    }

    function renderActiveThread() {
      const thread = getThreadById(activeThreadId);
      if (!thread) return;
      ensureGreeting(thread);
      messagesEl.innerHTML = "";
      for (const msg of thread.messages || []) addMessage(msg.role, msg.content);
      scrollToBottom();
    }

    function renderThreads() {
      const sorted = sortThreads(threads);
      renderThreadList(
        sorted.map((t) => ({
          id: t.id,
          title: t.title,
          meta: `${(t.messages || []).length} messages - ${new Date(t.updated_at || Date.now()).toLocaleString(undefined, {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        })),
        activeThreadId
      );
    }

    function deleteThreadLocal(id, focus) {
      const targetId = String(id || "");
      if (!targetId) return;
      if (!getThreadById(targetId)) return;

      threads = threads.filter((t) => String(t.id) !== targetId);
      saveThreads();

      if (activeThreadId === targetId) {
        if (threads.length) {
          const next = sortThreads(threads)[0];
          if (next) {
            setActive(String(next.id), focus);
            return;
          }
        }
        createNewThread(focus);
        return;
      }

      renderThreads();
      setStatus("Ready");
      if (focus) inputEl.focus();
    }

    function setActive(id, focus) {
      if (!getThreadById(id)) return;
      activeThreadId = id;
      saveActiveId(id);
      renderThreads();
      renderActiveThread();
      setStatus("Ready");
      if (focus) inputEl.focus();
    }

    function createNewThread(focus) {
      const t = { id: newId("t"), title: "New chat", created_at: Date.now(), updated_at: Date.now(), messages: [] };
      ensureGreeting(t);
      threads.unshift(t);
      saveThreads();
      setActive(t.id, focus);
    }

    async function sendMessageLocal() {
      const text = safeString(inputEl.value);
      const hasAttachment = Boolean(pendingImageFile);
      if (!text && !hasAttachment) return;
      const thread = getThreadById(activeThreadId);
      if (!thread) return;

      const attachment = hasAttachment ? consumeAttachment() : { file: null, previewUrl: "" };
      inputEl.value = "";
      sendBtn.disabled = true;
      inputEl.disabled = true;

      addMessage("user", text, { imageUrl: attachment.previewUrl });
      scheduleRevokePreviewUrl(attachment.previewUrl);

      let storedUserText = text || "";
      if (attachment.file) {
        try {
          const token = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(attachment.file);
          });
          let mime = String(attachment.file.type || "image/png").trim().toLowerCase();
          if (mime === "image/jpg") mime = "image/jpeg";
          const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
          const base64 = String(token || "").split(",")[1] || "";
          if (base64) {
            const safeMime = allowed.has(mime) ? mime : "image/png";
            const imageToken = `[[image_data:${safeMime};${base64}]]`;
            storedUserText = imageToken + (text ? `\n${text}` : "");
          } else if (!storedUserText) {
            storedUserText = "Uploaded an image for prediction.";
          }
        } catch {
          storedUserText = storedUserText || "Uploaded an image for prediction.";
        }
      }
      storedUserText = storedUserText || (attachment.file ? "Uploaded an image for prediction." : "");
      thread.messages.push({ role: "user", content: storedUserText, ts: Date.now() });
      thread.messages = clampMessages(thread.messages);
      thread.updated_at = Date.now();
      if (!thread.title || thread.title === "New chat") thread.title = computeTitle(thread);
      saveThreads();
      renderThreads();

      setStatus("Thinking...");
      pendingTypingId = addMessage("assistant", "", { typing: true });

      const token = getCsrfToken();
      const historyForApi = thread.messages
        .slice(0, -1)
        .slice(-MAX_API_HISTORY)
        .map((m) => ({ role: m.role, content: stripChatImageTokensForLlm(m.content) }))
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content);

      try {
        const headers = {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
        };

        let response;
        if (attachment.file) {
          const form = new FormData();
          if (text) form.append("message", text);
          form.append("history", JSON.stringify(historyForApi));
          try {
            form.append("image", attachment.file, attachment.file.name || "upload");
          } catch {
            form.append("image", attachment.file);
          }
          response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat") : "/api/chat", { method: "POST", headers, body: form });
        } else {
          response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat") : "/api/chat", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, history: historyForApi }),
          });
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data || !data.ok) {
          const msg = (data && data.message) || "Unable to reach the assistant right now.";
          if (pendingTypingId) updateMessage(pendingTypingId, msg);
          setStatus("Error");
          return;
        }

        const reply = safeString(data.reply) || "...";
        if (pendingTypingId) updateMessage(pendingTypingId, reply);
        thread.messages.push({ role: "assistant", content: reply, ts: Date.now() });
        thread.messages = clampMessages(thread.messages);
        thread.updated_at = Date.now();
        saveThreads();
        renderThreads();
        setStatus("Ready");
      } catch {
        if (pendingTypingId) updateMessage(pendingTypingId, "Network error. Please try again.");
        setStatus("Error");
      } finally {
        pendingTypingId = null;
        sendBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
      }
    }

    if (threadsEl) {
      threadsEl.addEventListener("click", (event) => {
        const deleteBtn = event.target.closest("[data-thread-delete]");
        if (deleteBtn) {
          deleteThreadLocal(deleteBtn.getAttribute("data-thread-delete"), true);
          return;
        }
        const btn = event.target.closest("[data-thread-id]");
        if (!btn) return;
        setActive(btn.getAttribute("data-thread-id"), true);
      });
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== THREADS_KEY && event.key !== ACTIVE_KEY_LOCAL) return;
      threads = loadThreads();
      ensureActiveThread();
      renderThreads();
      renderActiveThread();
    });

    threads = loadThreads();
    ensureActiveThread();
    renderThreads();
    renderActiveThread();
    setStatus("Ready");

    setChatActions(sendMessageLocal, createNewThread);
  }

  function dbMode() {
    let threads = [];
    let activeThreadId = null;
    const threadCache = new Map();
    let dbReady = false;

    function loadActiveId() {
      try {
        const raw = localStorage.getItem(ACTIVE_KEY_DB);
        return raw ? String(raw) : null;
      } catch {
        return null;
      }
    }

    function saveActiveId(id) {
      try {
        localStorage.setItem(ACTIVE_KEY_DB, String(id));
      } catch {
        // ignore
      }
    }

    function getThreadMeta(id) {
      return threads.find((t) => String(t.id) === String(id)) || null;
    }

    async function apiListThreads() {
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat/threads") : "/api/chat/threads", { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.ok) throw new Error("Unable to load threads");
      return Array.isArray(data.threads) ? data.threads : [];
    }

    async function apiCreateThread() {
      const token = getCsrfToken();
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat/threads") : "/api/chat/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.ok || !data.thread) throw new Error("Unable to create thread");
      return data.thread;
    }

    async function apiGetThread(id) {
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath(`/api/chat/threads/${encodeURIComponent(id)}`) : `/api/chat/threads/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.ok) throw new Error("Unable to load thread");
      return data;
    }

    async function apiDeleteThread(id) {
      const token = getCsrfToken();
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath(`/api/chat/threads/${encodeURIComponent(id)}`) : `/api/chat/threads/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.ok) throw new Error("Unable to delete thread");
      return data;
    }

    async function apiSendMessage(threadId, text, file) {
      const token = getCsrfToken();
      const headers = {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
      };

      let response;
      if (file) {
        const form = new FormData();
        form.append("thread_id", threadId);
        if (text) form.append("message", text);
        try {
          form.append("image", file, file.name || "upload");
        } catch {
          form.append("image", file);
        }
        response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat") : "/api/chat", { method: "POST", headers, body: form });
      } else {
        response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat") : "/api/chat", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId, message: text }),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.ok) {
        return { ok: false, message: (data && data.message) || "Unable to reach the assistant right now." };
      }
      return {
        ok: true,
        reply: safeString(data.reply) || "...",
        thread_id: data.thread_id,
        title: data.title,
        user_message: String(data.user_message || ""),
      };
    }

    function renderThreads() {
      const sorted = [...threads].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
      renderThreadList(
        sorted.map((t) => ({
          id: t.id,
          title: t.title,
          meta: `${t.message_count || 0} messages - ${formatIso(t.updated_at)}`,
        })),
        activeThreadId
      );
    }

    async function deleteThreadDb(id, focus) {
      const targetId = String(id || "");
      if (!targetId || !dbReady) return;

      setStatus("Deleting...");
      try {
        await apiDeleteThread(targetId);
      } catch {
        setStatus("Error");
        return;
      }

      threadCache.delete(targetId);
      threads = threads.filter((t) => String(t.id) !== targetId);

      if (activeThreadId === targetId) {
        renderThreads();
        if (threads.length) {
          const next = [...threads].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0];
          if (next) {
            await setActive(String(next.id), focus);
            return;
          }
        }
        await createNewThread(focus);
        return;
      }

      renderThreads();
      setStatus("Ready");
      if (focus) inputEl.focus();
    }

    async function setActive(id, focus) {
      activeThreadId = String(id);
      saveActiveId(activeThreadId);
      renderThreads();
      setStatus("Loading...");

      if (threadCache.has(activeThreadId)) {
        const cached = threadCache.get(activeThreadId);
        messagesEl.innerHTML = "";
        for (const m of cached) addMessage(m.role, m.content);
        setStatus("Ready");
        if (focus) inputEl.focus();
        return;
      }

      try {
        const data = await apiGetThread(activeThreadId);
        const msgs = Array.isArray(data.messages)
          ? data.messages
              .map((m) => ({ role: m.role, content: safeString(m.content) }))
              .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
          : [];
        threadCache.set(activeThreadId, msgs);
        messagesEl.innerHTML = "";
        for (const m of msgs) addMessage(m.role, m.content);
        setStatus("Ready");
      } catch {
        messagesEl.innerHTML = "";
        addMessage("assistant", "Unable to load this chat right now. Please try again.");
        setStatus("Error");
      }
      if (focus) inputEl.focus();
    }

    async function createNewThread(focus) {
      setStatus("Creating...");
      try {
        const created = await apiCreateThread();
        threads = await apiListThreads();
        activeThreadId = String(created.id);
        saveActiveId(activeThreadId);
        threadCache.delete(activeThreadId);
        renderThreads();
        await setActive(activeThreadId, focus);
      } catch {
        setStatus("Error");
      }
    }

    async function sendMessageDb() {
      const text = safeString(inputEl.value);
      const hasAttachment = Boolean(pendingImageFile);
      if (!text && !hasAttachment) return;
      if (!activeThreadId) return;

      const attachment = hasAttachment ? consumeAttachment() : { file: null, previewUrl: "" };
      inputEl.value = "";
      sendBtn.disabled = true;
      inputEl.disabled = true;

      addMessage("user", text, { imageUrl: attachment.previewUrl });
      scheduleRevokePreviewUrl(attachment.previewUrl);
      setStatus("Thinking...");
      pendingTypingId = addMessage("assistant", "", { typing: true });

      let result;
      try {
        result = await apiSendMessage(activeThreadId, text, attachment.file);
      } catch {
        if (pendingTypingId) updateMessage(pendingTypingId, "Network error. Please try again.");
        setStatus("Error");
        sendBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
        pendingTypingId = null;
        return;
      }
      if (!result.ok) {
        if (pendingTypingId) updateMessage(pendingTypingId, result.message || "Unable to reach the assistant right now.");
        setStatus("Error");
        sendBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
        pendingTypingId = null;
        return;
      }

      if (pendingTypingId) updateMessage(pendingTypingId, result.reply);
      pendingTypingId = null;

      // Update cache + list meta quickly (without refetching full thread).
      const cached = threadCache.get(activeThreadId) || [];
      const storedUserText =
        safeString(result.user_message) || text || (attachment.file ? "Uploaded an image for prediction." : "");
      cached.push({ role: "user", content: storedUserText });
      cached.push({ role: "assistant", content: result.reply });
      threadCache.set(activeThreadId, cached.slice(-MAX_THREAD_MESSAGES));

      const meta = getThreadMeta(activeThreadId);
      if (meta) {
        meta.message_count = (meta.message_count || 0) + 2;
        if (result.title && meta.title === "New chat") meta.title = result.title;
        meta.updated_at = new Date().toISOString();
      }
      renderThreads();
      setStatus("Ready");

      sendBtn.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();
    }

    if (threadsEl) {
      threadsEl.addEventListener("click", (event) => {
        if (!dbReady) return;
        const deleteBtn = event.target.closest("[data-thread-delete]");
        if (deleteBtn) {
          deleteThreadDb(deleteBtn.getAttribute("data-thread-delete"), true).catch(() => {
            setStatus("Error");
          });
          return;
        }
        const btn = event.target.closest("[data-thread-id]");
        if (!btn) return;
        setActive(btn.getAttribute("data-thread-id"), true);
      });
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== ACTIVE_KEY_DB) return;
      const next = loadActiveId();
      if (next && next !== activeThreadId) setActive(next, false);
    });

    (async () => {
      try {
        setStatus("Loading...");
        threads = await apiListThreads();
        dbReady = true;
        renderThreads();
        const stored = loadActiveId();
        const candidate = stored && getThreadMeta(stored) ? stored : null;
        if (candidate) {
          await setActive(candidate, false);
          return;
        }
        if (threads.length) {
          await setActive(String(threads[0].id), false);
          return;
        }
        await createNewThread(false);
      } catch {
        // Fallback to local mode if DB calls fail.
        dbReady = false;
        setStatus("Ready");
        localMode();
        return;
      }
    })();

    setChatActions(
      () => {
        if (!dbReady) setStatus("Loading...");
        return sendMessageDb();
      },
      (focus) => {
        return createNewThread(Boolean(focus));
      }
    );
  }

  initAttachmentHandlers();
  attachCommonUIHandlers();
  if (isAuthed) dbMode();
  else localMode();
}

if (typeof onReady === "function") {
  onReady(() => setupChat());
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setupChat(), { once: true });
} else {
  setupChat();
}
