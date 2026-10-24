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

export default function FileChatPage() {
  const [state, setState] = useState({ apiKey: "", sessionId: "", status: {}, messages: [{ role: "assistant", text: "Upload a document to begin." }], question: "", uploading: false, asking: false });
  const baseUrl = getApiBase("/api/file-chat-assistant");
  const upload = async (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files?.[0];
    if (!file) {
      setState((s) => ({ ...s, status: { type: "warning", message: "Please choose a document." } }));
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    if (state.apiKey) fd.append("openai_api_key", state.apiKey);
    setState((s) => ({ ...s, uploading: true, sessionId: "", status: { type: "info", message: "Uploading document..." } }));
    try {
      const res = await fetch(`${baseUrl}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.session_id) throw new Error(data.detail || data.message || "Upload failed");
      setState((s) => ({ ...s, uploading: false, sessionId: data.session_id, status: { type: "success", message: "Document ready. Ask a question." }, messages: [{ role: "assistant", text: "Upload received. Ask anything from the document." }] }));
    } catch (error) {
      setState((s) => ({ ...s, uploading: false, status: { type: "danger", message: error.message } }));
    }
  };
  const ask = async (event) => {
    event.preventDefault();
    const question = state.question.trim();
    if (!question || !state.sessionId) return;
    const fd = new FormData();
    fd.append("session_id", state.sessionId);
    fd.append("question", question);
    setState((s) => ({ ...s, asking: true, question: "", messages: [...s.messages, { role: "user", text: question }] }));
    try {
      const res = await fetch(`${baseUrl}/ask`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.answer) throw new Error(data.detail || data.message || "Question failed");
      setState((s) => ({ ...s, asking: false, messages: [...s.messages, { role: "assistant", text: data.answer }] }));
    } catch (error) {
      setState((s) => ({ ...s, asking: false, messages: [...s.messages, { role: "assistant", text: `Error: ${error.message}` }] }));
    }
  };
  return (
    <ProjectShell bodyClass="project-file-chat" kicker="Document assistant" title="Document Q&A Chat Assistant" lede="Upload a PDF, DOCX, or TXT file and ask questions against the document." cta={{ href: "#qa", label: "Open assistant" }} preview={<ChatPreview />}>
      <section id="qa" className="section project-workspace"><div className="container"><div className="project-section-heading"><p className="project-kicker">Workspace</p><h2>Upload. Ask. Refine.</h2><p>The upload flow and chat stay together so context is always close.</p></div>
        <div className="project-chat-grid"><form className="card pastel-card project-form-card" onSubmit={upload}><div className="card-body"><div className="tool-card-heading"><div><p className="project-kicker">Source file</p><h3>Upload document</h3></div><span className="tool-status-pill">Private session</span></div><label className="form-label">Choose file<input className="form-control" type="file" name="file" accept=".pdf,.docx,.txt" required /></label><label className="form-label">DeepSeek API key<input className="form-control" type="password" value={state.apiKey} onChange={(e) => setState({ ...state, apiKey: e.target.value })} placeholder="Leave empty to use backend .env" /></label><StatusAlert status={state.status} /><button className="btn btn-accent" disabled={state.uploading}>{state.uploading ? "Uploading..." : "Upload and start"}</button></div></form>
        <div className="card pastel-card project-chat-card"><div className="card-body p-0 d-flex flex-column"><div className="chat-toolbar"><div><p className="project-kicker mb-1">Conversation</p><h3>Chat with your document</h3></div></div><div className="messages flex-grow-1 p-3">{state.messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{state.asking && <div className="message assistant"><div className="bubble">Thinking...</div></div>}</div><form className="d-flex gap-2 p-3 border-top" onSubmit={ask}><input className="form-control" value={state.question} onChange={(e) => setState({ ...state, question: e.target.value })} placeholder="Type your question..." disabled={!state.sessionId || state.asking} /><button className="btn btn-accent" disabled={!state.sessionId || state.asking}>Send</button></form></div></div></div>
      </div></section>
      <ProjectFaq items={["PDF, DOCX, and TXT files are supported.", "You can ask follow-up questions after upload.", "Review important answers even when grounded in the document."]} />
    </ProjectShell>
  );
}
