// Backend origin (override with ?api=https://your-api.com)
const BACKEND_BASE_URL =
  new URLSearchParams(location.search).get("api") ||
  "/api/file-chat-assistant";

// DOM
const uploadForm = document.getElementById("upload-form");
const askForm = document.getElementById("ask-form");
const statusAlert = document.getElementById("statusAlert");
const messages = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");
const uploadButton = uploadForm.querySelector('button[type="submit"]');
const askInput = askForm.querySelector('input[name="question"]');
const askButton = askForm.querySelector("button");

let sessionId = null;


// AOS animations
if (window.AOS) {
  AOS.init({ duration: 800, once: true });
}

function showStatus(message, type = "info") {
  statusAlert.className = `alert alert-${type}`;
  statusAlert.textContent = message;
  statusAlert.classList.remove("d-none");
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  div.appendChild(bubble);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
  typingIndicator.classList.remove("d-none");
  messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
  typingIndicator.classList.add("d-none");
}

// -------- File Upload --------
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData();
  const file = uploadForm.querySelector('input[type="file"]').files[0];
  if (!file) {
    showStatus("Please choose a file.", "warning");
    return;
  }
  fd.append("file", file);

  // API key (optional)
  if (uploadForm.openai_api_key && uploadForm.openai_api_key.value) {
    fd.append("openai_api_key", uploadForm.openai_api_key.value);
  }

  showStatus("Uploading file and building QA session...", "info");
  uploadButton.disabled = true;

  try {
    const resp = await fetch(`${BACKEND_BASE_URL}/upload`, {
      method: "POST",
      body: fd,
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Upload failed: HTTP ${resp.status} - ${errorText}`);
    }
    const data = await resp.json();
    sessionId = data.session_id;
    showStatus("File uploaded! You can now ask questions.", "success");

    // Clear intro and unlock chat
    messages.textContent = "";
    const hint = document.createElement("div");
    hint.className = "text-muted small";
    hint.textContent = "Ask me anything about your document.";
    messages.appendChild(hint);
    askInput.disabled = false;
    askButton.disabled = false;
    askInput.focus();
  } catch (err) {
    console.error(err);
    showStatus("Error uploading file: " + err.message, "danger");
  } finally {
    uploadButton.disabled = false;
  }
});

// -------- Ask Question --------
askForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sessionId) {
    showStatus("No active session. Please upload a file first.", "warning");
    return;
  }

  const q = askInput.value.trim();
  if (!q) {
    showStatus("Please enter a question.", "warning");
    return;
  }

  // Add user message
  addMessage("user", q);
  askInput.value = "";
  askInput.disabled = true;
  askButton.disabled = true;

  // Show typing indicator
  showTyping();
  showStatus("Thinking...", "info");

  try {
    const fd = new FormData();
    fd.append("session_id", sessionId);
    fd.append("question", q);

    const resp = await fetch(`${BACKEND_BASE_URL}/ask`, {
      method: "POST",
      body: fd,
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Ask failed: HTTP ${resp.status} - ${errorText}`);
    }
    const data = await resp.json();

    hideTyping();
    addMessage("assistant", data.answer);
    showStatus("Answer ready!", "success");
  } catch (err) {
    console.error(err);
    hideTyping();
    showStatus("Error fetching answer: " + err.message, "danger");
  } finally {
    askInput.disabled = false;
    askButton.disabled = false;
    askInput.focus();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("hero-title");
  if (el) el.textContent = "Document Q&A Chat Assistant";
});
