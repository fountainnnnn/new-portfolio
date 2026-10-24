/* Shared shell for the AI demo tools (quiz slides, mock paper, document chat, coding quiz).
   These pages keep the original Bootstrap look; the portfolio pages don't load any of this. */
import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  PlayCircle,
  Send,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import "./tools.css";

// Bootstrap, its icons and Nunito are only needed by the tools, so they're added to <head> here, not in index.html
const HEAD_LINKS = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&display=swap",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css",
];
const motionScripts = [
  "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js",
  "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js",
  "https://unpkg.com/lenis@1.3.4/dist/lenis.min.js",
  "/motion.js",
];

function loadMotionScripts() {
  if (window.__portfolioMotionLoading) return;
  window.__portfolioMotionLoading = true;

  let chain = Promise.resolve();
  motionScripts.forEach((src) => {
    chain = chain.then(() => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-portfolio-motion="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.dataset.portfolioMotion = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    }));
  });

  chain.catch(() => {
    document.documentElement.classList.add("motion-unavailable");
  });
}
loadMotionScripts();

HEAD_LINKS.forEach((href) => {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; document.head.appendChild(link);
});

const navItems = [
  { label: "About", href: "/#about", section: "about" },
  { label: "Projects", href: "/projects", section: "projects" },
  { label: "Skills", href: "/#skills", section: "skills" },
  { label: "Certifications", href: "/projects#certs", section: "certifications" },
  { label: "Contact", href: "/#contact", section: "contact", cta: true },
];

function SiteNav({ active = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className="navbar navbar-expand-lg fixed-top site-navbar" aria-label="Primary navigation">
      <div className="container">
        <a className="navbar-brand fw-bold" href="/#hero">Mervin&apos;s Hub</a>
        <button className="navbar-toggler nav-toggle" type="button" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          <span className="nav-toggle-line"></span>
          <span className="nav-toggle-line"></span>
        </button>
        <div id="navbarNav" className={`collapse navbar-collapse justify-content-end ${open ? "show" : ""}`}>
          <ul className="navbar-nav nav-menu">
            {navItems.map((item) => (
              <li className="nav-item" key={item.label}>
                <a
                  className={`nav-link ${item.cta ? "nav-link-cta" : ""}`}
                  href={item.href}
                  data-section={item.section}
                  aria-current={active === item.section ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export function ProjectShell({ bodyClass, kicker, title, lede, cta, preview, children }) {
  useEffect(() => {
    document.body.className = `project-app ${bodyClass}`;
    return () => { document.body.className = ""; };
  }, [bodyClass]);
  return (
    <div className={`project-route ${bodyClass}`}>
      <SiteNav active="projects" />
      <main>
        <section id="hero" className="section project-hero">
          <div className="container hero-container">
            <div className="project-hero-copy">
          <a className="project-back-link" href="/projects"><ArrowLeft size={16} /> All projects</a>
              <p className="project-kicker">{kicker}</p>
              <h1>{title}</h1>
              <p className="project-hero-lede">{lede}</p>
              <div className="project-hero-actions">
                <a id="get-started" href={cta.href} className="btn btn-accent">{cta.label} <ArrowDown size={18} /></a>
            <a href="/projects" className="btn btn-outline-dark">Back to work</a>
              </div>
            </div>
            <aside className="project-product-preview">{preview}</aside>
          </div>
        </section>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function StatusAlert({ status }) {
  if (!status.message) return null;
  return <div className={`alert alert-${status.type || "info"}`} role="alert">{status.message}</div>;
}

export function ProgressBar({ progress, active }) {
  if (!active) return null;
  return <div className="progress mb-3"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${progress}%` }} /></div>;
}

export function useFakeProgress(active, max = 90) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) {
      setProgress(0);
      return undefined;
    }
    setProgress(2);
    const id = setInterval(() => setProgress((value) => Math.min(max, value + Math.random() * 6)), 250);
    return () => clearInterval(id);
  }, [active, max]);
  return progress;
}

export function QuestionRenderer({ question, wrong, feedback, pending, blankAnswers, setBlankAnswers, order, setOrder, submitAnswer }) {
  const correctLocked = feedback?.correct;
  if (question.type === "mcq" && Array.isArray(question.options)) {
    return <div className="options">{question.options.map((opt) => <button key={opt} className={`option-btn ${wrong.has(opt) ? "incorrect" : ""}`} disabled={correctLocked || pending || wrong.has(opt)} onClick={() => submitAnswer(opt, opt)}>{opt}</button>)}</div>;
  }
  if (question.type === "fill_code") {
    const parts = String(question.code_with_blanks || "").split(/_{3,}/g);
    return <><pre className="code-block"><code>{parts.map((part, index) => <React.Fragment key={index}>{part}{index < parts.length - 1 && <input className={`blank-input ${feedback && !feedback.correct ? "is-error" : ""}`} value={blankAnswers[index] || ""} onChange={(e) => { const next = [...blankAnswers]; next[index] = e.target.value; setBlankAnswers(next); }} />}</React.Fragment>)}</code></pre><button className="btn btn-accent mt-2" disabled={correctLocked || pending} onClick={() => submitAnswer(blankAnswers.map((x) => String(x || "").trim()), "fill")}>Submit</button></>;
  }
  if (question.type === "drag_drop" && Array.isArray(question.options)) {
    const items = order.length ? order : question.options;
    const move = (from, delta) => {
      const next = [...items];
      const to = Math.max(0, Math.min(next.length - 1, from + delta));
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      setOrder(next);
    };
    return <><div className="dragdrop-zone">{items.map((item, index) => <div className="draggable" key={item}><span>{item}</span><button disabled={index === 0} onClick={() => move(index, -1)} type="button">Up</button><button disabled={index === items.length - 1} onClick={() => move(index, 1)} type="button">Down</button></div>)}</div><button className="btn btn-accent mt-2" disabled={correctLocked || pending} onClick={() => submitAnswer(items, "order")}>Submit order</button></>;
  }
  return <div className="alert alert-warning">This generated question type is not supported yet. Start a new quiz.</div>;
}

export function FeedbackPanel({ feedback }) {
  if (!feedback) return null;
  return <div className={`feedback ${feedback.correct ? "correct" : "incorrect"}`}>{feedback.correct ? <CheckCircle2 size={20} /> : <XCircle size={20} />} {feedback.correct ? "Correct." : "Incorrect. Try again."} {feedback.explanation}</div>;
}

export function Select({ label, value, onChange, options }) {
  return <label>{label}<select className="input-select" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((x) => <option value={x} key={x}>{x}</option>)}</select></label>;
}

export function ProjectFaq({ items }) {
  return <section id="faq" className="section project-faq"><div className="container"><div className="project-section-heading"><p className="project-kicker">Notes</p><h2>How it behaves.</h2></div><div className="faq-grid">{items.map((item, index) => <article className="pastel-card" key={item}><h3>{index + 1}</h3><p>{item}</p></article>)}</div></div></section>;
}

export function DeckPreview() {
  return <div className="preview-window"><div className="preview-window-bar"><span /><span /><span /></div><div className="preview-paper"><div className="preview-paper-title">Quiz deck generated</div><div className="preview-question-row"><span>1</span><p>Multiple choice with answer slide.</p></div><div className="preview-question-row"><span>2</span><p>Code fill and explanation.</p></div></div></div>;
}

export function PaperPreview() {
  return <div className="preview-window"><div className="preview-window-bar"><span /><span /><span /></div><div className="preview-paper"><div className="preview-paper-title">Mathematics mock paper</div><div className="preview-paper-line long" /><div className="preview-question-row"><span>1</span><p>Explain the pattern.</p></div><div className="preview-answer-key">Answer key included</div></div></div>;
}

export function ChatPreview() {
  return <div className="preview-window chat-preview"><div className="preview-window-bar"><span /><span /><span /></div><div className="preview-chat-row assistant">Upload received.</div><div className="preview-chat-row user">Summarize the key concepts.</div><div className="preview-chat-row assistant wide">Here are the three main ideas.</div><div className="preview-input-bar">Type your question...</div></div>;
}

export function CodePreview() {
  return <div className="preview-window code-preview"><div className="preview-window-bar"><span /><span /><span /></div><pre><code>{`function score(answer) {\n  return answer === expected;\n}`}</code></pre><div className="preview-option is-selected">JavaScript</div><div className="preview-progress"><span style={{ width: "62%" }} /></div></div>;
}

function SiteFooter() {
  return <footer className="site-footer footer-section bg-dark text-light py-4"><div className="container text-center"><small>&copy; 2026 Mervin Ng. All rights reserved.</small></div></footer>;
}

// ?api= points a tool at another backend while developing; production always uses its own
export function getApiBase(defaultBase) {
  return (import.meta.env.DEV && new URLSearchParams(window.location.search).get("api")) || defaultBase;
}
