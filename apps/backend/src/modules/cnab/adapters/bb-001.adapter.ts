// ─── Banco do Brasil CNAB 240/400 Adapter ────────────────────────────────
//
// Implements CNAB 240 (Pagamento) and CNAB 400 layouts for Banco do Brasil (001).
// Based on BB CNAB 240 Pagamento manual (Padrão FEBRABAN 2019).
// Each line in CNAB 240 is exactly 240 characters.
// Each line in CNAB 400 is exactly 400 characters.

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

// ─── BB Return Status Codes ───────────────────────────────────────────────

const BB_STATUS_MAP: Record<string, CnabReturnRecord['status']> = {
  '00': 'LIQUIDATED', // Crédito ou Débito Efetivado
  '01': 'LIQUIDATED', // Compensação - Crédito ou Débito em Compensação
  '02': 'RETURNED', // Débito/Crédito Cancelado ou não efetuado
  '03': 'RETURNED', // Débito/Crédito Impedido
  '09': 'REJECTED', // Baixa por Protestos
  '10': 'REJECTED', // Baixa por Devolução
  '11': 'REJECTED', // Recusado/Devolvido
  '12': 'RETURNED', // Contabilizado
  '20': 'LIQUIDATED', // Liquidado
  '23': 'RETURNED', // Devolução pelo Retorno
  '24': 'REJECTED', // Arquivo inválido
  '27': 'RETURNED', // Confirmação de Retirada
  '30': 'REJECTED', // Débito no CC do Pagador Não Realizado
};

function mapBbStatus(code: string): CnabReturnRecord['status'] {
  return BB_STATUS_MAP[code] ?? 'REJECTED';
}

// ─── CNAB 240 Generation ──────────────────────────────────────────────────

function buildHeader240(headerData: CnabHeaderData, totalRecords: number): string {
  const doc = digitsOnly(headerData.companyDocument);
  const isCnpj = doc.length === 14;

  // File Header — 240 chars
  // Pos  1-3:   Banco (001)
  // Pos  4-7:   Lote (0000 = file header)
  // Pos  8:     Registro tipo (0)
  // Pos  9-17:  Branco
  // Pos 18:     Tipo inscrição empresa (1=CPF, 2=CNPJ)
  // Pos 19-32:  CNPJ/CPF empresa
  // Pos 33-52:  Convênio
  // Pos 53-57:  Agência sem dígito
  // Pos 58:     Dígito agência
  // Pos 59-70:  Número da conta
  // Pos 71:     Dígito da conta
  // Pos 72:     Dígito agência/conta
  // Pos 73-102: Nome empresa
  // Pos 103-132: Nome do banco (Banco do Brasil S.A.)
  // Pos 133-142: Branco
  // Pos 143:    Código remessa/retorno (1=remessa, 2=retorno)
  // Pos 144-151: Data geração (DDMMYYYY)
  // Pos 152-157: Hora geração (HHMMSS)
  // Pos 158-163: Número sequencial do arquivo
  // Pos 164-166: Versão layout (080)
  // Pos 167-171: Densidade (01600)
  // Pos 172-191: Reservado banco
  // Pos 192-211: Reservado empresa
  // Pos 212-240: Reservado

  const line =
    '001' + // 1-3
    '0000' + // 4-7
    '0' + // 8
    blanks(9) + // 9-17
    (isCnpj ? '2' : '1') + // 18
    padLeft(doc, 14) + // 19-32
    padRight(headerData.convenioCode, 20) + // 33-52
    padLeft(digitsOnly(headerData.agency), 5) + // 53-57
    padRight(headerData.agencyDigit ?? ' ', 1) + // 58
    padLeft(digitsOnly(headerData.accountNumber), 12) + // 59-70
    padRight(headerData.accountDigit ?? ' ', 1) + // 71
    ' ' + // 72
    padRight(headerData.companyName, 30) + // 73-102
    padRight('BANCO DO BRASIL S.A.', 30) + // 103-132
    blanks(10) + // 133-142
    '1' + // 143 (1=remessa)
    formatDate(headerData.fileDate, 'DDMMYYYY') + // 144-151
    formatDate(headerData.fileDate, 'DDMMYYYY').slice(0, 6) +
    '00' + // 152-157 (HHMMSS approx)
    padLeft(headerData.sequentialNumber, 6) + // 158-163
    '080' + // 164-166 (versão layout)
    '01600' + // 167-171 (densidade)
    blanks(20) + // 172-191
    blanks(20) + // 192-211
    padLeft(totalRecords, 6) + // 212-217 (qtd registros)
    blanks(23); // 218-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildLotHeader240(headerData: CnabHeaderData, lotNumber: number): string {
  const doc = digitsOnly(headerData.companyDocument);
  const isCnpj = doc.length === 14;

  // Lot Header — 240 chars
  // Pos  1-3:   Banco (001)
  // Pos  4-7:   Lote
  // Pos  8:     Registro tipo (1)
  // Pos  9:     Operação (C=crédito, D=débito)
  // Pos 10-11:  Serviço (98=pagamentos diversos)
  // Pos 12-13:  Forma de lançamento (01=TED, 03=DOC, 41=TED, 45=PIX, 98=outros)
  // Pos 14-16:  Versão layout lote (040)
  // Pos 17:     Branco
  // Pos 18:     Tipo inscrição empresa
  // Pos 19-32:  CNPJ/CPF empresa
  // Pos 33-52:  Convênio
  // Pos 53-57:  Agência
  // Pos 58:     Dígito agência
  // Pos 59-70:  Conta
  // Pos 71:     Dígito conta
  // Pos 72:     Branco
  // Pos 73-102: Nome empresa
  // Pos 103-142: Informação 1 (free)
  // Pos 143-182: Informação 2 (free)
  // Pos 183-195: Nro. remessa
  // Pos 196-203: Data gravação
  // Pos 204-211: Data crédito
  // Pos 212-240: Reservado banco

  const lotStr = padLeft(lotNumber, 4);

  const line =
    '001' + // 1-3
    lotStr + // 4-7
    '1' + // 8
    'C' + // 9 (C=crédito)
    '98' + // 10-11 (pagamentos)
    '01' + // 12-13
    '040' + // 14-16
    ' ' + // 17
    (isCnpj ? '2' : '1') + // 18
    padLeft(doc, 14) + // 19-32
    padRight(headerData.convenioCode, 20) + // 33-52
    padLeft(digitsOnly(headerData.agency), 5) + // 53-57
    padRight(headerData.agencyDigit ?? ' ', 1) + // 58
    padLeft(digitsOnly(headerData.accountNumber), 12) + // 59-70
    padRight(headerData.accountDigit ?? ' ', 1) + // 71
    ' ' + // 72
    padRight(headerData.companyName, 30) + // 73-102
    blanks(40) + // 103-142
    blanks(40) + // 143-182
    padLeft(headerData.sequentialNumber, 13) + // 183-195
    formatDate(headerData.fileDate, 'DDMMYYYY') + // 196-203
    zeros(8) + // 204-211 (data crédito - deixar 0)
    blanks(29); // 212-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildSegmentP(
  headerData: CnabHeaderData,
  payment: CnabPaymentRecord,
  lotNumber: number,
  seqInLot: number,
): string {
  // Segmento P — Pagamento em conta corrente — 240 chars
  // Pos  1-3:   Banco (001)
  // Pos  4-7:   Lote
  // Pos  8:     Registro tipo (3)
  // Pos  9-13:  Sequencial do registro no lote
  // Pos 14:     Segmento (P)
  // Pos 15:     Branco
  // Pos 16-17:  Código de movimento (01=inclusão, 02=alteração)
  // Pos 18-22:  Agência do favorecido
  // Pos 23:     Dígito agência favorecido
  // Pos 24-35:  Conta do favorecido
  // Pos 36:     Dígito conta favorecido
  // Pos 37:     Branco
  // Pos 38-57:  Nosso número (payableId reference, left portion)
  // Pos 58-62:  Número do documento do cliente
  // Pos 63-72:  Data do vencimento (DDMMYYYY)
  // Pos 73:     Tipo de moeda (9=Real)
  // Pos 74-86:  Valor nominal do título (13 digitos, 2 decimais)
  // Pos 87-99:  Desconto (13 zeros se sem desconto)
  // Pos 100-112: Abatimento (13 zeros)
  // Pos 113-120: Data limite desconto
  // Pos 121-128: Data pagamento (DDMMYYYY)
  // Pos 129-141: Valor do pagamento
  // Pos 142-154: Juros
  // Pos 155-167: Multa
  // Pos 168-177: Número do documento empresa
  // Pos 178-192: Nosso número banco
  // Pos 193-199: Código de barras / linha digitável
  // Pos 200-240: Branco reservado

  const ourNumber = padLeft(payment.payableId.replace(/-/g, '').slice(0, 20), 20);
  const docNumber = padLeft(payment.documentNumber ?? '0', 10);

  const line =
    '001' + // 1-3
    padLeft(lotNumber, 4) + // 4-7
    '3' + // 8
    padLeft(seqInLot, 5) + // 9-13
    'P' + // 14
    ' ' + // 15
    '01' + // 16-17 (inclusão)
    padLeft(digitsOnly(payment.agency ?? headerData.agency), 5) + // 18-22
    padRight(payment.agencyDigit ?? ' ', 1) + // 23
    padLeft(digitsOnly(payment.accountNumber ?? headerData.accountNumber), 12) + // 24-35
    padRight(payment.accountDigit ?? ' ', 1) + // 36
    ' ' + // 37
    ourNumber + // 38-57
    docNumber + // 58-67
    blanks(3) + // 68-70
    formatDate(payment.dueDate, 'DDMMYYYY') + // 71-78 (adjusted)
    '9' + // 79 (tipo moeda Real)
    formatAmount(payment.amount, 13) + // 80-92
    zeros(13) + // 93-105 (desconto)
    zeros(13) + // 106-118 (abatimento)
    zeros(8) + // 119-126 (data desconto)
    formatDate(payment.dueDate, 'DDMMYYYY') + // 127-134 (data pagamento)
    formatAmount(payment.amount, 13) + // 135-147 (valor pagamento)
    zeros(13) + // 148-160 (juros)
    zeros(13) + // 161-173 (multa)
    padRight(payment.documentNumber ?? blanks(10), 10) + // 174-183
    blanks(20) + // 184-203 (nosso número banco)
    blanks(37); // 204-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildSegmentQ(payment: CnabPaymentRecord, lotNumber: number, seqInLot: number): string {
  // Segmento Q — Dados do beneficiário — 240 chars
  // Pos  1-3:   Banco (001)
  // Pos  4-7:   Lote
  // Pos  8:     Registro tipo (3)
  // Pos  9-13:  Sequencial do registro no lote
  // Pos 14:     Segmento (Q)
  // Pos 15:     Branco
  // Pos 16-17:  Código de movimento (01=inclusão)
  // Pos 18:     Tipo inscrição favorecido (1=CPF, 2=CNPJ)
  // Pos 19-32:  CNPJ/CPF favorecido
  // Pos 33-62:  Nome do favorecido
  // Pos 63-72:  Número do documento favorecido
  // Pos 73-77:  Código do banco favorecido
  // Pos 78-82:  Agência do favorecido
  // Pos 83:     Dígito agência favorecido
  // Pos 84-95:  Conta do favorecido
  // Pos 96:     Dígito conta favorecido
  // Pos 97:     Branco
  // Pos 98-127: Nome do sacador (branco se sem sacador)
  // Pos 128-142: Número do documento sacador
  // Pos 143-230: Branco
  // Pos 231-240: Reservado banco

  const doc = digitsOnly(payment.supplierDocument ?? '');
  const isCnpj = doc.length === 14;

  const line =
    '001' + // 1-3
    padLeft(lotNumber, 4) + // 4-7
    '3' + // 8
    padLeft(seqInLot, 5) + // 9-13
    'Q' + // 14
    ' ' + // 15
    '01' + // 16-17
    (doc.length >= 11 ? (isCnpj ? '2' : '1') : '0') + // 18
    padLeft(doc, 14) + // 19-32
    padRight(payment.supplierName, 30) + // 33-62
    blanks(10) + // 63-72
    padLeft(payment.bankCode ?? '000', 3) + // 73-75
    padLeft(digitsOnly(payment.agency ?? '00000'), 5) + // 76-80 (shifted for 3-digit bank)
    padRight(payment.agencyDigit ?? ' ', 1) + // 81 (adjusted)
    padLeft(digitsOnly(payment.accountNumber ?? '000000000000'), 12) + // 82-93
    padRight(payment.accountDigit ?? ' ', 1) + // 94
    ' ' + // 95
    blanks(30) + // 96-125 (sacador)
    blanks(15) + // 126-140
    blanks(100); // 141-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildLotTrailer240(lotNumber: number, recordCount: number, totalAmount: number): string {
  // Lot Trailer — 240 chars
  const line =
    '001' + // 1-3
    padLeft(lotNumber, 4) + // 4-7
    '5' + // 8
    blanks(9) + // 9-17
    padLeft(recordCount + 2, 6) + // 18-23 (qtd registros no lote incluindo header+trailer)
    padLeft(Math.floor(recordCount / 2), 6) + // 24-29 (qtd títulos)
    formatAmount(totalAmount, 18) + // 30-47 (valor total)
    zeros(6) + // 48-53
    blanks(165) + // 54-218
    blanks(22); // 219-240

  return line.slice(0, 240).padEnd(240, ' ');
}

function buildFileTrailer240(totalLots: number, totalRecords: number): string {
  // File Trailer — 240 chars
  const line =
    '001' + // 1-3
    '9999' + // 4-7 (lote = 9999 para trailer)
    '9' + // 8
    blanks(9) + // 9-17
    padLeft(totalLots, 6) + // 18-23 (qtd lotes)
    padLeft(totalRecords + 2, 6) + // 24-29 (qtd registros total incluindo header+trailer)
    zeros(6) + // 30-35
    blanks(205); // 36-240

  return line.slice(0, 240).padEnd(240, ' ');
}

// ─── CNAB 400 Generation ──────────────────────────────────────────────────

function buildHeader400(headerData: CnabHeaderData): string {
  // Header CNAB 400 — Banco do Brasil
  // Pos  1:     Código do registro (0)
  // Pos  2:     Código de remessa (1)
  // Pos  3-9:   Literal REMESSA
  // Pos 10-11:  Serviço (01=Cobrança)
  // Pos 12-19:  Literal COBRANCA
  // Pos 20-26:  Agência-dígito (AAAAA-D)
  // Pos 27-30:  Zeros
  // Pos 31-42:  Conta-dígito (CC-D)
  // Pos 43-46:  Zeros
  // Pos 47-76:  Nome empresa
  // Pos 77-79:  Banco (001)
  // Pos 80-94:  Banco nome (BB)
  // Pos 95-100: Data gravação (DDMMAA)
  // Pos 101-394: Branco
  // Pos 395-400: Sequencial (000001)

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
    padLeft(account, 8) +
    '-' +
    padRight(headerData.accountDigit ?? '0', 1) +
    blanks(3) + // 31-46 (adjusted)
    padRight(headerData.companyName, 30) + // 47-76
    '001' + // 77-79
    padRight('BANCO DO BRASIL', 15) + // 80-94
    formatDate(headerData.fileDate, 'DDMMAA') + // 95-100
    blanks(294) + // 101-394
    padLeft(headerData.sequentialNumber, 6); // 395-400

  return line.slice(0, 400).padEnd(400, ' ');
}

function buildDetail400(payment: CnabPaymentRecord, seqNumber: number): string {
  // Detail CNAB 400 — Banco do Brasil
  // Pos  1:     Tipo do registro (1)
  // Pos  2-3:   Agência-dígito do cedente
  // Pos  4-17:  Número do contrato/convênio
  // Pos 18-21:  Nosso número (referência interna)
  // Pos 22-25:  Agência do favorecido
  // Pos 26-37:  Conta do favorecido
  // Pos 38-62:  Nome do favorecido
  // Pos 63-72:  Número do documento (carteira)
  // Pos 73-80:  Data do vencimento (DDMMYYYY)
  // Pos 81-92:  Valor do documento (12 dígitos, 2 decimais)
  // Pos 93-95:  Banco cobrador (001)
  // Pos 96-100: Agência cobradora
  // Pos 101-107: Espécie (01=duplicata)
  // Pos 108:    Aceite (A=aceite, N=sem aceite)
  // Pos 109-114: Data de emissão
  // Pos 115-116: Instrução 1
  // Pos 117-118: Instrução 2
  // Pos 119-130: Juros por dia de atraso
  // Pos 131-138: Data limite para desconto
  // Pos 139-150: Valor do desconto
  // Pos 151-162: Valor do IOF
  // Pos 163-174: Valor do abatimento
  // Pos 175-188: CPF/CNPJ sacador
  // Pos 189-190: Aviso ao devedor
  // Pos 191-192: Número de parcelas
  // Pos 193-194: Parcela atual
  // Pos 195-214: Mensagem livre
  // Pos 215-220: Sequencial (campo 6)
  // Pos 221-394: Branco/reservado
  // Pos 395-400: Sequencial de registro

  const ourNumber = padLeft(payment.payableId.replace(/-/g, '').slice(0, 8), 8);

  const line =
    '1' + // 1
    '0000' + // 2-5 (agência cedente simplificado)
    blanks(13) + // 6-18
    ourNumber + // 19-26 (nosso número, adjusted)
    padLeft(digitsOnly(payment.agency ?? '00000'), 5) + // 27-31
    padLeft(digitsOnly(payment.accountNumber ?? '000000000000'), 12) + // 32-43
    blanks(2) + // 44-45
    padRight(payment.supplierName, 25) + // 46-70
    blanks(2) + // 71-72
    padRight(payment.documentNumber ?? blanks(10), 10) + // 73-82
    formatDate(payment.dueDate, 'DDMMYYYY') + // 83-90
    formatAmount(payment.amount, 12) + // 91-102
    '001' + // 103-105
    padLeft(digitsOnly(payment.agency ?? '00000'), 5) + // 106-110
    padRight('01', 7) + // 111-117 (espécie)
    'N' + // 118 (aceite)
    formatDate(payment.dueDate, 'DDMMAA') + // 119-124
    '00' + // 125-126 (instrução 1)
    '00' + // 127-128 (instrução 2)
    zeros(12) + // 129-140 (juros)
    zeros(8) + // 141-148 (data desconto)
    zeros(12) + // 149-160 (valor desconto)
    zeros(12) + // 161-172 (IOF)
    zeros(12) + // 173-184 (abatimento)
    blanks(14) + // 185-198 (CPF/CNPJ sacador)
    blanks(192) + // 199-390
    padLeft(seqNumber, 6); // 391-396 (adjusted)

  return line.slice(0, 400).padEnd(400, ' ');
}

function buildTrailer400(seqNumber: number, totalRecords: number, totalAmount: number): string {
  // Trailer CNAB 400 — Banco do Brasil
  const line =
    '9' + // 1
    '001' + // 2-4
    blanks(10) + // 5-14
    padLeft(totalRecords, 8) + // 15-22 (qtd títulos)
    formatAmount(totalAmount, 14) + // 23-36 (valor total)
    blanks(356) + // 37-392
    padLeft(seqNumber, 6); // 393-398 (adjusted)

  return line.slice(0, 400).padEnd(400, ' ');
}

// ─── BB Adapter Implementation ────────────────────────────────────────────

export const bb001Adapter: CnabAdapter = {
  bankCode: '001',
  bankName: 'Banco do Brasil S.A.',

  generateRemessa240(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string {
    const lines: string[] = [];
    const lotNumber = 1;
    // 2 detail segments per payment (P + Q)
    const detailCount = payments.length * 2;
    const totalRecords = 1 + 1 + detailCount + 1 + 1; // file_header + lot_header + details + lot_trailer + file_trailer

    lines.push(buildHeader240(headerData, totalRecords));
    lines.push(buildLotHeader240(headerData, lotNumber));

    let seqInLot = 1;
    let totalAmount = 0;
    for (const payment of payments) {
      lines.push(buildSegmentP(headerData, payment, lotNumber, seqInLot++));
      lines.push(buildSegmentQ(payment, lotNumber, seqInLot++));
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
      lines.push(buildDetail400(payments[i], i + 2)); // seq starts at 2 (1=header)
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
      // CNAB 240 retorno: segment T (positions 14='T') and segment U
      for (const line of lines) {
        if (line.length < 240) continue;
        const recordType = line[7]; // position 8 (0-indexed: 7)
        const segment = line[13]; // position 14 (0-indexed: 13)

        if (recordType === '3' && segment === 'T') {
          // Segment T: main return data
          // Pos 9-13:  Sequencial (0-indexed: 8-12)
          // Pos 16-17: Código de movimento retorno (0-indexed: 15-16)
          // Pos 38-57: Nosso número/payable reference (0-indexed: 37-56)
          // Pos 71-78: Data vencimento (0-indexed: 70-77)
          // Pos 80-92: Valor do título (0-indexed: 79-91)
          const statusCode = sliceFieldTrimmed(line, 16, 17);
          const ourNumber = sliceFieldTrimmed(line, 38, 57);
          const liquidationDateStr = sliceField(line, 145, 152); // data pagamento
          const amountStr = sliceField(line, 153, 165); // valor pago

          records.push({
            ourNumber,
            status: mapBbStatus(statusCode),
            statusCode,
            liquidationDate: parseDateFromCnab(liquidationDateStr.trim(), 'DDMMYYYY'),
            amountPaid: parseAmountFromCnab(amountStr),
          });
        }
      }
    } else {
      // CNAB 400 retorno
      for (const line of lines) {
        if (line.length < 400) continue;
        const recordType = sliceField(line, 1, 1);
        if (recordType !== '1') continue; // only detail records

        // CNAB 400 retorno positions (1-based):
        // Pos 1:     Tipo de registro (1=detalhe)
        // Pos 108-109: Código de ocorrência (status)
        // Pos 110-117: Data de ocorrência
        // Pos 110-117: Adjusted — nosso número at different positions per bank
        // Pos 26-45:  Nosso número
        // Pos 146-152: Data de crédito
        // Pos 153-165: Valor pago (13 dígitos)
        const statusCode = sliceFieldTrimmed(line, 108, 109);
        const ourNumber = sliceFieldTrimmed(line, 26, 45);
        const liquidationDateStr = sliceField(line, 295, 300); // DDMMAA
        const amountStr = sliceField(line, 253, 265); // valor pago

        records.push({
          ourNumber,
          status: mapBbStatus(statusCode),
          statusCode,
          liquidationDate: parseDateFromCnab(liquidationDateStr.trim(), 'DDMMAA'),
          amountPaid: parseAmountFromCnab(amountStr),
        });
      }
    }

    return records;
  },
};
