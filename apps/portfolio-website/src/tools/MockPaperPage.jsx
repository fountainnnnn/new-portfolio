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

export default function MockPaperPage() {
  const [state, setState] = useState({ numMocks: 1, difficulty: "same", apiKey: "", status: {}, submitting: false, downloadUrl: "" });
  const progress = useFakeProgress(state.submitting, 95);
  const baseUrl = getApiBase("/api/mock-paper-generator");
  const submit = (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files?.[0];
    if (!file) {
      setState((s) => ({ ...s, status: { type: "warning", message: "Please choose a file." } }));
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("num_mocks", String(state.numMocks));
    fd.append("difficulty", state.difficulty);
    fd.append("language", "en");
    if (state.apiKey) fd.append("openai_api_key", state.apiKey);
    const xhr = new XMLHttpRequest();
    setState((s) => ({ ...s, submitting: true, status: { type: "info", message: "Uploading and generating papers..." }, downloadUrl: "" }));
    xhr.open("POST", `${baseUrl}/generate`);
    xhr.responseType = "blob";
    xhr.timeout = 300000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const url = URL.createObjectURL(xhr.response);
        setState((s) => ({ ...s, submitting: false, downloadUrl: url, status: { type: "success", message: "Done. Your ZIP is ready." } }));
      } else {
        setState((s) => ({ ...s, submitting: false, status: { type: "danger", message: `Generation failed (${xhr.status}).` } }));
      }
    };
    xhr.onerror = () => setState((s) => ({ ...s, submitting: false, status: { type: "danger", message: "Network error while generating papers." } }));
    xhr.ontimeout = () => setState((s) => ({ ...s, submitting: false, status: { type: "danger", message: "Generation timed out." } }));
    xhr.send(fd);
  };
  return (
    <ProjectShell bodyClass="project-mock-paper" kicker="AI exam workflow" title="Mock Paper Generator" lede="Generate formatted mock exam papers and answer keys from study materials." cta={{ href: "#generate", label: "Open generator" }} preview={<PaperPreview />}>
      <section id="generate" className="section project-workspace"><div className="container"><div className="project-section-heading"><p className="project-kicker">Generator</p><h2>Create practice papers.</h2><p>Choose a source paper, number of mocks, and difficulty target.</p></div>
        <form className="card pastel-card project-form-card mx-auto" onSubmit={submit}><div className="card-body">
          <div className="tool-card-heading"><div><p className="project-kicker">Paper builder</p><h3>Generation controls</h3></div><span className="tool-status-pill">ZIP output</span></div>
          <label className="form-label">Upload exam paper<input className="form-control" type="file" name="file" accept=".pdf,.docx" required /></label>
          <label className="form-label">Number of new mocks<input className="form-control" type="number" min="1" max="3" value={state.numMocks} onChange={(e) => setState({ ...state, numMocks: Number(e.target.value) })} /></label>
          <label className="form-label">Difficulty<select className="form-select" value={state.difficulty} onChange={(e) => setState({ ...state, difficulty: e.target.value })}><option value="easy">Easy</option><option value="same">Same</option><option value="harder">Harder</option></select></label>
          <label className="form-label">DeepSeek API key<input className="form-control" type="password" value={state.apiKey} onChange={(e) => setState({ ...state, apiKey: e.target.value })} placeholder="Leave empty to use backend .env" /></label>
          <ProgressBar progress={progress} active={state.submitting} /><StatusAlert status={state.status} />
          <div className="project-action-row"><button className="btn btn-accent" disabled={state.submitting}>{state.submitting ? "Generating..." : "Generate papers"}</button>{state.downloadUrl && <a className="btn btn-outline-accent" href={state.downloadUrl} download="mockpapers.zip">Download ZIP</a>}</div>
        </div></form></div></section>
      <ProjectFaq items={["PDF and DOCX files with clear question structure work best.", "The max is kept low because paper generation is heavier.", "You can edit the generated PDFs after download."]} />
    </ProjectShell>
  );
}
