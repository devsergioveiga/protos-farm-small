import { useState, useRef, useCallback } from 'react';
import {
  UsersRound,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  UserCheck,
  Clock,
  Wallet,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useFieldTeams } from '@/hooks/useFieldTeams';
import PermissionGate from '@/components/auth/PermissionGate';
import FieldTeamModal from '@/components/field-teams/FieldTeamModal';
import { FIELD_TEAM_TYPES } from '@/types/field-team';
import type { FieldTeamItem } from '@/types/field-team';
import './FieldTeamsPage.css';

function FieldTeamsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<FieldTeamItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { teams, meta, isLoading, error, refetch } = useFieldTeams({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    teamType: typeFilter || undefined,
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedTeam(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((team: FieldTeamItem) => {
    setSelectedTeam(team);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, team: FieldTeamItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(team);
      }
    },
    [handleCardClick],
  );

  const handleNewTeam = useCallback(() => {
    setSelectedTeam(null);
    setShowModal(true);
  }, []);

  if (!selectedFarmId) {
    return (
      <section className="field-teams">
        <div className="field-teams__empty">
          <UsersRound size={64} aria-hidden="true" />
          <h2 className="field-teams__empty-title">Selecione uma fazenda</h2>
          <p className="field-teams__empty-desc">
            Escolha uma fazenda no seletor acima para ver as equipes de campo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="field-teams">
      <div className="field-teams__header">
        <div className="field-teams__header-text">
          <h1 className="field-teams__title">Equipes de campo</h1>
          <p className="field-teams__subtitle">
            Equipes de trabalho em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="field-teams__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="field-teams__btn field-teams__btn--primary"
              onClick={handleNewTeam}
            >
              <Plus size={20} aria-hidden="true" />
              Nova equipe
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="field-teams__toolbar">
        <div className="field-teams__search-wrapper">
          <Search size={16} aria-hidden="true" className="field-teams__search-icon" />
          <input
            type="search"
            className="field-teams__search"
            placeholder="Buscar por nome ou observações..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar equipes"
          />
        </div>
        <select
          className="field-teams__filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de equipe"
        >
          <option value="">Todos os tipos</option>
          {FIELD_TEAM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="field-teams__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="field-teams__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="field-teams__skeleton field-teams__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {teams.length === 0 && !isLoading && !error ? (
        <div className="field-teams__empty">
          <UsersRound size={64} aria-hidden="true" />
          <h2 className="field-teams__empty-title">Nenhuma equipe cadastrada</h2>
          <p className="field-teams__empty-desc">
            Crie equipes de campo para organizar os trabalhadores por atividade como colheita,
            aplicação de defensivos, capina e mais.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {teams.length > 0 && !isLoading && (
        <div className="field-teams__grid">
          {teams.map((team) => (
            <div
              key={team.id}
              className="field-teams__card"
              onClick={() => handleCardClick(team)}
              onKeyDown={(e) => handleCardKeyDown(e, team)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da equipe ${team.name}`}
            >
              <div className="field-teams__card-header">
                <h3 className="field-teams__card-name">{team.name}</h3>
                <span className="field-teams__badge field-teams__badge--type">
                  {team.teamTypeLabel}
                </span>
              </div>

              <div className="field-teams__card-details">
                <span className="field-teams__card-detail">
                  <UserCheck size={14} aria-hidden="true" />
                  <span className="field-teams__card-detail-label">Responsável:</span>
                  {team.leaderName}
                </span>
                <span className="field-teams__card-detail">
                  <UsersRound size={14} aria-hidden="true" />
                  {team.memberCount} {team.memberCount === 1 ? 'membro' : 'membros'}
                </span>
              </div>

              {team.costCenterName && (
                <div className="field-teams__card-extra">
                  <Wallet size={14} aria-hidden="true" />
                  <span>
                    {team.costCenterCode} — {team.costCenterName}
                  </span>
                </div>
              )}

              {team.isTemporary && (
                <div className="field-teams__card-extra">
                  <Clock size={14} aria-hidden="true" />
                  <span>Equipe temporária</span>
                </div>
              )}

              {team.notes && <p className="field-teams__card-notes">{team.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="field-teams__pagination" aria-label="Paginação de equipes">
          <button
            type="button"
            className="field-teams__btn field-teams__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="field-teams__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="field-teams__btn field-teams__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <FieldTeamModal
        isOpen={showModal}
        team={selectedTeam}
        onClose={() => {
          setShowModal(false);
          setSelectedTeam(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default FieldTeamsPage;
