function setupChatWidget() {
  const root = document.getElementById("chatWidget");
  if (!root) return;

  const isAuthed = root.getAttribute("data-chat-auth") === "1";
  const userId = String(root.getAttribute("data-chat-user-id") || "").trim();
  const chatScope = isAuthed ? `user:${userId || "unknown"}` : "guest";
  const scopedKey = (base) => `${base}::${chatScope}`;

  const fab = document.getElementById("chatWidgetFab");
  const panel = document.getElementById("chatWidgetPanel");
  const closeBtn = document.getElementById("chatWidgetClose");
  const messagesEl = document.getElementById("chatWidgetMessages");
  const inputEl = document.getElementById("chatWidgetInput");
  const sendBtn = document.getElementById("chatWidgetSend");
  const statusEl = document.getElementById("chatWidgetStatus");
  const csrfEl = document.getElementById("chatWidgetCsrf");
  const resetBtn = document.getElementById("chatWidgetReset");

  if (!fab || !panel || !messagesEl || !inputEl || !sendBtn) return;

  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LEGACY_KEY = scopedKey("veggieai_chat_history_v1");
  const THREADS_KEY = scopedKey("veggieai_chat_threads_v1");
  const ACTIVE_KEY_LOCAL = scopedKey("veggieai_chat_active_thread_v1");
  const ACTIVE_KEY_DB = scopedKey("veggieai_chat_active_thread_db_v1");
  const OPEN_KEY = scopedKey("veggieai_chat_widget_open_v1");

  // One-time cleanup for old browser-global keys from pre-scoped chat storage.
  try {
    localStorage.removeItem("veggieai_chat_history_v1");
    localStorage.removeItem("veggieai_chat_threads_v1");
    localStorage.removeItem("veggieai_chat_active_thread_v1");
    localStorage.removeItem("veggieai_chat_active_thread_db_v1");
    localStorage.removeItem("veggieai_chat_widget_open_v1");
  } catch {
    // ignore
  }

  // Signed-out widget state should never inherit signed-in threads.
  if (!isAuthed) {
    try {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(THREADS_KEY);
      localStorage.removeItem(ACTIVE_KEY_LOCAL);
      localStorage.removeItem(ACTIVE_KEY_DB);
      localStorage.removeItem(OPEN_KEY);
    } catch {
      // ignore
    }
  }

  const MAX_THREAD_MESSAGES = 160;
  const MAX_API_HISTORY = 24;

  let pendingTypingId = null;

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
    out = out.replace(/`([^`\n]+)`/g, (_m, code) => `<code class="chat-inline-code">${code}</code>`);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const safeHref = sanitizeUrl(href);
      const rel = safeHref.startsWith("http") ? ' rel="noopener noreferrer"' : "";
      const target = safeHref.startsWith("http") ? ' target="_blank"' : "";
      return `<a class="chat-md-link" href="${escapeAttr(safeHref)}"${target}${rel}>${label}</a>`;
    });
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
    return out;
  }

  function renderMarkdownToHtml(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = raw.split("\n");
    const parts = [];

    let inCode = false;
    let codeLines = [];
    let listMode = null;

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
      if (/^```/.test(lineRaw)) {
        if (!inCode) {
          closeList();
          inCode = true;
          codeLines = [];
        } else {
          parts.push(`<pre class="chat-code-block"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
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
        parts.push(`<li>${formatInlineMarkdown(escapeHtml(bullet[1] || ""))}</li>`);
        continue;
      }

      const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (ordered) {
        openList("ol");
        parts.push(`<li>${formatInlineMarkdown(escapeHtml(ordered[2] || ""))}</li>`);
        continue;
      }

      closeList();
      parts.push(`<p class="chat-md-p">${formatInlineMarkdown(escapeHtml(line))}</p>`);
    }

    if (inCode) {
      parts.push(`<pre class="chat-code-block"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
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
      const imageUrl = b64 ? `data:${mime};base64,${b64}` : "";
      return { text: remaining, imageUrl };
    }
    const match = raw.match(/\[\[image_prediction:(\d+)\]\]/);
    if (!match) return { text: raw, imageUrl: "" };
    const id = match[1];
    const remaining = raw.replace(match[0], "").replace(/^\s+/, "");
    const imagePath = `/api/predictions/${encodeURIComponent(id)}/image`;
    return { text: remaining, imageUrl: window.withAppBasePath ? window.withAppBasePath(imagePath) : imagePath };
  }

  function addMessage(role, content, { typing = false } = {}) {
    const id = newId("w");
    const wrap = document.createElement("div");
    wrap.className = `chat-row ${role === "user" ? "is-user" : "is-assistant"}`;
    wrap.dataset.msgId = id;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role === "user" ? "chat-bubble--user" : "chat-bubble--assistant"}${
      typing ? " is-typing" : ""
    }`;

    if (typing) {
      bubble.innerHTML =
        '<span class="chat-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></span>';
    } else {
      const parsed = parseImageToken(content);
      const wrapEl = document.createElement("div");
      wrapEl.className = "chat-bubble-content";

      if (parsed.imageUrl) {
        const img = document.createElement("img");
        img.className = "chat-bubble-image";
        img.alt = "Uploaded image";
        img.src = parsed.imageUrl;
        img.loading = "lazy";
        wrapEl.appendChild(img);
      }

      const inner = role === "assistant" ? renderMarkdownToHtml(parsed.text) : renderPlainTextToHtml(parsed.text);
      if (String(parsed.text || "").trim()) {
        const textEl = document.createElement("div");
        textEl.className = "chat-bubble-text";
        textEl.innerHTML = inner;
        wrapEl.appendChild(textEl);
      }
      bubble.innerHTML = "";
      bubble.appendChild(wrapEl);
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
    bubble.classList.remove("is-typing");
    const role = bubble.classList.contains("chat-bubble--user") ? "user" : "assistant";
    const parsed = parseImageToken(content);
    const wrapEl = document.createElement("div");
    wrapEl.className = "chat-bubble-content";

    if (parsed.imageUrl) {
      const img = document.createElement("img");
      img.className = "chat-bubble-image";
      img.alt = "Uploaded image";
      img.src = parsed.imageUrl;
      img.loading = "lazy";
      wrapEl.appendChild(img);
    }

    const inner = role === "assistant" ? renderMarkdownToHtml(parsed.text) : renderPlainTextToHtml(parsed.text);
    if (String(parsed.text || "").trim()) {
      const textEl = document.createElement("div");
      textEl.className = "chat-bubble-text";
      textEl.innerHTML = inner;
      wrapEl.appendChild(textEl);
    }

    bubble.innerHTML = "";
    bubble.appendChild(wrapEl);
    scrollToBottom();
  }

  function getCsrfToken() {
    return csrfEl ? String(csrfEl.value || "") : "";
  }

  function setOpen(open) {
    panel.hidden = !open;
    root.classList.toggle("is-open", open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
    if (open) {
      renderOnOpen();
      inputEl.focus();
    }
  }

  function loadOpen() {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  fab.addEventListener("click", () => setOpen(true));
  if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));

  let renderOnOpen = () => {};

  // ----- Local (guest) mode -----
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
    renderOnOpen = renderActiveThread;

    async function sendMessageLocal() {
      const text = safeString(inputEl.value);
      if (!text) return;
      const thread = getThreadById(activeThreadId);
      if (!thread) return;

      inputEl.value = "";
      sendBtn.disabled = true;
      inputEl.disabled = true;

      addMessage("user", text);
      thread.messages.push({ role: "user", content: text, ts: Date.now() });
      thread.messages = clampMessages(thread.messages);
      thread.updated_at = Date.now();
      if (!thread.title || thread.title === "New chat") thread.title = computeTitle(thread);
      saveThreads();

      setStatus("Thinking...");
      pendingTypingId = addMessage("assistant", "", { typing: true });

      const token = getCsrfToken();
      const historyForApi = thread.messages
        .slice(0, -1)
        .slice(-MAX_API_HISTORY)
        .map((m) => ({ role: m.role, content: stripChatImageTokensForLlm(m.content) }))
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content);

      try {
        const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat") : "/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
          },
          body: JSON.stringify({ message: text, history: historyForApi }),
        });
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

    function createNewThread() {
      const t = { id: newId("t"), title: "New chat", created_at: Date.now(), updated_at: Date.now(), messages: [] };
      ensureGreeting(t);
      threads.unshift(t);
      activeThreadId = t.id;
      saveThreads();
      saveActiveId(activeThreadId);
      renderActiveThread();
      setStatus("Ready");
    }

    sendBtn.addEventListener("click", sendMessageLocal);
    inputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) return;
      event.preventDefault();
      sendMessageLocal();
    });
    if (resetBtn) resetBtn.addEventListener("click", createNewThread);

    window.addEventListener("storage", (event) => {
      if (event.key !== THREADS_KEY && event.key !== ACTIVE_KEY_LOCAL) return;
      threads = loadThreads();
      ensureActiveThread();
      if (!panel.hidden) renderActiveThread();
    });

    threads = loadThreads();
    ensureActiveThread();
    setStatus("Ready");
  }

  // ----- DB (signed-in) mode -----
  function dbMode() {
    let activeThreadId = null;
    const cache = new Map();

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

    async function apiSendMessage(threadId, text) {
      const token = getCsrfToken();
      const response = await fetch(window.withAppBasePath ? window.withAppBasePath("/api/chat") : "/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { "X-CSRFToken": token, "X-CSRF-Token": token } : {}),
        },
        body: JSON.stringify({ thread_id: threadId, message: text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.ok) {
        return { ok: false, message: (data && data.message) || "Unable to reach the assistant right now." };
      }
      return { ok: true, reply: safeString(data.reply) || "...", thread_id: data.thread_id };
    }

    async function loadAndRender(threadId) {
      activeThreadId = String(threadId);
      saveActiveId(activeThreadId);
      setStatus("Loading...");

      if (cache.has(activeThreadId)) {
        messagesEl.innerHTML = "";
        for (const m of cache.get(activeThreadId)) addMessage(m.role, m.content);
        setStatus("Ready");
        return;
      }

      const data = await apiGetThread(activeThreadId);
      const msgs = Array.isArray(data.messages)
        ? data.messages
            .map((m) => ({ role: m.role, content: safeString(m.content) }))
            .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
        : [{ role: "assistant", content: greetingText() }];
      cache.set(activeThreadId, msgs.slice(-MAX_THREAD_MESSAGES));

      messagesEl.innerHTML = "";
      for (const m of msgs) addMessage(m.role, m.content);
      setStatus("Ready");
    }
    renderOnOpen = () => {
      if (!activeThreadId) return;
      loadAndRender(activeThreadId).catch(() => null);
    };

    async function ensureThread() {
      const stored = loadActiveId();
      const list = await apiListThreads();
      const candidate = stored && list.find((t) => String(t.id) === String(stored)) ? stored : null;
      if (candidate) return candidate;
      if (list.length) return String(list[0].id);
      const created = await apiCreateThread();
      return String(created.id);
    }

    async function sendMessageDb() {
      const text = safeString(inputEl.value);
      if (!text || !activeThreadId) return;

      inputEl.value = "";
      sendBtn.disabled = true;
      inputEl.disabled = true;

      addMessage("user", text);
      setStatus("Thinking...");
      pendingTypingId = addMessage("assistant", "", { typing: true });

      const result = await apiSendMessage(activeThreadId, text);
      if (!result.ok) {
        if (pendingTypingId) updateMessage(pendingTypingId, result.message || "Unable to reach the assistant right now.");
        setStatus("Error");
        pendingTypingId = null;
        sendBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
        return;
      }

      if (pendingTypingId) updateMessage(pendingTypingId, result.reply);
      pendingTypingId = null;

      const cached = cache.get(activeThreadId) || [];
      cached.push({ role: "user", content: text });
      cached.push({ role: "assistant", content: result.reply });
      cache.set(activeThreadId, cached.slice(-MAX_THREAD_MESSAGES));

      setStatus("Ready");
      sendBtn.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();
    }

    async function newChat() {
      setStatus("Creating...");
      try {
        const created = await apiCreateThread();
        cache.delete(String(created.id));
        await loadAndRender(created.id);
      } catch {
        setStatus("Error");
      }
    }

    sendBtn.addEventListener("click", sendMessageDb);
    inputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) return;
      event.preventDefault();
      sendMessageDb();
    });
    if (resetBtn) resetBtn.addEventListener("click", newChat);

    window.addEventListener("storage", (event) => {
      if (event.key !== ACTIVE_KEY_DB) return;
      const next = loadActiveId();
      if (next && next !== activeThreadId && !panel.hidden) loadAndRender(next).catch(() => null);
    });

    (async () => {
      try {
        const id = await ensureThread();
        activeThreadId = id;
        if (!panel.hidden) {
          renderOnOpen();
        }
        setStatus("Ready");
      } catch {
        // Fall back to local mode if DB is unreachable.
        localMode();
      }
    })();
  }

  if (isAuthed) {
    dbMode();
  } else {
    localMode();
  }

  setOpen(loadOpen());
}

onReady(() => setupChatWidget());
