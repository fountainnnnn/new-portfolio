/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ArenaHudProps {
  currentWave: number;
  currentAttackIndex: number;
  totalAttacks: number;
  mode: 'initial' | 'patched' | 'retest';
  integrity: number;
  shield: number;
  score: number;
}

/* ------------------------------------------------------------------ */
/*  Color helpers — exact palette from tailwind.config.ts             */
/* ------------------------------------------------------------------ */

function integrityColor(value: number): string {
  if (value > 70) return '#4ADE80'; /* success */
  if (value > 35) return '#FBBF24'; /* warning */
  return '#F87171'; /* danger */
}

function modeLabel(mode: ArenaHudProps['mode']): string {
  switch (mode) {
    case 'retest':
      return 'RETEST';
    case 'patched':
      return 'PATCHED';
    default:
      return 'INITIAL';
  }
}

function modeAccent(mode: ArenaHudProps['mode']): string {
  switch (mode) {
    case 'retest':
      return '#A78BFA'; /* purple */
    case 'patched':
      return '#22D3EE'; /* cyan */
    default:
      return '#5A6E86'; /* text-muted */
  }
}

/* ------------------------------------------------------------------ */
/*  Main HUD                                                         */
/* ------------------------------------------------------------------ */

export default function ArenaHud({
  currentWave,
  currentAttackIndex,
  totalAttacks,
  mode,
  integrity,
  shield,
  score,
}: ArenaHudProps) {
  const intColor = integrityColor(integrity);
  const attackLabel = `${String(Math.min(currentAttackIndex + 1, totalAttacks)).padStart(2, '0')}/${totalAttacks}`;
  const waveLabel = String(currentWave).padStart(2, '0');

  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between pointer-events-none">
      {/* ---- Left cluster: Wave / Attack / Mode ---- */}
      <div className="flex items-center gap-2">
        <Chip
          label="WAVE"
          value={waveLabel}
          accent="#22D3EE"
        />
        <Chip
          label="ATTACK"
          value={attackLabel}
        />
        <Chip
          label="MODE"
          value={modeLabel(mode)}
          accent={modeAccent(mode)}
        />
      </div>

      {/* ---- Right cluster: Integrity bar / Shield bar / Score ---- */}
      <div className="flex items-center gap-2">
        <BarChip
          label="INTEGRITY"
          value={integrity}
          color={intColor}
          barWidth={64}
        />
        <BarChip
          label="SHIELD"
          value={shield}
          color="#22D3EE"
          barWidth={56}
        />
        <Chip
          label="SCORE"
          value={String(score)}
          accent="#FBBF24"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chip  – compact label/value badge                                 */
/* ------------------------------------------------------------------ */

function Chip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="px-2.5 py-1 rounded-lg"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        border: '1px solid rgba(110, 130, 160, 0.12)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="text-[9px] uppercase tracking-wider leading-tight"
        style={{ color: '#5A6E86' }}
      >
        {label}
      </div>
      <div
        className="text-[11px] font-bold font-mono leading-tight"
        style={{ color: accent ?? '#E8EDF4' }}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BarChip – label with inline progress bar + percentage             */
/* ------------------------------------------------------------------ */

function BarChip({
  label,
  value,
  color,
  barWidth,
}: {
  label: string;
  value: number;
  color: string;
  barWidth: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className="px-2.5 py-1 rounded-lg"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        border: '1px solid rgba(110, 130, 160, 0.12)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="text-[9px] uppercase tracking-wider leading-tight"
        style={{ color: '#5A6E86' }}
      >
        {label}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: barWidth,
            height: 5,
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${clamped}%`, background: color }}
          />
        </div>
        <span
          className="text-[11px] font-bold font-mono tabular-nums leading-none"
          style={{ color }}
        >
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  );
}
