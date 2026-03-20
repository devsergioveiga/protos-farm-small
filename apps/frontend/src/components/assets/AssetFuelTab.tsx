import { useState } from 'react';
import { Fuel, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useFuelRecords } from '@/hooks/useFuelRecords';
import { useAssetDetail } from '@/hooks/useAssetDetail';
import type { AssetType } from '@/types/asset';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

function formatDecimal(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined) return 'N/D';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/D';
  return `${num.toFixed(2)}${suffix}`;
}

// ─── AssetFuelTab ─────────────────────────────────────────────────────

interface AssetFuelTabProps {
  assetId: string;
  assetType: AssetType;
}

export default function AssetFuelTab({ assetId, assetType }: AssetFuelTabProps) {
  const { records, stats, loading, error, createRecord, deleteRecord } = useFuelRecords(assetId);

  // Get farmId from asset detail (needed for create)
  const { asset } = useAssetDetail(assetId);
  const farmId = asset?.farmId ?? '';

  // Form state
  const [fuelDate, setFuelDate] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [hourmeterAtFuel, setHourmeterAtFuel] = useState('');
  const [odometerAtFuel, setOdometerAtFuel] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fuelDate || !liters || !pricePerLiter) {
      setFormError('Preencha os campos obrigatorios: data, litros e preco/litro.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    setSuccessMsg(null);
    try {
      await createRecord({
        assetId,
        farmId,
        fuelDate,
        liters,
        pricePerLiter,
        hourmeterAtFuel: hourmeterAtFuel || undefined,
        odometerAtFuel: odometerAtFuel || undefined,
        notes: notes || undefined,
      });
      setFuelDate('');
      setLiters('');
      setPricePerLiter('');
      setHourmeterAtFuel('');
      setOdometerAtFuel('');
      setNotes('');
      setSuccessMsg('Abastecimento registrado com sucesso.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      setFormError('Nao foi possivel registrar o abastecimento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRecord(id);
    } catch {
      // Silent fail
    }
  }

  // Benchmarking comparison
  const isBenchmarkAvailable =
    stats?.assetCostPerHour !== null && stats?.assetCostPerHour !== undefined;
  const isAboveAverage =
    isBenchmarkAvailable &&
    stats?.fleetCostPerHour !== null &&
    stats?.fleetCostPerHour !== undefined &&
    (stats.assetCostPerHour as number) > (stats.fleetCostPerHour as number);

  return (
    <div className="fuel-tab">
      {/* Stats cards */}
      {stats && (
        <div className="fuel-tab__stats-grid">
          <div className="fuel-tab__stat-card">
            <div className="fuel-tab__stat-label">Custo/hora este ativo</div>
            <div className="fuel-tab__stat-value">
              {formatDecimal(stats.assetCostPerHour, ' R$/h')}
            </div>
            {isBenchmarkAvailable && (
              <div
                className={`fuel-tab__benchmark${isAboveAverage ? ' fuel-tab__benchmark--above' : ' fuel-tab__benchmark--ok'}`}
              >
                {isAboveAverage ? (
                  <TrendingUp size={14} aria-hidden="true" />
                ) : stats.assetCostPerHour === stats.fleetCostPerHour ? (
                  <Minus size={14} aria-hidden="true" />
                ) : (
                  <TrendingDown size={14} aria-hidden="true" />
                )}
                {isAboveAverage ? 'Acima da media' : 'Dentro da media'}
              </div>
            )}
          </div>

          <div className="fuel-tab__stat-card">
            <div className="fuel-tab__stat-label">Custo/hora media frota</div>
            <div className="fuel-tab__stat-value">
              {formatDecimal(stats.fleetCostPerHour, ' R$/h')}
            </div>
          </div>

          <div className="fuel-tab__stat-card">
            <div className="fuel-tab__stat-label">Total litros</div>
            <div className="fuel-tab__stat-value">{formatDecimal(stats.totalLiters, ' L')}</div>
          </div>

          <div className="fuel-tab__stat-card">
            <div className="fuel-tab__stat-label">Total custo</div>
            <div className="fuel-tab__stat-value">{formatBRL(stats.totalCost)}</div>
          </div>
        </div>
      )}

      {/* Add fuel record form */}
      <section className="fuel-tab__form-section">
        <h3 className="fuel-tab__section-title">Registrar abastecimento</h3>
        <form onSubmit={(e) => void handleSubmit(e)} className="fuel-tab__form">
          <div className="fuel-tab__form-row">
            <div className="fuel-tab__form-field">
              <label htmlFor="fuel-date" className="fuel-tab__label">
                Data *
              </label>
              <input
                id="fuel-date"
                type="date"
                className="fuel-tab__input"
                value={fuelDate}
                onChange={(e) => setFuelDate(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="fuel-tab__form-field">
              <label htmlFor="fuel-liters" className="fuel-tab__label">
                Litros *
              </label>
              <input
                id="fuel-liters"
                type="number"
                step="0.01"
                min="0"
                className="fuel-tab__input"
                placeholder="0.00"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="fuel-tab__form-field">
              <label htmlFor="fuel-price" className="fuel-tab__label">
                R$/Litro *
              </label>
              <input
                id="fuel-price"
                type="number"
                step="0.001"
                min="0"
                className="fuel-tab__input"
                placeholder="0.000"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(e.target.value)}
                aria-required="true"
              />
            </div>

            {(assetType === 'MAQUINA' || assetType === 'IMPLEMENTO') && (
              <div className="fuel-tab__form-field">
                <label htmlFor="fuel-hourmeter" className="fuel-tab__label">
                  Horimetro
                </label>
                <input
                  id="fuel-hourmeter"
                  type="number"
                  step="0.1"
                  min="0"
                  className="fuel-tab__input"
                  placeholder="h"
                  value={hourmeterAtFuel}
                  onChange={(e) => setHourmeterAtFuel(e.target.value)}
                />
              </div>
            )}

            {assetType === 'VEICULO' && (
              <div className="fuel-tab__form-field">
                <label htmlFor="fuel-odometer" className="fuel-tab__label">
                  Odometro
                </label>
                <input
                  id="fuel-odometer"
                  type="number"
                  step="1"
                  min="0"
                  className="fuel-tab__input"
                  placeholder="km"
                  value={odometerAtFuel}
                  onChange={(e) => setOdometerAtFuel(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="fuel-tab__form-row">
            <div className="fuel-tab__form-field fuel-tab__form-field--full">
              <label htmlFor="fuel-notes" className="fuel-tab__label">
                Observacoes
              </label>
              <input
                id="fuel-notes"
                type="text"
                className="fuel-tab__input"
                placeholder="Opcional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="fuel-tab__form-field fuel-tab__form-field--btn">
              <button
                type="submit"
                className="fuel-tab__btn fuel-tab__btn--secondary"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Registrando...' : 'Registrar abastecimento'}
              </button>
            </div>
          </div>

          {formError && (
            <p className="fuel-tab__form-error" role="alert">
              {formError}
            </p>
          )}
          {successMsg && (
            <p className="fuel-tab__form-success" role="status">
              {successMsg}
            </p>
          )}
        </form>
      </section>

      {/* Records list */}
      <section className="fuel-tab__list-section">
        {loading && (
          <div className="fuel-tab__loading" role="status" aria-label="Carregando abastecimentos">
            <div className="fuel-tab__skeleton" />
            <div className="fuel-tab__skeleton" />
          </div>
        )}

        {error && !loading && (
          <p className="fuel-tab__error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="fuel-tab__empty">
            <Fuel size={48} aria-hidden="true" className="fuel-tab__empty-icon" />
            <p className="fuel-tab__empty-text">
              Nenhum abastecimento registrado. Registre o consumo de combustivel deste ativo.
            </p>
          </div>
        )}

        {!loading && records.length > 0 && (
          <div className="fuel-tab__table-wrapper">
            <table className="fuel-tab__table">
              <caption className="sr-only">Historico de abastecimentos</caption>
              <thead>
                <tr>
                  <th scope="col" className="fuel-tab__th">
                    Data
                  </th>
                  <th scope="col" className="fuel-tab__th fuel-tab__th--right">
                    Litros
                  </th>
                  <th scope="col" className="fuel-tab__th fuel-tab__th--right">
                    R$/L
                  </th>
                  <th scope="col" className="fuel-tab__th fuel-tab__th--right">
                    Total
                  </th>
                  <th scope="col" className="fuel-tab__th">
                    Hodometro/Hor.
                  </th>
                  <th scope="col" className="fuel-tab__th fuel-tab__th--right">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...records]
                  .sort((a, b) => new Date(b.fuelDate).getTime() - new Date(a.fuelDate).getTime())
                  .map((rec) => (
                    <tr key={rec.id} className="fuel-tab__tr">
                      <td className="fuel-tab__td">{formatDate(rec.fuelDate)}</td>
                      <td className="fuel-tab__td fuel-tab__td--right">
                        {formatDecimal(rec.liters, ' L')}
                      </td>
                      <td className="fuel-tab__td fuel-tab__td--right">
                        {formatBRL(rec.pricePerLiter)}
                      </td>
                      <td className="fuel-tab__td fuel-tab__td--right">
                        {formatBRL(rec.totalCost)}
                      </td>
                      <td className="fuel-tab__td">
                        {rec.hourmeterAtFuel ? `${rec.hourmeterAtFuel} h` : ''}
                        {rec.odometerAtFuel ? `${rec.odometerAtFuel} km` : ''}
                        {!rec.hourmeterAtFuel && !rec.odometerAtFuel ? '—' : ''}
                      </td>
                      <td className="fuel-tab__td fuel-tab__td--right">
                        <button
                          type="button"
                          className="fuel-tab__delete-btn"
                          onClick={() => void handleDelete(rec.id)}
                          aria-label="Excluir abastecimento"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
