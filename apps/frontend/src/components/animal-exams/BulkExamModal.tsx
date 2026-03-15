import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useExamTypes } from '@/hooks/useExamTypes';
import type { BulkExamInput } from '@/types/animal-exam';
import './BulkExamModal.css';

interface LotOption {
  id: string;
  name: string;
}

interface BulkExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

export default function BulkExamModal({ isOpen, onClose, farmId, onSuccess }: BulkExamModalProps) {
  const [animalLotId, setAnimalLotId] = useState('');
  const [examTypeId, setExamTypeId] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [sendDate, setSendDate] = useState('');
  const [laboratory, setLaboratory] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [veterinaryName, setVeterinaryName] = useState('');

  const [lots, setLots] = useState<LotOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { examTypes } = useExamTypes({ limit: 100 });

  useEffect(() => {
    if (!isOpen || !farmId) return;
    void (async () => {
      try {
        const result = await api.get<{ data: LotOption[] }>(
          `/org/farms/${farmId}/animal-lots?limit=200`,
        );
        setLots(result.data);
      } catch {
        setLots([]);
      }
    })();
  }, [isOpen, farmId]);

  useEffect(() => {
    if (isOpen) {
      setAnimalLotId('');
      setExamTypeId('');
      setCollectionDate('');
      setSendDate('');
      setLaboratory('');
      setProtocolNumber('');
      setResponsibleName('');
      setVeterinaryName('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMsg(null);
      setSaving(true);

      try {
        const body: BulkExamInput = {
          animalLotId,
          examTypeId,
          collectionDate,
          sendDate: sendDate || null,
          laboratory: laboratory || null,
          protocolNumber: protocolNumber || null,
          responsibleName: responsibleName.trim(),
          veterinaryName: veterinaryName || null,
        };

        const result = await api.post<{ animalCount: number }>(
          `/org/farms/${farmId}/animal-exams/bulk`,
          body,
        );

        setSuccessMsg(`Exame registrado para ${result.animalCount} animais do lote`);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar exame em lote');
      } finally {
        setSaving(false);
      }
    },
    [
      animalLotId,
      examTypeId,
      collectionDate,
      sendDate,
      laboratory,
      protocolNumber,
      responsibleName,
      veterinaryName,
      farmId,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  return (
    <div className="bulk-exam-modal__overlay" onClick={onClose}>
      <div
        className="bulk-exam-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Examinar lote"
      >
        <header className="bulk-exam-modal__header">
          <h2>Examinar lote</h2>
          <button
            type="button"
            className="bulk-exam-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="bulk-exam-modal__body">
          <form className="bulk-exam-modal__form" onSubmit={handleSubmit} id="bulk-exam-form">
            {error && (
              <div className="bulk-exam-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bulk-exam-modal__success" role="status">
                <CheckCircle size={16} aria-hidden="true" />
                {successMsg}
              </div>
            )}

            <div className="bulk-exam-modal__row">
              <div className="bulk-exam-modal__field">
                <label htmlFor="be-lot">Lote *</label>
                <select
                  id="be-lot"
                  value={animalLotId}
                  onChange={(e) => setAnimalLotId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bulk-exam-modal__field">
                <label htmlFor="be-exam-type">Tipo de exame *</label>
                <select
                  id="be-exam-type"
                  value={examTypeId}
                  onChange={(e) => setExamTypeId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {examTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bulk-exam-modal__row">
              <div className="bulk-exam-modal__field">
                <label htmlFor="be-collection-date">Data da coleta *</label>
                <input
                  id="be-collection-date"
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div className="bulk-exam-modal__field">
                <label htmlFor="be-send-date">Data de envio</label>
                <input
                  id="be-send-date"
                  type="date"
                  value={sendDate}
                  onChange={(e) => setSendDate(e.target.value)}
                />
              </div>
            </div>

            <div className="bulk-exam-modal__row">
              <div className="bulk-exam-modal__field">
                <label htmlFor="be-lab">Laboratório</label>
                <input
                  id="be-lab"
                  type="text"
                  value={laboratory}
                  onChange={(e) => setLaboratory(e.target.value)}
                />
              </div>

              <div className="bulk-exam-modal__field">
                <label htmlFor="be-protocol">Nº protocolo</label>
                <input
                  id="be-protocol"
                  type="text"
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="bulk-exam-modal__row">
              <div className="bulk-exam-modal__field">
                <label htmlFor="be-responsible">Responsável *</label>
                <input
                  id="be-responsible"
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  required
                />
              </div>

              <div className="bulk-exam-modal__field">
                <label htmlFor="be-vet">Veterinário</label>
                <input
                  id="be-vet"
                  type="text"
                  value={veterinaryName}
                  onChange={(e) => setVeterinaryName(e.target.value)}
                />
              </div>
            </div>
          </form>
        </div>

        <footer className="bulk-exam-modal__footer">
          <button type="button" className="bulk-exam-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="bulk-exam-form"
            className="bulk-exam-modal__btn-save"
            disabled={saving || !!successMsg}
          >
            {saving ? 'Registrando...' : 'Examinar lote'}
          </button>
        </footer>
      </div>
    </div>
  );
}
