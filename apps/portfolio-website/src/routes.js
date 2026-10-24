// Which page a path shows, and its title and description (the server sends every one of these paths the same index.html)
const DESCRIPTION = "Ng Yu Hang (Mervin), full-stack AI developer and data scientist in Singapore. AI agents, machine learning, computer vision, RAG and full-stack apps.";

const ROUTES = [
  { test: (p) => p === "/projects" || p === "/projects/", page: "projects", title: "Projects · Mervin's Hub", description: "Everything Ng Yu Hang (Mervin) has built: AI agents, ML and computer vision projects, small AI apps and school work, plus 29 certificates." },
  { test: (p) => p.startsWith("/quiz-slide-generator"), page: "quiz-slide", title: "Quiz Slide Generator · Mervin's Hub", description: "Turn lecture slides into a quiz deck with answer slides." },
  { test: (p) => p.startsWith("/mock-paper-generator"), page: "mock-paper", title: "Mock Paper Generator · Mervin's Hub", description: "Turn past papers into fresh mock exams with answer keys." },
  { test: (p) => p.startsWith("/file-chat-assistant"), page: "file-chat", title: "Document Q&A · Mervin's Hub", description: "Chat with PDFs and scans, with answers cited back to the page." },
  { test: (p) => p.startsWith("/coding-quiz"), page: "coding-quiz", title: "Coding Quiz · Mervin's Hub", description: "Generated coding quizzes with hints and a weak-topic review." },
];

export function routeFor(pathname) {
  return ROUTES.find((r) => r.test(pathname)) || { page: "home", title: "Mervin's Hub", description: DESCRIPTION };
}
