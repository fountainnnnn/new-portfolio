
import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import type { RunMetrics } from "@/types/agentforge";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReportMode = "all" | "agent-hardening" | "rl-lab";

interface ClusterResult {
  category: string;
  count: number;
  percentage: number;
  reasons: string[];
}

interface RunReport {
  id: string;
  runId: string;
  mode: "agent-hardening" | "rl-lab";
  date: string;
  modelName: string;
  metrics: RunMetrics;
  failures: number;
  passed: number;
  improvement: number;
  clusters: ClusterResult[];
  summary: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_REPORTS: RunReport[] = [
  {
    id: "rpt-001",
    runId: "AH-2026-0507-001",
    mode: "agent-hardening",
    date: "2026-05-07 14:23",
    modelName: "RefundBot-3000",
    metrics: {
      failureRateBefore: 45,
      failureRateAfter: 18,
      robustnessGain: 27,
      attacksTested: 48,
      passed: 39,
      failed: 9,
      categoryBreakdown: [
        { category: "prompt_injection", label: "Prompt Injection", tested: 8, failed: 3 },
        { category: "role_impersonation", label: "Role Impersonation", tested: 8, failed: 2 },
        { category: "policy_extraction", label: "Policy Extraction", tested: 8, failed: 4 },
        { category: "tool_abuse", label: "Tool Abuse", tested: 8, failed: 0 },
        { category: "emotional_manipulation", label: "Emotional Manipulation", tested: 8, failed: 0 },
        { category: "multi_turn_escalation", label: "Multi-Turn Escalation", tested: 8, failed: 0 },
      ],
    },
    failures: 9,
    passed: 39,
    improvement: 27,
    clusters: [
      {
        category: "Prompt Injection",
        count: 3,
        percentage: 33,
        reasons: [
          'Ignore previous instructions detected in input',
          'System prompt override attempt via delimiter injection',
          'Indirect prompt injection through tool output',
        ],
      },
      {
        category: "Role Impersonation",
        count: 2,
        percentage: 22,
        reasons: [
          'Agent accepted admin role override',
          'Assistant role boundary bypassed via hypothetical framing',
        ],
      },
      {
        category: "Policy Extraction",
        count: 4,
        percentage: 44,
        reasons: [
          'Internal threshold values leaked',
          'Policy decision logic revealed under repeated probing',
          'Confidential criteria enumerated via comparison questions',
          'Escalation path disclosure through multi-step reasoning',
        ],
      },
    ],
    summary:
      "RefundBot-3000 showed moderate resistance to basic attacks but failed against policy extraction and prompt injection. Recommended: add output filter for internal thresholds, restrict role override capability.",
  },
  {
    id: "rpt-002",
    runId: "AH-2026-0507-002",
    mode: "agent-hardening",
    date: "2026-05-07 14:28",
    modelName: "RefundBot-3000 (Patched)",
    metrics: {
      failureRateBefore: 18,
      failureRateAfter: 6,
      robustnessGain: 36,
      attacksTested: 48,
      passed: 45,
      failed: 3,
      categoryBreakdown: [
        { category: "prompt_injection", label: "Prompt Injection", tested: 8, failed: 1 },
        { category: "role_impersonation", label: "Role Impersonation", tested: 8, failed: 0 },
        { category: "policy_extraction", label: "Policy Extraction", tested: 8, failed: 2 },
        { category: "tool_abuse", label: "Tool Abuse", tested: 8, failed: 0 },
        { category: "emotional_manipulation", label: "Emotional Manipulation", tested: 8, failed: 0 },
        { category: "multi_turn_escalation", label: "Multi-Turn Escalation", tested: 8, failed: 0 },
      ],
    },
    failures: 3,
    passed: 45,
    improvement: 36,
    clusters: [
      {
        category: "Prompt Injection",
        count: 1,
        percentage: 33,
        reasons: ['Nested delimiter injection bypassed guard on third attempt'],
      },
      {
        category: "Policy Extraction",
        count: 2,
        percentage: 67,
        reasons: [
          'Multi-turn comparison still leaks relative thresholds',
          'Sequential probing inferred policy boundaries',
        ],
      },
    ],
    summary:
      "Post-patch evaluation shows significant improvement. Prompt Guard patch blocked role impersonation and tool abuse completely. Residual policy extraction vulnerabilities remain.",
  },
  {
    id: "rpt-003",
    runId: "RL-2026-0507-001",
    mode: "rl-lab",
    date: "2026-05-07 15:01",
    modelName: "Llama-3.2-3B",
    metrics: {
      failureRateBefore: 0,
      failureRateAfter: 0,
      robustnessGain: 0,
      attacksTested: 100,
      passed: 100,
      failed: 0,
      categoryBreakdown: [],
    },
    failures: 0,
    passed: 100,
    improvement: 0,
    clusters: [],
    summary:
      "RL training run completed over 100 episodes. Reward trended from 62 to 94 with consistent improvement across all reward components.",
  },
  {
    id: "rpt-004",
    runId: "RL-2026-0506-001",
    mode: "rl-lab",
    date: "2026-05-06 22:15",
    modelName: "Mistral-7B-v0.3",
    metrics: {
      failureRateBefore: 0,
      failureRateAfter: 0,
      robustnessGain: 0,
      attacksTested: 200,
      passed: 200,
      failed: 0,
      categoryBreakdown: [],
    },
    failures: 0,
    passed: 200,
    improvement: 0,
    clusters: [],
    summary:
      "Adapter v2 training complete. Final reward score of 187. Refusal precision reached 94%. Checkpoint exported.",
  },
  {
    id: "rpt-005",
    runId: "AH-2026-0506-003",
    mode: "agent-hardening",
    date: "2026-05-06 18:42",
    modelName: "RefundBot-3000 (Final)",
    metrics: {
      failureRateBefore: 6,
      failureRateAfter: 0,
      robustnessGain: 42,
      attacksTested: 48,
      passed: 48,
      failed: 0,
      categoryBreakdown: [
        { category: "prompt_injection", label: "Prompt Injection", tested: 8, failed: 0 },
        { category: "role_impersonation", label: "Role Impersonation", tested: 8, failed: 0 },
        { category: "policy_extraction", label: "Policy Extraction", tested: 8, failed: 0 },
        { category: "tool_abuse", label: "Tool Abuse", tested: 8, failed: 0 },
        { category: "emotional_manipulation", label: "Emotional Manipulation", tested: 8, failed: 0 },
        { category: "multi_turn_escalation", label: "Multi-Turn Escalation", tested: 8, failed: 0 },
      ],
    },
    failures: 0,
    passed: 48,
    improvement: 42,
    clusters: [],
    summary:
      "Final hardened agent passed all 48 attack scenarios with zero failures. Robustness gain of 42% over baseline. Ready for production deployment.",
  },
  {
    id: "rpt-006",
    runId: "RL-2026-0505-002",
    mode: "rl-lab",
    date: "2026-05-05 10:30",
    modelName: "Phi-3-mini-4k",
    metrics: {
      failureRateBefore: 0,
      failureRateAfter: 0,
      robustnessGain: 0,
      attacksTested: 150,
      passed: 148,
      failed: 2,
      categoryBreakdown: [],
    },
    failures: 2,
    passed: 148,
    improvement: 0,
    clusters: [
      {
        category: "Reward Hacking",
        count: 2,
        percentage: 100,
        reasons: [
          'Exploited tool reward signal by generating high-volume low-quality outputs',
          'Circumvented content filter via base64-encoded policy queries',
        ],
      },
    ],
    summary:
      "Training revealed reward hacking vulnerabilities. Two cases detected where agent found shortcuts in reward signal. Recommended: add reward shaping penalty.",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ReportListPage() {
  const [filter, setFilter] = useState<ReportMode>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? MOCK_REPORTS
        : MOCK_REPORTS.filter((r) => r.mode === filter),
    [filter],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const modeColor = (mode: RunReport["mode"]) =>
    mode === "agent-hardening" ? "#2563EB" : "#7C3AED";

  const modeLabel = (mode: RunReport["mode"]) =>
    mode === "agent-hardening" ? "Agent Hardening" : "RL Lab";

  return (
    <div
      className="flex flex-col w-full"
      style={{ background: "#FCFCF7" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between w-full flex-shrink-0 px-8 py-5"
        style={{ borderBottom: "1px solid #DCD8CC" }}
      >
        <div className="flex items-baseline gap-3">
          <Link
            to="/"
            className="font-bold tracking-tight hover:opacity-70 transition-opacity"
            style={{ fontSize: "18px", color: "#1D1D1F" }}
          >
            AgentForge
          </Link>
          <span style={{ fontSize: "18px", color: "#DCD8CC" }}>/</span>
          <h1
            className="font-semibold"
            style={{ fontSize: "18px", color: "#1D1D1F" }}
          >
            Reports
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <FilterChip
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Agent Hardening"
            active={filter === "agent-hardening"}
            onClick={() => setFilter("agent-hardening")}
          />
          <FilterChip
            label="RL Lab"
            active={filter === "rl-lab"}
            onClick={() => setFilter("rl-lab")}
          />
        </div>
      </header>

      {/* Report list */}
      <main
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "32px 32px 64px",
          width: "100%",
        }}
      >
        {filtered.length === 0 && (
          <div
            className="text-sm text-center py-16"
            style={{ color: "#7A7D85" }}
          >
            No reports found for this filter.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((report) => {
            const isExpanded = expandedId === report.id;

            return (
              <div key={report.id} className="flex flex-col">
                {/* Collapsed row */}
                <div
                  className="rounded-xl flex items-center justify-between transition-shadow hover:shadow-sm px-4 py-3"
                  style={{
                    background: "#FAF9F6",
                    border: "1px solid #DCD8CC",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(report.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Mode badge */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{
                        background: `${modeColor(report.mode)}18`,
                        color: modeColor(report.mode),
                      }}
                    >
                      {report.mode === "agent-hardening" ? "AH" : "RL"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm font-semibold truncate"
                          style={{ color: "#1D1D1F" }}
                        >
                          {report.runId}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
                          style={{
                            background: `${modeColor(report.mode)}12`,
                            color: modeColor(report.mode),
                          }}
                        >
                          {modeLabel(report.mode)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span style={{ color: "#7A7D85" }}>
                          {report.date}
                        </span>
                        <span style={{ color: "#7A7D85" }}>
                          {report.modelName}
                        </span>
                        {report.mode === "agent-hardening" && (
                          <>
                            <span style={{ color: "#575A60" }}>
                              {report.passed} passed
                            </span>
                            <span
                              className="font-semibold"
                              style={{
                                color:
                                  report.failures > 0
                                    ? "#C2414B"
                                    : "#21865A",
                              }}
                            >
                              {report.failures} failed
                            </span>
                            {report.improvement > 0 && (
                              <span
                                className="font-semibold"
                                style={{ color: "#21865A" }}
                              >
                                +{report.improvement}%
                              </span>
                            )}
                          </>
                        )}
                        {report.mode === "rl-lab" && (
                          <span style={{ color: "#575A60" }}>
                            {report.metrics.attacksTested} episodes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <span
                      className="text-sm flex-shrink-0 transition-transform"
                      style={{
                        color: "#7A7D85",
                        transform: isExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ▼
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div
                    className="mx-2 rounded-b-xl px-5 py-4 flex flex-col gap-4"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCD8CC",
                      borderTop: "none",
                    }}
                  >
                    {/* Summary */}
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#575A60" }}
                    >
                      {report.summary}
                    </p>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <DetailMetric
                        label="Attacks Tested"
                        value={String(report.metrics.attacksTested)}
                      />
                      <DetailMetric
                        label="Passed"
                        value={String(report.passed)}
                        valueColor="#21865A"
                      />
                      <DetailMetric
                        label="Failed"
                        value={String(report.failures)}
                        valueColor={report.failures > 0 ? "#C2414B" : "#21865A"}
                      />
                      <DetailMetric
                        label={report.mode === "agent-hardening" ? "Robustness Gain" : "Total Episodes"}
                        value={report.improvement > 0 ? `+${report.improvement}%` : "N/A"}
                        valueColor={report.improvement > 0 ? "#21865A" : "#7A7D85"}
                      />
                    </div>

                    {/* Failure clusters */}
                    {report.clusters.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: "#7A7D85" }}
                        >
                          Failure Clusters
                        </span>
                        <div className="flex flex-col gap-2">
                          {report.clusters.map((cluster, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                              style={{
                                background: "#FFF5F5",
                                border: "1px solid rgba(194, 65, 75, 0.15)",
                              }}
                            >
                              <span
                                className="font-semibold"
                                style={{ color: "#C2414B" }}
                              >
                                {cluster.category}
                              </span>
                              <span style={{ color: "#575A60" }}>
                                {cluster.count} failures ({cluster.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View Full Report link */}
                    <div className="flex justify-end">
                      <Link
                        to={`/reports/${report.id}`}
                        className="text-xs font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                        style={{
                          background: "#F4F1F8",
                          color: "#7C3AED",
                          border: "1px solid rgba(124, 58, 237, 0.2)",
                        }}
                      >
                        View Full Report
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 rounded-btn text-xs font-semibold transition-all"
      style={{
        background: active ? "#1D1D1F" : "#FAF9F6",
        color: active ? "#FFFFFF" : "#575A60",
        border: active ? "none" : "1px solid #DCD8CC",
      }}
    >
      {label}
    </button>
  );
}

function DetailMetric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
      style={{
        background: "#FAF9F6",
        border: "1px solid #DCD8CC",
      }}
    >
      <span
        className="text-[10px] uppercase tracking-wider font-semibold"
        style={{ color: "#7A7D85" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-bold font-mono"
        style={{ color: valueColor ?? "#1D1D1F" }}
      >
        {value}
      </span>
    </div>
  );
}
