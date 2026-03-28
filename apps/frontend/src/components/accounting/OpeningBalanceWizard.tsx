import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import { useOpeningBalancePreview, usePostOpeningBalance } from '@/hooks/useOpeningBalance';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import type { OpeningBalanceLinePreview, LedgerSide } from '@/types/journal-entries';
import './OpeningBalanceWizard.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpeningBalanceWizardProps {
  isOpen: boolean;
  orgId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface EditableLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  side: LedgerSide;
  amount: string;
  source: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(str: string): number {
  const normalized = str.replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function previewToEditable(lines: OpeningBalanceLinePreview[]): EditableLine[] {
  return lines.map((l) => ({
    id: crypto.randomUUID(),
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    side: l.side,
    amount: parseFloat(l.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    source: l.source,
  }));
}

// ─── Step 1: Review Lines ─────────────────────────────────────────────────────

interface Step1Props {
  lines: EditableLine[];
  isLoading: boolean;
  onLinesChange: (lines: EditableLine[]) => void;
  onNext: () => void;
}

function Step1({ lines, isLoading, onLinesChange, onNext }: Step1Props) {
  const { data: accounts } = useChartOfAccounts();
  const analyticalAccounts = useMemo(
    () => accounts.filter((a) => !a.isSynthetic && a.allowManualEntry && a.isActive),
    [accounts],
  );

  const updateLine = (id: string, patch: Partial<EditableLine>) => {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => {
    onLinesChange(lines.filter((l) => l.id !== id));
  };

  const addLine = () => {
    onLinesChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        accountId: '',
        accountCode: '',
        accountName: '',
        side: 'DEBIT' as LedgerSide,
        amount: '',
        source: 'manual',
      },
    ]);
  };

  if (isLoading) {
    return (
      <div className="ob-wizard__table-wrapper" aria-label="Carregando saldos..." aria-busy="true">
        <table className="ob-wizard__table">
          <caption className="sr-only">Saldos pré-populados para revisão</caption>
          <thead>
            <tr>
              <th scope="col" className="ob-wizard__th">CONTA</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--side">TIPO</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--amount">VALOR</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--source">ORIGEM</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--remove"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} aria-hidden="true">
                {Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="ob-wizard__td">
                    <div className="ob-wizard__skeleton-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="ob-wizard__empty">
        <AlertTriangle size={48} aria-hidden="true" className="ob-wizard__empty-icon" />
        <p className="ob-wizard__empty-text">
          Nenhum saldo encontrado nos módulos integrados. Adicione linhas manualmente.
        </p>
        <button type="button" className="ob-wizard__btn ob-wizard__btn--secondary" onClick={addLine}>
          <Plus size={16} aria-hidden="true" /> Adicionar linha
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="ob-wizard__table-wrapper">
        <table className="ob-wizard__table">
          <caption className="sr-only">Saldos pré-populados para revisão</caption>
          <thead>
            <tr>
              <th scope="col" className="ob-wizard__th">CONTA</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--side">TIPO</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--amount">VALOR</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--source">ORIGEM</th>
              <th scope="col" className="ob-wizard__th ob-wizard__th--remove"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id} className="ob-wizard__line-row">
                <td className="ob-wizard__td">
                  {line.accountId ? (
                    <span className="ob-wizard__account-display">
                      <span className="ob-wizard__mono">{line.accountCode}</span>
                      <span>{line.accountName}</span>
                    </span>
                  ) : (
                    <select
                      className="ob-wizard__account-select"
                      value={line.accountId}
                      onChange={(e) => {
                        const acc = analyticalAccounts.find((a) => a.id === e.target.value);
                        if (acc) {
                          updateLine(line.id, { accountId: acc.id, accountCode: acc.code, accountName: acc.name });
                        }
                      }}
                      aria-label={`Conta linha ${index + 1}`}
                    >
                      <option value="">Selecionar conta...</option>
                      {analyticalAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="ob-wizard__td ob-wizard__td--side">
                  <div className="ob-wizard__side-toggle" role="group" aria-label={`Tipo linha ${index + 1}`}>
                    <button
                      type="button"
                      className={`ob-wizard__side-btn ${line.side === 'DEBIT' ? 'ob-wizard__side-btn--active-debit' : ''}`}
                      aria-pressed={line.side === 'DEBIT'}
                      onClick={() => updateLine(line.id, { side: 'DEBIT' })}
                    >D</button>
                    <button
                      type="button"
                      className={`ob-wizard__side-btn ${line.side === 'CREDIT' ? 'ob-wizard__side-btn--active-credit' : ''}`}
                      aria-pressed={line.side === 'CREDIT'}
                      onClick={() => updateLine(line.id, { side: 'CREDIT' })}
                    >C</button>
                  </div>
                </td>
                <td className="ob-wizard__td ob-wizard__td--amount">
                  <input
                    type="text"
                    className={`ob-wizard__amount-input ${line.side === 'DEBIT' ? 'ob-wizard__amount-input--debit' : 'ob-wizard__amount-input--credit'}`}
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                    placeholder="0,00"
                    inputMode="decimal"
                    aria-label={`Valor linha ${index + 1}`}
                  />
                </td>
                <td className="ob-wizard__td ob-wizard__td--source">
                  <span className="ob-wizard__source-pill">{line.source}</span>
                </td>
                <td className="ob-wizard__td ob-wizard__td--remove">
                  <button
                    type="button"
                    className="ob-wizard__remove-btn"
                    aria-label="Remover linha"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="ob-wizard__add-btn" onClick={addLine}>
        <Plus size={16} aria-hidden="true" /> Adicionar linha
      </button>
      <div className="ob-wizard__step1-footer">
        <button
          type="button"
          className="ob-wizard__btn ob-wizard__btn--primary"
          onClick={onNext}
          disabled={lines.length === 0}
        >
          Próximo
        </button>
      </div>
    </>
  );
}

// ─── Step 2: Contra-entry Summary ─────────────────────────────────────────────

interface Step2Props {
  lines: EditableLine[];
  fiscalYearId: string;
  entryDate: string;
  isPosting: boolean;
  error: string | null;
  onBack: () => void;
  onPost: () => void;
}

function Step2({ lines, isPosting, error, onBack, onPost }: Step2Props) {
  const debitTotal = lines.reduce((s, l) => l.side === 'DEBIT' ? s + parseAmount(l.amount) : s, 0);
  const creditTotal = lines.reduce((s, l) => l.side === 'CREDIT' ? s + parseAmount(l.amount) : s, 0);
  const netDiff = debitTotal - creditTotal;
  const netAbs = Math.abs(netDiff);
  const netSide: LedgerSide = netDiff >= 0 ? 'CREDIT' : 'DEBIT';

  return (
    <div className="ob-wizard__step2">
      <div className="ob-wizard__step2-summary">
        <h3 className="ob-wizard__step2-heading">Resumo das partidas</h3>
        <div className="ob-wizard__step2-totals">
          <div className="ob-wizard__step2-total-row">
            <span className="ob-wizard__step2-total-label">Total débitos</span>
            <span className="ob-wizard__mono ob-wizard__debit-color">{formatCurrency(debitTotal)}</span>
          </div>
          <div className="ob-wizard__step2-total-row">
            <span className="ob-wizard__step2-total-label">Total créditos</span>
            <span className="ob-wizard__mono ob-wizard__credit-color">{formatCurrency(creditTotal)}</span>
          </div>
        </div>
      </div>

      <div className="ob-wizard__contra-entry">
        <h3 className="ob-wizard__step2-heading">Conta de contrapartida</h3>
        <p className="ob-wizard__contra-desc">
          O saldo líquido de <strong className="ob-wizard__mono">{formatCurrency(netAbs)}</strong> será lançado
          como <strong>{netSide === 'DEBIT' ? 'débito' : 'crédito'}</strong> contra a conta{' '}
          <strong>Lucros e Prejuízos Acumulados</strong>.
        </p>
        {netAbs < 0.005 && (
          <p className="ob-wizard__balanced-note">
            O saldo está equilibrado — nenhuma contrapartida será necessária.
          </p>
        )}
      </div>

      {error && (
        <div className="ob-wizard__error" role="alert">
          {error}
        </div>
      )}

      <div className="ob-wizard__step2-actions">
        <button type="button" className="ob-wizard__btn ob-wizard__btn--secondary" onClick={onBack} disabled={isPosting}>
          Voltar
        </button>
        <button
          type="button"
          className="ob-wizard__btn ob-wizard__btn--primary"
          onClick={onPost}
          disabled={isPosting}
        >
          {isPosting ? 'Postando...' : 'Postar Saldo de Abertura'}
        </button>
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function OpeningBalanceWizard({ isOpen, onClose, onSuccess }: OpeningBalanceWizardProps) {
  const { data: fiscalYears } = useFiscalYears();
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [step, setStep] = useState<1 | 2>(1);
  const [editableLines, setEditableLines] = useState<EditableLine[]>([]);
  const [postError, setPostError] = useState<string | null>(null);

  const { lines: previewLines, isLoading: previewLoading } = useOpeningBalancePreview(
    selectedFiscalYearId || null,
  );
  const { postOpeningBalance, isLoading: isPosting } = usePostOpeningBalance();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = 'ob-wizard-heading';

  const activeFiscalYears = fiscalYears.filter((fy) => fy.isActive);

  // Initialize with first active fiscal year
  useEffect(() => {
    if (activeFiscalYears.length > 0 && !selectedFiscalYearId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedFiscalYearId(activeFiscalYears[0].id);
    }
  }, [activeFiscalYears, selectedFiscalYearId]);

  // Load preview lines when fiscal year changes (only on step 1 to preserve edits)
  useEffect(() => {
    if (step === 1 && previewLines.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditableLines(previewToEditable(previewLines));
    }
  }, [previewLines, step]);

  // Focus heading on open
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setPostError(null);
      setTimeout(() => headingRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handlePost = async () => {
    setPostError(null);
    try {
      await postOpeningBalance({
        fiscalYearId: selectedFiscalYearId,
        entryDate,
        lines: editableLines
          .filter((l) => l.accountId && parseAmount(l.amount) > 0)
          .map((l) => ({
            accountId: l.accountId,
            side: l.side,
            amount: parseAmount(l.amount).toFixed(2),
          })),
      });
      onSuccess('Saldo de abertura postado com sucesso');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível postar o saldo de abertura.';
      if (msg.toLowerCase().includes('já existe') || msg.toLowerCase().includes('already exists')) {
        setPostError('Já existe um saldo de abertura para este exercício fiscal. Apenas um saldo de abertura é permitido por exercício.');
      } else {
        setPostError(msg);
      }
    }
  };

  if (!isOpen) return null;

  const stepLabel = step === 1 ? 'Etapa 1 de 2 — Revisão' : 'Etapa 2 de 2 — Contrapartida';
  const stepDescription = step === 1
    ? 'Revisão dos saldos pré-populados'
    : 'Conta de contrapartida';

  return (
    <div
      className="ob-wizard__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ob-wizard">
        {/* Header */}
        <div className="ob-wizard__header">
          <div className="ob-wizard__header-top">
            <div>
              <div className="ob-wizard__step-indicator" aria-label={stepLabel}>
                {stepLabel}
              </div>
              <h2 id={headingId} className="ob-wizard__heading" ref={headingRef} tabIndex={-1}>
                Saldo de Abertura — {stepDescription}
              </h2>
            </div>
            <button
              type="button"
              className="ob-wizard__close"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {step === 1 && (
            <div className="ob-wizard__header-controls">
              <div className="ob-wizard__control-group">
                <label htmlFor="ob-fiscal-year" className="ob-wizard__control-label">Exercício Fiscal</label>
                <select
                  id="ob-fiscal-year"
                  className="ob-wizard__control-select"
                  value={selectedFiscalYearId}
                  onChange={(e) => setSelectedFiscalYearId(e.target.value)}
                >
                  {fiscalYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      {fy.name} {fy.isActive ? '(ativo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ob-wizard__control-group">
                <label htmlFor="ob-entry-date" className="ob-wizard__control-label">Data do Lançamento</label>
                <input
                  id="ob-entry-date"
                  type="date"
                  className="ob-wizard__control-input"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Step description */}
        {step === 1 && (
          <p className="ob-wizard__step-desc">
            Os valores abaixo foram obtidos automaticamente dos módulos financeiro, contas a pagar/receber, ativos e provisões trabalhistas. Revise e ajuste se necessário.
          </p>
        )}

        {/* Body */}
        <div className="ob-wizard__body">
          <div className={`ob-wizard__step-panel ${step === 1 ? 'ob-wizard__step-panel--active' : ''}`} aria-hidden={step !== 1}>
            {step === 1 && (
              <Step1
                lines={editableLines}
                isLoading={previewLoading}
                onLinesChange={setEditableLines}
                onNext={() => setStep(2)}
              />
            )}
          </div>
          <div className={`ob-wizard__step-panel ${step === 2 ? 'ob-wizard__step-panel--active' : ''}`} aria-hidden={step !== 2}>
            {step === 2 && (
              <Step2
                lines={editableLines}
                fiscalYearId={selectedFiscalYearId}
                entryDate={entryDate}
                isPosting={isPosting}
                error={postError}
                onBack={() => setStep(1)}
                onPost={() => { void handlePost(); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
