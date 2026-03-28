import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, Clock, PlusCircle } from 'lucide-react';
import { useAssetWip } from '@/hooks/useAssetWip';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AssetWipContributionModal from './AssetWipContributionModal';
import './AssetWipContributionsTab.css';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface AssetWipContributionsTabProps {
  assetId: string;
  onRefresh: () => void;
  onSwitchToDepreciation?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AssetWipContributionsTab({
  assetId,
  onRefresh,
  onSwitchToDepreciation,
}: AssetWipContributionsTabProps) {
  const { summary, loading, error, fetchSummary, activate } = useAssetWip(assetId);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [depreciationConfigMissing, setDepreciationConfigMissing] = useState(false);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  // Loading skeleton
  if (loading && !summary) {
    return (
      <div className="wip-tab" role="status" aria-label="Carregando andamento">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="wip-tab__skeleton" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="wip-tab">
        <p className="wip-tab__error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!summary) return null;

  const { budget, totalContributed, budgetAlert, budgetExceeded, stages, contributions } = summary;

  // Progress bar fill percentage
  const progressPct =
    budget != null && budget > 0 ? Math.min((totalContributed / budget) * 100, 100) : 0;

  // Progress bar color class
  let progressFillClass = 'wip-tab__progress-fill--healthy';
  if (budgetExceeded) {
    progressFillClass = 'wip-tab__progress-fill--exceeded';
  } else if (budgetAlert) {
    progressFillClass = 'wip-tab__progress-fill--alert';
  }

  const saldoDisponivel = budget != null ? budget - totalContributed : null;

  async function handleActivate() {
    setActivationError(null);
    setActivating(true);
    try {
      const result = await activate();
      setShowActivateConfirm(false);
      if (result.depreciationConfigMissing) {
        setDepreciationConfigMissing(true);
      }
      onRefresh();
    } catch {
      setActivationError('Nao foi possivel ativar o ativo. Tente novamente.');
      setShowActivateConfirm(false);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="wip-tab">
      {/* Section 1 — Budget summary */}
      <section className="wip-tab__budget" aria-labelledby="wip-budget-title">
        <h3 id="wip-budget-title" className="wip-tab__section-title">
          Resumo orcamentario
        </h3>

        <dl className="wip-tab__budget-dl">
          {budget != null && (
            <div className="wip-tab__budget-row">
              <dt className="wip-tab__budget-label">Orcamento total</dt>
              <dd className="wip-tab__budget-value">{formatBRL(budget)}</dd>
            </div>
          )}
          <div className="wip-tab__budget-row">
            <dt className="wip-tab__budget-label">Total aportado</dt>
            <dd className="wip-tab__budget-value">{formatBRL(totalContributed)}</dd>
          </div>
          {saldoDisponivel != null && (
            <div className="wip-tab__budget-row">
              <dt className="wip-tab__budget-label">Saldo disponivel</dt>
              <dd
                className={`wip-tab__budget-value${saldoDisponivel < 0 ? ' wip-tab__budget-value--negative' : ''}`}
              >
                {formatBRL(saldoDisponivel)}
              </dd>
            </div>
          )}
        </dl>

        {/* Progress bar or "no budget" */}
        {budget != null ? (
          <div
            className="wip-tab__progress"
            role="progressbar"
            aria-valuenow={totalContributed}
            aria-valuemin={0}
            aria-valuemax={budget}
            aria-label={`Progresso do orcamento: ${formatBRL(totalContributed)} de ${formatBRL(budget)}`}
          >
            <div className="wip-tab__progress-track">
              <div
                className={`wip-tab__progress-fill ${progressFillClass}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="wip-tab__progress-label">{progressPct.toFixed(0)}% utilizado</span>
          </div>
        ) : (
          <p className="wip-tab__no-budget">Sem orcamento definido.</p>
        )}

        {/* Budget alert banner */}
        {budgetAlert && !budgetExceeded && (
          <div className="wip-tab__alert-banner wip-tab__alert-banner--warning" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <span>Orcamento proximo do limite. Revise os aportes planejados.</span>
          </div>
        )}

        {/* Budget exceeded banner */}
        {budgetExceeded && (
          <div className="wip-tab__alert-banner wip-tab__alert-banner--exceeded" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <span>Orcamento ultrapassado. Total aportado supera o valor autorizado.</span>
          </div>
        )}
      </section>

      {/* Section 2 — Stages */}
      {stages.length > 0 && (
        <section className="wip-tab__stages" aria-labelledby="wip-stages-title">
          <h3 id="wip-stages-title" className="wip-tab__section-title">
            Etapas
          </h3>
          <ul className="wip-tab__stages-list">
            {stages.map((stage) => (
              <li key={stage.id} className="wip-tab__stage-item">
                <span className="wip-tab__stage-name">{stage.name}</span>
                {stage.targetDate && (
                  <span className="wip-tab__stage-date">{formatDate(stage.targetDate)}</span>
                )}
                {stage.completedAt ? (
                  <span className="wip-tab__stage-chip wip-tab__stage-chip--done">
                    <CheckCircle size={14} aria-hidden="true" />
                    Concluida
                  </span>
                ) : (
                  <span className="wip-tab__stage-chip wip-tab__stage-chip--pending">
                    <Clock size={14} aria-hidden="true" />
                    Pendente
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section 3 — Contributions */}
      <section className="wip-tab__contributions" aria-labelledby="wip-contributions-title">
        <div className="wip-tab__contributions-header">
          <h3 id="wip-contributions-title" className="wip-tab__section-title">
            Aportes
            {contributions.length > 0 && (
              <span className="wip-tab__count-badge">{contributions.length}</span>
            )}
          </h3>
          <button
            type="button"
            className="wip-tab__primary-btn"
            onClick={() => setShowContributionModal(true)}
          >
            Registrar Aporte
          </button>
        </div>

        {contributions.length === 0 ? (
          <div className="wip-tab__empty">
            <PlusCircle size={48} aria-hidden="true" className="wip-tab__empty-icon" />
            <p className="wip-tab__empty-text">Nenhum aporte registrado.</p>
            <button
              type="button"
              className="wip-tab__secondary-btn"
              onClick={() => setShowContributionModal(true)}
            >
              Registrar Aporte
            </button>
          </div>
        ) : (
          <>
            {/* Table — desktop */}
            <table className="wip-tab__table">
              <caption className="sr-only">Lista de aportes registrados</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Descricao</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Valor
                  </th>
                  <th scope="col">Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.contributionDate)}</td>
                    <td>{c.description}</td>
                    <td className="wip-tab__table-value">{formatBRL(c.amount)}</td>
                    <td>{c.supplierId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cards — mobile */}
            <ul className="wip-tab__cards">
              {contributions.map((c) => (
                <li key={c.id} className="wip-tab__card">
                  <div className="wip-tab__card-row">
                    <span className="wip-tab__card-label">Data</span>
                    <span>{formatDate(c.contributionDate)}</span>
                  </div>
                  <div className="wip-tab__card-row">
                    <span className="wip-tab__card-label">Descricao</span>
                    <span>{c.description}</span>
                  </div>
                  <div className="wip-tab__card-row">
                    <span className="wip-tab__card-label">Valor</span>
                    <span className="wip-tab__card-value">{formatBRL(c.amount)}</span>
                  </div>
                  {c.supplierId && (
                    <div className="wip-tab__card-row">
                      <span className="wip-tab__card-label">Fornecedor</span>
                      <span>{c.supplierId}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Section 4 — Activation */}
      <section className="wip-tab__activation">
        {depreciationConfigMissing && (
          <div className="wip-tab__alert-banner wip-tab__alert-banner--info" role="status">
            <Info size={20} aria-hidden="true" />
            <span>
              Configure a depreciacao para que o calculo automatico funcione corretamente.
              {onSwitchToDepreciation && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="wip-tab__inline-link"
                    onClick={onSwitchToDepreciation}
                  >
                    Configurar depreciacao
                  </button>
                </>
              )}
            </span>
          </div>
        )}

        {activationError && (
          <div className="wip-tab__alert-banner wip-tab__alert-banner--exceeded" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <span>{activationError}</span>
          </div>
        )}

        <button
          type="button"
          className="wip-tab__activation-btn"
          onClick={() => setShowActivateConfirm(true)}
          disabled={activating}
        >
          Ativar Ativo
        </button>
      </section>

      {/* Contribution modal */}
      <AssetWipContributionModal
        isOpen={showContributionModal}
        onClose={() => setShowContributionModal(false)}
        onSuccess={() => {
          setShowContributionModal(false);
          void fetchSummary();
        }}
        assetId={assetId}
        stages={stages}
      />

      {/* Activate confirm */}
      <ConfirmModal
        isOpen={showActivateConfirm}
        title="Ativar imobilizado em andamento"
        message={`Esta acao e irreversivel. O ativo passara para status Ativo e comecara a depreciar no proximo ciclo. Total a ser capitalizado: ${formatBRL(totalContributed)}.`}
        confirmLabel="Confirmar ativacao"
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={activating}
        onConfirm={() => void handleActivate()}
        onCancel={() => setShowActivateConfirm(false)}
      />
    </div>
  );
}
