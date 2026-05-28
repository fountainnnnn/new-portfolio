import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import "./styles.css";

const cdn = {
  devicon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons",
  simple: "https://cdn.simpleicons.org",
};

const navItems = [
  { label: "About", href: "/#about", section: "about" },
  { label: "Projects", href: "/projects.html", section: "projects" },
  { label: "Skills", href: "/#skills", section: "skills" },
  { label: "Certifications", href: "/certificates.html", section: "certifications" },
  { label: "Contact", href: "/#contact", section: "contact", cta: true },
];

const stackLogos = {
  Python: `${cdn.devicon}/python/python-original.svg`,
  JavaScript: `${cdn.devicon}/javascript/javascript-original.svg`,
  TypeScript: `${cdn.devicon}/typescript/typescript-original.svg`,
  React: `${cdn.devicon}/react/react-original.svg`,
  "Next.js": `${cdn.devicon}/nextjs/nextjs-original.svg`,
  Node: `${cdn.devicon}/nodejs/nodejs-original.svg`,
  "Node.js": `${cdn.devicon}/nodejs/nodejs-original.svg`,
  FastAPI: `${cdn.simple}/fastapi/009688`,
  Flask: `${cdn.simple}/flask/111827`,
  Docker: `${cdn.devicon}/docker/docker-original.svg`,
  Plotly: `${cdn.simple}/plotly/3F4F75`,
  PyTorch: `${cdn.devicon}/pytorch/pytorch-original.svg`,
  TensorFlow: `${cdn.devicon}/tensorflow/tensorflow-original.svg`,
  Pandas: `${cdn.devicon}/pandas/pandas-original.svg`,
  NumPy: `${cdn.devicon}/numpy/numpy-original.svg`,
  "Scikit-learn": `${cdn.simple}/scikitlearn/F7931E`,
  MySQL: `${cdn.devicon}/mysql/mysql-original.svg`,
  Bootstrap: `${cdn.devicon}/bootstrap/bootstrap-original.svg`,
  HTML5: `${cdn.devicon}/html5/html5-original.svg`,
  CSS3: `${cdn.devicon}/css3/css3-original.svg`,
  Vite: `${cdn.simple}/vite/646CFF`,
  Telegram: `${cdn.simple}/telegram/6B7280`,
  GSAP: "/img/issuer-logos/gsap.svg",
  Lenis: "",
  OpenClaw: "/img/issuer-logos/openclaw-mark.png",
  Playwright: "/img/issuer-logos/playwright.svg",
  n8n: "/img/issuer-logos/n8n.svg",
  Claude: "/img/issuer-logos/claude.svg",
  Caddy: "/img/issuer-logos/caddy.svg",
};

const featuredProjects = [
  {
    title: "Decidr Auto Dashboard",
    category: "Hackathon product",
    kind: "Demo",
    href: "/auto-dashboard",
    image: "/img/project-previews/auto-dashboard.png",
    description: "Profiles CSV data and turns natural-language prompts into interactive dashboard charts.",
    stack: ["Next.js", "Python", "Plotly"],
  },
  {
    title: "GrowthLab News",
    category: "OpenClaw hackathon build",
    kind: "GitHub",
    href: "https://github.com/fountainnnnn/growthlab-news",
    image: "/img/project-previews/growthlab-news.png",
    description: "OpenClaw-integrated agent workflow that monitors SEA startup news, scores relevance, and automates digest delivery.",
    stack: ["React", "Node.js", "OpenClaw", "Agents"],
  },
  {
    title: "AgentLabs LoRA Lab",
    category: "Hackathon lab",
    kind: "GitHub",
    href: "https://github.com/fountainnnnn/AgentLabs",
    image: "/img/project-previews/agentlabs.png",
    description: "Workbench for LoRA training experiments, adapter simulation, and evaluation workflows.",
    stack: ["React", "Python", "LoRA"],
  },
];

const projectGroups = [
  {
    eyebrow: "Personal / Hackathon Projects",
    title: "Larger builds with a real project brief",
    description: "Hackathon work, personal ML experiments, and shipped builds with a stronger project brief.",
    projects: [
      ...featuredProjects,
      project("Covid CNN", "Personal ML", "GitHub", "https://github.com/fountainnnnn/Covid-CNN", "/img/project-previews/covid-cnn.png", "Builds a from-scratch PyTorch CNN for classifying radiography images across four dataset classes.", ["Python", "PyTorch", "Notebook"]),
      project("Trading Bot", "AI agent automation", "GitHub", "https://github.com/fountainnnnn/trading-bot", "/img/project-previews/trading-bot.png", "OpenClaw-powered agent workflow that automates market checks, risk decisions, trade journaling, and backtest loops.", ["React", "Node.js", "Python", "OpenClaw"]),
      project("Luma Yuzu Scroll Site", "GSAP design website", "Demo", "/luma-yuzu-scroll-site/", "/img/project-previews/luma-yuzu-scroll-site.png", "Premium sparkling yuzu tea product page with scroll-led campaign sections, can reveals, and Lenis motion.", ["TypeScript", "GSAP", "Lenis", "Vite"]),
      project("PetaniAI", "GSAP design website", "Demo", "/petaniAI/", "/img/project-previews/petani-ai.png", "Remade version of petaniai.com using my GSAP design direction, pixel-field storytelling, and smooth scroll scenes.", ["React", "TypeScript", "GSAP", "Lenis"]),
      project("Telegram Reminder Bot", "AI automation bot", "Showcase", "/telegram-reminder-bot/", "/img/project-previews/telegram-reminder-bot.png", "Telegram task assistant that parses natural-language reminders, schedules follow-ups, and stores tasks in SQLite.", ["TypeScript", "Node.js", "Telegram", "Docker"]),
      project("OpenClaw VPS Bot", "OpenClaw showcase", "Showcase", "/openclaw-vps-bot/", "/img/project-previews/openclaw-vps-bot.png", "24/7 autonomous OpenClaw workflow with cron jobs, VPS checks, and Telegram command traces. Repo withheld for security reasons.", ["OpenClaw", "Telegram", "VPS", "Automation"]),
    ],
  },
  {
    eyebrow: "Experimental Learning Projects",
    title: "Small apps built to test real AI workflows",
    description: "The experimental apps are now React routes backed by the same FastAPI services.",
    projects: [
      project("Quiz Slide Deck Generator", "AI study tool", "Demo", "/quiz-slide-generator/", "/img/project-previews/quiz-slide-generator.png", "Transforms PDFs and slide decks into editable quiz presentations with answer slides.", ["Python", "FastAPI", "OpenAI"]),
      project("Mock Paper Generator", "Exam workflow", "Demo", "/mock-paper-generator/", "/img/project-previews/mock-paper-generator.png", "Builds new practice papers and answer materials from uploaded source documents.", ["Python", "FastAPI", "ReportLab"]),
      project("Document Q&A Chat Assistant", "Document assistant", "Demo", "/file-chat-assistant/", "/img/project-previews/file-chat-assistant.png", "Uploads PDF, DOCX, or TXT files and answers questions through a focused chat surface.", ["Python", "LangChain", "OpenAI"]),
      project("Coding Quiz", "Coding practice", "Demo", "/coding-quiz/", "/img/project-previews/coding-quiz.png", "Generates language-specific coding quizzes with topic controls and instant feedback.", ["React", "Python", "FastAPI"]),
    ],
  },
  {
    eyebrow: "School Projects",
    title: "Coursework converted into portfolio viewers",
    description: "School work sits lower on the page, with demos or modal viewers depending on the artifact.",
    projects: [
      artifactProject("CNN Computer Vision Paper", "Research paper", "/school-projects/artifacts/dele-ca2/paper/dele-ca2-part-c-paper-viewer.html", "/img/project-previews/school-dele-ca2-paper.png", "Technical paper on CNN foundations, architectural advances, and real-world computer vision applications.", ["Python", "CNN", "Paper"], [
        file("Research Paper", "CNN Computer Vision Paper", "/school-projects/artifacts/dele-ca2/paper/dele-ca2-part-c-paper-viewer.html"),
        file("Notebook Export", "CNN Computer Vision Notebook", "/school-projects/artifacts/dele-ca2/paper/dele-ca2-part-c.html"),
      ]),
      artifactProject("DQN Pendulum Agent", "Reinforcement learning", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-b.html", "/img/project-previews/school-dele-ca2-dqn.png", "DQN Pendulum experiment covering reinforcement learning setup, agent training, and evaluation workflow.", ["Python", "DQN", "Slides"], [
        file("Notebook Export", "DQN Pendulum Agent Notebook", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-b.html"),
        file("Slides", "DQN Pendulum Agent Slides", "/school-projects/artifacts/dele-ca2/slides/dqn-pendulum-agent-slides.html"),
      ]),
      artifactProject("GAN Image Generator", "Generative AI", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-a.html", "/img/project-previews/school-dele-ca2-gan.png", "GAN image-generation notebook with generated samples, architecture diagrams, and presentation slides.", ["Python", "TensorFlow", "GAN"], [
        file("Notebook Export", "GAN Image Generator Notebook", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-a.html"),
        file("Slides", "GAN Image Generator Slides", "/school-projects/artifacts/dele-ca2/slides/gan-image-generator-slides.html"),
        file("Generated Images", "GAN Generated Image Samples", "/school-projects/artifacts/dele-ca2/assets/dele-ca2-generated-images.png", "image"),
      ]),
      artifactProject("Vegetable CNN & House Price RNN", "Deep learning", "/school-projects/artifacts/dele-ca1/notebooks/dele-ca1-part-a.html", "/img/project-previews/school-dele-ca1.png", "Two deep-learning notebooks covering vegetable image classification, house price forecasting, model tuning, and slide decks.", ["Python", "TensorFlow", "CNN/RNN"], [
        file("Vegetable Notebook", "Vegetable CNN Classifier Notebook", "/school-projects/artifacts/dele-ca1/notebooks/dele-ca1-part-a.html"),
        file("Vegetable Slides", "Vegetable CNN Classifier Slides", "/school-projects/artifacts/dele-ca1/slides/dele-ca1-part-a-viewer.html"),
        file("House Price Notebook", "House Price RNN Forecast Notebook", "/school-projects/artifacts/dele-ca1/notebooks/dele-ca1-part-b.html"),
        file("House Price Slides", "House Price RNN Forecast Slides", "/school-projects/artifacts/dele-ca1/slides/dele-ca1-part-b-viewer.html"),
      ]),
      project("VeggieAI Classifier", "Image classifier", "Demo", "/school-veggie-ai-ca2/", "/img/project-previews/school-veggie-ai-ca2.png", "Flask app for vegetable image classification with model-service integration, auth, chat, and report exports.", ["Python", "CNN", "Docker"]),
      project("HDB Resale Price Predictor", "Prediction app", "Demo", "/school-hdb-resale-ca1/", "/img/project-previews/school-hdb-resale-ca1.png", "Flask deployment project for Singapore HDB resale predictions, user accounts, and model-backed insights.", ["Python", "Flask", "Docker"]),
      artifactProject("HDB Flat Selection Dashboard", "Tableau report", "/school-projects/artifacts/data-visualization-ca1/slides/data-visualization-ca1-slides.pdf", "/img/project-previews/school-data-viz-ca1.png", "Slide report for a strategic HDB flat selection dashboard and visual analysis workflow.", ["Slides", "Tableau", "HDB"], [
        file("Slide Deck", "HDB Flat Selection Dashboard Slides", "/school-projects/artifacts/data-visualization-ca1/slides/data-visualization-ca1-slides.pdf"),
        file("Preview Slide", "HDB Flat Selection Dashboard Preview", "/school-projects/artifacts/data-visualization-ca1/slides/data-visualization-ca1-slides-png/data-visualization-ca1-slides-slide-02.png", "image"),
      ]),
      artifactProject("Prestige Mall Customer Dashboard", "Power BI report", "/school-projects/artifacts/data-fundamentals-ca2/powerbi/data-fundamentals-ca2-report-page.png", "/img/project-previews/school-df-ca2.png", "Power BI report export showing mall customer profiles, utility consumption, and individual insights.", ["Power BI", "Data model", "Visuals"], [
        file("Report Image", "Prestige Mall Customer Dashboard", "/school-projects/artifacts/data-fundamentals-ca2/powerbi/data-fundamentals-ca2-report-page.png", "image"),
      ]),
      artifactProject("Energy Forecasting & Customer Segmentation", "Forecasting + clustering", "/school-projects/artifacts/aiml-ca2/notebooks/aiml-ca2-part-a.html", "/img/project-previews/school-aiml-ca2.png", "Energy consumption forecasting and customer segmentation notebooks with exported slide decks.", ["Python", "Pandas", "NumPy"], [
        file("Forecast Notebook", "Energy Forecasting Notebook", "/school-projects/artifacts/aiml-ca2/notebooks/aiml-ca2-part-a.html"),
        file("Forecast Slides", "Energy Forecasting Slides", "/school-projects/artifacts/aiml-ca2/slides/aiml-ca2-part-a.pdf"),
        file("Segmentation Notebook", "Customer Segmentation Notebook", "/school-projects/artifacts/aiml-ca2/notebooks/aiml-ca2-part-b.html"),
        file("Segmentation Slides", "Customer Segmentation Slides", "/school-projects/artifacts/aiml-ca2/slides/aiml-ca2-part-b.pdf"),
      ]),
      artifactProject("Factory Status & Housing Price Models", "Model workflow", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-a.html", "/img/project-previews/school-aiml-ca1.png", "Notebook and slide viewer for factory machine status classification and housing price regression workflows.", ["Python", "Jupyter", "Scikit-learn"], [
        file("Factory Notebook", "Factory Status Classifier Notebook", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-a.html"),
        file("Factory Slides", "Factory Status Classifier Slides", "/school-projects/artifacts/aiml-ca1/slides/aiml-ca1-part-a.pdf"),
        file("Housing Notebook", "Housing Price Regression Notebook", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-b.html"),
        file("Housing Slides", "Housing Price Regression Slides", "/school-projects/artifacts/aiml-ca1/slides/aiml-ca1-part-b.pdf"),
      ]),
      project("SP 70th Anniversary Website", "Frontend website", "Demo", "/fed-ca2/", "/img/project-previews/school-fed-ca2.png", "Multi-page Bootstrap website with a feedback form, anniversary timeline, and hosted media.", ["HTML5", "CSS3", "Bootstrap"]),
    ],
  },
];

const skills = [
  ["Python", stackLogos.Python], ["JavaScript", stackLogos.JavaScript], ["TypeScript", stackLogos.TypeScript], ["React", stackLogos.React], ["Next.js", stackLogos["Next.js"]],
  ["HTML5", stackLogos.HTML5], ["CSS3", stackLogos.CSS3], ["Tailwind CSS", `${cdn.simple}/tailwindcss/38BDF8`], ["FastAPI", stackLogos.FastAPI], ["PyTorch", stackLogos.PyTorch],
  ["TensorFlow", stackLogos.TensorFlow], ["Pandas", stackLogos.Pandas], ["NumPy", stackLogos.NumPy], ["Scikit-learn", stackLogos["Scikit-learn"]], ["Matplotlib", `${cdn.simple}/python/3776AB`],
  ["Plotly", stackLogos.Plotly], ["MySQL", stackLogos.MySQL], ["Bootstrap", stackLogos.Bootstrap], ["Node.js", stackLogos["Node.js"]], ["Express", `${cdn.simple}/express/111827`],
  ["SQLite", `${cdn.devicon}/sqlite/sqlite-original.svg`], ["Docker", stackLogos.Docker], ["Vercel", `${cdn.simple}/vercel/111827`], ["Cloud Services", `${cdn.simple}/icloud/38BDF8`], ["VPS Hosting", `${cdn.simple}/serverfault/4B5563`],
  ["Docker Compose", stackLogos.Docker], ["Caddy", stackLogos.Caddy], ["Telegram", stackLogos.Telegram], ["Telegraf", stackLogos.Telegram], ["Ollama", `${cdn.simple}/ollama/111827`],
  ["n8n", stackLogos.n8n], ["OpenClaw", stackLogos.OpenClaw], ["AI Agents", ""], ["AI Automation", ""], ["Codex", ""],
  ["Claude", stackLogos.Claude], ["OpenAI", ""], ["LangChain", `${cdn.simple}/langchain/1C3C3C`], ["Playwright", stackLogos.Playwright], ["GSAP", stackLogos.GSAP],
  ["Lenis", stackLogos.Lenis], ["shadcn/ui", "/img/issuer-logos/shadcnui.svg"], ["ReportLab", ""], ["OCR", ""], ["NLP", ""],
  ["Computer Vision", ""], ["LLM Fine-Tuning", ""], ["Google Cloud", `${cdn.devicon}/googlecloud/googlecloud-original.svg`], ["AWS", ""], ["Azure", `${cdn.devicon}/azure/azure-original.svg`],
  ["AppSheet", `${cdn.simple}/google/4285F4`], ["Hugging Face", `${cdn.simple}/huggingface/FFD21E`], ["Watson Studio", ""], ["RAG Systems", ""], ["Payment APIs", ""],
];

const certificates = [
  cert("IBM Artificial Intelligence Fundamentals", "IBM", "AI Foundations", "/certificates/IBM Artificial Intelligence Fundamentals.png"),
  cert("Introduction to Artificial Intelligence", "IBM", "AI Foundations", "/certificates/IBM Introduction to Artificial Intelligence.jpg"),
  cert("AI Ethics", "IBM", "AI Ethics", "/certificates/IBM AI Ethics.jpg"),
  cert("Machine Learning and Deep Learning", "IBM", "ML + Deep Learning", "/certificates/IBM Machine Learning and Deep Learning.jpg"),
  cert("Natural Language Processing and Computer Vision", "IBM", "NLP + Vision", "/certificates/IBM Natural Language Preprocessing and Computer Vision.jpg"),
  cert("Run AI Models with IBM Watson Studio", "IBM", "Watson Studio", "/certificates/IBM Run AI Models with IBM Watson Studio.jpg"),
  cert("AI Fundamentals: Language and Vision", "IBM", "Vision & Language", "/certificates/AIFundamentalsLanguageandVisioninAI_Badge20260505-31-yrjan8-1.png"),
  cert("Generative AI Concepts", "DataCamp", "Generative AI", "/certificates/Generative AI Concepts.jpg"),
  cert("Understanding ChatGPT", "DataCamp", "Generative AI", "/certificates/Understanding ChatGPT.jpg"),
  cert("Introduction to Deep Learning with Keras", "DataCamp", "Deep Learning", "/certificates/Intro to Deep Learning.jpg"),
  cert("Data Visualization with Plotly in Python", "DataCamp", "Data Visualization", "/certificates/Introduction to Data Visualization with Plotly in Python.jpg"),
  cert("NVIDIA Fundamentals of Deep Learning", "NVIDIA", "Deep Learning", "/certificates/NVIDIA Fundamentals of Deep Learning.jpg"),
  cert("Create Image Captioning Models", "Google Cloud", "Computer Vision", "/certificates/Create Image Captioning Models.png"),
  cert("Vector Search and Embeddings", "Google Cloud", "Retrieval", "/certificates/Vector Search and Embeddings.png"),
  cert("App Building with AppSheet", "Google Cloud", "App Building", "/certificates/App Building with AppSheet.png"),
  cert("AI Fundamentals", "Google", "AI Foundations", "/certificates/1778676499866.jpg"),
  cert("AI for Brainstorming and Planning", "Google", "Planning", "/certificates/1778676584161.jpg"),
  cert("AI for Research and Insights", "Google", "Research", "/certificates/1779255175780.jpg"),
  cert("AI for Writing and Communicating", "Google", "Communication", "/certificates/1779257220999.jpg"),
  cert("AI for Content Creation", "Google", "Content Creation", "/certificates/1779347470523.jpg"),
  cert("LLM Post Training: Unit 1", "Hugging Face", "LLMs", "/certificates/LoRA LLM Fine Tuning.jpg"),
  cert("AWS Academy Cloud Foundations", "AWS Academy", "Cloud", "/certificates/AWS Academy Graduate - AWS Academy Cloud Foundations.jpg"),
  cert("eNETS Web Integration", "NETS", "Payments", "/certificates/eNETS Web Integration.jpg"),
  cert("NETS QR Web Payment Integration", "NETS", "Payments", "/certificates/NETS QR Web Payment Integration.jpg"),
  cert("NETS QR Mobile Payment Integration", "NETS", "Payments", "/certificates/NETS QR Mobile Payment Integration.jpg"),
  cert("AI Trainer Certificate", "AI Singapore", "AI Training", "/certificates/AI Trainer Cert.jpg"),
  cert("AI for Good Train-the-Trainer Programme", "AI Singapore", "AI Training", "/certificates/AI for Good - Train the Trainer Programme.jpg"),
  cert("AI-Ready ASEAN Certificate", "AI Singapore", "AI Readiness", "/certificates/AI-READY-ASEAN_AI-READY-ASEAN_Ng-Yu-Hang.pdf", "/certificates/AI-READY-ASEAN_AI-READY-ASEAN_Ng-Yu-Hang.png"),
];

function project(title, category, kind, href, image, description, stack) {
  return { title, category, kind, href, image, description, stack };
}

function artifactProject(title, category, href, image, description, stack, artifacts) {
  return { ...project(title, category, "Viewer", href, image, description, stack), artifacts };
}

function file(label, title, src, type = "") {
  return { label, title, src, type };
}

function cert(title, issuer, category, href, preview = href) {
  return { title, issuer, category, href, preview };
}

function getRoute() {
  const path = window.location.pathname;
  if (path.endsWith("/projects.html")) return "projects";
  if (path.endsWith("/certificates.html")) return "certificates";
  if (path.startsWith("/quiz-slide-generator")) return "quiz-slide";
  if (path.startsWith("/mock-paper-generator")) return "mock-paper";
  if (path.startsWith("/file-chat-assistant")) return "file-chat";
  if (path.startsWith("/coding-quiz")) return "coding-quiz";
  return "home";
}

function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const titles = {
      home: "Mervin Ng | Portfolio",
      projects: "Projects | Mervin Ng",
      certificates: "Certifications | Mervin Ng",
      "quiz-slide": "Mervin Ng | Quiz Slide Generator",
      "mock-paper": "Mervin Ng | Mock Paper Generator",
      "file-chat": "Mervin Ng | Document Q&A Chat Assistant",
      "coding-quiz": "Mervin Ng | AI Generated Coding Quiz",
    };
    document.title = titles[route] || titles.home;
  }, [route]);

  if (route === "projects") return <ProjectsPage />;
  if (route === "certificates") return <CertificatesPage />;
  if (route === "quiz-slide") return <QuizSlidePage />;
  if (route === "mock-paper") return <MockPaperPage />;
  if (route === "file-chat") return <FileChatPage />;
  if (route === "coding-quiz") return <CodingQuizPage />;
  return <HomePage />;
}

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
        <div className={`collapse navbar-collapse justify-content-end ${open ? "show" : ""}`}>
          <ul className="navbar-nav nav-menu">
            {navItems.map((item) => (
              <li className="nav-item" key={item.label}>
                <a className={`nav-link ${item.cta ? "nav-link-cta" : ""}`} href={item.href} aria-current={active === item.section ? "page" : undefined} onClick={() => setOpen(false)}>
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

function HomePage() {
  return (
    <div className="portfolio-react">
      <SiteNav active="home" />
      <main>
        <section id="hero" className="section hero-section d-flex align-items-center">
          <div className="container hero-container">
            <div className="row align-items-center gx-5">
              <div className="col-lg-7">
                <p className="listing-kicker">Singapore, Singapore</p>
                <h1 className="display-4 fw-bold">Hi, I&apos;m Ng Yu Hang (Mervin)</h1>
                <p className="lead">Aspiring AI Full-stack Developer</p>
                <p className="text-muted mb-3 hero-copy">
                  I build AI-backed tools, automation workflows, and practical full-stack apps around documents, data, and agentic systems.
                </p>
                <div className="hero-actions">
                  <a href="#projects" className="btn btn-primary">My Projects <ArrowDown size={18} /></a>
                  <a href="/Resume.pdf" className="btn btn-outline-dark" download>Download CV <Download size={18} /></a>
                </div>
                <div className="social-row">
                  <a href="https://github.com/fountainnnnn" target="_blank" rel="noreferrer"><ExternalLink size={18} /> GitHub</a>
                  <a href="https://www.linkedin.com/in/ngyuhang/" target="_blank" rel="noreferrer">LinkedIn <ExternalLink size={16} /></a>
                </div>
              </div>
              <div className="col-lg-5">
                <img className="hero-portrait" src="/img/myself.png" alt="Ng Yu Hang portrait" />
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section bg-light">
          <div className="container about-container">
            <h2 className="section-title">About Me</h2>
            <p className="text-center">
              Hello, I&apos;m Yu Hang, though most people know me as Mervin. I&apos;m an 18-year-old Singapore Polytechnic Applied AI & Analytics student building AI tools, full-stack apps, and practical automations.
            </p>
          </div>
        </section>

        <section id="projects" className="section">
          <div className="container">
            <h2 className="section-title text-center">Projects</h2>
            <div className="projects-grid">
              {featuredProjects.map((item) => <ProjectCard key={item.title} item={item} />)}
            </div>
            <div className="text-center mt-4">
              <a className="btn btn-outline-dark" href="/projects.html">View all projects <ArrowRight size={18} /></a>
            </div>
          </div>
        </section>

        <SkillsSection />
        <HomeCertifications />
        <ContactSection />
      </main>
      <PortfolioChat />
      <SiteFooter />
    </div>
  );
}

function SkillsSection() {
  return (
    <section id="skills" className="section">
      <div className="container skills-container text-center">
        <h2 className="section-title">Skills</h2>
        <div className="skills-grid skills-grid-wide">
          {skills.map(([name, icon]) => (
            <div className="skill" key={name}>
              {icon ? <img src={icon} alt="" /> : <Sparkles size={40} />}
              <p>{name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeCertifications() {
  const [active, setActive] = useState(null);
  const featured = [
    "NVIDIA Fundamentals of Deep Learning",
    "AWS Academy Cloud Foundations",
    "LLM Post Training: Unit 1",
    "AI Fundamentals: Language and Vision",
    "AI Trainer Certificate",
    "IBM Artificial Intelligence Fundamentals",
  ];
  const cards = certificates.filter((item) => featured.includes(item.title));
  return (
    <section id="certifications" className="section certifications-section">
      <div className="container certifications-container">
        <div className="certifications-heading text-center">
          <h2 className="section-title">Certifications</h2>
          <p>Selected credentials across AI, cloud, LLMs, and more.</p>
        </div>
        <div className="listing-certifications-grid">
          {cards.map((item) => <CertificateCard key={item.title} item={item} onClick={() => setActive(item)} />)}
        </div>
        <div className="text-center mt-4">
          <a className="btn btn-outline-dark" href="/certificates.html">View all certificates <ArrowRight size={18} /></a>
        </div>
      </div>
      <CertificateModal item={active} onClose={() => setActive(null)} />
    </section>
  );
}

function ContactSection() {
  return (
    <div className="contact-footer-wrapper">
      <section id="contact" className="section">
        <div className="container text-center">
          <h2 className="section-title">Contact Me</h2>
          <form action="https://formspree.io/f/movkqvzo" method="POST" className="contact-form mx-auto">
            <label className="form-label text-start w-100">Your Name<input className="form-control" name="name" required /></label>
            <label className="form-label text-start w-100">Your Email<input className="form-control" type="email" name="email" required /></label>
            <label className="form-label text-start w-100">Message<textarea className="form-control" name="message" rows="5" required /></label>
            <button className="btn btn-primary" type="submit">Send Message <Send size={18} /></button>
          </form>
        </div>
      </section>
    </div>
  );
}

function ProjectsPage() {
  const [artifact, setArtifact] = useState(null);
  return (
    <div className="listing-page project-index-page">
      <SiteNav active="projects" />
      <main className="listing-main listing-page-reveal">
        <header className="listing-hero project-index-hero">
          <p className="listing-kicker">Selected work</p>
          <h1>Projects, experiments, and school builds.</h1>
          <p>A growing shelf of things I built while learning AI, analytics, full-stack development, and shipping under time pressure.</p>
          <div className="listing-actions">
            <a className="btn btn-outline-dark" href="/#projects"><ArrowLeft size={18} /> Main page</a>
            <a className="btn btn-outline-dark" href="/#contact">Contact <Send size={18} /></a>
          </div>
        </header>
        {projectGroups.map((group) => (
          <section className="listing-section project-index-section" key={group.title}>
            <div className="project-index-heading">
              <p className="listing-kicker">{group.eyebrow}</p>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className={`projects-grid listing-projects-grid ${group.eyebrow === "School Projects" ? "school-projects-grid" : ""}`}>
              {group.projects.map((item) => <ProjectCard key={item.title} item={item} onArtifact={setArtifact} />)}
            </div>
          </section>
        ))}
      </main>
      <ArtifactModal state={artifact} onClose={() => setArtifact(null)} />
      <SiteFooter />
    </div>
  );
}

function ProjectCard({ item, onArtifact }) {
  const external = /^https?:\/\//.test(item.href);
  const openArtifact = (event) => {
    if (!item.artifacts) return;
    event.preventDefault();
    onArtifact?.({ title: item.title, files: item.artifacts });
  };
  return (
    <a className="project-card" href={item.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} onClick={openArtifact}>
      <div className="project-card-thumb">
        <img src={item.image} alt={`${item.title} thumbnail preview`} loading="lazy" />
      </div>
      <div className="project-card-body">
        <div className="project-card-meta">
          <span className="project-card-label">{item.category}</span>
          <span className={`project-link-badge project-link-badge-${item.kind.toLowerCase() === "github" ? "github" : item.kind.toLowerCase() === "demo" ? "demo" : "artifact"}`}>
            {item.kind === "GitHub" ? <ExternalLink size={16} /> : item.kind === "Demo" ? <PlayCircle size={16} /> : <LayoutDashboard size={16} />}
            {item.kind}
          </span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="project-stack" aria-label="Technologies">
          {item.stack.map((name) => <StackChip key={name} name={name} />)}
        </div>
      </div>
    </a>
  );
}

function StackChip({ name }) {
  const icon = stackLogos[name];
  return (
    <span className="stack-chip">
      {icon ? <img src={icon} alt="" /> : <Sparkles size={15} />}
      {name}
    </span>
  );
}

function CertificatesPage() {
  const [active, setActive] = useState(null);
  return (
    <div className="listing-page">
      <SiteNav active="certifications" />
      <main className="listing-main listing-page-reveal">
        <header className="listing-hero">
          <p className="listing-kicker">Credentials</p>
          <h1>All Certifications</h1>
          <p>A compact archive of the AI, cloud, data, LLM, app-building, and payment integration certificates I have earned or completed.</p>
          <div className="listing-actions">
            <a className="btn btn-outline-dark" href="/#certifications"><ArrowLeft size={18} /> Main page certificates</a>
            <a className="btn btn-outline-dark" href="/projects.html">View projects <ArrowRight size={18} /></a>
          </div>
        </header>
        <section className="listing-section" aria-label="All certificates">
          <div className="listing-certifications-grid">
            {certificates.map((item) => <CertificateCard key={item.title} item={item} onClick={() => setActive(item)} />)}
          </div>
        </section>
      </main>
      <CertificateModal item={active} onClose={() => setActive(null)} />
      <SiteFooter />
    </div>
  );
}

function CertificateCard({ item, onClick }) {
  return (
    <a className="cert-card" href={item.href} onClick={onClick ? (event) => { event.preventDefault(); onClick(); } : undefined}>
      <span className="cert-preview"><img src={item.preview} alt={`${item.title} certificate preview`} loading="lazy" /></span>
      <span className="cert-meta"><span className="cert-issuer">{item.issuer}</span><span className="cert-category"><Sparkles size={14} /> {item.category}</span></span>
      <strong>{item.title}</strong>
    </a>
  );
}

function CertificateModal({ item, onClose }) {
  if (!item) return null;
  const isPdf = /\.pdf(?:$|[?#])/i.test(item.href);
  return (
    <ModalShell title={item.title} kicker="Certification Preview" onClose={onClose}>
      {isPdf ? <iframe className="artifact-frame" src={item.href} title={`${item.title} PDF preview`} /> : <img className="modal-image" src={item.href} alt={`${item.title} certificate`} />}
    </ModalShell>
  );
}

function ArtifactModal({ state, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => setActiveIndex(0), [state]);
  if (!state) return null;
  const active = state.files[activeIndex] || state.files[0];
  const isImage = active.type === "image" || /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(active.src);
  return (
    <ModalShell title={active.title || state.title} kicker="School artifact" onClose={onClose} wide>
      <div className="school-artifact-layout">
        <aside className="school-artifact-sidebar">
          {state.files.map((file, index) => (
            <button key={file.label} className={`school-artifact-tab ${index === activeIndex ? "is-active" : ""}`} onClick={() => setActiveIndex(index)}>
              {file.label}
            </button>
          ))}
        </aside>
        <div className="school-artifact-stage">
          {isImage ? <img src={active.src} alt={active.title || state.title} /> : <iframe src={active.src} title={active.title || state.title} />}
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, kicker, onClose, children, wide = false }) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="modal fade show react-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal-dialog modal-dialog-centered ${wide ? "modal-xl" : "modal-lg"}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div><p className="cert-modal-kicker">{kicker}</p><h2 className="modal-title">{title}</h2></div>
            <button className="btn-close" type="button" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </div>
  );
}

function ProjectShell({ bodyClass, kicker, title, lede, cta, preview, children }) {
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
              <a className="project-back-link" href="/projects.html"><ArrowLeft size={16} /> All projects</a>
              <p className="project-kicker">{kicker}</p>
              <h1>{title}</h1>
              <p className="project-hero-lede">{lede}</p>
              <div className="project-hero-actions">
                <a id="get-started" href={cta.href} className="btn btn-accent">{cta.label} <ArrowDown size={18} /></a>
                <a href="/projects.html" className="btn btn-outline-dark">Back to work</a>
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

function StatusAlert({ status }) {
  if (!status.message) return null;
  return <div className={`alert alert-${status.type || "info"}`} role="alert">{status.message}</div>;
}

function ProgressBar({ progress, active }) {
  if (!active) return null;
  return <div className="progress mb-3"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${progress}%` }} /></div>;
}

function useFakeProgress(active, max = 90) {
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

function QuizSlidePage() {
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
              <label className="form-label">OpenAI API key (optional)<input className="form-control" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Leave empty to use backend .env" /></label>
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

function MockPaperPage() {
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
          <label className="form-label">OpenAI API key<input className="form-control" type="password" value={state.apiKey} onChange={(e) => setState({ ...state, apiKey: e.target.value })} placeholder="Leave empty to use backend .env" /></label>
          <ProgressBar progress={progress} active={state.submitting} /><StatusAlert status={state.status} />
          <div className="project-action-row"><button className="btn btn-accent" disabled={state.submitting}>{state.submitting ? "Generating..." : "Generate papers"}</button>{state.downloadUrl && <a className="btn btn-outline-accent" href={state.downloadUrl} download="mockpapers.zip">Download ZIP</a>}</div>
        </div></form></div></section>
      <ProjectFaq items={["PDF and DOCX files with clear question structure work best.", "The max is kept low because paper generation is heavier.", "You can edit the generated PDFs after download."]} />
    </ProjectShell>
  );
}

function FileChatPage() {
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
        <div className="project-chat-grid"><form className="card pastel-card project-form-card" onSubmit={upload}><div className="card-body"><div className="tool-card-heading"><div><p className="project-kicker">Source file</p><h3>Upload document</h3></div><span className="tool-status-pill">Private session</span></div><label className="form-label">Choose file<input className="form-control" type="file" name="file" accept=".pdf,.docx,.txt" required /></label><label className="form-label">OpenAI API key<input className="form-control" type="password" value={state.apiKey} onChange={(e) => setState({ ...state, apiKey: e.target.value })} placeholder="Leave empty to use backend .env" /></label><StatusAlert status={state.status} /><button className="btn btn-accent" disabled={state.uploading}>{state.uploading ? "Uploading..." : "Upload and start"}</button></div></form>
        <div className="card pastel-card project-chat-card"><div className="card-body p-0 d-flex flex-column"><div className="chat-toolbar"><div><p className="project-kicker mb-1">Conversation</p><h3>Chat with your document</h3></div></div><div className="messages flex-grow-1 p-3">{state.messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}{state.asking && <div className="message assistant"><div className="bubble">Thinking...</div></div>}</div><form className="d-flex gap-2 p-3 border-top" onSubmit={ask}><input className="form-control" value={state.question} onChange={(e) => setState({ ...state, question: e.target.value })} placeholder="Type your question..." disabled={!state.sessionId || state.asking} /><button className="btn btn-accent" disabled={!state.sessionId || state.asking}>Send</button></form></div></div></div>
      </div></section>
      <ProjectFaq items={["PDF, DOCX, and TXT files are supported.", "You can ask follow-up questions after upload.", "Review important answers even when grounded in the document."]} />
    </ProjectShell>
  );
}

function CodingQuizPage() {
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

function QuestionRenderer({ question, wrong, feedback, pending, blankAnswers, setBlankAnswers, order, setOrder, submitAnswer }) {
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

function FeedbackPanel({ feedback }) {
  if (!feedback) return null;
  return <div className={`feedback ${feedback.correct ? "correct" : "incorrect"}`}>{feedback.correct ? <CheckCircle2 size={20} /> : <XCircle size={20} />} {feedback.correct ? "Correct." : "Incorrect. Try again."} {feedback.explanation}</div>;
}

function Select({ label, value, onChange, options }) {
  return <label>{label}<select className="input-select" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((x) => <option value={x} key={x}>{x}</option>)}</select></label>;
}

function ProjectFaq({ items }) {
  return <section id="faq" className="section project-faq"><div className="container"><div className="project-section-heading"><p className="project-kicker">Notes</p><h2>How it behaves.</h2></div><div className="faq-grid">{items.map((item, index) => <article className="pastel-card" key={item}><h3>{index + 1}</h3><p>{item}</p></article>)}</div></div></section>;
}

function PortfolioChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi, ask me about Mervin's projects, skills, or certificates." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const send = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.text })) }) });
      const data = await res.json();
      setMessages((items) => [...items, { role: "assistant", text: data.reply || data.error || "Chat is unavailable right now." }]);
    } catch (error) {
      setMessages((items) => [...items, { role: "assistant", text: "Chat is unavailable right now." }]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="portfolio-chat">
      <button className="chat-launcher" onClick={() => setOpen(true)} aria-label="Open chat"><MessageCircle size={22} /></button>
      {open && <section className="chat-panel" aria-label="Ask me"><header className="chat-header"><img className="chat-avatar" src="/img/myself.png" alt="" /><div><p>Portfolio assistant</p><h2>Ask me</h2></div><button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button></header><div className="chat-messages">{messages.map((msg, index) => <div className={`chat-message ${msg.role}`} key={index}>{msg.text}</div>)}{loading && <div className="chat-message assistant">Typing...</div>}</div><form className="chat-form" onSubmit={send}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a project..." /><button type="submit"><Send size={18} /></button></form></section>}
    </div>
  );
}

function DeckPreview() {
  return <div className="preview-window"><div className="preview-window-bar"><span /><span /><span /></div><div className="preview-paper"><div className="preview-paper-title">Quiz deck generated</div><div className="preview-question-row"><span>1</span><p>Multiple choice with answer slide.</p></div><div className="preview-question-row"><span>2</span><p>Code fill and explanation.</p></div></div></div>;
}
function PaperPreview() {
  return <div className="preview-window"><div className="preview-window-bar"><span /><span /><span /></div><div className="preview-paper"><div className="preview-paper-title">Mathematics mock paper</div><div className="preview-paper-line long" /><div className="preview-question-row"><span>1</span><p>Explain the pattern.</p></div><div className="preview-answer-key">Answer key included</div></div></div>;
}
function ChatPreview() {
  return <div className="preview-window chat-preview"><div className="preview-window-bar"><span /><span /><span /></div><div className="preview-chat-row assistant">Upload received.</div><div className="preview-chat-row user">Summarize the key concepts.</div><div className="preview-chat-row assistant wide">Here are the three main ideas.</div><div className="preview-input-bar">Type your question...</div></div>;
}
function CodePreview() {
  return <div className="preview-window code-preview"><div className="preview-window-bar"><span /><span /><span /></div><pre><code>{`function score(answer) {\n  return answer === expected;\n}`}</code></pre><div className="preview-option is-selected">JavaScript</div><div className="preview-progress"><span style={{ width: "62%" }} /></div></div>;
}

function SiteFooter() {
  return <footer className="site-footer footer-section bg-dark text-light py-4"><div className="container text-center"><small>&copy; 2026 Mervin Ng. All rights reserved.</small></div></footer>;
}

function getApiBase(defaultBase) {
  return new URLSearchParams(window.location.search).get("api") || defaultBase;
}

createRoot(document.getElementById("root")).render(<App />);
