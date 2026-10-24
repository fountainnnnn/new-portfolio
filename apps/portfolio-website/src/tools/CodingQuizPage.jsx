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

export default function CodingQuizPage() {
  const [setup, setSetup] = useState({ language: "javascript", topic: "mixed", difficulty: "mixed", n: 5 });
  const [quiz, setQuiz] = useState({ phase: "setup", sessionId: "", questions: [], index: 0, score: 0, feedback: null, wrong: new Set(), pending: false });
  const [status, setStatus] = useState({});
  const [blankAnswers, setBlankAnswers] = useState([]);
  const [order, setOrder] = useState([]);
  const baseUrl = getApiBase("/api/coding-quiz");
  const start = async () => {
    setQuiz((q) => ({ ...q, phase: "loading" }));
    setStatus({});
    try {
      const res = await fetch(`${baseUrl}/generate_questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(setup) });
      const data = await res.json();
      if (!res.ok || data.status !== "ok" || !Array.isArray(data.questions) || data.questions.length === 0) throw new Error(data.detail || data.message || "Failed to load questions");
      setQuiz({ phase: "quiz", sessionId: data.session_id, questions: data.questions, index: 0, score: 0, feedback: null, wrong: new Set(), pending: false });
    } catch (error) {
      setQuiz((q) => ({ ...q, phase: "setup" }));
      setStatus({ type: "danger", message: error.message });
    }
  };
  const current = quiz.questions[quiz.index];
  const submitAnswer = async (answer, key = String(answer)) => {
    if (quiz.pending || quiz.feedback?.correct) return;
    setQuiz((q) => ({ ...q, pending: true }));
    try {
      const res = await fetch(`${baseUrl}/check_answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: quiz.sessionId, question_id: current.question_id, user_answer: answer, language: setup.language }) });
      const data = await res.json();
      if (!res.ok || data.status !== "ok") throw new Error(data.detail || data.message || "Answer check failed");
      setQuiz((q) => {
        const wrong = new Set(q.wrong);
        if (!data.correct) wrong.add(key);
        return { ...q, pending: false, score: data.correct && wrong.size === 0 ? q.score + 1 : q.score, feedback: { correct: data.correct, explanation: data.explanation || "" }, wrong };
      });
    } catch (error) {
      setQuiz((q) => ({ ...q, pending: false, feedback: { correct: false, explanation: error.message } }));
    }
  };
  const next = () => {
    if (quiz.index + 1 >= quiz.questions.length) {
      setQuiz((q) => ({ ...q, phase: "result" }));
      return;
    }
    setQuiz((q) => ({ ...q, index: q.index + 1, feedback: null, wrong: new Set(), pending: false }));
    setBlankAnswers([]);
    setOrder([]);
  };
  return (
    <ProjectShell bodyClass="project-coding-quiz" kicker="Coding practice" title="AI Generated Coding Quiz" lede="Generate focused coding quizzes across languages, topics, and difficulty levels." cta={{ href: "#quiz", label: "Start setup" }} preview={<CodePreview />}>
      <section id="quiz" className="quiz-section section project-workspace"><div className="container"><div className="project-section-heading"><p className="project-kicker">Quiz setup</p><h2>Tune the challenge.</h2><p>Choose a language, topic, difficulty, and question count before generation.</p></div>
        <div className="quiz-wrapper">
          {quiz.phase === "setup" && <div className="quiz-card project-form-card"><div className="tool-card-heading"><div><p className="project-kicker">Session controls</p><h1>Start your quiz</h1></div><span className="tool-status-pill">Live generated</span></div><Select label="Choose language" value={setup.language} onChange={(language) => setSetup({ ...setup, language })} options={["javascript", "python", "cpp"]} /><Select label="Choose topic" value={setup.topic} onChange={(topic) => setSetup({ ...setup, topic })} options={["mixed", "loops", "arrays", "functions", "conditionals", "objects", "classes"]} /><Select label="Difficulty" value={setup.difficulty} onChange={(difficulty) => setSetup({ ...setup, difficulty })} options={["easy", "mixed", "hard"]} /><label>Number of questions: {setup.n}<input className="input-range" type="range" min="5" max="30" value={setup.n} onChange={(e) => setSetup({ ...setup, n: Number(e.target.value) })} /></label><StatusAlert status={status} /><button className="btn btn-accent mt-2" onClick={start}>Start quiz</button></div>}
          {quiz.phase === "loading" && <div className="quiz-card text-center"><Loader2 className="spin" /><h2>Generating quiz...</h2></div>}
          {quiz.phase === "quiz" && current && <div className="quiz-card"><div className="quiz-stagebar"><span>Answer carefully</span><span>Wrong choices stay marked</span></div><h2>Q{quiz.index + 1}/{quiz.questions.length}: {current.question}</h2><QuestionRenderer question={current} wrong={quiz.wrong} feedback={quiz.feedback} pending={quiz.pending} blankAnswers={blankAnswers} setBlankAnswers={setBlankAnswers} order={order} setOrder={setOrder} submitAnswer={submitAnswer} /><FeedbackPanel feedback={quiz.feedback} />{quiz.feedback?.correct && <button className="btn btn-accent mt-3" onClick={next}>{quiz.index + 1 >= quiz.questions.length ? "Show results" : "Next Question"}</button>}</div>}
          {quiz.phase === "result" && <div className="quiz-card"><h2>Quiz complete</h2><p>You scored {quiz.score} out of {quiz.questions.length}.</p><button className="btn btn-accent" onClick={() => setQuiz({ phase: "setup", sessionId: "", questions: [], index: 0, score: 0, feedback: null, wrong: new Set(), pending: false })}>Restart quiz</button></div>}
        </div>
      </div></section>
      <ProjectFaq items={["Questions can be MCQ, fill-code, or drag-order style.", "Wrong answers remain marked while you retry.", "Only first-try correct answers count toward score."]} />
    </ProjectShell>
  );
}
