// Everything on /projects. [title, one line, stack, link, thumbnail]
import { AGENTLABS, GH, REYOLK } from "./links.js";

const W = (n) => `/img/work/${n}`, S = (n) => `/img/shots/${n}.jpg`;

export const PROJECT_GROUPS = [
  {
    id: "builds", title: "Builds", note: "Hackathons and personal projects",
    items: [
      ["Reyolk", "An AI operating system for small service businesses.", "AI agents · Full-stack", REYOLK, W("t-reyolk.jpg")],
      ["AgentLabs", "Attacks AI agents with adversarial prompts, then patches and retests them.", "Python · FastAPI · React · LoRA", AGENTLABS, W("t-agentlabs.jpg")],
      ["ESG Evidence Engine", "Research agents that check ESG claims against evidence, satellite images included. PolyFinTech 2026 finalist.", "Python · React · FastAPI", `${GH}esg-evidence-engine`, W("t-esg.jpg")],
      ["ProofBench", "Scores developer tools by running them in sandboxes and grading the output.", "Python · FastAPI · PostgreSQL", `${GH}ProofBench`, W("t-proofbench.jpg")],
      ["ProjectAI", "A game that teaches students to prompt well. Built for the Edu2030 hackathon.", "React · LLMs", `${GH}edu2030-projectai`, W("t-projectai.jpg")],
      ["SUPAgent", "SOPs and brand guides in, a red-teamed support agent out. 'SUP Build top 3.", "TypeScript · Agents", `${GH}SUPAgent`, W("t-supagent.jpg")],
      ["Lactic", "A-Level tutor app with hybrid vector and graph retrieval.", "Dart · Flutter · Supabase", `${GH}lactic-sg-alevel-ai-tutor`, S("lactic")],
      ["Edge Human Detection", "YOLO11n fine-tuned on thermal imagery for night-vision CCTV, running fully local.", "PyTorch · YOLO · OpenCV", `${GH}edge-human-detection`, S("edge")],
      ["Decidr Auto Dashboard", "Profiles a CSV, then turns plain-language prompts into interactive charts.", "Next.js · Python · Plotly", "/auto-dashboard", S("auto-dashboard")],
      ["GrowthLab News", "Daily SEA startup news with relevance scoring and Telegram posting. OpenClaw hackathon top 3.", "React · Node.js · OpenClaw", `${GH}growthlab-news`, W("t-growthlab.jpg")],
      ["Syntra", "A Telegram customer-ops dashboard built by an autonomous agent from one spec.", "TypeScript · Playwright", `${GH}Syntra`, W("t-syntra.jpg")],
      ["Power BI Grader", "Reads .pbix files and grades dashboards against a rubric, with cited evidence.", "FastAPI · React · GPT-4o Vision", `${GH}powerbi-grader`, S("powerbi")],
      ["Trading Bot", "Paper-trading research bot with risk checks and a genetic-search backtest.", "Node.js · Python · OpenClaw", `${GH}trading-bot`, S("trading-bot")],
      ["Covid CNN", "A from-scratch PyTorch CNN for four-class chest X-ray classification.", "Python · PyTorch", `${GH}Covid-CNN`, S("covid-cnn")],
      ["Telegram Reminder Bot", "Parses plain-language reminders, schedules follow-ups and stores tasks in SQLite.", "TypeScript · Node.js · Docker", "/telegram-reminder-bot/", S("telegram-bot")],
      ["OpenClaw VPS Bot", "An always-on OpenClaw workflow with cron jobs, VPS checks and Telegram commands.", "OpenClaw · Telegram · VPS", "/openclaw-vps-bot/", S("openclaw-vps")],
      ["PetaniAI remake", "A rebuild of petaniai.com with pixel-field scroll scenes.", "React · TypeScript · GSAP", "/petaniAI/", S("petani")],
      ["Luma Yuzu", "A product page for a fictional yuzu tea, with scroll-led can reveals.", "TypeScript · GSAP · Vite", "/luma-yuzu-scroll-site/", S("luma-yuzu")],
    ],
  },
  {
    id: "apps", title: "Small AI apps", note: "Quick tools to test AI workflows on documents and code",
    items: [
      ["Quiz Slide Generator", "Turns lecture slides into a quiz deck with answer slides.", "Python · FastAPI · DeepSeek", "/quiz-slide-generator/", S("quiz-slide")],
      ["Mock Paper Generator", "Turns past papers into fresh mock exams with answer keys.", "Python · FastAPI · ReportLab", "/mock-paper-generator/", S("mock-paper")],
      ["Document Q&A", "Chat with PDFs and scans, with answers cited back to the page.", "Python · FastAPI · DeepSeek", "/file-chat-assistant/", S("file-chat")],
      ["Coding Quiz", "Generated coding quizzes with hints and a weak-topic review.", "React · Python · FastAPI", "/coding-quiz/", S("coding-quiz")],
    ],
  },
  {
    id: "school", title: "School work", note: "Applied AI & Analytics, Singapore Polytechnic",
    items: [
      ["CNN Computer Vision Paper", "A paper on CNN foundations, architectures and vision applications.", "Python · CNN", "/school-projects/artifacts/dele-ca2/paper/dele-ca2-part-c-paper-viewer", S("dele-paper")],
      ["DQN Pendulum Agent", "A reinforcement learning agent trained to swing up a pendulum.", "Python · DQN", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-b", S("dele-dqn")],
      ["GAN Image Generator", "A GAN that generates images, with samples and architecture diagrams.", "Python · TensorFlow · GAN", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-a", S("dele-gan")],
      ["Vegetable CNN & House Price RNN", "Vegetable image classification and house price forecasting.", "Python · TensorFlow", "/school-projects/artifacts/dele-ca1/notebooks/dele-ca1-part-a", S("dele-ca1")],
      ["VeggieAI", "Flask app for vegetable classification, backed by a separate model service.", "Python · TensorFlow · Flask", "/school-veggie-ai-ca2/", S("veggie")],
      ["HDB Resale Predictor", "Flask app predicting Singapore HDB resale prices, with accounts.", "Python · Flask · scikit-learn", "/school-hdb-resale-ca1/", S("hdb-resale")],
      ["HDB Flat Selection Dashboard", "A Tableau dashboard for choosing an HDB flat.", "Tableau", "/school-projects/artifacts/data-visualization-ca1/slides/data-visualization-ca1-slides.pdf", S("hdb-dashboard")],
      ["Prestige Mall Dashboard", "A Power BI report on mall customer profiles and utility use.", "Power BI", "/school-projects/artifacts/data-fundamentals-ca2/powerbi/data-fundamentals-ca2-report-page.png", S("df-ca2")],
      ["Energy Forecasting & Segmentation", "Energy use forecasting and customer clustering.", "Python · Pandas", "/school-projects/artifacts/aiml-ca2/notebooks/aiml-ca2-part-a", S("aiml-ca2")],
      ["Factory Status & Housing Models", "Machine status classification and housing price regression.", "Python · scikit-learn", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-a", S("aiml-ca1")],
      ["SP 70th Anniversary Website", "Multi-page site with a feedback form and anniversary timeline.", "HTML · CSS · Bootstrap", "/fed-ca2/", S("fed-ca2")],
    ],
  },
];
