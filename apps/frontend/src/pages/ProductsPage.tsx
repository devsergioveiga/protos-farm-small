import { useState, useCallback, useEffect } from 'react';
import { Plus, Package, Wrench, Search, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import type { ProductItem } from '@/hooks/useProducts';
import ProductModal from '@/components/products/ProductModal';
import { api } from '@/services/api';
import './ProductsPage.css';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  semente: 'Semente',
  fertilizante: 'Fertilizante',
  defensivo_herbicida: 'Herbicida',
  defensivo_inseticida: 'Inseticida',
  defensivo_fungicida: 'Fungicida',
  defensivo_acaricida: 'Acaricida',
  adjuvante: 'Adjuvante',
  corretivo_calcario: 'Calcário',
  corretivo_gesso: 'Gesso',
  inoculante: 'Inoculante',
  biologico: 'Biológico',
  medicamento_veterinario: 'Med. Veterinário',
  hormonio_reprodutivo: 'Hormônio Reprod.',
  suplemento_mineral_vitaminico: 'Supl. Mineral/Vit.',
  semen: 'Sêmen',
  combustivel: 'Combustível',
  peca_componente: 'Peça/Componente',
  epi: 'EPI',
  material_consumo: 'Material Consumo',
  outro: 'Outro',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  consultoria_agronomica: 'Consultoria Agronômica',
  consultoria_veterinaria: 'Consultoria Veterinária',
  inseminacao_artificial: 'Inseminação Artificial',
  analise_laboratorial: 'Análise Laboratorial',
  transporte_leite: 'Transporte de Leite',
  frete_insumos: 'Frete de Insumos',
  manutencao_equipamento: 'Manutenção Equipamento',
  topografia_georreferenciamento: 'Topografia/Georreferenc.',
  assessoria_contabil_fiscal: 'Assessoria Contábil/Fiscal',
  servico_maquinas_terceirizado: 'Serviço Máquinas Terc.',
  certificacao_auditoria: 'Certificação/Auditoria',
  outro: 'Outro',
};

function getTypeLabel(nature: string, type: string): string {
  if (nature === 'SERVICE') return SERVICE_TYPE_LABELS[type] ?? type;
  return PRODUCT_TYPE_LABELS[type] ?? type;
}

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { products, meta, isLoading, error, refetch } = useProducts({
    page,
    nature: activeTab,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedProduct(null);
    void refetch();
  }, [refetch]);

  const handleEdit = useCallback((product: ProductItem) => {
    setSelectedProduct(product);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (product: ProductItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      try {
        await api.delete(`/org/products/${product.id}`);
        void refetch();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao excluir produto.';
        setDeleteError(msg);
      }
    },
    [refetch],
  );

  const handleTabChange = useCallback((tab: 'PRODUCT' | 'SERVICE') => {
    setActiveTab(tab);
    setTypeFilter('');
    setPage(1);
  }, []);

  const typeOptions = activeTab === 'PRODUCT' ? PRODUCT_TYPE_LABELS : SERVICE_TYPE_LABELS;

  return (
    <div className="products-page">
      <header className="products-page__header">
        <div>
          <h1>Produtos e Serviços</h1>
          <p>Gerencie insumos, produtos e serviços da propriedade</p>
        </div>
        <button
          className="products-page__btn-primary"
          onClick={() => {
            setSelectedProduct(null);
            setShowModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          {activeTab === 'PRODUCT' ? 'Novo produto' : 'Novo serviço'}
        </button>
      </header>

      <nav className="products-page__tabs" aria-label="Tipo de cadastro">
        <button
          className={activeTab === 'PRODUCT' ? 'products-page__tab--active' : 'products-page__tab'}
          onClick={() => handleTabChange('PRODUCT')}
          aria-current={activeTab === 'PRODUCT' ? 'page' : undefined}
        >
          <Package size={16} aria-hidden="true" />
          Produtos
        </button>
        <button
          className={activeTab === 'SERVICE' ? 'products-page__tab--active' : 'products-page__tab'}
          onClick={() => handleTabChange('SERVICE')}
          aria-current={activeTab === 'SERVICE' ? 'page' : undefined}
        >
          <Wrench size={16} aria-hidden="true" />
          Serviços
        </button>
      </nav>

      <div className="products-page__toolbar">
        <div className="products-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar produtos"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(typeOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </div>

      {(error || deleteError) && (
        <div className="products-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {isLoading && (
        <div className="products-page__skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="products-page__skeleton-row" />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {products.length === 0 ? (
            <div className="products-page__empty">
              {activeTab === 'PRODUCT' ? (
                <Package size={48} aria-hidden="true" />
              ) : (
                <Wrench size={48} aria-hidden="true" />
              )}
              <h3>Nenhum {activeTab === 'PRODUCT' ? 'produto' : 'serviço'} encontrado</h3>
              <p>
                {search || typeFilter || statusFilter
                  ? 'Tente alterar os filtros de busca.'
                  : `Cadastre ${activeTab === 'PRODUCT' ? 'seu primeiro produto ou insumo' : 'seu primeiro serviço'}.`}
              </p>
            </div>
          ) : (
            <table className="products-page__table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  {activeTab === 'PRODUCT' && <th scope="col">Fabricante</th>}
                  {activeTab === 'PRODUCT' && <th scope="col">Unidade</th>}
                  {activeTab === 'SERVICE' && <th scope="col">Cobrança</th>}
                  {activeTab === 'SERVICE' && <th scope="col">Custo</th>}
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} onClick={() => handleEdit(product)}>
                    <td data-label="Nome">
                      <div className="products-page__name-cell">
                        <strong>{product.name}</strong>
                        {product.commercialName && <span>{product.commercialName}</span>}
                      </div>
                    </td>
                    <td data-label="Tipo">{getTypeLabel(product.nature, product.type)}</td>
                    {activeTab === 'PRODUCT' && (
                      <td data-label="Fabricante">{product.manufacturer?.name ?? '—'}</td>
                    )}
                    {activeTab === 'PRODUCT' && (
                      <td data-label="Unidade">{product.measurementUnitAbbreviation ?? '—'}</td>
                    )}
                    {activeTab === 'SERVICE' && (
                      <td data-label="Cobrança">{product.chargeUnit ?? '—'}</td>
                    )}
                    {activeTab === 'SERVICE' && (
                      <td data-label="Custo">
                        {product.unitCost != null ? `R$ ${product.unitCost.toFixed(2)}` : '—'}
                      </td>
                    )}
                    <td data-label="Status">
                      <span
                        className={`products-page__badge products-page__badge--${product.status === 'ACTIVE' ? 'active' : 'inactive'}`}
                      >
                        {product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="products-page__actions">
                        <button
                          className="products-page__icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(product);
                          }}
                          aria-label={`Editar ${product.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="products-page__icon-btn products-page__icon-btn--danger"
                          onClick={(e) => handleDelete(product, e)}
                          aria-label={`Excluir ${product.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="products-page__pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      )}

      <ProductModal
        isOpen={showModal}
        product={selectedProduct}
        defaultNature={activeTab}
        onClose={() => {
          setShowModal(false);
          setSelectedProduct(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
