import { useState, useEffect, useCallback } from 'react';
import { X, Search, Calendar, CheckSquare, Square } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateLotInput } from '@/types/iatf-execution';
import type { IatfProtocolDetail, StepItem } from '@/types/iatf-protocol';
import './CreateLotModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

interface AnimalOption {
  id: string;
  earTag: string;
  name: string | null;
}

interface ProtocolOption {
  id: string;
  name: string;
  targetCategory: string;
  targetCategoryLabel: string;
}

interface SchedulePreview {
  dayNumber: number;
  description: string;
  isAiDay: boolean;
  scheduledDate: string;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function CreateLotModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [protocolId, setProtocolId] = useState('');
  const [d0Date, setD0Date] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [animalSearch, setAnimalSearch] = useState('');

  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [protocolSteps, setProtocolSteps] = useState<StepItem[]>([]);
  const [schedulePreview, setSchedulePreview] = useState<SchedulePreview[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load reference data
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    void (async () => {
      try {
        const [protocolsRes, animalsRes] = await Promise.all([
          api.get<{ data: ProtocolOption[] }>(`/org/iatf-protocols?status=ACTIVE&limit=200`),
          api.get<{ data: AnimalOption[] }>(`/org/farms/${farmId}/animals?sex=FEMALE&limit=500`),
        ]);
        setProtocols(protocolsRes.data ?? []);
        setAnimals(animalsRes.data ?? []);
      } catch {
        setError('Erro ao carregar dados de referência');
      }
    })();
  }, [isOpen, farmId]);

  // Load protocol steps when protocol changes
  useEffect(() => {
    if (!protocolId) {
      setProtocolSteps([]);
      setSchedulePreview([]);
      return;
    }

    void (async () => {
      try {
        const detail = await api.get<IatfProtocolDetail>(`/org/iatf-protocols/${protocolId}`);
        setProtocolSteps(detail.steps ?? []);
      } catch {
        setProtocolSteps([]);
      }
    })();
  }, [protocolId]);

  // Build schedule preview when steps or d0Date changes
  useEffect(() => {
    if (protocolSteps.length === 0 || !d0Date) {
      setSchedulePreview([]);
      return;
    }

    const preview: SchedulePreview[] = protocolSteps
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((step) => ({
        dayNumber: step.dayNumber,
        description: step.description,
        isAiDay: step.isAiDay,
        scheduledDate: addDays(d0Date, step.dayNumber),
      }));
    setSchedulePreview(preview);
  }, [protocolSteps, d0Date]);

  const toggleAnimal = useCallback((animalId: string) => {
    setSelectedAnimalIds((prev) =>
      prev.includes(animalId) ? prev.filter((id) => id !== animalId) : [...prev, animalId],
    );
  }, []);

  const toggleAll = useCallback(() => {
    const filteredIds = filteredAnimals.map((a) => a.id);
    setSelectedAnimalIds((prev) => {
      const allSelected = filteredIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !filteredIds.includes(id));
      }
      return [...new Set([...prev, ...filteredIds])];
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !protocolId || !d0Date || selectedAnimalIds.length === 0) return;

      setIsLoading(true);
      setError(null);

      const input: CreateLotInput = {
        name: name.trim(),
        protocolId,
        d0Date,
        animalIds: selectedAnimalIds,
        notes: notes.trim() || null,
      };

      try {
        await api.post(`/org/farms/${farmId}/reproductive-lots`, input);
        resetForm();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar lote reprodutivo');
      } finally {
        setIsLoading(false);
      }
    },
    [name, protocolId, d0Date, selectedAnimalIds, notes, farmId, onSuccess],
  );

  const resetForm = () => {
    setName('');
    setProtocolId('');
    setD0Date(new Date().toISOString().slice(0, 10));
    setNotes('');
    setSelectedAnimalIds([]);
    setAnimalSearch('');
    setProtocolSteps([]);
    setSchedulePreview([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const filteredAnimals = animalSearch
    ? animals.filter(
        (a) =>
          a.earTag.toLowerCase().includes(animalSearch.toLowerCase()) ||
          (a.name ?? '').toLowerCase().includes(animalSearch.toLowerCase()),
      )
    : animals;

  const allFilteredSelected =
    filteredAnimals.length > 0 && filteredAnimals.every((a) => selectedAnimalIds.includes(a.id));

  return (
    <div className="create-lot-modal__overlay" onClick={handleClose}>
      <div
        className="create-lot-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lot-title"
      >
        <header className="create-lot-modal__header">
          <h2 id="create-lot-title">Novo lote reprodutivo</h2>
          <button
            type="button"
            className="create-lot-modal__close"
            onClick={handleClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="create-lot-modal__body">
            {error && (
              <div className="create-lot-modal__error" role="alert">
                {error}
              </div>
            )}

            <div className="create-lot-modal__field">
              <label htmlFor="lot-name">
                Nome do lote <span aria-hidden="true">*</span>
              </label>
              <input
                id="lot-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Lote IATF Março/2026"
                required
                aria-required="true"
              />
            </div>

            <div className="create-lot-modal__row">
              <div className="create-lot-modal__field">
                <label htmlFor="lot-protocol">
                  Protocolo IATF <span aria-hidden="true">*</span>
                </label>
                <select
                  id="lot-protocol"
                  value={protocolId}
                  onChange={(e) => setProtocolId(e.target.value)}
                  required
                  aria-required="true"
                >
                  <option value="">Selecione um protocolo</option>
                  {protocols.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.targetCategoryLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="create-lot-modal__field">
                <label htmlFor="lot-d0-date">
                  Data D0 <span aria-hidden="true">*</span>
                </label>
                <input
                  id="lot-d0-date"
                  type="date"
                  value={d0Date}
                  onChange={(e) => setD0Date(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
            </div>

            {/* Schedule preview */}
            {schedulePreview.length > 0 && (
              <div className="create-lot-modal__schedule-preview">
                <h3>Cronograma previsto</h3>
                <div className="create-lot-modal__schedule-list">
                  {schedulePreview.map((s, i) => (
                    <div
                      key={i}
                      className={`create-lot-modal__schedule-item ${s.isAiDay ? 'create-lot-modal__schedule-item--ai' : ''}`}
                    >
                      <span className="create-lot-modal__schedule-day">D{s.dayNumber}</span>
                      <span className="create-lot-modal__schedule-date">
                        <Calendar size={14} aria-hidden="true" />
                        {new Date(s.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span className="create-lot-modal__schedule-desc">{s.description}</span>
                      {s.isAiDay && <span className="create-lot-modal__ai-badge">IA</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Animal selection */}
            <div className="create-lot-modal__animals-section">
              <h3>
                Selecionar animais <span aria-hidden="true">*</span>
                <span className="create-lot-modal__animal-count">
                  {selectedAnimalIds.length} selecionado{selectedAnimalIds.length !== 1 ? 's' : ''}
                </span>
              </h3>

              <div className="create-lot-modal__animal-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Buscar por brinco ou nome..."
                  value={animalSearch}
                  onChange={(e) => setAnimalSearch(e.target.value)}
                  aria-label="Buscar animais"
                />
              </div>

              <div className="create-lot-modal__animal-list-header">
                <button
                  type="button"
                  className="create-lot-modal__select-all"
                  onClick={toggleAll}
                  aria-label={allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                >
                  {allFilteredSelected ? (
                    <CheckSquare size={18} aria-hidden="true" />
                  ) : (
                    <Square size={18} aria-hidden="true" />
                  )}
                  {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              <ul
                className="create-lot-modal__animal-list"
                role="listbox"
                aria-multiselectable="true"
              >
                {filteredAnimals.length === 0 && (
                  <li className="create-lot-modal__animal-empty">Nenhum animal encontrado</li>
                )}
                {filteredAnimals.map((animal) => {
                  const selected = selectedAnimalIds.includes(animal.id);
                  return (
                    <li
                      key={animal.id}
                      className={`create-lot-modal__animal-item ${selected ? 'create-lot-modal__animal-item--selected' : ''}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleAnimal(animal.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleAnimal(animal.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      {selected ? (
                        <CheckSquare size={18} aria-hidden="true" />
                      ) : (
                        <Square size={18} aria-hidden="true" />
                      )}
                      <span className="create-lot-modal__animal-tag">{animal.earTag}</span>
                      {animal.name && (
                        <span className="create-lot-modal__animal-name">{animal.name}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="create-lot-modal__field">
              <label htmlFor="lot-notes">Observações</label>
              <textarea
                id="lot-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Observações opcionais..."
              />
            </div>
          </div>

          <footer className="create-lot-modal__footer">
            <button type="button" className="create-lot-modal__btn-secondary" onClick={handleClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="create-lot-modal__btn-primary"
              disabled={isLoading || !name.trim() || !protocolId || selectedAnimalIds.length === 0}
            >
              {isLoading ? 'Salvando...' : 'Criar lote'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
