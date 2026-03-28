// ─── eSocial XSD Structural Validator (per D-06) ─────────────────────────────
// Validates generated XML against S-1.3 XSD constraints using @xmldom/xmldom.
// Returns inline errors with field path and message if validation fails.
// Blocks download if validation fails per D-06.

import { DOMParser } from '@xmldom/xmldom';
import { XSD_CONSTRAINTS } from './xsd-constraints';
import type { EsocialValidationError } from './esocial-events.types';

export function validateXmlAgainstXsd(
  eventType: string,
  xmlContent: string,
): EsocialValidationError[] {
  const constraints = XSD_CONSTRAINTS[eventType];
  if (!constraints) return []; // unknown event type — skip validation

  const errors: EsocialValidationError[] = [];

  // Parse XML using @xmldom/xmldom
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');

  // Check for XML parse errors
  const parseErrors = doc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    const errorText = parseErrors[0]?.textContent ?? 'XML malformado';
    errors.push({ field: 'xml', message: `XML malformado: ${errorText}` });
    return errors;
  }

  for (const constraint of constraints) {
    if (!constraint.required) continue;

    // Navigate DOM by path segments (skip root 'eSocial')
    const segments = constraint.path.split('/');
    let node: Element | null = doc.documentElement;

    for (let i = 1; i < segments.length && node !== null; i++) {
      const segment = segments[i];
      if (!segment) {
        node = null;
        break;
      }

      const nodeChildren: HTMLCollectionOf<Element> = (node as Element).getElementsByTagName(
        segment,
      ) as HTMLCollectionOf<Element>;
      node = nodeChildren.length > 0 ? (nodeChildren[0] as Element) : null;
    }

    if (!node) {
      const fieldName = segments[segments.length - 1] ?? constraint.path;
      errors.push({
        field: constraint.path,
        message: `Elemento obrigatorio ausente: ${fieldName}`,
      });
      continue;
    }

    const value = node.textContent ?? '';

    // Minimum length validation
    if (constraint.minLength !== undefined && value.length < constraint.minLength) {
      const fieldName = segments[segments.length - 1] ?? constraint.path;
      errors.push({
        field: constraint.path,
        message: `${fieldName}: tamanho minimo ${constraint.minLength} caracteres (atual: ${value.length})`,
      });
    }

    // Maximum length validation
    if (constraint.maxLength !== undefined && value.length > constraint.maxLength) {
      const fieldName = segments[segments.length - 1] ?? constraint.path;
      errors.push({
        field: constraint.path,
        message: `${fieldName}: tamanho maximo ${constraint.maxLength} caracteres (atual: ${value.length})`,
      });
    }

    // Pattern validation
    if (constraint.pattern && !new RegExp(constraint.pattern).test(value)) {
      const fieldName = segments[segments.length - 1] ?? constraint.path;
      errors.push({
        field: constraint.path,
        message: `${fieldName}: formato invalido (esperado: ${constraint.pattern})`,
      });
    }
  }

  return errors;
}
