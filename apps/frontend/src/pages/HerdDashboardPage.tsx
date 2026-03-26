import { Beef, AlertCircle } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useHerdDashboard } from '@/hooks/useHerdDashboard';
import { CATEGORY_LABELS, SEX_LABELS } from '@/types/animal';
import type { AnimalCategory, AnimalSex } from '@/types/animal';
import './HerdDashboardPage.css';

const CATEGORY_ORDER: AnimalCategory[] = [
  'VACA_LACTACAO',
  'VACA_SECA',
  'NOVILHA',
  'NOVILHO',
  'BEZERRO',
  'BEZERRA',
  'TOURO_REPRODUTOR',
  'DESCARTE',
];

const CATEGORY_BAR_CLASS: Record<AnimalCategory, string> = {
  VACA_LACTACAO: 'herd-dashboard__bar-fill--vaca-lactacao',
  VACA_SECA: 'herd-dashboard__bar-fill--vaca-seca',
  NOVILHA: 'herd-dashboard__bar-fill--novilha',
  NOVILHO: 'herd-dashboard__bar-fill--novilho',
  BEZERRO: 'herd-dashboard__bar-fill--bezerro',
  BEZERRA: 'herd-dashboard__bar-fill--bezerra',
  TOURO_REPRODUTOR: 'herd-dashboard__bar-fill--touro',
  DESCARTE: 'herd-dashboard__bar-fill--descarte',
};

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatPct(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

export default function HerdDashboardPage() {
  const { selectedFarm } = useFarmContext();
  const { data, isLoading, error } = useHerdDashboard({
    farmId: selectedFarm?.id ?? null,
  });

  if (!selectedFarm) {
    return (
      <section className="herd-dashboard">
        <div className="herd-dashboard__empty">
          <Beef size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver o estoque de rebanho.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="herd-dashboard">
      <header className="herd-dashboard__header">
        <div>
          <h1>Estoque de rebanho</h1>
          <p>Visão geral do rebanho ativo — {selectedFarm.name}</p>
        </div>
      </header>

      {error && (
        <div className="herd-dashboard__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="herd-dashboard__skeletons">
          <div className="herd-dashboard__skeleton-hero" />
          <div className="herd-dashboard__skeleton-grid">
            <div className="herd-dashboard__skeleton-card" />
            <div className="herd-dashboard__skeleton-card" />
          </div>
          <div className="herd-dashboard__skeleton-categories">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="herd-dashboard__skeleton-cat-card" />
            ))}
          </div>
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Hero: total */}
          <div className="herd-dashboard__hero">
            <div className="herd-dashboard__hero-icon">
              <Beef size={32} aria-hidden="true" />
            </div>
            <div>
              <p className="herd-dashboard__hero-value">{formatNumber(data.total)}</p>
              <p className="herd-dashboard__hero-label">animais ativos no rebanho</p>
            </div>
          </div>

          {/* Sex distribution */}
          <div className="herd-dashboard__sex-grid">
            {(['MALE', 'FEMALE'] as AnimalSex[]).map((sex) => {
              const count = data.bySex[sex] ?? 0;
              return (
                <div key={sex} className="herd-dashboard__sex-card">
                  <div
                    className={`herd-dashboard__sex-icon herd-dashboard__sex-icon--${sex === 'MALE' ? 'male' : 'female'}`}
                  >
                    <Beef size={24} aria-hidden="true" />
                  </div>
                  <div className="herd-dashboard__sex-info">
                    <p className="herd-dashboard__sex-value">{formatNumber(count)}</p>
                    <p className="herd-dashboard__sex-label">{SEX_LABELS[sex]}</p>
                    <p className="herd-dashboard__sex-pct">{formatPct(count, data.total)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category cards */}
          <div className="herd-dashboard__section">
            <h2 className="herd-dashboard__section-title">Por categoria</h2>
            <div className="herd-dashboard__category-grid">
              {CATEGORY_ORDER.map((cat) => {
                const count = data.byCategory[cat] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={cat} className="herd-dashboard__category-card">
                    <p className="herd-dashboard__category-label">
                      {CATEGORY_LABELS[cat]}
                    </p>
                    <p className="herd-dashboard__category-value">{formatNumber(count)}</p>
                    <p className="herd-dashboard__category-pct">
                      {formatPct(count, data.total)} do rebanho
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribution bar chart */}
          <div className="herd-dashboard__section">
            <h2 className="herd-dashboard__section-title">Distribuição por categoria</h2>
            <div className="herd-dashboard__distribution">
              {CATEGORY_ORDER.map((cat) => {
                const count = data.byCategory[cat] ?? 0;
                if (count === 0) return null;
                const pct = data.total > 0 ? (count / data.total) * 100 : 0;
                return (
                  <div key={cat} className="herd-dashboard__bar-row">
                    <span className="herd-dashboard__bar-name">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <div
                      className="herd-dashboard__bar-track"
                      role="img"
                      aria-label={`${CATEGORY_LABELS[cat]}: ${formatNumber(count)} animais (${pct.toFixed(1)}%)`}
                    >
                      <div
                        className={`herd-dashboard__bar-fill ${CATEGORY_BAR_CLASS[cat]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="herd-dashboard__bar-count">{formatNumber(count)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && data && data.total === 0 && (
        <div className="herd-dashboard__empty">
          <Beef size={48} aria-hidden="true" />
          <h2>Nenhum animal cadastrado</h2>
          <p>Cadastre animais na página de Animais para visualizar o estoque do rebanho.</p>
        </div>
      )}
    </section>
  );
}
