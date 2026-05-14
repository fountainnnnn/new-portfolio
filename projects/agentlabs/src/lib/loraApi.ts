const BASE = "/api/lora";

export interface LoraCapabilities {
  mode: "real_local_model" | "adapter_simulation" | "demo_simulation" | "real_capable" | "simulation";
  torch_available?: boolean;
  transformers_available?: boolean;
  peft_available?: boolean;
  accelerate_available?: boolean;
  gpu_available?: boolean;
  real_training_available?: boolean;
  limitations: string[];
}

export interface LoraMetrics {
  accuracy: number;
  refusal_precision: number;
  leakage_penalty: number;
  hallucination_penalty: number;
  reward: number;
}

export interface LoraJob {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  mode?: LoraCapabilities["mode"];
  progress: number;
  adapter_id?: string | null;
  checkpoint?: { id?: string; metadata?: Record<string, unknown> } | null;
  metrics: LoraMetrics | Record<string, number> | null;
  error: string | null;
  real_or_simulated: string;
}

export interface LoraModelOption {
  id: string;
  name: string;
  source: "demo" | "local_path" | "huggingface";
  model_path: string | null;
  parameters?: string;
  total_parameters?: number | null;
  real_or_simulated: string;
  description: string;
}

export interface LoraModelSelection {
  model_id: string;
  source: "demo" | "local_path" | "huggingface";
  model_path?: string | null;
}

export interface LoraComparison {
  prompt: string;
  base_response: string;
  lora_response: string;
  target: string;
  category: string;
  passed: boolean;
  base_score: number;
  lora_score: number;
}

export interface RealLoraReport {
  model: string;
  dataset_size: number;
  training_metrics: Record<string, number | string>;
  comparisons: LoraComparison[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_base_score: number;
    avg_lora_score: number;
    improvement: number;
  };
  failed_prompts: LoraComparison[];
}

async function postJson<T>(path: string, body: object = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`AgentLabs API ${path} failed: ${response.status}`);
  return response.json();
}

export async function listLoraModels(): Promise<LoraModelOption[]> {
  const response = await fetch(`${BASE}/models`);
  if (!response.ok) throw new Error(`AgentLabs models failed: ${response.status}`);
  const data = await response.json();
  return data.models ?? [];
}

export async function selectLoraModel(model: LoraModelSelection) {
  return postJson<{ real_or_simulated: string; ready: boolean; limitations: string[] }>("/models/select", model);
}

export async function getLoraCapabilities(): Promise<LoraCapabilities> {
  const response = await fetch(`${BASE}/config`);
  if (!response.ok) throw new Error(`AgentLabs capabilities failed: ${response.status}`);
  const data = await response.json();
  return {
    mode: data.runtime?.default_mode ?? "simulation",
    torch_available: data.runtime?.dependencies?.torch,
    transformers_available: data.runtime?.dependencies?.transformers,
    peft_available: data.runtime?.dependencies?.peft,
    accelerate_available: data.runtime?.dependencies?.accelerate,
    real_training_available: data.runtime?.real_lora_dependencies_available,
    limitations: data.runtime?.truthfulness ?? [],
  };
}

export async function createDemoDataset(): Promise<{ dataset_id: string; rows: number }> {
  const data = await postJson<{ dataset_id: string; summary: { total_samples: number } }>("/datasets/synthetic", {
    name: "demo-refusal-safety",
    domain: "customer-support",
    count: 80,
  });
  return { dataset_id: data.dataset_id, rows: data.summary.total_samples };
}

export async function runBaseline(datasetId: string, model: LoraModelSelection) {
  return postJson<{ metrics: { reward_score: number; pass_rate: number }; real_or_simulated: string; logs?: string[] }>("/eval/baseline", {
    dataset_id: datasetId,
    model,
  });
}

export async function trainLoraAdapter(input: {
  datasetId: string;
  model: LoraModelSelection;
  loraRank: number;
}) {
  return postJson<{ job_id: string; status: string; mode?: string; real_or_simulated: string }>("/train", {
    dataset_id: input.datasetId,
    model: input.model,
    rank: input.loraRank,
  });
}

export async function trainRealLoraAdapter(input: {
  datasetId: string;
  modelName: string;
  loraRank: number;
  steps?: number;
  sampleCount?: number;
}): Promise<RealLoraReport> {
  return postJson<RealLoraReport>("/real/train", {
    dataset_id: input.datasetId,
    model_name: input.modelName,
    rank: input.loraRank,
    steps: input.steps ?? 12,
    sample_count: input.sampleCount,
  });
}

export async function getLoraJob(jobId: string): Promise<LoraJob> {
  const response = await fetch(`${BASE}/jobs/${jobId}`);
  if (!response.ok) throw new Error(`AgentLabs job failed: ${response.status}`);
  const data = await response.json();
  return {
    ...data,
    adapter_id: data.adapter_id ?? data.checkpoint?.id ?? null,
    error: data.error ?? null,
  };
}

export async function exportLoraArtifacts(jobId: string) {
  return postJson<{ export_id: string; path: string; files: string[]; metadata: Record<string, unknown> }>("/exports", {
    job_id: jobId,
  });
}
