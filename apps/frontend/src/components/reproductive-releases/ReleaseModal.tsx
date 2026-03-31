import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Syringe, CalendarClock, Plus } from 'lucide-react';
import { api } from '@/services/api';
import type {
  CreateReleaseInput,
  CandidateItem,
  ReleaseVaccinationInput,
  ReleaseIatfInput,
} from '@/types/reproductive-release';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import { useProducts } from '@/hooks/useProducts';
import { useIatfProtocols } from '@/hooks/useIatfProtocols';
import { ADMINISTRATION_ROUTES } from '@/types/vaccination';
import ProductModal from '@/components/products/ProductModal';
import './ReleaseModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
  preselectedAnimalId?: string | null;
  preselectedCandidate?: CandidateItem | null;
}

const EMPTY_FORM: CreateReleaseInput = {
  animalId: '',
  releaseDate: new Date().toISOString().split('T')[0],
  weightKg: null,
  ageMonths: null,
  bodyConditionScore: null,
  notes: '',
};

const BODY_SCORE_OPTIONS = [
  { value: 1, label: '1 — Muito magra' },
  { value: 2, label: '2 — Magra' },
  { value: 3, label: '3 — Regular' },
  { value: 4, label: '4 — Boa' },
  { value: 5, label: '5 — Excelente' },
];

export default function ReleaseModal({
  isOpen,
  onClose,
  farmId,
  onSuccess,
  preselectedAnimalId,
  preselectedCandidate,
}: Props) {
  const [formData, setFormData] = useState<CreateReleaseInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const { animals } = useAnimals({ farmId, limit: 500 });
  const { products, refetch: refetchProducts } = useProducts({ limit: 200, type: 'vacina' });
  const { protocols } = useIatfProtocols({ status: 'ACTIVE', limit: 100 });

  const filteredVacProducts = products.filter(
    (p) => !vacProductName || p.name.toLowerCase().includes(vacProductName.toLowerCase()),
  );

  const femaleAnimals = animals.filter((a: AnimalListItem) => a.sex === 'FEMALE');
  const selectedAnimal = femaleAnimals.find((a) => a.id === formData.animalId);

  useEffect(() => {
    if (!isOpen) return;
    const initial = { ...EMPTY_FORM };
    if (preselectedAnimalId) {
      initial.animalId = preselectedAnimalId;
    }
    if (preselectedCandidate) {
      initial.animalId = preselectedCandidate.animalId;
      initial.ageMonths = preselectedCandidate.ageMonths;
    }
    setFormData(initial);
    setError(null);
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
  }, [isOpen, preselectedAnimalId, preselectedCandidate]);

  useEffect(() => {
    if (selectedAnimal?.birthDate) {
      const birth = new Date(selectedAnimal.birthDate);
      const now = new Date();
      const diffMonths =
        (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      setFormData((prev) => ({ ...prev, ageMonths: diffMonths }));
    }
  }, [selectedAnimal]);

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

    if (!formData.animalId) {
      setError('Selecione o animal.');
      return;
    }
    if (!formData.releaseDate) {
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

    const payload = {
      ...formData,
      weightKg: formData.weightKg || null,
      ageMonths: formData.ageMonths || null,
      bodyConditionScore: formData.bodyConditionScore || null,
      notes: formData.notes || null,
      vaccination,
      iatf,
    };

    try {
      await api.post(`/org/farms/${farmId}/reproductive-releases`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar liberação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="release-modal__overlay" onClick={onClose}>
        <div
          className="release-modal__dialog"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="release-modal-title"
        >
          <header className="release-modal__header">
            <h2 id="release-modal-title">Liberar novilha para reprodução</h2>
            <button
              type="button"
              className="release-modal__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="release-modal__form">
            {error && (
              <div className="release-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Animal */}
            <div className="release-modal__field">
              <label htmlFor="release-animal">Animal *</label>
              {preselectedCandidate ? (
                <input
                  id="release-animal"
                  type="text"
                  value={`${preselectedCandidate.earTag}${preselectedCandidate.animalName ? ` — ${preselectedCandidate.animalName}` : ''}`}
                  readOnly
                  className="release-modal__readonly"
                />
              ) : (
                <select
                  id="release-animal"
                  value={formData.animalId}
                  onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
                  required
                  aria-required="true"
                >
                  <option value="">Selecione a novilha...</option>
                  {femaleAnimals.map((a: AnimalListItem) => (
                    <option key={a.id} value={a.id}>
                      {a.earTag} — {a.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Data */}
            <div className="release-modal__field">
              <label htmlFor="release-date">Data da liberação *</label>
              <input
                id="release-date"
                type="date"
                value={formData.releaseDate}
                onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>

            {/* Peso + Idade */}
            <div className="release-modal__row">
              <div className="release-modal__field">
                <label htmlFor="release-weight">Peso (kg)</label>
                <input
                  id="release-weight"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.weightKg ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weightKg: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 320"
                />
              </div>
              <div className="release-modal__field">
                <label htmlFor="release-age">Idade (meses)</label>
                <input
                  id="release-age"
                  type="number"
                  min="0"
                  value={formData.ageMonths ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ageMonths: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Calculado automaticamente"
                />
              </div>
            </div>

            {/* Escore corporal */}
            <div className="release-modal__field">
              <label htmlFor="release-score">Escore de condição corporal</label>
              <select
                id="release-score"
                value={formData.bodyConditionScore ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bodyConditionScore: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">Selecione o escore...</option>
                {BODY_SCORE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Observações */}
            <div className="release-modal__field">
              <label htmlFor="release-notes">Observações</label>
              <textarea
                id="release-notes"
                value={formData.notes ?? ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Observações adicionais (opcional)"
              />
            </div>

            {/* ─── Ações adicionais ─────────────────────────────── */}
            <div className="release-modal__extras">
              {/* Vaccination toggle */}
              <label className="release-modal__toggle">
                <input
                  type="checkbox"
                  checked={enableVaccination}
                  onChange={(e) => setEnableVaccination(e.target.checked)}
                />
                <Syringe size={16} aria-hidden="true" />
                Aplicar vacina na liberação
              </label>

              {enableVaccination && (
                <div className="release-modal__extra-fields">
                  <div className="release-modal__field release-modal__autocomplete">
                    <label htmlFor="vac-product">Vacina *</label>
                    <input
                      id="vac-product"
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
                        <ul className="release-modal__dropdown" role="listbox">
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
                              className="release-modal__dropdown-create"
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
                  <div className="release-modal__row">
                    <div className="release-modal__field">
                      <label htmlFor="vac-dose">Dose (mL) *</label>
                      <input
                        id="vac-dose"
                        type="number"
                        min="0"
                        step="0.1"
                        value={vacDosageMl}
                        onChange={(e) => setVacDosageMl(e.target.value)}
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="release-modal__field">
                      <label htmlFor="vac-route">Via *</label>
                      <select
                        id="vac-route"
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
                  <div className="release-modal__field">
                    <label htmlFor="vac-batch">Lote do produto</label>
                    <input
                      id="vac-batch"
                      type="text"
                      value={vacBatch}
                      onChange={(e) => setVacBatch(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              )}

              {/* IATF toggle */}
              <label className="release-modal__toggle">
                <input
                  type="checkbox"
                  checked={enableIatf}
                  onChange={(e) => setEnableIatf(e.target.checked)}
                />
                <CalendarClock size={16} aria-hidden="true" />
                Iniciar protocolo de IATF
              </label>

              {enableIatf && (
                <div className="release-modal__extra-fields">
                  <div className="release-modal__field">
                    <label htmlFor="iatf-protocol">Protocolo *</label>
                    <select
                      id="iatf-protocol"
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

            <footer className="release-modal__footer">
              <button
                type="button"
                className="release-modal__btn-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="release-modal__btn-save" disabled={isLoading}>
                {isLoading ? 'Registrando...' : 'Registrar liberação'}
              </button>
            </footer>
          </form>
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
