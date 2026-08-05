"use client";

import { useId } from "react";

export interface BarChartSeries {
  label: string;
  color: string;
  data: number[];
}

/**
 * Minimal dependency-free grouped bar chart (SVG). Built by hand instead of pulling in
 * a charting library - this dashboard only ever needs a handful of daily-totals bars,
 * not interactive zooming/panning, so a real charting lib would be a lot of bundle
 * weight for little benefit here.
 */
export function BarChart({
  categories,
  series,
  height = 220,
  formatValue = (v) => v.toLocaleString(),
}: {
  categories: string[];
  series: BarChartSeries[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const gradientId = useId();
  const width = Math.max(categories.length * 28, 320);
  const padding = { top: 12, right: 8, bottom: 24, left: 8 };
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.data);
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;
  const zeroY = padding.top + chartHeight * (maxValue / range);

  const groupWidth = (width - padding.left - padding.right) / categories.length;
  const barWidth = Math.min((groupWidth - 4) / series.length, 18);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMinYMid meet"
        className="min-w-full"
      >
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} className="stroke-border" strokeWidth={1} />
        {categories.map((cat, i) => {
          const groupX = padding.left + i * groupWidth;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const value = s.data[i] ?? 0;
                const barHeight = (Math.abs(value) / range) * chartHeight;
                const x = groupX + si * (barWidth + 2) + (groupWidth - series.length * (barWidth + 2)) / 2;
                const y = value >= 0 ? zeroY - barHeight : zeroY;
                return (
                  <rect
                    key={s.label}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, value !== 0 ? 1 : 0)}
                    fill={s.color}
                    rx={2}
                  >
                    <title>
                      {cat} - {s.label}: {formatValue(value)}
                    </title>
                  </rect>
                );
              })}
              {(i % Math.ceil(categories.length / 8 || 1) === 0) && (
                <text
                  x={groupX + groupWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={10}
                >
                  {cat}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div id={gradientId} className="flex flex-wrap gap-4 px-1 pt-1">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
