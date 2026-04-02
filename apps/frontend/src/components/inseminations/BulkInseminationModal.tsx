import { useState, useEffect, useCallback } from 'react';
import { X, Search, Syringe, Beef, Link2, Info } from 'lucide-react';
import { api } from '@/services/api';
import { INSEMINATION_TYPES, CERVICAL_MUCUS_OPTIONS } from '@/types/iatf-execution';
import { MATING_REASONS } from '@/types/natural-mating';
import type { CreateNaturalMatingInput } from '@/types/natural-mating';
import type { BullItem, SemenBatchItem } from '@/types/bull';
import { SEMEN_TYPES } from '@/types/bull';
import type { IatfProtocolItem } from '@/types/iatf-protocol';
import type { AnimalListItem } from '@/types/animal';
import { CATEGORY_LABELS } from '@/types/animal';
import InseminatorSelect from '@/components/shared/InseminatorSelect';
import './BulkInseminationModal.css';

interface AnimalActiveLotInfo {
  animalId: string;
  lotId: string;
  lotName: string;
  protocolId: string;
  protocolName: string;
  aiStepId: string | null;
}

type Mode = 'insemination' | 'natural_mating';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: (count: number) => void;
}

export default function BulkInseminationModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('insemination');

  // Animal selection
  const [animals, setAnimals] = useState<AnimalListItem[]>([]);
  const [animalSearch, setAnimalSearch] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);
  const [showAnimalDropdown, setShowAnimalDropdown] = useState(false);

  // Insemination data
  const [inseminationType, setInseminationType] = useState('IATF');
  const [bullId, setBullId] = useState('');
  const [semenBatchId, setSemenBatchId] = useState('');
  const [availableBatches, setAvailableBatches] = useState<SemenBatchItem[]>([]);
  const [inseminator, setInseminator] = useState<{ id: string; name: string } | null>(null);
  const [inseminationDate, setInseminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [inseminationTime, setInseminationTime] = useState('');
  const [cervicalMucus, setCervicalMucus] = useState('');
  const [observations, setObservations] = useState('');
  const [semenType, setSemenType] = useState('');
  const [dosesUsed, setDosesUsed] = useState(1);
  const [autoDetectedSemenType, setAutoDetectedSemenType] = useState<string | null>(null);

  // Protocol data
  const [iatfProtocolId, setIatfProtocolId] = useState('');
  const [protocols, setProtocols] = useState<IatfProtocolItem[]>([]);
  const [activeLot, setActiveLot] = useState<AnimalActiveLotInfo | null>(null);
  const [autoDetectedProtocol, setAutoDetectedProtocol] = useState<{
    id: string;
    name: string;
    lotName: string;
  } | null>(null);

  // Natural mating data
  const [bullIdentified, setBullIdentified] = useState(true);
  const [matingBullId, setMatingBullId] = useState('');
  const [bullBreedName, setBullBreedName] = useState('');
  const [matingReason, setMatingReason] = useState('DIRECT_COVERAGE');
  const [matingDate, setMatingDate] = useState(new Date().toISOString().slice(0, 10));
  const [matingNotes, setMatingNotes] = useState('');

  const [bulls, setBulls] = useState<BullItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setMode('insemination');
      setSelectedAnimalId('');
      setAnimalSearch('');
      setShowAnimalDropdown(false);
      // Insemination fields
      setInseminationType('IATF');
      setBullId('');
      setSemenBatchId('');
      setAvailableBatches([]);
      setInseminator(null);
      setInseminationDate(new Date().toISOString().slice(0, 10));
      setInseminationTime('');
      setCervicalMucus('');
      setObservations('');
      setSemenType('');
      setDosesUsed(1);
      setAutoDetectedSemenType(null);
      // Protocol fields
      setIatfProtocolId('');
      setActiveLot(null);
      setAutoDetectedProtocol(null);
      // Natural mating fields
      setBullIdentified(true);
      setMatingBullId('');
      setBullBreedName('');
      setMatingReason('DIRECT_COVERAGE');
      setMatingDate(new Date().toISOString().slice(0, 10));
      setMatingNotes('');
      setError(null);
    }
  }, [isOpen]);

  // Load female animals
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingAnimals(true);
    void api
      .get<{ data: AnimalListItem[] }>(
        `/org/farms/${farmId}/animals?sex=FEMALE&limit=2000&sortBy=earTag&sortOrder=asc`,
      )
      .then((res) => setAnimals(res.data ?? []))
      .catch(() => setAnimals([]))
      .finally(() => setIsLoadingAnimals(false));
  }, [isOpen, farmId]);

  // Load bulls
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<{ data: BullItem[] }>(`/org/farms/${farmId}/bulls?status=ACTIVE&limit=200`)
      .then((res) => setBulls(res.data ?? []))
      .catch(() => setBulls([]));
  }, [isOpen, farmId]);

  // Load IATF protocols
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<{ data: IatfProtocolItem[] }>(`/org/iatf-protocols?status=ACTIVE&limit=100`)
      .then((res) => setProtocols(res.data ?? []))
      .catch(() => setProtocols([]));
  }, [isOpen]);

  // Fetch active lot for selected animal
  useEffect(() => {
    if (!selectedAnimalId || mode !== 'insemination') {
      setActiveLot(null);
      setAutoDetectedProtocol(null);
      return;
    }

    void api
      .get<AnimalActiveLotInfo[]>(
        `/org/farms/${farmId}/animals/active-reproductive-lots?animalIds=${selectedAnimalId}`,
      )
      .then((res) => {
        if (res.length > 0) {
          const lot = res[0];
          setActiveLot(lot);
          setAutoDetectedProtocol({
            id: lot.protocolId,
            name: lot.protocolName,
            lotName: lot.lotName,
          });
          setIatfProtocolId(lot.protocolId);
        } else {
          setActiveLot(null);
          setAutoDetectedProtocol(null);
        }
      })
      .catch(() => {
        setActiveLot(null);
        setAutoDetectedProtocol(null);
      });
  }, [selectedAnimalId, mode, farmId]);

  // Load semen batches when bull is selected
  useEffect(() => {
    if (!bullId) {
      setAvailableBatches([]);
      setSemenBatchId('');
      setAutoDetectedSemenType(null);
      return;
    }
    void api
      .get<{ semenBatches: SemenBatchItem[] }>(`/org/farms/${farmId}/bulls/${bullId}`)
      .then((res) => {
        const withDoses = (res.semenBatches ?? []).filter((b) => b.currentDoses > 0);
        setAvailableBatches(withDoses);
        if (withDoses.length === 1) {
          setSemenBatchId(withDoses[0].id);
          setAutoDetectedSemenType(withDoses[0].semenTypeLabel);
          setSemenType(withDoses[0].semenType);
        } else {
          setSemenBatchId('');
          setAutoDetectedSemenType(null);
        }
      })
      .catch(() => {
        setAvailableBatches([]);
        setSemenBatchId('');
        setAutoDetectedSemenType(null);
      });
  }, [bullId, farmId]);

  // Update semenType when batch selection changes
  useEffect(() => {
    if (!semenBatchId) {
      setAutoDetectedSemenType(null);
      return;
    }
    const batch = availableBatches.find((b) => b.id === semenBatchId);
    if (batch) {
      setAutoDetectedSemenType(batch.semenTypeLabel);
      setSemenType(batch.semenType);
    }
  }, [semenBatchId, availableBatches]);

  const filteredAnimals = animalSearch.trim()
    ? animals.filter((a) => {
        const q = animalSearch.trim().toLowerCase();
        return a.earTag.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q));
      })
    : animals;

  const selectedAnimal = animals.find((a) => a.id === selectedAnimalId);

  function handleSelectAnimal(id: string) {
    setSelectedAnimalId(id);
    setAnimalSearch('');
    setShowAnimalDropdown(false);
  }

  function handleClearAnimal() {
    setSelectedAnimalId('');
    setAnimalSearch('');
  }

  const handleSubmitInsemination = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedAnimalId) {
        setError('Selecione o animal.');
        return;
      }
      if (!inseminator || !inseminationDate) return;

      setIsSubmitting(true);
      setError(null);

      try {
        await api.post(`/org/farms/${farmId}/inseminations`, {
          animalId: selectedAnimalId,
          inseminationType,
          iatfProtocolId: iatfProtocolId || null,
          lotStepId: activeLot?.aiStepId || null,
          bullId: bullId || null,
          semenBatchId: semenBatchId || null,
          semenType: semenType || null,
          dosesUsed,
          inseminatorId: inseminator?.id || null,
          inseminatorName: inseminator?.name || '',
          inseminationDate,
          inseminationTime: inseminationTime || null,
          cervicalMucus: cervicalMucus || null,
          observations: observations.trim() || null,
        });
        onSuccess(1);
      } catch (_err) {
        setError('Não foi possível registrar a inseminação. Tente novamente.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      selectedAnimalId,
      inseminationType,
      iatfProtocolId,
      activeLot,
      bullId,
      semenBatchId,
      semenType,
      dosesUsed,
      inseminator,
      inseminationDate,
      inseminationTime,
      cervicalMucus,
      observations,
      farmId,
      onSuccess,
    ],
  );

  const handleSubmitNaturalMating = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedAnimalId) {
        setError('Selecione o animal.');
        return;
      }

      if (bullIdentified && !matingBullId) {
        setError('Selecione o touro.');
        return;
      }
      if (!bullIdentified && !bullBreedName.trim()) {
        setError('Informe a raça do touro.');
        return;
      }
      if (!matingDate) {
        setError('Informe a data da cobertura.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const payload: CreateNaturalMatingInput = {
          bullId: bullIdentified ? matingBullId || null : null,
          bullBreedName: !bullIdentified ? bullBreedName.trim() || null : null,
          reason: matingReason,
          entryDate: matingDate,
          exitDate: null,
          maxStayDays: null,
          animalIds: [selectedAnimalId],
          notes: matingNotes.trim() || null,
        };
        await api.post(`/org/farms/${farmId}/natural-matings`, payload);
        onSuccess(1);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar monta natural.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      selectedAnimalId,
      bullIdentified,
      matingBullId,
      bullBreedName,
      matingReason,
      matingDate,
      matingNotes,
      farmId,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  const isInsemSubmitDisabled =
    isSubmitting || !selectedAnimalId || !inseminator || !inseminationDate;
  const isMatingSubmitDisabled =
    isSubmitting ||
    !selectedAnimalId ||
    (bullIdentified && !matingBullId) ||
    (!bullIdentified && !bullBreedName.trim()) ||
    !matingDate;

  const animalSelector = (
    <div className="bulk-insem__field">
      <label htmlFor="bulk-animal">
        Animal <span aria-hidden="true">*</span>
      </label>
      {selectedAnimal ? (
        <div className="bulk-insem__animal-selected">
          <span className="bulk-insem__animal-selected-tag">{selectedAnimal.earTag}</span>
          <span className="bulk-insem__animal-selected-name">{selectedAnimal.name || '—'}</span>
          <span className="bulk-insem__animal-selected-cat">
            {CATEGORY_LABELS[selectedAnimal.category] || selectedAnimal.category}
          </span>
          <button
            type="button"
            className="bulk-insem__animal-selected-clear"
            onClick={handleClearAnimal}
            aria-label="Trocar animal"
          >
            Trocar
          </button>
        </div>
      ) : (
        <div className="bulk-insem__animal-combo">
          <div className="bulk-insem__animal-combo-input">
            <Search size={16} aria-hidden="true" />
            <input
              id="bulk-animal"
              type="text"
              value={animalSearch}
              onChange={(e) => {
                setAnimalSearch(e.target.value);
                setShowAnimalDropdown(true);
              }}
              onFocus={() => setShowAnimalDropdown(true)}
              placeholder={isLoadingAnimals ? 'Carregando...' : 'Buscar por brinco ou nome...'}
              aria-required="true"
              aria-expanded={showAnimalDropdown}
              aria-autocomplete="list"
              aria-controls="animal-listbox"
              role="combobox"
            />
          </div>
          {showAnimalDropdown && !isLoadingAnimals && (
            <ul id="animal-listbox" className="bulk-insem__animal-dropdown" role="listbox">
              {filteredAnimals.length === 0 ? (
                <li className="bulk-insem__animal-dropdown-empty">Nenhum animal encontrado</li>
              ) : (
                filteredAnimals.slice(0, 50).map((a) => (
                  <li
                    key={a.id}
                    className="bulk-insem__animal-dropdown-item"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelectAnimal(a.id)}
                  >
                    <span className="bulk-insem__animal-tag">{a.earTag}</span>
                    <span className="bulk-insem__animal-name">{a.name || '—'}</span>
                    <span className="bulk-insem__animal-cat">
                      {CATEGORY_LABELS[a.category] || a.category}
                    </span>
                  </li>
                ))
              )}
              {filteredAnimals.length > 50 && (
                <li className="bulk-insem__animal-dropdown-more">
                  Digite para filtrar mais ({filteredAnimals.length - 50} ocultos)
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="bulk-insem__overlay" onClick={onClose}>
      <div
        className="bulk-insem"
        onClick={(e) => {
          e.stopPropagation();
          // Close animal dropdown when clicking outside it
          if (showAnimalDropdown) {
            const target = e.target as HTMLElement;
            if (!target.closest('.bulk-insem__animal-combo')) {
              setShowAnimalDropdown(false);
            }
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-insem-title"
      >
        <header className="bulk-insem__header">
          <h2 id="bulk-insem-title">
            {mode === 'insemination' ? 'Nova inseminação' : 'Nova cobertura'}
          </h2>
          <button
            type="button"
            className="bulk-insem__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Mode selector tabs */}
        <div className="bulk-insem__mode-tabs" role="tablist" aria-label="Tipo de registro">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'insemination'}
            className={`bulk-insem__mode-tab ${mode === 'insemination' ? 'bulk-insem__mode-tab--active' : ''}`}
            onClick={() => {
              setMode('insemination');
              setError(null);
            }}
          >
            <Syringe size={16} aria-hidden="true" />
            Inseminação
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'natural_mating'}
            className={`bulk-insem__mode-tab ${mode === 'natural_mating' ? 'bulk-insem__mode-tab--active' : ''}`}
            onClick={() => {
              setMode('natural_mating');
              setError(null);
            }}
          >
            <Beef size={16} aria-hidden="true" />
            Cobertura
          </button>
        </div>

        {error && (
          <div className="bulk-insem__error" role="alert">
            {error}
          </div>
        )}

        {mode === 'insemination' ? (
          /* ─── Insemination form ─── */
          <form onSubmit={(e) => void handleSubmitInsemination(e)}>
            <div className="bulk-insem__body">
              {animalSelector}

              {/* Tipo + Protocolo IATF */}
              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-type">
                    Tipo <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="bulk-type"
                    value={inseminationType}
                    onChange={(e) => setInseminationType(e.target.value)}
                    required
                    aria-required="true"
                  >
                    {INSEMINATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-protocol">Protocolo IATF</label>
                  {autoDetectedProtocol ? (
                    <div className="bulk-insem__auto-protocol">
                      <Link2 size={16} aria-hidden="true" />
                      <span className="bulk-insem__auto-protocol-name">
                        {autoDetectedProtocol.name}
                      </span>
                      <span className="bulk-insem__auto-protocol-lot">
                        {autoDetectedProtocol.lotName}
                      </span>
                      <button
                        type="button"
                        className="bulk-insem__auto-protocol-change"
                        onClick={() => {
                          setAutoDetectedProtocol(null);
                          setIatfProtocolId('');
                        }}
                      >
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <>
                      <select
                        id="bulk-protocol"
                        value={iatfProtocolId}
                        onChange={(e) => setIatfProtocolId(e.target.value)}
                      >
                        <option value="">Sem protocolo vinculado</option>
                        {protocols.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {activeLot && !iatfProtocolId && (
                        <p className="bulk-insem__hint">
                          <Info size={14} aria-hidden="true" />
                          Animal em execução IATF ativa — selecione o protocolo para vincular.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Touro + Lote de sêmen */}
              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-bull">Touro</label>
                  <select id="bulk-bull" value={bullId} onChange={(e) => setBullId(e.target.value)}>
                    <option value="">Selecione o touro</option>
                    {bulls.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.breedName})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-batch">Lote de sêmen</label>
                  {bullId && availableBatches.length > 0 ? (
                    <select
                      id="bulk-batch"
                      value={semenBatchId}
                      onChange={(e) => setSemenBatchId(e.target.value)}
                    >
                      <option value="">Selecione o lote...</option>
                      {availableBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} — {b.semenTypeLabel} — {b.currentDoses} doses
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select id="bulk-batch" disabled>
                      <option value="">
                        {bullId ? 'Nenhum lote disponível' : 'Selecione o touro primeiro'}
                      </option>
                    </select>
                  )}
                </div>
              </div>

              {/* Tipo de sêmen + Doses */}
              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-semen-type">Tipo de sêmen</label>
                  {autoDetectedSemenType ? (
                    <div className="bulk-insem__auto-semen-type">
                      <span className="bulk-insem__auto-semen-type-label">
                        {autoDetectedSemenType}
                      </span>
                      <span className="bulk-insem__auto-semen-type-source">via lote</span>
                      <button
                        type="button"
                        className="bulk-insem__auto-protocol-change"
                        onClick={() => {
                          setAutoDetectedSemenType(null);
                          setSemenType('');
                        }}
                      >
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <select
                      id="bulk-semen-type"
                      value={semenType}
                      onChange={(e) => setSemenType(e.target.value)}
                    >
                      <option value="">Não informado</option>
                      {SEMEN_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-doses">Doses utilizadas</label>
                  <input
                    id="bulk-doses"
                    type="number"
                    min={1}
                    max={10}
                    value={dosesUsed}
                    onChange={(e) => setDosesUsed(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>

              {/* Data + Hora */}
              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-date">
                    Data <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="bulk-date"
                    type="date"
                    value={inseminationDate}
                    onChange={(e) => setInseminationDate(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-time">Hora</label>
                  <input
                    id="bulk-time"
                    type="time"
                    value={inseminationTime}
                    onChange={(e) => setInseminationTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Inseminador + Muco */}
              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-inseminator">
                    Inseminador <span aria-hidden="true">*</span>
                  </label>
                  <InseminatorSelect
                    id="bulk-inseminator"
                    farmId={farmId}
                    value={inseminator}
                    onChange={setInseminator}
                    required
                  />
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-mucus">Muco cervical</label>
                  <select
                    id="bulk-mucus"
                    value={cervicalMucus}
                    onChange={(e) => setCervicalMucus(e.target.value)}
                  >
                    <option value="">Não informado</option>
                    {CERVICAL_MUCUS_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bulk-insem__field">
                <label htmlFor="bulk-obs">Observações</label>
                <textarea
                  id="bulk-obs"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={2}
                  placeholder="Observações opcionais..."
                />
              </div>
            </div>

            <footer className="bulk-insem__footer">
              <button
                type="button"
                className="bulk-insem__btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bulk-insem__btn-primary"
                disabled={isInsemSubmitDisabled}
              >
                {isSubmitting ? 'Salvando...' : 'Registrar inseminação'}
              </button>
            </footer>
          </form>
        ) : (
          /* ─── Natural mating form ─── */
          <form onSubmit={(e) => void handleSubmitNaturalMating(e)}>
            <div className="bulk-insem__body">
              {animalSelector}

              {/* Bull identified toggle */}
              <div className="bulk-insem__toggle">
                <span className="bulk-insem__toggle-label">Touro identificado</span>
                <button
                  type="button"
                  className={`bulk-insem__toggle-switch ${bullIdentified ? 'bulk-insem__toggle-switch--active' : ''}`}
                  onClick={() => {
                    setBullIdentified((v) => !v);
                    setMatingBullId('');
                    setBullBreedName('');
                  }}
                  role="switch"
                  aria-checked={bullIdentified}
                  aria-label="Touro identificado"
                />
              </div>

              {bullIdentified ? (
                <div className="bulk-insem__field">
                  <label htmlFor="mating-bull">
                    Touro <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="mating-bull"
                    value={matingBullId}
                    onChange={(e) => setMatingBullId(e.target.value)}
                    required
                    aria-required="true"
                  >
                    <option value="">Selecione o touro...</option>
                    {bulls.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.breedName})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bulk-insem__field">
                  <label htmlFor="mating-breed">
                    Raça do touro <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="mating-breed"
                    type="text"
                    value={bullBreedName}
                    onChange={(e) => setBullBreedName(e.target.value)}
                    required
                    aria-required="true"
                    placeholder="Ex: Nelore, Angus, Brahman..."
                  />
                </div>
              )}

              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="mating-date">
                    Data da cobertura <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="mating-date"
                    type="date"
                    value={matingDate}
                    onChange={(e) => setMatingDate(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="mating-reason">
                    Motivo <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="mating-reason"
                    value={matingReason}
                    onChange={(e) => setMatingReason(e.target.value)}
                    required
                    aria-required="true"
                  >
                    {MATING_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bulk-insem__field">
                <label htmlFor="mating-notes">Observações</label>
                <textarea
                  id="mating-notes"
                  value={matingNotes}
                  onChange={(e) => setMatingNotes(e.target.value)}
                  rows={2}
                  placeholder="Observações sobre a monta (opcional)"
                />
              </div>
            </div>

            <footer className="bulk-insem__footer">
              <button
                type="button"
                className="bulk-insem__btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bulk-insem__btn-primary"
                disabled={isMatingSubmitDisabled}
              >
                {isSubmitting ? 'Salvando...' : 'Registrar cobertura'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
