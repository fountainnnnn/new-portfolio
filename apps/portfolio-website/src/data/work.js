// The top three projects on the home page; the first two flip through real pages on hover
import { AGENTLABS, GH, REYOLK } from "./links.js";

const W = (n) => `/img/work/${n}`;

export const WORK = [
  { t: "Reyolk", yr: "2026", one: "An AI operating system for small service businesses.", url: REYOLK, bg: "#e7eae4", pages: [["Home", W("reyolk-home.jpg")], ["Features", W("reyolk-features.jpg")], ["How it works", W("reyolk-how.jpg")], ["Pricing", W("reyolk-pricing.jpg")]] },
  { t: "AgentLabs", yr: "2026", one: "Attacks AI agents, then patches and retests them.", url: AGENTLABS, bg: "#e6e3f1", pages: [["Home", W("agentlabs-home.jpg")], ["Hardening arena", W("agentlabs-hardening.jpg")], ["Results", W("al-results.png")], ["LoRA arena", W("agentlabs-lora.jpg")]] },
  { t: "ESG Evidence Engine", yr: "2026", one: "Checks company ESG claims against evidence.", url: `${GH}esg-evidence-engine`, bg: "#e3ebe5", pages: [["Dashboard", W("t-esg.jpg")]] },
];

// the fanned thumbnails on the "All projects" tile
export const ALL_TILE_FAN = [W("t-proofbench.jpg"), W("t-supagent.jpg"), W("t-projectai.jpg")];
