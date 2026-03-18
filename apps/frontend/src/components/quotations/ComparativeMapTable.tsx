import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { ComparativeMapData } from '@/types/quotation';
import './ComparativeMapTable.css';

interface Selection {
  purchaseRequestItemId: string;
  quotationSupplierId: string;
}

interface ComparativeMapTableProps {
  data: ComparativeMapData;
  isEditable: boolean;
  selections: Selection[];
  onSelectionChange: (selections: Selection[]) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  const stars = Math.min(Math.round(rating), 5);
  return (
    <span
      className="cmt-stars"
      aria-label={`Nota ${rating} de 5`}
      style={{ color: 'var(--color-warning-500)', fontSize: 'var(--text-xs)' }}
    >
      {'★'.repeat(stars)}
      {'☆'.repeat(5 - stars)}
    </span>
  );
}

function PriceCell({
  unitPrice,
  totalPrice,
  minPrice,
  maxPrice,
  isSelected,
  isEditable,
  onSelect,
}: {
  unitPrice: number;
  totalPrice: number;
  purchaseRequestItemId?: string;
  quotationSupplierId?: string;
  minPrice: number | null;
  maxPrice: number | null;
  isSelected: boolean;
  isEditable: boolean;
  onSelect: () => void;
}) {
  const isMin = minPrice != null && unitPrice === minPrice;
  const isMax = maxPrice != null && unitPrice === maxPrice && unitPrice !== minPrice;

  let bgColor = 'transparent';
  let textColor = 'var(--color-neutral-700)';
  if (isMin) {
    bgColor = 'var(--color-success-50)';
    textColor = 'var(--color-success-700)';
  } else if (isMax) {
    bgColor = 'var(--color-error-50)';
    textColor = 'var(--color-error-700)';
  }

  let diffLabel = '';
  if (minPrice != null && minPrice > 0 && !isMin) {
    const diffPct = ((unitPrice - minPrice) / minPrice) * 100;
    diffLabel = `(+${diffPct.toFixed(0)}%)`;
  }

  return (
    <td
      className={`cmt-cell ${isSelected ? 'cmt-cell--selected' : ''} ${isEditable ? 'cmt-cell--editable' : ''}`}
      style={{ background: isSelected ? 'var(--color-primary-50)' : bgColor }}
      onClick={isEditable ? onSelect : undefined}
      aria-selected={isSelected}
    >
      <div className="cmt-cell__content">
        <div
          className="cmt-cell__price"
          style={{ color: isSelected ? 'var(--color-primary-700)' : textColor }}
        >
          {formatCurrency(unitPrice)}
          {diffLabel && (
            <span className="cmt-cell__diff" style={{ color: 'var(--color-error-600)' }}>
              {diffLabel}
            </span>
          )}
        </div>
        <div className="cmt-cell__total" style={{ color: 'var(--color-neutral-500)' }}>
          Total: {formatCurrency(totalPrice)}
        </div>
        {isEditable && (
          <div className={`cmt-cell__check ${isSelected ? 'cmt-cell__check--active' : ''}`}>
            {isSelected && <Check size={12} aria-hidden="true" />}
          </div>
        )}
        {isSelected && !isEditable && (
          <div className="cmt-cell__check cmt-cell__check--active">
            <Check size={12} aria-hidden="true" />
          </div>
        )}
      </div>
    </td>
  );
}

export default function ComparativeMapTable({
  data,
  isEditable,
  selections,
  onSelectionChange,
}: ComparativeMapTableProps) {
  const selectionMap = useMemo(() => {
    const map = new Map<string, string>(); // itemId -> qsId
    for (const s of selections) {
      map.set(s.purchaseRequestItemId, s.quotationSupplierId);
    }
    return map;
  }, [selections]);

  function handleCellSelect(purchaseRequestItemId: string, quotationSupplierId: string) {
    const next = selections.filter((s) => s.purchaseRequestItemId !== purchaseRequestItemId);
    next.push({ purchaseRequestItemId, quotationSupplierId });
    onSelectionChange(next);
  }

  // Calculate per-supplier totals for selected items
  const supplierTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const supplier of data.suppliers) {
      let total = 0;
      for (const item of data.items) {
        const selectedQsId = selectionMap.get(item.purchaseRequestItemId);
        if (selectedQsId === supplier.quotationSupplierId) {
          const proposalItem = supplier.proposalItems.find(
            (pi) => pi.purchaseRequestItemId === item.purchaseRequestItemId,
          );
          if (proposalItem) {
            total += proposalItem.totalPrice;
          }
        }
      }
      // Add freight and taxes
      total += (supplier.freightTotal ?? 0) + (supplier.taxTotal ?? 0);
      totals[supplier.quotationSupplierId] = total;
    }
    return totals;
  }, [data, selectionMap]);

  if (data.suppliers.length === 0) {
    return (
      <div className="cmt-empty">
        <p>Nenhuma proposta registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="cmt-scroll-wrapper" role="region" aria-label="Mapa comparativo de propostas">
      <div className="cmt-scroll-hint" aria-hidden="true">
        Role horizontalmente para ver todos os fornecedores
      </div>
      <div className="cmt-container">
        <table className="cmt-table">
          <caption className="sr-only">Comparativo de precos por fornecedor e item</caption>
          <thead>
            <tr>
              <th scope="col" className="cmt-th cmt-th--item">
                Item
              </th>
              {data.suppliers.map((supplier) => (
                <th
                  key={supplier.quotationSupplierId}
                  scope="col"
                  className="cmt-th cmt-th--supplier"
                >
                  <div className="cmt-supplier-header">
                    <span className="cmt-supplier-header__name">{supplier.supplierName}</span>
                    <StarRating rating={supplier.rating} />
                    {supplier.deliveryDays != null && (
                      <span className="cmt-supplier-header__meta">
                        {supplier.deliveryDays}d entrega
                      </span>
                    )}
                    {supplier.freightTotal != null && supplier.freightTotal > 0 && (
                      <span className="cmt-supplier-header__meta">
                        Frete: {formatCurrency(supplier.freightTotal)}
                      </span>
                    )}
                    {supplier.paymentTerms && (
                      <span className="cmt-supplier-header__meta">{supplier.paymentTerms}</span>
                    )}
                    {supplier.validUntil && (
                      <span className="cmt-supplier-header__meta">
                        Val: {formatDate(supplier.validUntil)}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const minPrice = data.perItemMinPrice[item.purchaseRequestItemId] ?? null;
              const maxPrice = data.perItemMaxPrice[item.purchaseRequestItemId] ?? null;

              return (
                <tr key={item.purchaseRequestItemId}>
                  {/* Item column (sticky) */}
                  <th scope="row" className="cmt-item-col">
                    <div className="cmt-item-col__name">{item.productName}</div>
                    <div className="cmt-item-col__meta">
                      {item.quantity} {item.unitName}
                    </div>
                    {item.lastPricePaid != null && (
                      <span className="cmt-last-price">
                        Ultimo: {formatCurrency(item.lastPricePaid)}
                      </span>
                    )}
                  </th>

                  {/* Price cells */}
                  {data.suppliers.map((supplier) => {
                    const proposalItem = supplier.proposalItems.find(
                      (pi) => pi.purchaseRequestItemId === item.purchaseRequestItemId,
                    );

                    if (!proposalItem) {
                      return (
                        <td key={supplier.quotationSupplierId} className="cmt-cell cmt-cell--empty">
                          <span className="cmt-cell__no-price">—</span>
                        </td>
                      );
                    }

                    const isSelected =
                      selectionMap.get(item.purchaseRequestItemId) === supplier.quotationSupplierId;

                    return (
                      <PriceCell
                        key={supplier.quotationSupplierId}
                        unitPrice={proposalItem.unitPrice}
                        totalPrice={proposalItem.totalPrice}
                        purchaseRequestItemId={item.purchaseRequestItemId}
                        quotationSupplierId={supplier.quotationSupplierId}
                        minPrice={minPrice}
                        maxPrice={maxPrice}
                        isSelected={isSelected}
                        isEditable={isEditable}
                        onSelect={() =>
                          handleCellSelect(item.purchaseRequestItemId, supplier.quotationSupplierId)
                        }
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="cmt-total-label">
                Total (selecionados)
              </th>
              {data.suppliers.map((supplier) => (
                <td key={supplier.quotationSupplierId} className="cmt-total-cell">
                  <strong className="cmt-total-value">
                    {formatCurrency(supplierTotals[supplier.quotationSupplierId] ?? 0)}
                  </strong>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
