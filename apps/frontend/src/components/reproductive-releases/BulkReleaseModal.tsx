import { useState, useEffect, useCallback } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Syringe,
  CalendarClock,
  Plus,
} from 'lucide-react';
import { api } from '@/services/api';
import { useLots } from '@/hooks/useLots';
import { useProducts } from '@/hooks/useProducts';
import { useIatfProtocols } from '@/hooks/useIatfProtocols';
import { ADMINISTRATION_ROUTES } from '@/types/vaccination';
import ProductModal from '@/components/products/ProductModal';
import type {
  CandidateItem,
  CriteriaItem,
  ReleaseVaccinationInput,
  ReleaseIatfInput,
} from '@/types/reproductive-release';
import './BulkReleaseModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  selectedAnimals: CandidateItem[];
  criteria: CriteriaItem | null;
  onSuccess: () => void;
}

interface AnimalEntry {
  animalId: string;
  earTag: string;
  animalName: string | null;
  ageMonths: number | null;
  lastWeightKg: number | null;
  lastWeighingDate: string | null;
  bodyConditionScore: number | null;
  weightKg: string;
  minWeight: number | null;
}

interface BulkResult {
  released: number;
  failed: number;
  errors: Array<{ animalId: string; reason: string }>;
}

export default function BulkReleaseModal({
  isOpen,
  onClose,
  farmId,
  selectedAnimals,
  criteria,
  onSuccess,
}: Props) {
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetLotId, setTargetLotId] = useState('');
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<AnimalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  // Vaccination state
  const [enableVaccination, setEnableVaccination] = useState(false);
  const [vacProductId, setVacProductId] = useState('');
  const [vacProductName, setVacProductName] = useState('');
  const [vacDosageMl, setVacDosageMl] = useState('');
  const [vacRoute, setVacRoute] = useState('IM');
  const [vacBatch, setVacBatch] = useState('');
  const [showVacDropdown, setShowVacDropdown] = useState(false);

  // Product creation modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [productInitialName, setProductInitialName] = useState('');

  // IATF state
  const [enableIatf, setEnableIatf] = useState(false);
  const [iatfProtocolId, setIatfProtocolId] = useState('');

  const { lots } = useLots({ farmId, limit: 200 });
  const { products, refetch: refetchProducts } = useProducts({ limit: 200, type: 'vacina' });
  const { protocols } = useIatfProtocols({ status: 'ACTIVE', limit: 100 });

  const filteredVacProducts = products.filter(
    (p) => !vacProductName || p.name.toLowerCase().includes(vacProductName.toLowerCase()),
  );

  useEffect(() => {
    if (!isOpen) return;
    setReleaseDate(new Date().toISOString().split('T')[0]);
    setTargetLotId('');
    setNotes('');
    setError(null);
    setResult(null);
    setEnableVaccination(false);
    setVacProductId('');
    setVacProductName('');
    setVacDosageMl('');
    setVacRoute('IM');
    setVacBatch('');
    setShowVacDropdown(false);
    setShowProductModal(false);
    setProductInitialName('');
    setEnableIatf(false);
    setIatfProtocolId('');
    setEntries(
      selectedAnimals.map((a) => ({
        animalId: a.animalId,
        earTag: a.earTag,
        animalName: a.animalName,
        ageMonths: a.ageMonths,
        lastWeightKg: a.lastWeightKg,
        lastWeighingDate: a.lastWeighingDate,
        bodyConditionScore: a.bodyConditionScore,
        weightKg: '',
        minWeight: criteria?.minWeightKg ?? null,
      })),
    );
  }, [isOpen, selectedAnimals, criteria]);

  const updateWeight = (index: number, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], weightKg: value };
      return next;
    });
  };

  const getWeightWarning = (entry: AnimalEntry): string | null => {
    if (!entry.weightKg || !entry.minWeight) return null;
    const w = Number(entry.weightKg);
    if (isNaN(w) || w <= 0) return null;
    if (w < entry.minWeight) {
      return `Abaixo do mínimo (${entry.minWeight} kg)`;
    }
    return null;
  };

  const handleCreateProductClick = useCallback((name: string) => {
    setProductInitialName(name.trim());
    setShowVacDropdown(false);
    setShowProductModal(true);
  }, []);

  const handleProductCreated = useCallback(
    (created?: { id: string; name: string }) => {
      setShowProductModal(false);
      setProductInitialName('');
      void refetchProducts();
      if (created) {
        setVacProductId(created.id);
        setVacProductName(created.name);
      }
    },
    [refetchProducts],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!releaseDate) {
      setError('Informe a data da liberação.');
      return;
    }
    if (enableVaccination) {
      if (!vacProductName.trim()) {
        setError('Informe o nome da vacina.');
        return;
      }
      if (!vacDosageMl || Number(vacDosageMl) <= 0) {
        setError('Informe a dose da vacina.');
        return;
      }
    }
    if (enableIatf && !iatfProtocolId) {
      setError('Selecione o protocolo de IATF.');
      return;
    }

    setIsLoading(true);

    let vaccination: ReleaseVaccinationInput | null = null;
    if (enableVaccination) {
      vaccination = {
        productId: vacProductId || null,
        productName: vacProductName.trim(),
        dosageMl: Number(vacDosageMl),
        administrationRoute: vacRoute,
        productBatchNumber: vacBatch.trim() || null,
      };
    }

    let iatf: ReleaseIatfInput | null = null;
    if (enableIatf) {
      iatf = { protocolId: iatfProtocolId };
    }

    try {
      const payload = {
        animals: entries.map((entry) => ({
          animalId: entry.animalId,
          weightKg: entry.weightKg ? Number(entry.weightKg) : null,
        })),
        releaseDate,
        targetLotId: targetLotId || null,
        notes: notes.trim() || null,
        vaccination,
        iatf,
      };

      const res = await api.post<BulkResult>(
        `/org/farms/${farmId}/reproductive-releases/bulk`,
        payload,
      );
      setResult(res);

      if (res.failed === 0) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao liberar novilhas.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasWarnings = entries.some((e) => getWeightWarning(e) !== null);

  return (
    <>
      <div className="bulk-release-modal__overlay" onClick={onClose}>
        <div
          className="bulk-release-modal__dialog"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-release-modal-title"
        >
          <header className="bulk-release-modal__header">
            <h2 id="bulk-release-modal-title">
              Liberar {selectedAnimals.length} novilha{selectedAnimals.length > 1 ? 's' : ''}
            </h2>
            <button
              type="button"
              className="bulk-release-modal__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          {result ? (
            <div className="bulk-release-modal__results">
              <div className="bulk-release-modal__result-summary">
                <CheckCircle
                  size={20}
                  className="bulk-release-modal__icon--success"
                  aria-hidden="true"
                />
                <span>
                  {result.released} novilha{result.released > 1 ? 's' : ''} liberada
                  {result.released > 1 ? 's' : ''} com sucesso
                </span>
              </div>
              {result.failed > 0 && (
                <div className="bulk-release-modal__result-errors">
                  <div className="bulk-release-modal__result-errors-title">
                    <AlertCircle
                      size={16}
                      className="bulk-release-modal__icon--error"
                      aria-hidden="true"
                    />
                    {result.failed} erro{result.failed > 1 ? 's' : ''}:
                  </div>
                  {result.errors.map((err) => {
                    const animal = entries.find((e) => e.animalId === err.animalId);
                    return (
                      <div key={err.animalId} className="bulk-release-modal__result-error-item">
                        <strong>{animal?.earTag ?? err.animalId}</strong>: {err.reason}
                      </div>
                    );
                  })}
                </div>
              )}
              <footer className="bulk-release-modal__footer">
                <button type="button" className="bulk-release-modal__btn-save" onClick={onSuccess}>
                  Fechar
                </button>
              </footer>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bulk-release-modal__form">
              {error && (
                <div className="bulk-release-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="bulk-release-modal__shared-fields">
                <div className="bulk-release-modal__field">
                  <label htmlFor="bulk-release-date">Data da liberação *</label>
                  <input
                    id="bulk-release-date"
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="bulk-release-modal__field">
                  <label htmlFor="bulk-release-lot">Lote de destino</label>
                  <select
                    id="bulk-release-lot"
                    value={targetLotId}
                    onChange={(e) => setTargetLotId(e.target.value)}
                  >
                    <option value="">Nenhum (manter no lote atual)</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bulk-release-modal__field">
                  <label htmlFor="bulk-release-notes">Observações</label>
                  <input
                    id="bulk-release-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              {/* ─── Ações adicionais ─────────────────────────── */}
              <div className="bulk-release-modal__extras">
                <label className="bulk-release-modal__toggle">
                  <input
                    type="checkbox"
                    checked={enableVaccination}
                    onChange={(e) => setEnableVaccination(e.target.checked)}
                  />
                  <Syringe size={16} aria-hidden="true" />
                  Aplicar vacina na liberação
                </label>

                {enableVaccination && (
                  <div className="bulk-release-modal__extra-fields">
                    <div className="bulk-release-modal__field bulk-release-modal__autocomplete">
                      <label htmlFor="bulk-vac-product">Vacina *</label>
                      <input
                        id="bulk-vac-product"
                        type="text"
                        value={vacProductName}
                        onChange={(e) => {
                          setVacProductName(e.target.value);
                          setShowVacDropdown(true);
                          if (!e.target.value.trim()) {
                            setVacProductId('');
                          }
                        }}
                        onFocus={() => setShowVacDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowVacDropdown(false), 200);
                        }}
                        placeholder="Digite o nome da vacina..."
                        autoComplete="off"
                        aria-required="true"
                      />
                      {showVacDropdown &&
                        (filteredVacProducts.length > 0 || vacProductName.trim()) && (
                          <ul className="bulk-release-modal__dropdown" role="listbox">
                            {filteredVacProducts.map((p) => (
                              <li
                                key={p.id}
                                role="option"
                                aria-selected={p.id === vacProductId}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setVacProductId(p.id);
                                  setVacProductName(p.name);
                                  setShowVacDropdown(false);
                                }}
                              >
                                {p.name}
                              </li>
                            ))}
                            {filteredVacProducts.length === 0 && vacProductName.trim() && (
                              <li
                                className="bulk-release-modal__dropdown-create"
                                role="option"
                                aria-selected={false}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCreateProductClick(vacProductName);
                                }}
                              >
                                <Plus size={14} aria-hidden="true" /> Criar &quot;
                                {vacProductName.trim()}&quot;
                              </li>
                            )}
                          </ul>
                        )}
                    </div>
                    <div className="bulk-release-modal__shared-fields">
                      <div className="bulk-release-modal__field">
                        <label htmlFor="bulk-vac-dose">Dose (mL) *</label>
                        <input
                          id="bulk-vac-dose"
                          type="number"
                          min="0"
                          step="0.1"
                          value={vacDosageMl}
                          onChange={(e) => setVacDosageMl(e.target.value)}
                          placeholder="Ex: 5"
                        />
                      </div>
                      <div className="bulk-release-modal__field">
                        <label htmlFor="bulk-vac-route">Via *</label>
                        <select
                          id="bulk-vac-route"
                          value={vacRoute}
                          onChange={(e) => setVacRoute(e.target.value)}
                        >
                          {ADMINISTRATION_ROUTES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="bulk-release-modal__field">
                      <label htmlFor="bulk-vac-batch">Lote do produto</label>
                      <input
                        id="bulk-vac-batch"
                        type="text"
                        value={vacBatch}
                        onChange={(e) => setVacBatch(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                )}

                <label className="bulk-release-modal__toggle">
                  <input
                    type="checkbox"
                    checked={enableIatf}
                    onChange={(e) => setEnableIatf(e.target.checked)}
                  />
                  <CalendarClock size={16} aria-hidden="true" />
                  Iniciar protocolo de IATF
                </label>

                {enableIatf && (
                  <div className="bulk-release-modal__extra-fields">
                    <div className="bulk-release-modal__field">
                      <label htmlFor="bulk-iatf-protocol">Protocolo *</label>
                      <select
                        id="bulk-iatf-protocol"
                        value={iatfProtocolId}
                        onChange={(e) => setIatfProtocolId(e.target.value)}
                      >
                        <option value="">Selecione o protocolo...</option>
                        {protocols.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {hasWarnings && (
                <div className="bulk-release-modal__warning-banner" role="status">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Alguns animais estão abaixo do peso mínimo configurado. Verifique antes de
                  confirmar.
                </div>
              )}

              <div className="bulk-release-modal__animal-list">
                <h3>Peso por animal</h3>
                {entries.map((entry, idx) => {
                  const warning = getWeightWarning(entry);
                  return (
                    <div
                      key={entry.animalId}
                      className={`bulk-release-modal__animal-row ${warning ? 'bulk-release-modal__animal-row--warning' : ''}`}
                    >
                      <div className="bulk-release-modal__animal-info">
                        <span className="bulk-release-modal__animal-tag">{entry.earTag}</span>
                        {entry.animalName && (
                          <span className="bulk-release-modal__animal-name">
                            {entry.animalName}
                          </span>
                        )}
                        {entry.ageMonths !== null && (
                          <span className="bulk-release-modal__animal-age">
                            {entry.ageMonths} m
                          </span>
                        )}
                      </div>
                      <div className="bulk-release-modal__animal-fields">
                        <div className="bulk-release-modal__weight-field">
                          <label htmlFor={`release-weight-${idx}`} className="sr-only">
                            Peso de {entry.earTag}
                          </label>
                          <input
                            id={`release-weight-${idx}`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={entry.weightKg}
                            onChange={(e) => updateWeight(idx, e.target.value)}
                            placeholder="Peso (kg)"
                          />
                          {warning && (
                            <span className="bulk-release-modal__weight-warning" role="status">
                              <AlertTriangle size={14} aria-hidden="true" />
                              {warning}
                            </span>
                          )}
                        </div>
                        {entry.lastWeightKg !== null && (
                          <div className="bulk-release-modal__last-weight-info">
                            Último peso: <strong>{entry.lastWeightKg} kg</strong>
                            {entry.lastWeighingDate && (
                              <>
                                {' '}
                                em{' '}
                                {new Date(entry.lastWeighingDate + 'T00:00:00').toLocaleDateString(
                                  'pt-BR',
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer className="bulk-release-modal__footer">
                <button
                  type="button"
                  className="bulk-release-modal__btn-cancel"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button type="submit" className="bulk-release-modal__btn-save" disabled={isLoading}>
                  {isLoading ? 'Liberando...' : `Confirmar liberação (${entries.length})`}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>

      <ProductModal
        isOpen={showProductModal}
        product={null}
        defaultNature="PRODUCT"
        initialName={productInitialName}
        onClose={() => {
          setShowProductModal(false);
          setProductInitialName('');
        }}
        onSuccess={handleProductCreated}
      />
    </>
  );
}
