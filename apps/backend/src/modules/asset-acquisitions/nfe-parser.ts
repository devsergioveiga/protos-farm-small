import { DOMParser } from '@xmldom/xmldom';
import Decimal from 'decimal.js';
import type { NfeParsedData, NfeItem } from './asset-acquisitions.types';

// ─── Tag Extraction ─────────────────────────────────────────────────

/**
 * Returns the first text content of a tag in a Document, or null if not found.
 */
function getTag(doc: Document, tag: string): string | null {
  const elements = doc.getElementsByTagName(tag);
  if (elements.length === 0) return null;
  const text = elements[0].textContent?.trim() ?? null;
  return text && text.length > 0 ? text : null;
}

/**
 * Returns the first text content of a tag within an Element, or null if not found.
 */
function getChildTag(element: Element, tag: string): string | null {
  const elements = element.getElementsByTagName(tag);
  if (elements.length === 0) return null;
  const text = elements[0].textContent?.trim() ?? null;
  return text && text.length > 0 ? text : null;
}

// ─── NF-e XML Parser ────────────────────────────────────────────────

/**
 * Parses NF-e v4.0 XML (both bare NFe root and nfeProc wrapper).
 * Returns NfeParsedData with graceful null for missing tags.
 */
export function parseNfeXml(xmlString: string): NfeParsedData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml') as unknown as Document;

  // Extract scalar fields
  const supplierName = getTag(doc, 'xNome');
  const supplierCnpj = getTag(doc, 'CNPJ');
  const invoiceNumber = getTag(doc, 'nNF');
  const issueDate = getTag(doc, 'dhEmi');
  const totalNf = getTag(doc, 'vNF');
  const totalProducts = getTag(doc, 'vProd');
  const freight = getTag(doc, 'vFrete');
  const insurance = getTag(doc, 'vSeg');
  const otherCosts = getTag(doc, 'vOutro');

  // Extract det elements (items)
  const detElements = doc.getElementsByTagName('det');
  const items: NfeItem[] = [];

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i] as unknown as Element;
    const xProd = getChildTag(det, 'xProd');
    const vProd = getChildTag(det, 'vProd');
    const ncm = getChildTag(det, 'NCM');
    const qCom = getChildTag(det, 'qCom');
    const uCom = getChildTag(det, 'uCom');

    items.push({
      description: xProd ?? '',
      value: vProd != null ? parseFloat(vProd) : 0,
      ncm,
      quantity: qCom != null ? parseFloat(qCom) : 0,
      unit: uCom,
    });
  }

  return {
    supplierName,
    supplierCnpj,
    invoiceNumber,
    issueDate,
    totalNf,
    totalProducts,
    freight,
    insurance,
    otherCosts,
    items,
  };
}

// ─── Rateio Calculation ─────────────────────────────────────────────

/**
 * Distributes accessory expenses (freight, insurance, otherCosts) proportionally
 * to each item's value (vProd).
 *
 * Cent residual allocation:
 * - Items 1..N get floor(proportion * total_accessory) to 2 decimal places
 * - Item 0 gets the residual (total_accessory minus sum of items 1..N)
 * - Guarantees: sum of returned values equals vProd_total + freight + insurance + otherCosts
 *
 * @param items - NfeItem array with value (vProd) for each item
 * @param freight - Freight value (vFrete)
 * @param insurance - Insurance value (vSeg)
 * @param otherCosts - Other costs value (vOutro)
 * @returns Array of acquisition values (item.value + allocated accessory)
 */
export function calculateRateio(
  items: NfeItem[],
  freight: number,
  insurance: number,
  otherCosts: number,
): number[] {
  if (items.length === 0) return [];

  const totalAccessory = new Decimal(freight).plus(insurance).plus(otherCosts);
  const totalVProd = items.reduce((acc, item) => acc.plus(new Decimal(item.value)), new Decimal(0));

  if (totalAccessory.isZero() || totalVProd.isZero()) {
    return items.map((item) => item.value);
  }

  // Allocate to items 1..N (round down to 2 decimals)
  const allocated: Decimal[] = new Array(items.length).fill(new Decimal(0));
  let sumAllocated = new Decimal(0);

  for (let i = 1; i < items.length; i++) {
    const proportion = new Decimal(items[i].value).dividedBy(totalVProd);
    const alloc = totalAccessory.times(proportion).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    allocated[i] = alloc;
    sumAllocated = sumAllocated.plus(alloc);
  }

  // Item 0 gets the residual
  allocated[0] = totalAccessory.minus(sumAllocated);

  // Return item.value + allocated accessory for each item
  return items.map((item, i) => {
    return new Decimal(item.value).plus(allocated[i]).toNumber();
  });
}
