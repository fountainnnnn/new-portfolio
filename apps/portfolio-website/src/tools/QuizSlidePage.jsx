import React, { useEffect, useRef, useState } from "react";
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
import { ProjectShell, StatusAlert, ProgressBar, useFakeProgress, QuestionRenderer, FeedbackPanel, Select, ProjectFaq, DeckPreview, PaperPreview, ChatPreview, CodePreview, getApiBase } from "./shell.jsx";

export default function QuizSlidePage() {
  const [form, setForm] = useState({ total: 20, mixMode: "auto", difficulty: "mixed", includeExplanations: true, apiKey: "", mcq: 10, theory: 6, codefill: 4, fillblank: 0 });
  const [status, setStatus] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [download, setDownload] = useState(null);
  const progress = useFakeProgress(submitting);
  const baseUrl = getApiBase("/api/quiz-slide-generator");

  const submit = async (event) => {
    event.preventDefault();
    setDownload(null);
    const fileInput = event.currentTarget.elements.file;
    const file = fileInput.files?.[0];
    if (!file) {
      setStatus({ type: "warning", message: "Please choose a file." });
      return;
    }
    if (form.mixMode === "custom" && form.mcq + form.theory + form.codefill + form.fillblank !== Number(form.total)) {
      setStatus({ type: "warning", message: "Custom question counts must add up to the total." });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("total_questions", String(form.total));
    fd.append("mix_mode", form.mixMode);
    fd.append("difficulty", form.difficulty);
    fd.append("include_explanations", String(form.includeExplanations));
    fd.append("include_thumbs", String(form.includeExplanations));
    if (form.mixMode === "custom") {
      fd.append("mcq_n", String(form.mcq));
      fd.append("theory_n", String(form.theory));
      fd.append("codefill_n", String(form.codefill));
      fd.append("fillblank_n", String(form.fillblank));
    }
    if (form.apiKey) fd.append("openai_api_key", form.apiKey);
    setSubmitting(true);
    setStatus({ type: "info", message: "Uploading and generating..." });
    try {
      const res = await fetch(`${baseUrl}/generate`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.status !== "ok") throw new Error(data.detail || data.message || "Generation failed");
      setDownload({ url: data.url, filename: data.filename || "quiz-deck.pptx" });
      setStatus({ type: "success", message: "Done. Your deck is ready." });
    } catch (error) {
      setStatus({ type: "danger", message: `Error: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProjectShell bodyClass="project-quiz-slide" kicker="AI study tool" title="Quiz Slide Generator" lede="Upload notes or slides and generate a structured quiz deck with answer slides." cta={{ href: "#generate", label: "Open generator" }} preview={<DeckPreview />}>
      <section id="generate" className="section project-workspace">
        <div className="container">
          <div className="project-section-heading"><p className="project-kicker">Generator</p><h2>Build a quiz deck.</h2><p>Choose a source file, question mix, and difficulty before the backend produces a PPTX.</p></div>
          <form id="gen-form" className="card pastel-card project-form-card mx-auto" onSubmit={submit}>
            <div className="card-body">
              <div className="tool-card-heading"><div><p className="project-kicker">Source file</p><h3>Generation controls</h3></div><span className="tool-status-pill"><Upload size={16} /> PPTX output</span></div>
              <label className="form-label">Upload slides or PDF<input className="form-control" type="file" name="file" accept=".pdf,.pptx" required /></label>
              <label className="form-label">Total questions: {form.total}<input className="form-range" type="range" min="1" max="50" value={form.total} onChange={(e) => setForm({ ...form, total: Number(e.target.value) })} /></label>
              <div className="segmented-row">
                {["auto", "balanced", "custom"].map((mode) => <button type="button" className={form.mixMode === mode ? "is-active" : ""} onClick={() => setForm({ ...form, mixMode: mode })} key={mode}>{mode}</button>)}
              </div>
              {form.mixMode === "custom" && <div className="custom-grid">
                {["mcq", "theory", "codefill", "fillblank"].map((key) => <label key={key}>{key}<input className="form-control" type="number" min="0" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}
                <p className="custom-sum">Sum: {form.mcq + form.theory + form.codefill + form.fillblank} / {form.total}</p>
              </div>}
              <label className="form-label">Difficulty<select className="form-select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="mixed">Mixed</option></select></label>
              <label className="form-check"><input className="form-check-input" type="checkbox" checked={form.includeExplanations} onChange={(e) => setForm({ ...form, includeExplanations: e.target.checked })} /> Include explanations</label>
              <label className="form-label">DeepSeek API key (optional)<input className="form-control" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Leave empty to use backend .env" /></label>
              <ProgressBar progress={progress} active={submitting} />
              <StatusAlert status={status} />
              <div className="project-action-row">
                <button className="btn btn-accent" disabled={submitting}>{submitting ? "Generating..." : "Generate deck"}</button>
                {download && <a className="btn btn-outline-accent" href={download.url} download={download.filename}>Download PPTX</a>}
              </div>
            </div>
          </form>
        </div>
      </section>
      <ProjectFaq items={["PDF and PPTX files work best when the source text is clear.", "Custom mode lets you split the deck across question types.", "Important generated study material should still be reviewed."]} />
    </ProjectShell>
  );
}
