import { useState, useEffect, useCallback } from 'react';
import {
  Wheat,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  Calculator,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { useGrainDiscounts } from '@/hooks/useGrainDiscounts';
import DiscountTableModal from '@/components/grain-discounts/DiscountTableModal';
import ClassificationModal from '@/components/grain-discounts/ClassificationModal';
import {
  CROP_LABELS,
  CROPS,
  type DiscountTableItem,
  type ClassificationItem,
} from '@/types/grain-discounts';
import './GrainDiscountsPage.css';

// ─── Helpers ────────────────────────────────────────────────────────

function formatPct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

function formatKg(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' kg';
}

// ─── Component ──────────────────────────────────────────────────────

type TabKey = 'discounts' | 'classifications' | 'calculator';

export default function GrainDiscountsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('discounts');
  const [cropFilter, setCropFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountTableItem | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassificationItem | null>(null);

  // Calculator state
  const [calcCrop, setCalcCrop] = useState('SOJA');
  const [calcGrossKg, setCalcGrossKg] = useState('');
  const [calcMoisture, setCalcMoisture] = useState('');
  const [calcImpurity, setCalcImpurity] = useState('');
  const [calcDamaged, setCalcDamaged] = useState('');
  const [calcBroken, setCalcBroken] = useState('');

  const {
    discountTables,
    discountDefaults,
    classifications,
    classificationDefaults,
    breakdown,
    loading,
    error,
    fetchDiscountTables,
    upsertDiscountTable,
    deleteDiscountTable,
    fetchClassifications,
    upsertClassification,
    deleteClassification,
    calculateDiscount,
  } = useGrainDiscounts();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch data on tab/filter change
  useEffect(() => {
    if (activeTab === 'discounts') {
      fetchDiscountTables(cropFilter || undefined);
    } else if (activeTab === 'classifications') {
      fetchClassifications(cropFilter || undefined);
    }
  }, [activeTab, cropFilter, fetchDiscountTables, fetchClassifications]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ─── Discount table handlers ─────────────────────────────────────

  const handleDiscountSave = async (input: Parameters<typeof upsertDiscountTable>[0]) => {
    await upsertDiscountTable(input);
  };

  const handleDiscountSuccess = () => {
    setShowDiscountModal(false);
    setSelectedDiscount(null);
    fetchDiscountTables(cropFilter || undefined);
    showToast('Tabela de desconto salva com sucesso');
  };

  const handleDiscountDelete = async (item: DiscountTableItem) => {
    try {
      await deleteDiscountTable(item.id);
      fetchDiscountTables(cropFilter || undefined);
      showToast('Tabela de desconto removida (voltou ao padrão ANEC)');
    } catch {
      showToast('Erro ao remover tabela de desconto');
    }
  };

  // ─── Classification handlers ──────────────────────────────────────

  const handleClassSave = async (input: Parameters<typeof upsertClassification>[0]) => {
    await upsertClassification(input);
  };

  const handleClassSuccess = () => {
    setShowClassModal(false);
    setSelectedClass(null);
    fetchClassifications(cropFilter || undefined);
    showToast('Classificação salva com sucesso');
  };

  const handleClassDelete = async (item: ClassificationItem) => {
    try {
      await deleteClassification(item.id);
      fetchClassifications(cropFilter || undefined);
      showToast('Classificação removida (voltou ao padrão MAPA)');
    } catch {
      showToast('Erro ao remover classificação');
    }
  };

  // ─── Calculator handler ───────────────────────────────────────────

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    await calculateDiscount({
      crop: calcCrop,
      grossProductionKg: Number(calcGrossKg),
      moisturePct: Number(calcMoisture),
      impurityPct: Number(calcImpurity),
      damagedPct: calcDamaged ? Number(calcDamaged) : undefined,
      brokenPct: calcBroken ? Number(calcBroken) : undefined,
    });
  };

  // ─── Filter data by search ────────────────────────────────────────

  const filteredDiscounts = search
    ? discountTables.filter(
        (d) =>
          (CROP_LABELS[d.crop] || d.crop).toLowerCase().includes(search.toLowerCase()) ||
          d.discountTypeLabel.toLowerCase().includes(search.toLowerCase()),
      )
    : discountTables;

  const filteredClassifications = search
    ? classifications.filter(
        (c) =>
          (CROP_LABELS[c.crop] || c.crop).toLowerCase().includes(search.toLowerCase()) ||
          c.gradeTypeLabel.toLowerCase().includes(search.toLowerCase()),
      )
    : classifications;

  // ─── Render: Discount Tables Tab ──────────────────────────────────

  function renderDiscountsTab() {
    return (
      <>
        <div className="grain-discounts__toolbar">
          <div className="grain-discounts__search-wrapper">
            <Search size={16} className="grain-discounts__search-icon" aria-hidden="true" />
            <input
              type="search"
              className="grain-discounts__search"
              placeholder="Buscar cultura ou tipo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar tabela de desconto"
            />
          </div>
          <select
            className="grain-discounts__select"
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            aria-label="Filtrar por cultura"
          >
            <option value="">Todas as culturas</option>
            {CROPS.map((c) => (
              <option key={c} value={c}>
                {CROP_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="grain-discounts__btn-primary"
            onClick={() => {
              setSelectedDiscount(null);
              setShowDiscountModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Customizar desconto
          </button>
        </div>

        {loading && filteredDiscounts.length === 0 ? (
          <div className="grain-discounts__loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grain-discounts__skeleton" />
            ))}
          </div>
        ) : filteredDiscounts.length > 0 ? (
          <div className="grain-discounts__table-wrapper">
            <table className="grain-discounts__table">
              <thead>
                <tr>
                  <th scope="col">Cultura</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Tolerância</th>
                  <th scope="col">Desconto/ponto</th>
                  <th scope="col">Limite máximo</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscounts.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Cultura">{CROP_LABELS[item.crop] || item.crop}</td>
                    <td data-label="Tipo">{item.discountTypeLabel}</td>
                    <td data-label="Tolerância">
                      <span className="grain-discounts__mono">{formatPct(item.thresholdPct)}</span>
                    </td>
                    <td data-label="Desconto/ponto">
                      <span className="grain-discounts__mono">
                        {formatPct(item.discountPctPerPoint, 4)}
                      </span>
                    </td>
                    <td data-label="Limite máximo">
                      <span className="grain-discounts__mono">
                        {item.maxPct != null ? formatPct(item.maxPct) : '—'}
                      </span>
                    </td>
                    <td data-label="Ações">
                      <div className="grain-discounts__actions">
                        <button
                          type="button"
                          className="grain-discounts__action-btn"
                          onClick={() => {
                            setSelectedDiscount(item);
                            setShowDiscountModal(true);
                          }}
                          aria-label={`Editar desconto ${item.discountTypeLabel} de ${CROP_LABELS[item.crop] || item.crop}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="grain-discounts__action-btn grain-discounts__action-btn--danger"
                          onClick={() => handleDiscountDelete(item)}
                          aria-label={`Remover desconto ${item.discountTypeLabel} de ${CROP_LABELS[item.crop] || item.crop}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grain-discounts__empty">
            <Wheat size={48} className="grain-discounts__empty-icon" aria-hidden="true" />
            <h3 className="grain-discounts__empty-title">Nenhuma customização de desconto</h3>
            <p className="grain-discounts__empty-desc">
              Os padrões ANEC estão sendo usados. Customize os descontos para ajustar à sua
              operação.
            </p>
          </div>
        )}

        {/* Show ANEC defaults */}
        {Object.keys(discountDefaults).length > 0 && (
          <section className="grain-discounts__defaults">
            <h3 className="grain-discounts__defaults-title">Padrões ANEC (referência)</h3>
            <div className="grain-discounts__defaults-grid">
              {Object.entries(discountDefaults).map(([crop, types]) => (
                <div key={crop} className="grain-discounts__default-card">
                  <span className="grain-discounts__default-crop">{CROP_LABELS[crop] || crop}</span>
                  {Object.entries(types).map(([type, params]) => (
                    <div key={type} className="grain-discounts__default-row">
                      <span className="grain-discounts__default-type">
                        {type === 'MOISTURE'
                          ? 'Umidade'
                          : type === 'IMPURITY'
                            ? 'Impureza'
                            : 'Avariados'}
                      </span>
                      <span className="grain-discounts__mono grain-discounts__default-value">
                        {formatPct(params.thresholdPct)} /{' '}
                        {formatPct(params.discountPctPerPoint, 1)}
                        /pt
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  // ─── Render: Classifications Tab ──────────────────────────────────

  function renderClassificationsTab() {
    return (
      <>
        <div className="grain-discounts__toolbar">
          <div className="grain-discounts__search-wrapper">
            <Search size={16} className="grain-discounts__search-icon" aria-hidden="true" />
            <input
              type="search"
              className="grain-discounts__search"
              placeholder="Buscar cultura ou tipo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar classificação"
            />
          </div>
          <select
            className="grain-discounts__select"
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            aria-label="Filtrar por cultura"
          >
            <option value="">Todas as culturas</option>
            {CROPS.map((c) => (
              <option key={c} value={c}>
                {CROP_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="grain-discounts__btn-primary"
            onClick={() => {
              setSelectedClass(null);
              setShowClassModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Customizar classificação
          </button>
        </div>

        {loading && filteredClassifications.length === 0 ? (
          <div className="grain-discounts__loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grain-discounts__skeleton" />
            ))}
          </div>
        ) : filteredClassifications.length > 0 ? (
          <div className="grain-discounts__table-wrapper">
            <table className="grain-discounts__table">
              <thead>
                <tr>
                  <th scope="col">Cultura</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Umidade máx.</th>
                  <th scope="col">Impureza máx.</th>
                  <th scope="col">Avariados máx.</th>
                  <th scope="col">Quebrados máx.</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClassifications.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Cultura">{CROP_LABELS[item.crop] || item.crop}</td>
                    <td data-label="Tipo">
                      <span
                        className={`grain-discounts__grade-badge grain-discounts__grade-badge--${item.gradeType}`}
                      >
                        {item.gradeTypeLabel}
                      </span>
                    </td>
                    <td data-label="Umidade máx.">
                      <span className="grain-discounts__mono">
                        {formatPct(item.maxMoisturePct)}
                      </span>
                    </td>
                    <td data-label="Impureza máx.">
                      <span className="grain-discounts__mono">
                        {formatPct(item.maxImpurityPct)}
                      </span>
                    </td>
                    <td data-label="Avariados máx.">
                      <span className="grain-discounts__mono">{formatPct(item.maxDamagedPct)}</span>
                    </td>
                    <td data-label="Quebrados máx.">
                      <span className="grain-discounts__mono">{formatPct(item.maxBrokenPct)}</span>
                    </td>
                    <td data-label="Ações">
                      <div className="grain-discounts__actions">
                        <button
                          type="button"
                          className="grain-discounts__action-btn"
                          onClick={() => {
                            setSelectedClass(item);
                            setShowClassModal(true);
                          }}
                          aria-label={`Editar classificação ${item.gradeTypeLabel} de ${CROP_LABELS[item.crop] || item.crop}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="grain-discounts__action-btn grain-discounts__action-btn--danger"
                          onClick={() => handleClassDelete(item)}
                          aria-label={`Remover classificação ${item.gradeTypeLabel} de ${CROP_LABELS[item.crop] || item.crop}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grain-discounts__empty">
            <BarChart3 size={48} className="grain-discounts__empty-icon" aria-hidden="true" />
            <h3 className="grain-discounts__empty-title">Nenhuma customização de classificação</h3>
            <p className="grain-discounts__empty-desc">
              Os padrões MAPA estão sendo usados. Customize os limites por tipo para ajustar à sua
              operação.
            </p>
          </div>
        )}

        {/* Show MAPA defaults */}
        {Object.keys(classificationDefaults).length > 0 && (
          <section className="grain-discounts__defaults">
            <h3 className="grain-discounts__defaults-title">Padrões MAPA (referência)</h3>
            <div className="grain-discounts__defaults-grid">
              {Object.entries(classificationDefaults).map(([crop, grades]) => (
                <div key={crop} className="grain-discounts__default-card">
                  <span className="grain-discounts__default-crop">{CROP_LABELS[crop] || crop}</span>
                  {Object.entries(grades).map(([grade, limits]) => (
                    <div key={grade} className="grain-discounts__default-row">
                      <span className="grain-discounts__default-type">
                        {grade.replace('_', ' ')}
                      </span>
                      <span className="grain-discounts__mono grain-discounts__default-value">
                        U:{limits.maxMoisturePct}% I:{limits.maxImpurityPct}% A:
                        {limits.maxDamagedPct}% Q:{limits.maxBrokenPct}%
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  // ─── Render: Calculator Tab (CA6) ─────────────────────────────────

  function renderCalculatorTab() {
    return (
      <div className="grain-discounts__calculator">
        <form onSubmit={handleCalculate} className="grain-discounts__calc-form">
          <div className="grain-discounts__calc-row">
            <div className="grain-discounts__calc-field">
              <label htmlFor="calc-crop" className="grain-discounts__calc-label">
                Cultura *
              </label>
              <select
                id="calc-crop"
                className="grain-discounts__select"
                value={calcCrop}
                onChange={(e) => setCalcCrop(e.target.value)}
                required
              >
                {CROPS.map((c) => (
                  <option key={c} value={c}>
                    {CROP_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grain-discounts__calc-field">
              <label htmlFor="calc-gross" className="grain-discounts__calc-label">
                Produção bruta (kg) *
              </label>
              <input
                id="calc-gross"
                type="number"
                className="grain-discounts__calc-input"
                value={calcGrossKg}
                onChange={(e) => setCalcGrossKg(e.target.value)}
                min="0.01"
                step="0.01"
                required
                placeholder="Ex: 10000"
              />
            </div>
          </div>
          <div className="grain-discounts__calc-row">
            <div className="grain-discounts__calc-field">
              <label htmlFor="calc-moisture" className="grain-discounts__calc-label">
                Umidade (%) *
              </label>
              <input
                id="calc-moisture"
                type="number"
                className="grain-discounts__calc-input"
                value={calcMoisture}
                onChange={(e) => setCalcMoisture(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                required
                placeholder="Ex: 18.5"
              />
            </div>
            <div className="grain-discounts__calc-field">
              <label htmlFor="calc-impurity" className="grain-discounts__calc-label">
                Impureza (%) *
              </label>
              <input
                id="calc-impurity"
                type="number"
                className="grain-discounts__calc-input"
                value={calcImpurity}
                onChange={(e) => setCalcImpurity(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                required
                placeholder="Ex: 2.0"
              />
            </div>
          </div>
          <div className="grain-discounts__calc-row">
            <div className="grain-discounts__calc-field">
              <label htmlFor="calc-damaged" className="grain-discounts__calc-label">
                Avariados (%)
              </label>
              <input
                id="calc-damaged"
                type="number"
                className="grain-discounts__calc-input"
                value={calcDamaged}
                onChange={(e) => setCalcDamaged(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                placeholder="Opcional"
              />
            </div>
            <div className="grain-discounts__calc-field">
              <label htmlFor="calc-broken" className="grain-discounts__calc-label">
                Quebrados (%)
              </label>
              <input
                id="calc-broken"
                type="number"
                className="grain-discounts__calc-input"
                value={calcBroken}
                onChange={(e) => setCalcBroken(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                placeholder="Opcional"
              />
            </div>
          </div>
          <button
            type="submit"
            className="grain-discounts__btn-primary"
            disabled={loading}
            style={{ alignSelf: 'flex-start' }}
          >
            <Calculator size={16} aria-hidden="true" />
            {loading ? 'Calculando...' : 'Calcular descontos'}
          </button>
        </form>

        {breakdown && (
          <section className="grain-discounts__breakdown" aria-label="Resultado do cálculo">
            {/* Warnings */}
            {breakdown.warnings.length > 0 && (
              <div className="grain-discounts__warnings">
                {breakdown.warnings.map((w, i) => (
                  <div key={i} className="grain-discounts__warning">
                    <AlertTriangle size={16} aria-hidden="true" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Summary cards */}
            <div className="grain-discounts__breakdown-summary">
              <div className="grain-discounts__breakdown-card">
                <span className="grain-discounts__breakdown-label">Produção bruta</span>
                <span className="grain-discounts__breakdown-value">
                  {formatKg(breakdown.grossProductionKg)}
                </span>
              </div>
              <div className="grain-discounts__breakdown-card grain-discounts__breakdown-card--discount">
                <span className="grain-discounts__breakdown-label">Desconto total</span>
                <span className="grain-discounts__breakdown-value">
                  -{formatKg(breakdown.totalDiscountKg)} ({formatPct(breakdown.totalDiscountPct)})
                </span>
              </div>
              <div className="grain-discounts__breakdown-card grain-discounts__breakdown-card--net">
                <span className="grain-discounts__breakdown-label">Produção líquida</span>
                <span className="grain-discounts__breakdown-value">
                  {formatKg(breakdown.netProductionKg)}
                </span>
              </div>
              <div className="grain-discounts__breakdown-card">
                <span className="grain-discounts__breakdown-label">Classificação</span>
                <span
                  className={`grain-discounts__grade-badge grain-discounts__grade-badge--${breakdown.classification}`}
                >
                  {breakdown.classificationLabel}
                </span>
              </div>
            </div>

            {/* Detail table */}
            <div className="grain-discounts__table-wrapper">
              <table className="grain-discounts__table">
                <thead>
                  <tr>
                    <th scope="col">Tipo</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Tolerância</th>
                    <th scope="col">Excesso</th>
                    <th scope="col">Desc./ponto</th>
                    <th scope="col">Desconto %</th>
                    <th scope="col">Desconto kg</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: 'Umidade',
                      value: breakdown.moisturePct,
                      detail: breakdown.moistureDiscount,
                    },
                    {
                      label: 'Impureza',
                      value: breakdown.impurityPct,
                      detail: breakdown.impurityDiscount,
                    },
                    {
                      label: 'Avariados',
                      value: breakdown.damagedPct,
                      detail: breakdown.damagedDiscount,
                    },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td data-label="Tipo">{row.label}</td>
                      <td data-label="Valor">
                        <span className="grain-discounts__mono">{formatPct(row.value)}</span>
                      </td>
                      <td data-label="Tolerância">
                        <span className="grain-discounts__mono">
                          {formatPct(row.detail.thresholdPct)}
                        </span>
                      </td>
                      <td data-label="Excesso">
                        <span className="grain-discounts__mono">
                          {row.detail.excessPoints > 0
                            ? `+${row.detail.excessPoints.toFixed(2)} pts`
                            : '—'}
                        </span>
                      </td>
                      <td data-label="Desc./ponto">
                        <span className="grain-discounts__mono">
                          {formatPct(row.detail.discountPctPerPoint, 1)}
                        </span>
                      </td>
                      <td data-label="Desconto %">
                        <span
                          className={`grain-discounts__mono ${row.detail.discountPct > 0 ? 'grain-discounts__mono--negative' : ''}`}
                        >
                          {row.detail.discountPct > 0
                            ? `-${formatPct(row.detail.discountPct, 4)}`
                            : '—'}
                        </span>
                      </td>
                      <td data-label="Desconto kg">
                        <span
                          className={`grain-discounts__mono ${row.detail.discountKg > 0 ? 'grain-discounts__mono--negative' : ''}`}
                        >
                          {row.detail.discountKg > 0 ? `-${formatKg(row.detail.discountKg)}` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────

  return (
    <main className="grain-discounts-page">
      <header className="grain-discounts-page__header">
        <h1 className="grain-discounts-page__title">
          <Wheat size={24} aria-hidden="true" />
          Descontos e Classificação de Grãos
        </h1>
      </header>

      {error && (
        <div className="grain-discounts__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="grain-discounts-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`grain-discounts-page__tab ${activeTab === 'discounts' ? 'grain-discounts-page__tab--active' : ''}`}
          aria-selected={activeTab === 'discounts'}
          onClick={() => setActiveTab('discounts')}
        >
          Tabelas de desconto
        </button>
        <button
          type="button"
          role="tab"
          className={`grain-discounts-page__tab ${activeTab === 'classifications' ? 'grain-discounts-page__tab--active' : ''}`}
          aria-selected={activeTab === 'classifications'}
          onClick={() => setActiveTab('classifications')}
        >
          Classificação
        </button>
        <button
          type="button"
          role="tab"
          className={`grain-discounts-page__tab ${activeTab === 'calculator' ? 'grain-discounts-page__tab--active' : ''}`}
          aria-selected={activeTab === 'calculator'}
          onClick={() => setActiveTab('calculator')}
        >
          <Calculator size={16} aria-hidden="true" />
          Simulador
        </button>
      </div>

      {activeTab === 'discounts' && renderDiscountsTab()}
      {activeTab === 'classifications' && renderClassificationsTab()}
      {activeTab === 'calculator' && renderCalculatorTab()}

      {/* Modals */}
      <DiscountTableModal
        isOpen={showDiscountModal}
        onClose={() => {
          setShowDiscountModal(false);
          setSelectedDiscount(null);
        }}
        onSuccess={handleDiscountSuccess}
        onSave={handleDiscountSave}
        selectedItem={selectedDiscount}
      />

      <ClassificationModal
        isOpen={showClassModal}
        onClose={() => {
          setShowClassModal(false);
          setSelectedClass(null);
        }}
        onSuccess={handleClassSuccess}
        onSave={handleClassSave}
        selectedItem={selectedClass}
      />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            background: 'var(--color-neutral-800)',
            color: 'var(--color-neutral-0)',
            padding: '12px 20px',
            borderRadius: 8,
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.9375rem',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
