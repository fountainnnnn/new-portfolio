// "What I can build": one entry per skill, with the projects that show it
import { AGENTLABS, GH, REYOLK } from "./links.js";

export const SKILLS = [
  {
    viz: "agent", perch: "laptop",
    title: "Agents that plan, act, check their work and try again.",
    text: "I design the loop before the prompt: which tools the agent may call, what counts as done, and the rules its output is checked against. Then guardrails and evals, so it retries until the checks pass instead of guessing.",
    tags: ["Tool use", "Guardrails", "Evals", "LangChain", "Claude & OpenAI APIs"],
    built: [["AgentLabs", AGENTLABS], ["SUPAgent", `${GH}SUPAgent`], ["Syntra", `${GH}Syntra`], ["Reyolk", REYOLK]],
    label: "Animation of an AI agent looping through plan, act, observe and reflect, calling tools and retrying after a failed check",
  },
  {
    viz: "nn", perch: "think",
    title: "Machine learning, from regression to fine-tuned LLMs.",
    text: "I start with the data: cleaning, features and a scikit-learn baseline for regression, classification, clustering or forecasting. Deep learning comes in when it beats that baseline: CNNs, RNNs, GANs, reinforcement learning, and LoRA fine-tuning for open models.",
    tags: ["scikit-learn", "Pandas", "PyTorch", "TensorFlow", "LoRA", "Hugging Face"],
    built: [["AgentLabs LoRA Lab", AGENTLABS], ["Covid CNN", `${GH}Covid-CNN`], ["GAN Image Generator", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-a"], ["DQN Pendulum Agent", "/school-projects/artifacts/dele-ca2/notebooks/dele-ca2-part-b"], ["Factory Machine Status", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-a"], ["Housing Price Regression", "/school-projects/artifacts/aiml-ca1/notebooks/aiml-ca1-part-b"], ["Energy forecasting", "/school-projects/artifacts/aiml-ca2/notebooks/aiml-ca2-part-a"]],
    label: "A small neural network running a forward pass, with inputs driven by the cursor and class probabilities on the right",
  },
  {
    viz: "conv", perch: "point",
    title: "Computer vision that runs where it’s needed.",
    text: "I fine-tune YOLO detectors and train CNN classifiers on the images a job actually sees, from thermal CCTV to satellite photos, then ship them to where they run: fully local, on the edge, or behind an API.",
    tags: ["YOLO", "CNNs", "OpenCV", "PyTorch"],
    built: [["Edge Human Detection", `${GH}edge-human-detection`], ["ESG Evidence Engine", `${GH}esg-evidence-engine`], ["Covid CNN", `${GH}Covid-CNN`], ["VeggieAI", "/school-veggie-ai-ca2/"]],
    label: "A convolution kernel scanning Mervin's portrait and producing an edge-detection feature map",
  },
  {
    viz: "emb", perch: "think2",
    title: "RAG systems that search, check and cite.",
    text: "More than a vector lookup: an agent rewrites the question, decides which sources to search, combines vector and graph search, and checks the passages it gets back before the LLM answers from them, with citations. Then I evaluate retrieval and answers, using LLM-as-a-judge where it fits.",
    tags: ["Agentic RAG", "Embeddings", "Vector search", "Azure AI Search", "Supabase"],
    built: [["EM Services chatbot", "#xp-dsac"], ["SPOH Chatbot", "#xp-spoh"], ["Lactic", `${GH}lactic-sg-alevel-ai-tutor`], ["Document Q&A", "/file-chat-assistant/"]],
    label: "An agentic RAG pipeline: a question, the agent choosing which source to search, its nearest document chunks in embedding space, the retrieved sources, and an answer that cites them",
  },
  {
    viz: "stack", perch: "stack",
    title: "Full-stack AI apps, from model to product.",
    text: "The whole product around the model: React and Next.js frontends, FastAPI and Node backends, Postgres and Supabase, auth, streaming responses, Docker, and deployment on Azure, AWS or Railway.",
    tags: ["React", "Next.js", "FastAPI", "Node.js", "Postgres", "Docker"],
    built: [["Reyolk", REYOLK], ["Decidr Auto Dashboard", "/auto-dashboard"], ["Power BI Grader", `${GH}powerbi-grader`], ["ProofBench", `${GH}ProofBench`], ["Quiz Slide Generator", "/quiz-slide-generator/"]],
    label: "A full-stack AI app: a browser sends a request to an API, which retrieves from a vector database and Postgres, calls the LLM, and streams the answer back",
  },
];
