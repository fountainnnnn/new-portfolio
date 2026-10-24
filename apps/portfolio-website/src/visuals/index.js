import agentLoop from "./agentLoop.js";
import neuralNet from "./neuralNet.js";
import convolution from "./convolution.js";
import ragPipeline from "./ragPipeline.js";
import fullStack from "./fullStack.js";

const VISUALS = { agent: agentLoop, nn: neuralNet, conv: convolution, emb: ragPipeline, stack: fullStack };

// starts every canvas[data-viz] inside root; returns a function that stops them all
export function startVisuals(root) {
  const stops = [...root.querySelectorAll("canvas[data-viz]")].map((c) => VISUALS[c.dataset.viz]?.(c));
  return () => stops.forEach((stop) => stop?.());
}
