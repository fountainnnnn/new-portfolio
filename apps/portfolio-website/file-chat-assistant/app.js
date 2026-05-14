// Backend origin (override with ?api=https://your-api.com)
const BACKEND_BASE_URL =
  new URLSearchParams(location.search).get("api") ||
  "https://crystallizedcrust-file-chat-assistant.hf.space"; // Hugging Face Space backend

// DOM
const uploadForm = document.getElementById("upload-form");
const askForm = document.getElementById("ask-form");
const statusAlert = document.getElementById("statusAlert");
const messages = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");

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
  div.innerHTML = `<div class="bubble">${text}</div>`;
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

  showStatus("Uploading file and building QA session… please wait.", "info");

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
    messages.innerHTML = `<div class="text-muted small">Ask me anything about your document 👇</div>`;
    const input = askForm.querySelector('input[name="question"]');
    input.disabled = false;
    askForm.querySelector("button").disabled = false;
  } catch (err) {
    console.error(err);
    showStatus("Error uploading file: " + err.message, "danger");
  }
});

// -------- Ask Question --------
askForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sessionId) {
    showStatus("No active session. Please upload a file first.", "warning");
    return;
  }

  const input = askForm.querySelector('input[name="question"]');
  const q = input.value.trim();
  if (!q) {
    showStatus("Please enter a question.", "warning");
    return;
  }

  // Add user message
  addMessage("user", q);
  input.value = "";

  // Show typing indicator
  showTyping();
  showStatus("Thinking…", "info");

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
  }
});

// Looping typewriter effect for hero title
document.addEventListener("DOMContentLoaded", () => {
  const text = "Document Q&A Chat Assistant";
  const el = document.getElementById("hero-title");
  let i = 0;
  let forward = true;

  function typeLoop() {
    if (forward) {
      if (i < text.length) {
        el.textContent = text.substring(0, i + 1);
        i++;
      } else {
        forward = false;
        setTimeout(typeLoop, 1500); // pause at full text
        return;
      }
    } else {
      if (i > 0) {
        el.textContent = text.substring(0, i - 1);
        i--;
      } else {
        forward = true;
      }
    }
    setTimeout(typeLoop, forward ? 120 : 80); // typing vs deleting speed
  }

  typeLoop();
});
