// "What I can build": one entry per skill, with the projects that show it
import { AGENTLABS, GH, REYOLK } from "./links.js";

export const SKILLS = [
  {
    viz: "agent", perch: "laptop",
    title: "Agents that plan, act, check their work and try again.",
    text: "LLM agents that call tools, check their own output against rules, and retry until it passes.",
    tags: ["Tool use", "Guardrails", "Evals", "LangChain", "Claude & OpenAI APIs"],
    built: [["AgentLabs", AGENTLABS], ["SUPAgent", `${GH}SUPAgent`], ["Syntra", `${GH}Syntra`], ["Reyolk", REYOLK]],
    label: "Animation of an AI agent looping through plan, act, observe and reflect, calling tools and retrying after a failed check",
  },
  {
    viz: "nn", perch: "think",
    title: "Machine learning, from regression to fine-tuned LLMs.",
    text: "From a scikit-learn baseline to CNNs, GANs, reinforcement learning and LoRA fine-tuning, whatever the data needs.",
    tags: ["scikit-learn", "Pandas", "PyTorch", "TensorFlow", "LoRA", "Hugging Face"],
    built: [["AgentLabs LoRA Lab", AGENTLABS], ["Covid CNN", `${GH}Covid-CNN`], ["GAN Image Generator", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-a"], ["DQN Pendulum Agent", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-b"], ["Factory Machine Status", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-a"], ["Housing Price Regression", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-b"], ["Energy forecasting", "/school-projects/artifacts/aiml-ca2/notebooks/aiml-ca2-part-a"]],
    label: "A small neural network running a forward pass, with inputs driven by the cursor and class probabilities on the right",
  },
  {
    viz: "conv", perch: "point",
    title: "Computer vision that runs where it’s needed.",
    text: "YOLO detectors and CNN classifiers trained on real images, then shipped to run locally, on the edge or behind an API.",
    tags: ["YOLO", "CNNs", "OpenCV", "PyTorch"],
    built: [["Edge Human Detection", `${GH}edge-human-detection`], ["ESG Evidence Engine", `${GH}esg-evidence-engine`], ["Covid CNN", `${GH}Covid-CNN`], ["VeggieAI", "/school-veggie-ai-ca2/"]],
    label: "A convolution kernel scanning Mervin's portrait and producing an edge-detection feature map",
  },
  {
    viz: "emb", perch: "think2",
    title: "RAG systems that search, check and cite.",
    text: "An agent picks the right sources, checks what it finds, and answers with citations, evaluated with LLM-as-a-judge.",
    tags: ["Agentic RAG", "Embeddings", "Vector search", "Azure AI Search", "Supabase"],
    built: [["EM Services chatbot", "#xp-dsac"], ["SPOH Chatbot", "#xp-spoh"], ["Lactic", `${GH}lactic-sg-alevel-ai-tutor`], ["Document Q&A", "/file-chat-assistant/"]],
    label: "An agentic RAG pipeline: a question, the agent choosing which source to search, its nearest document chunks in embedding space, the retrieved sources, and an answer that cites them",
  },
  {
    viz: "stack", perch: "stack",
    title: "Full-stack AI apps, from model to product.",
    text: "The whole product around the model: frontend, backend, database, auth and deployment.",
    tags: ["React", "Next.js", "FastAPI", "Node.js", "Postgres", "Docker"],
    built: [["Reyolk", REYOLK], ["Decidr Auto Dashboard", "/auto-dashboard"], ["Power BI Grader", `${GH}powerbi-grader`], ["ProofBench", `${GH}ProofBench`], ["Quiz Slide Generator", "/quiz-slide-generator/"]],
    label: "A full-stack AI app: a browser sends a request to an API, which retrieves from a vector database and Postgres, calls the LLM, and streams the answer back",
  },
];
