/**
 * ConversionPreviewCard — Shows dose conversion preview inline in operation modals.
 * Implements US-095 CA4/CA9: preview before confirming stock consumption.
 */

import { useMemo } from 'react';
import { Calculator, Droplets } from 'lucide-react';
import {
  doseToAbsoluteQuantity,
  getBaseUnit,
  getDoseUnitLabel,
  formatQuantity,
  calculateSprayMix,
  type SprayMixResult,
} from '@/utils/dose-conversion';
import './ConversionPreviewCard.css';

interface ConversionPreviewCardProps {
  /** Dose per hectare (or per plant) */
  dose: number;
  /** Dose unit (L_HA, KG_HA, etc.) */
  doseUnit: string;
  /** Plot area in hectares */
  areaHa: number;
  /** Product name for display */
  productName?: string;
  /** Plants per hectare (for G_PLANTA) */
  plantsPerHa?: number;
  /** Spray volume in L/ha — enables spray mix calculation (CA7) */
  sprayVolumeLPerHa?: number;
  /** Tank capacity in liters (default 2000L) */
  tankCapacityL?: number;
}

function ConversionPreviewCard({
  dose,
  doseUnit,
  areaHa,
  productName,
  plantsPerHa,
  sprayVolumeLPerHa,
  tankCapacityL = 2000,
}: ConversionPreviewCardProps) {
  const totalQuantity = useMemo(() => {
    if (dose <= 0 || areaHa <= 0) return null;
    return doseToAbsoluteQuantity(dose, doseUnit, areaHa, plantsPerHa);
  }, [dose, doseUnit, areaHa, plantsPerHa]);

  const sprayMix: SprayMixResult | null = useMemo(() => {
    if (!sprayVolumeLPerHa) return null;
    return calculateSprayMix(dose, doseUnit, sprayVolumeLPerHa, areaHa, tankCapacityL);
  }, [dose, doseUnit, sprayVolumeLPerHa, areaHa, tankCapacityL]);

  if (totalQuantity == null || totalQuantity <= 0) return null;

  const baseUnit = getBaseUnit(doseUnit);
  const doseLabel = getDoseUnitLabel(doseUnit);
  const productLabel = productName ? ` de ${productName}` : '';

  return (
    <div className="conversion-preview" role="status" aria-live="polite">
      <div className="conversion-preview__header">
        <Calculator size={16} aria-hidden="true" />
        <span className="conversion-preview__title">Preview de consumo</span>
      </div>

      <div className="conversion-preview__content">
        {/* Main conversion (CA4/CA9) */}
        <div className="conversion-preview__calculation">
          <span className="conversion-preview__formula">
            {formatQuantity(dose)} {doseLabel} &times; {formatQuantity(areaHa)} ha
          </span>
          <span className="conversion-preview__equals">=</span>
          <span className="conversion-preview__result">
            {formatQuantity(totalQuantity)} {baseUnit}
            {productLabel}
          </span>
        </div>

        {/* Spray mix calculation (CA7) */}
        {sprayMix && (
          <div className="conversion-preview__spray">
            <div className="conversion-preview__spray-header">
              <Droplets size={14} aria-hidden="true" />
              <span>Calda</span>
            </div>
            <div className="conversion-preview__spray-grid">
              <div className="conversion-preview__spray-item">
                <span className="conversion-preview__spray-label">Volume total de calda</span>
                <span className="conversion-preview__spray-value">
                  {formatQuantity(sprayMix.totalSprayVolume)} L
                </span>
              </div>
              <div className="conversion-preview__spray-item">
                <span className="conversion-preview__spray-label">Tanques necessários</span>
                <span className="conversion-preview__spray-value">
                  {sprayMix.tanksNeeded} ({tankCapacityL} L/tanque)
                </span>
              </div>
              <div className="conversion-preview__spray-item">
                <span className="conversion-preview__spray-label">Produto por tanque</span>
                <span className="conversion-preview__spray-value">
                  {formatQuantity(sprayMix.productPerTank)} {baseUnit}
                </span>
              </div>
              <div className="conversion-preview__spray-item">
                <span className="conversion-preview__spray-label">Calda por tanque</span>
                <span className="conversion-preview__spray-value">
                  {formatQuantity(sprayMix.sprayVolumePerTank)} L
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversionPreviewCard;
