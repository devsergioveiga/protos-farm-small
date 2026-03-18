import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, Paperclip } from 'lucide-react';
import {
  useQuotation,
  useComparativeMap,
  registerProposal,
  approveQuotation,
  transitionQuotation,
} from '@/hooks/useQuotations';
import ComparativeMapTable from './ComparativeMapTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type {
  QuotationStatus,
  QuotationSupplierData,
  RegisterProposalInput,
} from '@/types/quotation';
import { SC_STATUS_LABELS, SC_STATUS_COLORS } from '@/types/quotation';
import './QuotationDetailModal.css';

interface QuotationDetailModalProps {
  isOpen: boolean;
  quotationId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

type TabId = 'suppliers' | 'comparative' | 'details';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusBadge({ status }: { status: QuotationStatus }) {
  return <span className={`qd-badge ${SC_STATUS_COLORS[status]}`}>{SC_STATUS_LABELS[status]}</span>;
}

// ─── Inline Proposal Form ─────────────────────────────────────────────────

function ProposalForm({
  quotationId,
  supplier,
  rcItems,
  onSuccess,
  onCancel,
}: {
  quotationId: string;
  supplier: QuotationSupplierData;
  rcItems: { id: string; productName: string; unitName: string; quantity: number }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [freightTotal, setFreightTotal] = useState('');
  const [taxTotal, setTaxTotal] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [notes, setNotes] = useState('');
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const item of rcItems) {
      const price = parseFloat(itemPrices[item.id] ?? '');
      if (isNaN(price) || price <= 0) {
        errors[`price_${item.id}`] = 'Informe o preco unitario';
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const input: RegisterProposalInput = {
        items: rcItems.map((item) => ({
          purchaseRequestItemId: item.id,
          unitPrice: parseFloat(itemPrices[item.id] ?? '0'),
          quantity: item.quantity,
        })),
        freightTotal: freightTotal ? parseFloat(freightTotal) : undefined,
        taxTotal: taxTotal ? parseFloat(taxTotal) : undefined,
        paymentTerms: paymentTerms || undefined,
        validUntil: validUntil || undefined,
        deliveryDays: deliveryDays ? parseInt(deliveryDays) : undefined,
        notes: notes || undefined,
      };
      await registerProposal(quotationId, supplier.id, input, proposalFile ?? undefined);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar proposta');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="qd-proposal-form" onSubmit={(e) => void handleSubmit(e)}>
      {error && (
        <div className="qd-proposal-form__error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="qd-proposal-form__items">
        <table className="qd-items-table">
          <caption className="sr-only">Itens da proposta</caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Qtd</th>
              <th scope="col">Preco Unit. *</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rcItems.map((item) => {
              const price = parseFloat(itemPrices[item.id] ?? '') || 0;
              const total = price * item.quantity;
              const hasError = !!validationErrors[`price_${item.id}`];
              return (
                <tr key={item.id}>
                  <td className="qd-items-table__name">{item.productName}</td>
                  <td className="qd-items-table__qty">
                    {item.quantity} {item.unitName}
                  </td>
                  <td>
                    <label htmlFor={`price-${item.id}`} className="sr-only">
                      Preco unitario de {item.productName}
                    </label>
                    <input
                      id={`price-${item.id}`}
                      type="number"
                      className={`qd-price-input ${hasError ? 'qd-price-input--error' : ''}`}
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={itemPrices[item.id] ?? ''}
                      onChange={(e) =>
                        setItemPrices((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      aria-required="true"
                      aria-describedby={hasError ? `price-err-${item.id}` : undefined}
                    />
                    {hasError && (
                      <span id={`price-err-${item.id}`} className="qd-field__error" role="alert">
                        {validationErrors[`price_${item.id}`]}
                      </span>
                    )}
                  </td>
                  <td className="qd-items-table__total">
                    {price > 0 ? formatCurrency(total) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="qd-proposal-form__extra">
        <div className="qd-field-row">
          <div className="qd-field">
            <label htmlFor="qd-freight" className="qd-field__label">
              Frete (R$)
            </label>
            <input
              id="qd-freight"
              type="number"
              className="qd-input"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={freightTotal}
              onChange={(e) => setFreightTotal(e.target.value)}
            />
          </div>
          <div className="qd-field">
            <label htmlFor="qd-tax" className="qd-field__label">
              Impostos (R$)
            </label>
            <input
              id="qd-tax"
              type="number"
              className="qd-input"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={taxTotal}
              onChange={(e) => setTaxTotal(e.target.value)}
            />
          </div>
          <div className="qd-field">
            <label htmlFor="qd-delivery" className="qd-field__label">
              Prazo entrega (dias)
            </label>
            <input
              id="qd-delivery"
              type="number"
              className="qd-input"
              min="0"
              step="1"
              placeholder="0"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
            />
          </div>
        </div>

        <div className="qd-field-row">
          <div className="qd-field">
            <label htmlFor="qd-payment" className="qd-field__label">
              Condicao de pagamento
            </label>
            <input
              id="qd-payment"
              type="text"
              className="qd-input"
              placeholder="Ex: 30/60/90 dias"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </div>
          <div className="qd-field">
            <label htmlFor="qd-valid-until" className="qd-field__label">
              Validade da proposta
            </label>
            <input
              id="qd-valid-until"
              type="date"
              className="qd-input"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>

        <div className="qd-field">
          <label htmlFor="qd-file" className="qd-field__label">
            <Paperclip size={14} aria-hidden="true" />
            Anexar proposta original (PDF/imagem, max 10MB)
          </label>
          <input
            id="qd-file"
            type="file"
            className="qd-file-input"
            accept=".pdf,image/*"
            onChange={(e) => setProposalFile(e.target.files?.[0] ?? null)}
          />
          {proposalFile && <span className="qd-file-name">{proposalFile.name}</span>}
        </div>

        <div className="qd-field">
          <label htmlFor="qd-prop-notes" className="qd-field__label">
            Observacoes
          </label>
          <textarea
            id="qd-prop-notes"
            className="qd-textarea"
            rows={2}
            placeholder="Observacoes sobre a proposta..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="qd-proposal-form__actions">
        <button
          type="button"
          className="qd-btn qd-btn--secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button type="submit" className="qd-btn qd-btn--primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="qd-spin" aria-hidden="true" />
              Registrando...
            </>
          ) : (
            'Registrar Proposta'
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────

function SupplierCard({
  quotationId,
  supplier,
  rcItems,
  onProposalSaved,
  status,
}: {
  quotationId: string;
  supplier: QuotationSupplierData;
  rcItems: { id: string; productName: string; unitName: string; quantity: number }[];
  onProposalSaved: () => void;
  status: QuotationStatus;
}) {
  const [showForm, setShowForm] = useState(false);
  const canRegister =
    status === 'AGUARDANDO_PROPOSTA' || status === 'EM_ANALISE' || status === 'RASCUNHO';

  return (
    <div className="qd-supplier-card">
      <div className="qd-supplier-card__header">
        <div className="qd-supplier-card__info">
          <span className="qd-supplier-card__name">{supplier.supplier.name}</span>
          {supplier.supplier.tradeName && (
            <span className="qd-supplier-card__trade">{supplier.supplier.tradeName}</span>
          )}
          <span
            className={`qd-supplier-card__status ${
              supplier.supplier.status === 'ACTIVE'
                ? 'qd-supplier-card__status--active'
                : 'qd-supplier-card__status--inactive'
            }`}
          >
            {supplier.supplier.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        {supplier.proposal == null && canRegister && !showForm && (
          <button
            type="button"
            className="qd-btn qd-btn--secondary qd-btn--sm"
            onClick={() => setShowForm(true)}
          >
            Registrar Proposta
          </button>
        )}
      </div>

      {supplier.proposal ? (
        <div className="qd-supplier-card__proposal">
          <div className="qd-proposal-summary">
            <div className="qd-proposal-summary__row">
              <span className="qd-proposal-summary__label">Itens:</span>
              <span>{supplier.proposal.items.length} itens cotados</span>
            </div>
            {supplier.proposal.freightTotal != null && supplier.proposal.freightTotal > 0 && (
              <div className="qd-proposal-summary__row">
                <span className="qd-proposal-summary__label">Frete:</span>
                <span>{formatCurrency(supplier.proposal.freightTotal)}</span>
              </div>
            )}
            {supplier.proposal.deliveryDays != null && (
              <div className="qd-proposal-summary__row">
                <span className="qd-proposal-summary__label">Prazo:</span>
                <span>{supplier.proposal.deliveryDays} dias</span>
              </div>
            )}
            {supplier.proposal.paymentTerms && (
              <div className="qd-proposal-summary__row">
                <span className="qd-proposal-summary__label">Pagamento:</span>
                <span>{supplier.proposal.paymentTerms}</span>
              </div>
            )}
            {supplier.proposal.validUntil && (
              <div className="qd-proposal-summary__row">
                <span className="qd-proposal-summary__label">Validade:</span>
                <span>{formatDateOnly(supplier.proposal.validUntil)}</span>
              </div>
            )}
            {supplier.proposal.fileUrl && (
              <div className="qd-proposal-summary__row">
                <span className="qd-proposal-summary__label">Arquivo:</span>
                <a
                  href={supplier.proposal.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="qd-proposal-link"
                >
                  <Paperclip size={12} aria-hidden="true" />
                  {supplier.proposal.fileName ?? 'Ver proposta'}
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="qd-supplier-card__no-proposal">Nenhuma proposta registrada ainda.</div>
      )}

      {showForm && (
        <ProposalForm
          quotationId={quotationId}
          supplier={supplier}
          rcItems={rcItems}
          onSuccess={() => {
            setShowForm(false);
            onProposalSaved();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ─── Main Detail Content ──────────────────────────────────────────────────

function QuotationDetailContent({
  quotationId,
  onClose,
  onUpdate,
}: {
  quotationId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { quotation, isLoading, error, refetch } = useQuotation(quotationId);
  const [activeTab, setActiveTab] = useState<TabId>('suppliers');
  const [selections, setSelections] = useState<
    { purchaseRequestItemId: string; quotationSupplierId: string }[]
  >([]);
  const [showApprovalSection, setShowApprovalSection] = useState(false);
  const [approvalJustification, setApprovalJustification] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showComparativeTab =
    quotation?.status === 'EM_ANALISE' ||
    quotation?.status === 'APROVADA' ||
    quotation?.status === 'FECHADA';

  const canApprove = quotation?.status === 'EM_ANALISE';
  const canCancel =
    quotation?.status === 'AGUARDANDO_PROPOSTA' || quotation?.status === 'EM_ANALISE';

  const { data: comparativeData, isLoading: cmLoading } = useComparativeMap(
    showComparativeTab ? quotationId : null,
  );

  // Pre-select lowest prices when comparative data loads
  useEffect(() => {
    if (!comparativeData || selections.length > 0) return;
    const defaultSelections: { purchaseRequestItemId: string; quotationSupplierId: string }[] = [];
    for (const item of comparativeData.items) {
      const minPrice = comparativeData.perItemMinPrice[item.purchaseRequestItemId];
      if (minPrice == null) continue;
      for (const supplier of comparativeData.suppliers) {
        const pi = supplier.proposalItems.find(
          (p) => p.purchaseRequestItemId === item.purchaseRequestItemId && p.unitPrice === minPrice,
        );
        if (pi) {
          defaultSelections.push({
            purchaseRequestItemId: item.purchaseRequestItemId,
            quotationSupplierId: supplier.quotationSupplierId,
          });
          break;
        }
      }
    }
    setSelections(defaultSelections);
  }, [comparativeData, selections.length]);

  const hasNonLowestSelection = useMemo(() => {
    if (!comparativeData) return false;
    return selections.some((sel) => {
      const minPrice = comparativeData.perItemMinPrice[sel.purchaseRequestItemId];
      if (minPrice == null) return false;
      const supplier = comparativeData.suppliers.find(
        (s) => s.quotationSupplierId === sel.quotationSupplierId,
      );
      const pi = supplier?.proposalItems.find(
        (p) => p.purchaseRequestItemId === sel.purchaseRequestItemId,
      );
      return pi ? pi.unitPrice > minPrice : false;
    });
  }, [comparativeData, selections]);

  function showToast(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function handleApprove() {
    if (hasNonLowestSelection && !approvalJustification.trim()) {
      setApprovalError('Justificativa obrigatoria quando a selecao nao e o menor preco.');
      return;
    }
    setIsApproving(true);
    setApprovalError(null);
    try {
      await approveQuotation(quotationId, {
        selectedItems: selections,
        justification: approvalJustification || undefined,
      });
      showToast('Cotacao aprovada — pedido(s) de compra gerado(s)');
      setShowApprovalSection(false);
      refetch();
      onUpdate();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Erro ao aprovar cotacao');
    } finally {
      setIsApproving(false);
    }
  }

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await transitionQuotation(quotationId, 'CANCELADA');
      showToast('Cotacao cancelada');
      setShowCancelConfirm(false);
      refetch();
      onUpdate();
    } catch {
      // ignore
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="qd-loading">
        <Loader2 size={32} className="qd-spin" aria-hidden="true" />
        <span>Carregando cotacao...</span>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="qd-error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        {error ?? 'Cotacao nao encontrada'}
      </div>
    );
  }

  const rcItems = quotation.purchaseRequest.items.map((item) => ({
    id: item.id,
    productName: item.productName,
    unitName: item.unitName,
    quantity: item.quantity,
  }));

  return (
    <>
      {/* Header */}
      <div className="qd-modal__header">
        <div className="qd-modal__header-main">
          <div className="qd-modal__title-row">
            <h2 id="qd-title" className="qd-modal__title">
              {quotation.sequentialNumber}
            </h2>
            <StatusBadge status={quotation.status} />
          </div>
          <div className="qd-modal__meta">
            <span>RC: {quotation.purchaseRequest.sequentialNumber}</span>
            <span>Criada: {formatDate(quotation.createdAt)}</span>
            {quotation.responseDeadline && (
              <span>Prazo: {formatDateOnly(quotation.responseDeadline)}</span>
            )}
          </div>
        </div>
        <div className="qd-modal__header-actions">
          {canCancel && (
            <button
              type="button"
              className="qd-btn qd-btn--danger qd-btn--sm"
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancelar
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              className="qd-btn qd-btn--primary qd-btn--sm"
              onClick={() => {
                setActiveTab('comparative');
                setShowApprovalSection(true);
              }}
            >
              Aprovar Cotacao
            </button>
          )}
          <button
            type="button"
            className="qd-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="qd-toast" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="qd-tabs" role="tablist" aria-label="Secoes da cotacao">
        <button
          type="button"
          role="tab"
          className={`qd-tab ${activeTab === 'suppliers' ? 'qd-tab--active' : ''}`}
          aria-selected={activeTab === 'suppliers'}
          onClick={() => setActiveTab('suppliers')}
        >
          Fornecedores e Propostas
        </button>
        {showComparativeTab && (
          <button
            type="button"
            role="tab"
            className={`qd-tab ${activeTab === 'comparative' ? 'qd-tab--active' : ''}`}
            aria-selected={activeTab === 'comparative'}
            onClick={() => setActiveTab('comparative')}
          >
            Mapa Comparativo
          </button>
        )}
        <button
          type="button"
          role="tab"
          className={`qd-tab ${activeTab === 'details' ? 'qd-tab--active' : ''}`}
          aria-selected={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
        >
          Detalhes
        </button>
      </div>

      {/* Tab content */}
      <div className="qd-modal__body">
        {/* Tab: Suppliers */}
        {activeTab === 'suppliers' && (
          <div className="qd-tab-panel" role="tabpanel">
            {quotation.suppliers.length === 0 ? (
              <p className="qd-empty-msg">Nenhum fornecedor nesta cotacao.</p>
            ) : (
              <div className="qd-suppliers-list">
                {quotation.suppliers.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    quotationId={quotationId}
                    supplier={supplier}
                    rcItems={rcItems}
                    onProposalSaved={() => {
                      refetch();
                      onUpdate();
                    }}
                    status={quotation.status}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Comparative Map */}
        {activeTab === 'comparative' && showComparativeTab && (
          <div className="qd-tab-panel" role="tabpanel">
            {cmLoading ? (
              <div className="qd-loading">
                <Loader2 size={24} className="qd-spin" aria-hidden="true" />
                <span>Carregando mapa comparativo...</span>
              </div>
            ) : comparativeData ? (
              <>
                <ComparativeMapTable
                  data={comparativeData}
                  isEditable={!!canApprove}
                  selections={selections}
                  onSelectionChange={setSelections}
                />

                {/* Approval section */}
                {showApprovalSection && canApprove && (
                  <div className="qd-approval-section">
                    <h3 className="qd-approval-section__title">Aprovacao da Cotacao</h3>
                    <div className="qd-approval-summary">
                      <p className="qd-approval-summary__label">
                        {selections.length} item(ns) selecionado(s)
                      </p>
                      {hasNonLowestSelection && (
                        <div className="qd-approval-warning" role="alert">
                          <AlertCircle size={16} aria-hidden="true" />
                          Atencao: algumas selecoes nao sao o menor preco. Justificativa
                          obrigatoria.
                        </div>
                      )}
                    </div>
                    <div className="qd-field">
                      <label htmlFor="qd-justification" className="qd-field__label">
                        Justificativa
                        {hasNonLowestSelection && <span aria-hidden="true"> *</span>}
                      </label>
                      <textarea
                        id="qd-justification"
                        className={`qd-textarea ${approvalError ? 'qd-textarea--error' : ''}`}
                        rows={3}
                        placeholder="Motivo da selecao (obrigatorio se nao for o menor preco)..."
                        value={approvalJustification}
                        onChange={(e) => {
                          setApprovalJustification(e.target.value);
                          setApprovalError(null);
                        }}
                        aria-required={hasNonLowestSelection}
                      />
                      {approvalError && (
                        <span className="qd-field__error" role="alert">
                          <AlertCircle size={12} aria-hidden="true" />
                          {approvalError}
                        </span>
                      )}
                    </div>
                    <div className="qd-approval-section__actions">
                      <button
                        type="button"
                        className="qd-btn qd-btn--secondary"
                        onClick={() => {
                          setShowApprovalSection(false);
                          setApprovalError(null);
                        }}
                        disabled={isApproving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="qd-btn qd-btn--primary"
                        onClick={() => void handleApprove()}
                        disabled={isApproving || selections.length === 0}
                      >
                        {isApproving ? (
                          <>
                            <Loader2 size={14} className="qd-spin" aria-hidden="true" />
                            Aprovando...
                          </>
                        ) : (
                          'Confirmar Aprovacao'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="qd-empty-msg">
                O mapa comparativo estara disponivel quando houver pelo menos 2 propostas.
              </p>
            )}
          </div>
        )}

        {/* Tab: Details */}
        {activeTab === 'details' && (
          <div className="qd-tab-panel" role="tabpanel">
            <section className="qd-details-section">
              <h3 className="qd-details-section__title">Itens da Requisicao</h3>
              <table className="qd-items-table">
                <caption className="sr-only">Itens da requisicao de compra</caption>
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.purchaseRequest.items.map((item) => (
                    <tr key={item.id}>
                      <td className="qd-items-table__name">{item.productName}</td>
                      <td className="qd-items-table__qty">
                        {item.quantity} {item.unitName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {quotation.notes && (
              <section className="qd-details-section">
                <h3 className="qd-details-section__title">Observacoes</h3>
                <p className="qd-details-notes">{quotation.notes}</p>
              </section>
            )}

            {quotation.approvedAt && (
              <section className="qd-details-section">
                <h3 className="qd-details-section__title">Informacoes de Aprovacao</h3>
                <div className="qd-approval-info">
                  <div className="qd-approval-info__row">
                    <span className="qd-approval-info__label">Data:</span>
                    <span>{formatDate(quotation.approvedAt)}</span>
                  </div>
                  {quotation.approvedBy && (
                    <div className="qd-approval-info__row">
                      <span className="qd-approval-info__label">Aprovado por:</span>
                      <span>{quotation.approvedBy}</span>
                    </div>
                  )}
                  {quotation.approvalJustification && (
                    <div className="qd-approval-info__row">
                      <span className="qd-approval-info__label">Justificativa:</span>
                      <span>{quotation.approvalJustification}</span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Cancel confirmation */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Cancelar cotacao"
        message="Tem certeza que deseja cancelar esta cotacao? Esta acao nao pode ser desfeita."
        confirmLabel="Cancelar cotacao"
        cancelLabel="Voltar"
        variant="warning"
        isLoading={isCancelling}
        onConfirm={() => void handleCancel()}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </>
  );
}

// ─── Exported Modal ───────────────────────────────────────────────────────

export default function QuotationDetailModal({
  isOpen,
  quotationId,
  onClose,
  onUpdate,
}: QuotationDetailModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !quotationId) return null;

  return (
    <div
      className="qd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qd-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="qd-modal">
        <QuotationDetailContent
          key={quotationId}
          quotationId={quotationId}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}
