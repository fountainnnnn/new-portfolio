// Backend API (FastAPI running locally)
const BACKEND_BASE_URL =
  new URLSearchParams(location.search).get("api") ||
  "https://crystallizedcrust-coding-quiz.hf.space";

document.addEventListener("DOMContentLoaded", () => {
  const setupCard = document.getElementById("setup-card");
  const startBtn = document.getElementById("start-btn");
  const topicSelect = document.getElementById("topic");
  const difficultySelect = document.getElementById("difficulty");
  const languageSelect = document.getElementById("language");
  const numQuestionsInput = document.getElementById("num-questions");

  let quizContainer = document.getElementById("quiz-container");
  let resultCard = document.getElementById("result-card");
  let questionText = document.getElementById("question-text");
  let codeBlock = document.getElementById("code-block");
  let optionsDiv = document.getElementById("options");
  let dragZone = document.getElementById("dragdrop-zone");
  let dragActions = document.getElementById("dragdrop-actions");
  let submitOrderBtn = document.getElementById("submit-order-btn");
  let feedbackEl = document.getElementById("feedback");
  let scoreText = document.getElementById("score-text");
  let restartBtn = document.getElementById("restart-btn");

  // Loading overlay
  const loadingOverlay = document.getElementById("loading-overlay");

  let sessionId = null;
  let questions = [];
  let currentIndex = 0;
  let score = 0;
  let locked = false;
  let attemptedWrong = false;

  // Ensure dragZone never collapses
  dragZone.style.minHeight = "200px";
  dragZone.style.display = "flex";
  dragZone.style.flexDirection = "column";
  dragZone.style.gap = "6px";

  // Load quiz
  async function loadQuiz(language, topic, difficulty, numQuestions) {
    loadingOverlay.classList.remove("hidden");
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/generate_questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, topic, difficulty, n: numQuestions }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "ok" || !Array.isArray(data.questions)) {
        throw new Error(data.detail || data.message || "Failed to load questions");
      }

      sessionId = data.session_id;
      questions = data.questions;
      currentIndex = 0;
      score = 0;

      setupCard.classList.add("hidden");
      quizContainer.classList.remove("hidden");
      showQuestion();
    } catch (err) {
      console.error("Quiz load error:", err);
      alert("Failed to load quiz. Please try again.");
    } finally {
      loadingOverlay.classList.add("hidden");
    }
  }

  // Render a question
  function showQuestion() {
    if (currentIndex >= questions.length) {
      return showResults();
    }

    const q = questions[currentIndex];

    // Reset UI
    locked = false;
    attemptedWrong = false;
    feedbackEl.classList.add("hidden");
    feedbackEl.textContent = "";
    codeBlock.classList.add("hidden");
    optionsDiv.innerHTML = "";
    dragZone.innerHTML = "";
    dragZone.classList.add("hidden");
    dragActions.classList.add("hidden");

    // Reset submit order button state
    submitOrderBtn.disabled = false;

    // Remove lingering next button
    const oldNext = document.getElementById("next-btn");
    if (oldNext) oldNext.remove();

    // Question text
    questionText.textContent = `Q${currentIndex + 1}/${questions.length}: ${q.question || ""}`;

    // Fill-in-the-blank
    if (q.type === "fill_code" && q.code_with_blanks) {
      const codeHTML = q.code_with_blanks.replace(/_{3,}/g, () => {
        return `<span class="blank" contenteditable="true" data-blank></span>`;
      });
      codeBlock.innerHTML = `<pre><code>${codeHTML}</code></pre>`;
      codeBlock.classList.remove("hidden");

      const submitBtn = document.createElement("button");
      submitBtn.className = "btn btn-primary mt-2";
      submitBtn.textContent = "Submit";
      submitBtn.addEventListener("click", () => {
        if (!locked) {
          const blanks = [...codeBlock.querySelectorAll("[data-blank]")].map(
            (el) => el.innerText.trim()
          );
          submitAnswer(blanks);
        }
      });
      optionsDiv.appendChild(submitBtn);

      codeBlock.querySelectorAll("[data-blank]").forEach((el) => {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitBtn.click();
          }
        });

        const resize = () => {
          const span = document.createElement("span");
          span.style.visibility = "hidden";
          span.style.position = "absolute";
          span.style.whiteSpace = "pre";
          span.style.font = getComputedStyle(el).font;
          span.textContent = el.textContent || "";
          document.body.appendChild(span);
          el.style.width = span.offsetWidth + 20 + "px";
          span.remove();
        };
        el.addEventListener("input", resize);
        resize();
      });
    }
    // Multiple choice
    else if (q.type === "mcq" && Array.isArray(q.options)) {
      if (q.code_with_blanks) {
        codeBlock.textContent = q.code_with_blanks;
        codeBlock.classList.remove("hidden");
      }
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          if (!locked) submitAnswer(opt, btn);
        });
        optionsDiv.appendChild(btn);
      });
    }
    // Drag and drop
    else if (q.type === "drag_drop") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        console.error("Invalid drag_drop question, skipping:", q);
        currentIndex++;
        return showQuestion();
      }
      dragZone.classList.remove("hidden");
      dragActions.classList.remove("hidden");

      q.options.forEach((opt) => {
        const el = document.createElement("div");
        el.className = "draggable";
        el.draggable = true;
        el.textContent = opt;

        // Prevent highlighting/callout on mobile
        el.style.userSelect = "none";
        el.style.webkitUserSelect = "none";
        el.style.webkitTouchCallout = "none";

        dragZone.appendChild(el);
      });

      enableDragAndDrop();

      submitOrderBtn.onclick = () => {
        if (!locked) {
          const order = [...dragZone.querySelectorAll(".draggable")].map(
            (el) => el.textContent
          );
          submitAnswer(order);
        }
      };
    }
  }

  // Drag & drop support
  function enableDragAndDrop() {
    let dragged = null;
    let touchClone = null;
    const placeholder = document.createElement("div");
    placeholder.className = "drag-placeholder";
    placeholder.style.height = "32px";
    placeholder.style.background = "#eee";
    placeholder.style.border = "1px dashed #aaa";
    placeholder.style.borderRadius = "4px";

    // ✅ reset dragZone listeners by replacing with clone
    const newDragZone = dragZone.cloneNode(true);
    dragZone.parentNode.replaceChild(newDragZone, dragZone);
    dragZone = newDragZone;

    function getDragAfterElement(container, y) {
      const draggableEls = [
        ...container.querySelectorAll(".draggable:not([style*='display: none'])"),
      ];
      return draggableEls.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          } else {
            return closest;
          }
        },
        { offset: Number.NEGATIVE_INFINITY }
      ).element;
    }

    // ---- Desktop drag ----
    dragZone.querySelectorAll(".draggable").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        dragged = el;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", el.textContent);
        setTimeout(() => {
          el.style.display = "none";
        }, 0);
      });

      el.addEventListener("dragend", () => {
        el.style.display = "block";
        dragged = null;
        if (placeholder.parentNode) placeholder.remove();
        dragZone.classList.remove("dragover");
      });
    });

    dragZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dragZone.classList.add("dragover");
      const afterEl = getDragAfterElement(dragZone, e.clientY);
      if (!placeholder.parentNode) dragZone.appendChild(placeholder);
      if (afterEl == null) {
        dragZone.appendChild(placeholder);
      } else {
        dragZone.insertBefore(placeholder, afterEl);
      }
    });

    dragZone.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragged) {
        if (placeholder.parentNode) {
          dragZone.insertBefore(dragged, placeholder);
        } else {
          dragZone.appendChild(dragged);
        }
        dragged.style.display = "block";
      }
      if (placeholder.parentNode) placeholder.remove();
      dragZone.classList.remove("dragover");
    });

    dragZone.addEventListener("dragleave", (e) => {
      if (!dragZone.contains(e.relatedTarget)) {
        if (placeholder.parentNode) placeholder.remove();
        dragZone.classList.remove("dragover");
      }
    });

    // ---- Mobile touch simulation ----
    dragZone.querySelectorAll(".draggable").forEach((el) => {
      el.addEventListener("touchstart", (e) => {
        e.preventDefault();
        dragged = el;
        touchClone = el.cloneNode(true);
        touchClone.style.position = "absolute";
        touchClone.style.pointerEvents = "none";
        touchClone.style.opacity = "0.7";
        touchClone.style.zIndex = "1000";
        document.body.appendChild(touchClone);
      }, { passive: false });

      el.addEventListener("touchmove", (e) => {
        if (!touchClone) return;
        const touch = e.touches[0];
        touchClone.style.left = touch.pageX - touchClone.offsetWidth / 2 + "px";
        touchClone.style.top = touch.pageY - touchClone.offsetHeight / 2 + "px";

        const afterEl = getDragAfterElement(dragZone, touch.clientY);
        if (!placeholder.parentNode) dragZone.appendChild(placeholder);
        if (afterEl == null) {
          dragZone.appendChild(placeholder);
        } else {
          dragZone.insertBefore(placeholder, afterEl);
        }
      }, { passive: false });

      el.addEventListener("touchend", () => {
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }
        if (dragged) {
          if (placeholder.parentNode) {
            dragZone.insertBefore(dragged, placeholder);
          } else {
            dragZone.appendChild(dragged);
          }
        }
        dragged = null;
        if (placeholder.parentNode) placeholder.remove();
        dragZone.classList.remove("dragover");
      });
    });
  }

  // Submit answer
  async function submitAnswer(ans, clickedBtn = null) {
    const q = questions[currentIndex];
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/check_answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: q.question_id,
          user_answer: ans,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.detail || data.message || "Failed to check answer");
      }

      const correct = data.correct;
      if (correct) {
        if (!attemptedWrong) score++;
        locked = true;
        if (clickedBtn) clickedBtn.classList.add("correct");
        feedbackEl.classList.remove("hidden");
        feedbackEl.className = "feedback success";
        feedbackEl.textContent = `✅ Correct! ${data.explanation}`;

        // Disable Submit Order button if drag_drop type
        if (q.type === "drag_drop") {
          submitOrderBtn.disabled = true;
        }

        // Show Next button instead of auto-advancing
        const nextBtn = document.createElement("button");
        nextBtn.className = "btn btn-success mt-2";
        nextBtn.textContent = "Next Question";
        nextBtn.id = "next-btn";
        nextBtn.addEventListener("click", () => {
          currentIndex++;
          showQuestion();
        });

        feedbackEl.appendChild(document.createElement("br"));
        feedbackEl.appendChild(nextBtn);
      } else {
        attemptedWrong = true;
        if (clickedBtn) clickedBtn.classList.add("incorrect");
        feedbackEl.classList.remove("hidden");
        feedbackEl.className = "feedback error";
        feedbackEl.textContent = `❌ Incorrect. Try again.`;
      }
    } catch (err) {
      console.error("Answer submit error:", err);
      feedbackEl.classList.remove("hidden");
      feedbackEl.className = "feedback error";
      feedbackEl.textContent = `Error: ${err.message}`;
    }
  }

  // Results
  function showResults() {
    quizContainer.classList.add("hidden");
    resultCard.classList.remove("hidden");
    scoreText.textContent = `You scored ${score} out of ${questions.length} questions.`;
  }

  // Events
  startBtn.addEventListener("click", () => {
    const language = languageSelect.value;
    const topic = topicSelect.value;
    const difficulty = difficultySelect.value;
    const numQuestions = parseInt(numQuestionsInput.value, 10) || 10;
    loadQuiz(language, topic, difficulty, numQuestions);
  });

  restartBtn.addEventListener("click", () => {
    resultCard.classList.add("hidden");
    setupCard.classList.remove("hidden");
  });

  // Typewriter animation
  const text = "AI Generated Coding Quiz";
  const el = document.getElementById("hero-typer");
  let i = 0;
  let isDeleting = false;

  function typeLoop() {
    if (!isDeleting && i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(typeLoop, 120);
    } else if (isDeleting && i > 0) {
      el.textContent = text.substring(0, i - 1);
      i--;
      setTimeout(typeLoop, 80);
    } else {
      isDeleting = !isDeleting;
      setTimeout(typeLoop, 1000);
    }
  }
  typeLoop();

  // Init AOS
  if (window.AOS) {
    AOS.init({
      once: true,
      duration: 300,
      easing: "ease-out",
      mirror: false,
      anchorPlacement: "top-bottom",
    });
  }
});
