// ─── Integrated Report Service ────────────────────────────────────────────────
// Generates a professional multi-section PDF combining DRE, BP, DFC, and
// notas explicativas for rural credit (VINC-02).
// Uses established pdfkit buffer pattern from pesticide-prescriptions.service.ts.

import { prisma } from '../../database/prisma';
import { getDre, getBalanceSheet, getDfc } from './financial-statements.service';

// ─── Brazilian currency formatter ─────────────────────────────────────────────

export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─── CNPJ formatter ───────────────────────────────────────────────────────────

function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

// ─── Date formatter ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

// ─── generateIntegratedReport ─────────────────────────────────────────────────

export async function generateIntegratedReport(
  organizationId: string,
  fiscalYearId: string,
  costCenterId?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // 1. Load Organization
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      document: true,
      accountantName: true,
      accountantCrc: true,
      accountantCpf: true,
      integratedReportNotes: true,
    },
  });

  if (!org) {
    throw new Error('Organização não encontrada');
  }

  // 2. Load FiscalYear
  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    select: { startDate: true, endDate: true },
  });

  if (!fiscalYear) {
    throw new Error('Exercício fiscal não encontrado');
  }

  const year = fiscalYear.startDate.getFullYear();

  // 3. Optionally load Farm (if costCenterId provided)
  let farmName: string | null = null;
  if (costCenterId) {
    const costCenter = await prisma.costCenter.findUnique({
      where: { id: costCenterId },
      select: { name: true },
    });
    farmName = costCenter?.name ?? null;
  }

  // 4. Determine month (use last month of fiscal year for annual report)
  const endMonth = fiscalYear.endDate.getMonth() + 1; // 1-12

  // 5. Fetch DRE, BP, DFC data
  const dreData = await getDre(organizationId, {
    fiscalYearId,
    month: endMonth,
    costCenterId,
  }).catch(() => null);
  const bpData = await getBalanceSheet(organizationId, { fiscalYearId, month: endMonth }).catch(
    () => null,
  );
  const dfcData = await getDfc(organizationId, { fiscalYearId, month: endMonth }).catch(() => null);

  // 6. Build PDF using pdfkit buffer pattern
  const filename = `Relatorio_Integrado_${year}.pdf`;
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // margins

    // ── Section 1: Capa (Cover page) ─────────────────────────────────────────

    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(24).text('DEMONSTRACOES FINANCEIRAS', { align: 'center' });

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(18).text(org.name, { align: 'center' });

    if (org.document) {
      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(`CNPJ: ${formatCnpj(org.document)}`, { align: 'center' });
    }

    if (farmName) {
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(12).text(farmName, { align: 'center' });
    }

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(14).text(`Exercicio Fiscal ${year}`, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`Periodo: ${formatDate(fiscalYear.startDate)} a ${formatDate(fiscalYear.endDate)}`, {
        align: 'center',
      });

    if (org.accountantName) {
      doc.moveDown(1.5);
      doc
        .font('Helvetica')
        .fontSize(11)
        .text(`Contador(a): ${org.accountantName} - CRC ${org.accountantCrc ?? ''}`, {
          align: 'center',
        });
    }

    doc.addPage();

    // ── Section 2: Indice (Table of contents) ────────────────────────────────

    doc.font('Helvetica-Bold').fontSize(16).text('INDICE', { align: 'left' });

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(12);

    const tocItems = [
      '1. Demonstracao do Resultado do Exercicio (DRE) ............. 3',
      '2. Balanco Patrimonial (BP) ............................... 4',
      '3. Demonstracao do Fluxo de Caixa (DFC) .................. 5',
      '4. Notas Explicativas .................................... 6',
    ];

    for (const item of tocItems) {
      doc.text(item);
      doc.moveDown(0.5);
    }

    doc.addPage();

    // ── Section 3: DRE ───────────────────────────────────────────────────────

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('DEMONSTRACAO DO RESULTADO DO EXERCICIO', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Periodo: ${formatDate(fiscalYear.startDate)} a ${formatDate(fiscalYear.endDate)}`, {
        align: 'center',
      });

    doc.moveDown(1);

    if (dreData && dreData.sections.length > 0) {
      // Table header
      const renderDreTableHeader = () => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Codigo', 50, doc.y, { width: 60, continued: true })
          .text('Descricao', { width: pageWidth - 120, continued: true })
          .text('Valor (R$)', { width: 100, align: 'right' });
        doc.moveDown(0.3);
        doc
          .moveTo(50, doc.y)
          .lineTo(50 + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);
      };

      renderDreTableHeader();

      for (const section of dreData.sections) {
        // Section total header
        if (doc.y > 720) {
          doc.addPage();
          renderDreTableHeader();
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(section.id, 50, doc.y, { width: 60, continued: true })
          .text(section.label, { width: pageWidth - 120, continued: true })
          .text(formatBrl(Number(section.total.ytd)), { width: 100, align: 'right' });
        doc.moveDown(0.3);

        for (const row of section.rows) {
          if (doc.y > 720) {
            doc.addPage();
            renderDreTableHeader();
          }
          if (!row.isSubtotal) {
            const indent = row.level * 10;
            doc
              .font('Helvetica')
              .fontSize(8)
              .text(row.code, 50 + indent, doc.y, { width: 60 - indent, continued: true })
              .text(row.name, { width: pageWidth - 120 - indent, continued: true })
              .text(formatBrl(Number(row.ytd)), { width: 100, align: 'right' });
            doc.moveDown(0.25);
          }
        }
        doc.moveDown(0.3);
      }

      // Resultado liquido
      if (doc.y > 720) doc.addPage();
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.3);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('RESULTADO LIQUIDO DO EXERCICIO', 50, doc.y, {
          width: pageWidth - 100,
          continued: true,
        })
        .text(formatBrl(Number(dreData.resultadoLiquido.ytd)), { width: 100, align: 'right' });
    } else {
      doc.font('Helvetica').fontSize(10).text('Dados nao disponiveis para o periodo selecionado.');
    }

    doc.addPage();

    // ── Section 4: BP ────────────────────────────────────────────────────────

    doc.font('Helvetica-Bold').fontSize(14).text('BALANCO PATRIMONIAL', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Data-base: ${formatDate(fiscalYear.endDate)}`, { align: 'center' });

    doc.moveDown(1);

    if (bpData) {
      const renderBpSection = (title: string, groups: typeof bpData.ativo) => {
        doc.font('Helvetica-Bold').fontSize(11).text(title);
        doc.moveDown(0.5);

        for (const group of groups) {
          if (doc.y > 700) doc.addPage();
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(group.label, 50, doc.y, { width: pageWidth - 100, continued: true })
            .text(formatBrl(Number(group.total.currentBalance)), { width: 100, align: 'right' });
          doc.moveDown(0.3);

          for (const row of group.rows) {
            if (!row.isSubtotal) {
              if (doc.y > 720) doc.addPage();
              const indent = row.level * 8;
              doc
                .font('Helvetica')
                .fontSize(8)
                .text(row.name, 50 + indent, doc.y, {
                  width: pageWidth - 100 - indent,
                  continued: true,
                })
                .text(formatBrl(Number(row.currentBalance)), { width: 100, align: 'right' });
              doc.moveDown(0.25);
            }
          }
          doc.moveDown(0.3);
        }
      };

      renderBpSection('ATIVO', bpData.ativo);

      doc.moveDown(0.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.3);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('TOTAL DO ATIVO', 50, doc.y, { width: pageWidth - 100, continued: true })
        .text(formatBrl(Number(bpData.totalAtivo.currentBalance)), { width: 100, align: 'right' });

      doc.moveDown(1);
      renderBpSection('PASSIVO E PATRIMONIO LIQUIDO', bpData.passivo);

      doc.moveDown(0.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.3);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('TOTAL DO PASSIVO E PL', 50, doc.y, { width: pageWidth - 100, continued: true })
        .text(formatBrl(Number(bpData.totalPassivo.currentBalance)), {
          width: 100,
          align: 'right',
        });

      // BP Indicators box
      if (doc.y > 650) doc.addPage();
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(10).text('Indicadores Financeiros');
      doc.moveDown(0.5);

      const indicators = bpData.indicators;
      const indicatorItems = [
        ['Liquidez Corrente', indicators.liquidezCorrente],
        ['Endividamento Geral', indicators.endividamentoGeral],
        ['ROE (Rentabilidade do PL)', indicators.roe],
        [
          'PL por Hectare',
          indicators.plPorHectare ? formatBrl(Number(indicators.plPorHectare)) : null,
        ],
      ];

      for (const [label, value] of indicatorItems) {
        if (value !== null && value !== undefined) {
          doc.font('Helvetica').fontSize(9).text(`${label}: ${value}`);
          doc.moveDown(0.3);
        }
      }
    } else {
      doc.font('Helvetica').fontSize(10).text('Dados nao disponiveis para o periodo selecionado.');
    }

    doc.addPage();

    // ── Section 5: DFC Metodo Direto ─────────────────────────────────────────

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('DEMONSTRACAO DO FLUXO DE CAIXA - METODO DIRETO', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Periodo: ${formatDate(fiscalYear.startDate)} a ${formatDate(fiscalYear.endDate)}`, {
        align: 'center',
      });

    doc.moveDown(1);

    if (dfcData && dfcData.direto) {
      const direto = dfcData.direto;

      for (const section of direto.sections) {
        if (doc.y > 700) doc.addPage();

        doc.font('Helvetica-Bold').fontSize(10).text(section.label);
        doc.moveDown(0.5);

        for (const row of section.rows) {
          if (!row.isSubtotal) {
            if (doc.y > 720) doc.addPage();
            doc
              .font('Helvetica')
              .fontSize(9)
              .text(row.label, 50, doc.y, { width: pageWidth - 100, continued: true })
              .text(formatBrl(Number(row.ytd)), { width: 100, align: 'right' });
            doc.moveDown(0.25);
          }
        }

        // Section subtotal
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(`Total ${section.label}`, 50, doc.y, { width: pageWidth - 100, continued: true })
          .text(formatBrl(Number(section.subtotal.ytd)), { width: 100, align: 'right' });
        doc.moveDown(0.5);
      }

      // Cash summary
      doc.moveDown(0.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.3);

      const cash = direto.cash;
      doc
        .font('Helvetica')
        .fontSize(9)
        .text('Saldo Inicial de Caixa', 50, doc.y, { width: pageWidth - 100, continued: true })
        .text(formatBrl(Number(cash.saldoInicial.ytd)), { width: 100, align: 'right' });
      doc.moveDown(0.3);

      doc
        .font('Helvetica')
        .fontSize(9)
        .text('Variacao Liquida de Caixa', 50, doc.y, { width: pageWidth - 100, continued: true })
        .text(formatBrl(Number(cash.variacaoLiquida.ytd)), { width: 100, align: 'right' });
      doc.moveDown(0.3);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Saldo Final de Caixa', 50, doc.y, { width: pageWidth - 100, continued: true })
        .text(formatBrl(Number(cash.saldoFinal.ytd)), { width: 100, align: 'right' });
    } else {
      doc.font('Helvetica').fontSize(10).text('Dados nao disponiveis para o periodo selecionado.');
    }

    doc.addPage();

    // ── Section 6: Notas Explicativas ────────────────────────────────────────

    doc.font('Helvetica-Bold').fontSize(14).text('NOTAS EXPLICATIVAS', { align: 'center' });

    doc.moveDown(1);

    // Auto-generated notes
    const autoNotes = [
      {
        title: '1. Contexto Operacional',
        text: 'A empresa dedica-se a atividades agropecuarias, incluindo producao agricola, criacao de animais e atividades correlatas. As presentes demonstracoes financeiras foram elaboradas em conformidade com as praticas contabeis vigentes no Brasil.',
      },
      {
        title: '2. Politicas Contabeis',
        text: 'As demonstracoes foram elaboradas de acordo com as praticas contabeis brasileiras, em especial os Pronunciamentos Tecnicos do CPC aplicaveis as entidades de pequeno e medio porte (CPC PME), adotando o regime de competencia para reconhecimento de receitas e despesas.',
      },
      {
        title: '3. Imobilizado',
        text: 'Os bens do ativo imobilizado sao depreciados pelo metodo linear, com base nas taxas que refletem a vida util economica estimada de cada bem. Maquinas e equipamentos agricolas: 5 a 20 anos. Instalacoes e benfeitorias: 10 a 25 anos. Veiculos: 5 anos.',
      },
    ];

    // Check if org has CPC 29 relevant amounts (biological assets section in DRE)
    const hasBiologicalAssets =
      dreData?.sections.some((s) => s.id === 'cpc29' && Math.abs(Number(s.total.ytd)) > 0.01) ??
      false;

    if (hasBiologicalAssets) {
      autoNotes.push({
        title: '4. Ativo Biologico (CPC 29)',
        text: 'Os ativos biologicos sao mensurados pelo valor justo menos as despesas de venda na data do balanco patrimonial, quando esse valor puder ser mensurado confiavelmente. Os ganhos ou perdas decorrentes de mudancas no valor justo menos as despesas de venda sao incluidos no resultado do periodo em que se originam.',
      });
    }

    for (const note of autoNotes) {
      if (doc.y > 680) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).text(note.title);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).text(note.text, { align: 'justify' });
      doc.moveDown(0.8);
    }

    // Additional notes from integratedReportNotes field
    if (org.integratedReportNotes && org.integratedReportNotes.trim().length > 0) {
      if (doc.y > 650) doc.addPage();
      const nextNoteNum = autoNotes.length + 1;
      doc.font('Helvetica-Bold').fontSize(10).text(`${nextNoteNum}. Informacoes Adicionais`);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).text(org.integratedReportNotes, { align: 'justify' });
    }

    doc.end();
  });

  return { buffer, filename };
}

// ─── saveNotes ────────────────────────────────────────────────────────────────

export async function saveNotes(organizationId: string, notesText: string): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { integratedReportNotes: notesText },
  });
}

// ─── getNotes ─────────────────────────────────────────────────────────────────

export async function getNotes(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { integratedReportNotes: true },
  });
  return org?.integratedReportNotes ?? null;
}
