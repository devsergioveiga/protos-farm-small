import { useState } from 'react';
import { Wrench } from 'lucide-react';
import type { Asset } from '@/types/asset';
import { ASSET_TYPE_LABELS, ASSET_CLASSIFICATION_LABELS, ASSET_STATUS_LABELS } from '@/types/asset';
import AssetRenovationModal from './AssetRenovationModal';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: string | null | undefined): string {
  if (!value) return 'Nao informado';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Nao informado';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Nao informado';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return 'Nao informado';
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Nao informado';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return 'Nao informado';
  }
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const display = value || 'Nao informado';
  return (
    <div className="asset-general-tab__field">
      <span className="asset-general-tab__field-label">{label}</span>
      <span
        className={`asset-general-tab__field-value${!value ? ' asset-general-tab__field-value--muted' : ''}${mono ? ' asset-general-tab__field-value--mono' : ''}`}
      >
        {display}
      </span>
    </div>
  );
}

// ─── AssetGeneralTab ──────────────────────────────────────────────────

interface AssetGeneralTabProps {
  asset: Asset;
  onRefresh?: () => void;
}

export default function AssetGeneralTab({ asset, onRefresh }: AssetGeneralTabProps) {
  const [showRenovationModal, setShowRenovationModal] = useState(false);
  const canRenovate = asset.status === 'ATIVO' || asset.status === 'INATIVO';

  return (
    <div className="asset-general-tab">
      {/* Actions */}
      {canRenovate && (
        <div className="asset-general-tab__actions">
          <button
            type="button"
            className="asset-general-tab__action-btn"
            onClick={() => setShowRenovationModal(true)}
          >
            <Wrench size={16} aria-hidden="true" />
            Registrar Reforma
          </button>
        </div>
      )}

      {/* Dados Gerais */}
      <section className="asset-general-tab__section">
        <h3 className="asset-general-tab__section-title">Dados Gerais</h3>
        <div className="asset-general-tab__grid">
          <Field label="Nome" value={asset.name} />
          <Field label="Tipo" value={ASSET_TYPE_LABELS[asset.assetType]} />
          <Field
            label="Classificacao CPC"
            value={ASSET_CLASSIFICATION_LABELS[asset.classification]}
          />
          <Field label="Fazenda" value={asset.farm?.name} />
          <Field label="Status" value={ASSET_STATUS_LABELS[asset.status]} />
          {asset.description && <Field label="Descricao" value={asset.description} />}
        </div>
      </section>

      {/* Dados de Aquisicao */}
      <section className="asset-general-tab__section">
        <h3 className="asset-general-tab__section-title">Dados de Aquisicao</h3>
        <div className="asset-general-tab__grid">
          <Field label="Data de aquisicao" value={formatDate(asset.acquisitionDate)} />
          <Field label="Valor de aquisicao" value={formatBRL(asset.acquisitionValue)} />
          <Field label="Fornecedor" value={asset.supplier?.name} />
          <Field label="Numero da nota" value={asset.invoiceNumber} />
          <Field label="Centro de custo" value={asset.costCenter?.name} />
        </div>
      </section>

      {/* Dados Operacionais — condicional por tipo */}
      {asset.assetType === 'MAQUINA' && (
        <section className="asset-general-tab__section">
          <h3 className="asset-general-tab__section-title">Dados Operacionais — Maquina</h3>
          <div className="asset-general-tab__grid">
            <Field label="Potencia (HP)" value={asset.engineHp ? `${asset.engineHp} HP` : null} />
            <Field label="Tipo de combustivel" value={asset.fuelType} />
            <Field label="Fabricante" value={asset.manufacturer} />
            <Field label="Modelo" value={asset.model} />
            <Field
              label="Ano"
              value={asset.yearOfManufacture ? String(asset.yearOfManufacture) : null}
            />
            <Field label="Numero de serie" value={asset.serialNumber} mono />
            <Field
              label="Horimetro atual"
              value={asset.currentHourmeter ? `${asset.currentHourmeter} h` : null}
            />
          </div>
        </section>
      )}

      {asset.assetType === 'VEICULO' && (
        <section className="asset-general-tab__section">
          <h3 className="asset-general-tab__section-title">Dados Operacionais — Veiculo</h3>
          <div className="asset-general-tab__grid">
            <Field label="RENAVAM" value={asset.renavamCode} mono />
            <Field label="Placa" value={asset.licensePlate} mono />
            <Field label="Fabricante" value={asset.manufacturer} />
            <Field label="Modelo" value={asset.model} />
            <Field
              label="Ano"
              value={asset.yearOfManufacture ? String(asset.yearOfManufacture) : null}
            />
            <Field label="Tipo de combustivel" value={asset.fuelType} />
            <Field
              label="Odometro atual"
              value={asset.currentOdometer ? `${asset.currentOdometer} km` : null}
            />
          </div>
        </section>
      )}

      {asset.assetType === 'IMPLEMENTO' && (
        <section className="asset-general-tab__section">
          <h3 className="asset-general-tab__section-title">Dados Operacionais — Implemento</h3>
          <div className="asset-general-tab__grid">
            <Field label="Fabricante" value={asset.manufacturer} />
            <Field label="Modelo" value={asset.model} />
            <Field
              label="Ano"
              value={asset.yearOfManufacture ? String(asset.yearOfManufacture) : null}
            />
            <Field label="Numero de serie" value={asset.serialNumber} mono />
            {asset.parentAsset && (
              <div className="asset-general-tab__field">
                <span className="asset-general-tab__field-label">Maquina principal</span>
                <span className="asset-general-tab__field-value">
                  {asset.parentAsset.name}{' '}
                  <span className="asset-general-tab__field-value--mono">
                    {asset.parentAsset.assetTag}
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {asset.assetType === 'BENFEITORIA' && (
        <section className="asset-general-tab__section">
          <h3 className="asset-general-tab__section-title">Dados Operacionais — Benfeitoria</h3>
          <div className="asset-general-tab__grid">
            <Field label="Material de construcao" value={asset.constructionMaterial} />
            <Field label="Area (m²)" value={asset.areaM2 ? `${asset.areaM2} m²` : null} />
            <Field label="Capacidade" value={asset.capacity} />
          </div>
        </section>
      )}

      {asset.assetType === 'TERRA' && (
        <section className="asset-general-tab__section">
          <h3 className="asset-general-tab__section-title">Dados Operacionais — Terra</h3>
          <div className="asset-general-tab__grid">
            <Field label="Matricula" value={asset.registrationNumber} mono />
            <Field label="Area (ha)" value={asset.areaHa ? `${asset.areaHa} ha` : null} />
            <Field label="Codigo CAR" value={asset.carCode} mono />
          </div>
        </section>
      )}

      {/* Fotos */}
      <section className="asset-general-tab__section">
        <h3 className="asset-general-tab__section-title">Fotos</h3>
        {asset.photoUrls && asset.photoUrls.length > 0 ? (
          <div className="asset-general-tab__photos">
            {asset.photoUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="asset-general-tab__photo-link"
                aria-label={`Ver foto ${idx + 1} do ativo`}
              >
                <img
                  src={url}
                  alt={`Foto ${idx + 1} do ativo ${asset.name}`}
                  className="asset-general-tab__photo"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="asset-general-tab__photos-empty">Nenhuma foto cadastrada.</p>
        )}
      </section>

      {/* Ativos vinculados (MAQUINA com filhos) */}
      {asset.assetType === 'MAQUINA' && asset.childAssets && asset.childAssets.length > 0 && (
        <section className="asset-general-tab__section">
          <h3 className="asset-general-tab__section-title">Implementos vinculados</h3>
          <ul className="asset-general-tab__children">
            {asset.childAssets.map((child) => (
              <li key={child.id} className="asset-general-tab__child">
                <span className="asset-general-tab__child-name">{child.name}</span>
                <span className="asset-general-tab__child-tag">{child.assetTag}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline basica */}
      <section className="asset-general-tab__section">
        <h3 className="asset-general-tab__section-title">Registro</h3>
        <div className="asset-general-tab__grid">
          <Field label="Cadastrado em" value={formatDateTime(asset.createdAt)} />
          <Field label="Ultima atualizacao" value={formatDateTime(asset.updatedAt)} />
        </div>
      </section>

      {/* Renovation modal */}
      {showRenovationModal && (
        <AssetRenovationModal
          isOpen={showRenovationModal}
          onClose={() => setShowRenovationModal(false)}
          onSuccess={() => {
            setShowRenovationModal(false);
            onRefresh?.();
          }}
          assetId={asset.id}
        />
      )}
    </div>
  );
}
