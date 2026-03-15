import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateTreatmentInput, AdhocProductInput } from '@/types/therapeutic-treatment';
import {
  SEVERITY_OPTIONS,
  ADMINISTRATION_ROUTES,
  DOSAGE_UNITS,
} from '@/types/therapeutic-treatment';
import './TreatmentModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

interface DiseaseOption {
  id: string;
  name: string;
}

interface ProtocolOption {
  id: string;
  name: string;
  severity: string | null;
}

interface AnimalOption {
  id: string;
  earTag: string;
  name: string | null;
}

const EMPTY_PRODUCT: AdhocProductInput = {
  productName: '',
  dosage: 0,
  dosageUnit: 'ML_ANIMAL',
  administrationRoute: 'IM',
  durationDays: 1,
  frequencyPerDay: 1,
  startDay: 1,
};

export default function TreatmentModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [animalId, setAnimalId] = useState('');
  const [diseaseId, setDiseaseId] = useState('');
  const [diseaseName, setDiseaseName] = useState('');
  const [diagnosisDate, setDiagnosisDate] = useState(new Date().toISOString().slice(0, 10));
  const [observedSeverity, setObservedSeverity] = useState('MODERATE');
  const [clinicalObservations, setClinicalObservations] = useState('');
  const [veterinaryName, setVeterinaryName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [treatmentProtocolId, setTreatmentProtocolId] = useState('');
  const [notes, setNotes] = useState('');
  const [useProtocol, setUseProtocol] = useState(true);
  const [adhocProducts, setAdhocProducts] = useState<AdhocProductInput[]>([{ ...EMPTY_PRODUCT }]);

  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [diseases, setDiseases] = useState<DiseaseOption[]>([]);
  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load reference data
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    void (async () => {
      try {
        const [animalsRes, diseasesRes, protocolsRes] = await Promise.all([
          api.get<{ data: AnimalOption[] }>(`/org/farms/${farmId}/animals?limit=500`),
          api.get<{ data: DiseaseOption[] }>(`/org/diseases?limit=200`),
          api.get<{ data: ProtocolOption[] }>(`/org/treatment-protocols?status=ACTIVE&limit=200`),
        ]);
        setAnimals(animalsRes.data ?? []);
        setDiseases(diseasesRes.data ?? []);
        setProtocols(protocolsRes.data ?? []);
      } catch {
        // Non-critical, will just have empty dropdowns
      }
    })();
  }, [isOpen, farmId]);

  // Auto-fill disease name when diseaseId changes
  useEffect(() => {
    if (diseaseId) {
      const d = diseases.find((d) => d.id === diseaseId);
      if (d) setDiseaseName(d.name);
    }
  }, [diseaseId, diseases]);

  // Reset form on open
  useEffect(() => {
    if (!isOpen) return;
    setAnimalId('');
    setDiseaseId('');
    setDiseaseName('');
    setDiagnosisDate(new Date().toISOString().slice(0, 10));
    setObservedSeverity('MODERATE');
    setClinicalObservations('');
    setVeterinaryName('');
    setResponsibleName('');
    setTreatmentProtocolId('');
    setNotes('');
    setUseProtocol(true);
    setAdhocProducts([{ ...EMPTY_PRODUCT }]);
    setError(null);
  }, [isOpen]);

  const addAdhocProduct = useCallback(() => {
    setAdhocProducts((prev) => [...prev, { ...EMPTY_PRODUCT }]);
  }, []);

  const removeAdhocProduct = useCallback((index: number) => {
    setAdhocProducts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateAdhocProduct = useCallback(
    (index: number, field: keyof AdhocProductInput, value: string | number) => {
      setAdhocProducts((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: CreateTreatmentInput = {
        animalId,
        diseaseId: diseaseId || null,
        diseaseName,
        diagnosisDate,
        observedSeverity,
        clinicalObservations: clinicalObservations || null,
        veterinaryName,
        responsibleName,
        treatmentProtocolId: useProtocol && treatmentProtocolId ? treatmentProtocolId : null,
        notes: notes || null,
        adhocProducts: !useProtocol ? adhocProducts : undefined,
      };

      await api.post(`/org/farms/${farmId}/therapeutic-treatments`, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir tratamento');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__dialog modal__dialog--lg"
        role="dialog"
        aria-modal="true"
        aria-label="Novo tratamento terapêutico"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>Novo tratamento terapêutico</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="modal__close">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="modal__body" onSubmit={handleSubmit}>
          {error && (
            <div className="modal__error" role="alert">
              {error}
            </div>
          )}

          {/* Animal + Disease */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="tt-animal">Animal *</label>
              <select
                id="tt-animal"
                value={animalId}
                onChange={(e) => setAnimalId(e.target.value)}
                required
                aria-required="true"
              >
                <option value="">Selecione o animal</option>
                {animals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.earTag} — {a.name || 'Sem nome'}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal__field">
              <label htmlFor="tt-disease">Doença diagnosticada *</label>
              <select
                id="tt-disease"
                value={diseaseId}
                onChange={(e) => setDiseaseId(e.target.value)}
              >
                <option value="">Selecione ou digite abaixo</option>
                {diseases.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!diseaseId && (
            <div className="modal__field">
              <label htmlFor="tt-disease-name">Nome da doença (se não está na lista) *</label>
              <input
                id="tt-disease-name"
                type="text"
                value={diseaseName}
                onChange={(e) => setDiseaseName(e.target.value)}
                required={!diseaseId}
                aria-required={!diseaseId}
              />
            </div>
          )}

          {/* Diagnosis + Severity */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="tt-date">Data do diagnóstico *</label>
              <input
                id="tt-date"
                type="date"
                value={diagnosisDate}
                onChange={(e) => setDiagnosisDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>

            <div className="modal__field">
              <label htmlFor="tt-severity">Gravidade observada *</label>
              <select
                id="tt-severity"
                value={observedSeverity}
                onChange={(e) => setObservedSeverity(e.target.value)}
                required
                aria-required="true"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clinical observations */}
          <div className="modal__field">
            <label htmlFor="tt-observations">Observações clínicas</label>
            <textarea
              id="tt-observations"
              value={clinicalObservations}
              onChange={(e) => setClinicalObservations(e.target.value)}
              rows={3}
            />
          </div>

          {/* Vet + Responsible */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="tt-vet">Veterinário responsável *</label>
              <input
                id="tt-vet"
                type="text"
                value={veterinaryName}
                onChange={(e) => setVeterinaryName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="modal__field">
              <label htmlFor="tt-responsible">Responsável pela aplicação *</label>
              <input
                id="tt-responsible"
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Protocol or Ad-hoc */}
          <fieldset className="modal__fieldset">
            <legend>Medicação</legend>
            <div className="modal__radio-group">
              <label>
                <input
                  type="radio"
                  name="treatment-type"
                  checked={useProtocol}
                  onChange={() => setUseProtocol(true)}
                />
                Usar protocolo cadastrado
              </label>
              <label>
                <input
                  type="radio"
                  name="treatment-type"
                  checked={!useProtocol}
                  onChange={() => setUseProtocol(false)}
                />
                Tratamento avulso
              </label>
            </div>

            {useProtocol ? (
              <div className="modal__field">
                <label htmlFor="tt-protocol">Protocolo de tratamento *</label>
                <select
                  id="tt-protocol"
                  value={treatmentProtocolId}
                  onChange={(e) => setTreatmentProtocolId(e.target.value)}
                  required={useProtocol}
                  aria-required={useProtocol}
                >
                  <option value="">Selecione o protocolo</option>
                  {protocols.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="tt-adhoc">
                {adhocProducts.map((prod, i) => (
                  <div key={i} className="tt-adhoc__product">
                    <div className="tt-adhoc__header">
                      <span className="tt-adhoc__label">Produto {i + 1}</span>
                      {adhocProducts.length > 1 && (
                        <button
                          type="button"
                          className="tt-adhoc__remove"
                          onClick={() => removeAdhocProduct(i)}
                          aria-label={`Remover produto ${i + 1}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="modal__row">
                      <div className="modal__field">
                        <label htmlFor={`adhoc-name-${i}`}>Nome *</label>
                        <input
                          id={`adhoc-name-${i}`}
                          type="text"
                          value={prod.productName}
                          onChange={(e) => updateAdhocProduct(i, 'productName', e.target.value)}
                          required
                        />
                      </div>
                      <div className="modal__field modal__field--sm">
                        <label htmlFor={`adhoc-dosage-${i}`}>Dosagem *</label>
                        <input
                          id={`adhoc-dosage-${i}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={prod.dosage || ''}
                          onChange={(e) =>
                            updateAdhocProduct(i, 'dosage', parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                      <div className="modal__field modal__field--sm">
                        <label htmlFor={`adhoc-unit-${i}`}>Unidade</label>
                        <select
                          id={`adhoc-unit-${i}`}
                          value={prod.dosageUnit}
                          onChange={(e) => updateAdhocProduct(i, 'dosageUnit', e.target.value)}
                        >
                          {DOSAGE_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="modal__row">
                      <div className="modal__field">
                        <label htmlFor={`adhoc-route-${i}`}>Via</label>
                        <select
                          id={`adhoc-route-${i}`}
                          value={prod.administrationRoute}
                          onChange={(e) =>
                            updateAdhocProduct(i, 'administrationRoute', e.target.value)
                          }
                        >
                          {ADMINISTRATION_ROUTES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="modal__field modal__field--sm">
                        <label htmlFor={`adhoc-days-${i}`}>Dias *</label>
                        <input
                          id={`adhoc-days-${i}`}
                          type="number"
                          min="1"
                          value={prod.durationDays}
                          onChange={(e) =>
                            updateAdhocProduct(i, 'durationDays', parseInt(e.target.value) || 1)
                          }
                          required
                        />
                      </div>
                      <div className="modal__field modal__field--sm">
                        <label htmlFor={`adhoc-freq-${i}`}>Vezes/dia</label>
                        <input
                          id={`adhoc-freq-${i}`}
                          type="number"
                          min="1"
                          max="4"
                          value={prod.frequencyPerDay ?? 1}
                          onChange={(e) =>
                            updateAdhocProduct(i, 'frequencyPerDay', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="tt-adhoc__add" onClick={addAdhocProduct}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar produto
                </button>
              </div>
            )}
          </fieldset>

          {/* Notes */}
          <div className="modal__field">
            <label htmlFor="tt-notes">Observações</label>
            <textarea
              id="tt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </form>

        <footer className="modal__footer">
          <button type="button" className="modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="modal__btn-submit"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Abrindo...' : 'Abrir tratamento'}
          </button>
        </footer>
      </div>
    </div>
  );
}
