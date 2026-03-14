import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { AnimalExamItem, ExamTypeItem, RecordResultsInput } from '@/types/animal-exam';
import './ExamResultsModal.css';

interface ParamResult {
  paramName: string;
  unit: string | null;
  minReference: number | null;
  maxReference: number | null;
  isBooleanResult: boolean;
  numericValue: string;
  booleanValue: boolean | null;
}

interface ExamResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: AnimalExamItem | null;
  farmId: string;
  examTypes: ExamTypeItem[];
  onSuccess: () => void;
}

function calcPreviewIndicator(p: ParamResult): { label: string; className: string } | null {
  if (p.isBooleanResult && p.booleanValue != null) {
    return p.booleanValue
      ? { label: 'Positivo', className: 'exam-results-modal__indicator--positive' }
      : { label: 'Negativo', className: 'exam-results-modal__indicator--negative' };
  }
  if (!p.isBooleanResult && p.numericValue) {
    const val = Number(p.numericValue);
    if (isNaN(val)) return null;
    if (p.minReference != null && val < p.minReference)
      return { label: 'Abaixo', className: 'exam-results-modal__indicator--below' };
    if (p.maxReference != null && val > p.maxReference)
      return { label: 'Acima', className: 'exam-results-modal__indicator--above' };
    if (p.minReference != null || p.maxReference != null)
      return { label: 'Normal', className: 'exam-results-modal__indicator--normal' };
  }
  return null;
}

export default function ExamResultsModal({
  isOpen,
  onClose,
  exam,
  farmId,
  examTypes,
  onSuccess,
}: ExamResultsModalProps) {
  const [resultDate, setResultDate] = useState('');
  const [paramResults, setParamResults] = useState<ParamResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && exam) {
      setResultDate(new Date().toISOString().slice(0, 10));
      setError(null);

      const examType = examTypes.find((et) => et.id === exam.examTypeId);
      const refParams = examType?.referenceParams ?? [];

      if (exam.results.length > 0) {
        setParamResults(
          exam.results.map((r) => ({
            paramName: r.paramName,
            unit: r.unit,
            minReference: r.minReference,
            maxReference: r.maxReference,
            isBooleanResult: r.booleanValue != null,
            numericValue: r.numericValue != null ? String(r.numericValue) : '',
            booleanValue: r.booleanValue,
          })),
        );
      } else if (refParams.length > 0) {
        setParamResults(
          refParams.map((p) => ({
            paramName: p.paramName,
            unit: p.unit,
            minReference: p.minReference,
            maxReference: p.maxReference,
            isBooleanResult: p.isBooleanResult,
            numericValue: '',
            booleanValue: null,
          })),
        );
      } else {
        setParamResults([
          {
            paramName: 'Resultado',
            unit: null,
            minReference: null,
            maxReference: null,
            isBooleanResult: true,
            numericValue: '',
            booleanValue: null,
          },
        ]);
      }
    }
  }, [isOpen, exam, examTypes]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!exam) return;
      setError(null);
      setSaving(true);

      try {
        const body: RecordResultsInput = {
          resultDate,
          results: paramResults
            .filter((p) => p.numericValue || p.booleanValue != null)
            .map((p) => ({
              paramName: p.paramName,
              numericValue: p.numericValue ? Number(p.numericValue) : null,
              booleanValue: p.booleanValue,
              unit: p.unit,
              minReference: p.minReference,
              maxReference: p.maxReference,
            })),
        };

        await api.post(`/org/farms/${farmId}/animal-exams/${exam.id}/results`, body);
        onSuccess();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar resultados');
      } finally {
        setSaving(false);
      }
    },
    [exam, resultDate, paramResults, farmId, onSuccess],
  );

  if (!isOpen || !exam) return null;

  return (
    <div className="exam-results-modal__overlay" onClick={onClose}>
      <div
        className="exam-results-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar resultados"
      >
        <header className="exam-results-modal__header">
          <h2>Registrar resultados</h2>
          <button
            type="button"
            className="exam-results-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="exam-results-modal__body">
          <div className="exam-results-modal__info">
            <strong>{exam.animalEarTag}</strong> — {exam.examTypeName}
            <br />
            Coleta: {new Date(exam.collectionDate).toLocaleDateString('pt-BR')}
            {exam.laboratory && <> | Lab: {exam.laboratory}</>}
          </div>

          <form className="exam-results-modal__form" onSubmit={handleSubmit} id="exam-results-form">
            {error && (
              <div className="exam-results-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="exam-results-modal__field">
              <label htmlFor="er-result-date">Data do resultado *</label>
              <input
                id="er-result-date"
                type="date"
                value={resultDate}
                onChange={(e) => setResultDate(e.target.value)}
                required
              />
            </div>

            <table className="exam-results-modal__params-table">
              <thead>
                <tr>
                  <th scope="col">Parâmetro</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Referência</th>
                  <th scope="col">Indicador</th>
                </tr>
              </thead>
              <tbody>
                {paramResults.map((p, i) => {
                  const preview = calcPreviewIndicator(p);
                  return (
                    <tr key={i}>
                      <td>
                        <span className="exam-results-modal__param-name">{p.paramName}</span>
                        {p.unit && (
                          <span className="exam-results-modal__param-ref"> ({p.unit})</span>
                        )}
                      </td>
                      <td>
                        {p.isBooleanResult ? (
                          <div className="exam-results-modal__toggle">
                            <button
                              type="button"
                              className={p.booleanValue === true ? 'active--positive' : ''}
                              onClick={() =>
                                setParamResults((prev) =>
                                  prev.map((pr, j) =>
                                    j === i ? { ...pr, booleanValue: true } : pr,
                                  ),
                                )
                              }
                            >
                              Pos
                            </button>
                            <button
                              type="button"
                              className={p.booleanValue === false ? 'active--negative' : ''}
                              onClick={() =>
                                setParamResults((prev) =>
                                  prev.map((pr, j) =>
                                    j === i ? { ...pr, booleanValue: false } : pr,
                                  ),
                                )
                              }
                            >
                              Neg
                            </button>
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            value={p.numericValue}
                            onChange={(e) =>
                              setParamResults((prev) =>
                                prev.map((pr, j) =>
                                  j === i ? { ...pr, numericValue: e.target.value } : pr,
                                ),
                              )
                            }
                            aria-label={`Valor de ${p.paramName}`}
                          />
                        )}
                      </td>
                      <td>
                        <span className="exam-results-modal__param-ref">
                          {p.minReference != null && p.maxReference != null
                            ? `${p.minReference}–${p.maxReference}`
                            : p.minReference != null
                              ? `≥ ${p.minReference}`
                              : p.maxReference != null
                                ? `≤ ${p.maxReference}`
                                : '—'}
                        </span>
                      </td>
                      <td>
                        {preview && (
                          <span className={`exam-results-modal__indicator ${preview.className}`}>
                            {preview.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </form>
        </div>

        <footer className="exam-results-modal__footer">
          <button type="button" className="exam-results-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="exam-results-form"
            className="exam-results-modal__btn-save"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Registrar resultados'}
          </button>
        </footer>
      </div>
    </div>
  );
}
