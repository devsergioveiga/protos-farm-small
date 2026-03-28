import { LineChart, Line, ResponsiveContainer } from 'recharts';
import './IndicatorCard.css';

interface SparklinePoint {
  month: number;
  value: number;
}

interface IndicatorCardProps {
  label: string;
  value: string | null;
  unit?: string;
  tooltip: string;
  sparklineData: SparklinePoint[];
}

export default function IndicatorCard({
  label,
  value,
  tooltip,
  sparklineData,
}: IndicatorCardProps) {
  const hasSparkline = sparklineData.length >= 2;

  return (
    <div className="indicator-card" title={tooltip}>
      <div className="indicator-card__label">{label}</div>
      <div className={`indicator-card__value ${value === null ? 'indicator-card__value--na' : ''}`}>
        {value ?? 'N/D'}
      </div>
      {hasSparkline ? (
        <div className="indicator-card__sparkline" aria-hidden="true">
          <ResponsiveContainer width="100%" height={48}>
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                dot={false}
                stroke="var(--color-primary-500)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="indicator-card__sparkline-empty" aria-hidden="true">
          --
        </div>
      )}
    </div>
  );
}
