// ─── Sicoob CNAB 240/400 Adapter ─────────────────────────────────────────
//
// Implements CNAB 240 (Pagamento) and CNAB 400 layouts for Sicoob (756).
// Key difference from BB: Sicoob CNAB 240 File Header positions 53-72
// contain "Banco Cooperado" identification field not present in BB layout.
// Based on FEBRABAN CNAB 240 base spec with Sicoob customizations.

import type {
  CnabAdapter,
  CnabHeaderData,
  CnabPaymentRecord,
  CnabReturnRecord,
} from '../cnab.adapter';
import {
  padLeft,
  padRight,
  formatDate,
  formatAmount,
  blanks,
  zeros,
  digitsOnly,
} from '../cnab.generator';
import {
  sliceField,
  sliceFieldTrimmed,
  parseDateFromCnab,
  parseAmountFromCnab,
} from '../cnab.parser';

// ─── Sicoob Return Status Codes ───────────────────────────────────────────

const SICOOB_STATUS_MAP: Record<string, CnabReturnRecord['status']> = {
  '00': 'LIQUIDATED', // Crédito em conta-corrente
  '01': 'LIQUIDATED', // Compensação eletrônica
  '02': 'LIQUIDATED', // Compensação manual
  '03': 'LIQUIDATED', // Movimento em cartório efetuado
  '06': 'RETURNED', // Liquidação de título cancelado ou baixado
  '09': 'RETURNED', // Baixado automaticamente via arquivo
  '10': 'RETURNED', // Baixado conforme instruções da agência
  '11': 'RETURNED', // Em liquidação
  '12': 'RETURNED', // Abatimento concedido
  '13': 'RETURNED', // Abatimento cancelado
  '14': 'RETURNED', // Vencimento alterado
  '15': 'RETURNED', // Desconto concedido
  '16': 'RETURNED', // Desconto cancelado
  '17': 'RETURNED', // Liquidado com desconto
  '18': 'REJECTED', // Acerto de depositária
  '19': 'REJECTED', // Confirmação de recebimento
  '20': 'REJECTED', // Débito em conta rejeitado
  '21': 'REJECTED', // Instrução rejeitada
  '23': 'REJECTED', // Ocorrência do sacado
  '24': 'RETURNED', // Confirmação de retirada de cartório
  '25': 'REJECTED', // Protesto cancelado
  '27': 'REJECTED', // Sobrestamento do título protestado
  '28': 'REJECTED', // Devolução de título protestado
  '30': 'REJECTED', // Alteração de outros dados rejeitados
};

function mapSicoobStatus(code: string): CnabReturnRecord['status'] {
  return SICOOB_STATUS_MAP[code] ?? 'REJECTED';
}

// ─── CNAB 240 Generation ──────────────────────────────────────────────────

function buildHeader240(headerData: CnabHeaderData, totalRecords: number): string {
  const doc = digitsOnly(headerData.companyDocument);
  const isCnpj = doc.length === 14;

  // Sicoob File Header CNAB 240 — 240 chars
  // KEY DIFFERENCE from BB: Positions 53-72 contain "Banco Cooperado" identification
  // instead of BB's layout at those positions.
  //
  // Pos  1-3:   Banco (756)
  // Pos  4-7:   Lote (0000)
  // Pos  8:     Registro tipo (0)
  // Pos  9-17:  Branco
  // Pos 18:     Tipo inscrição empresa
  // Pos 19-32:  CNPJ/CPF empresa
  // Pos 33-52:  Convênio/contrato
  // Pos 53-57:  Cooperativa (Banco Cooperado — Sicoob-specific field)
  // Pos 58-62:  Agência posto
  // Pos 63-64:  Branco
  // Pos 65-70:  Conta corrente (6 dígitos)
  // Pos 71:     Dígito conta
  // Pos 72:     Branco
  // Pos 73-102: Nome empresa
  // Pos 103-132: Nome banco (SICOOB)
  // Pos 133-142: Branco
  // Pos 143:    Código remessa (1=remessa)
  // Pos 144-151: Data geração
  // Pos 152-157: Hora geração
  // Pos 158-163: Sequencial arquivo
  // Pos 164-166: Versão layout (040)
  // Pos 167-171: Densidade (01600)
  // Pos 172-191: Reservado banco
  // Pos 192-211: Reservado empresa
  // Pos 212-217: Quantidade de registros
  // Pos 218-240: Reservado

  const line =
    '756' + // 1-3 (Sicoob)
    '0000' + // 4-7
    '0' + // 8
    blanks(9) + // 9-17
    (isCnpj ? '2' : '1') + // 18
    padLeft(doc, 14) + // 19-32
    padRight(headerData.convenioCode, 20) + // 33-52
    padLeft('756', 5) + // 53-57 (Banco Cooperado — SICOOB 756)
    padLeft(digitsOnly(headerData.agency), 5) + // 58-62 (Agência)
    blanks(2) + // 63-64
    padLeft(digitsOnly(headerData.accountNumber), 6) + // 65-70 (Conta — Sicoob usa 6 dígitos)
    padRight(headerData.accountDigit ?? ' ', 1) + // 71
    ' ' + // 72
    padRight(headerData.companyName, 30) + // 73-102
    padRight('SICOOB', 30) + // 103-132
    blanks(10) + // 133-142
    '1' + // 143 (remessa)
    formatDate(headerData.fileDate, 'DDMMYYYY') + // 144-151
    zeros(6) + // 152-157 (hora)
    padLeft(headerData.sequentialNumber, 6) + // 158-163
    '040' + // 164-166 (versão Sicoob)
    '01600' + // 167-171
    blanks(20) + // 172-191
    blanks(20) + // 192-211
    padLeft(totalRecords, 6) + // 212-217
    blanks(23); // 218-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildLotHeader240(headerData: CnabHeaderData, lotNumber: number): string {
  const doc = digitsOnly(headerData.companyDocument);
  const isCnpj = doc.length === 14;

  // Sicoob Lot Header CNAB 240 — 240 chars
  const lotStr = padLeft(lotNumber, 4);

  const line =
    '756' + // 1-3
    lotStr + // 4-7
    '1' + // 8
    'C' + // 9 (crédito)
    '20' + // 10-11 (pagamento fornecedores Sicoob)
    '01' + // 12-13 (TED)
    '030' + // 14-16 (versão lote Sicoob)
    ' ' + // 17
    (isCnpj ? '2' : '1') + // 18
    padLeft(doc, 14) + // 19-32
    padRight(headerData.convenioCode, 20) + // 33-52
    padLeft('756', 5) + // 53-57 (banco cooperado)
    padLeft(digitsOnly(headerData.agency), 5) + // 58-62
    blanks(2) + // 63-64
    padLeft(digitsOnly(headerData.accountNumber), 6) + // 65-70
    padRight(headerData.accountDigit ?? ' ', 1) + // 71
    ' ' + // 72
    padRight(headerData.companyName, 30) + // 73-102
    blanks(40) + // 103-142
    blanks(40) + // 143-182
    padLeft(headerData.sequentialNumber, 13) + // 183-195
    formatDate(headerData.fileDate, 'DDMMYYYY') + // 196-203
    zeros(8) + // 204-211 (data crédito)
    blanks(29); // 212-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildSegmentA(
  headerData: CnabHeaderData,
  payment: CnabPaymentRecord,
  lotNumber: number,
  seqInLot: number,
): string {
  // Segment A — Sicoob uses Segment A for pagamento TED/DOC (not P/Q like BB)
  // Pos  1-3:   Banco (756)
  // Pos  4-7:   Lote
  // Pos  8:     Registro tipo (3)
  // Pos  9-13:  Sequencial
  // Pos 14:     Segmento (A)
  // Pos 15:     Branco
  // Pos 16-17:  Código de movimento (00=inclusão)
  // Pos 18-20:  Banco favorecido
  // Pos 21-25:  Agência favorecido
  // Pos 26:     Dígito agência favorecido
  // Pos 27-38:  Conta favorecido
  // Pos 39:     Dígito conta favorecido
  // Pos 40:     Branco
  // Pos 41-70:  Nome favorecido
  // Pos 71-90:  Número do documento empresa
  // Pos 91-98:  Data do pagamento (DDMMYYYY)
  // Pos 99-101: Tipo da moeda (BRL)
  // Pos 102-114: Quantidade de moeda
  // Pos 115-129: Valor do pagamento
  // Pos 130-142: Nosso número
  // Pos 143-147: Branco
  // Pos 148-162: Valor do desconto
  // Pos 163-177: Valor de juros/multa/encargos
  // Pos 178-178: Código de finalidade da TED (branco)
  // Pos 179-192: Branco
  // Pos 193-202: Número do documento favorecido (CPF/CNPJ)
  // Pos 203-209: Finalidade DOC/TED
  // Pos 210-219: Uso exclusivo FEBRABAN/CNAB
  // Pos 220-229: Aviso ao favorecido
  // Pos 230-240: Branco

  const ourNumber = padLeft(payment.payableId.replace(/-/g, '').slice(0, 13), 13);
  const docNumber = padRight(payment.documentNumber ?? blanks(20), 20);

  const line =
    '756' + // 1-3
    padLeft(lotNumber, 4) + // 4-7
    '3' + // 8
    padLeft(seqInLot, 5) + // 9-13
    'A' + // 14
    ' ' + // 15
    '00' + // 16-17 (inclusão)
    padLeft(payment.bankCode ?? '756', 3) + // 18-20
    padLeft(digitsOnly(payment.agency ?? headerData.agency), 5) + // 21-25
    padRight(payment.agencyDigit ?? ' ', 1) + // 26
    padLeft(digitsOnly(payment.accountNumber ?? headerData.accountNumber), 12) + // 27-38
    padRight(payment.accountDigit ?? ' ', 1) + // 39
    ' ' + // 40
    padRight(payment.supplierName, 30) + // 41-70
    docNumber + // 71-90
    formatDate(payment.dueDate, 'DDMMYYYY') + // 91-98
    'BRL' + // 99-101
    zeros(15) + // 102-116 (qtd moeda — zeros para reais)
    formatAmount(payment.amount, 15) + // 117-131
    ourNumber + // 132-144
    blanks(5) + // 145-149
    zeros(15) + // 150-164 (desconto)
    zeros(15) + // 165-179 (juros)
    ' ' + // 180
    blanks(14) + // 181-194
    blanks(10) + // 195-204 (doc favorecido CPF/CNPJ)
    blanks(36); // 205-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildSegmentB(payment: CnabPaymentRecord, lotNumber: number, seqInLot: number): string {
  // Segment B — Informações complementares do favorecido — Sicoob
  const doc = digitsOnly(payment.supplierDocument ?? '');
  const isCnpj = doc.length === 14;

  const line =
    '756' + // 1-3
    padLeft(lotNumber, 4) + // 4-7
    '3' + // 8
    padLeft(seqInLot, 5) + // 9-13
    'B' + // 14
    ' ' + // 15
    '00' + // 16-17
    (doc.length >= 11 ? (isCnpj ? '2' : '1') : '0') + // 18
    padLeft(doc, 14) + // 19-32
    padRight(payment.supplierName, 30) + // 33-62
    blanks(178); // 63-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildLotTrailer240(lotNumber: number, recordCount: number, totalAmount: number): string {
  const line =
    '756' + // 1-3
    padLeft(lotNumber, 4) + // 4-7
    '5' + // 8
    blanks(9) + // 9-17
    padLeft(recordCount + 2, 6) + // 18-23
    padLeft(Math.floor(recordCount / 2), 6) + // 24-29
    formatAmount(totalAmount, 18) + // 30-47
    zeros(6) + // 48-53
    blanks(165) + // 54-218
    blanks(22); // 219-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildFileTrailer240(totalLots: number, totalRecords: number): string {
  const line =
    '756' + // 1-3
    '9999' + // 4-7
    '9' + // 8
    blanks(9) + // 9-17
    padLeft(totalLots, 6) + // 18-23
    padLeft(totalRecords + 2, 6) + // 24-29
    zeros(6) + // 30-35
    blanks(205); // 36-240

  return line.slice(0, 240).padEnd(240, ' ');
}

// ─── CNAB 400 Generation ──────────────────────────────────────────────────

function buildHeader400(headerData: CnabHeaderData): string {
  // Sicoob Header CNAB 400
  const doc = digitsOnly(headerData.companyDocument);
  const agency = digitsOnly(headerData.agency);
  const account = digitsOnly(headerData.accountNumber);

  const line =
    '0' + // 1
    '1' + // 2
    padRight('REMESSA', 7) + // 3-9
    '01' + // 10-11
    padRight('COBRANCA', 8) + // 12-19
    padLeft(agency, 4) +
    '-' +
    padRight(headerData.agencyDigit ?? '0', 1) + // 20-26
    zeros(4) + // 27-30
    padLeft(account, 6) +
    '-' +
    padRight(headerData.accountDigit ?? '0', 1) +
    blanks(7) + // 31-46 (Sicoob 6-digit account)
    padRight(headerData.companyName, 30) + // 47-76
    '756' + // 77-79
    padRight('SICOOB', 15) + // 80-94
    formatDate(headerData.fileDate, 'DDMMAA') + // 95-100
    blanks(8) + // 101-108
    padLeft(doc, 14) + // 109-122
    blanks(272) + // 123-394
    padLeft(headerData.sequentialNumber, 6); // 395-400

  return line.slice(0, 400).padEnd(400, ' ');
}

function buildDetail400(payment: CnabPaymentRecord, seqNumber: number): string {
  // Sicoob Detail CNAB 400
  const ourNumber = padLeft(payment.payableId.replace(/-/g, '').slice(0, 8), 8);

  const line =
    '1' + // 1
    '0000' + // 2-5
    blanks(13) + // 6-18
    ourNumber + // 19-26 (nosso número)
    padLeft(digitsOnly(payment.agency ?? '00000'), 5) + // 27-31
    padLeft(digitsOnly(payment.accountNumber ?? '000000'), 6) + // 32-37 (Sicoob 6-digit account)
    blanks(8) + // 38-45
    padRight(payment.supplierName, 25) + // 46-70
    blanks(2) + // 71-72
    padRight(payment.documentNumber ?? blanks(10), 10) + // 73-82
    formatDate(payment.dueDate, 'DDMMYYYY') + // 83-90
    formatAmount(payment.amount, 12) + // 91-102
    '756' + // 103-105 (Sicoob)
    padLeft(digitsOnly(payment.agency ?? '00000'), 5) + // 106-110
    padRight('01', 7) + // 111-117
    'N' + // 118
    formatDate(payment.dueDate, 'DDMMAA') + // 119-124
    '00' + // 125-126
    '00' + // 127-128
    zeros(12) + // 129-140 (juros)
    zeros(8) + // 141-148
    zeros(12) + // 149-160
    zeros(12) + // 161-172
    zeros(12) + // 173-184
    blanks(14) + // 185-198
    blanks(192) + // 199-390
    padLeft(seqNumber, 6); // 391-396

  return line.slice(0, 400).padEnd(400, ' ');
}

function buildTrailer400(seqNumber: number, totalRecords: number, totalAmount: number): string {
  const line =
    '9' + // 1
    '756' + // 2-4
    blanks(10) + // 5-14
    padLeft(totalRecords, 8) + // 15-22
    formatAmount(totalAmount, 14) + // 23-36
    blanks(356) + // 37-392
    padLeft(seqNumber, 6); // 393-398

  return line.slice(0, 400).padEnd(400, ' ');
}

// ─── Sicoob Adapter Implementation ───────────────────────────────────────

export const sicoob756Adapter: CnabAdapter = {
  bankCode: '756',
  bankName: 'Sicoob — Sistema de Cooperativas de Crédito do Brasil',

  generateRemessa240(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string {
    const lines: string[] = [];
    const lotNumber = 1;
    // 2 detail segments per payment (A + B)
    const detailCount = payments.length * 2;
    const totalRecords = 1 + 1 + detailCount + 1 + 1;

    lines.push(buildHeader240(headerData, totalRecords));
    lines.push(buildLotHeader240(headerData, lotNumber));

    let seqInLot = 1;
    let totalAmount = 0;
    for (const payment of payments) {
      lines.push(buildSegmentA(headerData, payment, lotNumber, seqInLot++));
      lines.push(buildSegmentB(payment, lotNumber, seqInLot++));
      totalAmount += payment.amount;
    }

    lines.push(buildLotTrailer240(lotNumber, detailCount, totalAmount));
    lines.push(buildFileTrailer240(1, totalRecords));

    return lines.join('\r\n') + '\r\n';
  },

  generateRemessa400(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string {
    const lines: string[] = [];
    lines.push(buildHeader400(headerData));

    let totalAmount = 0;
    for (let i = 0; i < payments.length; i++) {
      lines.push(buildDetail400(payments[i], i + 2));
      totalAmount += payments[i].amount;
    }

    lines.push(buildTrailer400(payments.length + 2, payments.length, totalAmount));
    return lines.join('\r\n') + '\r\n';
  },

  parseRetorno(fileContent: string): CnabReturnRecord[] {
    const lines = fileContent.split(/\r?\n/).filter((l) => l.length > 0);
    const records: CnabReturnRecord[] = [];

    if (lines.length === 0) return records;
    const isFormat240 = lines[0].length === 240;

    if (isFormat240) {
      // CNAB 240 retorno Sicoob: segment A return data
      for (const line of lines) {
        if (line.length < 240) continue;
        const recordType = line[7];
        const segment = line[13];

        if (recordType === '3' && segment === 'A') {
          const statusCode = sliceFieldTrimmed(line, 16, 17);
          const ourNumber = sliceFieldTrimmed(line, 132, 144); // nosso número Sicoob seg A
          const liquidationDateStr = sliceField(line, 91, 98); // data pagamento
          const amountStr = sliceField(line, 117, 131); // valor pagamento

          records.push({
            ourNumber,
            status: mapSicoobStatus(statusCode),
            statusCode,
            liquidationDate: parseDateFromCnab(liquidationDateStr.trim(), 'DDMMYYYY'),
            amountPaid: parseAmountFromCnab(amountStr),
          });
        }
      }
    } else {
      // CNAB 400 retorno Sicoob
      for (const line of lines) {
        if (line.length < 400) continue;
        const recordType = sliceField(line, 1, 1);
        if (recordType !== '1') continue;

        const statusCode = sliceFieldTrimmed(line, 108, 109);
        const ourNumber = sliceFieldTrimmed(line, 19, 26);
        const liquidationDateStr = sliceField(line, 295, 300);
        const amountStr = sliceField(line, 253, 265);

        records.push({
          ourNumber,
          status: mapSicoobStatus(statusCode),
          statusCode,
          liquidationDate: parseDateFromCnab(liquidationDateStr.trim(), 'DDMMAA'),
          amountPaid: parseAmountFromCnab(amountStr),
        });
      }
    }

    return records;
  },
};
