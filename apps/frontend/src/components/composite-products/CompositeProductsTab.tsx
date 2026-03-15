import { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Pencil, Trash2, Download, AlertCircle, FlaskConical } from 'lucide-react';
import { api } from '@/services/api';
import type {
  CompositeProductDetail,
  ProductionItem,
  ProductionsResponse,
} from '@/types/composite-product';
import { COMPOSITE_TYPES } from '@/types/composite-product';
import CompositeSetupModal from './CompositeSetupModal';
import ProductionModal from './ProductionModal';
import './CompositeProductsTab.css';

// ─── Helpers ──────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function getCompositeTypeLabel(value: string): string {
  const found = COMPOSITE_TYPES.find((ct) => ct.value === value);
  return found ? found.label : value;
}

// ─── Types ────────────────────────────────────────────────────────

interface CompositeCard {
  productId: string;
  productName: string;
  compositeType: string;
  compositeTypeLabel: string;
  batchSize: number;
  batchUnit: string;
  ingredientCount: number;
  estimatedCostCents: number;
}

// ─── Component ────────────────────────────────────────────────────

export default function CompositeProductsTab() {
  // Composite products list
  const [composites, setComposites] = useState<CompositeCard[]>([]);
  const [isLoadingComposites, setIsLoadingComposites] = useState(true);
  const [compositesError, setCompositesError] = useState<string | null>(null);

  // Productions
  const [productions, setProductions] = useState<ProductionItem[]>([]);
  const [productionsMeta, setProductionsMeta] = useState<{
    page: number;
    totalPages: number;
  } | null>(null);
  const [prodPage, setProdPage] = useState(1);
  const [isLoadingProductions, setIsLoadingProductions] = useState(true);
  const [productionsError, setProductionsError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Modals
  const [setupProduct, setSetupProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [productionProduct, setProductionProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ─── Load composite products ──────────────────────────────────

  const loadComposites = useCallback(async () => {
    setIsLoadingComposites(true);
    setCompositesError(null);
    try {
      // Fetch all products that are composite (isComposite = true)
      const res = await api.get<{ data: Array<{ id: string; name: string }> }>(
        '/org/products?limit=500&nature=PRODUCT&status=ACTIVE&isComposite=true',
      );

      // For each composite product, fetch its detail
      const details: CompositeCard[] = [];
      const detailPromises = res.data.map(async (product) => {
        try {
          const detail = await api.get<CompositeProductDetail>(
            `/org/products/${product.id}/composite`,
          );
          details.push({
            productId: detail.productId,
            productName: detail.productName,
            compositeType: detail.compositeType,
            compositeTypeLabel: detail.compositeTypeLabel,
            batchSize: detail.batchSize,
            batchUnit: detail.batchUnit,
            ingredientCount: detail.ingredients.length,
            estimatedCostCents: detail.estimatedCostCents,
          });
        } catch {
          // Skip products that fail to load
        }
      });
      await Promise.all(detailPromises);
      setComposites(details);
    } catch {
      setCompositesError('Não foi possível carregar os produtos compostos.');
    } finally {
      setIsLoadingComposites(false);
    }
  }, []);

  // ─── Load productions ─────────────────────────────────────────

  const loadProductions = useCallback(async () => {
    setIsLoadingProductions(true);
    setProductionsError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(prodPage));
      qs.set('limit', '10');

      const result = await api.get<ProductionsResponse>(`/org/composite-productions?${qs}`);
      setProductions(result.data);
      setProductionsMeta({
        page: result.meta.page,
        totalPages: result.meta.totalPages,
      });
    } catch {
      setProductionsError('Não foi possível carregar o histórico de produções.');
    } finally {
      setIsLoadingProductions(false);
    }
  }, [prodPage]);

  useEffect(() => {
    void loadComposites();
  }, [loadComposites]);

  useEffect(() => {
    void loadProductions();
  }, [loadProductions]);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleSetupSuccess = useCallback(() => {
    setSetupProduct(null);
    void loadComposites();
  }, [loadComposites]);

  const handleProductionSuccess = useCallback(() => {
    setProductionProduct(null);
    void loadComposites();
    void loadProductions();
  }, [loadComposites, loadProductions]);

  const handleDeleteProduction = useCallback(
    async (productionId: string) => {
      setDeleteError(null);
      try {
        await api.delete(`/org/composite-productions/${productionId}`);
        void loadProductions();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao excluir produção.';
        setDeleteError(msg);
      }
    },
    [loadProductions],
  );

  const handleExportRecipe = useCallback(async (productId: string, productName: string) => {
    try {
      const blob = await api.getBlob(`/org/products/${productId}/composite/recipe`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receita-${productName.toLowerCase().replace(/\s+/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail — could add toast here
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="composite-tab">
      {/* ── Composite Products Cards ──────────────────────────── */}
      <div className="composite-tab__header">
        <h2>Produtos compostos</h2>
      </div>

      {compositesError && (
        <div className="composite-tab__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {compositesError}
        </div>
      )}

      {isLoadingComposites && (
        <div className="composite-tab__skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="composite-tab__skeleton-row" />
          ))}
        </div>
      )}

      {!isLoadingComposites && !compositesError && composites.length === 0 && (
        <div className="composite-tab__empty">
          <Layers size={48} aria-hidden="true" />
          <h3>Nenhum produto composto configurado</h3>
          <p>
            Para criar um produto composto, edite um produto existente na aba &ldquo;Produtos&rdquo;
            e configure sua composição.
          </p>
        </div>
      )}

      {!isLoadingComposites && !compositesError && composites.length > 0 && (
        <div className="composite-tab__grid">
          {composites.map((comp) => (
            <div
              key={comp.productId}
              className="composite-tab__card"
              tabIndex={0}
              role="button"
              aria-label={`Editar composição de ${comp.productName}`}
              onClick={() => setSetupProduct({ id: comp.productId, name: comp.productName })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSetupProduct({ id: comp.productId, name: comp.productName });
                }
              }}
            >
              <div className="composite-tab__card-header">
                <h3 className="composite-tab__card-name">{comp.productName}</h3>
                <span className="composite-tab__card-type">
                  {getCompositeTypeLabel(comp.compositeType)}
                </span>
              </div>

              <div className="composite-tab__card-meta">
                <div className="composite-tab__card-stat">
                  <span className="composite-tab__card-stat-label">INGREDIENTES</span>
                  <span className="composite-tab__card-stat-value">{comp.ingredientCount}</span>
                </div>
                <div className="composite-tab__card-stat">
                  <span className="composite-tab__card-stat-label">LOTE</span>
                  <span className="composite-tab__card-stat-value">
                    {comp.batchSize} {comp.batchUnit}
                  </span>
                </div>
                <div className="composite-tab__card-stat">
                  <span className="composite-tab__card-stat-label">CUSTO EST.</span>
                  <span className="composite-tab__card-stat-value">
                    {formatCurrency(comp.estimatedCostCents)}
                  </span>
                </div>
              </div>

              <div className="composite-tab__card-actions">
                <button
                  type="button"
                  className="composite-tab__card-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSetupProduct({ id: comp.productId, name: comp.productName });
                  }}
                  aria-label={`Editar composição de ${comp.productName}`}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Editar
                </button>
                <button
                  type="button"
                  className="composite-tab__card-btn composite-tab__card-btn--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProductionProduct({ id: comp.productId, name: comp.productName });
                  }}
                  aria-label={`Nova produção de ${comp.productName}`}
                >
                  <Plus size={14} aria-hidden="true" />
                  Produzir
                </button>
                <button
                  type="button"
                  className="composite-tab__card-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleExportRecipe(comp.productId, comp.productName);
                  }}
                  aria-label={`Exportar receita de ${comp.productName}`}
                >
                  <Download size={14} aria-hidden="true" />
                  Receita
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Production History ────────────────────────────────── */}
      <h2 className="composite-tab__section-title">Histórico de produções</h2>

      {(productionsError || deleteError) && (
        <div className="composite-tab__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {productionsError || deleteError}
        </div>
      )}

      {isLoadingProductions && (
        <div className="composite-tab__skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="composite-tab__skeleton-row" />
          ))}
        </div>
      )}

      {!isLoadingProductions && !productionsError && productions.length === 0 && (
        <div className="composite-tab__empty">
          <FlaskConical size={48} aria-hidden="true" />
          <h3>Nenhuma produção registrada</h3>
          <p>
            Registre a primeira produção clicando em &ldquo;Produzir&rdquo; em um produto composto
            acima.
          </p>
        </div>
      )}

      {!isLoadingProductions && !productionsError && productions.length > 0 && (
        <>
          <table className="composite-tab__table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Data</th>
                <th scope="col">Lote</th>
                <th scope="col">Quantidade</th>
                <th scope="col">Custo total</th>
                <th scope="col">Responsável</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {productions.map((prod) => (
                <tr key={prod.id}>
                  <td data-label="Produto">
                    <strong>{prod.productName}</strong>
                  </td>
                  <td data-label="Data">{formatDate(prod.productionDate)}</td>
                  <td data-label="Lote" className="composite-tab__mono">
                    {prod.batchNumber ?? '—'}
                  </td>
                  <td data-label="Quantidade" className="composite-tab__mono">
                    {prod.quantityProduced}
                  </td>
                  <td data-label="Custo total" className="composite-tab__mono">
                    {formatCurrency(prod.totalCostCents)}
                  </td>
                  <td data-label="Responsável">{prod.responsibleName}</td>
                  <td>
                    <div className="composite-tab__table-actions">
                      <button
                        type="button"
                        className="composite-tab__icon-btn composite-tab__icon-btn--danger"
                        onClick={() => handleDeleteProduction(prod.id)}
                        aria-label={`Excluir produção de ${prod.productName}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {productionsMeta && productionsMeta.totalPages > 1 && (
            <div className="composite-tab__pagination">
              <button disabled={prodPage <= 1} onClick={() => setProdPage(prodPage - 1)}>
                Anterior
              </button>
              <span>
                Página {productionsMeta.page} de {productionsMeta.totalPages}
              </span>
              <button
                disabled={prodPage >= productionsMeta.totalPages}
                onClick={() => setProdPage(prodPage + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {setupProduct && (
        <CompositeSetupModal
          isOpen={!!setupProduct}
          productId={setupProduct.id}
          productName={setupProduct.name}
          onClose={() => setSetupProduct(null)}
          onSuccess={handleSetupSuccess}
        />
      )}

      {productionProduct && (
        <ProductionModal
          isOpen={!!productionProduct}
          compositeProductId={productionProduct.id}
          compositeProductName={productionProduct.name}
          onClose={() => setProductionProduct(null)}
          onSuccess={handleProductionSuccess}
        />
      )}
    </div>
  );
}
