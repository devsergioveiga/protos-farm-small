import { useState, useCallback, useEffect } from 'react';
import { Plus, FlaskConical, Search, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useActiveIngredients } from '@/hooks/useActiveIngredients';
import type { ActiveIngredientItem } from '@/hooks/useActiveIngredients';
import ActiveIngredientModal from '@/components/active-ingredients/ActiveIngredientModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { api } from '@/services/api';
import './ActiveIngredientsPage.css';

const TYPE_LABELS: Record<string, string> = {
  AGROCHEMICAL: 'Agroquímico',
  VETERINARY: 'Veterinário',
  FERTILIZER: 'Fertilizante',
  OTHER: 'Outro',
};

export default function ActiveIngredientsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<ActiveIngredientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActiveIngredientItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { ingredients, isLoading, error, refetch, createIngredient } = useActiveIngredients();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = ingredients.filter((ing) => {
    if (typeFilter && ing.type !== typeFilter) return false;
    if (search && !ing.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = useCallback(
    async (name: string, type: string) => {
      if (selected) {
        await api.put(`/org/active-ingredients/${selected.id}`, { name, type });
        void refetch();
      } else {
        await createIngredient(name, type);
      }
    },
    [selected, createIngredient, refetch],
  );

  const handleEdit = useCallback((ing: ActiveIngredientItem) => {
    setSelected(ing);
    setShowModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await api.delete(`/org/active-ingredients/${deleteTarget.id}`);
      void refetch();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Não foi possível excluir. Verifique se o princípio ativo está vinculado a produtos.',
      );
    }
  }, [deleteTarget, refetch]);

  return (
    <div className="active-ingredients-page">
      <header className="active-ingredients-page__header">
        <div>
          <h1>Princípios Ativos</h1>
          <p>Gerencie os princípios ativos utilizados em produtos</p>
        </div>
        <button
          className="active-ingredients-page__btn-primary"
          onClick={() => {
            setSelected(null);
            setShowModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Novo princípio ativo
        </button>
      </header>

      <div className="active-ingredients-page__toolbar">
        <div className="active-ingredients-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar princípios ativos"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {(error || deleteError) && (
        <div className="active-ingredients-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {isLoading && (
        <div className="active-ingredients-page__skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="active-ingredients-page__skeleton-row" />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="active-ingredients-page__empty">
              <FlaskConical size={48} aria-hidden="true" />
              <h3>Nenhum princípio ativo encontrado</h3>
              <p>
                {search || typeFilter
                  ? 'Tente alterar os filtros de busca.'
                  : 'Cadastre seu primeiro princípio ativo.'}
              </p>
            </div>
          ) : (
            <table className="active-ingredients-page__table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">N° CAS</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ing) => (
                  <tr key={ing.id} onClick={() => handleEdit(ing)}>
                    <td data-label="Nome">
                      <strong>{ing.name}</strong>
                    </td>
                    <td data-label="Tipo">
                      <span
                        className={`active-ingredients-page__badge active-ingredients-page__badge--${ing.type.toLowerCase()}`}
                      >
                        {TYPE_LABELS[ing.type] ?? ing.type}
                      </span>
                    </td>
                    <td data-label="N° CAS">
                      {ing.casNumber ? (
                        <span className="active-ingredients-page__cas">{ing.casNumber}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="active-ingredients-page__actions">
                        <button
                          className="active-ingredients-page__icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(ing);
                          }}
                          aria-label={`Editar ${ing.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="active-ingredients-page__icon-btn active-ingredients-page__icon-btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError(null);
                            setDeleteTarget(ing);
                          }}
                          aria-label={`Excluir ${ing.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <ActiveIngredientModal
        isOpen={showModal}
        ingredient={selected}
        onClose={() => {
          setShowModal(false);
          setSelected(null);
        }}
        onSave={handleSave}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir princípio ativo"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
