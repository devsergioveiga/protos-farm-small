/**
 * ConversionPreviewCard — Shows dose conversion preview inline in operation modals.
 * Implements US-095 CA4/CA9: preview before confirming stock consumption.
 * CA12: inline alert when conversion is not configured, with link to configure.
 */

import { useMemo, useState, useEffect } from 'react';
import { Calculator, Droplets, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  doseToAbsoluteQuantity,
  getBaseUnit,
  getDoseUnitLabel,
  formatQuantity,
  calculateSprayMix,
  type SprayMixResult,
} from '@/utils/dose-conversion';
import { api } from '@/services/api';
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
  /** Product ID — when provided, validates conversion availability (CA12) */
  productId?: string | null;
}

/** Validation result shape from GET /org/unit-conversions/validate */
interface ValidationResult {
  valid: boolean;
  fromUnit: string;
  toUnit: string;
  message: string | null;
}

function ConversionPreviewCard({
  dose,
  doseUnit,
  areaHa,
  productName,
  plantsPerHa,
  sprayVolumeLPerHa,
  tankCapacityL = 2000,
  productId,
}: ConversionPreviewCardProps) {
  const navigate = useNavigate();
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const totalQuantity = useMemo(() => {
    if (dose <= 0 || areaHa <= 0) return null;
    return doseToAbsoluteQuantity(dose, doseUnit, areaHa, plantsPerHa);
  }, [dose, doseUnit, areaHa, plantsPerHa]);

  const sprayMix: SprayMixResult | null = useMemo(() => {
    if (!sprayVolumeLPerHa) return null;
    return calculateSprayMix(dose, doseUnit, sprayVolumeLPerHa, areaHa, tankCapacityL);
  }, [dose, doseUnit, sprayVolumeLPerHa, areaHa, tankCapacityL]);

  // CA12: Validate conversion when productId is linked
  const baseUnitAbbr = productId && doseUnit ? getBaseUnit(doseUnit) : null;
  const shouldValidate = !!(productId && doseUnit && baseUnitAbbr);

  useEffect(() => {
    if (!shouldValidate || !productId || !baseUnitAbbr) return;

    let cancelled = false;
    const qs = new URLSearchParams({
      fromUnitId: doseUnit,
      toUnitId: baseUnitAbbr,
      productId,
    });

    api
      .get<ValidationResult>(`/org/unit-conversions/validate?${qs}`)
      .then((result) => {
        if (!cancelled) {
          setValidationWarning(result.valid ? null : result.message);
        }
      })
      .catch(() => {
        // Don't block the user on validation errors
        if (!cancelled) setValidationWarning(null);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldValidate, productId, doseUnit, baseUnitAbbr]);

  // Clear warning when validation preconditions are not met
  const effectiveWarning = shouldValidate ? validationWarning : null;

  if (totalQuantity == null || totalQuantity <= 0) {
    // Even if no quantity, show validation warning if present (CA12)
    if (effectiveWarning) {
      return (
        <div
          className="conversion-preview conversion-preview--warning"
          role="alert"
          aria-live="polite"
        >
          <div className="conversion-preview__warning">
            <AlertTriangle size={16} aria-hidden="true" />
            <div className="conversion-preview__warning-content">
              <span>{effectiveWarning}</span>
              <button
                type="button"
                className="conversion-preview__configure-link"
                onClick={() => navigate('/measurement-units')}
              >
                Configurar conversão
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

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
        {/* CA12: Validation warning */}
        {effectiveWarning && (
          <div className="conversion-preview__warning" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div className="conversion-preview__warning-content">
              <span>{effectiveWarning}</span>
              <button
                type="button"
                className="conversion-preview__configure-link"
                onClick={() => navigate('/measurement-units')}
              >
                Configurar conversão
              </button>
            </div>
          </div>
        )}

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
