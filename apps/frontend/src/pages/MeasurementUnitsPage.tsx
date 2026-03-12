import { useState, useCallback, useEffect } from 'react';
import { Plus, Ruler, ArrowRightLeft, Search, AlertCircle, Trash2 } from 'lucide-react';
import { useMeasurementUnits, useConversions } from '@/hooks/useMeasurementUnits';
import type { UnitItem, ConversionItem } from '@/hooks/useMeasurementUnits';
import MeasurementUnitModal from '@/components/measurement-units/MeasurementUnitModal';
import ConversionModal from '@/components/measurement-units/ConversionModal';
import { api } from '@/services/api';
import './MeasurementUnitsPage.css';

const CATEGORY_LABELS: Record<string, string> = {
  WEIGHT: 'Peso',
  VOLUME: 'Volume',
  COUNT: 'Contagem',
  AREA: 'Área',
};

export default function MeasurementUnitsPage() {
  const [activeTab, setActiveTab] = useState<'units' | 'conversions'>('units');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    units,
    meta: unitsMeta,
    isLoading: unitsLoading,
    error: unitsError,
    refetch: refetchUnits,
  } = useMeasurementUnits({
    page,
    category: categoryFilter || undefined,
    search: search || undefined,
    includeInactive: true,
  });

  const {
    conversions,
    meta: convMeta,
    isLoading: convLoading,
    error: convError,
    refetch: refetchConversions,
  } = useConversions({ page });

  const handleUnitSuccess = useCallback(() => {
    setShowUnitModal(false);
    setSelectedUnit(null);
    void refetchUnits();
  }, [refetchUnits]);

  const handleConversionSuccess = useCallback(() => {
    setShowConversionModal(false);
    void refetchConversions();
  }, [refetchConversions]);

  const handleEditUnit = useCallback((unit: UnitItem) => {
    setSelectedUnit(unit);
    setShowUnitModal(true);
  }, []);

  const handleDeleteConversion = useCallback(
    async (conv: ConversionItem) => {
      if (conv.isSystem) return;
      try {
        await api.delete(`/org/unit-conversions/${conv.id}`);
        void refetchConversions();
      } catch {
        // silently fail, user can retry
      }
    },
    [refetchConversions],
  );

  const meta = activeTab === 'units' ? unitsMeta : convMeta;
  const isLoading = activeTab === 'units' ? unitsLoading : convLoading;
  const error = activeTab === 'units' ? unitsError : convError;

  return (
    <div className="mu-page">
      <header className="mu-page__header">
        <div>
          <h1>Unidades de Medida</h1>
          <p>Gerencie unidades e fatores de conversão</p>
        </div>
        <button
          className="mu-page__btn-primary"
          onClick={() => {
            if (activeTab === 'units') {
              setSelectedUnit(null);
              setShowUnitModal(true);
            } else {
              setShowConversionModal(true);
            }
          }}
        >
          <Plus size={20} aria-hidden="true" />
          {activeTab === 'units' ? 'Nova unidade' : 'Nova conversão'}
        </button>
      </header>

      <nav className="mu-page__tabs" aria-label="Seções">
        <button
          className={activeTab === 'units' ? 'mu-page__tab--active' : 'mu-page__tab'}
          onClick={() => {
            setActiveTab('units');
            setPage(1);
          }}
          aria-current={activeTab === 'units' ? 'page' : undefined}
        >
          <Ruler size={16} aria-hidden="true" />
          Unidades
        </button>
        <button
          className={activeTab === 'conversions' ? 'mu-page__tab--active' : 'mu-page__tab'}
          onClick={() => {
            setActiveTab('conversions');
            setPage(1);
          }}
          aria-current={activeTab === 'conversions' ? 'page' : undefined}
        >
          <ArrowRightLeft size={16} aria-hidden="true" />
          Conversões
        </button>
      </nav>

      {activeTab === 'units' && (
        <div className="mu-page__toolbar">
          <div className="mu-page__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por nome ou abreviação..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar unidades"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mu-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mu-page__skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mu-page__skeleton-card" />
          ))}
        </div>
      )}

      {!isLoading && !error && activeTab === 'units' && (
        <>
          {units.length === 0 ? (
            <div className="mu-page__empty">
              <Ruler size={48} aria-hidden="true" />
              <h3>Nenhuma unidade encontrada</h3>
              <p>Cadastre sua primeira unidade de medida personalizada.</p>
            </div>
          ) : (
            <div className="mu-page__grid">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  className="mu-page__card"
                  onClick={() => handleEditUnit(unit)}
                  type="button"
                >
                  <div className="mu-page__card-top">
                    <span className="mu-page__card-abbr">{unit.abbreviation}</span>
                    <span
                      className={`mu-page__badge mu-page__badge--${unit.category.toLowerCase()}`}
                    >
                      {CATEGORY_LABELS[unit.category] ?? unit.category}
                    </span>
                  </div>
                  <span className="mu-page__card-name">{unit.name}</span>
                  <div className="mu-page__card-meta">
                    {unit.isSystem && <span className="mu-page__tag">Sistema</span>}
                    {!unit.isActive && (
                      <span className="mu-page__tag mu-page__tag--inactive">Inativa</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!isLoading && !error && activeTab === 'conversions' && (
        <>
          {conversions.length === 0 ? (
            <div className="mu-page__empty">
              <ArrowRightLeft size={48} aria-hidden="true" />
              <h3>Nenhuma conversão encontrada</h3>
              <p>As conversões globais serão criadas automaticamente.</p>
            </div>
          ) : (
            <table className="mu-page__table">
              <thead>
                <tr>
                  <th scope="col">De</th>
                  <th scope="col">Para</th>
                  <th scope="col">Fator</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((conv) => (
                  <tr key={conv.id}>
                    <td>{conv.fromUnitAbbreviation}</td>
                    <td>{conv.toUnitAbbreviation}</td>
                    <td className="mu-page__mono">{conv.factor}</td>
                    <td>
                      {conv.isSystem ? (
                        <span className="mu-page__tag">Sistema</span>
                      ) : (
                        <span className="mu-page__tag mu-page__tag--custom">Personalizada</span>
                      )}
                    </td>
                    <td>
                      {!conv.isSystem && (
                        <button
                          className="mu-page__icon-btn"
                          onClick={() => handleDeleteConversion(conv)}
                          aria-label={`Excluir conversão de ${conv.fromUnitAbbreviation} para ${conv.toUnitAbbreviation}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mu-page__pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      )}

      <MeasurementUnitModal
        isOpen={showUnitModal}
        unit={selectedUnit}
        onClose={() => {
          setShowUnitModal(false);
          setSelectedUnit(null);
        }}
        onSuccess={handleUnitSuccess}
      />

      <ConversionModal
        isOpen={showConversionModal}
        units={units}
        onClose={() => setShowConversionModal(false)}
        onSuccess={handleConversionSuccess}
      />
    </div>
  );
}
