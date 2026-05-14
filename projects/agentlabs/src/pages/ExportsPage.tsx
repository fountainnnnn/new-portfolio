import { useCallback } from "react";
import { Link } from "react-router-dom";

const artifacts = [
  {
    filename: "adapter_config.json",
    type: "LoRA adapter config",
    format: "json",
    realOrSimulated: "adapter_simulation",
  },
  {
    filename: "training_report.json",
    type: "Training report",
    format: "json",
    realOrSimulated: "adapter_simulation",
  },
  {
    filename: "reward_trace.json",
    type: "Reward trace",
    format: "json",
    realOrSimulated: "adapter_simulation",
  },
  {
    filename: "model_card.md",
    type: "Model card",
    format: "md",
    realOrSimulated: "adapter_simulation",
  },
];

export default function ExportsPage() {
  const handleDownload = useCallback((filename: string) => {
    const payload = {
      product: "AgentLabs",
      artifact: filename,
      real_or_simulated: "adapter_simulation",
      not_trained_on_openai_weights: true,
      limitations: [
        "Export contains LoRA adapter metadata and reports only.",
        "Simulation artifacts are not trained model weights.",
        "OpenAI API model weights are never trained or exported.",
      ],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="af-page">
      <header className="af-topbar flex items-center justify-between gap-4 px-5">
        <Link to="/" className="af-brand-link" aria-label="Back to AgentLabs lab">
          <span className="af-brand-logo af-brand-monogram" aria-hidden="true">AL</span>
          <span>
            <span className="af-brand-word">AgentLabs</span>
            <span className="af-brand-subtitle">LoRA exported artifacts</span>
          </span>
        </Link>
        <span className="af-chip text-[#7C3AED]">not_trained_on_openai_weights</span>
      </header>

      <main className="af-page-main">
        <div className="af-container-wide grid gap-4">
          <section className="af-panel-canvas p-5">
            <p className="af-section-label">Artifact registry</p>
            <h1 className="mt-3 text-[34px] font-semibold leading-tight text-[#1D1D1F]">Exports</h1>
            <p className="mt-2 max-w-[780px] text-[14px] leading-6 text-[#575A60]">
              Download LoRA adapter artifacts, reward traces, training reports, and model-card metadata with explicit limitations.
            </p>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {artifacts.map((artifact) => (
              <button
                key={artifact.filename}
                type="button"
                onClick={() => handleDownload(artifact.filename)}
                className="af-panel-canvas min-h-[160px] p-4 text-left transition hover:border-[#C7C2B8]"
              >
                <span className="af-chip text-[#7C3AED]">{artifact.format.toUpperCase()}</span>
                <span className="mt-5 block text-[17px] font-semibold text-[#1D1D1F]">{artifact.filename}</span>
                <span className="mt-2 block text-[13px] leading-5 text-[#575A60]">{artifact.type}</span>
                <span className="af-mono mt-4 block text-[12px] font-semibold text-[#7A7D85]">
                  {artifact.realOrSimulated}
                </span>
              </button>
            ))}
          </section>

          <section className="af-panel-warm p-4">
            <p className="af-section-label">Export truth contract</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <Truth text="Exports are adapter artifacts and reports, not base model weights." />
              <Truth text="Every artifact includes real_or_simulated metadata." />
              <Truth text="Every LoRA artifact marks not_trained_on_openai_weights as true." />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Truth({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2 text-[13px] leading-5 text-[#575A60]">
      {text}
    </div>
  );
}
