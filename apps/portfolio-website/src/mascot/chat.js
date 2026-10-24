/* Mini Mervin's chat. Click him and a small chat opens right beside him.
   Each question runs a short agent loop:
     look   - work out what the visitor is looking at (hovered item, else the part of the page in view)
     think  - ask the model, with page facts and that context, for a JSON answer {reply, target}
     check  - validate the JSON; if it's malformed, ask once more with a correction
     act    - answer, and walk over and point at the part of the page the answer is about
   If the model can't be reached, he answers from the page itself. */
export function startChat(el, mascot) {
  const mini = el.querySelector(".mini");
  const CHAT_URL = ["localhost", "127.0.0.1"].includes(location.hostname) ? "https://ngyuhang.com/api/chat" : "/api/chat";
  const thread = mini.querySelector(".thread");
  const form = mini.querySelector("form.ask"), input = form.querySelector("input"), send = form.querySelector("button");

  // parts of the page he can see and point at; specific items listed before their sections
  const REGIONS = [
    { id: "reyolk", label: "Reyolk", sel: ".tiles .tile:nth-child(1)" },
    { id: "agentlabs", label: "AgentLabs", sel: ".tiles .tile:nth-child(2)" },
    { id: "esg", label: "ESG Evidence Engine", sel: ".tiles .tile:nth-child(3)" },
    { id: "allprojects", label: "All projects", sel: ".tiles .tile.all" },
    { id: "influencees", label: "my Influencees role", sel: "#experience .xrow:nth-of-type(1)" },
    { id: "dsac", label: "my SP DSAC internship", sel: "#experience .xrow:nth-of-type(3)" },
    { id: "petaniai", label: "my PetaniAI role", sel: "#experience .xrow:nth-of-type(4)" },
    { id: "reyolkrole", label: "my Reyolk founder role", sel: "#experience .xrow:nth-of-type(2)" },
    { id: "spcomms", label: "my SPOH Chatbot role", sel: "#experience .xrow:nth-of-type(5)" },
    { id: "photo", label: "the detection demo on my photo", sel: ".det" },
    { id: "agent", label: "the agent loop demo", sel: ".skill:nth-of-type(1)" },
    { id: "nn", label: "the machine learning demo", sel: ".skill:nth-of-type(2)" },
    { id: "conv", label: "the convolution demo", sel: ".skill:nth-of-type(3)" },
    { id: "rag", label: "the agentic RAG demo", sel: ".skill:nth-of-type(4)" },
    { id: "fullstack", label: "the full-stack apps demo", sel: ".skill:nth-of-type(5)" },
    { id: "hero", label: "the intro", sel: ".hero" },
    { id: "about", label: "About me", sel: "#about" },
    { id: "work", label: "Selected work", sel: "#work" },
    { id: "experience", label: "Experience", sel: "#experience" },
    { id: "competitions", label: "Competitions", sel: ".wgrid" },
    { id: "certs", label: "Certifications", sel: ".cgrid" },
    { id: "contact", label: "the contact section", sel: "#contact" },
  ].map((r) => ({ ...r, node: document.querySelector(r.sel) })).filter((r) => r.node);
  const IDS = REGIONS.map((r) => r.id);

  // short facts so answers match this page, not an old profile (each message is capped at 800 chars)
  const FACTS_1 = "Facts about me (Ng Yu Hang, 'Mervin'). Full-stack AI dev / data scientist in Singapore, studying Applied AI & Analytics at SP. Founding Product & AI Engineer at Influencees (Sep 2026-now): Ai-kyo, an AI assistant for creators, and one inbox for WhatsApp, Instagram, TikTok, Gmail. Full-Stack AI Engineer intern at SP Data Science & Analytics Centre (Mar 2026-now): RAG chatbots on Azure AI Search, an LLM grader for Power BI dashboards. AI researcher at PetaniAI (May-Aug 2026). Student developer at SP (2025-26): SPOH Chatbot, a RAG agent on AWS. Skills: AI agents, ML (regression, classification, clustering, forecasting), deep learning (PyTorch, CNNs, GANs, LoRA), computer vision (YOLO, OpenCV), RAG, full-stack (FastAPI, React, Next.js, Docker, Azure, AWS, Supabase).";
  const FACTS_2 = "Projects: Reyolk (AI operating system for small service businesses, reyolk.app); AgentLabs (attacks AI agents, patches and retests them); ESG Evidence Engine (checks ESG claims against evidence incl. satellite images, PolyFinTech 2026 finalist); ProofBench (benchmarks software tools with evidence); ProjectAI (prompting game, Edu2030 hackathon at MOE HQ); SUPAgent (company docs to support agent, 'SUP Build top 3). Also: NOAI 2026 bronze, top 3 at OpenClaw, AWS AI Practitioner. Email spiralcrust@gmail.com. Rules: you are Mini Mervin, a small cartoon of me on my portfolio. Speak as me, first person, friendly, max 2 short sentences. If unsure, say so. Reply ONLY with JSON: {\"reply\":\"...\",\"target\":\"<id or none>\"}. target = the page part your answer is about.";

  // what he can point at, in words the model understands
  const FACTS_3 = "You CAN show the visitor any part of this page: set target and I will walk them there and point at it, so say something like 'Here it is'. Never say you can't show something on this page. Targets: " + REGIONS.map((r) => `${r.id} = ${r.label}`).join("; ").slice(0, 640) + ". Use \"none\" only when nothing on the page fits.";
  // "show me X" / "where is X" / "take me to X" always navigates, whatever the model says
  const wantsToSee = (q) => /\b(show|see|where|take me|go to|open|find|point)\b/i.test(q);
  const named = (q) => { const ql = q.toLowerCase(); return REGIONS.find((r) => ql.includes(r.label.toLowerCase().replace(/^(my|the) /, "").replace(/ (demo|role|internship|section)$/, ""))); };

  const history = [];
  let hovered = null, hoveredAt = 0, busy = false;
  document.addEventListener("pointerover", (e) => {
    if (mini.contains(e.target) || el.contains(e.target)) return;
    const hit = REGIONS.find((r) => r.node.contains(e.target) && r.node.matches(".tile, .xrow, .det, .skill"));
    if (hit) { hovered = hit; hoveredAt = performance.now(); }
  });

  /* look: hovered item if recent, else the most specific part covering the middle of the screen */
  function look() {
    if (hovered && performance.now() - hoveredAt < 6000 && onScreen(hovered.node)) return hovered;
    const y = innerHeight * 0.45;
    return REGIONS.find((r) => { const b = r.node.getBoundingClientRect(); return b.top <= y && b.bottom >= y; }) || REGIONS.find((r) => r.id === "hero");
  }
  const onScreen = (n) => { const b = n.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };
  const visibleText = (n) => n.innerText.replace(/\s+/g, " ").trim().slice(0, 340);

  function showWhere() { return look(); }
  const setSteps = () => {};   // the loop's steps run silently
  const bubble = (cls, text) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; thread.appendChild(d); thread.scrollTop = thread.scrollHeight; return d; };
  const typeInto = (node, text) => new Promise((res) => { let i = 0; const id = setInterval(() => { node.textContent = text.slice(0, ++i); thread.scrollTop = thread.scrollHeight; if (i >= text.length) { clearInterval(id); res(); } }, 14); });

  /* think: one model call */
  async function callModel(messages) {
    const res = await fetch(CHAT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.reply) throw new Error(data.error || `HTTP ${res.status}`);
    return data.reply;
  }
  /* check: pull out and validate the JSON answer */
  function parse(raw) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const j = JSON.parse(m[0]);
      const reply = typeof j.reply === "string" ? j.reply.trim() : "";
      if (!reply || reply.length > 500) return null;
      return { reply, target: IDS.includes(j.target) ? j.target : null };
    } catch { return null; }
  }
  /* offline fallback: answer from the page itself */
  function fromPage(q, ctx) {
    const ql = q.toLowerCase();
    const named = REGIONS.find((r) => ql.includes(r.label.toLowerCase().replace(/^(my|the) /, "").split(" ")[0]));
    const r = named || ctx;
    const first = visibleText(r.node).split(/(?<=[.!?])\s/)[0];
    return { reply: `I can't reach my brain right now, but here's what's on ${r.label}: ${first}`, target: r.id };
  }

  async function ask(q) {
    busy = true; send.disabled = true; mascot.thinking = true;
    bubble("q", q);
    const out = bubble("a", "…");
    const ctx = showWhere(true);
    setSteps("look");
    const prompt = `I'm looking at ${ctx.label}. On screen there: "${visibleText(ctx.node)}"\nMy question: ${q}`.slice(0, 790);
    const base = [
      { role: "user", content: FACTS_1 }, { role: "assistant", content: "Got it." },
      { role: "user", content: FACTS_2 }, { role: "assistant", content: '{"reply":"Got it.","target":"none"}' },
      { role: "user", content: FACTS_3 }, { role: "assistant", content: '{"reply":"Got it, I can point things out.","target":"none"}' },
      ...history.slice(-2),
    ];
    let answer = null, raw = "";
    try {
      setSteps("think", ["look"]);
      raw = await callModel([...base, { role: "user", content: prompt }]);
      setSteps("check", ["look", "think"]);
      answer = parse(raw);
      if (!answer) {   // one corrective retry
        setSteps("think", ["look"]);
        raw = await callModel([...base, { role: "user", content: prompt }, { role: "assistant", content: raw.slice(0, 700) }, { role: "user", content: 'Reply again ONLY as JSON: {"reply":"...","target":"<id or none>"}' }]);
        setSteps("check", ["look", "think"]);
        answer = parse(raw) || (raw && !raw.trim().startsWith("{") ? { reply: raw.trim().slice(0, 400), target: null } : null);
      }
    } catch { answer = null; }
    if (!answer) answer = fromPage(q, ctx);
    answer.reply = answer.reply.replace(/\s*[\u2014\u2013]\s*/g, ", ");   // no em or en dashes in his replies
    const asked = named(q);
    if (wantsToSee(q) && asked) answer.target = asked.id;   // tool routing the model can't override

    setSteps("act", ["look", "think", "check"]);
    const target = REGIONS.find((r) => r.id === answer.target);
    if (target && target !== REGIONS.find((r) => r.id === "hero")) {
      if (!onScreen(target.node)) target.node.scrollIntoView({ behavior: "smooth", block: "center" });
      mascot.goTo(target.node);
      target.node.classList.add("spot-glow"); setTimeout(() => target.node.classList.remove("spot-glow"), 2600);
    }
    mascot.thinking = false; mascot.cheer = 0.9;
    await typeInto(out, answer.reply);
    setSteps(null, ["look", "think", "check", "act"]);
    history.push({ role: "user", content: q.slice(0, 300) }, { role: "assistant", content: JSON.stringify({ reply: answer.reply, target: answer.target || "none" }).slice(0, 700) });
    busy = false; send.disabled = false; input.focus({ preventScroll: true });
  }

  /* open/close: clicking him toggles the mini chat; clicks inside it don't */
  function open() { mascot.open = true; el.setAttribute("aria-expanded", "true"); setTimeout(() => input.focus({ preventScroll: true }), 60); }
  function close() { mascot.open = false; el.setAttribute("aria-expanded", "false"); mini.classList.remove("contact-mode"); }
  document.addEventListener("mascot:click", () => (mascot.open ? close() : open()));

  mini.addEventListener("click", (e) => e.stopPropagation());
  mini.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
  mini.addEventListener("pointerenter", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => { if (mascot.open && !el.contains(e.target) && !busy) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && mascot.open) close(); });
  // the visitor scrolling away closes it; listen for their wheel and swipes, not "scroll",
  // so his own scroll to an answer, or a phone keyboard opening, doesn't close it
  const scrolledAway = (e) => { if (mascot.open && !el.contains(e.target)) close(); };
  addEventListener("wheel", scrolledAway, { passive: true });
  addEventListener("touchmove", scrolledAway, { passive: true });
  addEventListener("keydown", (e) => { if (["PageDown", "PageUp", "ArrowDown", "ArrowUp", " ", "Home", "End"].includes(e.key)) scrolledAway(e); });
  form.addEventListener("submit", (e) => { e.preventDefault(); const q = input.value.trim(); if (!q || busy) return; input.value = ""; ask(q); });
  return { open, close };
}
