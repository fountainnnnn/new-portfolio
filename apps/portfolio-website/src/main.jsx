import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { routeFor } from "./routes.js";

// each page is its own chunk, so a page only loads its own code and styles
const PAGES = {
  home: lazy(() => import("./pages/HomePage.jsx")),
  projects: lazy(() => import("./pages/ProjectsPage.jsx")),
  "quiz-slide": lazy(() => import("./tools/QuizSlidePage.jsx")),
  "mock-paper": lazy(() => import("./tools/MockPaperPage.jsx")),
  "file-chat": lazy(() => import("./tools/FileChatPage.jsx")),
  "coding-quiz": lazy(() => import("./tools/CodingQuizPage.jsx")),
};

const route = routeFor(location.pathname);
document.title = route.title;
document.querySelector('meta[name="description"]')?.setAttribute("content", route.description);
const Page = PAGES[route.page];

createRoot(document.getElementById("root")).render(<Suspense fallback={null}><Page /></Suspense>);
