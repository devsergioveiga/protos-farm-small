import { useState, useCallback, useEffect } from 'react';
import { Plus, Factory, Search, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useManufacturers } from '@/hooks/useManufacturers';
import type { ManufacturerItem } from '@/hooks/useManufacturers';
import ManufacturerModal from '@/components/manufacturers/ManufacturerModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './ManufacturersPage.css';

function formatCnpjDisplay(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function ManufacturersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<ManufacturerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManufacturerItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    manufacturers,
    isLoading,
    error,
    createManufacturer,
    updateManufacturer,
    deleteManufacturer,
  } = useManufacturers();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = search
    ? manufacturers.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          (m.cnpj && m.cnpj.includes(search.replace(/\D/g, ''))),
      )
    : manufacturers;

  const handleSave = useCallback(
    async (name: string, cnpj: string | null) => {
      if (selected) {
        await updateManufacturer(selected.id, name, cnpj || undefined);
      } else {
        await createManufacturer(name, cnpj || undefined);
      }
    },
    [selected, createManufacturer, updateManufacturer],
  );

  const handleEdit = useCallback((m: ManufacturerItem) => {
    setSelected(m);
    setShowModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteManufacturer(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Não foi possível excluir. Verifique se o fabricante possui produtos vinculados.',
      );
    }
  }, [deleteTarget, deleteManufacturer]);

  return (
    <div className="manufacturers-page">
      <header className="manufacturers-page__header">
        <div>
          <h1>Fabricantes</h1>
          <p>Gerencie fabricantes e fornecedores</p>
        </div>
        <button
          className="manufacturers-page__btn-primary"
          onClick={() => {
            setSelected(null);
            setShowModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Novo fabricante
        </button>
      </header>

      <div className="manufacturers-page__toolbar">
        <div className="manufacturers-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar fabricantes"
          />
        </div>
      </div>

      {(error || deleteError) && (
        <div className="manufacturers-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {isLoading && (
        <div className="manufacturers-page__skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="manufacturers-page__skeleton-row" />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="manufacturers-page__empty">
              <Factory size={48} aria-hidden="true" />
              <h3>Nenhum fabricante encontrado</h3>
              <p>{search ? 'Tente alterar a busca.' : 'Cadastre seu primeiro fabricante.'}</p>
            </div>
          ) : (
            <table className="manufacturers-page__table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">CNPJ</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => handleEdit(m)}>
                    <td data-label="Nome">
                      <strong>{m.name}</strong>
                    </td>
                    <td data-label="CNPJ">
                      {m.cnpj ? (
                        <span className="manufacturers-page__cnpj">
                          {formatCnpjDisplay(m.cnpj)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="manufacturers-page__actions">
                        <button
                          className="manufacturers-page__icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(m);
                          }}
                          aria-label={`Editar ${m.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="manufacturers-page__icon-btn manufacturers-page__icon-btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError(null);
                            setDeleteTarget(m);
                          }}
                          aria-label={`Excluir ${m.name}`}
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

      <ManufacturerModal
        isOpen={showModal}
        manufacturer={selected}
        onClose={() => {
          setShowModal(false);
          setSelected(null);
        }}
        onSave={handleSave}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir fabricante"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
