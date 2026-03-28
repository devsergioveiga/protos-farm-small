import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Eye, Loader2 } from 'lucide-react';
import { useAccountingRuleActions } from '@/hooks/useAccountingRules';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { SOURCE_TYPE_LABELS } from '@/types/auto-posting';
import type {
  AccountingRule,
  UpdateRuleInput,
  RulePreview,
  AutoPostingSourceType,
} from '@/types/auto-posting';
import type { ChartOfAccount } from '@/types/accounting';
import './AccountingRuleModal.css';

// ─── Template variable hints ──────────────────────────────────────────────────

const TEMPLATE_VARS: Record<AutoPostingSourceType, string[]> = {
  PAYROLL_RUN_CLOSE: ['referenceMonth', 'organizationName'],
  PAYABLE_SETTLEMENT: ['supplierName', 'documentNumber', 'description'],
  RECEIVABLE_SETTLEMENT: ['clientName', 'documentNumber', 'description'],
  DEPRECIATION_RUN: ['periodYear', 'periodMonth'],
  STOCK_ENTRY: ['supplierName', 'documentNumber', 'referenceDate'],
  STOCK_OUTPUT_CONSUMPTION: ['outputType', 'referenceDate', 'productCount'],
  STOCK_OUTPUT_TRANSFER: ['outputType', 'referenceDate', 'productCount'],
  STOCK_OUTPUT_DISPOSAL: ['outputType', 'referenceDate', 'productCount'],
  PAYROLL_PROVISION_VACATION: ['referenceMonth', 'provisionType'],
  PAYROLL_PROVISION_THIRTEENTH: ['referenceMonth', 'provisionType'],
  PAYABLE_REVERSAL: ['supplierName', 'documentNumber'],
  RECEIVABLE_REVERSAL: ['clientName', 'documentNumber'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineState {
  id: string;
  lineOrder: number;
  side: 'DEBIT' | 'CREDIT';
  accountId: string;
  accountSearch: string;
  description: string;
  accountError: string | null;
  dropdownOpen: boolean;
}

interface AccountingRuleModalProps {
  rule: AccountingRule;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newLine(order: number): LineState {
  return {
    id: crypto.randomUUID(),
    lineOrder: order,
    side: 'DEBIT',
    accountId: '',
    accountSearch: '',
    description: '',
    accountError: null,
    dropdownOpen: false,
  };
}

function filterAccounts(accounts: ChartOfAccount[], query: string): ChartOfAccount[] {
  const q = query.toLowerCase().trim();
  if (!q) return accounts.filter((a) => !a.isSynthetic && a.isActive);
  return accounts.filter(
    (a) =>
      !a.isSynthetic &&
      a.isActive &&
      (a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)),
  );
}

// ─── Account Combobox ─────────────────────────────────────────────────────────

interface AccountComboboxProps {
  value: string;
  search: string;
  error: string | null;
  accounts: ChartOfAccount[];
  dropdownOpen: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (account: ChartOfAccount) => void;
  onBlur: () => void;
  onOpen: () => void;
  lineId: string;
}

function AccountCombobox({
  value,
  search,
  error,
  accounts,
  dropdownOpen,
  onSearchChange,
  onSelect,
  onBlur,
  onOpen,
  lineId,
}: AccountComboboxProps) {
  const inputId = `account-combo-${lineId}`;
  const listId = `account-list-${lineId}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterAccounts(accounts, search), [accounts, search]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onBlur();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen, onBlur]);

  const selected = accounts.find((a) => a.id === value);
  const displayValue = dropdownOpen
    ? search
    : selected
      ? `${selected.code} — ${selected.name}`
      : search;

  return (
    <div className="arm__combobox-wrapper" ref={wrapperRef}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={dropdownOpen}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`arm__combobox-input${error ? ' arm__combobox-input--error' : ''}`}
        placeholder="Pesquisar conta..."
        value={displayValue}
        onChange={(e) => onSearchChange(e.target.value)}
        onClick={onOpen}
        onFocus={onOpen}
      />
      {error && (
        <span id={`${inputId}-error`} className="arm__field-error" role="alert" aria-live="polite">
          {error}
        </span>
      )}
      {dropdownOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Contas analíticas"
          className="arm__combobox-list"
        >
          {filtered.length === 0 && (
            <li className="arm__combobox-empty">Nenhuma conta encontrada</li>
          )}
          {filtered.slice(0, 50).map((account) => (
            <li
              key={account.id}
              role="option"
              aria-selected={account.id === value}
              className={`arm__combobox-option${account.id === value ? ' arm__combobox-option--selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(account);
              }}
            >
              <span className="arm__combobox-code">{account.code}</span>
              <span className="arm__combobox-name">{account.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  preview: RulePreview | null;
  isLoading: boolean;
  noData: boolean;
}

function PreviewPanel({ preview, isLoading, noData }: PreviewPanelProps) {
  if (isLoading) {
    return (
      <div className="arm__preview-card" aria-live="polite" aria-busy="true">
        <div className="arm__preview-skeleton" />
        <div className="arm__preview-skeleton arm__preview-skeleton--short" />
        <div className="arm__preview-skeleton" />
      </div>
    );
  }

  if (noData || !preview) {
    return (
      <div className="arm__preview-card arm__preview-card--info" role="status">
        Nenhuma operação deste tipo encontrada. O preview usa dados de exemplo.
      </div>
    );
  }

  return (
    <div className="arm__preview-card" aria-live="polite">
      <div className="arm__preview-header">
        <span className="arm__preview-label">Data:</span>
        <span className="arm__preview-value arm__mono">
          {new Date(preview.entryDate).toLocaleDateString('pt-BR')}
        </span>
        {preview.costCenterName && (
          <>
            <span className="arm__preview-label">CC:</span>
            <span className="arm__preview-value">{preview.costCenterName}</span>
          </>
        )}
      </div>
      <div className="arm__preview-desc">{preview.description}</div>
      <table className="arm__preview-table">
        <thead>
          <tr>
            <th className="arm__preview-th">Conta</th>
            <th className="arm__preview-th">D/C</th>
            <th className="arm__preview-th arm__preview-th--right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((line, i) => (
            <tr key={i}>
              <td className="arm__preview-td arm__mono">
                {line.accountCode} — {line.accountName}
              </td>
              <td className="arm__preview-td">{line.side === 'DEBIT' ? 'D' : 'C'}</td>
              <td className="arm__preview-td arm__preview-td--right arm__mono">
                {parseFloat(line.amount).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AccountingRuleModal({ rule, onClose, onSaved }: AccountingRuleModalProps) {
  const { updateRule, getPreview } = useAccountingRuleActions();
  const { data: allAccounts } = useChartOfAccounts();

  const [isActive, setIsActive] = useState(rule.isActive);
  const [historyTemplate, setHistoryTemplate] = useState(rule.historyTemplate);
  const [requireCostCenter, setRequireCostCenter] = useState(rule.requireCostCenter);
  const [lines, setLines] = useState<LineState[]>(() =>
    rule.lines.map((l) => ({
      id: l.id,
      lineOrder: l.lineOrder,
      side: l.side,
      accountId: l.accountId,
      accountSearch: `${l.accountCode} — ${l.accountName}`,
      description: l.description ?? '',
      accountError: null,
      dropdownOpen: false,
    })),
  );

  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<RulePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewShown, setPreviewShown] = useState(false);
  const [previewNoData, setPreviewNoData] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Focus trap
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    firstFocusRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Validate lines
  const validateLines = useCallback((): boolean => {
    let valid = true;
    setLines((prev) =>
      prev.map((l) => {
        if (!l.accountId) {
          valid = false;
          return { ...l, accountError: 'Selecione uma conta analítica' };
        }
        return { ...l, accountError: null };
      }),
    );
    return valid;
  }, []);

  const hasEmptyAccount = lines.some((l) => !l.accountId);
  const isSaveDisabled = hasEmptyAccount || lines.length === 0 || saving;

  // Line operations
  const addLine = () => {
    setLines((prev) => [...prev, newLine(prev.length + 1)]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => {
      const filtered = prev.filter((l) => l.id !== id);
      return filtered.map((l, i) => ({ ...l, lineOrder: i + 1 }));
    });
  };

  const updateLineSide = (id: string, side: 'DEBIT' | 'CREDIT') => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, side } : l)));
  };

  const updateLineSearch = (id: string, search: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, accountSearch: search, accountId: '', dropdownOpen: true } : l,
      ),
    );
  };

  const selectLineAccount = (id: string, account: ChartOfAccount) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              accountId: account.id,
              accountSearch: `${account.code} — ${account.name}`,
              accountError: null,
              dropdownOpen: false,
            }
          : l,
      ),
    );
  };

  const openLineDropdown = (id: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, dropdownOpen: true, accountSearch: '' } : l)),
    );
  };

  const closeLineDropdown = (id: string) => {
    setLines((prev) => {
      return prev.map((l) => {
        if (l.id !== id) return l;
        // if account was selected, show formatted name; otherwise clear
        const acct = allAccounts.find((a) => a.id === l.accountId);
        return {
          ...l,
          dropdownOpen: false,
          accountSearch: acct ? `${acct.code} — ${acct.name}` : l.accountSearch,
          accountError: !l.accountId ? 'Selecione uma conta analítica' : null,
        };
      });
    });
  };

  // Preview
  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewShown(true);
    setPreviewNoData(false);
    try {
      const data = await getPreview(rule.id);
      setPreviewData(data);
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status === 404) {
        setPreviewNoData(true);
        setPreviewData(null);
      } else {
        setPreviewNoData(true);
        setPreviewData(null);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [getPreview, rule.id]);

  // Save
  const handleSave = useCallback(async () => {
    if (!validateLines()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input: UpdateRuleInput = {
        isActive,
        historyTemplate,
        requireCostCenter,
        lines: lines.map((l) => ({
          lineOrder: l.lineOrder,
          side: l.side,
          accountId: l.accountId,
          description: l.description || undefined,
        })),
      };
      await updateRule(rule.id, input);
      onSaved();
    } catch {
      setSaveError('Não foi possível salvar a regra. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  }, [
    validateLines,
    isActive,
    historyTemplate,
    requireCostCenter,
    lines,
    updateRule,
    rule.id,
    onSaved,
  ]);

  const templateVars = TEMPLATE_VARS[rule.sourceType] ?? [];

  return (
    <div
      className="arm__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-modal-title"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="arm__modal">
        {/* Header */}
        <header className="arm__header">
          <div className="arm__header-left">
            <h2 id="rule-modal-title" className="arm__title">
              {SOURCE_TYPE_LABELS[rule.sourceType]}
            </h2>
          </div>
          <div className="arm__header-right">
            <div className="arm__header-toggle">
              <span className="arm__toggle-label">{isActive ? 'Ativa' : 'Inativa'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label="Ativar/desativar regra"
                className={`arm__toggle${isActive ? ' arm__toggle--on' : ''}`}
                onClick={() => setIsActive((v) => !v)}
              >
                <span className="arm__toggle-thumb" />
              </button>
            </div>
            <button
              type="button"
              ref={firstFocusRef}
              className="arm__close-btn"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="arm__body">
          {/* Lines section */}
          <section aria-labelledby="arm-lines-heading" className="arm__section">
            <h3 id="arm-lines-heading" className="arm__section-title">
              Linhas de Lançamento
            </h3>

            <div className="arm__lines-table-wrapper">
              <table className="arm__lines-table">
                <caption className="sr-only">Linhas de lançamento da regra</caption>
                <thead>
                  <tr>
                    <th scope="col" className="arm__lines-th arm__lines-th--order">
                      Ordem
                    </th>
                    <th scope="col" className="arm__lines-th">
                      Tipo
                    </th>
                    <th scope="col" className="arm__lines-th">
                      Conta
                    </th>
                    <th scope="col" className="arm__lines-th">
                      Histórico da Linha
                    </th>
                    {lines.length > 1 && (
                      <th scope="col" className="arm__lines-th arm__lines-th--remove" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="arm__lines-row">
                      <td className="arm__lines-td arm__lines-td--order arm__mono">
                        {line.lineOrder}
                      </td>
                      <td className="arm__lines-td">
                        <select
                          className="arm__select"
                          value={line.side}
                          onChange={(e) =>
                            updateLineSide(line.id, e.target.value as 'DEBIT' | 'CREDIT')
                          }
                          aria-label="Tipo de linha"
                        >
                          <option value="DEBIT">Débito</option>
                          <option value="CREDIT">Crédito</option>
                        </select>
                      </td>
                      <td className="arm__lines-td arm__lines-td--account">
                        <AccountCombobox
                          lineId={line.id}
                          value={line.accountId}
                          search={line.accountSearch}
                          error={line.accountError}
                          accounts={allAccounts}
                          dropdownOpen={line.dropdownOpen}
                          onSearchChange={(val) => updateLineSearch(line.id, val)}
                          onSelect={(acct) => selectLineAccount(line.id, acct)}
                          onBlur={() => closeLineDropdown(line.id)}
                          onOpen={() => openLineDropdown(line.id)}
                        />
                      </td>
                      <td className="arm__lines-td">
                        <input
                          type="text"
                          className="arm__input"
                          value={line.description}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.id === line.id ? { ...l, description: e.target.value } : l,
                              ),
                            )
                          }
                          placeholder="Histórico opcional..."
                          aria-label="Histórico da linha"
                        />
                      </td>
                      {lines.length > 1 && (
                        <td className="arm__lines-td arm__lines-td--remove">
                          <button
                            type="button"
                            className="arm__remove-btn"
                            aria-label={`Remover linha ${line.lineOrder}`}
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lines.length === 0 && (
              <p className="arm__lines-empty" role="alert">
                Adicione ao menos uma linha de lançamento.
              </p>
            )}

            <button type="button" className="arm__add-line-btn" onClick={addLine}>
              <Plus size={14} aria-hidden="true" />
              Adicionar linha
            </button>
          </section>

          {/* History template section */}
          <section aria-labelledby="arm-history-heading" className="arm__section">
            <h3 id="arm-history-heading" className="arm__section-title">
              Histórico
            </h3>
            <label htmlFor="arm-history-template" className="arm__label">
              Modelo de histórico
            </label>
            <textarea
              id="arm-history-template"
              className="arm__textarea"
              value={historyTemplate}
              onChange={(e) => setHistoryTemplate(e.target.value)}
              rows={3}
              placeholder="Ex: Folha de pagamento {{referenceMonth}}"
            />
            {templateVars.length > 0 && (
              <p className="arm__template-hint">
                Variáveis disponíveis:{' '}
                {templateVars.map((v, i) => (
                  <span key={v}>
                    <code className="arm__template-var">{`{{${v}}}`}</code>
                    {i < templateVars.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            )}
          </section>

          {/* Configuration section */}
          <section aria-labelledby="arm-config-heading" className="arm__section">
            <h3 id="arm-config-heading" className="arm__section-title">
              Configuração
            </h3>
            <label className="arm__checkbox-label">
              <input
                type="checkbox"
                className="arm__checkbox"
                checked={requireCostCenter}
                onChange={(e) => setRequireCostCenter(e.target.checked)}
                aria-label="Centro de custo obrigatório"
              />
              Centro de custo obrigatório
            </label>
          </section>

          {/* Preview panel */}
          {previewShown && (
            <section aria-labelledby="arm-preview-heading" className="arm__section">
              <h3 id="arm-preview-heading" className="arm__section-title">
                Pré-visualização
              </h3>
              <PreviewPanel
                preview={previewData}
                isLoading={previewLoading}
                noData={previewNoData}
              />
            </section>
          )}

          {/* Save error */}
          {saveError && (
            <div className="arm__save-error" role="alert" aria-live="polite">
              {saveError}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="arm__footer">
          <button
            type="button"
            className="arm__btn arm__btn--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="arm__btn arm__btn--secondary"
            onClick={() => {
              void handlePreview();
            }}
            disabled={previewLoading || saving}
            aria-busy={previewLoading}
          >
            {previewLoading ? (
              <Loader2 size={14} aria-hidden="true" className="arm__spin" />
            ) : (
              <Eye size={14} aria-hidden="true" />
            )}
            Pré-visualizar
          </button>
          <button
            type="button"
            className="arm__btn arm__btn--primary"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaveDisabled}
            aria-busy={saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="arm__spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
