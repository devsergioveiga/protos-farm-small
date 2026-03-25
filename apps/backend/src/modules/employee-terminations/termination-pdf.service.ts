// ─── Termination PDF Service ──────────────────────────────────────────
// Generates TRCT (Termo de Rescisão do Contrato de Trabalho) and
// GRRF (Guia de Recolhimento Rescisório do FGTS) PDFs using pdfkit.
// References:
//   CLT Art. 477 — TRCT mandatory fields
//   Portaria 1.057/2012 — TRCT layout

import type { TerminationOutput, EmployeeData } from './employee-terminations.types';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d);
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function terminationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    WITHOUT_CAUSE: 'Sem Justa Causa',
    WITH_CAUSE: 'Com Justa Causa',
    VOLUNTARY: 'Pedido de Demissão',
    SEASONAL_END: 'Término de Safra',
    MUTUAL_AGREEMENT: 'Acordo Mútuo (Lei 13.467/2017)',
  };
  return labels[type] ?? type;
}

function noticeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    WORKED: 'Aviso Trabalhado',
    COMPENSATED: 'Aviso Indenizado',
    WAIVED: 'Dispensa de Aviso',
  };
  return labels[type] ?? type;
}

// ─── generateTRCTPdf ─────────────────────────────────────────────────

/**
 * Generates a TRCT (Termo de Rescisão do Contrato de Trabalho) PDF.
 * Returns the PDF as a Buffer.
 */
export async function generateTRCTPdf(
  termination: TerminationOutput,
  employee: EmployeeData,
): Promise<Buffer> {
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

    let y = 50;

    // ─── Title ───────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('TERMO DE RESCISAO DO CONTRATO DE TRABALHO', margin, y, {
      width: usableWidth,
      align: 'center',
    });
    y += 20;

    doc.font('Helvetica').fontSize(9);
    doc.text('(TRCT — CLT Art. 477)', margin, y, { width: usableWidth, align: 'center' });
    y += 16;

    doc.moveTo(margin, y).lineTo(margin + usableWidth, y).stroke();
    y += 10;

    // ─── Employee section ────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('DADOS DO EMPREGADO', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Nome: ${employee.name}`, margin, y);
    doc.text(`CPF: ${formatCpf(employee.cpf)}`, margin + 260, y);
    y += 13;

    if (employee.cargo) {
      doc.text(`Cargo: ${employee.cargo}`, margin, y);
    }
    doc.text(`Admissão: ${formatDate(employee.admissionDate)}`, margin + 260, y);
    y += 13;

    doc.moveTo(margin, y).lineTo(margin + usableWidth, y).stroke('#CCCCCC');
    y += 10;

    // ─── Termination details ─────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('DADOS DA RESCISÃO', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Tipo de Rescisão: ${terminationTypeLabel(termination.terminationType)}`, margin, y);
    doc.text(`Data da Rescisão: ${formatDate(termination.terminationDate)}`, margin + 260, y);
    y += 13;

    doc.text(`Aviso Prévio: ${noticeTypeLabel(termination.noticePeriodType)}`, margin, y);
    doc.text(`Dias de Aviso Prévio: ${termination.noticePeriodDays}`, margin + 260, y);
    y += 13;

    doc.text(`Prazo para Pagamento: ${formatDate(termination.paymentDeadline)}`, margin, y);
    y += 16;

    doc.moveTo(margin, y).lineTo(margin + usableWidth, y).stroke('#CCCCCC');
    y += 10;

    // ─── Calculation table ───────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('CÁLCULO DAS VERBAS RESCISÓRIAS', margin, y);
    y += 14;

    // Table header
    doc.rect(margin, y, usableWidth, 16).fillAndStroke('#EEEEEE', '#CCCCCC');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
    doc.text('RUBRICA', margin + 4, y + 4, { width: 280 });
    doc.text('VALOR', margin + 284, y + 4, { width: usableWidth - 284, align: 'right' });
    y += 16;

    function drawRow(label: string, value: string): void {
      doc.font('Helvetica').fontSize(9);
      doc.rect(margin, y, usableWidth, 14).stroke('#EEEEEE');
      doc.text(label, margin + 4, y + 3, { width: 280 });
      doc.text(formatCurrency(value), margin + 284, y + 3, {
        width: usableWidth - 284,
        align: 'right',
      });
      y += 14;
    }

    // ─── Proventos ────────────────────────────────────────────────────
    drawRow('Saldo de Salário', termination.balanceSalary);
    if (parseFloat(termination.noticePay) > 0) {
      drawRow('Aviso Prévio Indenizado', termination.noticePay);
    }
    drawRow('13º Salário Proporcional', termination.thirteenthProp);
    if (parseFloat(termination.vacationVested) > 0) {
      drawRow('Férias Vencidas', termination.vacationVested);
    }
    if (parseFloat(termination.vacationProp) > 0) {
      drawRow('Férias Proporcionais', termination.vacationProp);
    }
    drawRow('1/3 Constitucional sobre Férias', termination.vacationBonus);

    y += 4;

    // ─── Totals ───────────────────────────────────────────────────────
    doc.rect(margin, y, usableWidth, 16).fillAndStroke('#F5F5F5', '#CCCCCC');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL BRUTO', margin + 4, y + 4, { width: 280 });
    doc.text(formatCurrency(termination.totalGross), margin + 284, y + 4, {
      width: usableWidth - 284,
      align: 'right',
    });
    y += 16;

    // ─── Deductions ───────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(9);
    doc.rect(margin, y, usableWidth, 14).stroke('#EEEEEE');
    doc.fillColor('#C62828');
    doc.text('(-) INSS', margin + 4, y + 3, { width: 280 });
    doc.text(`-${formatCurrency(termination.inssAmount)}`, margin + 284, y + 3, {
      width: usableWidth - 284,
      align: 'right',
    });
    doc.fillColor('black');
    y += 14;

    if (parseFloat(termination.irrfAmount) > 0) {
      doc.rect(margin, y, usableWidth, 14).stroke('#EEEEEE');
      doc.fillColor('#C62828');
      doc.text('(-) IRRF', margin + 4, y + 3, { width: 280 });
      doc.text(`-${formatCurrency(termination.irrfAmount)}`, margin + 284, y + 3, {
        width: usableWidth - 284,
        align: 'right',
      });
      doc.fillColor('black');
      y += 14;
    }

    // ─── FGTS ─────────────────────────────────────────────────────────
    if (parseFloat(termination.fgtsPenalty) > 0) {
      y += 4;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.rect(margin, y, usableWidth, 14).fillAndStroke('#E8F5E9', '#A5D6A7');
      doc.fillColor('black');
      doc.text('(+) Multa do FGTS (40%/20%)', margin + 4, y + 3, { width: 280 });
      doc.text(formatCurrency(termination.fgtsPenalty), margin + 284, y + 3, {
        width: usableWidth - 284,
        align: 'right',
      });
      y += 14;
    }

    y += 8;

    // ─── Net total ────────────────────────────────────────────────────
    doc.rect(margin, y, usableWidth, 20).fillAndStroke('#2E7D32', '#2E7D32');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL LÍQUIDO A RECEBER', margin + 4, y + 5, { width: 280 });
    doc.text(formatCurrency(termination.totalNet), margin + 284, y + 5, {
      width: usableWidth - 284,
      align: 'right',
    });
    doc.fillColor('black');
    y += 28;

    // ─── FGTS info ────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(9);
    doc.text(
      `Saldo FGTS: ${formatCurrency(termination.fgtsBalance)}   Multa FGTS: ${formatCurrency(termination.fgtsPenalty)}`,
      margin,
      y,
    );
    y += 16;

    // ─── Signatures ───────────────────────────────────────────────────
    const sigY = 710;
    doc.font('Helvetica').fontSize(9);
    doc.text(
      'Declaro que recebi as verbas rescisórias discriminadas neste Termo de Rescisão do Contrato de Trabalho.',
      margin,
      sigY,
      { width: usableWidth },
    );

    const sigLineY = sigY + 40;

    doc.moveTo(margin, sigLineY).lineTo(margin + 180, sigLineY).stroke();
    doc.text('Empregado', margin, sigLineY + 4, { width: 180, align: 'center' });
    doc.text(employee.name, margin, sigLineY + 14, { width: 180, align: 'center' });

    doc.moveTo(margin + 300, sigLineY).lineTo(margin + 480, sigLineY).stroke();
    doc.text('Empregador', margin + 300, sigLineY + 4, { width: 180, align: 'center' });

    doc.end();
  });
}

// ─── generateGRRFPdf ─────────────────────────────────────────────────

/**
 * Generates a simplified GRRF (Guia de Recolhimento Rescisório do FGTS) cover page.
 * Returns the PDF as a Buffer.
 */
export async function generateGRRFPdf(
  termination: TerminationOutput,
  employee: EmployeeData,
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const margin = 50;
    const usableWidth = pageWidth - margin * 2;

    let y = 50;

    // ─── Title ───────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('GUIA DE RECOLHIMENTO RESCISÓRIO DO FGTS', margin, y, {
      width: usableWidth,
      align: 'center',
    });
    y += 18;

    doc.font('Helvetica').fontSize(9);
    doc.text('(GRRF — Lei 8.036/1990)', margin, y, { width: usableWidth, align: 'center' });
    y += 18;

    doc.moveTo(margin, y).lineTo(margin + usableWidth, y).stroke();
    y += 14;

    // ─── Employee info ────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('DADOS DO TRABALHADOR', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Nome: ${employee.name}`, margin, y);
    y += 13;
    doc.text(`CPF: ${formatCpf(employee.cpf)}`, margin, y);
    doc.text(`Admissão: ${formatDate(employee.admissionDate)}`, margin + 260, y);
    y += 13;
    doc.text(`Data da Rescisão: ${formatDate(termination.terminationDate)}`, margin, y);
    doc.text(
      `Tipo: ${terminationTypeLabel(termination.terminationType)}`,
      margin + 260,
      y,
    );
    y += 18;

    doc.moveTo(margin, y).lineTo(margin + usableWidth, y).stroke('#CCCCCC');
    y += 14;

    // ─── FGTS data ────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('DADOS DO FGTS', margin, y);
    y += 14;

    function drawInfoRow(label: string, value: string): void {
      doc.rect(margin, y, usableWidth, 16).stroke('#EEEEEE');
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(label, margin + 4, y + 4, { width: 250 });
      doc.font('Helvetica').fontSize(9);
      doc.text(value, margin + 260, y + 4, { width: usableWidth - 264 });
      y += 16;
    }

    drawInfoRow('Saldo FGTS (estimado)', formatCurrency(termination.fgtsBalance));
    drawInfoRow(
      'Alíquota da Multa',
      `${(parseFloat(termination.fgtsBalance) > 0
        ? (parseFloat(termination.fgtsPenalty) / parseFloat(termination.fgtsBalance)) * 100
        : 0
      ).toFixed(0)}%`,
    );
    drawInfoRow('Valor da Multa Rescisória', formatCurrency(termination.fgtsPenalty));

    y += 8;

    // ─── Total to deposit ──────────────────────────────────────────────
    doc.rect(margin, y, usableWidth, 22).fillAndStroke('#2E7D32', '#2E7D32');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    doc.text('VALOR A RECOLHER AO FGTS', margin + 4, y + 6, { width: 250 });
    doc.text(formatCurrency(termination.fgtsPenalty), margin + 260, y + 6, {
      width: usableWidth - 264,
    });
    doc.fillColor('black');
    y += 30;

    // ─── Payment deadline ─────────────────────────────────────────────
    doc.font('Helvetica').fontSize(9);
    doc.text(
      `Prazo para recolhimento: ${formatDate(termination.paymentDeadline)} (CLT Art. 477 — 10 dias corridos)`,
      margin,
      y,
    );

    doc.end();
  });
}
