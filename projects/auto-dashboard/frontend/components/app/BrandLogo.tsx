import { cn } from "@/lib/utils";

/**
 * Decidr brand mark.
 *
 * The mark is a stylised "D" rendered with:
 *   - a thick indigo-to-violet outer letterform,
 *   - three ascending bar-chart bars sitting in the negative space, and
 *   - an upward-arching arrow that pierces through the letter.
 *
 * Provide as a self-contained SVG so it stays crisp at every scale and so we
 * never depend on a raster asset that has to be re-exported when the theme
 * changes.
 */

interface BrandMarkProps {
  className?: string;
  /** Total size in CSS pixels (the SVG keeps its aspect ratio). */
  size?: number;
}

export function BrandMark({ className, size }: BrandMarkProps) {
  const dimension = size ?? undefined;
  return (
    <svg
      aria-hidden="true"
      className={cn("block", className)}
      fill="none"
      height={dimension}
      viewBox="0 0 200 200"
      width={dimension}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="decidr-d" x1="0" x2="200" y1="0" y2="200">
          <stop offset="0%" stopColor="#2541B2" />
          <stop offset="60%" stopColor="#3B3FBE" />
          <stop offset="100%" stopColor="#6E40C9" />
        </linearGradient>
        <linearGradient id="decidr-bar" x1="0" x2="0" y1="200" y2="0">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#7CC0FF" />
        </linearGradient>
        <linearGradient id="decidr-arrow" x1="20" x2="180" y1="180" y2="40">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* The "D" - filled outer shape with the inner counter cut out. */}
      <path
        d="M 36 22 H 104 A 78 78 0 0 1 104 178 H 36 Z M 64 50 V 150 H 104 A 50 50 0 0 0 104 50 Z"
        fill="url(#decidr-d)"
        fillRule="evenodd"
      />

      {/* Ascending bar chart inside the D. Sits on the baseline (y=146). */}
      <g>
        <rect fill="url(#decidr-bar)" height="36" rx="2.5" width="11" x="70" y="110" />
        <rect fill="url(#decidr-bar)" height="56" rx="2.5" width="11" x="86" y="90" />
        <rect fill="url(#decidr-bar)" height="80" rx="2.5" width="11" x="102" y="66" />
      </g>

      {/* Upward swooping arrow that crosses the bars. */}
      <path
        d="M 44 152 Q 90 156 116 122 T 158 64"
        fill="none"
        stroke="url(#decidr-arrow)"
        strokeLinecap="round"
        strokeWidth="11"
      />
      {/* Arrow head. */}
      <path
        d="M 138 50 L 168 56 L 158 84 Z"
        fill="url(#decidr-arrow)"
      />
    </svg>
  );
}

interface BrandLogoProps {
  className?: string;
  /** Show the tagline under the wordmark. */
  showTagline?: boolean;
  /** "icon" - mark only. "row" - mark + wordmark side by side. "stacked" - centred mark + wordmark + tagline. */
  variant?: "icon" | "row" | "stacked";
  /** Override mark size. Defaults: row 28px, stacked 56px, icon 36px. */
  markSize?: number;
  /** Use the white-on-dark variant (mark stays the same; text turns white). */
  inverse?: boolean;
}

export function BrandLogo({
  className,
  showTagline,
  variant = "row",
  markSize,
  inverse = false,
}: BrandLogoProps) {
  if (variant === "icon") {
    return <BrandMark className={className} size={markSize ?? 36} />;
  }

  const wordmarkColor = inverse ? "#FFFFFF" : "#0F172A";
  const taglineColor = inverse ? "rgba(255,255,255,0.72)" : "#475569";

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <BrandMark size={markSize ?? 56} />
        <div className="flex flex-col items-center">
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ color: wordmarkColor }}
          >
            Decidr
          </span>
          {showTagline ? (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: taglineColor }}
            >
              Turn data into decisions
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={markSize ?? 28} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ color: wordmarkColor }}
        >
          Decidr
        </span>
        {showTagline ? (
          <span
            className="text-[10px] font-medium uppercase tracking-[0.16em]"
            style={{ color: taglineColor }}
          >
            Turn data into decisions
          </span>
        ) : null}
      </div>
    </div>
  );
}
