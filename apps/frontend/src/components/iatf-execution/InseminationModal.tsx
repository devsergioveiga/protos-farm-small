import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { RecordInseminationInput, LotAnimalItem } from '@/types/iatf-execution';
import { INSEMINATION_TYPES, CERVICAL_MUCUS_OPTIONS } from '@/types/iatf-execution';
import type { BullItem, SemenBatchItem } from '@/types/bull';
import './InseminationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  lotId?: string | null;
  lotAnimals?: LotAnimalItem[];
  preSelectedAnimalId?: string | null;
  onSuccess: () => void;
}

interface MatingPlanBull {
  animalId: string;
  bullId: string;
  bullName: string;
}

export default function InseminationModal({
  isOpen,
  onClose,
  farmId,
  lotId,
  lotAnimals,
  preSelectedAnimalId,
  onSuccess,
}: Props) {
  const [animalId, setAnimalId] = useState(preSelectedAnimalId ?? '');
  const [inseminationType, setInseminationType] = useState('IATF');
  const [bullId, setBullId] = useState('');
  const [semenBatchId, setSemenBatchId] = useState('');
  const [dosesUsed, setDosesUsed] = useState(1);
  const [inseminatorName, setInseminatorName] = useState('');
  const [inseminationDate, setInseminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [inseminationTime, setInseminationTime] = useState('');
  const [cervicalMucus, setCervicalMucus] = useState('');
  const [observations, setObservations] = useState('');

  const [bulls, setBulls] = useState<BullItem[]>([]);
  const [selectedBullBatches, setSelectedBullBatches] = useState<SemenBatchItem[]>([]);
  const [plannedBulls, setPlannedBulls] = useState<MatingPlanBull[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setAnimalId(preSelectedAnimalId ?? '');
      setInseminationType('IATF');
      setBullId('');
      setSemenBatchId('');
      setDosesUsed(1);
      setInseminatorName('');
      setInseminationDate(new Date().toISOString().slice(0, 10));
      setInseminationTime('');
      setCervicalMucus('');
      setObservations('');
      setError(null);
    }
  }, [isOpen, preSelectedAnimalId]);

  // Load bulls and mating plan data
  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      try {
        const bullsRes = await api.get<{ data: BullItem[] }>(
          `/org/farms/${farmId}/bulls?status=ACTIVE&limit=200`,
        );
        setBulls(bullsRes.data ?? []);
      } catch {
        // silently fail — bulls are optional
      }

      // Try to load planned bulls from mating plans
      try {
        const plansRes = await api.get<{ data: MatingPlanBull[] }>(
          `/org/farms/${farmId}/mating-plans/active-assignments`,
        );
        setPlannedBulls(plansRes.data ?? []);
      } catch {
        // planned bulls are optional, no-op
        setPlannedBulls([]);
      }
    })();
  }, [isOpen, farmId]);

  // Load batches when bull changes
  useEffect(() => {
    if (!bullId) {
      setSelectedBullBatches([]);
      setSemenBatchId('');
      return;
    }
    const bull = bulls.find((b) => b.id === bullId);
    if (bull) {
      const available = bull.semenBatches.filter((b) => b.currentDoses > 0);
      setSelectedBullBatches(available);
      setSemenBatchId('');
    }
  }, [bullId, bulls]);

  // Find planned bull for the selected animal
  const plannedBull = plannedBulls.find((p) => p.animalId === animalId);
  const isPlannedBull = plannedBull ? bullId === plannedBull.bullId : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!animalId || !inseminatorName.trim() || !inseminationDate) return;

      setIsLoading(true);
      setError(null);

      const input: RecordInseminationInput = {
        animalId,
        reproductiveLotId: lotId ?? null,
        inseminationType,
        bullId: bullId || null,
        semenBatchId: semenBatchId || null,
        dosesUsed,
        inseminatorName: inseminatorName.trim(),
        inseminationDate,
        inseminationTime: inseminationTime || null,
        cervicalMucus: cervicalMucus || null,
        observations: observations.trim() || null,
      };

      try {
        await api.post(`/org/farms/${farmId}/inseminations`, input);
        onSuccess();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar inseminação');
      } finally {
        setIsLoading(false);
      }
    },
    [
      animalId,
      inseminationType,
      bullId,
      semenBatchId,
      dosesUsed,
      inseminatorName,
      inseminationDate,
      inseminationTime,
      cervicalMucus,
      observations,
      farmId,
      lotId,
      onSuccess,
      onClose,
    ],
  );

  if (!isOpen) return null;

  return (
    <div className="insemination-modal__overlay" onClick={onClose}>
      <div
        className="insemination-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insemination-title"
      >
        <header className="insemination-modal__header">
          <h2 id="insemination-title">Registrar inseminação</h2>
          <button
            type="button"
            className="insemination-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="insemination-modal__body">
            {error && (
              <div className="insemination-modal__error" role="alert">
                {error}
              </div>
            )}

            {/* Planned bull indicator */}
            {plannedBull && (
              <div className="insemination-modal__planned-bull">
                {isPlannedBull === true && (
                  <span className="insemination-modal__planned-match">
                    <CheckCircle size={16} aria-hidden="true" />
                    Touro conforme plano de acasalamento: {plannedBull.bullName}
                  </span>
                )}
                {isPlannedBull === false && bullId && (
                  <span className="insemination-modal__planned-mismatch">
                    <AlertTriangle size={16} aria-hidden="true" />
                    Touro planejado era {plannedBull.bullName}. Touro substituído.
                  </span>
                )}
                {!bullId && (
                  <span className="insemination-modal__planned-info">
                    Touro planejado: {plannedBull.bullName}
                  </span>
                )}
              </div>
            )}

            <div className="insemination-modal__row">
              <div className="insemination-modal__field">
                <label htmlFor="insem-animal">
                  Animal <span aria-hidden="true">*</span>
                </label>
                {lotAnimals && lotAnimals.length > 0 ? (
                  <select
                    id="insem-animal"
                    value={animalId}
                    onChange={(e) => setAnimalId(e.target.value)}
                    required
                    aria-required="true"
                  >
                    <option value="">Selecione o animal</option>
                    {lotAnimals
                      .filter((a) => !a.removedAt)
                      .map((a) => (
                        <option key={a.animalId} value={a.animalId}>
                          {a.earTag} {a.animalName ? `— ${a.animalName}` : ''}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    id="insem-animal"
                    type="text"
                    value={animalId}
                    onChange={(e) => setAnimalId(e.target.value)}
                    placeholder="ID do animal"
                    required
                    aria-required="true"
                  />
                )}
              </div>

              <div className="insemination-modal__field">
                <label htmlFor="insem-type">
                  Tipo <span aria-hidden="true">*</span>
                </label>
                <select
                  id="insem-type"
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
            </div>

            <div className="insemination-modal__row">
              <div className="insemination-modal__field">
                <label htmlFor="insem-bull">Touro</label>
                <select id="insem-bull" value={bullId} onChange={(e) => setBullId(e.target.value)}>
                  <option value="">Selecione o touro</option>
                  {bulls.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.breedName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="insemination-modal__field">
                <label htmlFor="insem-batch">Partida de sêmen</label>
                <select
                  id="insem-batch"
                  value={semenBatchId}
                  onChange={(e) => setSemenBatchId(e.target.value)}
                  disabled={!bullId || selectedBullBatches.length === 0}
                >
                  <option value="">
                    {!bullId
                      ? 'Selecione um touro primeiro'
                      : selectedBullBatches.length === 0
                        ? 'Sem partidas disponíveis'
                        : 'Selecione a partida'}
                  </option>
                  {selectedBullBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} ({b.currentDoses} doses)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="insemination-modal__row insemination-modal__row--three">
              <div className="insemination-modal__field">
                <label htmlFor="insem-doses">Doses utilizadas</label>
                <input
                  id="insem-doses"
                  type="number"
                  min="1"
                  value={dosesUsed}
                  onChange={(e) => setDosesUsed(Number(e.target.value))}
                />
              </div>

              <div className="insemination-modal__field">
                <label htmlFor="insem-date">
                  Data <span aria-hidden="true">*</span>
                </label>
                <input
                  id="insem-date"
                  type="date"
                  value={inseminationDate}
                  onChange={(e) => setInseminationDate(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>

              <div className="insemination-modal__field">
                <label htmlFor="insem-time">Hora</label>
                <input
                  id="insem-time"
                  type="time"
                  value={inseminationTime}
                  onChange={(e) => setInseminationTime(e.target.value)}
                />
              </div>
            </div>

            <div className="insemination-modal__row">
              <div className="insemination-modal__field">
                <label htmlFor="insem-inseminator">
                  Inseminador <span aria-hidden="true">*</span>
                </label>
                <input
                  id="insem-inseminator"
                  type="text"
                  value={inseminatorName}
                  onChange={(e) => setInseminatorName(e.target.value)}
                  placeholder="Nome do inseminador"
                  required
                  aria-required="true"
                />
              </div>

              <div className="insemination-modal__field">
                <label htmlFor="insem-mucus">Muco cervical</label>
                <select
                  id="insem-mucus"
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

            <div className="insemination-modal__field">
              <label htmlFor="insem-obs">Observações</label>
              <textarea
                id="insem-obs"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                placeholder="Observações opcionais..."
              />
            </div>
          </div>

          <footer className="insemination-modal__footer">
            <button type="button" className="insemination-modal__btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="insemination-modal__btn-primary"
              disabled={isLoading || !animalId || !inseminatorName.trim() || !inseminationDate}
            >
              {isLoading ? 'Salvando...' : 'Registrar inseminação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
