import { useState, useEffect } from 'react';
import {
  Settings,
  TrendingUp,
  TrendingDown,
  Lock,
  Code,
  Pencil,
  Slash,
  AlertCircle,
  ListTree,
} from 'lucide-react';
import { usePayrollRubricas } from '@/hooks/usePayrollRubricas';
import { usePayrollTables } from '@/hooks/usePayrollTables';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PayrollRubricaModal from '@/components/payroll/PayrollRubricaModal';
import PayrollLegalTableModal from '@/components/payroll/PayrollLegalTableModal';
import type {
  PayrollRubrica,
  PayrollLegalTable,
  CreateRubricaInput,
  UpdateRubricaInput,
  LegalTableType,
} from '@/types/payroll';
import { LEGAL_TABLE_TYPE_LABELS } from '@/types/payroll';
import './PayrollParametersPage.css';

type Tab = 'rubricas' | 'tabelas';

const ALL_TABLE_TYPES: LegalTableType[] = ['INSS', 'IRRF', 'SALARY_FAMILY', 'MINIMUM_WAGE', 'FUNRURAL'];

function formatMonetary(value: string | null | undefined): string {
  if (!value) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRate(value: string | null | undefined): string {
  if (!value) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function isEffective(effectiveFrom: string): boolean {
  return new Date(effectiveFrom) <= new Date();
}

function groupTablesByType(tables: PayrollLegalTable[]): Record<LegalTableType, PayrollLegalTable[]> {
  const result: Record<string, PayrollLegalTable[]> = {};
  for (const type of ALL_TABLE_TYPES) {
    result[type] = [];
  }
  for (const table of tables) {
    if (result[table.tableType]) {
      result[table.tableType].push(table);
    }
  }
  // Sort each group by effectiveFrom descending
  for (const type of ALL_TABLE_TYPES) {
    result[type].sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
    );
  }
  return result as Record<LegalTableType, PayrollLegalTable[]>;
}

export default function PayrollParametersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rubricas');
  const [showRubricaModal, setShowRubricaModal] = useState(false);
  const [editingRubrica, setEditingRubrica] = useState<PayrollRubrica | null>(null);
  const [deactivatingRubrica, setDeactivatingRubrica] = useState<PayrollRubrica | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [selectedTableType, setSelectedTableType] = useState<LegalTableType | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<LegalTableType, boolean>>({} as Record<LegalTableType, boolean>);

  const { rubricas, isLoading: rubricasLoading, error: rubricasError, fetchRubricas, createRubrica, updateRubrica, deactivateRubrica } = usePayrollRubricas();
  const { tables, isLoading: tablesLoading, fetchTables, createTable } = usePayrollTables();

  useEffect(() => {
    if (activeTab === 'rubricas') {
      void fetchRubricas();
    } else {
      void fetchTables();
    }
  }, [activeTab, fetchRubricas, fetchTables]);

  const handleCreateRubrica = () => {
    setEditingRubrica(null);
    setShowRubricaModal(true);
  };

  const handleEditRubrica = (rubrica: PayrollRubrica) => {
    setEditingRubrica(rubrica);
    setShowRubricaModal(true);
  };

  const handleSaveRubrica = async (data: CreateRubricaInput | UpdateRubricaInput): Promise<boolean> => {
    if (editingRubrica) {
      return updateRubrica(editingRubrica.id, data as UpdateRubricaInput);
    }
    return createRubrica(data as CreateRubricaInput);
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivatingRubrica) return;
    setIsDeactivating(true);
    try {
      await deactivateRubrica(deactivatingRubrica.id);
    } finally {
      setIsDeactivating(false);
      setDeactivatingRubrica(null);
    }
  };

  const handleUpdateTable = (tableType: LegalTableType) => {
    setSelectedTableType(tableType);
    setShowTableModal(true);
  };

  const handleSaveTable = async (data: Parameters<typeof createTable>[0]): Promise<boolean> => {
    return createTable(data);
  };

  const toggleHistory = (type: LegalTableType) => {
    setExpandedHistory((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const groupedTables = groupTablesByType(tables);

  return (
    <main className="payroll-params" id="main-content">
      {/* Breadcrumb */}
      <nav className="payroll-params__breadcrumb" aria-label="Navegação estrutural">
        <span>RH</span>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Parâmetros de Folha</span>
      </nav>

      {/* Header */}
      <div className="payroll-params__header">
        <div>
          <h1 className="payroll-params__title">
            <Settings size={24} aria-hidden="true" />
            Parâmetros de Folha
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="payroll-params__tabs" role="tablist" aria-label="Seções de parâmetros">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rubricas'}
          aria-controls="tab-rubricas"
          className={`payroll-params__tab ${activeTab === 'rubricas' ? 'payroll-params__tab--active' : ''}`}
          onClick={() => setActiveTab('rubricas')}
        >
          Rubricas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tabelas'}
          aria-controls="tab-tabelas"
          className={`payroll-params__tab ${activeTab === 'tabelas' ? 'payroll-params__tab--active' : ''}`}
          onClick={() => setActiveTab('tabelas')}
        >
          Tabelas Legais
        </button>
      </div>

      {/* Tab: Rubricas */}
      {activeTab === 'rubricas' && (
        <section id="tab-rubricas" role="tabpanel" aria-label="Rubricas">
          {/* Tab header with CTA */}
          <div className="payroll-params__tab-header">
            <span className="payroll-params__tab-count">
              {!rubricasLoading && rubricas.length > 0 && `${rubricas.length} rubrica${rubricas.length !== 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              className="payroll-params__btn payroll-params__btn--primary"
              onClick={handleCreateRubrica}
            >
              Nova Rubrica
            </button>
          </div>

          {/* Error */}
          {rubricasError && (
            <div className="payroll-params__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {rubricasError}
            </div>
          )}

          {/* Loading skeleton */}
          {rubricasLoading && (
            <div className="payroll-params__table-wrapper">
              <table className="payroll-params__table" aria-label="Carregando rubricas...">
                <thead>
                  <tr>
                    <th scope="col">RUBRICA</th>
                    <th scope="col">TIPO</th>
                    <th scope="col">CÁLCULO</th>
                    <th scope="col">TAXA / FÓRMULA</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="payroll-params__skeleton-row">
                      <td><div className="payroll-params__skeleton payroll-params__skeleton--name" /></td>
                      <td><div className="payroll-params__skeleton payroll-params__skeleton--badge" /></td>
                      <td><div className="payroll-params__skeleton payroll-params__skeleton--badge" /></td>
                      <td><div className="payroll-params__skeleton payroll-params__skeleton--text" /></td>
                      <td><div className="payroll-params__skeleton payroll-params__skeleton--actions" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!rubricasLoading && !rubricasError && rubricas.length === 0 && (
            <div className="payroll-params__empty">
              <ListTree size={48} className="payroll-params__empty-icon" aria-hidden="true" />
              <h2 className="payroll-params__empty-title">Nenhuma rubrica configurada</h2>
              <p className="payroll-params__empty-body">
                As rubricas definem como proventos e descontos são calculados na folha. Comece adicionando uma rubrica.
              </p>
              <button
                type="button"
                className="payroll-params__btn payroll-params__btn--primary"
                onClick={handleCreateRubrica}
              >
                Nova Rubrica
              </button>
            </div>
          )}

          {/* Table */}
          {!rubricasLoading && !rubricasError && rubricas.length > 0 && (
            <div className="payroll-params__table-wrapper">
              <table className="payroll-params__table" aria-label="Lista de rubricas">
                <thead>
                  <tr>
                    <th scope="col">RUBRICA</th>
                    <th scope="col">TIPO</th>
                    <th scope="col">CÁLCULO</th>
                    <th scope="col">TAXA / FÓRMULA</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {rubricas.map((rubrica) => (
                    <tr
                      key={rubrica.id}
                      className={`payroll-params__row ${rubrica.isSystem ? 'payroll-params__row--system' : ''}`}
                    >
                      <td className="payroll-params__cell-name">
                        <div className="payroll-params__rubrica-name">{rubrica.name}</div>
                        <div className="payroll-params__rubrica-code">{rubrica.code}</div>
                      </td>
                      <td>
                        {rubrica.rubricaType === 'PROVENTO' ? (
                          <span className="payroll-params__badge payroll-params__badge--provento">
                            <TrendingUp size={16} aria-hidden="true" />
                            Provento
                          </span>
                        ) : rubrica.rubricaType === 'DESCONTO' ? (
                          <span className="payroll-params__badge payroll-params__badge--desconto">
                            <TrendingDown size={16} aria-hidden="true" />
                            Desconto
                          </span>
                        ) : (
                          <span className="payroll-params__badge payroll-params__badge--neutral">
                            Informativo
                          </span>
                        )}
                      </td>
                      <td>
                        {rubrica.calculationType === 'SYSTEM' ? (
                          <span className="payroll-params__badge payroll-params__badge--sistema">
                            <Lock size={16} aria-hidden="true" />
                            Sistema
                          </span>
                        ) : rubrica.calculationType === 'FORMULA' ? (
                          <span className="payroll-params__badge payroll-params__badge--formula">
                            <Code size={16} aria-hidden="true" />
                            Fórmula
                          </span>
                        ) : (
                          <span className="payroll-params__badge payroll-params__badge--percentual">
                            Percentual
                          </span>
                        )}
                      </td>
                      <td className="payroll-params__cell-formula">
                        {rubrica.calculationType === 'PERCENTAGE' && rubrica.rate
                          ? `${rubrica.rate}%`
                          : rubrica.calculationType === 'FORMULA' && rubrica.baseFormula
                          ? <code className="payroll-params__formula-preview">{rubrica.baseFormula}</code>
                          : <span className="payroll-params__system-formula">—</span>}
                      </td>
                      <td>
                        <div className="payroll-params__row-actions">
                          {rubrica.isSystem ? (
                            <button
                              type="button"
                              className="payroll-params__action-btn payroll-params__action-btn--disabled"
                              disabled
                              aria-label="Rubrica protegida por lei, não editável"
                              title="Rubrica protegida por lei, não editável"
                            >
                              <Lock size={16} aria-hidden="true" />
                              <span className="sr-only">Não editável</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="payroll-params__action-btn payroll-params__action-btn--edit"
                                onClick={() => handleEditRubrica(rubrica)}
                                aria-label={`Editar rubrica ${rubrica.name}`}
                              >
                                <Pencil size={16} aria-hidden="true" />
                                Editar
                              </button>
                              <button
                                type="button"
                                className="payroll-params__action-btn payroll-params__action-btn--deactivate"
                                onClick={() => setDeactivatingRubrica(rubrica)}
                                aria-label={`Desativar rubrica ${rubrica.name}`}
                              >
                                <Slash size={16} aria-hidden="true" />
                                Desativar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards (hidden on desktop via CSS) */}
          <div className="payroll-params__cards" aria-hidden={rubricas.length === 0}>
            {!rubricasLoading &&
              rubricas.map((rubrica) => (
                <div
                  key={`card-${rubrica.id}`}
                  className={`payroll-params__card ${rubrica.isSystem ? 'payroll-params__card--system' : ''}`}
                >
                  <div className="payroll-params__card-header">
                    <div>
                      <div className="payroll-params__rubrica-name">{rubrica.name}</div>
                      <div className="payroll-params__rubrica-code">{rubrica.code}</div>
                    </div>
                    {rubrica.rubricaType === 'PROVENTO' ? (
                      <span className="payroll-params__badge payroll-params__badge--provento">
                        <TrendingUp size={16} aria-hidden="true" />
                        Provento
                      </span>
                    ) : (
                      <span className="payroll-params__badge payroll-params__badge--desconto">
                        <TrendingDown size={16} aria-hidden="true" />
                        Desconto
                      </span>
                    )}
                  </div>
                  <div className="payroll-params__card-actions">
                    {rubrica.isSystem ? (
                      <span className="payroll-params__card-locked" aria-label="Rubrica protegida por lei, não editável">
                        <Lock size={14} aria-hidden="true" />
                        Protegida por lei
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="payroll-params__action-btn payroll-params__action-btn--edit"
                          onClick={() => handleEditRubrica(rubrica)}
                          aria-label={`Editar rubrica ${rubrica.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="payroll-params__action-btn payroll-params__action-btn--deactivate"
                          onClick={() => setDeactivatingRubrica(rubrica)}
                          aria-label={`Desativar rubrica ${rubrica.name}`}
                        >
                          <Slash size={16} aria-hidden="true" />
                          Desativar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Tab: Tabelas Legais */}
      {activeTab === 'tabelas' && (
        <section id="tab-tabelas" role="tabpanel" aria-label="Tabelas Legais">
          {tablesLoading && (
            <div className="payroll-params__tables-loading">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="payroll-params__table-group-skeleton">
                  <div className="payroll-params__skeleton payroll-params__skeleton--heading" />
                  <div className="payroll-params__skeleton payroll-params__skeleton--row" />
                  <div className="payroll-params__skeleton payroll-params__skeleton--row" />
                  <div className="payroll-params__skeleton payroll-params__skeleton--row" />
                </div>
              ))}
            </div>
          )}

          {!tablesLoading && tables.length === 0 && (
            <div className="payroll-params__empty">
              <ListTree size={48} className="payroll-params__empty-icon" aria-hidden="true" />
              <h2 className="payroll-params__empty-title">Tabelas legais não configuradas</h2>
              <p className="payroll-params__empty-body">
                Cadastre as tabelas de INSS, IRRF e salário-família para que o motor de cálculo funcione corretamente.
              </p>
              <button
                type="button"
                className="payroll-params__btn payroll-params__btn--primary"
                onClick={() => handleUpdateTable('INSS')}
              >
                Cadastrar Tabela INSS
              </button>
            </div>
          )}

          {!tablesLoading && (
            <div className="payroll-params__table-groups">
              {ALL_TABLE_TYPES.map((type) => {
                const typeTables = groupedTables[type];
                const currentTable = typeTables[0] ?? null;
                const historyTables = typeTables.slice(1);
                const isHistoryExpanded = expandedHistory[type] ?? false;
                const isBracketType = type === 'INSS' || type === 'IRRF';
                const hasDeduction = type === 'IRRF';

                return (
                  <section key={type} className="payroll-params__table-group">
                    <div className="payroll-params__table-group-header">
                      <h2 className="payroll-params__table-group-title">
                        {LEGAL_TABLE_TYPE_LABELS[type]}
                      </h2>
                      <button
                        type="button"
                        className="payroll-params__btn payroll-params__btn--secondary"
                        onClick={() => handleUpdateTable(type)}
                      >
                        Atualizar Tabela
                      </button>
                    </div>

                    {currentTable ? (
                      <div className="payroll-params__legal-table">
                        {/* Effective badge */}
                        <div className="payroll-params__table-meta">
                          <span className="payroll-params__table-effective-label">Vigência:</span>
                          <span className="payroll-params__table-effective-date">
                            {new Date(currentTable.effectiveFrom).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                          </span>
                          {isEffective(currentTable.effectiveFrom) ? (
                            <span className="payroll-params__badge payroll-params__badge--vigente">
                              Vigente
                            </span>
                          ) : (
                            <span className="payroll-params__badge payroll-params__badge--agendada">
                              Agendada
                            </span>
                          )}
                        </div>

                        {/* Bracket table */}
                        {isBracketType && currentTable.brackets.length > 0 && (
                          <div className="payroll-params__bracket-wrapper">
                            <table className="payroll-params__bracket-table" aria-label={`Tabela ${LEGAL_TABLE_TYPE_LABELS[type]}`}>
                              <thead>
                                <tr>
                                  <th scope="col">De (R$)</th>
                                  <th scope="col">Até (R$)</th>
                                  <th scope="col">Alíquota (%)</th>
                                  {hasDeduction && <th scope="col">Deduzir (R$)</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {[...currentTable.brackets].sort((a, b) => a.order - b.order).map((bracket, _idx, _arr) => (
                                  <tr key={bracket.id}>
                                    <td className="payroll-params__cell-mono">{formatMonetary(bracket.fromValue)}</td>
                                    <td className="payroll-params__cell-mono">
                                      {bracket.upTo === null ? (
                                        <span className="payroll-params__sem-limite">Sem limite</span>
                                      ) : (
                                        formatMonetary(bracket.upTo)
                                      )}
                                    </td>
                                    <td className="payroll-params__cell-mono">{formatRate(bracket.rate)}</td>
                                    {hasDeduction && (
                                      <td className="payroll-params__cell-mono">{formatMonetary(bracket.deduction)}</td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Scalar values */}
                        {!isBracketType && currentTable.scalarValues.length > 0 && (
                          <dl className="payroll-params__scalars">
                            {currentTable.scalarValues.map((scalar) => (
                              <div key={scalar.id} className="payroll-params__scalar-item">
                                <dt className="payroll-params__scalar-key">{scalar.key}</dt>
                                <dd className="payroll-params__scalar-value payroll-params__cell-mono">
                                  {formatMonetary(scalar.value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}

                        {/* History toggle */}
                        {historyTables.length > 0 && (
                          <div className="payroll-params__history-section">
                            <button
                              type="button"
                              className="payroll-params__history-toggle"
                              onClick={() => toggleHistory(type)}
                              aria-expanded={isHistoryExpanded}
                              aria-controls={`history-${type}`}
                            >
                              {isHistoryExpanded ? 'Ocultar histórico' : 'Ver histórico'}
                              <span className="payroll-params__history-count">
                                ({historyTables.length} versã{historyTables.length === 1 ? 'o' : 'ões'} anterior{historyTables.length !== 1 ? 'es' : ''})
                              </span>
                            </button>

                            <div
                              id={`history-${type}`}
                              className={`payroll-params__history-content ${isHistoryExpanded ? 'payroll-params__history-content--open' : ''}`}
                            >
                              {historyTables.map((histTable) => (
                                <div key={histTable.id} className="payroll-params__history-entry">
                                  <div className="payroll-params__table-meta">
                                    <span className="payroll-params__table-effective-date">
                                      {new Date(histTable.effectiveFrom).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                                    </span>
                                    <span className="payroll-params__badge payroll-params__badge--historico">
                                      Histórico
                                    </span>
                                  </div>
                                  {isBracketType && histTable.brackets.length > 0 && (
                                    <div className="payroll-params__bracket-wrapper">
                                      <table className="payroll-params__bracket-table" aria-label={`Tabela ${LEGAL_TABLE_TYPE_LABELS[type]} histórica`}>
                                        <thead>
                                          <tr>
                                            <th scope="col">De (R$)</th>
                                            <th scope="col">Até (R$)</th>
                                            <th scope="col">Alíquota (%)</th>
                                            {hasDeduction && <th scope="col">Deduzir (R$)</th>}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {[...histTable.brackets].sort((a, b) => a.order - b.order).map((bracket) => (
                                            <tr key={bracket.id}>
                                              <td className="payroll-params__cell-mono">{formatMonetary(bracket.fromValue)}</td>
                                              <td className="payroll-params__cell-mono">
                                                {bracket.upTo === null ? (
                                                  <span className="payroll-params__sem-limite">Sem limite</span>
                                                ) : (
                                                  formatMonetary(bracket.upTo)
                                                )}
                                              </td>
                                              <td className="payroll-params__cell-mono">{formatRate(bracket.rate)}</td>
                                              {hasDeduction && (
                                                <td className="payroll-params__cell-mono">{formatMonetary(bracket.deduction)}</td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="payroll-params__table-empty">
                        <p>Nenhuma tabela cadastrada para {LEGAL_TABLE_TYPE_LABELS[type]}.</p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      <PayrollRubricaModal
        isOpen={showRubricaModal}
        rubrica={editingRubrica}
        onSave={handleSaveRubrica}
        onClose={() => {
          setShowRubricaModal(false);
          setEditingRubrica(null);
        }}
      />

      {selectedTableType && (
        <PayrollLegalTableModal
          isOpen={showTableModal}
          tableType={selectedTableType}
          onSave={handleSaveTable}
          onClose={() => {
            setShowTableModal(false);
            setSelectedTableType(null);
          }}
        />
      )}

      <ConfirmModal
        isOpen={deactivatingRubrica !== null}
        title="Desativar rubrica?"
        message={
          deactivatingRubrica
            ? `A rubrica '${deactivatingRubrica.name}' deixará de aparecer no processamento de novas folhas. Folhas já fechadas não são afetadas.`
            : ''
        }
        confirmLabel="Desativar Rubrica"
        variant="danger"
        isLoading={isDeactivating}
        onConfirm={() => { void handleDeactivateConfirm(); }}
        onCancel={() => setDeactivatingRubrica(null)}
      />
    </main>
  );
}
