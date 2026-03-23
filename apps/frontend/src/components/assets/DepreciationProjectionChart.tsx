import './DepreciationProjectionChart.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DepreciationProjectionChartProps {
  data: {
    year: number;
    month: number;
    projectedDepreciation: number;
    cumulativeDepreciation: number;
    remainingBookValue: number;
  }[];
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function DepreciationProjectionChart({ data }: DepreciationProjectionChartProps) {
  // Stub — will be fully implemented in Task 3
  void data;
  return (
    <div className="depr-projection-chart">
      <div className="depr-projection-chart__container" />
    </div>
  );
}
