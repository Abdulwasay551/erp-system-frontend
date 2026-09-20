"use client";

export interface FunnelStage {
  stage: string;
  count: number;
  total: string;
}

/**
 * Horizontal drop-off funnel (SVG, hand-rolled like bar-chart.tsx - no charting library
 * needed for a handful of stages). Each bar's width is proportional to that stage's
 * count relative to the first stage, with the conversion rate from the previous stage
 * called out so a drop-off is obvious at a glance.
 */
export function FunnelChart({
  stages,
  formatValue = (v) => `Rs. ${v.toLocaleString()}`,
}: {
  stages: FunnelStage[];
  formatValue?: (v: number) => string;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const widthPct = Math.max((s.count / maxCount) * 100, s.count > 0 ? 4 : 0);
        const prevCount = i > 0 ? stages[i - 1].count : null;
        const conversion = prevCount ? Math.round((s.count / prevCount) * 100) : null;
        return (
          <div key={s.stage} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.stage}</span>
              <span className="text-muted-foreground">
                {s.count} &middot; {formatValue(Number(s.total))}
                {conversion !== null && <span className="ml-2 text-xs">({conversion}% of prior stage)</span>}
              </span>
            </div>
            <div className="h-6 w-full rounded-sm bg-muted">
              <div
                className="h-6 rounded-sm bg-primary transition-all"
                style={{ width: `${widthPct}%` }}
                title={`${s.stage}: ${s.count} (${formatValue(Number(s.total))})`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
