import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import {
  PurchaseOrderError,
  canOcTransition,
  type OcStatus,
  type CreateEmergencyPOInput,
  type DuplicatePOInput,
  type UpdatePOInput,
  type TransitionPOInput,
  type ListPurchaseOrdersQuery,
} from './purchase-orders.types';
import { createNotification } from '../notifications/notifications.service';
import { checkBudgetExceeded } from '../purchase-budgets/purchase-budgets.service';
import { sendMail } from '../../shared/mail/mail.service';
import { logger } from '../../shared/utils/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ──────────────────────────────────────────────────────────

async function getNextOcSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.purchaseOrder.findFirst({
    where: {
      organizationId,
      sequentialNumber: { startsWith: `OC-${year}/` },
    },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });

  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }

  return `OC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}

const PO_INCLUDE = {
  items: true,
  supplier: { select: { id: true, name: true, tradeName: true, contactEmail: true } },
  creator: { select: { id: true, name: true } },
  quotation: {
    select: {
      id: true,
      sequentialNumber: true,
      purchaseRequest: { select: { sequentialNumber: true } },
    },
  },
} as const;

// ─── Create Emergency PO ──────────────────────────────────────────────

export async function createEmergencyPO(
  ctx: RlsContext & { userId: string },
  input: CreateEmergencyPOInput,
) {
  // Validate justification
  if (!input.justification || input.justification.trim() === '') {
    throw new PurchaseOrderError('Justificativa e obrigatoria para pedidos emergenciais', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate supplier exists and is ACTIVE
    const supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, organizationId: ctx.organizationId },
    });

    if (!supplier) {
      throw new PurchaseOrderError('Fornecedor nao encontrado', 404);
    }

    if (supplier.status !== 'ACTIVE') {
      throw new PurchaseOrderError('Fornecedor nao esta ativo', 400);
    }

    const sequentialNumber = await getNextOcSequentialNumber(tx, ctx.organizationId);

    const po = await tx.purchaseOrder.create({
      data: {
        organizationId: ctx.organizationId,
        supplierId: input.supplierId,
        sequentialNumber,
        status: 'RASCUNHO',
        isEmergency: true,
        emergencyJustification: input.justification,
        notes: input.notes ?? null,
        internalReference: input.internalReference ?? null,
        expectedDeliveryDate: input.expectedDeliveryDate
          ? new Date(input.expectedDeliveryDate)
          : null,
        createdBy: ctx.userId,
        items: {
          create: input.items.map((item) => ({
            productName: item.productName,
            unitName: item.unitName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            notes: item.notes ?? null,
          })),
        },
      },
      include: PO_INCLUDE,
    });

    return po;
  });
}

// ─── Duplicate PO ─────────────────────────────────────────────────────

export async function duplicatePO(ctx: RlsContext & { userId: string }, input: DuplicatePOInput) {
  return withRlsContext(ctx, async (tx) => {
    const source = await tx.purchaseOrder.findFirst({
      where: {
        id: input.sourcePurchaseOrderId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: { items: true },
    });

    if (!source) {
      throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
    }

    const sequentialNumber = await getNextOcSequentialNumber(tx, ctx.organizationId);

    const po = await tx.purchaseOrder.create({
      data: {
        organizationId: ctx.organizationId,
        supplierId: source.supplierId,
        sequentialNumber,
        status: 'RASCUNHO',
        isEmergency: false,
        quotationId: null,
        notes: input.notes ?? `Duplicado de ${source.sequentialNumber}`,
        internalReference: source.internalReference ?? null,
        expectedDeliveryDate: source.expectedDeliveryDate ?? null,
        createdBy: ctx.userId,
        items: {
          create: source.items.map((item: TxClient) => ({
            productName: item.productName,
            unitName: item.unitName,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            notes: item.notes ?? null,
          })),
        },
      },
      include: PO_INCLUDE,
    });

    return po;
  });
}

// ─── List Purchase Orders ─────────────────────────────────────────────

export async function listPurchaseOrders(ctx: RlsContext, query: ListPurchaseOrdersQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const now = new Date();
  const overdueStatuses: OcStatus[] = ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  if (query.isEmergency !== undefined) {
    where.isEmergency = query.isEmergency;
  }

  if (query.overdue) {
    where.expectedDeliveryDate = { lt: now };
    where.status = { in: overdueStatuses };
  }

  if (query.search) {
    where.OR = [
      { sequentialNumber: { contains: query.search, mode: 'insensitive' } },
      { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return withRlsContext(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, tradeName: true } },
          items: { select: { id: true } },
          quotation: { select: { sequentialNumber: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      tx.purchaseOrder.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const data = rows.map((po: TxClient) => ({
      ...po,
      isOverdue:
        po.expectedDeliveryDate &&
        po.expectedDeliveryDate < now &&
        !['ENTREGUE', 'CANCELADA'].includes(po.status),
    }));

    return { data, total, page, limit, totalPages };
  });
}

// ─── Get Purchase Order by ID ──────────────────────────────────────────

export async function getPurchaseOrderById(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: PO_INCLUDE,
    });

    if (!po) {
      throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
    }

    return po;
  });
}

// ─── Update PO ────────────────────────────────────────────────────────

export async function updatePO(ctx: RlsContext, id: string, input: UpdatePOInput) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new PurchaseOrderError('OC emitida nao pode ser editada', 400);
    }

    // Replace items if provided
    if (input.items !== undefined) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      if (input.items.length > 0) {
        await tx.purchaseOrderItem.createMany({
          data: input.items.map((item) => ({
            purchaseOrderId: id,
            productName: item.productName,
            unitName: item.unitName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            notes: item.notes ?? null,
          })),
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.internalReference !== undefined) data.internalReference = input.internalReference;
    if (input.expectedDeliveryDate !== undefined) {
      data.expectedDeliveryDate = input.expectedDeliveryDate
        ? new Date(input.expectedDeliveryDate)
        : null;
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data,
      include: PO_INCLUDE,
    });

    return updated;
  });
}

// ─── Transition PO ────────────────────────────────────────────────────

export async function transitionPO(
  ctx: RlsContext & { userId: string },
  id: string,
  input: TransitionPOInput,
) {
  return withRlsContext(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!po) {
      throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
    }

    if (!canOcTransition(po.status, input.status)) {
      throw new PurchaseOrderError(`Transicao invalida: ${po.status} -> ${input.status}`, 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { status: input.status };

    if (input.status === 'EMITIDA') {
      data.issuedAt = new Date();

      // Budget check on EMITIDA (non-blocking)
      const poItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        select: { totalPrice: true, purchaseRequestItemId: true },
      });

      const poTotal = poItems.reduce(
        (sum: number, item: TxClient) => sum + Number(item.totalPrice),
        0,
      );

      // Determine category from first item with a linked RC
      let category: string | null = null;
      for (const item of poItems) {
        if (item.purchaseRequestItemId) {
          const rcItem = await tx.purchaseRequestItem.findFirst({
            where: { id: item.purchaseRequestItemId },
            include: { purchaseRequest: { select: { requestType: true } } },
          });
          if (rcItem?.purchaseRequest?.requestType) {
            category = rcItem.purchaseRequest.requestType;
            break;
          }
        }
      }

      if (category) {
        const budgetCheck = await checkBudgetExceeded(
          tx,
          ctx.organizationId,
          category,
          null,
          poTotal,
        );
        if (budgetCheck.exceeded) {
          data.budgetExceeded = true;

          // Notify current user (who issued the OC) + FINANCIAL
          void createNotification(tx, ctx.organizationId, {
            recipientId: ctx.userId,
            type: 'BUDGET_EXCEEDED',
            title: 'Orcamento comprometido',
            body: `Emissao de ${po.sequentialNumber} ultrapassou o orcamento comprometido.`,
            referenceId: id,
            referenceType: 'purchase_order',
          }).catch(() => {});

          const financialUsers = await tx.user.findMany({
            where: { organizationId: ctx.organizationId, role: 'FINANCIAL' },
            select: { id: true },
            take: 5,
          });
          for (const u of financialUsers) {
            void createNotification(tx, ctx.organizationId, {
              recipientId: u.id,
              type: 'BUDGET_EXCEEDED',
              title: 'Orcamento comprometido',
              body: `Emissao de ${po.sequentialNumber} ultrapassou o orcamento comprometido.`,
              referenceId: id,
              referenceType: 'purchase_order',
            }).catch(() => {});
          }
        }
      }
    } else if (input.status === 'CONFIRMADA') {
      data.confirmedAt = new Date();
    } else if (input.status === 'CANCELADA') {
      data.cancelledAt = new Date();
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data,
      include: PO_INCLUDE,
    });

    return updated;
  });
}

// ─── Delete PO (soft) ─────────────────────────────────────────────────

export async function deletePO(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new PurchaseOrderError('Apenas pedidos em rascunho podem ser excluidos', 400);
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  });
}

// ─── Generate Purchase Order PDF ──────────────────────────────────────

export async function generatePurchaseOrderPdf(
  ctx: RlsContext,
  id: string,
  res: Response,
): Promise<void> {
  const po = await withRlsContext(ctx, async (tx) => {
    const found = await tx.purchaseOrder.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        items: true,
        supplier: true,
        creator: { select: { id: true, name: true } },
        quotation: {
          select: {
            sequentialNumber: true,
            purchaseRequest: { select: { sequentialNumber: true } },
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });
    return found;
  });

  if (!po) {
    throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="OC-${po.sequentialNumber}.pdf"`);

  doc.pipe(res);

  const pageWidth = doc.page.width - 100;

  // ── Header: Organization ──
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(po.organization?.name ?? 'Organização', { align: 'left' });
  doc.moveDown(0.5);

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(50 + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.5);

  // ── Title: PEDIDO DE COMPRA ──
  doc.fontSize(14).font('Helvetica-Bold').text('PEDIDO DE COMPRA', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`Número: ${po.sequentialNumber}`, { align: 'center' });
  doc
    .fontSize(9)
    .text(`Data: ${new Date(po.createdAt).toLocaleDateString('pt-BR')}`, { align: 'center' });
  if (po.isEmergency) {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#C62828')
      .text('EMERGENCIAL', { align: 'center' });
    doc.fillColor('#000000');
  }
  doc.moveDown(0.5);

  // ── Supplier Block ──
  doc.fontSize(11).font('Helvetica-Bold').text('FORNECEDOR');
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica');
  doc.text(`Nome: ${po.supplier.name}`);
  if (po.supplier.tradeName) doc.text(`Nome Fantasia: ${po.supplier.tradeName}`);
  if (po.supplier.document) doc.text(`CNPJ/CPF: ${po.supplier.document}`);
  if (po.supplier.address) doc.text(`Endereço: ${po.supplier.address}`);
  if (po.supplier.contactPhone) doc.text(`Telefone: ${po.supplier.contactPhone}`);
  if (po.supplier.contactEmail) doc.text(`E-mail: ${po.supplier.contactEmail}`);
  doc.moveDown(0.5);

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(50 + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.5);

  // ── Items Table ──
  doc.fontSize(11).font('Helvetica-Bold').text('ITENS DO PEDIDO');
  doc.moveDown(0.3);

  // Table header
  const colX = { num: 50, produto: 70, unidade: 270, qty: 340, price: 400, total: 470 };
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text('#', colX.num, doc.y);
  doc.text('Produto', colX.produto, doc.y - doc.currentLineHeight());
  doc.text('Unidade', colX.unidade, doc.y - doc.currentLineHeight());
  doc.text('Qtd', colX.qty, doc.y - doc.currentLineHeight());
  doc.text('Preço Unit.', colX.price, doc.y - doc.currentLineHeight());
  doc.text('Total', colX.total, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);

  doc
    .moveTo(50, doc.y)
    .lineTo(50 + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.3);

  // Table rows
  let subtotal = 0;
  doc.fontSize(8).font('Helvetica');

  for (const [i, item] of po.items.entries()) {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const total = Number(item.totalPrice);
    subtotal += total;

    const rowY = doc.y;
    doc.text(String(i + 1), colX.num, rowY);
    doc.text(item.productName, colX.produto, rowY);
    doc.text(item.unitName, colX.unidade, rowY);
    doc.text(qty.toFixed(3), colX.qty, rowY);
    doc.text(
      unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      colX.price,
      rowY,
    );
    doc.text(
      total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      colX.total,
      rowY,
    );
    doc.moveDown(0.5);

    if (item.notes) {
      doc.fontSize(7).text(`  Obs: ${item.notes}`, colX.produto, doc.y);
      doc.fontSize(8);
      doc.moveDown(0.3);
    }
  }

  doc
    .moveTo(50, doc.y)
    .lineTo(50 + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.3);

  // ── Totals ──
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(
    `Subtotal: ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    { align: 'right' },
  );
  doc.moveDown(0.5);

  // Notes
  if (po.notes) {
    doc.fontSize(9).font('Helvetica-Bold').text('OBSERVAÇÕES:');
    doc.fontSize(9).font('Helvetica').text(po.notes);
    doc.moveDown(0.5);
  }

  // Emergency justification
  if (po.isEmergency && po.emergencyJustification) {
    doc.fontSize(9).font('Helvetica-Bold').text('JUSTIFICATIVA DE EMERGÊNCIA:');
    doc.fontSize(9).font('Helvetica').text(po.emergencyJustification);
    doc.moveDown(0.5);
  }

  // ── Conditions ──
  doc.fontSize(11).font('Helvetica-Bold').text('CONDIÇÕES');
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica');

  if (po.expectedDeliveryDate) {
    doc.text(`Prazo de Entrega: ${new Date(po.expectedDeliveryDate).toLocaleDateString('pt-BR')}`);
  }

  if (po.internalReference) {
    doc.text(`Referência Interna: ${po.internalReference}`);
  }

  if (po.quotation?.sequentialNumber) {
    doc.text(`Cotação de Origem: ${po.quotation.sequentialNumber}`);
  }

  doc.moveDown(1);

  // ── Footer ──
  doc
    .moveTo(50, doc.y)
    .lineTo(50 + pageWidth, doc.y)
    .stroke();
  doc.moveDown(0.5);
  doc.fontSize(8).font('Helvetica');
  doc.text(
    `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} — ${po.organization?.name ?? 'Protos Farm'}`,
    { align: 'center' },
  );

  doc.end();
}

// ─── Send PO Email ───────────────────────────────────────────────────

export interface SendPOEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function sendPurchaseOrderEmail(
  ctx: RlsContext,
  id: string,
  input: SendPOEmailInput,
): Promise<void> {
  const po = await withRlsContext(ctx, async (tx) => {
    return tx.purchaseOrder.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        items: true,
        supplier: true,
        organization: { select: { name: true } },
      },
    });
  });

  if (!po) {
    throw new PurchaseOrderError('Pedido de compra nao encontrado', 404);
  }

  if (po.status !== 'EMITIDA') {
    throw new PurchaseOrderError('Apenas pedidos emitidos podem ser enviados por email', 400);
  }

  // Generate PDF as buffer
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', resolve);
    doc.on('error', reject);

    // Reuse the same PDF layout from generatePurchaseOrderPdf
    const pageWidth = doc.page.width - 100;

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(po.organization?.name ?? 'Organizacao', { align: 'left' });
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.5);

    doc.fontSize(14).font('Helvetica-Bold').text('PEDIDO DE COMPRA', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Numero: ${po.sequentialNumber}`, { align: 'center' });
    doc
      .fontSize(9)
      .text(`Data: ${new Date(po.createdAt).toLocaleDateString('pt-BR')}`, { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('FORNECEDOR');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Nome: ${po.supplier.name}`);
    if (po.supplier.tradeName) doc.text(`Nome Fantasia: ${po.supplier.tradeName}`);
    if (po.supplier.document) doc.text(`CNPJ/CPF: ${po.supplier.document}`);
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('ITENS DO PEDIDO');
    doc.moveDown(0.3);

    let subtotal = 0;
    doc.fontSize(8).font('Helvetica');
    for (const [i, item] of po.items.entries()) {
      const total = Number(item.totalPrice);
      subtotal += total;
      doc.text(
        `${i + 1}. ${item.productName} — ${Number(item.quantity).toFixed(3)} ${item.unitName} x ${Number(item.unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} = ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      );
    }
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Total: ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, {
        align: 'right',
      });

    doc.moveDown(1);
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} — ${po.organization?.name ?? 'Protos Farm'}`,
        { align: 'center' },
      );

    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);

  // Build HTML email with brand colors
  const itemsHtml = po.items
    .map((item, i) => {
      const total = Number(item.totalPrice);
      return `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${i + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${Number(item.quantity).toFixed(3)} ${item.unitName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
    </tr>`;
    })
    .join('');

  const totalAmount = po.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">${po.organization?.name ?? 'Protos Farm'}</h1>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #2A2520; font-size: 18px; margin-top: 0;">Pedido de Compra ${po.sequentialNumber}</h2>
        <p style="color: #3E3833; line-height: 1.6; white-space: pre-line;">${input.body}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;">#</th>
              <th style="padding: 8px; text-align: left;">Produto</th>
              <th style="padding: 8px; text-align: left;">Qtd</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px; font-weight: bold; text-align: right;">Total:</td>
              <td style="padding: 8px; font-weight: bold; text-align: right;">${totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="padding: 16px; background: #FAFAF8; text-align: center; font-size: 13px; color: #3E3833;">
        PDF do pedido em anexo
      </div>
    </div>
  `;

  try {
    await sendMail({
      to: input.to,
      subject: input.subject,
      text: `${input.body}\n\nPedido: ${po.sequentialNumber}\nTotal: ${totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      html,
      attachments: [
        {
          filename: `OC-${po.sequentialNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (err) {
    logger.error({ err, poId: id, to: input.to }, 'Failed to send PO email');
    throw new PurchaseOrderError(
      'Nao foi possivel enviar o email. Verifique a configuracao SMTP.',
      500,
    );
  }
}

// ─── Check Overdue POs ────────────────────────────────────────────────

export async function checkOverduePOs(ctx: RlsContext): Promise<number> {
  const now = new Date();
  const overdueStatuses: OcStatus[] = ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'];

  const overduePOs = await prisma.purchaseOrder.findMany({
    where: {
      organizationId: ctx.organizationId,
      expectedDeliveryDate: { lt: now },
      status: { in: overdueStatuses },
      overdueNotifiedAt: null,
      deletedAt: null,
    },
    include: {
      creator: { select: { id: true } },
    },
  });

  let count = 0;

  for (const po of overduePOs) {
    await prisma.$transaction(async (tx) => {
      await createNotification(tx, ctx.organizationId, {
        recipientId: po.createdBy,
        type: 'PO_OVERDUE',
        title: 'Pedido de compra em atraso',
        body: `${po.sequentialNumber} esta com entrega atrasada.`,
        referenceId: po.id,
        referenceType: 'purchase_order',
      });

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { overdueNotifiedAt: now },
      });
    });

    count++;
  }

  return count;
}
