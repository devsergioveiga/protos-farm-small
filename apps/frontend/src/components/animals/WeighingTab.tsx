import { useState } from 'react';
import { Plus, Scale, AlertCircle } from 'lucide-react';
import { useAnimalWeighings } from '@/hooks/useAnimalWeighings';
import type { WeighingItem } from '@/types/animal';
import WeighingStatsCards from './WeighingStatsCards';
import WeighingChart from './WeighingChart';
import WeighingRecordsList from './WeighingRecordsList';
import CreateWeighingModal from './CreateWeighingModal';
import WeighingExport from './WeighingExport';
import './WeighingTab.css';

interface WeighingTabProps {
  farmId: string;
  animalId: string;
  animalEarTag: string;
}

function WeighingTab({ farmId, animalId, animalEarTag }: WeighingTabProps) {
  const {
    weighings,
    stats,
    isLoading,
    error,
    refetch,
    createWeighing,
    updateWeighing,
    deleteWeighing,
  } = useAnimalWeighings(farmId, animalId);

  const [showModal, setShowModal] = useState(false);
  const [editingWeighing, setEditingWeighing] = useState<WeighingItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  function handleEdit(weighing: WeighingItem) {
    setEditingWeighing(weighing);
    setShowModal(true);
  }

  async function handleDelete(weighingId: string) {
    if (!confirm('Deseja realmente excluir esta pesagem?')) return;
    try {
      await deleteWeighing(weighingId);
      showToast('success', 'Pesagem excluída com sucesso');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir pesagem');
    }
  }

  async function handleSubmit(data: {
    weightKg: number;
    measuredAt: string;
    bodyConditionScore?: number | null;
    notes?: string | null;
  }) {
    if (editingWeighing) {
      await updateWeighing(editingWeighing.id, data);
      showToast('success', 'Pesagem atualizada com sucesso');
    } else {
      await createWeighing(data);
      showToast('success', 'Pesagem registrada com sucesso');
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingWeighing(null);
  }

  if (isLoading) {
    return (
      <div className="weighing-tab" aria-live="polite">
        <div className="weighing-tab__skeleton-stats">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="weighing-tab__skeleton-card" />
          ))}
        </div>
        <div className="weighing-tab__skeleton-chart" />
        <div className="weighing-tab__skeleton-list" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="weighing-tab">
        <div className="weighing-tab__error" role="alert" aria-live="polite">
          <div className="weighing-tab__error-message">
            <AlertCircle aria-hidden="true" size={20} />
            {error}
          </div>
          <button type="button" className="weighing-tab__retry-btn" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const hasWeighings = weighings.length > 0;

  return (
    <div className="weighing-tab">
      {toast && (
        <div
          className={`weighing-tab__toast weighing-tab__toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <div className="weighing-tab__header">
        <h2 className="weighing-tab__title">Pesagens</h2>
        <div className="weighing-tab__actions">
          {hasWeighings && (
            <WeighingExport farmId={farmId} animalId={animalId} animalEarTag={animalEarTag} />
          )}
          <button
            type="button"
            className="weighing-tab__add-btn"
            onClick={() => {
              setEditingWeighing(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Registrar pesagem
          </button>
        </div>
      </div>

      {hasWeighings && stats ? (
        <>
          <WeighingStatsCards stats={stats} />
          <WeighingChart weighings={weighings} entryWeightKg={stats.entryWeightKg} />
          <WeighingRecordsList
            weighings={weighings}
            onEdit={handleEdit}
            onDelete={(id) => void handleDelete(id)}
          />
        </>
      ) : (
        <div className="weighing-tab__empty">
          <Scale size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h3 className="weighing-tab__empty-title">Nenhuma pesagem registrada</h3>
          <p className="weighing-tab__empty-desc">
            Registre a primeira pesagem para acompanhar a evolução de peso do animal.
          </p>
        </div>
      )}

      <CreateWeighingModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editingWeighing={editingWeighing}
      />
    </div>
  );
}

export default WeighingTab;
