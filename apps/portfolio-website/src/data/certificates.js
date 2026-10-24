// Every certificate on /projects#certs: [title, issuer, image]
const C = (f) => `/img/certs/${f.includes(".") ? f : `${f}.jpg`}`;

export const CERTIFICATES = [
  ["AWS Certified AI Practitioner", "AWS", "aws-ai-practitioner.png"], ["IBM Artificial Intelligence Fundamentals", "IBM", "c27"], ["Introduction to Artificial Intelligence", "IBM", "c11"], ["AI Ethics", "IBM", "c10"],
  ["Machine Learning and Deep Learning", "IBM", "c12"], ["NLP and Computer Vision", "IBM", "c13"], ["Run AI Models with Watson Studio", "IBM", "c14"],
  ["AI Fundamentals: Language and Vision", "IBM", "c24"], ["NVIDIA Fundamentals of Deep Learning", "NVIDIA", "c20"], ["LLM Post Training: Unit 1", "Hugging Face", "c17"],
  ["Create Image Captioning Models", "Google Cloud", "c26"], ["Vector Search and Embeddings", "Google Cloud", "c28"], ["App Building with AppSheet", "Google Cloud", "c25"],
  ["AI Fundamentals", "Google", "c01"], ["AI for Brainstorming and Planning", "Google", "c02"], ["AI for Research and Insights", "Google", "c03"],
  ["AI for Writing and Communicating", "Google", "c04"], ["AI for Content Creation", "Google", "c05"], ["AWS Academy Cloud Foundations", "AWS", "c08"],
  ["Generative AI Concepts", "DataCamp", "c09"], ["Understanding ChatGPT", "DataCamp", "c21"], ["Introduction to Deep Learning with Keras", "DataCamp", "c15"],
  ["Data Visualization with Plotly", "DataCamp", "c16"], ["AI Trainer Certificate", "AI Singapore", "c06"], ["AI for Good Train-the-Trainer", "AI Singapore", "c07"],
  ["AI-Ready ASEAN", "AI Singapore", "c23"], ["eNETS Web Integration", "NETS", "c22"], ["NETS QR Web Payment Integration", "NETS", "c19"], ["NETS QR Mobile Payment Integration", "NETS", "c18"],
].map(([title, issuer, file]) => ({ title, issuer, src: C(file) }));

// the four shown on the home page
const L = (n) => `/img/logos/${n}`;
export const CERT_HIGHLIGHTS = [
  { title: "AWS Certified AI Practitioner", issuer: "Amazon Web Services", src: C("aws-ai-practitioner.png"), logo: L("si-amazonwebservices.svg") },
  { title: "Fundamentals of Deep Learning", issuer: "NVIDIA", src: C("c20"), logo: L("si-nvidia.svg") },
  { title: "LLM Post Training", issuer: "Hugging Face", src: C("c17"), logo: L("si-huggingface.svg") },
  { title: "Machine Learning and Deep Learning", issuer: "IBM", src: C("c12"), logo: L("si-ibm.svg") },
];
