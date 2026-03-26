import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  EpiDeliveryError,
  type CreateEpiDeliveryInput,
  type EpiDeliveryOutput,
  type EpiDeliveryListQuery,
} from './epi-deliveries.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function toNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toNumber' in val)
    return (val as { toNumber(): number }).toNumber();
  return Number(val);
}

function mapDelivery(row: any): EpiDeliveryOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? '',
    epiProductId: row.epiProductId,
    epiProductName: row.epiProduct?.product?.name ?? '',
    caNumber: row.epiProduct?.caNumber ?? '',
    date: (row.date as Date).toISOString(),
    quantity: row.quantity,
    reason: row.reason,
    signatureUrl: row.signatureUrl ?? null,
    observations: row.observations ?? null,
    stockOutputId: row.stockOutputId ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

const DELIVERY_INCLUDE = {
  employee: { select: { name: true } },
  epiProduct: {
    include: { product: { select: { name: true } } },
  },
} as const;

// ─── Create EPI Delivery (with stock deduction) ──────────────────────

export async function createEpiDelivery(
  ctx: RlsContext,
  input: CreateEpiDeliveryInput,
): Promise<EpiDeliveryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const { organizationId } = ctx;

    // Verify EpiProduct exists and belongs to org
    const epiProduct = await (tx as any).epiProduct.findFirst({
      where: { id: input.epiProductId, organizationId },
      include: { product: { select: { name: true, id: true } } },
    });
    if (!epiProduct) {
      throw new EpiDeliveryError('EPI não encontrado', 'EPI_NOT_FOUND');
    }

    // Verify Employee exists and belongs to org
    const employee = await (tx as any).employee.findFirst({
      where: { id: input.employeeId, organizationId },
      select: { id: true, name: true },
    });
    if (!employee) {
      throw new EpiDeliveryError('Colaborador não encontrado', 'EMPLOYEE_NOT_FOUND');
    }

    const productId = epiProduct.productId;

    // Check stock sufficiency BEFORE deduction
    const balance = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId } },
    });

    const available = balance ? toNumber(balance.currentQuantity) : 0;
    if (available < input.quantity) {
      throw new EpiDeliveryError(
        `Saldo insuficiente. Disponível: ${available}, solicitado: ${input.quantity}`,
        'INSUFFICIENT_STOCK',
      );
    }

    const averageCost = balance ? toNumber(balance.averageCost) : 0;
    const unitCost = averageCost;
    const totalCost = unitCost * input.quantity;

    // Create StockOutput
    const stockOutput = await (tx as any).stockOutput.create({
      data: {
        organizationId,
        type: 'CONSUMPTION',
        outputDate: new Date(input.date),
        responsibleName: employee.name,
        notes: 'EPI entregue ao colaborador',
        status: 'CONFIRMED',
        totalCost,
      },
    });

    // Create StockOutputItem
    await (tx as any).stockOutputItem.create({
      data: {
        stockOutputId: stockOutput.id,
        productId,
        quantity: input.quantity,
        unitCost,
        totalCost,
      },
    });

    // Update StockBalance (decrement)
    const prevTotal = balance ? toNumber(balance.totalValue) : 0;
    const newQty = Math.max(0, available - input.quantity);
    const newTotal = Math.max(0, prevTotal - totalCost);
    const newAvgCost = newQty > 0 ? newTotal / newQty : averageCost;

    await (tx as any).stockBalance.update({
      where: { organizationId_productId: { organizationId, productId } },
      data: {
        currentQuantity: newQty,
        averageCost: newAvgCost,
        totalValue: newTotal,
      },
    });

    // Create EpiDelivery
    const delivery = await (tx as any).epiDelivery.create({
      data: {
        organizationId,
        employeeId: input.employeeId,
        epiProductId: input.epiProductId,
        date: new Date(input.date),
        quantity: input.quantity,
        reason: input.reason,
        signatureUrl: input.signatureUrl ?? null,
        observations: input.observations ?? null,
        stockOutputId: stockOutput.id,
      },
      include: DELIVERY_INCLUDE,
    });

    return mapDelivery(delivery);
  });
}

// ─── Delete EPI Delivery (with stock restoration) ───────────────────

export async function deleteEpiDelivery(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const { organizationId } = ctx;

    const delivery = await (tx as any).epiDelivery.findFirst({
      where: { id, organizationId },
      include: {
        epiProduct: { select: { productId: true } },
      },
    });
    if (!delivery) {
      throw new EpiDeliveryError('Entrega não encontrada', 'NOT_FOUND');
    }

    const productId = delivery.epiProduct.productId;

    // Restore StockBalance
    if (delivery.stockOutputId) {
      // Get the StockOutputItem to know quantity and cost
      const outputItem = await (tx as any).stockOutputItem.findFirst({
        where: { stockOutputId: delivery.stockOutputId, productId },
      });

      if (outputItem) {
        const qty = toNumber(outputItem.quantity);
        const cost = toNumber(outputItem.totalCost);

        const balance = await (tx as any).stockBalance.findUnique({
          where: { organizationId_productId: { organizationId, productId } },
        });

        if (balance) {
          const prevQty = toNumber(balance.currentQuantity);
          const prevTotal = toNumber(balance.totalValue);
          const newQty = prevQty + qty;
          const newTotal = prevTotal + cost;
          const newAvgCost = newQty > 0 ? newTotal / newQty : toNumber(balance.averageCost);

          await (tx as any).stockBalance.update({
            where: { id: balance.id },
            data: {
              currentQuantity: newQty,
              averageCost: newAvgCost,
              totalValue: newTotal,
            },
          });
        }
      }

      // Delete StockOutputItem + StockOutput (cascade handles items)
      await (tx as any).stockOutput.delete({ where: { id: delivery.stockOutputId } });
    }

    // Delete EpiDelivery
    await (tx as any).epiDelivery.delete({ where: { id } });
  });
}

// ─── List EPI Deliveries ────────────────────────────────────────────

export async function listEpiDeliveries(
  ctx: RlsContext,
  query?: EpiDeliveryListQuery,
): Promise<{
  data: EpiDeliveryOutput[];
  total: number;
  page: number;
  limit: number;
}> {
  return withRlsContext(ctx, async (tx) => {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId: ctx.organizationId };
    if (query?.employeeId) where.employeeId = query.employeeId;
    if (query?.reason) where.reason = query.reason;
    if (query?.epiType) {
      where.epiProduct = { epiType: query.epiType };
    }
    if (query?.dateFrom || query?.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    const [rows, total] = await Promise.all([
      (tx as any).epiDelivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: DELIVERY_INCLUDE,
      }),
      (tx as any).epiDelivery.count({ where }),
    ]);

    return {
      data: rows.map(mapDelivery),
      total,
      page,
      limit,
    };
  });
}

// ─── Get EPI Delivery ────────────────────────────────────────────────

export async function getEpiDelivery(
  ctx: RlsContext,
  id: string,
): Promise<EpiDeliveryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).epiDelivery.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: DELIVERY_INCLUDE,
    });
    if (!row) {
      throw new EpiDeliveryError('Entrega não encontrada', 'NOT_FOUND');
    }
    return mapDelivery(row);
  });
}

// ─── List Employee Deliveries (for Ficha tab) ────────────────────────

export async function listEmployeeDeliveries(
  ctx: RlsContext,
  employeeId: string,
): Promise<EpiDeliveryOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    // Verify employee belongs to org
    const employee = await (tx as any).employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new EpiDeliveryError('Colaborador não encontrado', 'EMPLOYEE_NOT_FOUND');
    }

    const rows = await (tx as any).epiDelivery.findMany({
      where: { employeeId, organizationId: ctx.organizationId },
      orderBy: { date: 'desc' },
      include: DELIVERY_INCLUDE,
    });

    return rows.map(mapDelivery);
  });
}

// ─── Generate EPI Ficha PDF (NR-6 compliant) ────────────────────────

export async function generateEpiFichaPdf(
  ctx: RlsContext,
  employeeId: string,
): Promise<Buffer> {
  // Fetch employee data
  const employeeData = await withRlsContext(ctx, async (tx) => {
    const emp = await (tx as any).employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      include: {
        position: { select: { title: true } },
      },
    });
    if (!emp) {
      throw new EpiDeliveryError('Colaborador não encontrado', 'EMPLOYEE_NOT_FOUND');
    }

    const deliveries = await (tx as any).epiDelivery.findMany({
      where: { employeeId, organizationId: ctx.organizationId },
      orderBy: { date: 'asc' },
      include: DELIVERY_INCLUDE,
    });

    return { emp, deliveries };
  });

  const { emp, deliveries } = employeeData;

  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100;

    // ── Header ──
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('FICHA DE CONTROLE DE EPI', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').text('Conforme NR-6 e NR-31', { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Employee Data ──
    doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO COLABORADOR');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Nome: ${emp.name}`);
    doc.text(`Cargo: ${emp.position?.title ?? 'Não informado'}`);
    if (emp.hireDate) {
      const hireDate = new Date(emp.hireDate);
      doc.text(`Admissão: ${hireDate.toLocaleDateString('pt-BR')}`);
    }
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Table Header ──
    doc.fontSize(9).font('Helvetica-Bold');
    const colWidths = [70, 160, 70, 35, 80, 80];
    const colHeaders = ['Data', 'Descrição EPI', 'Nº CA', 'Qtd', 'Motivo', 'Assinatura'];
    let xPos = 50;
    for (let i = 0; i < colHeaders.length; i++) {
      doc.text(colHeaders[i], xPos, doc.y, { width: colWidths[i], lineBreak: false });
      xPos += colWidths[i];
    }
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
    doc.moveDown(0.2);

    // ── Table Rows ──
    doc.font('Helvetica');
    for (const delivery of deliveries) {
      const deliveryDate = new Date(delivery.date);
      const dateStr = deliveryDate.toLocaleDateString('pt-BR');
      const cols = [
        dateStr,
        delivery.epiProduct?.product?.name ?? '',
        delivery.epiProduct?.caNumber ?? '',
        String(delivery.quantity),
        delivery.reason ?? '',
        delivery.signatureUrl ? 'Assinado' : '_____________',
      ];

      xPos = 50;
      const rowY = doc.y;
      doc.fontSize(8);
      for (let i = 0; i < cols.length; i++) {
        doc.text(cols[i], xPos, rowY, { width: colWidths[i], lineBreak: false });
        xPos += colWidths[i];
      }
      doc.moveDown(0.6);
    }

    if (deliveries.length === 0) {
      doc.fontSize(9).text('Nenhuma entrega registrada.', { italic: true });
    }

    doc.moveDown(1);

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Footer / Declaration ──
    doc.fontSize(8).font('Helvetica');
    doc.text(
      'Declaro ter recebido os EPIs listados acima, ter sido treinado quanto ao uso correto e conservação, e me comprometo a usá-los durante a jornada de trabalho.',
      { align: 'justify' },
    );
    doc.moveDown(1.5);

    // Signature lines
    const sigWidth = (pageWidth - 20) / 2;
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + sigWidth, doc.y)
      .stroke();
    doc
      .moveTo(50 + sigWidth + 20, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.2);
    doc.fontSize(8);
    doc.text('Assinatura do Colaborador', 50, doc.y, { width: sigWidth, align: 'center' });
    doc.text('Assinatura do Empregador', 50 + sigWidth + 20, doc.y - doc.currentLineHeight(), {
      width: sigWidth,
      align: 'center',
    });

    doc.end();
  });
}
