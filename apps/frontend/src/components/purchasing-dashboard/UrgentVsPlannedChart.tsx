import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface UrgentVsPlannedChartProps {
  data: { month: string; urgent: number; planned: number }[];
}

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

function formatMonthLabel(month: string): string {
  const parts = month.split('-');
  const monthNum = parts[1] ?? '';
  return MONTH_ABBR[monthNum] ?? month;
}

export default function UrgentVsPlannedChart({ data }: UrgentVsPlannedChartProps) {
  const transformed = data.map((item) => ({
    ...item,
    label: formatMonthLabel(item.month),
  }));

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="sr-only">Urgentes vs planejadas</figcaption>
      <div aria-label="Grafico de barras empilhadas: requisicoes urgentes vs planejadas por mes">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={transformed} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
            <XAxis
              dataKey="label"
              tick={{
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: 12,
                fill: 'var(--color-neutral-500)',
              }}
            />
            <YAxis
              tick={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fill: 'var(--color-neutral-500)',
              }}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(
                value: number | string | (string | number)[] | undefined,
                name: string | undefined,
              ) => [
                typeof value === 'number' ? String(value) : String(value ?? ''),
                name === 'urgent' ? 'Urgentes' : name === 'planned' ? 'Planejadas' : (name ?? ''),
              ]}
            />
            <Legend
              formatter={(value: string) => (
                <span
                  style={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: 12,
                    color: 'var(--color-neutral-700)',
                  }}
                >
                  {value === 'urgent' ? 'Urgentes' : value === 'planned' ? 'Planejadas' : value}
                </span>
              )}
            />
            <Bar dataKey="urgent" name="urgent" stackId="a" fill="#C62828" radius={[0, 0, 0, 0]} />
            <Bar
              dataKey="planned"
              name="planned"
              stackId="a"
              fill="#2E7D32"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
