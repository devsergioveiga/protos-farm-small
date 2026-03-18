import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useExamTypes } from '@/hooks/useExamTypes';
import type { AnimalExamItem, CreateAnimalExamInput, ExamTypeItem } from '@/types/animal-exam';
import './AnimalExamModal.css';

interface AnimalExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: AnimalExamItem | null;
  farmId: string;
  onSuccess: () => void;
}

interface AnimalOption {
  id: string;
  earTag: string;
  name: string | null;
}

export default function AnimalExamModal({
  isOpen,
  onClose,
  exam,
  farmId,
  onSuccess,
}: AnimalExamModalProps) {
  const [animalId, setAnimalId] = useState('');
  const [examTypeId, setExamTypeId] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [sendDate, setSendDate] = useState('');
  const [laboratory, setLaboratory] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [veterinaryName, setVeterinaryName] = useState('');
  const [veterinaryCrmv, setVeterinaryCrmv] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [certificateValidity, setCertificateValidity] = useState('');
  const [notes, setNotes] = useState('');

  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { examTypes } = useExamTypes({ limit: 100 });

  const selectedExamType: ExamTypeItem | undefined = examTypes.find((et) => et.id === examTypeId);
  const isRegulatory = selectedExamType?.isRegulatory ?? false;

  // Load animals
  useEffect(() => {
    if (!isOpen || !farmId) return;
    void (async () => {
      try {
        const result = await api.get<{ data: AnimalOption[] }>(
          `/org/farms/${farmId}/animals?limit=500`,
        );
        setAnimals(result.data);
      } catch {
        setAnimals([]);
      }
    })();
  }, [isOpen, farmId]);

  useEffect(() => {
    if (isOpen) {
      if (exam) {
        setAnimalId(exam.animalId);
        setExamTypeId(exam.examTypeId);
        setCollectionDate(exam.collectionDate);
        setSendDate(exam.sendDate ?? '');
        setLaboratory(exam.laboratory ?? '');
        setProtocolNumber(exam.protocolNumber ?? '');
        setResponsibleName(exam.responsibleName);
        setVeterinaryName(exam.veterinaryName ?? '');
        setVeterinaryCrmv(exam.veterinaryCrmv ?? '');
        setCertificateNumber(exam.certificateNumber ?? '');
        setCertificateValidity(exam.certificateValidity ?? '');
        setNotes(exam.notes ?? '');
      } else {
        setAnimalId('');
        setExamTypeId('');
        setCollectionDate('');
        setSendDate('');
        setLaboratory('');
        setProtocolNumber('');
        setResponsibleName('');
        setVeterinaryName('');
        setVeterinaryCrmv('');
        setCertificateNumber('');
        setCertificateValidity('');
        setNotes('');
      }
      setError(null);
    }
  }, [isOpen, exam]);

  // Auto-fill lab from exam type
  useEffect(() => {
    if (!exam && selectedExamType?.defaultLab) {
      setLaboratory(selectedExamType.defaultLab);
    }
  }, [selectedExamType, exam]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSaving(true);

      try {
        const body: CreateAnimalExamInput = {
          animalId,
          examTypeId,
          collectionDate,
          sendDate: sendDate || null,
          laboratory: laboratory || null,
          protocolNumber: protocolNumber || null,
          responsibleName: responsibleName.trim(),
          veterinaryName: veterinaryName || null,
          veterinaryCrmv: veterinaryCrmv || null,
          certificateNumber: certificateNumber || null,
          certificateValidity: certificateValidity || null,
          notes: notes || null,
        };

        if (exam) {
          const updateBody = { ...body };
          delete (updateBody as Record<string, unknown>).animalId;
          delete (updateBody as Record<string, unknown>).examTypeId;
          await api.patch(`/org/farms/${farmId}/animal-exams/${exam.id}`, updateBody);
        } else {
          await api.post(`/org/farms/${farmId}/animal-exams`, body);
        }

        onSuccess();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar exame');
      } finally {
        setSaving(false);
      }
    },
    [
      animalId,
      examTypeId,
      collectionDate,
      sendDate,
      laboratory,
      protocolNumber,
      responsibleName,
      veterinaryName,
      veterinaryCrmv,
      certificateNumber,
      certificateValidity,
      notes,
      exam,
      farmId,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  return (
    <div className="animal-exam-modal__overlay" onClick={onClose}>
      <div
        className="animal-exam-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={exam ? 'Editar exame' : 'Novo exame'}
      >
        <header className="animal-exam-modal__header">
          <h2>{exam ? 'Editar exame' : 'Novo exame'}</h2>
          <button
            type="button"
            className="animal-exam-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="animal-exam-modal__body">
          <form className="animal-exam-modal__form" onSubmit={handleSubmit} id="animal-exam-form">
            {error && (
              <div className="animal-exam-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="animal-exam-modal__row">
              <div className="animal-exam-modal__field">
                <label htmlFor="ae-animal">Animal *</label>
                <select
                  id="ae-animal"
                  value={animalId}
                  onChange={(e) => setAnimalId(e.target.value)}
                  required
                  disabled={!!exam}
                >
                  <option value="">Selecione...</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.earTag} — {a.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="animal-exam-modal__field">
                <label htmlFor="ae-exam-type">Tipo de exame *</label>
                <select
                  id="ae-exam-type"
                  value={examTypeId}
                  onChange={(e) => setExamTypeId(e.target.value)}
                  required
                  disabled={!!exam}
                >
                  <option value="">Selecione...</option>
                  {examTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.name} ({et.categoryLabel})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="animal-exam-modal__row">
              <div className="animal-exam-modal__field">
                <label htmlFor="ae-collection-date">Data da coleta *</label>
                <input
                  id="ae-collection-date"
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div className="animal-exam-modal__field">
                <label htmlFor="ae-send-date">Data de envio</label>
                <input
                  id="ae-send-date"
                  type="date"
                  value={sendDate}
                  onChange={(e) => setSendDate(e.target.value)}
                />
              </div>
            </div>

            <div className="animal-exam-modal__row">
              <div className="animal-exam-modal__field">
                <label htmlFor="ae-lab">Laboratório</label>
                <input
                  id="ae-lab"
                  type="text"
                  value={laboratory}
                  onChange={(e) => setLaboratory(e.target.value)}
                  placeholder="Ex: Lab Central"
                />
              </div>

              <div className="animal-exam-modal__field">
                <label htmlFor="ae-protocol">Nº protocolo/amostra</label>
                <input
                  id="ae-protocol"
                  type="text"
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                  placeholder="Ex: PROT-001"
                />
              </div>
            </div>

            <div className="animal-exam-modal__row">
              <div className="animal-exam-modal__field">
                <label htmlFor="ae-responsible">Responsável *</label>
                <input
                  id="ae-responsible"
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  required
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="animal-exam-modal__field">
                <label htmlFor="ae-vet">Veterinário</label>
                <input
                  id="ae-vet"
                  type="text"
                  value={veterinaryName}
                  onChange={(e) => setVeterinaryName(e.target.value)}
                  placeholder="Nome do veterinário"
                />
              </div>
            </div>

            {isRegulatory && (
              <div className="animal-exam-modal__regulatory-section">
                <p className="animal-exam-modal__regulatory-title">Dados regulatórios</p>
                <div className="animal-exam-modal__row">
                  <div className="animal-exam-modal__field">
                    <label htmlFor="ae-crmv">CRMV</label>
                    <input
                      id="ae-crmv"
                      type="text"
                      value={veterinaryCrmv}
                      onChange={(e) => setVeterinaryCrmv(e.target.value)}
                      placeholder="Ex: CRMV-SP 12345"
                    />
                  </div>

                  <div className="animal-exam-modal__field">
                    <label htmlFor="ae-cert-number">Nº atestado</label>
                    <input
                      id="ae-cert-number"
                      type="text"
                      value={certificateNumber}
                      onChange={(e) => setCertificateNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="animal-exam-modal__field" style={{ marginTop: 16 }}>
                  <label htmlFor="ae-cert-validity">Validade do atestado</label>
                  <input
                    id="ae-cert-validity"
                    type="date"
                    value={certificateValidity}
                    onChange={(e) => setCertificateValidity(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="animal-exam-modal__field">
              <label htmlFor="ae-notes">Observações</label>
              <textarea
                id="ae-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </form>
        </div>

        <footer className="animal-exam-modal__footer">
          <button type="button" className="animal-exam-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="animal-exam-form"
            className="animal-exam-modal__btn-save"
            disabled={saving}
          >
            {saving ? 'Salvando...' : exam ? 'Salvar alterações' : 'Registrar exame'}
          </button>
        </footer>
      </div>
    </div>
  );
}
