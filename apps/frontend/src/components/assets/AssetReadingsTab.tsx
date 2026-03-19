import { useState } from 'react';
import { Gauge, AlertTriangle } from 'lucide-react';
import { useMeterReadings } from '@/hooks/useMeterReadings';
import type { AssetType } from '@/types/asset';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

function formatDecimal(value: string | null | undefined): string {
  if (!value) return '0';
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return num.toFixed(1);
}

function calcDelta(value: string | null, previousValue: string | null): string {
  if (!value || !previousValue) return '—';
  const current = parseFloat(value);
  const prev = parseFloat(previousValue);
  if (isNaN(current) || isNaN(prev)) return '—';
  const delta = current - prev;
  return `+${delta.toFixed(1)}`;
}

// ─── AssetReadingsTab ─────────────────────────────────────────────────

interface AssetReadingsTabProps {
  assetId: string;
  assetType: AssetType;
}

export default function AssetReadingsTab({ assetId, assetType }: AssetReadingsTabProps) {
  const { readings, latest, loading, error, submitError, createReading, setSubmitError } =
    useMeterReadings(assetId);

  // Form state
  const defaultType = assetType === 'VEICULO' ? 'ODOMETER' : 'HOURMETER';
  const [readingType, setReadingType] = useState<'HOURMETER' | 'ODOMETER'>(defaultType);
  const [readingDate, setReadingDate] = useState('');
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!readingDate || !value) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);
    try {
      await createReading({
        assetId,
        readingDate,
        readingType,
        value,
      });
      setReadingDate('');
      setValue('');
      setSuccessMsg('Leitura registrada com sucesso.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      // submitError set inside hook for 400 (anti-regression)
      // For other errors, we don't surface here
    } finally {
      setIsSubmitting(false);
    }
  }

  const latestHourmeter = latest?.hourmeter;
  const latestOdometer = latest?.odometer;

  const unitLabel = readingType === 'HOURMETER' ? 'h' : 'km';
  const latestValue = readingType === 'HOURMETER' ? latestHourmeter?.value : latestOdometer?.value;

  return (
    <div className="readings-tab">
      {/* Current readings display */}
      {(latestHourmeter || latestOdometer) && (
        <div className="readings-tab__current">
          {(assetType === 'MAQUINA' || assetType === 'IMPLEMENTO') && latestHourmeter && (
            <div className="readings-tab__current-card">
              <span className="readings-tab__current-label">Horimetro atual</span>
              <span className="readings-tab__current-value">
                {formatDecimal(latestHourmeter.value)} h
              </span>
            </div>
          )}
          {assetType === 'VEICULO' && latestOdometer && (
            <div className="readings-tab__current-card">
              <span className="readings-tab__current-label">Odometro atual</span>
              <span className="readings-tab__current-value">
                {formatDecimal(latestOdometer.value)} km
              </span>
            </div>
          )}
          {assetType !== 'MAQUINA' && assetType !== 'IMPLEMENTO' && assetType !== 'VEICULO' && (
            <>
              {latestHourmeter && (
                <div className="readings-tab__current-card">
                  <span className="readings-tab__current-label">Horimetro atual</span>
                  <span className="readings-tab__current-value">
                    {formatDecimal(latestHourmeter.value)} h
                  </span>
                </div>
              )}
              {latestOdometer && (
                <div className="readings-tab__current-card">
                  <span className="readings-tab__current-label">Odometro atual</span>
                  <span className="readings-tab__current-value">
                    {formatDecimal(latestOdometer.value)} km
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add reading form */}
      <section className="readings-tab__form-section">
        <h3 className="readings-tab__section-title">Registrar leitura</h3>
        <form onSubmit={(e) => void handleSubmit(e)} className="readings-tab__form">
          <div className="readings-tab__form-row">
            <div className="readings-tab__form-field">
              <label htmlFor="reading-type" className="readings-tab__label">
                Tipo *
              </label>
              <select
                id="reading-type"
                className="readings-tab__select"
                value={readingType}
                onChange={(e) => setReadingType(e.target.value as 'HOURMETER' | 'ODOMETER')}
                aria-required="true"
              >
                <option value="HOURMETER">Horimetro</option>
                <option value="ODOMETER">Odometro</option>
              </select>
            </div>

            <div className="readings-tab__form-field">
              <label htmlFor="reading-date" className="readings-tab__label">
                Data *
              </label>
              <input
                id="reading-date"
                type="date"
                className="readings-tab__input"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="readings-tab__form-field">
              <label htmlFor="reading-value" className="readings-tab__label">
                Valor ({unitLabel}) *
              </label>
              <input
                id="reading-value"
                type="number"
                step="0.1"
                min="0"
                className={`readings-tab__input${submitError ? ' readings-tab__input--error' : ''}`}
                placeholder={`0.0 ${unitLabel}`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                aria-required="true"
                aria-describedby={submitError ? 'reading-error' : undefined}
                aria-invalid={submitError ? 'true' : undefined}
              />
              {/* Inline anti-regression error */}
              {submitError && (
                <span id="reading-error" className="readings-tab__inline-error" role="alert">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {submitError.includes('menor ou igual') ? (
                    <>
                      Leitura nao pode ser menor ou igual a ultima registrada{' '}
                      {latestValue ? `(${formatDecimal(latestValue)} ${unitLabel})` : ''}.
                    </>
                  ) : (
                    submitError
                  )}
                </span>
              )}
            </div>

            <div className="readings-tab__form-field readings-tab__form-field--btn">
              <button
                type="submit"
                className="readings-tab__btn readings-tab__btn--secondary"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Registrando...' : 'Registrar leitura'}
              </button>
            </div>
          </div>

          {successMsg && (
            <p className="readings-tab__form-success" role="status">
              {successMsg}
            </p>
          )}
        </form>
      </section>

      {/* Readings history */}
      <section className="readings-tab__list-section">
        {loading && (
          <div className="readings-tab__loading" role="status" aria-label="Carregando leituras">
            <div className="readings-tab__skeleton" />
            <div className="readings-tab__skeleton" />
          </div>
        )}

        {error && !loading && (
          <p className="readings-tab__error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && readings.length === 0 && (
          <div className="readings-tab__empty">
            <Gauge size={48} aria-hidden="true" className="readings-tab__empty-icon" />
            <p className="readings-tab__empty-text">
              Nenhuma leitura registrada. Atualize o horimetro ou odometro deste ativo.
            </p>
          </div>
        )}

        {!loading && readings.length > 0 && (
          <div className="readings-tab__table-wrapper">
            <table className="readings-tab__table">
              <caption className="sr-only">Historico de leituras</caption>
              <thead>
                <tr>
                  <th scope="col" className="readings-tab__th">
                    Data
                  </th>
                  <th scope="col" className="readings-tab__th">
                    Tipo
                  </th>
                  <th scope="col" className="readings-tab__th readings-tab__th--right">
                    Valor
                  </th>
                  <th scope="col" className="readings-tab__th readings-tab__th--right">
                    Anterior
                  </th>
                  <th scope="col" className="readings-tab__th readings-tab__th--right">
                    Diferenca
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...readings]
                  .sort(
                    (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime(),
                  )
                  .map((reading) => (
                    <tr key={reading.id} className="readings-tab__tr">
                      <td className="readings-tab__td">{formatDate(reading.readingDate)}</td>
                      <td className="readings-tab__td">
                        {reading.readingType === 'HOURMETER' ? 'Horimetro' : 'Odometro'}
                      </td>
                      <td className="readings-tab__td readings-tab__td--right">
                        {formatDecimal(reading.value)}{' '}
                        {reading.readingType === 'HOURMETER' ? 'h' : 'km'}
                      </td>
                      <td className="readings-tab__td readings-tab__td--right">
                        {reading.previousValue
                          ? `${formatDecimal(reading.previousValue)} ${reading.readingType === 'HOURMETER' ? 'h' : 'km'}`
                          : '—'}
                      </td>
                      <td className="readings-tab__td readings-tab__td--right">
                        {calcDelta(reading.value, reading.previousValue)}{' '}
                        {reading.previousValue
                          ? reading.readingType === 'HOURMETER'
                            ? 'h'
                            : 'km'
                          : ''}
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
