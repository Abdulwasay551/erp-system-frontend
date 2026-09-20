"use client";

export interface FunnelStage {
  stage: string;
  count: number;
  total: string;
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/**
 * An actual tapered funnel shape (SVG polygons, hand-rolled like bar-chart.tsx - no
 * charting library needed for a handful of stages). Each segment's bottom edge matches
 * the next stage's top edge, so the whole thing reads as one continuous funnel
 * narrowing stage to stage, with the final stage tapering to a point.
 */
export function FunnelChart({
  stages,
  formatValue = (v) => `Rs. ${v.toLocaleString()}`,
}: {
  stages: FunnelStage[];
  formatValue?: (v: number) => string;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const width = 400;
  const segHeight = 72;
  const gap = 3;
  const maxSegWidth = 340;
  const height = stages.length * (segHeight + gap) - gap;

  function widthFor(count: number) {
    return Math.max((count / maxCount) * maxSegWidth, count > 0 ? 24 : 0);
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="max-w-md">
        {stages.map((s, i) => {
          const topW = widthFor(s.count);
          const nextCount = i < stages.length - 1 ? stages[i + 1].count : s.count * 0.55;
          const bottomW = widthFor(nextCount);
          const y = i * (segHeight + gap);
          const cx = width / 2;
          const points = [
            [cx - topW / 2, y],
            [cx + topW / 2, y],
            [cx + bottomW / 2, y + segHeight],
            [cx - bottomW / 2, y + segHeight],
          ]
            .map((p) => p.join(","))
            .join(" ");
          return (
            <g key={s.stage}>
              <polygon points={points} fill={COLORS[i % COLORS.length]} opacity={0.9}>
                <title>
                  {s.stage}: {s.count} ({formatValue(Number(s.total))})
                </title>
              </polygon>
              <text
                x={cx}
                y={y + segHeight / 2 - 6}
                textAnchor="middle"
                className="fill-white text-[13px] font-semibold"
              >
                {s.stage}
              </text>
              <text x={cx} y={y + segHeight / 2 + 14} textAnchor="middle" className="fill-white text-[11px]">
                {s.count} &middot; {formatValue(Number(s.total))}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        {stages.map((s, i) => {
          const prevCount = i > 0 ? stages[i - 1].count : null;
          const conversion = prevCount ? Math.round((s.count / prevCount) * 100) : null;
          return conversion !== null ? (
            <span key={s.stage}>
              {s.stage}: {conversion}% of {stages[i - 1].stage}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}
