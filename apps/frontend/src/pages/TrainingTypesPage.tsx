import { useEffect, useState } from 'react';
import { GraduationCap, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useTrainingTypes } from '@/hooks/useTrainingTypes';
import TrainingTypeModal from '@/components/training-types/TrainingTypeModal';
import PositionTrainingRequirementsModal from '@/components/training-types/PositionTrainingRequirementsModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { TrainingType, CreateTrainingTypeInput } from '@/types/training';
import './TrainingTypesPage.css';

type TabKey = 'tipos' | 'requisitos';

interface Position {
  id: string;
  name: string;
}

export default function TrainingTypesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('tipos');
  const [showModal, setShowModal] = useState(false);
  const [editType, setEditType] = useState<TrainingType | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [configPosition, setConfigPosition] = useState<Position | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const {
    trainingTypes,
    positionRequirements,
    loading,
    error,
    successMessage,
    fetchTrainingTypes,
    fetchPositionRequirements,
    createTrainingType,
    updateTrainingType,
    deleteTrainingType,
    createPositionRequirement,
    deletePositionRequirement,
  } = useTrainingTypes();

  useEffect(() => {
    void fetchTrainingTypes();
  }, [fetchTrainingTypes]);

  useEffect(() => {
    if (activeTab === 'requisitos') {
      void fetchPositionRequirements();
    }
  }, [activeTab, fetchPositionRequirements]);

  useEffect(() => {
    if (successMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast(successMessage);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const handleSave = async (input: CreateTrainingTypeInput): Promise<boolean> => {
    let ok: boolean;
    if (editType) {
      ok = await updateTrainingType(editType.id, input);
    } else {
      ok = await createTrainingType(input);
    }
    if (ok) {
      setShowModal(false);
      setEditType(null);
      void fetchTrainingTypes();
    }
    return ok;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const ok = await deleteTrainingType(deleteId);
    setDeleting(false);
    if (ok) {
      setDeleteId(null);
      void fetchTrainingTypes();
    }
  };

  const handleAddRequirement = async (positionId: string, trainingTypeId: string) => {
    const ok = await createPositionRequirement({ positionId, trainingTypeId });
    if (ok) void fetchPositionRequirements();
    return ok;
  };

  const handleRemoveRequirement = async (requirementId: string) => {
    const ok = await deletePositionRequirement(requirementId);
    if (ok) void fetchPositionRequirements();
    return ok;
  };

  // Group by position for tab 2
  const positionMap = new Map<string, Position>();
  positionRequirements.forEach((r) => {
    if (!positionMap.has(r.positionId)) {
      positionMap.set(r.positionId, { id: r.positionId, name: r.positionName });
    }
  });
  const positions = Array.from(positionMap.values());

  const isEmpty = !loading && trainingTypes.length === 0;
  const systemTypes = trainingTypes.filter((t) => t.isSystem);
  const customTypes = trainingTypes.filter((t) => !t.isSystem);

  return (
    <main className="training-types-page">
      {/* Toast */}
      {toast && (
        <div className="training-types-page__toast" role="status">
          {toast}
        </div>
      )}

      <header className="training-types-page__header">
        <h1 className="training-types-page__title">
          <GraduationCap size={24} aria-hidden="true" />
          Tipos de Treinamento
        </h1>
        <button
          type="button"
          className="training-types-page__cta"
          onClick={() => {
            setEditType(null);
            setShowModal(true);
          }}
        >
          Novo Tipo de Treinamento
        </button>
      </header>

      <div className="training-types-page__tabs" role="tablist" aria-label="Seções de treinamentos">
        <button
          role="tab"
          aria-selected={activeTab === 'tipos'}
          className={`training-types-page__tab ${activeTab === 'tipos' ? 'training-types-page__tab--active' : ''}`}
          onClick={() => setActiveTab('tipos')}
          type="button"
        >
          Tipos de Treinamento
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'requisitos'}
          className={`training-types-page__tab ${activeTab === 'requisitos' ? 'training-types-page__tab--active' : ''}`}
          onClick={() => setActiveTab('requisitos')}
          type="button"
        >
          Requisitos por Cargo
        </button>
      </div>

      {activeTab === 'tipos' && (
        <section aria-label="Lista de tipos de treinamento">
          {error && (
            <div className="training-types-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              Não foi possível carregar os dados. Verifique sua conexão e tente novamente.
            </div>
          )}

          {loading && (
            <div className="training-types-page__skeleton" aria-busy="true" aria-label="Carregando">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="training-types-page__skeleton-row" />
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="training-types-page__empty">
              <GraduationCap
                size={48}
                aria-hidden="true"
                className="training-types-page__empty-icon"
              />
              <p className="training-types-page__empty-title">
                Nenhum tipo de treinamento cadastrado
              </p>
              <p className="training-types-page__empty-body">
                Cadastre tipos de treinamento para acompanhar a conformidade NR-31.
              </p>
              <button
                type="button"
                className="training-types-page__cta"
                onClick={() => {
                  setEditType(null);
                  setShowModal(true);
                }}
              >
                Novo Tipo de Treinamento
              </button>
            </div>
          )}

          {!loading && !isEmpty && (
            <div className="training-types-page__table-wrap">
              <table className="training-types-page__table">
                <thead>
                  <tr>
                    <th scope="col">NOME</th>
                    <th scope="col">REFERÊNCIA NR</th>
                    <th scope="col">CARGA HORÁRIA MÍN.</th>
                    <th scope="col">VALIDADE PADRÃO</th>
                    <th scope="col">TIPO</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {[...systemTypes, ...customTypes].map((tt) => (
                    <tr
                      key={tt.id}
                      className={tt.isSystem ? 'training-types-page__row--system' : ''}
                    >
                      <td>{tt.name}</td>
                      <td>{tt.nrReference ?? '—'}</td>
                      <td>{tt.minHours}h</td>
                      <td>{tt.defaultValidityMonths} meses</td>
                      <td>
                        {tt.isSystem ? (
                          <span
                            className="training-types-page__badge--system"
                            title="Treinamento obrigatório NR-31 — não editável"
                            aria-label="Treinamento do sistema — nao editavel"
                          >
                            Sistema
                          </span>
                        ) : (
                          <span className="training-types-page__badge--custom">Personalizado</span>
                        )}
                      </td>
                      <td className="training-types-page__actions">
                        {!tt.isSystem && (
                          <>
                            <button
                              type="button"
                              aria-label={`Editar ${tt.name}`}
                              className="training-types-page__action-btn"
                              onClick={() => {
                                setEditType(tt);
                                setShowModal(true);
                              }}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir ${tt.name}`}
                              className="training-types-page__action-btn training-types-page__action-btn--danger"
                              onClick={() => setDeleteId(tt.id)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'requisitos' && (
        <section aria-label="Requisitos por cargo">
          {positions.length === 0 ? (
            <div className="training-types-page__empty">
              <GraduationCap
                size={48}
                aria-hidden="true"
                className="training-types-page__empty-icon"
              />
              <p className="training-types-page__empty-title">
                Nenhum cargo com requisitos configurados
              </p>
            </div>
          ) : (
            <div className="training-types-page__table-wrap">
              <table className="training-types-page__table">
                <thead>
                  <tr>
                    <th scope="col">CARGO</th>
                    <th scope="col">TREINAMENTOS OBRIGATÓRIOS</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const count = positionRequirements.filter(
                      (r) => r.positionId === pos.id,
                    ).length;
                    return (
                      <tr key={pos.id}>
                        <td>{pos.name}</td>
                        <td>
                          {count === 0 ? (
                            <span className="training-types-page__none">
                              Nenhum treinamento definido
                            </span>
                          ) : (
                            <span className="training-types-page__count-chip">{count}</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="training-types-page__config-btn"
                            onClick={() => setConfigPosition(pos)}
                          >
                            Configurar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <TrainingTypeModal
        isOpen={showModal}
        trainingType={editType}
        onClose={() => {
          setShowModal(false);
          setEditType(null);
        }}
        onSave={handleSave}
      />

      <PositionTrainingRequirementsModal
        isOpen={!!configPosition}
        position={configPosition}
        requirements={positionRequirements}
        trainingTypes={trainingTypes}
        onClose={() => setConfigPosition(null)}
        onAdd={handleAddRequirement}
        onRemove={handleRemoveRequirement}
      />

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir tipo de treinamento"
        message="Excluir registro: Os certificados dos participantes serão removidos. Confirmar exclusão?"
        variant="danger"
        confirmLabel="Excluir"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}
