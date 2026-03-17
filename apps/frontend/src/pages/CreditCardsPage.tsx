import { useState, useCallback, useEffect } from 'react';
import { Plus, AlertCircle, CreditCard, Pencil, Trash2, X } from 'lucide-react';
import { useCreditCards } from '@/hooks/useCreditCards';
import type { CreditCardOutput, BillOutput } from '@/hooks/useCreditCards';
import CreditCardModal from '@/components/credit-cards/CreditCardModal';
import CreditCardExpenseModal from '@/components/credit-cards/CreditCardExpenseModal';
import CloseBillModal from '@/components/credit-cards/CloseBillModal';
import type { AddExpenseInput } from '@/hooks/useCreditCards';
import './CreditCardsPage.css';

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function getBillTabLabel(bill: BillOutput, idx: number): string {
  if (idx === 0) return 'Fatura atual';
  const [y, m] = bill.periodStart.split('T')[0].split('-');
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  return `Fatura ${monthNames[parseInt(m) - 1]}/${y}`;
}

const BRAND_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'American Express',
  HIPERCARD: 'Hipercard',
  OTHER: 'Outro',
};

// ─── Skeleton ─────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="cc-page__card-skeleton" aria-hidden="true">
      <div className="cc-page__skeleton-line cc-page__skeleton-line--wide" />
      <div className="cc-page__skeleton-line cc-page__skeleton-line--medium" />
      <div className="cc-page__skeleton-line cc-page__skeleton-line--narrow" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function CreditCardsPage() {
  const {
    cards,
    selectedCard,
    loading,
    error,
    detailLoading,
    fetchCards,
    fetchCard,
    addExpense,
    closeBill,
    deleteCard,
  } = useCreditCards();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeBillIdx, setActiveBillIdx] = useState(0);

  // Modal state
  const [showCardModal, setShowCardModal] = useState(false);
  const [editCardId, setEditCardId] = useState<string | undefined>(undefined);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCloseBillModal, setShowCloseBillModal] = useState(false);
  const [closingBill, setClosingBill] = useState<BillOutput | null>(null);
  const [isBillClosing, setIsBillClosing] = useState(false);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Select card and load detail
  const handleSelectCard = useCallback(
    async (card: CreditCardOutput) => {
      if (selectedCardId === card.id) return;
      setSelectedCardId(card.id);
      setActiveBillIdx(0);
      await fetchCard(card.id);
    },
    [selectedCardId, fetchCard],
  );

  // Auto-select first card on load
  useEffect(() => {
    if (!loading && cards.length > 0 && !selectedCardId) {
      void handleSelectCard(cards[0]);
    }
  }, [loading, cards, selectedCardId, handleSelectCard]);

  const handleCardModalSuccess = useCallback(() => {
    setShowCardModal(false);
    setEditCardId(undefined);
    void fetchCards();
    showToast('Cartão cadastrado com sucesso');
  }, [fetchCards, showToast]);

  const handleEditCard = useCallback((cardId: string) => {
    setEditCardId(cardId);
    setShowCardModal(true);
  }, []);

  const handleExpenseSuccess = useCallback(
    async (input: AddExpenseInput) => {
      if (!selectedCardId) return;
      await addExpense(selectedCardId, input);
      setShowExpenseModal(false);
      await fetchCard(selectedCardId);
      showToast('Gasto registrado com sucesso');
    },
    [selectedCardId, addExpense, fetchCard, showToast],
  );

  const handleOpenCloseBill = useCallback((bill: BillOutput) => {
    setClosingBill(bill);
    setShowCloseBillModal(true);
  }, []);

  const handleCloseBillSuccess = useCallback(
    async (billId: string) => {
      setIsBillClosing(true);
      try {
        await closeBill(billId);
        setShowCloseBillModal(false);
        setClosingBill(null);
        if (selectedCardId) {
          await fetchCard(selectedCardId);
          await fetchCards();
        }
        showToast('Fatura fechada. Conta a pagar gerada com sucesso.');
      } catch {
        showToast('Não foi possível fechar a fatura. Tente novamente.');
      } finally {
        setIsBillClosing(false);
      }
    },
    [closeBill, selectedCardId, fetchCard, fetchCards, showToast],
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (deleteConfirmInput !== deleteConfirmName) return;
      setIsDeleting(true);
      try {
        await deleteCard(cardId);
        setDeleteConfirmId(null);
        setDeleteConfirmInput('');
        if (selectedCardId === cardId) {
          setSelectedCardId(null);
        }
        await fetchCards();
        showToast('Cartão excluído com sucesso');
      } catch {
        showToast('Não foi possível excluir o cartão. Tente novamente.');
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteConfirmInput, deleteConfirmName, deleteCard, selectedCardId, fetchCards, showToast],
  );

  // Compute bills for selected card (max 3: current + last 2)
  const bills = selectedCard?.bills?.slice(0, 3) ?? [];
  const activeBill = bills[activeBillIdx] ?? null;

  // Usage bar percent
  const getUsagePercent = (card: CreditCardOutput): number => {
    if (!card.currentBill || card.creditLimit <= 0) return 0;
    return Math.min(100, (card.currentBill.totalAmount / card.creditLimit) * 100);
  };

  return (
    <main className="cc-page">
      {/* ── Toast ── */}
      {toast && (
        <div className="cc-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className="cc-page__header">
        <div>
          <h1 className="cc-page__title">Cartões</h1>
          <p className="cc-page__subtitle">Gerencie cartões corporativos e faturas</p>
        </div>
        <button
          type="button"
          className="cc-page__btn-primary"
          onClick={() => {
            setEditCardId(undefined);
            setShowCardModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Novo Cartão
        </button>
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="cc-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── Body ── */}
      {loading ? (
        <div className="cc-page__two-panel">
          <div className="cc-page__card-list">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : cards.length === 0 ? (
        /* ── Empty state ── */
        <div className="cc-page__empty">
          <CreditCard size={56} className="cc-page__empty-icon" aria-hidden="true" />
          <h2 className="cc-page__empty-title">Nenhum cartão cadastrado</h2>
          <p className="cc-page__empty-desc">
            Cadastre um cartão corporativo para controlar despesas e gerar faturas automaticamente.
          </p>
          <button
            type="button"
            className="cc-page__btn-primary"
            onClick={() => {
              setEditCardId(undefined);
              setShowCardModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Novo Cartão
          </button>
        </div>
      ) : (
        /* ── Two-panel layout ── */
        <div className="cc-page__two-panel">
          {/* ─ Left: Card list ─ */}
          <section className="cc-page__card-list" aria-label="Lista de cartões">
            {cards.map((card) => {
              const usagePct = getUsagePercent(card);
              const isActive = selectedCardId === card.id;
              const hasOpenBill = card.currentBill?.status === 'OPEN';

              return (
                <article
                  key={card.id}
                  className={`cc-page__card-item${isActive ? ' cc-page__card-item--active' : ''}`}
                  onClick={() => void handleSelectCard(card)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleSelectCard(card);
                    }
                  }}
                  aria-pressed={isActive}
                  aria-label={`${card.name} — ${BRAND_LABELS[card.brand] ?? card.brand}, ${formatBRL(card.creditLimit)}`}
                >
                  <div className="cc-page__card-item-top">
                    <div className="cc-page__card-item-info">
                      <span className="cc-page__card-name">{card.name}</span>
                      <span className="cc-page__card-brand">
                        {BRAND_LABELS[card.brand] ?? card.brand}
                        {card.lastFourDigits ? ` •••• ${card.lastFourDigits}` : ''}
                      </span>
                    </div>
                    {hasOpenBill && (
                      <span className="cc-page__badge-open" aria-label="Fatura aberta">
                        Aberta
                      </span>
                    )}
                  </div>

                  <div className="cc-page__card-limit">
                    <span
                      className="cc-page__card-limit-value"
                      aria-label={`Limite: ${formatBRL(card.creditLimit)} reais`}
                    >
                      {formatBRL(card.creditLimit)}
                    </span>
                    <span className="cc-page__card-limit-label">Limite</span>
                  </div>

                  <div className="cc-page__card-days">
                    <span>Fecha todo dia {card.closingDay}</span>
                    <span>Vence todo dia {card.dueDay}</span>
                  </div>

                  {card.currentBill && usagePct > 0 && (
                    <div
                      className="cc-page__usage-bar-wrap"
                      aria-label={`Uso: ${usagePct.toFixed(0)}% do limite`}
                    >
                      <div className="cc-page__usage-bar-track">
                        <div
                          className="cc-page__usage-bar-fill"
                          style={{ width: `${usagePct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="cc-page__usage-label">
                        {formatBRL(card.currentBill.totalAmount)} de {formatBRL(card.creditLimit)}
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          {/* ─ Right: Card detail ─ */}
          <section className="cc-page__detail" aria-label="Detalhe do cartão">
            {!selectedCardId ? (
              <div className="cc-page__detail-placeholder">
                <CreditCard size={40} aria-hidden="true" />
                <p>Selecione um cartão para ver os detalhes</p>
              </div>
            ) : detailLoading ? (
              <div className="cc-page__detail-loading" aria-label="Carregando detalhes...">
                <div className="cc-page__skeleton-line cc-page__skeleton-line--wide" />
                <div className="cc-page__skeleton-line cc-page__skeleton-line--medium" />
                <div className="cc-page__skeleton-line cc-page__skeleton-line--narrow" />
              </div>
            ) : selectedCard ? (
              <>
                {/* ─ Card info header ─ */}
                <div className="cc-page__detail-header">
                  <div className="cc-page__detail-card-info">
                    <h2 className="cc-page__detail-card-name">{selectedCard.name}</h2>
                    <span className="cc-page__detail-card-meta">
                      {BRAND_LABELS[selectedCard.brand] ?? selectedCard.brand}
                      {selectedCard.lastFourDigits
                        ? ` •••• ${selectedCard.lastFourDigits}`
                        : ''} — {selectedCard.holder}
                    </span>
                    <span className="cc-page__detail-card-meta">
                      Limite:{' '}
                      <strong
                        className="cc-page__detail-mono"
                        aria-label={`${formatBRL(selectedCard.creditLimit)} reais`}
                      >
                        {formatBRL(selectedCard.creditLimit)}
                      </strong>{' '}
                      — Débito: {selectedCard.debitAccountName}
                    </span>
                  </div>
                  <div className="cc-page__detail-card-actions">
                    <button
                      type="button"
                      className="cc-page__btn-icon"
                      onClick={() => handleEditCard(selectedCard.id)}
                      aria-label={`Editar cartão ${selectedCard.name}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="cc-page__btn-icon cc-page__btn-icon--danger"
                      onClick={() => {
                        setDeleteConfirmId(selectedCard.id);
                        setDeleteConfirmName(selectedCard.name);
                        setDeleteConfirmInput('');
                      }}
                      aria-label={`Excluir cartão ${selectedCard.name}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* ─ Bill tabs ─ */}
                {bills.length > 0 ? (
                  <>
                    <div className="cc-page__bill-tabs" role="tablist" aria-label="Faturas">
                      {bills.map((bill, idx) => (
                        <button
                          key={bill.id}
                          type="button"
                          role="tab"
                          aria-selected={activeBillIdx === idx}
                          className={`cc-page__bill-tab${activeBillIdx === idx ? ' cc-page__bill-tab--active' : ''}`}
                          onClick={() => setActiveBillIdx(idx)}
                        >
                          {getBillTabLabel(bill, idx)}
                          {bill.status === 'OPEN' && (
                            <span className="cc-page__tab-badge" aria-label="Aberta">
                              ●
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {activeBill && (
                      <div
                        role="tabpanel"
                        className="cc-page__bill-detail"
                        aria-label={getBillTabLabel(activeBill, activeBillIdx)}
                      >
                        {/* Period header */}
                        <div className="cc-page__bill-period">
                          <span>
                            {formatDate(activeBill.periodStart)} a{' '}
                            {formatDate(activeBill.periodEnd)}
                          </span>
                          <span>Vencimento: {formatDate(activeBill.dueDate)}</span>
                          {activeBill.status === 'CLOSED' && (
                            <span className="cc-page__badge-closed" aria-label="Fatura fechada">
                              FECHADA
                            </span>
                          )}
                        </div>

                        {/* Expenses table */}
                        {activeBill.expenses.length === 0 ? (
                          <p className="cc-page__no-expenses">Nenhum gasto neste período.</p>
                        ) : (
                          <div className="cc-page__expenses-wrap">
                            <table className="cc-page__expenses-table">
                              <caption className="sr-only">Gastos da fatura</caption>
                              <thead>
                                <tr>
                                  <th scope="col">Data</th>
                                  <th scope="col">Descrição</th>
                                  <th scope="col">Parcela</th>
                                  <th scope="col" className="cc-page__col-right">
                                    Valor
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeBill.expenses.map((exp) => (
                                  <tr key={exp.id}>
                                    <td className="cc-page__col-nowrap">
                                      {formatDate(exp.expenseDate)}
                                    </td>
                                    <td>{exp.description}</td>
                                    <td className="cc-page__col-nowrap">
                                      Parcela {exp.installmentNumber} de {exp.totalInstallments}
                                    </td>
                                    <td className="cc-page__col-right cc-page__col-mono">
                                      <span aria-label={`${formatBRL(exp.amount)} reais`}>
                                        {formatBRL(exp.amount)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Total footer */}
                        <div className="cc-page__bill-total">
                          <span className="cc-page__bill-total-label">Total:</span>
                          <span
                            className="cc-page__bill-total-value"
                            aria-label={`Total: ${formatBRL(activeBill.totalAmount)} reais`}
                          >
                            {formatBRL(activeBill.totalAmount)}
                          </span>
                        </div>

                        {/* Actions */}
                        {activeBill.status === 'OPEN' ? (
                          <div className="cc-page__bill-actions">
                            <button
                              type="button"
                              className="cc-page__btn-secondary"
                              onClick={() => setShowExpenseModal(true)}
                            >
                              <Plus size={16} aria-hidden="true" />
                              Novo Gasto
                            </button>
                            <button
                              type="button"
                              className="cc-page__btn-primary"
                              onClick={() => handleOpenCloseBill(activeBill)}
                            >
                              Fechar Fatura
                            </button>
                          </div>
                        ) : (
                          <div className="cc-page__bill-closed-info">
                            <span className="cc-page__badge-closed" aria-label="Fatura fechada">
                              FECHADA
                            </span>
                            {activeBill.payableId && (
                              <span className="cc-page__bill-cp-status">Conta a pagar gerada</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cc-page__no-bills">
                    <p>Nenhuma fatura encontrada para este cartão.</p>
                    <button
                      type="button"
                      className="cc-page__btn-secondary"
                      onClick={() => setShowExpenseModal(true)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Registrar primeiro gasto
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      {deleteConfirmId && (
        <div
          className="cc-page__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-delete-title"
        >
          <div className="cc-page__confirm-panel">
            <div className="cc-page__confirm-header">
              <h2 id="cc-delete-title" className="cc-page__confirm-title">
                Excluir cartão
              </h2>
              <button
                type="button"
                className="cc-page__btn-icon"
                onClick={() => setDeleteConfirmId(null)}
                aria-label="Fechar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="cc-page__confirm-text">
              Esta ação é irreversível. Digite o nome do cartão <strong>{deleteConfirmName}</strong>{' '}
              para confirmar a exclusão.
            </p>
            <input
              type="text"
              className="cc-page__confirm-input"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={deleteConfirmName}
              aria-label={`Digite "${deleteConfirmName}" para confirmar`}
            />
            <div className="cc-page__confirm-actions">
              <button
                type="button"
                className="cc-page__btn-outline"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cc-page__btn-danger"
                disabled={deleteConfirmInput !== deleteConfirmName || isDeleting}
                onClick={() => void handleDeleteCard(deleteConfirmId)}
              >
                {isDeleting ? 'Excluindo...' : 'Excluir cartão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <CreditCardModal
        isOpen={showCardModal}
        onClose={() => {
          setShowCardModal(false);
          setEditCardId(undefined);
        }}
        onSuccess={handleCardModalSuccess}
        cardId={editCardId}
      />

      <CreditCardExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSuccess={handleExpenseSuccess}
        cardId={selectedCardId ?? ''}
      />

      <CloseBillModal
        isOpen={showCloseBillModal}
        onClose={() => {
          setShowCloseBillModal(false);
          setClosingBill(null);
        }}
        onSuccess={handleCloseBillSuccess}
        bill={closingBill}
        isSubmitting={isBillClosing}
      />
    </main>
  );
}
