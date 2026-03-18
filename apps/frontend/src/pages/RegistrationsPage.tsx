import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, MapPin, Search, Landmark, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import RegistrationFormModal from '@/components/registrations/RegistrationFormModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { FarmRegistration, CreateRegistrationPayload } from '@/types/farm';
import './RegistrationsPage.css';

interface Registration {
  id: string;
  farmId: string;
  farmName: string;
  ruralPropertyId: string | null;
  ruralPropertyName: string | null;
  number: string;
  cnsCode: string | null;
  cartorioName: string | null;
  comarca: string | null;
  state: string | null;
  livro: string | null;
  registrationDate: string | null;
  areaHa: number | null;
  boundaryAreaHa: number | null;
  createdAt: string;
}

function useAllRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Registration[]>('/org/registrations');
      setRegistrations(data);
    } catch {
      setError('Não foi possível carregar as matrículas. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { registrations, isLoading, error, refetch: fetch };
}

export default function RegistrationsPage() {
  const { registrations, isLoading, error, refetch } = useAllRegistrations();
  const [search, setSearch] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterProperty, setFilterProperty] = useState('');

  // Edit state
  const [editReg, setEditReg] = useState<Registration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Delete state
  const [deleteReg, setDeleteReg] = useState<Registration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const farmNames = [...new Set(registrations.map((r) => r.farmName))].sort();
  const propertyNames = [
    ...new Set(registrations.map((r) => r.ruralPropertyName).filter(Boolean)),
  ].sort() as string[];

  const filtered = registrations.filter((r) => {
    const term = search.toLowerCase();
    const matchSearch =
      !search ||
      r.number.toLowerCase().includes(term) ||
      r.cartorioName?.toLowerCase().includes(term) ||
      r.comarca?.toLowerCase().includes(term);
    const matchFarm = !filterFarm || r.farmName === filterFarm;
    const matchProperty = !filterProperty || r.ruralPropertyName === filterProperty;
    return matchSearch && matchFarm && matchProperty;
  });

  const handleEdit = async (payload: CreateRegistrationPayload) => {
    if (!editReg) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.patch(`/org/farms/${editReg.farmId}/registrations/${editReg.id}`, payload);
      showToast('Matrícula atualizada com sucesso');
      setEditReg(null);
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar matrícula';
      setSubmitError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteReg) return;
    setIsDeleting(true);
    try {
      await api.delete(`/org/farms/${deleteReg.farmId}/registrations/${deleteReg.id}`);
      showToast('Matrícula excluída com sucesso');
      setDeleteReg(null);
      await refetch();
    } catch {
      showToast('Erro ao excluir matrícula. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toFarmRegistration = (r: Registration): FarmRegistration => ({
    id: r.id,
    farmId: r.farmId,
    number: r.number,
    cnsCode: r.cnsCode,
    cartorioName: r.cartorioName ?? '',
    comarca: r.comarca ?? '',
    state: r.state ?? '',
    livro: r.livro,
    registrationDate: r.registrationDate,
    areaHa: r.areaHa ?? 0,
    boundaryAreaHa: r.boundaryAreaHa,
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
  });

  return (
    <main className="reg-page">
      <nav className="reg-page__breadcrumb" aria-label="Navegação">
        <Link to="/dashboard">Início</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Matrículas</span>
      </nav>

      <header className="reg-page__header">
        <h1 className="reg-page__title">Matrículas</h1>
      </header>

      {toast && (
        <div className="reg-page__toast" role="status">
          {toast}
        </div>
      )}

      <div className="reg-page__filters">
        <div className="reg-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por número, cartório ou comarca"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="reg-page__search-input"
          />
        </div>
        <div className="reg-page__filter-group">
          <label htmlFor="filter-farm" className="reg-page__filter-label">
            FAZENDA
          </label>
          <select
            id="filter-farm"
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="reg-page__select"
          >
            <option value="">Todas</option>
            {farmNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="reg-page__filter-group">
          <label htmlFor="filter-property" className="reg-page__filter-label">
            IMÓVEL RURAL
          </label>
          <select
            id="filter-property"
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="reg-page__select"
          >
            <option value="">Todos</option>
            {propertyNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="reg-page__error" role="alert">
          <Landmark size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="reg-page__grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="reg-card reg-card--skeleton">
              <div className="reg-card__skeleton-line reg-card__skeleton-line--title" />
              <div className="reg-card__skeleton-line" />
              <div className="reg-card__skeleton-line reg-card__skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="reg-page__empty">
          <Landmark size={48} aria-hidden="true" />
          <h3>
            {search || filterFarm || filterProperty
              ? 'Nenhuma matrícula encontrada'
              : 'Nenhuma matrícula cadastrada'}
          </h3>
          <p>
            {search || filterFarm || filterProperty
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre matrículas a partir da página de detalhe de cada fazenda.'}
          </p>
        </div>
      ) : (
        <div className="reg-page__grid">
          {filtered.map((r) => (
            <article key={r.id} className="reg-card">
              <div className="reg-card__header">
                <div>
                  <h3 className="reg-card__number">
                    <FileText size={16} aria-hidden="true" />
                    Matrícula {r.number}
                  </h3>
                  <Link to={`/farms/${r.farmId}`} className="reg-card__farm-link">
                    <MapPin size={12} aria-hidden="true" /> {r.farmName}
                  </Link>
                </div>
                <div className="reg-card__actions">
                  <button
                    type="button"
                    className="reg-card__action-btn"
                    aria-label={`Editar matrícula ${r.number}`}
                    onClick={() => {
                      setSubmitError(null);
                      setEditReg(r);
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="reg-card__action-btn reg-card__action-btn--danger"
                    aria-label={`Excluir matrícula ${r.number}`}
                    onClick={() => setDeleteReg(r)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="reg-card__body">
                {r.cartorioName && (
                  <div className="reg-card__info">
                    <span className="reg-card__label">Cartório:</span>
                    <span>{r.cartorioName}</span>
                  </div>
                )}
                {(r.comarca || r.state) && (
                  <div className="reg-card__info">
                    <span className="reg-card__label">Comarca:</span>
                    <span>{[r.comarca, r.state].filter(Boolean).join(' — ')}</span>
                  </div>
                )}
                {r.areaHa != null && (
                  <div className="reg-card__info">
                    <span className="reg-card__label">Área:</span>
                    <span className="reg-card__mono">{r.areaHa.toLocaleString('pt-BR')} ha</span>
                  </div>
                )}
                {r.cnsCode && (
                  <div className="reg-card__info">
                    <span className="reg-card__label">CNS:</span>
                    <span className="reg-card__mono">{r.cnsCode}</span>
                  </div>
                )}
                {r.livro && (
                  <div className="reg-card__info">
                    <span className="reg-card__label">Livro:</span>
                    <span>{r.livro}</span>
                  </div>
                )}
                {r.ruralPropertyName && (
                  <div className="reg-card__info">
                    <span className="reg-card__label">Imóvel rural:</span>
                    <span>{r.ruralPropertyName}</span>
                  </div>
                )}
              </div>

              <div className="reg-card__footer">
                <Link
                  to={`/farms/${r.farmId}`}
                  className="reg-card__detail-link"
                  aria-label={`Ver fazenda da matrícula ${r.number}`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Ver na fazenda
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <RegistrationFormModal
        isOpen={!!editReg}
        onClose={() => setEditReg(null)}
        onSubmit={handleEdit}
        registration={editReg ? toFarmRegistration(editReg) : undefined}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />

      <ConfirmModal
        isOpen={!!deleteReg}
        title="Excluir matrícula"
        message={`Tem certeza que deseja excluir a matrícula ${deleteReg?.number ?? ''}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteReg(null)}
      />
    </main>
  );
}
