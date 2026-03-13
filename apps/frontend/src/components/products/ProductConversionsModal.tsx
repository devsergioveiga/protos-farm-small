import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, ArrowRightLeft, AlertCircle, Settings } from 'lucide-react';
import { api } from '@/services/api';
import type { UnitItem } from '@/hooks/useMeasurementUnits';
import './ProductConversionsModal.css';

interface ProductUnitConfigData {
  id: string;
  productId: string;
  purchaseUnitId: string | null;
  purchaseUnitAbbreviation: string | null;
  purchaseUnitName: string | null;
  stockUnitId: string | null;
  stockUnitAbbreviation: string | null;
  stockUnitName: string | null;
  applicationUnitId: string | null;
  applicationUnitAbbreviation: string | null;
  applicationUnitName: string | null;
  densityGPerMl: number | null;
  productConversions: ProductConversionData[];
}

interface ProductConversionData {
  id: string;
  productUnitConfigId: string;
  fromUnitId: string;
  fromUnitAbbreviation: string;
  toUnitId: string;
  toUnitAbbreviation: string;
  factor: number;
  description: string | null;
}

interface Props {
  isOpen: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
}

type Tab = 'config' | 'conversions';

export default function ProductConversionsModal({
  isOpen,
  productId,
  productName,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [config, setConfig] = useState<ProductUnitConfigData | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Config form state
  const [purchaseUnitId, setPurchaseUnitId] = useState('');
  const [stockUnitId, setStockUnitId] = useState('');
  const [applicationUnitId, setApplicationUnitId] = useState('');
  const [densityGPerMl, setDensityGPerMl] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // New conversion form state
  const [showAddConversion, setShowAddConversion] = useState(false);
  const [newFromUnitId, setNewFromUnitId] = useState('');
  const [newToUnitId, setNewToUnitId] = useState('');
  const [newFactor, setNewFactor] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isAddingConversion, setIsAddingConversion] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [unitsRes, configRes] = await Promise.allSettled([
        api.get<{ data: UnitItem[] }>('/org/measurement-units?limit=200'),
        api.get<ProductUnitConfigData>(`/org/product-unit-configs/${productId}`),
      ]);

      if (unitsRes.status === 'fulfilled') {
        setUnits(unitsRes.value.data);
      }

      if (configRes.status === 'fulfilled') {
        const c = configRes.value;
        setConfig(c);
        setPurchaseUnitId(c.purchaseUnitId ?? '');
        setStockUnitId(c.stockUnitId ?? '');
        setApplicationUnitId(c.applicationUnitId ?? '');
        setDensityGPerMl(c.densityGPerMl != null ? String(c.densityGPerMl) : '');
      } else {
        // No config yet — that's OK
        setConfig(null);
        setPurchaseUnitId('');
        setStockUnitId('');
        setApplicationUnitId('');
        setDensityGPerMl('');
      }
    } catch {
      setError('Não foi possível carregar os dados.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
      setActiveTab('config');
      setShowAddConversion(false);
      setConfigSuccess(null);
      setConfigError(null);
      setConversionError(null);
    }
  }, [isOpen, loadData]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSaveConfig = useCallback(async () => {
    setIsSavingConfig(true);
    setConfigError(null);
    setConfigSuccess(null);

    const payload: Record<string, unknown> = {
      productId,
      purchaseUnitId: purchaseUnitId || null,
      stockUnitId: stockUnitId || null,
      applicationUnitId: applicationUnitId || null,
      densityGPerMl: densityGPerMl ? Number(densityGPerMl) : null,
    };

    try {
      if (config) {
        const result = await api.patch<ProductUnitConfigData>(
          `/org/product-unit-configs/${productId}`,
          payload,
        );
        setConfig(result);
      } else {
        const result = await api.post<ProductUnitConfigData>('/org/product-unit-configs', payload);
        setConfig(result);
      }
      setConfigSuccess('Configuração salva com sucesso.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar configuração.';
      setConfigError(msg);
    } finally {
      setIsSavingConfig(false);
    }
  }, [productId, config, purchaseUnitId, stockUnitId, applicationUnitId, densityGPerMl]);

  const handleAddConversion = useCallback(async () => {
    if (!config) return;
    setIsAddingConversion(true);
    setConversionError(null);

    try {
      await api.post('/org/product-conversions', {
        productUnitConfigId: config.id,
        fromUnitId: newFromUnitId,
        toUnitId: newToUnitId,
        factor: Number(newFactor),
        description: newDescription.trim() || null,
      });
      setShowAddConversion(false);
      setNewFromUnitId('');
      setNewToUnitId('');
      setNewFactor('');
      setNewDescription('');
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conversão.';
      setConversionError(msg);
    } finally {
      setIsAddingConversion(false);
    }
  }, [config, newFromUnitId, newToUnitId, newFactor, newDescription, loadData]);

  const handleDeleteConversion = useCallback(
    async (conversionId: string) => {
      try {
        await api.delete(`/org/product-conversions/${conversionId}`);
        void loadData();
      } catch {
        // silent fail
      }
    },
    [loadData],
  );

  if (!isOpen) return null;

  const canAddConversion =
    newFromUnitId &&
    newToUnitId &&
    newFromUnitId !== newToUnitId &&
    Number(newFactor) > 0 &&
    !isAddingConversion;

  const fromUnit = units.find((u) => u.id === newFromUnitId);
  const toUnit = units.find((u) => u.id === newToUnitId);

  return (
    <div className="pc-modal__overlay" onClick={onClose}>
      <div
        className="pc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Conversões de ${productName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pc-modal__header">
          <div>
            <h2>Conversões do produto</h2>
            <p className="pc-modal__subtitle">{productName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <nav className="pc-modal__tabs" aria-label="Seções">
          <button
            className={activeTab === 'config' ? 'pc-modal__tab--active' : 'pc-modal__tab'}
            onClick={() => setActiveTab('config')}
            aria-current={activeTab === 'config' ? 'page' : undefined}
          >
            <Settings size={16} aria-hidden="true" />
            Unidades
          </button>
          <button
            className={activeTab === 'conversions' ? 'pc-modal__tab--active' : 'pc-modal__tab'}
            onClick={() => setActiveTab('conversions')}
            aria-current={activeTab === 'conversions' ? 'page' : undefined}
          >
            <ArrowRightLeft size={16} aria-hidden="true" />
            Conversões
          </button>
        </nav>

        <div className="pc-modal__body">
          {error && (
            <div className="pc-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="pc-modal__skeleton">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="pc-modal__skeleton-row" />
              ))}
            </div>
          )}

          {!isLoading && !error && activeTab === 'config' && (
            <div className="pc-modal__config-form">
              <p className="pc-modal__hint">
                Configure as unidades de compra, estoque e aplicação deste produto. Isso permite
                conversão automática entre unidades nas operações.
              </p>

              <div className="pc-modal__field">
                <label htmlFor="pc-purchase-unit">Unidade de compra</label>
                <select
                  id="pc-purchase-unit"
                  value={purchaseUnitId}
                  onChange={(e) => setPurchaseUnitId(e.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pc-modal__field">
                <label htmlFor="pc-stock-unit">Unidade de estoque</label>
                <select
                  id="pc-stock-unit"
                  value={stockUnitId}
                  onChange={(e) => setStockUnitId(e.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pc-modal__field">
                <label htmlFor="pc-app-unit">Unidade de aplicação</label>
                <select
                  id="pc-app-unit"
                  value={applicationUnitId}
                  onChange={(e) => setApplicationUnitId(e.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pc-modal__field">
                <label htmlFor="pc-density">Densidade (g/mL)</label>
                <input
                  id="pc-density"
                  type="number"
                  step="any"
                  min="0"
                  value={densityGPerMl}
                  onChange={(e) => setDensityGPerMl(e.target.value)}
                  placeholder="Ex: 1.05 (para converter peso ↔ volume)"
                />
              </div>

              {configError && (
                <div className="pc-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {configError}
                </div>
              )}

              {configSuccess && (
                <div className="pc-modal__success" role="status">
                  {configSuccess}
                </div>
              )}

              <button
                type="button"
                className="pc-modal__btn--primary"
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
              >
                {isSavingConfig
                  ? 'Salvando...'
                  : config
                    ? 'Salvar alterações'
                    : 'Criar configuração'}
              </button>
            </div>
          )}

          {!isLoading && !error && activeTab === 'conversions' && (
            <div className="pc-modal__conversions">
              {!config && (
                <div className="pc-modal__empty">
                  <Settings size={48} aria-hidden="true" />
                  <h3>Configure as unidades primeiro</h3>
                  <p>
                    Acesse a aba "Unidades" para definir as unidades de compra, estoque e aplicação
                    antes de adicionar conversões.
                  </p>
                </div>
              )}

              {config && (
                <>
                  {config.productConversions.length === 0 && !showAddConversion && (
                    <div className="pc-modal__empty">
                      <ArrowRightLeft size={48} aria-hidden="true" />
                      <h3>Nenhuma conversão específica</h3>
                      <p>
                        As conversões globais serão usadas. Adicione conversões específicas deste
                        produto se necessário.
                      </p>
                      <button
                        type="button"
                        className="pc-modal__btn--primary"
                        onClick={() => setShowAddConversion(true)}
                      >
                        <Plus size={20} aria-hidden="true" />
                        Adicionar conversão
                      </button>
                    </div>
                  )}

                  {config.productConversions.length > 0 && (
                    <>
                      <div className="pc-modal__conv-header">
                        <span className="pc-modal__conv-count">
                          {config.productConversions.length} conversão(ões)
                        </span>
                        <button
                          type="button"
                          className="pc-modal__btn--outline"
                          onClick={() => setShowAddConversion(true)}
                        >
                          <Plus size={16} aria-hidden="true" />
                          Nova
                        </button>
                      </div>

                      <table className="pc-modal__table">
                        <thead>
                          <tr>
                            <th scope="col">De</th>
                            <th scope="col">Para</th>
                            <th scope="col">Fator</th>
                            <th scope="col">Descrição</th>
                            <th scope="col">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {config.productConversions.map((conv) => (
                            <tr key={conv.id}>
                              <td data-label="De">{conv.fromUnitAbbreviation}</td>
                              <td data-label="Para">{conv.toUnitAbbreviation}</td>
                              <td data-label="Fator" className="pc-modal__mono">
                                {conv.factor}
                              </td>
                              <td data-label="Descrição">{conv.description ?? '—'}</td>
                              <td>
                                <button
                                  className="pc-modal__icon-btn"
                                  onClick={() => handleDeleteConversion(conv.id)}
                                  aria-label={`Excluir conversão de ${conv.fromUnitAbbreviation} para ${conv.toUnitAbbreviation}`}
                                >
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {showAddConversion && (
                    <div className="pc-modal__add-form">
                      <h4>Nova conversão para este produto</h4>

                      <div className="pc-modal__add-row">
                        <div className="pc-modal__field">
                          <label htmlFor="pc-new-from">
                            De <span aria-hidden="true">*</span>
                          </label>
                          <select
                            id="pc-new-from"
                            value={newFromUnitId}
                            onChange={(e) => setNewFromUnitId(e.target.value)}
                            aria-required="true"
                          >
                            <option value="">Selecione...</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.abbreviation})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="pc-modal__field">
                          <label htmlFor="pc-new-to">
                            Para <span aria-hidden="true">*</span>
                          </label>
                          <select
                            id="pc-new-to"
                            value={newToUnitId}
                            onChange={(e) => setNewToUnitId(e.target.value)}
                            aria-required="true"
                          >
                            <option value="">Selecione...</option>
                            {units
                              .filter((u) => u.id !== newFromUnitId)
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.abbreviation})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="pc-modal__add-row">
                        <div className="pc-modal__field">
                          <label htmlFor="pc-new-factor">
                            Fator <span aria-hidden="true">*</span>
                          </label>
                          <input
                            id="pc-new-factor"
                            type="number"
                            step="any"
                            min="0"
                            value={newFactor}
                            onChange={(e) => setNewFactor(e.target.value)}
                            aria-required="true"
                          />
                          {fromUnit && toUnit && Number(newFactor) > 0 && (
                            <p className="pc-modal__hint">
                              1 {fromUnit.abbreviation} = {Number(newFactor)} {toUnit.abbreviation}
                            </p>
                          )}
                        </div>

                        <div className="pc-modal__field">
                          <label htmlFor="pc-new-desc">Descrição</label>
                          <input
                            id="pc-new-desc"
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Ex: Saco de 60kg"
                          />
                        </div>
                      </div>

                      {conversionError && (
                        <div className="pc-modal__error" role="alert">
                          <AlertCircle size={16} aria-hidden="true" />
                          {conversionError}
                        </div>
                      )}

                      <div className="pc-modal__add-actions">
                        <button
                          type="button"
                          className="pc-modal__btn--ghost"
                          onClick={() => {
                            setShowAddConversion(false);
                            setConversionError(null);
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="pc-modal__btn--primary"
                          disabled={!canAddConversion}
                          onClick={handleAddConversion}
                        >
                          {isAddingConversion ? 'Salvando...' : 'Adicionar conversão'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <footer className="pc-modal__footer">
          <button type="button" className="pc-modal__btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
