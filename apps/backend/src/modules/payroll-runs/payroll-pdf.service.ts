// ─── Payslip PDF Service ──────────────────────────────────────────────
// Generates classic tabular payslip PDFs using pdfkit.
// Layout: header (org + employee), proventos table, descontos table,
// totais row, bases row, signature line.

// ─── Types ─────────────────────────────────────────────────────────────

export interface PayslipLineItem {
  code: string;
  description: string;
  reference: string;
  type: 'PROVENTO' | 'DESCONTO';
  value: number;
}

export interface PayslipData {
  orgName: string;
  orgCnpj: string;
  employeeName: string;
  employeeCpf: string;
  employeeCargo: string;
  admissionDate: Date;
  referenceMonth: string; // "2026-03"
  runType: string;
  lineItems: PayslipLineItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  inssBase: number;
  irrfBase: number;
  fgtsMonth: number;
  fgtsBase: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

function formatMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthNames: Record<string, string> = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro',
  };
  return `${monthNames[month] ?? month}/${year}`;
}

function runTypeLabel(runType: string): string {
  const labels: Record<string, string> = {
    MONTHLY: 'Salário Mensal',
    ADVANCE: 'Adiantamento',
    THIRTEENTH_FIRST: '13º Salário — 1ª Parcela',
    THIRTEENTH_SECOND: '13º Salário — 2ª Parcela',
  };
  return labels[runType] ?? runType;
}

// ─── generatePayslipPdf ─────────────────────────────────────────────────

/**
 * Generates a payslip PDF for one employee in one payroll run.
 * Returns the PDF as a Buffer.
 */
export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const margin = 50;
    const usableWidth = pageWidth - margin * 2; // ~495

    // ── Column widths for tables ─────────────────────────────────────
    const colCode = 50;
    const colDesc = 220;
    const colRef = 100;
    const colVal = usableWidth - colCode - colDesc - colRef; // ~125

    // ─── Header ────────────────────────────────────────────────────
    let y = 50;

    // Org name (left)
    doc.font('Helvetica-Bold').fontSize(14);
    doc.text(data.orgName, margin, y, { width: 300 });

    // RECIBO DE PAGAMENTO (right)
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('RECIBO DE PAGAMENTO', margin + 300, y, {
      width: usableWidth - 300,
      align: 'right',
    });

    y += 20;

    // CNPJ
    if (data.orgCnpj) {
      doc.font('Helvetica').fontSize(9);
      doc.text(`CNPJ: ${formatCnpj(data.orgCnpj)}`, margin, y);
      y += 14;
    }

    // Horizontal rule
    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke();
    y += 8;

    // Employee info
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Colaborador:', margin, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(data.employeeName, margin + 80, y);

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('CPF:', margin + 300, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(formatCpf(data.employeeCpf), margin + 325, y);

    y += 14;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Cargo:', margin, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(data.employeeCargo, margin + 80, y);

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Admissão:', margin + 300, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(formatDate(data.admissionDate), margin + 360, y);

    y += 14;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Competência:', margin, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(
      `${formatMonthLabel(data.referenceMonth)} — ${runTypeLabel(data.runType)}`,
      margin + 80,
      y,
    );

    y += 16;

    // ─── Table header helper ─────────────────────────────────────────
    function drawTableHeader(yPos: number): number {
      doc.font('Helvetica-Bold').fontSize(9);
      doc.rect(margin, yPos, usableWidth, 16).fillAndStroke('#EEEEEE', '#CCCCCC');
      doc.fillColor('black');
      doc.text('CÓD.', margin + 2, yPos + 4, { width: colCode });
      doc.text('DESCRIÇÃO', margin + colCode + 2, yPos + 4, { width: colDesc });
      doc.text('REF.', margin + colCode + colDesc + 2, yPos + 4, { width: colRef });
      doc.text('VALOR', margin + colCode + colDesc + colRef + 2, yPos + 4, {
        width: colVal,
        align: 'right',
      });
      return yPos + 16;
    }

    function drawTableRow(
      yPos: number,
      code: string,
      desc: string,
      ref: string,
      value: number,
    ): number {
      doc.font('Helvetica').fontSize(9);
      const rowH = 14;

      doc.rect(margin, yPos, usableWidth, rowH).stroke('#EEEEEE');
      doc.text(code, margin + 2, yPos + 3, { width: colCode });
      doc.text(desc, margin + colCode + 2, yPos + 3, { width: colDesc });
      doc.text(ref, margin + colCode + colDesc + 2, yPos + 3, { width: colRef });
      doc.text(formatCurrency(value), margin + colCode + colDesc + colRef + 2, yPos + 3, {
        width: colVal,
        align: 'right',
      });
      return yPos + rowH;
    }

    // ─── Proventos section ────────────────────────────────────────────
    const proventos = data.lineItems.filter((li) => li.type === 'PROVENTO');
    const descontos = data.lineItems.filter((li) => li.type === 'DESCONTO');

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('PROVENTOS', margin, y);
    y += 14;
    y = drawTableHeader(y);

    for (const li of proventos) {
      y = drawTableRow(y, li.code, li.description, li.reference, li.value);
    }

    if (proventos.length === 0) {
      y = drawTableRow(y, '', '(Nenhum provento)', '', 0);
    }

    y += 8;

    // ─── Descontos section ────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('DESCONTOS', margin, y);
    y += 14;
    y = drawTableHeader(y);

    for (const li of descontos) {
      y = drawTableRow(y, li.code, li.description, li.reference, li.value);
    }

    if (descontos.length === 0) {
      y = drawTableRow(y, '', '(Nenhum desconto)', '', 0);
    }

    y += 8;

    // ─── Totais row ────────────────────────────────────────────────────
    doc.rect(margin, y, usableWidth, 20).fillAndStroke('#2E7D32', '#2E7D32');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);

    const totalColW = Math.floor(usableWidth / 3);
    doc.text(`TOTAL PROVENTOS: ${formatCurrency(data.grossSalary)}`, margin + 2, y + 6, {
      width: totalColW,
    });
    doc.text(
      `TOTAL DESCONTOS: ${formatCurrency(data.totalDeductions)}`,
      margin + totalColW + 2,
      y + 6,
      { width: totalColW },
    );
    doc.text(`LÍQUIDO: ${formatCurrency(data.netSalary)}`, margin + totalColW * 2 + 2, y + 6, {
      width: totalColW,
    });

    doc.fillColor('black');
    y += 24;

    // ─── Bases (rodapé) ───────────────────────────────────────────────
    doc.font('Helvetica').fontSize(9);
    doc.text(
      `Base INSS: ${formatCurrency(data.inssBase)}    Base IRRF: ${formatCurrency(data.irrfBase)}    Base FGTS: ${formatCurrency(data.fgtsBase)}    FGTS do Mês: ${formatCurrency(data.fgtsMonth)}`,
      margin,
      y,
    );
    y += 16;

    // ─── Signature line ────────────────────────────────────────────────
    // Place near bottom of page
    const sigY = 720;
    doc.font('Helvetica').fontSize(9);
    doc.text('Declaro ter recebido a importância líquida discriminada neste recibo.', margin, sigY);

    doc
      .moveTo(margin + 60, sigY + 30)
      .lineTo(margin + 260, sigY + 30)
      .stroke();
    doc.font('Helvetica').fontSize(9);
    doc.text(data.employeeName, margin + 60, sigY + 34, { width: 200, align: 'center' });

    doc.end();
  });
}
