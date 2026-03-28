import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Plus, Trash2, CheckCircle, XCircle, AlertCircle, Save } from 'lucide-react';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import { useJournalEntryActions } from '@/hooks/useJournalEntries';
import ConfirmModal from '@/components/ui/ConfirmModal';
import JournalEntryTemplateModal from '@/components/accounting/JournalEntryTemplateModal';
import type { JournalEntry, LedgerSide, CreateJournalEntryLineInput } from '@/types/journal-entries';
import './JournalEntryModal.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineState {
  id: string;
  accountId: string;
  accountSearch: string;
  side: LedgerSide;
  amount: string;
  description: string;
}

interface JournalEntryModalProps {
  isOpen: boolean;
  entry?: JournalEntry;
  readOnly?: boolean;
  orgId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newLine(side: LedgerSide = 'DEBIT'): LineState {
  return {
    id: crypto.randomUUID(),
    accountId: '',
    accountSearch: '',
    side,
    amount: '',
    description: '',
  };
}

function parseAmount(str: string): number {
  // Accept comma or dot as decimal separator
  const normalized = str.replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}



// ─── Balance Indicator ────────────────────────────────────────────────────────

interface BalanceIndicatorProps {
  lines: LineState[];
}

function BalanceIndicator({ lines }: BalanceIndicatorProps) {
  const debitTotal = lines.reduce((s, l) => l.side === 'DEBIT' ? s + parseAmount(l.amount) : s, 0);
  const creditTotal = lines.reduce((s, l) => l.side === 'CREDIT' ? s + parseAmount(l.amount) : s, 0);
  const diff = Math.abs(debitTotal - creditTotal);
  const balanced = diff < 0.005 && (debitTotal > 0 || creditTotal > 0);
  const hasValues = debitTotal > 0 || creditTotal > 0;

  const debitStr = debitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const creditStr = creditTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const diffStr = diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let stateClass: string;
  let icon: React.ReactNode;
  let message: string;

  if (!hasValues) {
    stateClass = 'je-modal__balance--pending';
    icon = <AlertCircle size={16} aria-hidden="true" />;
    message = 'Adicione valores para verificar o balanceamento';
  } else if (balanced) {
    stateClass = 'je-modal__balance--ok';
    icon = <CheckCircle size={16} aria-hidden="true" />;
    message = 'Lançamento balanceado';
  } else {
    stateClass = 'je-modal__balance--error';
    icon = <XCircle size={16} aria-hidden="true" />;
    message = `Diferença de ${diffStr} — débitos e créditos devem ser iguais`;
  }

  return (
    <div className={`je-modal__balance ${stateClass}`} role="status" aria-live="polite">
      <div className="je-modal__balance-totals">
        <span className="je-modal__balance-item">
          <span className="je-modal__balance-label">Débitos:</span>
          <span className="je-modal__balance-value je-modal__balance-debit">{debitStr}</span>
        </span>
        <span className="je-modal__balance-item">
          <span className="je-modal__balance-label">Créditos:</span>
          <span className="je-modal__balance-value je-modal__balance-credit">{creditStr}</span>
        </span>
      </div>
      <div className="je-modal__balance-status">
        {icon}
        <span>{message}</span>
      </div>
    </div>
  );
}

// ─── Account Combobox ─────────────────────────────────────────────────────────

interface AccountComboboxProps {
  value: string;
  search: string;
  lineIndex: number;
  onSearchChange: (val: string) => void;
  onSelect: (accountId: string, name: string) => void;
  disabled?: boolean;
}

function AccountCombobox({ value, search, lineIndex, onSearchChange, onSelect, disabled }: AccountComboboxProps) {
  const { data: accounts } = useChartOfAccounts();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = `je-account-${lineIndex}`;

  const analyticalAccounts = useMemo(
    () => accounts.filter((a) => !a.isSynthetic && a.allowManualEntry && a.isActive),
    [accounts],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return analyticalAccounts.slice(0, 20);
    const lower = search.toLowerCase();
    return analyticalAccounts
      .filter((a) => a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower))
      .slice(0, 20);
  }, [analyticalAccounts, search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedAccount = accounts.find((a) => a.id === value);
  const displayValue = value && selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : search;

  return (
    <div className="je-modal__combobox" ref={wrapperRef}>
      <input
        id={inputId}
        type="text"
        className="je-modal__combobox-input"
        value={displayValue}
        onChange={(e) => { onSearchChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar conta por código ou nome..."
        aria-label={`Conta linha ${lineIndex + 1}`}
        aria-autocomplete="list"
        aria-expanded={open}
        disabled={disabled}
      />
      {open && filtered.length > 0 && (
        <ul className="je-modal__combobox-list" role="listbox" aria-label="Contas disponíveis">
          {filtered.map((account) => (
            <li
              key={account.id}
              role="option"
              aria-selected={account.id === value}
              className={`je-modal__combobox-option ${account.id === value ? 'je-modal__combobox-option--selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(account.id, account.name);
                setOpen(false);
              }}
            >
              <span className="je-modal__combobox-code">{account.code}</span>
              <span className="je-modal__combobox-name">{account.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Line Row ─────────────────────────────────────────────────────────────────

interface LineRowProps {
  line: LineState;
  index: number;
  readOnly: boolean;
  onSideChange: (side: LedgerSide) => void;
  onAccountChange: (accountId: string, search: string) => void;
  onAmountChange: (amount: string) => void;
  onDescriptionChange: (desc: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function LineRow({
  line,
  index,
  readOnly,
  onSideChange,
  onAccountChange,
  onAmountChange,
  onDescriptionChange,
  onRemove,
  canRemove,
}: LineRowProps) {
  return (
    <tr className="je-modal__line-row">
      <td className="je-modal__line-td">
        <AccountCombobox
          value={line.accountId}
          search={line.accountSearch}
          lineIndex={index}
          onSearchChange={(s) => onAccountChange('', s)}
          onSelect={(id, name) => onAccountChange(id, name)}
          disabled={readOnly}
        />
      </td>
      <td className="je-modal__line-td je-modal__line-td--side">
        <div
          className="je-modal__side-toggle"
          role="group"
          aria-label={`Tipo linha ${index + 1}`}
        >
          <button
            type="button"
            className={`je-modal__side-btn je-modal__side-btn--debit ${line.side === 'DEBIT' ? 'je-modal__side-btn--active-debit' : ''}`}
            aria-pressed={line.side === 'DEBIT'}
            onClick={() => !readOnly && onSideChange('DEBIT')}
            disabled={readOnly}
          >
            D
          </button>
          <button
            type="button"
            className={`je-modal__side-btn je-modal__side-btn--credit ${line.side === 'CREDIT' ? 'je-modal__side-btn--active-credit' : ''}`}
            aria-pressed={line.side === 'CREDIT'}
            onClick={() => !readOnly && onSideChange('CREDIT')}
            disabled={readOnly}
          >
            C
          </button>
        </div>
      </td>
      <td className="je-modal__line-td je-modal__line-td--amount">
        <input
          type="text"
          className={`je-modal__amount-input ${line.side === 'DEBIT' ? 'je-modal__amount-input--debit' : 'je-modal__amount-input--credit'}`}
          value={line.amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          aria-label={`Valor linha ${index + 1}`}
          disabled={readOnly}
        />
      </td>
      <td className="je-modal__line-td je-modal__line-td--desc">
        <input
          type="text"
          className="je-modal__desc-input"
          value={line.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Descrição (opcional)"
          aria-label={`Descrição linha ${index + 1}`}
          disabled={readOnly}
        />
      </td>
      {!readOnly && (
        <td className="je-modal__line-td je-modal__line-td--remove">
          <button
            type="button"
            className="je-modal__remove-btn"
            aria-label="Remover linha"
            onClick={onRemove}
            disabled={!canRemove}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </td>
      )}
    </tr>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function JournalEntryModal({
  isOpen,
  entry,
  readOnly = false,
  orgId,
  onClose,
  onSuccess,
}: JournalEntryModalProps) {
  const { data: fiscalYears } = useFiscalYears();
  const { createDraft, updateDraft, postEntry, saveTemplate } = useJournalEntryActions();

  const [entryDate, setEntryDate] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineState[]>([newLine('DEBIT'), newLine('CREDIT')]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = 'je-modal-heading';

  // Flatten periods from all fiscal years
  const allPeriods = useMemo(() => fiscalYears.flatMap((fy) => fy.periods), [fiscalYears]);

  // Populate form when editing
  useEffect(() => {
    if (!isOpen) return;
    if (entry) {
      setEntryDate(entry.entryDate.slice(0, 10));
      setPeriodId(entry.periodId);
      setDescription(entry.description);
      if (entry.lines.length > 0) {
        setLines(
          entry.lines.map((l) => ({
            id: crypto.randomUUID(),
            accountId: l.accountId,
            accountSearch: `${l.account.code} — ${l.account.name}`,
            side: l.side,
            amount: parseFloat(l.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            description: l.description ?? '',
          })),
        );
      } else {
        setLines([newLine('DEBIT'), newLine('CREDIT')]);
      }
    } else {
      setEntryDate(new Date().toISOString().slice(0, 10));
      setPeriodId('');
      setDescription('');
      setLines([newLine('DEBIT'), newLine('CREDIT')]);
    }
    setFormError(null);
  }, [isOpen, entry]);

  // Auto-select period from entryDate
  useEffect(() => {
    if (!entryDate || readOnly) return;
    const [year, month] = entryDate.split('-').map(Number);
    const matchedPeriod = allPeriods.find((p) => p.year === year && p.month === month);
    if (matchedPeriod) setPeriodId(matchedPeriod.id);
  }, [entryDate, allPeriods, readOnly]);

  // Focus heading on open
  useEffect(() => {
    if (isOpen) setTimeout(() => headingRef.current?.focus(), 50);
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Balance check
  const debitTotal = lines.reduce((s, l) => l.side === 'DEBIT' ? s + parseAmount(l.amount) : s, 0);
  const creditTotal = lines.reduce((s, l) => l.side === 'CREDIT' ? s + parseAmount(l.amount) : s, 0);
  const isBalanced = Math.abs(debitTotal - creditTotal) < 0.005 && debitTotal > 0;

  const buildInput = useCallback(() => ({
    entryDate,
    periodId,
    description,
    lines: lines.map((l) => ({
      accountId: l.accountId,
      side: l.side,
      amount: parseAmount(l.amount).toFixed(2),
      description: l.description || undefined,
    } as CreateJournalEntryLineInput)).filter((l) => l.accountId && parseAmount(l.amount) > 0),
  }), [entryDate, periodId, description, lines]);

  const validateForm = () => {
    if (!entryDate) return 'Data é obrigatória';
    if (!periodId) return 'Período é obrigatório';
    if (!description.trim()) return 'Histórico é obrigatório';
    const validLines = lines.filter((l) => l.accountId && parseAmount(l.amount) > 0);
    if (validLines.length < 2) return 'Adicione pelo menos 2 linhas com conta e valor';
    if (!isBalanced) return 'O lançamento deve ser balanceado (débitos = créditos)';
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      if (entry?.id) {
        await updateDraft(entry.id, buildInput());
      } else {
        await createDraft(buildInput());
      }
      onSuccess('Rascunho salvo');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível salvar o rascunho.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePost = async () => {
    if (!entry?.id) {
      // Save draft first, then post
      const err = validateForm();
      if (err) { setFormError(err); return; }
      setIsPosting(true);
      setFormError(null);
      try {
        const draft = await createDraft(buildInput());
        await postEntry(draft.id);
        onSuccess(`Lançamento ${draft.entryNumber} postado com sucesso`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Não foi possível lançar.';
        setFormError(msg);
      } finally {
        setIsPosting(false);
        setShowPostConfirm(false);
      }
    } else {
      setIsPosting(true);
      setFormError(null);
      try {
        const posted = await postEntry(entry.id);
        onSuccess(`Lançamento ${posted.entryNumber} postado com sucesso`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Não foi possível lançar.';
        setFormError(msg);
      } finally {
        setIsPosting(false);
        setShowPostConfirm(false);
      }
    }
  };

  const handleSaveTemplate = async (name: string) => {
    try {
      await saveTemplate({
        name,
        description,
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({ accountId: l.accountId, side: l.side, amount: parseAmount(l.amount).toFixed(2) })),
      });
      setShowTemplateModal(false);
    } catch {
      // error handled in template modal
    }
  };

  const handleLoadTemplate = (templateLines: CreateJournalEntryLineInput[], _desc: string) => {
    setLines(
      templateLines.map((l) => ({
        id: crypto.randomUUID(),
        accountId: l.accountId,
        accountSearch: '',
        side: l.side,
        amount: parseFloat(l.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        description: l.description ?? '',
      })),
    );
    setShowTemplateModal(false);
  };

  const updateLine = (index: number, patch: Partial<LineState>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => {
      const lastSide = prev[prev.length - 1]?.side ?? 'DEBIT';
      const nextSide: LedgerSide = lastSide === 'DEBIT' ? 'CREDIT' : 'DEBIT';
      return [...prev, newLine(nextSide)];
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const heading = readOnly ? 'Lançamento' : entry ? 'Editar Rascunho' : 'Novo Lançamento';
  const entryStatus = entry?.status ?? null;

  return (
    <>
      <div
        className="je-modal__overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="je-modal">
          {/* Header */}
          <div className="je-modal__header">
            <h2 id={headingId} className="je-modal__heading" ref={headingRef} tabIndex={-1}>
              {heading}
              {entry?.entryNumber ? ` #${entry.entryNumber}` : ''}
            </h2>
            <button
              type="button"
              className="je-modal__close"
              aria-label="Fechar modal"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="je-modal__body">
            {/* Header fields */}
            <div className="je-modal__fields-row">
              <div className="je-modal__field">
                <label htmlFor="je-entry-date" className="je-modal__label">
                  Data <span aria-hidden="true">*</span>
                </label>
                <input
                  id="je-entry-date"
                  type="date"
                  className="je-modal__input"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                  aria-required="true"
                  disabled={readOnly}
                />
              </div>
              <div className="je-modal__field">
                <label htmlFor="je-period" className="je-modal__label">
                  Período <span aria-hidden="true">*</span>
                </label>
                <select
                  id="je-period"
                  className="je-modal__input je-modal__select"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  required
                  aria-required="true"
                  disabled={readOnly}
                >
                  <option value="">Selecionar período...</option>
                  {allPeriods.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.status !== 'OPEN'}>
                      {String(p.month).padStart(2, '0')}/{p.year}
                      {p.status !== 'OPEN' ? ` (${p.status === 'CLOSED' ? 'fechado' : 'bloqueado'})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="je-modal__field">
              <label htmlFor="je-description" className="je-modal__label">
                Histórico <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="je-description"
                className="je-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Histórico do lançamento..."
                required
                aria-required="true"
                disabled={readOnly}
              />
              {!readOnly && (
                <span className="je-modal__char-count">{description.length}/500</span>
              )}
            </div>

            {/* Line table */}
            <div className="je-modal__lines-section">
              <div className="je-modal__lines-header">
                <span className="je-modal__lines-title">Partidas</span>
                {!readOnly && (
                  <button
                    type="button"
                    className="je-modal__template-btn"
                    onClick={() => setShowTemplateModal(true)}
                    title="Gerenciar modelos"
                  >
                    <Save size={14} aria-hidden="true" /> Modelos
                  </button>
                )}
              </div>

              <div className="je-modal__table-wrapper">
                <table className="je-modal__table">
                  <caption className="sr-only">Partidas do lançamento contábil</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="je-modal__th">CONTA</th>
                      <th scope="col" className="je-modal__th je-modal__th--side">TIPO</th>
                      <th scope="col" className="je-modal__th je-modal__th--amount">VALOR</th>
                      <th scope="col" className="je-modal__th je-modal__th--desc">DESCRIÇÃO</th>
                      {!readOnly && <th scope="col" className="je-modal__th je-modal__th--remove"><span className="sr-only">Remover</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <LineRow
                        key={line.id}
                        line={line}
                        index={index}
                        readOnly={readOnly}
                        onSideChange={(side) => updateLine(index, { side })}
                        onAccountChange={(accountId, search) => updateLine(index, { accountId, accountSearch: search })}
                        onAmountChange={(amount) => updateLine(index, { amount })}
                        onDescriptionChange={(desc) => updateLine(index, { description: desc })}
                        onRemove={() => removeLine(index)}
                        canRemove={lines.length > 2}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  className="je-modal__add-line-btn"
                  onClick={addLine}
                >
                  <Plus size={16} aria-hidden="true" />
                  Adicionar linha
                </button>
              )}
            </div>

            {/* Error */}
            {formError && (
              <div className="je-modal__error" role="alert">
                {formError}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="je-modal__footer">
            <BalanceIndicator lines={lines} />

            {!readOnly && (
              <div className="je-modal__footer-actions">
                <button
                  type="button"
                  className="je-modal__btn je-modal__btn--secondary"
                  onClick={() => { void handleSaveDraft(); }}
                  disabled={isSaving || isPosting}
                >
                  {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
                </button>
                {(entryStatus === 'DRAFT' || !entry) && (
                  <button
                    type="button"
                    className="je-modal__btn je-modal__btn--primary"
                    onClick={() => setShowPostConfirm(true)}
                    disabled={!isBalanced || isPosting || isSaving}
                    title={!isBalanced ? 'O lançamento precisa estar balanceado para ser lançado' : undefined}
                  >
                    {isPosting ? 'Lançando...' : 'Lançar'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post confirmation */}
      <ConfirmModal
        isOpen={showPostConfirm}
        title="Confirmar lançamento?"
        message="Após lançado, não será possível editar."
        confirmLabel="Confirmar Lançamento"
        variant="warning"
        isLoading={isPosting}
        onConfirm={() => { void handlePost(); }}
        onCancel={() => setShowPostConfirm(false)}
      />

      {/* Template modal */}
      {showTemplateModal && (
        <JournalEntryTemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onLoad={handleLoadTemplate}
          onSave={handleSaveTemplate}
          currentLines={lines.filter((l) => l.accountId).map((l) => ({
            accountId: l.accountId,
            side: l.side,
            amount: parseAmount(l.amount).toFixed(2),
            description: l.description || undefined,
          }))}
          currentDescription={description}
          orgId={orgId}
        />
      )}
    </>
  );
}
