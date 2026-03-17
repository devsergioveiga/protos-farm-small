import { DOMParser } from '@xmldom/xmldom';
import { ReconciliationError } from './reconciliation.types';
import type { OfxDocument, OfxTransaction } from './reconciliation.types';

const MAX_TRANSACTIONS = 5000;

// ─── Tag Extraction ───────────────────────────────────────────────────

/**
 * Extracts a tag value from OFX content.
 * Matches both:
 *   - OFX 1.x unclosed:  <TAG>VALUE\n
 *   - OFX 2.x XML:       <TAG>VALUE</TAG>
 */
function extractTag(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  return content.match(regex)?.[1]?.trim();
}

// ─── Date Parsing ─────────────────────────────────────────────────────

/**
 * Parse OFX date format: YYYYMMDDHHMMSS[offset:timezone]
 * Examples:
 *   "20260315120000[-03:SAO]"
 *   "20260315120000"
 *   "20260315"
 */
export function parseOfxDate(dateStr: string): Date {
  // Strip timezone bracket: [-03:SAO] or [+00:UTC]
  const clean = dateStr.replace(/\[.*?\]/, '').trim();

  const year = parseInt(clean.slice(0, 4), 10);
  const month = parseInt(clean.slice(4, 6), 10) - 1;
  const day = parseInt(clean.slice(6, 8), 10);
  const hour = clean.length >= 10 ? parseInt(clean.slice(8, 10), 10) : 0;
  const min = clean.length >= 12 ? parseInt(clean.slice(10, 12), 10) : 0;
  const sec = clean.length >= 14 ? parseInt(clean.slice(12, 14), 10) : 0;

  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

// ─── OFX 1.x SGML Parser ─────────────────────────────────────────────

function parseOfx1(content: string): OfxDocument {
  // Strip SGML header (lines before <OFX>)
  const headerEnd = content.indexOf('<OFX>');
  const body = headerEnd >= 0 ? content.slice(headerEnd) : content;

  // Extract BANKID + ACCTID for auto-detect from BANKACCTFROM block
  const bankId = extractTag(body, 'BANKID');
  const acctId = extractTag(body, 'ACCTID');

  // Extract STMTTRN blocks
  const transactions: OfxTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;
  while ((match = stmtTrnRegex.exec(body)) !== null) {
    const block = match[1];
    const trntype = extractTag(block, 'TRNTYPE') ?? 'DEBIT';
    const dtpostedStr = extractTag(block, 'DTPOSTED') ?? '';
    const trnamtStr = extractTag(block, 'TRNAMT') ?? '0';
    const fitid = extractTag(block, 'FITID') ?? '';
    const memo = extractTag(block, 'MEMO') ?? extractTag(block, 'NAME') ?? '';

    transactions.push({
      trntype,
      dtposted: parseOfxDate(dtpostedStr),
      trnamt: parseFloat(trnamtStr),
      fitid,
      memo,
    });
  }

  if (transactions.length > MAX_TRANSACTIONS) {
    throw new ReconciliationError(`Arquivo excede o limite de ${MAX_TRANSACTIONS} transações`, 400);
  }

  return { bankId, acctId, transactions };
}

// ─── OFX 2.x XML Parser ──────────────────────────────────────────────

function parseOfx2(content: string): OfxDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');

  function getTextContent(tag: string): string | undefined {
    const elements = doc.getElementsByTagName(tag);
    return elements.length > 0 ? elements[0].textContent?.trim() : undefined;
  }

  const bankId = getTextContent('BANKID');
  const acctId = getTextContent('ACCTID');

  const stmtTrnElements = doc.getElementsByTagName('STMTTRN');
  const transactions: OfxTransaction[] = [];

  for (let i = 0; i < stmtTrnElements.length; i++) {
    const el = stmtTrnElements[i];

    function childText(tag: string): string | undefined {
      const children = el.getElementsByTagName(tag);
      return children.length > 0 ? children[0].textContent?.trim() : undefined;
    }

    const trntype = childText('TRNTYPE') ?? 'DEBIT';
    const dtpostedStr = childText('DTPOSTED') ?? '';
    const trnamtStr = childText('TRNAMT') ?? '0';
    const fitid = childText('FITID') ?? '';
    const memo = childText('MEMO') ?? childText('NAME') ?? '';

    transactions.push({
      trntype,
      dtposted: parseOfxDate(dtpostedStr),
      trnamt: parseFloat(trnamtStr),
      fitid,
      memo,
    });
  }

  if (transactions.length > MAX_TRANSACTIONS) {
    throw new ReconciliationError(`Arquivo excede o limite de ${MAX_TRANSACTIONS} transações`, 400);
  }

  return { bankId, acctId, transactions };
}

// ─── Public Parser ────────────────────────────────────────────────────

/**
 * Parse an OFX file content (either 1.x SGML or 2.x XML).
 * Detects version by checking for OFXHEADER: (1.x) vs <?OFX or <?xml (2.x).
 */
export function parseOfx(content: string): OfxDocument {
  const trimmed = content.trimStart();

  if (trimmed.startsWith('<?OFX') || trimmed.startsWith('<?xml')) {
    return parseOfx2(content);
  }

  // OFX 1.x has OFXHEADER: in the first lines
  if (trimmed.toUpperCase().startsWith('OFXHEADER:') || trimmed.includes('OFXHEADER:')) {
    return parseOfx1(content);
  }

  // Fallback: try 1.x SGML parser
  return parseOfx1(content);
}
