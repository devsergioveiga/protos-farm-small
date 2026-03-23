import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { ASSET_TYPE_LABELS } from '@/types/asset';
import type { AssetType, CreateLeasingInput } from '@/types/asset';
import './AssetLeasingModal.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface AssetLeasingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateLeasingInput) => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AssetLeasingModal({ isOpen, onClose, onSubmit }: AssetLeasingModalProps) {
  const { farms } = useFarmContext();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Contract fields
  const [farmId, setFarmId] = useState('');
  const [lessorName, setLessorName] = useState('');
  const [lessorDocument, setLessorDocument] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractDate, setContractDate] = useState(today());
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');

  // ROU Asset fields
  const [assetType, setAssetType] = useState<string>('MAQUINA');
  const [assetName, setAssetName] = useState('');

  // Financial fields
  const [totalContractValue, setTotalContractValue] = useState('');
  const [installmentCount, setInstallmentCount] = useState('12');
  const [firstDueDate, setFirstDueDate] = useState('');

  // Purchase option fields
  const [hasPurchaseOption, setHasPurchaseOption] = useState(false);
  const [purchaseOptionValue, setPurchaseOptionValue] = useState('');
  const [purchaseOptionDate, setPurchaseOptionDate] = useState('');

  // Notes
  const [notes, setNotes] = useState('');

  // State
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFarmId(farms.length === 1 ? farms[0].id : '');
      setLessorName('');
      setLessorDocument('');
      setContractNumber('');
      setContractDate(today());
      setStartDate(today());
      setEndDate('');
      setAssetType('MAQUINA');
      setAssetName('');
      setTotalContractValue('');
      setInstallmentCount('12');
      setFirstDueDate('');
      setHasPurchaseOption(false);
      setPurchaseOptionValue('');
      setPurchaseOptionDate('');
      setNotes('');
      setFormError(null);
      setIsSubmitting(false);
      setTimeout(() => closeRef.current?.focus(), 100);
    }
  }, [isOpen, farms]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!farmId) {
      setFormError('Selecione uma fazenda.');
      return;
    }
    if (!lessorName.trim()) {
      setFormError('Nome do arrendador e obrigatorio.');
      return;
    }
    if (!contractDate) {
      setFormError('Data do contrato e obrigatoria.');
      return;
    }
    if (!startDate) {
      setFormError('Data de inicio e obrigatoria.');
      return;
    }
    if (!endDate) {
      setFormError('Data de termino e obrigatoria.');
      return;
    }
    if (endDate <= startDate) {
      setFormError('A data de termino deve ser posterior a data de inicio.');
      return;
    }
    if (!assetName.trim()) {
      setFormError('Nome do ativo e obrigatorio.');
      return;
    }
    const totalValue = parseFloat(totalContractValue);
    if (!totalContractValue || isNaN(totalValue) || totalValue <= 0) {
      setFormError('Valor total do contrato e obrigatorio e deve ser positivo.');
      return;
    }
    const installments = parseInt(installmentCount, 10);
    if (!installmentCount || isNaN(installments) || installments < 1) {
      setFormError('Numero de parcelas deve ser pelo menos 1.');
      return;
    }
    if (!firstDueDate) {
      setFormError('Data do primeiro vencimento e obrigatoria.');
      return;
    }

    const input: CreateLeasingInput = {
      farmId,
      assetType,
      assetName: assetName.trim(),
      lessorName: lessorName.trim(),
      contractDate,
      startDate,
      endDate,
      totalContractValue: totalValue,
      installmentCount: installments,
      firstDueDate,
    };

    if (lessorDocument.trim()) input.lessorDocument = lessorDocument.trim();
    if (contractNumber.trim()) input.contractNumber = contractNumber.trim();
    if (notes.trim()) input.notes = notes.trim();

    if (hasPurchaseOption) {
      input.hasPurchaseOption = true;
      const optionValue = parseFloat(purchaseOptionValue);
      if (!isNaN(optionValue) && optionValue > 0) {
        input.purchaseOptionValue = optionValue;
      }
      if (purchaseOptionDate) {
        input.purchaseOptionDate = purchaseOptionDate;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel criar o contrato. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="leasing-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leasing-modal-title"
    >
      <div className="leasing-modal">
        {/* Header */}
        <div className="leasing-modal__header">
          <h2 id="leasing-modal-title" className="leasing-modal__title">
            Novo Contrato de Leasing
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="leasing-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="leasing-modal__body">
            {/* ─── Contrato ─────────────────────────────────────── */}
            <section className="leasing-section">
              <h3 className="leasing-section__title">Contrato</h3>

              <div className="leasing-section__field">
                <label htmlFor="leasing-farm" className="leasing-section__label">
                  Fazenda *
                </label>
                <select
                  id="leasing-farm"
                  className="leasing-section__select"
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione uma fazenda</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="leasing-section__field">
                <label htmlFor="leasing-lessor" className="leasing-section__label">
                  Arrendador *
                </label>
                <input
                  id="leasing-lessor"
                  type="text"
                  className="leasing-section__input"
                  value={lessorName}
                  onChange={(e) => setLessorName(e.target.value)}
                  placeholder="Nome ou razao social do arrendador"
                  aria-required="true"
                />
              </div>

              <div className="leasing-section__row">
                <div className="leasing-section__field">
                  <label htmlFor="leasing-lessor-doc" className="leasing-section__label">
                    CPF / CNPJ
                  </label>
                  <input
                    id="leasing-lessor-doc"
                    type="text"
                    className="leasing-section__input"
                    value={lessorDocument}
                    onChange={(e) => setLessorDocument(e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="leasing-section__field">
                  <label htmlFor="leasing-contract-num" className="leasing-section__label">
                    Numero do Contrato
                  </label>
                  <input
                    id="leasing-contract-num"
                    type="text"
                    className="leasing-section__input"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ex: CT-2026-001"
                  />
                </div>
              </div>

              <div className="leasing-section__row">
                <div className="leasing-section__field">
                  <label htmlFor="leasing-contract-date" className="leasing-section__label">
                    Data do Contrato *
                  </label>
                  <input
                    id="leasing-contract-date"
                    type="date"
                    className="leasing-section__input"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                    aria-required="true"
                  />
                </div>
                <div className="leasing-section__field">
                  <label htmlFor="leasing-start-date" className="leasing-section__label">
                    Inicio da Vigencia *
                  </label>
                  <input
                    id="leasing-start-date"
                    type="date"
                    className="leasing-section__input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="leasing-section__field">
                <label htmlFor="leasing-end-date" className="leasing-section__label">
                  Termino da Vigencia *
                </label>
                <input
                  id="leasing-end-date"
                  type="date"
                  className="leasing-section__input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-required="true"
                />
              </div>
            </section>

            {/* ─── Ativo ROU ────────────────────────────────────── */}
            <section className="leasing-section">
              <h3 className="leasing-section__title">Ativo de Direito de Uso (ROU)</h3>

              <div className="leasing-section__row">
                <div className="leasing-section__field">
                  <label htmlFor="leasing-asset-type" className="leasing-section__label">
                    Tipo do Ativo *
                  </label>
                  <select
                    id="leasing-asset-type"
                    className="leasing-section__select"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    aria-required="true"
                  >
                    {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="leasing-section__field">
                  <label htmlFor="leasing-asset-name" className="leasing-section__label">
                    Nome do Ativo *
                  </label>
                  <input
                    id="leasing-asset-name"
                    type="text"
                    className="leasing-section__input"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="Ex: Trator John Deere 6130J"
                    aria-required="true"
                  />
                </div>
              </div>
            </section>

            {/* ─── Financeiro ───────────────────────────────────── */}
            <section className="leasing-section">
              <h3 className="leasing-section__title">Financeiro</h3>

              <div className="leasing-section__row">
                <div className="leasing-section__field">
                  <label htmlFor="leasing-total-value" className="leasing-section__label">
                    Valor Total do Contrato (R$) *
                  </label>
                  <input
                    id="leasing-total-value"
                    type="number"
                    min="0"
                    step="0.01"
                    className="leasing-section__input"
                    value={totalContractValue}
                    onChange={(e) => setTotalContractValue(e.target.value)}
                    placeholder="0,00"
                    aria-required="true"
                  />
                </div>
                <div className="leasing-section__field">
                  <label htmlFor="leasing-installments" className="leasing-section__label">
                    Numero de Parcelas *
                  </label>
                  <input
                    id="leasing-installments"
                    type="number"
                    min="1"
                    max="360"
                    className="leasing-section__input"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(e.target.value)}
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="leasing-section__field">
                <label htmlFor="leasing-first-due" className="leasing-section__label">
                  Primeiro Vencimento *
                </label>
                <input
                  id="leasing-first-due"
                  type="date"
                  className="leasing-section__input"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  aria-required="true"
                />
              </div>
            </section>

            {/* ─── Opcao de Compra ──────────────────────────────── */}
            <section className="leasing-section">
              <h3 className="leasing-section__title">Opcao de Compra</h3>

              <label className="leasing-section__checkbox-label">
                <input
                  type="checkbox"
                  checked={hasPurchaseOption}
                  onChange={(e) => setHasPurchaseOption(e.target.checked)}
                />
                Contrato possui opcao de compra
              </label>

              {hasPurchaseOption && (
                <div className="leasing-section__row">
                  <div className="leasing-section__field">
                    <label htmlFor="leasing-option-value" className="leasing-section__label">
                      Valor da Opcao (R$)
                    </label>
                    <input
                      id="leasing-option-value"
                      type="number"
                      min="0"
                      step="0.01"
                      className="leasing-section__input"
                      value={purchaseOptionValue}
                      onChange={(e) => setPurchaseOptionValue(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="leasing-section__field">
                    <label htmlFor="leasing-option-date" className="leasing-section__label">
                      Data Limite da Opcao
                    </label>
                    <input
                      id="leasing-option-date"
                      type="date"
                      className="leasing-section__input"
                      value={purchaseOptionDate}
                      onChange={(e) => setPurchaseOptionDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ─── Observacoes ──────────────────────────────────── */}
            <section className="leasing-section">
              <div className="leasing-section__field">
                <label htmlFor="leasing-notes" className="leasing-section__label">
                  Observacoes
                </label>
                <textarea
                  id="leasing-notes"
                  className="leasing-section__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Informacoes adicionais sobre o contrato..."
                />
              </div>
            </section>

            {/* Error */}
            {formError && (
              <div className="leasing-section__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="leasing-modal__footer">
            <button
              type="button"
              className="leasing-modal__btn leasing-modal__btn--cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="leasing-modal__btn leasing-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Criar Contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
