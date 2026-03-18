import { logger } from '../../../shared/utils/logger';
import { parseCafir } from './cafir-parser';
import { parseCcir } from './ccir-parser';
import { parseDitr } from './ditr-parser';
import { parseCarReceipt } from './car-receipt-parser';

interface ExtractionResult {
  status: 'EXTRACTED' | 'FAILED';
  data: unknown;
}

export async function extractFromDocument(
  type: string,
  fileData: Buffer,
  mimeType: string | null,
): Promise<ExtractionResult> {
  // Only extract from PDFs
  if (mimeType !== 'application/pdf') {
    return { status: 'FAILED', data: { reason: 'Extração disponível apenas para PDF' } };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(fileData);
    const text = parsed.text;

    if (!text || text.trim().length < 50) {
      return {
        status: 'FAILED',
        data: { reason: 'PDF sem texto extraível (possivelmente escaneado)' },
      };
    }

    let extracted: unknown;

    switch (type) {
      case 'CAFIR':
        extracted = parseCafir(text);
        break;
      case 'CCIR':
        extracted = parseCcir(text);
        break;
      case 'DITR':
        extracted = parseDitr(text);
        break;
      case 'CAR_RECEIPT':
        extracted = parseCarReceipt(text);
        break;
      default:
        return { status: 'FAILED', data: { reason: `Extração não disponível para tipo ${type}` } };
    }

    logger.info({ type }, 'Document data extracted successfully');
    return { status: 'EXTRACTED', data: extracted };
  } catch (err) {
    logger.warn({ type, error: (err as Error).message }, 'Document extraction failed');
    return { status: 'FAILED', data: { reason: (err as Error).message } };
  }
}
