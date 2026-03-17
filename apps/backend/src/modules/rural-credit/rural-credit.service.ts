import { Money } from '@protos-farm/shared';
import { generateSchedule } from '@protos-farm/shared/src/utils/rural-credit-schedule';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  RuralCreditError,
  CREDIT_LINE_LABELS,
  type CreateContractInput,
  type SimulateInput,
  type UpdateContractInput,
  type ExtraordinaryAmortizationInput,
  type SettleInstallmentInput,
  type ListContractsQuery,
  type ContractOutput,
  type ContractListItem,
  type SimulateScheduleRow,
  type RuralCreditInstallmentOutput,
} from './rural-credit.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Constants ────────────────────────────────────────────────────────

export const OVERDUE_THRESHOLD_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────

function toInstallmentOutput(row: any): RuralCreditInstallmentOutput {
  const payable = row.payable ?? {};
  return {
    id: row.id as string,
    contractId: row.contractId as string,
    payableId: row.payableId as string,
    installmentNumber: row.installmentNumber as number,
    principal: Money.fromPrismaDecimal(row.principal).toNumber(),
    interest: Money.fromPrismaDecimal(row.interest).toNumber(),
    outstandingBalanceAfter: Money.fromPrismaDecimal(row.outstandingBalanceAfter).toNumber(),
    payableStatus: (payable.status as string) ?? 'PENDING',
    dueDate: payable.dueDate ? (payable.dueDate as Date).toISOString() : '',
    totalPayment: payable.totalAmount
      ? Money.fromPrismaDecimal(payable.totalAmount).toNumber()
      : Money.fromPrismaDecimal(row.principal)
          .add(Money.fromPrismaDecimal(row.interest))
          .toNumber(),
    paidAt: payable.paidAt ? (payable.paidAt as Date).toISOString() : null,
    amountPaid:
      payable.amountPaid != null ? Money.fromPrismaDecimal(payable.amountPaid).toNumber() : null,
  };
}

function toContractOutput(row: any): ContractOutput {
  const creditLine = row.creditLine as string;
  const bankAccount = row.bankAccount ?? {};
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    farmId: row.farmId as string,
    bankAccountId: row.bankAccountId as string,
    contractNumber: (row.contractNumber as string) ?? null,
    creditLine,
    creditLineLabel: CREDIT_LINE_LABELS[creditLine] ?? creditLine,
    amortizationSystem: row.amortizationSystem as string,
    principalAmount: Money.fromPrismaDecimal(row.principalAmount).toNumber(),
    annualRate: Money.fromPrismaDecimal(row.annualRate).toNumber(),
    termMonths: row.termMonths as number,
    gracePeriodMonths: row.gracePeriodMonths as number,
    firstPaymentYear: row.firstPaymentYear as number,
    firstPaymentMonth: row.firstPaymentMonth as number,
    paymentDayOfMonth: row.paymentDayOfMonth as number,
    releasedAt: (row.releasedAt as Date).toISOString(),
    iofAmount: row.iofAmount != null ? Money.fromPrismaDecimal(row.iofAmount).toNumber() : null,
    tacAmount: row.tacAmount != null ? Money.fromPrismaDecimal(row.tacAmount).toNumber() : null,
    guaranteeDescription: (row.guaranteeDescription as string) ?? null,
    alertDaysBefore: row.alertDaysBefore as number,
    status: row.status as string,
    outstandingBalance: Money.fromPrismaDecimal(row.outstandingBalance).toNumber(),
    totalPrincipalPaid: Money.fromPrismaDecimal(row.totalPrincipalPaid).toNumber(),
    totalInterestPaid: Money.fromPrismaDecimal(row.totalInterestPaid).toNumber(),
    notes: (row.notes as string) ?? null,
    cancelledAt: row.cancelledAt ? (row.cancelledAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
    installments: (row.installments ?? []).map(toInstallmentOutput),
    bankName: (bankAccount.name as string) ?? null,
  };
}

const CONTRACT_INCLUDE = {
  installments: {
    orderBy: { installmentNumber: 'asc' as const },
    include: {
      payable: true,
    },
  },
  bankAccount: {
    select: { name: true },
  },
};

// ─── computeContractStatus ────────────────────────────────────────────

export function computeContractStatus(currentStatus: string, installments: any[]): string {
  if (currentStatus === 'CANCELADO') return 'CANCELADO';

  const pendingInstallments = installments.filter(
    (inst: any) => (inst.payable?.status ?? inst.payableStatus) === 'PENDING',
  );
  const paidInstallments = installments.filter(
    (inst: any) => (inst.payable?.status ?? inst.payableStatus) === 'PAID',
  );

  if (installments.length > 0 && pendingInstallments.length === 0 && paidInstallments.length > 0) {
    return 'QUITADO';
  }

  const now = new Date();
  const overdueThreshold = new Date(now);
  overdueThreshold.setDate(overdueThreshold.getDate() - OVERDUE_THRESHOLD_DAYS);

  const hasOverdue = pendingInstallments.some((inst: any) => {
    const dueDate = inst.payable?.dueDate ?? null;
    if (!dueDate) return false;
    return new Date(dueDate) < overdueThreshold;
  });

  if (hasOverdue) return 'INADIMPLENTE';

  return 'ATIVO';
}

// ─── simulateSchedule ─────────────────────────────────────────────────

export function simulateSchedule(input: SimulateInput): SimulateScheduleRow[] {
  const rows = generateSchedule({
    principalAmount: input.principalAmount,
    annualRate: input.annualRate,
    termMonths: input.termMonths,
    gracePeriodMonths: input.gracePeriodMonths ?? 0,
    firstPaymentYear: input.firstPaymentYear,
    firstPaymentMonth: input.firstPaymentMonth,
    paymentDayOfMonth: input.paymentDayOfMonth ?? 1,
    amortizationSystem: input.amortizationSystem,
  });

  return rows.map((row) => ({
    installmentNumber: row.installmentNumber,
    dueDate: row.dueDate.toISOString(),
    principal: row.principal.toNumber(),
    interest: row.interest.toNumber(),
    totalPayment: row.totalPayment.toNumber(),
    outstandingBalance: row.outstandingBalance.toNumber(),
  }));
}

// ─── createContract ───────────────────────────────────────────────────

export async function createContract(
  ctx: RlsContext,
  input: CreateContractInput,
): Promise<ContractOutput> {
  const {
    farmId,
    bankAccountId,
    contractNumber,
    creditLine,
    amortizationSystem,
    principalAmount,
    annualRate,
    termMonths,
    gracePeriodMonths = 0,
    firstPaymentYear,
    firstPaymentMonth,
    paymentDayOfMonth = 1,
    releasedAt,
    iofAmount,
    tacAmount,
    guaranteeDescription,
    alertDaysBefore = 15,
    notes,
  } = input;

  const scheduleRows = generateSchedule({
    principalAmount,
    annualRate,
    termMonths,
    gracePeriodMonths,
    firstPaymentYear,
    firstPaymentMonth,
    paymentDayOfMonth,
    amortizationSystem,
  });

  const creditLineLabel = CREDIT_LINE_LABELS[creditLine] ?? creditLine;

  const contract = await withRlsContext(ctx, async (tx) => {
    // Validate farmId belongs to org
    const farm = await (tx as any).farm.findFirst({
      where: { id: farmId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!farm) {
      throw new RuralCreditError('Fazenda não encontrada', 404);
    }

    // Validate bankAccountId belongs to org
    const bankAccount = await (tx as any).bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: ctx.organizationId, isActive: true },
      select: { id: true, name: true },
    });
    if (!bankAccount) {
      throw new RuralCreditError('Conta bancária não encontrada ou inativa', 404);
    }

    // Create RuralCreditContract
    const created = await (tx as any).ruralCreditContract.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        bankAccountId,
        contractNumber: contractNumber ?? null,
        creditLine,
        amortizationSystem,
        principalAmount: Money(principalAmount).toDecimal(),
        annualRate: Money(annualRate).toDecimal(),
        termMonths,
        gracePeriodMonths,
        firstPaymentYear,
        firstPaymentMonth,
        paymentDayOfMonth,
        releasedAt: new Date(releasedAt),
        iofAmount: iofAmount != null ? Money(iofAmount).toDecimal() : null,
        tacAmount: tacAmount != null ? Money(tacAmount).toDecimal() : null,
        guaranteeDescription: guaranteeDescription ?? null,
        alertDaysBefore,
        outstandingBalance: Money(principalAmount).toDecimal(),
        notes: notes ?? null,
      },
    });

    const total = scheduleRows.length;

    // Create Payables and RuralCreditInstallments for each schedule row
    for (const row of scheduleRows) {
      const payable = await (tx as any).payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId,
          supplierName: bankAccount.name ?? 'Banco',
          category: 'FINANCING',
          description: `Parcela ${row.installmentNumber}/${total} - ${creditLineLabel}`,
          totalAmount: row.totalPayment.toDecimal(),
          dueDate: row.dueDate,
          installmentCount: 1,
          bankAccountId,
          originType: 'RURAL_CREDIT',
          originId: created.id,
        },
      });

      // Create PayableInstallment
      await (tx as any).payableInstallment.create({
        data: {
          payableId: payable.id,
          number: 1,
          amount: row.totalPayment.toDecimal(),
          dueDate: row.dueDate,
        },
      });

      // Create RuralCreditInstallment
      await (tx as any).ruralCreditInstallment.create({
        data: {
          contractId: created.id,
          payableId: payable.id,
          installmentNumber: row.installmentNumber,
          principal: row.principal.toDecimal(),
          interest: row.interest.toDecimal(),
          outstandingBalanceAfter: row.outstandingBalance.toDecimal(),
        },
      });
    }

    // Register credit release: increment BankAccountBalance
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          increment: Money(principalAmount).toDecimal(),
        },
      },
    });

    // Create FinancialTransaction for credit release
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'CREDIT',
        amount: Money(principalAmount).toDecimal(),
        description: `Liberacao credito rural: ${creditLineLabel} - ${contractNumber ?? created.id.slice(0, 8)}`,
        referenceType: 'RURAL_CREDIT_RELEASE',
        referenceId: created.id,
        transactionDate: new Date(releasedAt),
      },
    });

    // Audit log omitted (requires full actor context not available here)

    return (tx as any).ruralCreditContract.findUnique({
      where: { id: created.id },
      include: CONTRACT_INCLUDE,
    });
  });

  return toContractOutput(contract);
}

// ─── listContracts ────────────────────────────────────────────────────

export async function listContracts(
  ctx: RlsContext,
  query: ListContractsQuery = {},
): Promise<{ data: ContractListItem[]; total: number; page: number; limit: number }> {
  const { farmId, status, creditLine, page = 1, limit = 20 } = query;

  const where: any = { organizationId: ctx.organizationId };
  if (farmId) where.farmId = farmId;
  if (status) where.status = status;
  if (creditLine) where.creditLine = creditLine;

  const skip = (page - 1) * limit;

  const [rows, total] = await withRlsContext(ctx, async (tx) => {
    return Promise.all([
      (tx as any).ruralCreditContract.findMany({
        where,
        include: {
          bankAccount: { select: { name: true } },
          installments: {
            where: {
              payable: { status: 'PENDING' },
            },
            orderBy: { installmentNumber: 'asc' },
            take: 1,
            include: { payable: { select: { dueDate: true, totalAmount: true, status: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).ruralCreditContract.count({ where }),
    ]);
  });

  const data: ContractListItem[] = rows.map((row: any) => {
    const creditLine = row.creditLine as string;
    const nextInst = row.installments?.[0];
    const nextPayable = nextInst?.payable;
    return {
      id: row.id as string,
      creditLine,
      creditLineLabel: CREDIT_LINE_LABELS[creditLine] ?? creditLine,
      contractNumber: (row.contractNumber as string) ?? null,
      bankAccountId: row.bankAccountId as string,
      bankName: (row.bankAccount?.name as string) ?? null,
      principalAmount: Money.fromPrismaDecimal(row.principalAmount).toNumber(),
      outstandingBalance: Money.fromPrismaDecimal(row.outstandingBalance).toNumber(),
      status: row.status as string,
      nextPaymentDate: nextPayable?.dueDate ? (nextPayable.dueDate as Date).toISOString() : null,
      nextPaymentAmount: nextPayable?.totalAmount
        ? Money.fromPrismaDecimal(nextPayable.totalAmount).toNumber()
        : null,
      createdAt: (row.createdAt as Date).toISOString(),
    };
  });

  return { data, total, page, limit };
}

// ─── getContract ──────────────────────────────────────────────────────

export async function getContract(ctx: RlsContext, id: string): Promise<ContractOutput> {
  const contract = await withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).ruralCreditContract.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: CONTRACT_INCLUDE,
    });

    if (!row) {
      throw new RuralCreditError('Contrato de credito rural nao encontrado', 404);
    }

    // Recompute status
    const newStatus = computeContractStatus(row.status as string, row.installments);
    if (newStatus !== (row.status as string)) {
      await (tx as any).ruralCreditContract.update({
        where: { id },
        data: { status: newStatus },
      });
      row.status = newStatus;
    }

    return row;
  });

  return toContractOutput(contract);
}

// ─── updateContract ───────────────────────────────────────────────────

export async function updateContract(
  ctx: RlsContext,
  id: string,
  input: UpdateContractInput,
): Promise<ContractOutput> {
  const SCHEDULE_FIELDS = [
    'annualRate',
    'termMonths',
    'firstPaymentYear',
    'firstPaymentMonth',
    'paymentDayOfMonth',
  ] as const;
  const hasScheduleChange = SCHEDULE_FIELDS.some((f) => input[f] !== undefined);

  const contract = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).ruralCreditContract.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        installments: {
          include: { payable: true },
        },
        bankAccount: { select: { name: true } },
      },
    });

    if (!existing) {
      throw new RuralCreditError('Contrato de credito rural nao encontrado', 404);
    }

    if (existing.status === 'CANCELADO') {
      throw new RuralCreditError('Contrato cancelado nao pode ser editado', 422);
    }

    const updateData: any = {};
    if (input.contractNumber !== undefined) updateData.contractNumber = input.contractNumber;
    if (input.alertDaysBefore !== undefined) updateData.alertDaysBefore = input.alertDaysBefore;
    if (input.guaranteeDescription !== undefined)
      updateData.guaranteeDescription = input.guaranteeDescription;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (hasScheduleChange) {
      // Keep PAID installments, delete PENDING ones
      const pendingInstallments = existing.installments.filter(
        (inst: any) => inst.payable?.status === 'PENDING',
      );

      for (const inst of pendingInstallments) {
        await (tx as any).ruralCreditInstallment.delete({ where: { id: inst.id } });
        await (tx as any).payable.delete({ where: { id: inst.payableId } });
      }

      // Recompute schedule from current outstandingBalance
      const currentBalance = Money.fromPrismaDecimal(existing.outstandingBalance).toNumber();
      const paidInstallments = existing.installments.filter(
        (inst: any) => inst.payable?.status === 'PAID',
      );
      const paidCount = paidInstallments.length;
      const currentTermMonths = (input.termMonths ?? existing.termMonths) - paidCount;

      if (currentTermMonths > 0 && currentBalance > 0) {
        const newAnnualRate =
          input.annualRate ?? Money.fromPrismaDecimal(existing.annualRate).toNumber();
        const newFirstPaymentYear = input.firstPaymentYear ?? existing.firstPaymentYear;
        const newFirstPaymentMonth = input.firstPaymentMonth ?? existing.firstPaymentMonth;
        const newPaymentDayOfMonth = input.paymentDayOfMonth ?? existing.paymentDayOfMonth;
        const creditLine = existing.creditLine as string;
        const creditLineLabel = CREDIT_LINE_LABELS[creditLine] ?? creditLine;

        const bankAccount = existing.bankAccount;

        const newRows = generateSchedule({
          principalAmount: currentBalance,
          annualRate: newAnnualRate,
          termMonths: currentTermMonths,
          gracePeriodMonths: 0,
          firstPaymentYear: newFirstPaymentYear,
          firstPaymentMonth: newFirstPaymentMonth,
          paymentDayOfMonth: newPaymentDayOfMonth,
          amortizationSystem: existing.amortizationSystem,
        });

        const totalNew = newRows.length;
        for (const row of newRows) {
          const payable = await (tx as any).payable.create({
            data: {
              organizationId: ctx.organizationId,
              farmId: existing.farmId,
              supplierName: (bankAccount?.name as string) ?? 'Banco',
              category: 'FINANCING',
              description: `Parcela ${row.installmentNumber}/${totalNew} - ${creditLineLabel} (recalc)`,
              totalAmount: row.totalPayment.toDecimal(),
              dueDate: row.dueDate,
              installmentCount: 1,
              bankAccountId: existing.bankAccountId,
              originType: 'RURAL_CREDIT',
              originId: id,
            },
          });

          await (tx as any).payableInstallment.create({
            data: {
              payableId: payable.id,
              number: 1,
              amount: row.totalPayment.toDecimal(),
              dueDate: row.dueDate,
            },
          });

          await (tx as any).ruralCreditInstallment.create({
            data: {
              contractId: id,
              payableId: payable.id,
              installmentNumber: row.installmentNumber,
              principal: row.principal.toDecimal(),
              interest: row.interest.toDecimal(),
              outstandingBalanceAfter: row.outstandingBalance.toDecimal(),
            },
          });
        }

        if (input.annualRate !== undefined)
          updateData.annualRate = Money(input.annualRate).toDecimal();
        if (input.termMonths !== undefined) updateData.termMonths = input.termMonths;
        if (input.firstPaymentYear !== undefined)
          updateData.firstPaymentYear = input.firstPaymentYear;
        if (input.firstPaymentMonth !== undefined)
          updateData.firstPaymentMonth = input.firstPaymentMonth;
        if (input.paymentDayOfMonth !== undefined)
          updateData.paymentDayOfMonth = input.paymentDayOfMonth;
      }
    }

    await (tx as any).ruralCreditContract.update({ where: { id }, data: updateData });

    return (tx as any).ruralCreditContract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
  });

  return toContractOutput(contract);
}

// ─── cancelContract ───────────────────────────────────────────────────

export async function cancelContract(ctx: RlsContext, id: string): Promise<ContractOutput> {
  const contract = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).ruralCreditContract.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        installments: {
          include: { payable: true },
        },
      },
    });

    if (!existing) {
      throw new RuralCreditError('Contrato de credito rural nao encontrado', 404);
    }

    if (existing.status === 'CANCELADO') {
      throw new RuralCreditError('Contrato ja esta cancelado', 422);
    }

    // Cancel all PENDING payables
    const pendingPayableIds = existing.installments
      .filter((inst: any) => inst.payable?.status === 'PENDING')
      .map((inst: any) => inst.payableId as string);

    if (pendingPayableIds.length > 0) {
      await (tx as any).payable.updateMany({
        where: {
          id: { in: pendingPayableIds },
          organizationId: ctx.organizationId,
        },
        data: { status: 'CANCELLED' },
      });
    }

    await (tx as any).ruralCreditContract.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        cancelledAt: new Date(),
        outstandingBalance: Money(0).toDecimal(),
      },
    });

    return (tx as any).ruralCreditContract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
  });

  return toContractOutput(contract);
}

// ─── settleInstallment ────────────────────────────────────────────────

export async function settleInstallment(
  ctx: RlsContext,
  contractId: string,
  payableId: string,
  input: SettleInstallmentInput,
): Promise<ContractOutput> {
  const { paidAmount, paidAt, juros = 0, multa = 0, desconto = 0 } = input;

  const contract = await withRlsContext(ctx, async (tx) => {
    // Find contract
    const existing = await (tx as any).ruralCreditContract.findFirst({
      where: { id: contractId, organizationId: ctx.organizationId },
      include: {
        installments: {
          include: { payable: true },
        },
      },
    });

    if (!existing) {
      throw new RuralCreditError('Contrato de credito rural nao encontrado', 404);
    }

    if (existing.status === 'CANCELADO') {
      throw new RuralCreditError('Nao e possivel baixar parcela de contrato cancelado', 422);
    }

    // Find the RuralCreditInstallment
    const ruralInstallment = await (tx as any).ruralCreditInstallment.findFirst({
      where: { contractId, payableId },
      include: { payable: true },
    });

    if (!ruralInstallment) {
      throw new RuralCreditError('Parcela nao encontrada para este contrato', 404);
    }

    if (ruralInstallment.payable?.status === 'PAID') {
      throw new RuralCreditError('Esta parcela ja foi paga', 422);
    }

    const amountMoney = Money(paidAmount);
    const jurosMoney = Money(juros);
    const multaMoney = Money(multa);
    const descontoMoney = Money(desconto);
    const effectiveAmount = amountMoney.add(jurosMoney).add(multaMoney).subtract(descontoMoney);

    const bankAccountId = existing.bankAccountId as string;

    // Update payable to PAID
    await (tx as any).payable.update({
      where: { id: payableId },
      data: {
        status: 'PAID',
        paidAt: new Date(paidAt),
        amountPaid: amountMoney.toDecimal(),
        interestAmount: jurosMoney.toDecimal(),
        fineAmount: multaMoney.toDecimal(),
        discountAmount: descontoMoney.toDecimal(),
        bankAccountId,
      },
    });

    // Update PayableInstallment
    const pendingInstallment = await (tx as any).payableInstallment.findFirst({
      where: { payableId, status: 'PENDING' },
      orderBy: { number: 'asc' },
    });
    if (pendingInstallment) {
      await (tx as any).payableInstallment.update({
        where: { id: pendingInstallment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(paidAt),
          amountPaid: amountMoney.toDecimal(),
        },
      });
    }

    // Decrement BankAccountBalance
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          decrement: effectiveAmount.toDecimal(),
        },
      },
    });

    // Create FinancialTransaction (DEBIT)
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'DEBIT',
        amount: effectiveAmount.toDecimal(),
        description: `Parcela credito rural ${CREDIT_LINE_LABELS[existing.creditLine as string] ?? existing.creditLine} #${ruralInstallment.installmentNumber}`,
        referenceType: 'PAYABLE',
        referenceId: payableId,
        transactionDate: new Date(paidAt),
      },
    });

    // Update contract balances
    const principalMoney = Money.fromPrismaDecimal(ruralInstallment.principal);
    const interestMoney = Money.fromPrismaDecimal(ruralInstallment.interest);
    const currentOutstanding = Money.fromPrismaDecimal(existing.outstandingBalance);
    const currentPrincipalPaid = Money.fromPrismaDecimal(existing.totalPrincipalPaid);
    const currentInterestPaid = Money.fromPrismaDecimal(existing.totalInterestPaid);

    const newOutstanding = currentOutstanding.subtract(principalMoney);
    const newPrincipalPaid = currentPrincipalPaid.add(principalMoney);
    const newInterestPaid = currentInterestPaid.add(interestMoney);

    // Recompute status (check on updated installments)
    const updatedInstallments = existing.installments.map((inst: any) => {
      if (inst.payableId === payableId) {
        return { ...inst, payable: { ...inst.payable, status: 'PAID' } };
      }
      return inst;
    });
    const newStatus = computeContractStatus(existing.status as string, updatedInstallments);

    await (tx as any).ruralCreditContract.update({
      where: { id: contractId },
      data: {
        outstandingBalance: newOutstanding.toDecimal(),
        totalPrincipalPaid: newPrincipalPaid.toDecimal(),
        totalInterestPaid: newInterestPaid.toDecimal(),
        status: newStatus,
      },
    });

    return (tx as any).ruralCreditContract.findUnique({
      where: { id: contractId },
      include: CONTRACT_INCLUDE,
    });
  });

  return toContractOutput(contract);
}

// ─── applyExtraordinaryAmortization ──────────────────────────────────

export async function applyExtraordinaryAmortization(
  ctx: RlsContext,
  contractId: string,
  input: ExtraordinaryAmortizationInput,
): Promise<ContractOutput> {
  const { extraAmount, recalculateMode, paidAt } = input;

  const contract = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).ruralCreditContract.findFirst({
      where: { id: contractId, organizationId: ctx.organizationId },
      include: {
        installments: {
          include: { payable: true },
          orderBy: { installmentNumber: 'asc' },
        },
        bankAccount: { select: { name: true } },
      },
    });

    if (!existing) {
      throw new RuralCreditError('Contrato de credito rural nao encontrado', 404);
    }

    if (existing.status !== 'ATIVO' && existing.status !== 'INADIMPLENTE') {
      throw new RuralCreditError(
        'Amortizacao extraordinaria apenas disponivel para contratos ativos',
        422,
      );
    }

    const extraMoney = Money(extraAmount);
    const bankAccountId = existing.bankAccountId as string;

    // Debit bank account
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          decrement: extraMoney.toDecimal(),
        },
      },
    });

    // Create FinancialTransaction DEBIT
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'DEBIT',
        amount: extraMoney.toDecimal(),
        description: `Amortizacao extraordinaria - ${CREDIT_LINE_LABELS[existing.creditLine as string] ?? existing.creditLine}`,
        referenceType: 'RURAL_CREDIT_AMORTIZATION',
        referenceId: contractId,
        transactionDate: new Date(paidAt),
      },
    });

    // Update contract balance
    const currentOutstanding = Money.fromPrismaDecimal(existing.outstandingBalance);
    const newOutstanding = currentOutstanding.subtract(extraMoney);
    const currentPrincipalPaid = Money.fromPrismaDecimal(existing.totalPrincipalPaid);
    const newPrincipalPaid = currentPrincipalPaid.add(extraMoney);

    await (tx as any).ruralCreditContract.update({
      where: { id: contractId },
      data: {
        outstandingBalance: newOutstanding.toDecimal(),
        totalPrincipalPaid: newPrincipalPaid.toDecimal(),
      },
    });

    // Delete all PENDING payables and RuralCreditInstallments
    const pendingInstallments = existing.installments.filter(
      (inst: any) => inst.payable?.status === 'PENDING',
    );

    for (const inst of pendingInstallments) {
      await (tx as any).ruralCreditInstallment.delete({ where: { id: inst.id } });
      await (tx as any).payable.delete({ where: { id: inst.payableId } });
    }

    // Determine new schedule parameters based on mode
    const paidInstallments = existing.installments.filter(
      (inst: any) => inst.payable?.status === 'PAID',
    );
    const remainingBalance = newOutstanding.toNumber();
    const currentAnnualRate = Money.fromPrismaDecimal(existing.annualRate).toNumber();
    const creditLine = existing.creditLine as string;
    const creditLineLabel = CREDIT_LINE_LABELS[creditLine] ?? creditLine;

    let newTermMonths: number;

    if (recalculateMode === 'REDUCE_TERM') {
      // Recompute maintaining similar installment amount but fewer terms
      // Use original monthly payment to estimate new term
      newTermMonths = Math.max(1, pendingInstallments.length - 1);
    } else {
      // REDUCE_INSTALLMENT: same number of remaining terms, lower installment amounts
      newTermMonths = Math.max(1, pendingInstallments.length);
    }

    if (remainingBalance > 0 && newTermMonths > 0) {
      // Find next payment date from original schedule
      const firstPending = pendingInstallments[0];
      let nextYear = existing.firstPaymentYear as number;
      let nextMonth = existing.firstPaymentMonth as number;

      if (firstPending?.payable?.dueDate) {
        const dueDate = new Date(firstPending.payable.dueDate as Date);
        nextYear = dueDate.getUTCFullYear();
        nextMonth = dueDate.getUTCMonth() + 1;
      } else {
        // Advance from last paid installment
        const lastPaid = paidInstallments[paidInstallments.length - 1];
        if (lastPaid?.payable?.dueDate) {
          const dueDate = new Date(lastPaid.payable.dueDate as Date);
          dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);
          nextYear = dueDate.getUTCFullYear();
          nextMonth = dueDate.getUTCMonth() + 1;
        }
      }

      const newRows = generateSchedule({
        principalAmount: remainingBalance,
        annualRate: currentAnnualRate,
        termMonths: newTermMonths,
        gracePeriodMonths: 0,
        firstPaymentYear: nextYear,
        firstPaymentMonth: nextMonth,
        paymentDayOfMonth: existing.paymentDayOfMonth as number,
        amortizationSystem: existing.amortizationSystem,
      });

      const totalNew = newRows.length;
      for (const row of newRows) {
        const payable = await (tx as any).payable.create({
          data: {
            organizationId: ctx.organizationId,
            farmId: existing.farmId,
            supplierName: (existing.bankAccount?.name as string) ?? 'Banco',
            category: 'FINANCING',
            description: `Parcela ${row.installmentNumber}/${totalNew} - ${creditLineLabel} (amort)`,
            totalAmount: row.totalPayment.toDecimal(),
            dueDate: row.dueDate,
            installmentCount: 1,
            bankAccountId,
            originType: 'RURAL_CREDIT',
            originId: contractId,
          },
        });

        await (tx as any).payableInstallment.create({
          data: {
            payableId: payable.id,
            number: 1,
            amount: row.totalPayment.toDecimal(),
            dueDate: row.dueDate,
          },
        });

        await (tx as any).ruralCreditInstallment.create({
          data: {
            contractId,
            payableId: payable.id,
            installmentNumber: row.installmentNumber,
            principal: row.principal.toDecimal(),
            interest: row.interest.toDecimal(),
            outstandingBalanceAfter: row.outstandingBalance.toDecimal(),
          },
        });
      }
    }

    return (tx as any).ruralCreditContract.findUnique({
      where: { id: contractId },
      include: CONTRACT_INCLUDE,
    });
  });

  return toContractOutput(contract);
}

// ─── getAlertCount ────────────────────────────────────────────────────

export async function getAlertCount(ctx: RlsContext): Promise<{ count: number }> {
  const now = new Date();

  const count = await withRlsContext(ctx, async (tx) => {
    // Find ATIVO contracts that have at least one PENDING payable due within alertDaysBefore days
    const contracts = await (tx as any).ruralCreditContract.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'ATIVO',
      },
      select: {
        id: true,
        alertDaysBefore: true,
        installments: {
          where: {
            payable: { status: 'PENDING' },
          },
          select: {
            payable: { select: { dueDate: true } },
          },
        },
      },
    });

    let alertCount = 0;
    for (const contract of contracts) {
      const alertThreshold = new Date(now);
      alertThreshold.setDate(alertThreshold.getDate() + (contract.alertDaysBefore as number));

      const hasAlertInstallment = (contract.installments as any[]).some((inst: any) => {
        const dueDate = inst.payable?.dueDate;
        if (!dueDate) return false;
        return new Date(dueDate) <= alertThreshold;
      });

      if (hasAlertInstallment) alertCount++;
    }

    return alertCount;
  });

  return { count };
}
