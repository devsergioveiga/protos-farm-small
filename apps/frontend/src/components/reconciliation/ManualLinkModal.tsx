import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X, Link2, AlertCircle, Search } from 'lucide-react';
import { useReconciliationActions } from '@/hooks/useReconciliation';
import type {
  StatementLineWithMatches,
  MatchCandidate,
  ManualLinkItem,
} from '@/hooks/useReconciliation';
import './ReconciliationModal.css';

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const TYPE_LABELS: Record<string, string> = {
  PAYABLE: 'CP',
  RECEIVABLE: 'CR',
  TRANSFER: 'Transferência',
};

// ─── Props ────────────────────────────────────────────────────────

interface ManualLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  statementLine: StatementLineWithMatches;
  importId: string;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────

const ManualLinkModal = ({
  isOpen,
  onClose,
  statementLine,
  importId,
  onSuccess,
}: ManualLinkModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { searchCandidates, manualLink } = useReconciliationActions();

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Load all candidates on mount
  useEffect(() => {
    if (!isOpen) return;
    const loadInitial = async () => {
      setIsSearching(true);
      try {
        const results = await searchCandidates(importId, '', statementLine.importId);
        setCandidates(results);
      } catch {
        setCandidates([]);
      } finally {
        setIsSearching(false);
      }
    };
    void loadInitial();
  }, [isOpen, importId, statementLine.importId, searchCandidates]);

  // Debounced search
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setSearchQuery(q);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchCandidates(importId, q, statementLine.importId);
          setCandidates(results);
        } catch {
          setCandidates([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [importId, statementLine.importId, searchCandidates],
  );

  const toggleSelect = useCallback((candidateId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }, []);

  // Running sum of selected candidates
  const selectedSum = useMemo(() => {
    return candidates.filter((c) => selectedIds.has(c.id)).reduce((sum, c) => sum + c.amount, 0);
  }, [candidates, selectedIds]);

  // Floating-point safe comparison
  const sumMatches = Math.abs(selectedSum - Math.abs(statementLine.amount)) < 0.01;

  const handleSubmit = useCallback(async () => {
    if (selectedIds.size === 0 || !sumMatches) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const links: ManualLinkItem[] = candidates
        .filter((c) => selectedIds.has(c.id))
        .map((c) => ({ id: c.id, type: c.type }));

      await manualLink(importId, statementLine.id, links);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar vínculo';
      setSubmitError(`Não foi possível criar o vínculo. ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, sumMatches, candidates, manualLink, importId, statementLine.id, onSuccess]);

  if (!isOpen) return null;

  const selectedItems = candidates.filter((c) => selectedIds.has(c.id));
  const hasMismatch = selectedIds.size > 0 && !sumMatches;

  return (
    <div
      className="recon-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Vincular lançamento manualmente"
    >
      <div className="recon-modal__panel">
        {/* Header */}
        <header className="recon-modal__header">
          <div className="recon-modal__header-icon" aria-hidden="true">
            <Link2 size={20} />
          </div>
          <h2 className="recon-modal__title">Vincular manualmente</h2>
          <button
            type="button"
            className="recon-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="recon-modal__body">
          {/* Statement line info */}
          <div className="manual-link__line-info">
            <div className="manual-link__line-row">
              <span className="manual-link__line-label">Data</span>
              <span className="manual-link__line-value recon-modal__col-mono">
                {formatDate(statementLine.date)}
              </span>
            </div>
            <div className="manual-link__line-row">
              <span className="manual-link__line-label">Valor</span>
              <span className="manual-link__line-value recon-modal__col-mono">
                {formatBRL(statementLine.amount)}
              </span>
            </div>
            <div className="manual-link__line-row">
              <span className="manual-link__line-label">Descrição</span>
              <span className="manual-link__line-value">{statementLine.memo}</span>
            </div>
          </div>

          {/* Search input */}
          <div className="manual-link__search-wrap">
            <label htmlFor="manual-link-search" className="recon-modal__mapping-label">
              Buscar lançamento para vincular
            </label>
            <div className="manual-link__search-input-wrap">
              <Search size={16} aria-hidden="true" className="manual-link__search-icon" />
              <input
                id="manual-link-search"
                ref={searchInputRef}
                type="search"
                className="manual-link__search-input"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscar por descrição, valor ou data..."
              />
            </div>
          </div>

          {/* Results */}
          <div className="manual-link__results-wrap">
            {isSearching ? (
              <div className="manual-link__skeleton" aria-busy="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="manual-link__skeleton-row">
                    <div className="recon-skeleton-cell" style={{ width: '10%' }} />
                    <div className="recon-skeleton-cell" style={{ width: '30%' }} />
                    <div className="recon-skeleton-cell" style={{ width: '40%' }} />
                    <div className="recon-skeleton-cell" style={{ width: '20%' }} />
                  </div>
                ))}
              </div>
            ) : (
              <table className="manual-link__results-table">
                <caption className="sr-only">
                  Lançamentos disponíveis para vincular ao extrato
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Selecionar</span>
                    </th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Data</th>
                    <th scope="col" className="recon-modal__col-right">
                      Valor
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="manual-link__empty">
                        Nenhum lançamento encontrado.
                      </td>
                    </tr>
                  )}
                  {candidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={selectedIds.has(candidate.id) ? 'manual-link__row--selected' : ''}
                      onClick={() => toggleSelect(candidate.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(candidate.id)}
                          onChange={() => toggleSelect(candidate.id)}
                          aria-label={`Selecionar ${candidate.description}`}
                          className="recon-modal__checkbox"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <span
                          className={`recon-modal__type-badge recon-modal__type-badge--${candidate.type === 'RECEIVABLE' ? 'credit' : 'debit'}`}
                        >
                          {TYPE_LABELS[candidate.type] ?? candidate.type}
                        </span>
                      </td>
                      <td className="manual-link__candidate-desc">{candidate.description}</td>
                      <td className="recon-modal__col-mono">{formatDate(candidate.date)}</td>
                      <td className="recon-modal__col-right recon-modal__col-mono">
                        {formatBRL(candidate.amount)}
                      </td>
                      <td>
                        <span className="manual-link__status">{candidate.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Running sum */}
          {selectedIds.size > 0 && (
            <div className="manual-link__sum-area">
              <div className="manual-link__sum-row">
                <span className="manual-link__sum-label">Soma selecionada:</span>
                <span className="manual-link__sum-value recon-modal__col-mono">
                  {formatBRL(selectedSum)}
                </span>
              </div>
              <div className="manual-link__sum-row">
                <span className="manual-link__sum-label">Valor do extrato:</span>
                <span className="manual-link__sum-value recon-modal__col-mono">
                  {formatBRL(Math.abs(statementLine.amount))}
                </span>
              </div>

              {hasMismatch && (
                <div className="manual-link__sum-error" role="alert" aria-live="polite">
                  <AlertCircle size={16} aria-hidden="true" />
                  Soma selecionada ({formatBRL(selectedSum)}) não coincide com o valor do extrato (
                  {formatBRL(Math.abs(statementLine.amount))}).
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="recon-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="recon-modal__footer">
          <button type="button" className="recon-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="recon-modal__btn-submit"
            disabled={selectedIds.size === 0 || !sumMatches || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting
              ? 'Vinculando...'
              : `Vincular ${selectedItems.length > 0 ? `${selectedItems.length} ` : ''}selecionado${selectedItems.length !== 1 ? 's' : ''}`}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ManualLinkModal;
