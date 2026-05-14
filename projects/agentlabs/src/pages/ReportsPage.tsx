import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ComparisonItem {
  prompt: string;
  base_response: string;
  lora_response: string;
  target: string;
  category: string;
  passed: boolean;
  base_score: number;
  lora_score: number;
}

interface ReportData {
  model: string;
  dataset_size: number;
  training_metrics: Record<string, any>;
  comparisons: ComparisonItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_base_score: number;
    avg_lora_score: number;
    improvement: number;
  };
  failed_prompts: ComparisonItem[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReportData(null);
    try {
      const res = await fetch("/api/lora/real/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const err = await res.json();
          msg = err?.detail?.error || err?.detail || err?.error || msg;
        } catch {
          // Keep the HTTP status text when the response body is not JSON.
        }
        throw new Error(`API ${res.status}: ${msg}`);
      }
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      if (!data?.summary) throw new Error("Incomplete report data");
      setReportData(data as ReportData);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrint = useCallback(() => window.print(), []);

  const toggle = useCallback((idx: number) => {
    setExpandedIdx((p) => (p === idx ? null : idx));
  }, []);

  /* ---- Category helpers ---- */
  const catColor = (c: string) =>
    ({ instruction_following: "#2563EB", refusal_precision: "#7C3AED", domain_accuracy: "#0284C7", hallucination_control: "#C77700", format_adherence: "#21865A" })[c] || "#5A6E86";

  const catLabel = (c: string) =>
    c.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());

  const s = reportData?.summary;
  const tm = reportData?.training_metrics || {};
  const items = reportData?.comparisons || [];

  return (
    <div className="af-page" style={{ minHeight: "100vh" }}>
      <header className="af-topbar flex items-center justify-between gap-4 px-5">
        <Link to="/" className="af-brand-link" aria-label="Back">
          <span className="af-brand-logo af-brand-monogram" aria-hidden="true">AL</span>
          <span>
            <span className="af-brand-word">AgentLabs</span>
            <span className="af-brand-subtitle">LoRA training report</span>
          </span>
        </Link>
        <span className="af-chip" style={{ background: reportData ? "rgba(33,134,90,.1)" : "rgba(90,110,134,.1)", color: reportData ? "#21865A" : "#5A6E86" }}>
          {reportData ? "Real Model Results" : "Not Generated"}
        </span>
      </header>

      <main className="af-page-main">
        <div className="af-container-wide grid gap-4">
          {/* Hero */}
          <section className="af-panel-canvas p-5">
            <p className="af-section-label">Run observability</p>
            <h1 className="mt-3 text-[34px] font-semibold leading-tight text-[#1D1D1F]">LoRA Training Report</h1>
            <p className="mt-2 max-w-[780px] text-[14px] leading-6 text-[#575A60]">
              Real model inference and LoRA fine-tuning with <strong>distilgpt2</strong> (82M params) on GPU.
              Compares base model vs LoRA-patched responses across refusal-safety evaluation prompts.
            </p>
          </section>

          {/* Actions */}
          <section className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={generateReport} disabled={loading}
              className="af-button"
              style={{
                background: loading ? "#DCD8CC" : "#7C3AED",
                borderColor: loading ? "#DCD8CC" : "#7C3AED",
                color: "#FFF", minWidth: "160px",
              }}
            >
              {loading ? "Training LoRA..." : reportData ? "Re-run Report" : "Generate Report"}
            </button>
            {reportData && (
              <button type="button" onClick={handlePrint}
                className="af-button" style={{ background: "#1D1D1F", borderColor: "#1D1D1F", color: "#FFF" }}>
                Export PDF
              </button>
            )}
          </section>

          {/* Error */}
          {error && (
            <section className="af-panel p-4" style={{ background: "rgba(194,65,75,.06)", border: "1px solid rgba(194,65,75,.2)" }}>
              <p style={{ color: "#C2414B", fontSize: "13px" }}>{error}</p>
            </section>
          )}

          {/* Loading */}
          {loading && (
            <section className="af-panel p-6 text-center" style={{ color: "#7A7D85" }}>
              <div className="animate-pulse">Running real LoRA training on GPU with distilgpt2 (24 prompts, 30 steps)...</div>
            </section>
          )}

          {/* Results */}
          {reportData && s && (
            <div className="grid gap-4">
              {/* KPIs */}
              <section className="af-metric-grid">
                <Kpi label="Pass Rate" value={`${(s.pass_rate * 100).toFixed(0)}%`} suffix={`${s.passed}/${s.total}`} color="#21865A" />
                <Kpi label="Base Score" value={s.avg_base_score.toFixed(3)} suffix="avg" color="#5A6E86" />
                <Kpi label="LoRA Score" value={s.avg_lora_score.toFixed(3)} suffix="avg" color="#7C3AED" />
                <Kpi label="Improvement" value={`+${(s.improvement * 100).toFixed(1)}%`} suffix="relative" color={s.improvement > 0 ? "#21865A" : "#C2414B"} />
                <Kpi label="Training Loss" value={(tm.final_loss ?? 0).toFixed(3)} suffix={`${tm.steps_trained ?? 0} steps`} color="#C77700" />
                <Kpi label="Trainable" value={((tm.trainable_params ?? 0) as number).toLocaleString()} suffix="LoRA params" color="#0284C7" />
              </section>

              {/* Config */}
              <section className="af-panel p-4" style={{ background: "rgba(2,132,199,.04)", border: "1px solid rgba(2,132,199,.15)" }}>
                <p className="af-section-label">Training Configuration</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Detail label="Model" value={reportData.model || "distilgpt2"} />
                  <Detail label="Dataset" value={`${reportData.dataset_size ?? 0} prompts`} />
                  <Detail label="Mode" value={tm.real_or_simulated || "simulation"} />
                  <Detail label="LoRA Steps" value={`${tm.steps_trained ?? 0}`} />
                </div>
              </section>

              {/* Comparison items */}
              <h2 className="af-section-label text-[16px]">All Comparisons ({items.length})</h2>
              {items.map((item, idx) => {
                const open = expandedIdx === idx;
                const delta = (item.lora_score ?? 0) - (item.base_score ?? 0);

                return (
                  <div key={idx} className="af-panel overflow-hidden">
                    <div className="flex items-start gap-3 p-3 cursor-pointer select-none" onClick={() => toggle(idx)}
                      style={{ background: open ? "rgba(124,58,237,.04)" : "transparent" }}>
                      {/* Pass/Fail badge */}
                      <span className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                        style={{ background: item.passed ? "rgba(33,134,90,.12)" : "rgba(194,65,75,.12)", color: item.passed ? "#21865A" : "#C2414B" }}>
                        {item.passed ? "P" : "F"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "#1D1D1F" }}>{item.prompt}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ background: `${catColor(item.category)}18`, color: catColor(item.category) }}>
                            {catLabel(item.category)}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: "#7A7D85" }}>
                            base {item.base_score.toFixed(2)} &rarr; lora {item.lora_score.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[12px]" style={{ color: "#7A7D85" }}>{open ? "\u25B2" : "\u25BC"}</span>
                    </div>

                    {open && (
                      <div className="grid gap-4 p-4 pt-2" style={{ borderTop: "1px solid rgba(220,216,204,.4)" }}>
                        <div>
                          <span className="text-[10px] font-bold uppercase" style={{ color: "#7A7D85" }}>Prompt</span>
                          <p className="mt-1 text-[13px] p-3 rounded-lg font-mono" style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}>
                            {item.prompt}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase" style={{ color: "#7A7D85" }}>Target Response</span>
                          <p className="mt-1 text-[13px] p-3 rounded-lg" style={{ background: "rgba(33,134,90,.06)", border: "1px solid rgba(33,134,90,.2)", color: "#21865A" }}>
                            {item.target}
                          </p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between">
                              <span className="text-[10px] font-bold uppercase" style={{ color: "#5A6E86" }}>Base Model</span>
                              <span className="text-[10px] font-mono" style={{ color: "#5A6E86" }}>score: {item.base_score.toFixed(3)}</span>
                            </div>
                            <p className="mt-1 text-[12px] font-mono p-3 rounded-lg break-all" style={{ background: "#FAF9F6", border: "1px solid #DCD8CC", color: "#575A60", maxHeight: "180px", overflowY: "auto" }}>
                              {item.base_response}
                            </p>
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <span className="text-[10px] font-bold uppercase" style={{ color: "#7C3AED" }}>LoRA Patched</span>
                              <span className="text-[10px] font-mono" style={{ color: item.passed ? "#21865A" : "#C2414B" }}>score: {item.lora_score.toFixed(3)}</span>
                            </div>
                            <p className="mt-1 text-[12px] font-mono p-3 rounded-lg break-all" style={{
                              background: item.passed ? "rgba(33,134,90,.04)" : "rgba(194,65,75,.04)",
                              border: `1px solid ${item.passed ? "rgba(33,134,90,.3)" : "rgba(194,65,75,.2)"}`,
                              color: "#1D1D1F", maxHeight: "180px", overflowY: "auto",
                            }}>
                              {item.lora_response}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono px-3 py-2 rounded-lg" style={{
                          background: delta > 0 ? "rgba(33,134,90,.06)" : "rgba(194,65,75,.06)",
                          color: delta > 0 ? "#21865A" : "#C2414B",
                        }}>
                          <strong>Score delta:</strong> {item.base_score.toFixed(3)} &rarr; {item.lora_score.toFixed(3)}
                          ({delta > 0 ? "+" : ""}{delta.toFixed(3)}) &mdash;
                          {item.passed ? " LoRA improved this response" : " LoRA did not sufficiently improve this response"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @media print {
          .af-topbar, button, .af-brand-link, style { display: none !important; }
          .af-page { background: white; }
          * { box-shadow: none !important; text-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ---- KPI card ---- */
function Kpi({ label, value, suffix, color }: { label: string; value: string | number; suffix: string; color: string }) {
  return (
    <div className="af-metric">
      <span className="af-metric-label">{label}</span>
      <span className="af-metric-value af-mono" style={{ color }}>
        {value}
        <span className="ml-1 text-[13px] font-semibold text-[#7A7D85]">{suffix}</span>
      </span>
    </div>
  );
}

/* ---- Detail row ---- */
function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ background: "#FDFDFD", borderColor: "#DCD8CC" }}>
      <span className="af-meta font-semibold">{label}</span>
      <span className="af-mono mt-1 block break-all text-[13px] font-semibold text-[#1D1D1F]">{value}</span>
    </div>
  );
}
