import { Money } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  TransferError,
  type CreateTransferInput,
  type ListTransfersQuery,
  type TransferOutput,
} from './transfers.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ─────────────────────────────────────────────────────────

function toTransferOutput(row: any): TransferOutput {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    fromAccountId: row.fromAccountId as string,
    toAccountId: row.toAccountId as string,
    fromAccountName: (row.fromAccount?.name ?? '') as string,
    toAccountName: (row.toAccount?.name ?? '') as string,
    type: row.type as string,
    amount: Money.fromPrismaDecimal(row.amount).toNumber(),
    feeAmount: row.feeAmount ? Money.fromPrismaDecimal(row.feeAmount).toNumber() : null,
    description: row.description as string,
    transferDate: (row.transferDate as Date).toISOString(),
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

const TRANSFER_INCLUDE = {
  fromAccount: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
};

// ─── createTransfer ──────────────────────────────────────────────────

export async function createTransfer(
  ctx: RlsContext,
  input: CreateTransferInput,
): Promise<TransferOutput> {
  if (input.fromAccountId === input.toAccountId) {
    throw new TransferError('Conta de origem e destino devem ser diferentes', 400);
  }

  const transfer = await withRlsContext(ctx, async (tx) => {
    const transferAmount = Money(input.amount);
    const feeAmount = input.feeAmount ? Money(input.feeAmount) : null;

    // Verify both accounts exist and belong to the organization
    const [fromAccount, toAccount] = await Promise.all([
      (tx as any).bankAccount.findFirst({
        where: { id: input.fromAccountId, organizationId: ctx.organizationId, isActive: true },
      }),
      (tx as any).bankAccount.findFirst({
        where: { id: input.toAccountId, organizationId: ctx.organizationId, isActive: true },
      }),
    ]);

    if (!fromAccount || !toAccount) {
      throw new TransferError('Conta não encontrada', 404);
    }

    // Create AccountTransfer record
    const created = await (tx as any).accountTransfer.create({
      data: {
        organizationId: ctx.organizationId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        type: input.type,
        amount: transferAmount.toDecimal(),
        feeAmount: feeAmount ? feeAmount.toDecimal() : null,
        description: input.description,
        transferDate: new Date(input.transferDate),
        notes: input.notes ?? null,
      },
    });

    // Create mirrored FinancialTransactions
    await (tx as any).financialTransaction.createMany({
      data: [
        {
          organizationId: ctx.organizationId,
          bankAccountId: input.fromAccountId,
          type: 'DEBIT',
          amount: transferAmount.toDecimal(),
          description: `Transferência para ${toAccount.name}`,
          referenceType: 'TRANSFER',
          referenceId: created.id,
          transactionDate: new Date(input.transferDate),
        },
        {
          organizationId: ctx.organizationId,
          bankAccountId: input.toAccountId,
          type: 'CREDIT',
          amount: transferAmount.toDecimal(),
          description: `Transferência de ${fromAccount.name}`,
          referenceType: 'TRANSFER',
          referenceId: created.id,
          transactionDate: new Date(input.transferDate),
        },
      ],
    });

    // Update balances atomically
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: input.fromAccountId },
      data: { currentBalance: { decrement: transferAmount.toDecimal() } },
    });
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: input.toAccountId },
      data: { currentBalance: { increment: transferAmount.toDecimal() } },
    });

    // Handle optional fee: 3rd FinancialTransaction + additional balance decrement
    if (feeAmount && !feeAmount.isZero()) {
      await (tx as any).financialTransaction.create({
        data: {
          organizationId: ctx.organizationId,
          bankAccountId: input.fromAccountId,
          type: 'DEBIT',
          amount: feeAmount.toDecimal(),
          description: 'Tarifa de transferência',
          referenceType: 'TRANSFER_FEE',
          referenceId: created.id,
          transactionDate: new Date(input.transferDate),
        },
      });
      await (tx as any).bankAccountBalance.update({
        where: { bankAccountId: input.fromAccountId },
        data: { currentBalance: { decrement: feeAmount.toDecimal() } },
      });
    }

    // Return with relations
    return (tx as any).accountTransfer.findUnique({
      where: { id: created.id },
      include: TRANSFER_INCLUDE,
    });
  });

  return toTransferOutput(transfer);
}

// ─── listTransfers ───────────────────────────────────────────────────

export async function listTransfers(
  ctx: RlsContext,
  query: ListTransfersQuery = {},
): Promise<TransferOutput[]> {
  const { startDate, endDate, type, accountId } = query;

  const where: any = { organizationId: ctx.organizationId };

  if (startDate || endDate) {
    where.transferDate = {};
    if (startDate) where.transferDate.gte = new Date(startDate);
    if (endDate) {
      const toDate = new Date(endDate);
      toDate.setUTCHours(23, 59, 59, 999);
      where.transferDate.lte = toDate;
    }
  }

  if (type) {
    where.type = type;
  }

  if (accountId) {
    where.OR = [{ fromAccountId: accountId }, { toAccountId: accountId }];
  }

  const transfers = await withRlsContext(ctx, async (tx) => {
    return (tx as any).accountTransfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { transferDate: 'desc' },
    });
  });

  return transfers.map(toTransferOutput);
}

// ─── getTransfer ─────────────────────────────────────────────────────

export async function getTransfer(ctx: RlsContext, transferId: string): Promise<TransferOutput> {
  const transfer = await withRlsContext(ctx, async (tx) => {
    return (tx as any).accountTransfer.findFirst({
      where: { id: transferId, organizationId: ctx.organizationId },
      include: TRANSFER_INCLUDE,
    });
  });

  if (!transfer) {
    throw new TransferError('Transferência não encontrada', 404);
  }

  return toTransferOutput(transfer);
}

// ─── deleteTransfer ──────────────────────────────────────────────────

export async function deleteTransfer(ctx: RlsContext, transferId: string): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const transfer = await (tx as any).accountTransfer.findFirst({
      where: { id: transferId, organizationId: ctx.organizationId },
    });

    if (!transfer) {
      throw new TransferError('Transferência não encontrada', 404);
    }

    const transferAmount = Money.fromPrismaDecimal(transfer.amount);
    const feeAmount = transfer.feeAmount ? Money.fromPrismaDecimal(transfer.feeAmount) : null;

    // Reverse balance changes: increment from (reversal of debit), decrement to (reversal of credit)
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: transfer.fromAccountId },
      data: { currentBalance: { increment: transferAmount.toDecimal() } },
    });
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: transfer.toAccountId },
      data: { currentBalance: { decrement: transferAmount.toDecimal() } },
    });

    // Reverse fee if it existed
    if (feeAmount && !feeAmount.isZero()) {
      await (tx as any).bankAccountBalance.update({
        where: { bankAccountId: transfer.fromAccountId },
        data: { currentBalance: { increment: feeAmount.toDecimal() } },
      });
    }

    // Delete FinancialTransactions linked to this transfer
    await (tx as any).financialTransaction.deleteMany({
      where: { referenceId: transferId, referenceType: { in: ['TRANSFER', 'TRANSFER_FEE'] } },
    });

    // Delete the transfer record
    await (tx as any).accountTransfer.delete({
      where: { id: transferId },
    });
  });
}
