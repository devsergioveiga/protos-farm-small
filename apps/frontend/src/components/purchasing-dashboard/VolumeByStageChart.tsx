import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VolumeByStageChartProps {
  data: { stage: string; count: number; totalValue: number }[];
}

const STAGE_LABELS: Record<string, string> = {
  RC_PENDENTE: 'RC Pendente',
  RC_APROVADA: 'RC Aprovada',
  EM_COTACAO: 'Em Cotacao',
  OC_EMITIDA: 'OC Emitida',
  AGUARDANDO_ENTREGA: 'Ag. Entrega',
  RECEBIDO: 'Recebido',
  PAGO: 'Pago',
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function VolumeByStageChart({ data }: VolumeByStageChartProps) {
  const transformed = data.map((item) => ({
    ...item,
    label: STAGE_LABELS[item.stage] ?? item.stage,
  }));

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="sr-only">Volume por etapa</figcaption>
      <div aria-label="Grafico de barras: volume de compras por etapa do kanban">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={transformed} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
            <XAxis
              dataKey="label"
              tick={{
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: 11,
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
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const item = payload[0]?.payload as
                  | { count: number; totalValue: number }
                  | undefined;
                return (
                  <div
                    style={{
                      background: 'var(--color-neutral-0)',
                      border: '1px solid var(--color-neutral-200)',
                      borderRadius: 4,
                      padding: '8px 12px',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: 13,
                    }}
                  >
                    <strong>{label as string}</strong>
                    <div>Quantidade: {item?.count ?? 0}</div>
                    <div>Valor total: {formatBRL(item?.totalValue ?? 0)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" name="count" fill="#2E7D32" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
