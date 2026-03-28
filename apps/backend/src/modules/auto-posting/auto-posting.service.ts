// ─── Auto-Posting Service ────────────────────────────────────────────────────
// Engine that converts domain events into GL journal entries automatically.
// Called by module hooks after significant financial events.
//
// Key decisions (per RESEARCH):
// - D-17: Idempotency via UNIQUE(sourceType, sourceId) on both JournalEntry and PendingJournalPosting
// - D-18: No active rule → silent return (no PendingJournalPosting created)
// - D-25: Closed period → PendingJournalPosting ERROR "Periodo contabil fechado"
// - D-26: process() is the single entry point called by all module hooks
// - D-28: DataExtractor pattern allows each sourceType to fetch its own data
// - D-02/D-13: seedAccountingRules() creates default rules from COA codes

import { prisma } from '../../database/prisma';
import type {
  AutoPostingSourceType,
  AccountingRule,
  AccountingRuleLine,
  ChartOfAccount,
  PendingJournalPosting,
} from '@prisma/client';
import type {
  UpdateRuleInput,
  AccountingRuleOutput,
  PendingPostingOutput,
  PendingPostingFilters,
  ExtractedData,
  DataExtractor,
  PreviewOutput,
  PendingCountsOutput,
  RetryBatchOutput,
} from './auto-posting.types';

// ─── Error class ──────────────────────────────────────────────────────

export class AutoPostingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'AutoPostingError';
  }
}

// ─── Template interpolation ───────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

// ─── Selects ──────────────────────────────────────────────────────────

const RULE_LINE_SELECT = {
  id: true,
  lineOrder: true,
  side: true,
  accountId: true,
  description: true,
  account: { select: { code: true, name: true } },
} as const;

const RULE_SELECT = {
  id: true,
  sourceType: true,
  isActive: true,
  historyTemplate: true,
  requireCostCenter: true,
  lines: {
    select: RULE_LINE_SELECT,
    orderBy: { lineOrder: 'asc' as const },
  },
} as const;

// ─── Format helpers ───────────────────────────────────────────────────

type RuleRow = {
  id: string;
  sourceType: AutoPostingSourceType;
  isActive: boolean;
  historyTemplate: string;
  requireCostCenter: boolean;
  lines: Array<{
    id: string;
    lineOrder: number;
    side: string;
    accountId: string;
    description: string | null;
    account: { code: string; name: string };
  }>;
};

function formatRule(rule: RuleRow): AccountingRuleOutput {
  return {
    id: rule.id,
    sourceType: rule.sourceType,
    isActive: rule.isActive,
    historyTemplate: rule.historyTemplate,
    requireCostCenter: rule.requireCostCenter,
    lines: rule.lines.map((l) => ({
      id: l.id,
      lineOrder: l.lineOrder,
      side: l.side as 'DEBIT' | 'CREDIT',
      accountId: l.accountId,
      accountCode: l.account.code,
      accountName: l.account.name,
      description: l.description,
    })),
  };
}

function formatPending(p: {
  id: string;
  sourceType: AutoPostingSourceType;
  sourceId: string;
  status: string;
  accountingRuleId: string | null;
  journalEntryId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
}): PendingPostingOutput {
  return {
    id: p.id,
    sourceType: p.sourceType,
    sourceId: p.sourceId,
    status: p.status as PendingPostingOutput['status'],
    accountingRuleId: p.accountingRuleId,
    journalEntryId: p.journalEntryId,
    errorMessage: p.errorMessage,
    createdAt: p.createdAt.toISOString(),
    processedAt: p.processedAt ? p.processedAt.toISOString() : null,
  };
}

// ─── Data Extractors ──────────────────────────────────────────────────
// Each extractor fetches source data and returns normalized ExtractedData.
// amounts[i].lineOrder maps to rule.lines[i].lineOrder.

async function extractPayrollRunClose(
  sourceId: string,
  _organizationId: string,
): Promise<ExtractedData> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: sourceId },
    select: {
      referenceMonth: true,
      totalGross: true,
      totalCharges: true,
      organization: { select: { name: true } },
    },
  });
  if (!run) throw new AutoPostingError(`PayrollRun ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  const grossSalary = run.totalGross?.toString() ?? '0';
  const charges = run.totalCharges?.toString() ?? '0';
  const referenceMonth = run.referenceMonth.toISOString().slice(0, 7);
  const orgName = run.organization.name;

  return {
    entryDate: run.referenceMonth,
    description: `Fechamento de folha ${referenceMonth}`,
    templateVars: { referenceMonth, organizationName: orgName },
    // amounts aligned to rule lines by lineOrder:
    // lineOrder 1 = salarios (debit expense / credit payable)
    // lineOrder 2 = encargos (debit expense / credit charges payable)
    amounts: [
      { lineOrder: 1, amount: grossSalary },
      { lineOrder: 2, amount: charges },
    ],
  };
}

async function extractPayableSettlement(
  sourceId: string,
  _organizationId: string,
): Promise<ExtractedData> {
  const payable = await prisma.payable.findFirst({
    where: { id: sourceId },
    select: {
      amountPaid: true,
      totalAmount: true,
      supplierName: true,
      documentNumber: true,
      description: true,
      dueDate: true,
      paidAt: true,
    },
  });
  if (!payable) throw new AutoPostingError(`Payable ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  const amount = (payable.amountPaid ?? payable.totalAmount).toString();
  const entryDate = payable.paidAt ?? payable.dueDate;

  return {
    entryDate,
    description: `Liquidacao CP: ${payable.supplierName} - ${payable.description}`,
    templateVars: {
      supplierName: payable.supplierName,
      documentNumber: payable.documentNumber ?? '',
      description: payable.description,
    },
    amounts: [{ lineOrder: 1, amount }],
  };
}

async function extractReceivableSettlement(
  sourceId: string,
  _organizationId: string,
): Promise<ExtractedData> {
  const receivable = await prisma.receivable.findFirst({
    where: { id: sourceId },
    select: {
      amountReceived: true,
      originalAmount: true,
      description: true,
      documentNumber: true,
      receivedAt: true,
      dueDate: true,
    },
  });
  if (!receivable)
    throw new AutoPostingError(`Receivable ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  const amount = (receivable.amountReceived ?? receivable.originalAmount).toString();
  const entryDate = receivable.receivedAt ?? receivable.dueDate;

  return {
    entryDate,
    description: `Recebimento CR: ${receivable.description}`,
    templateVars: {
      documentNumber: receivable.documentNumber ?? '',
      description: receivable.description,
    },
    amounts: [{ lineOrder: 1, amount }],
  };
}

async function extractDepreciationRun(
  sourceId: string,
  _organizationId: string,
): Promise<ExtractedData> {
  const run = await prisma.depreciationRun.findFirst({
    where: { id: sourceId },
    select: {
      periodYear: true,
      periodMonth: true,
      totalAmount: true,
    },
  });
  if (!run)
    throw new AutoPostingError(`DepreciationRun ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  const periodYear = String(run.periodYear);
  const periodMonth = String(run.periodMonth).padStart(2, '0');
  const entryDate = new Date(`${periodYear}-${periodMonth}-01`);

  return {
    entryDate,
    description: `Depreciacao mensal ${periodMonth}/${periodYear}`,
    templateVars: { periodYear, periodMonth },
    amounts: [{ lineOrder: 1, amount: run.totalAmount.toString() }],
  };
}

async function extractStockEntry(
  sourceId: string,
  _organizationId: string,
): Promise<ExtractedData> {
  const entry = await prisma.stockEntry.findFirst({
    where: { id: sourceId },
    select: {
      entryDate: true,
      totalCost: true,
      supplierName: true,
      invoiceNumber: true,
    },
  });
  if (!entry) throw new AutoPostingError(`StockEntry ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  return {
    entryDate: entry.entryDate,
    description: `Entrada estoque: ${entry.supplierName ?? 'Fornecedor nao informado'}`,
    templateVars: {
      supplierName: entry.supplierName ?? '',
      documentNumber: entry.invoiceNumber ?? '',
      referenceDate: entry.entryDate.toISOString().slice(0, 10),
    },
    amounts: [{ lineOrder: 1, amount: entry.totalCost.toString() }],
  };
}

async function extractStockOutput(
  sourceId: string,
  _organizationId: string,
  label: string,
): Promise<ExtractedData> {
  const output = await prisma.stockOutput.findFirst({
    where: { id: sourceId },
    select: {
      outputDate: true,
      totalCost: true,
      type: true,
      items: { select: { id: true } },
    },
  });
  if (!output)
    throw new AutoPostingError(`StockOutput ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  return {
    entryDate: output.outputDate,
    description: `Saida estoque - ${label}`,
    templateVars: {
      outputType: output.type,
      referenceDate: output.outputDate.toISOString().slice(0, 10),
      productCount: String(output.items.length),
    },
    amounts: [{ lineOrder: 1, amount: output.totalCost.toString() }],
  };
}

async function extractPayrollProvision(
  sourceId: string,
  _organizationId: string,
  label: string,
): Promise<ExtractedData> {
  const provision = await prisma.payrollProvision.findFirst({
    where: { id: sourceId },
    select: {
      referenceMonth: true,
      totalAmount: true,
      provisionType: true,
    },
  });
  if (!provision)
    throw new AutoPostingError(`PayrollProvision ${sourceId} nao encontrado`, 'NOT_FOUND', 404);

  const referenceMonth = provision.referenceMonth.toISOString().slice(0, 7);

  return {
    entryDate: provision.referenceMonth,
    description: `Provisao ${label} ${referenceMonth}`,
    templateVars: { referenceMonth, provisionType: provision.provisionType },
    amounts: [{ lineOrder: 1, amount: provision.totalAmount.toString() }],
  };
}

// ─── Extractors map ───────────────────────────────────────────────────

export const EXTRACTORS: Record<AutoPostingSourceType, DataExtractor> = {
  PAYROLL_RUN_CLOSE: (id, orgId) => extractPayrollRunClose(id, orgId),
  PAYROLL_PROVISION_VACATION: (id, orgId) => extractPayrollProvision(id, orgId, 'Ferias'),
  PAYROLL_PROVISION_THIRTEENTH: (id, orgId) => extractPayrollProvision(id, orgId, '13o Salario'),
  PAYABLE_SETTLEMENT: (id, orgId) => extractPayableSettlement(id, orgId),
  RECEIVABLE_SETTLEMENT: (id, orgId) => extractReceivableSettlement(id, orgId),
  DEPRECIATION_RUN: (id, orgId) => extractDepreciationRun(id, orgId),
  STOCK_ENTRY: (id, orgId) => extractStockEntry(id, orgId),
  STOCK_OUTPUT_CONSUMPTION: (id, orgId) => extractStockOutput(id, orgId, 'Consumo'),
  STOCK_OUTPUT_TRANSFER: (id, orgId) => extractStockOutput(id, orgId, 'Transferencia'),
  STOCK_OUTPUT_DISPOSAL: (id, orgId) => extractStockOutput(id, orgId, 'Descarte'),
  PAYABLE_REVERSAL: (id, orgId) => extractPayableSettlement(id, orgId),
  RECEIVABLE_REVERSAL: (id, orgId) => extractReceivableSettlement(id, orgId),
};

// ─── Core posting logic (shared with journal-entries service) ─────────

type RuleWithLines = AccountingRule & {
  lines: Array<AccountingRuleLine & { account: ChartOfAccount }>;
};

async function _executePosting(
  pending: PendingJournalPosting,
  rule: RuleWithLines,
  organizationId: string,
): Promise<void> {
  try {
    // 1. Extract source data
    const extractor = EXTRACTORS[pending.sourceType];
    const data = await extractor(pending.sourceId, organizationId);

    // 2. Find open accounting period for entry date
    const year = data.entryDate.getFullYear();
    const month = data.entryDate.getMonth() + 1;
    const period = await prisma.accountingPeriod.findFirst({
      where: { organizationId, year, month, status: 'OPEN' },
      select: { id: true, fiscalYearId: true, month: true },
    });

    if (!period) {
      await prisma.pendingJournalPosting.update({
        where: { id: pending.id },
        data: {
          status: 'ERROR',
          errorMessage: `Periodo contabil fechado para ${month}/${year}`,
          updatedAt: new Date(),
        },
      });
      return;
    }

    // 3. Interpolate description
    const description = interpolate(rule.historyTemplate, data.templateVars);

    // 4. Infer costCenterId from farmId if present
    let costCenterId: string | null = null;
    if (data.farmId) {
      const cc = await prisma.costCenter.findFirst({
        where: { organizationId, farmId: data.farmId },
        select: { id: true },
      });
      if (!cc && rule.requireCostCenter) {
        await prisma.pendingJournalPosting.update({
          where: { id: pending.id },
          data: {
            status: 'ERROR',
            errorMessage: 'Centro de custo obrigatorio nao encontrado para a fazenda',
            updatedAt: new Date(),
          },
        });
        return;
      }
      costCenterId = cc?.id ?? null;
    }

    // 5. Post journal entry atomically
    await prisma.$transaction(
      async (tx) => {
        // Assign sequential entry number
        const agg = await tx.journalEntry.aggregate({
          where: { organizationId, status: { in: ['POSTED', 'REVERSED'] } },
          _max: { entryNumber: true },
        });
        const nextNumber = (agg._max.entryNumber ?? 0) + 1;

        // Build line amounts: map rule lines to amounts by lineOrder
        const amountMap = new Map(data.amounts.map((a) => [a.lineOrder, a.amount]));

        const journalEntry = await tx.journalEntry.create({
          data: {
            organizationId,
            entryNumber: nextNumber,
            entryDate: data.entryDate,
            periodId: period.id,
            description,
            entryType: 'AUTOMATIC' as const,
            status: 'POSTED' as const,
            sourceType: pending.sourceType,
            sourceId: pending.sourceId,
            costCenterId,
            createdBy: 'system',
            postedAt: new Date(),
            lines: {
              create: rule.lines.map((rl) => {
                const amount = amountMap.get(rl.lineOrder) ?? data.amounts[0]?.amount ?? '0';
                return {
                  accountId: rl.accountId,
                  side: rl.side,
                  amount,
                  description: rl.description
                    ? interpolate(rl.description, data.templateVars)
                    : null,
                  lineOrder: rl.lineOrder,
                  costCenterId,
                };
              }),
            },
          },
          select: { id: true, lines: { select: { accountId: true, side: true, amount: true } } },
        });

        // Update AccountBalance for each line
        for (const line of journalEntry.lines) {
          await tx.accountBalance.upsert({
            where: {
              organizationId_accountId_fiscalYearId_month: {
                organizationId,
                accountId: line.accountId,
                fiscalYearId: period.fiscalYearId,
                month: period.month,
              },
            },
            create: {
              organizationId,
              accountId: line.accountId,
              fiscalYearId: period.fiscalYearId,
              month: period.month,
              openingBalance: 0,
              debitTotal: line.side === 'DEBIT' ? line.amount : 0,
              creditTotal: line.side === 'CREDIT' ? line.amount : 0,
              closingBalance: 0,
            },
            update: {
              debitTotal: line.side === 'DEBIT' ? { increment: line.amount } : undefined,
              creditTotal: line.side === 'CREDIT' ? { increment: line.amount } : undefined,
            },
          });
        }

        // Recompute closingBalance for affected accounts
        const accountIds = [...new Set(journalEntry.lines.map((l) => l.accountId))];
        await tx.$executeRaw`
          UPDATE account_balances ab
          SET "closingBalance" = ab."openingBalance" +
            CASE WHEN coa.nature = 'DEVEDORA' THEN ab."debitTotal" - ab."creditTotal"
                 ELSE ab."creditTotal" - ab."debitTotal" END
          FROM chart_of_accounts coa
          WHERE coa.id = ab."accountId"
            AND ab."organizationId" = ${organizationId}
            AND ab."fiscalYearId" = ${period.fiscalYearId}
            AND ab.month = ${period.month}
            AND ab."accountId" = ANY(${accountIds}::text[])
        `;

        // Update pending posting to COMPLETED
        await tx.pendingJournalPosting.update({
          where: { id: pending.id },
          data: {
            status: 'COMPLETED',
            journalEntryId: journalEntry.id,
            processedAt: new Date(),
            errorMessage: null,
            updatedAt: new Date(),
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    await prisma.pendingJournalPosting.update({
      where: { id: pending.id },
      data: {
        status: 'ERROR',
        errorMessage: message.slice(0, 1000),
        updatedAt: new Date(),
      },
    });
  }
}

// ─── process() ───────────────────────────────────────────────────────
// Main entry point called by module hooks (per D-26).

export async function process(
  sourceType: AutoPostingSourceType,
  sourceId: string,
  organizationId: string,
): Promise<void> {
  // D-17: Idempotency — if already COMPLETED, return silently
  const existing = await prisma.pendingJournalPosting.findFirst({
    where: { sourceType, sourceId, status: 'COMPLETED' },
    select: { id: true },
  });
  if (existing) return;

  // D-18: If no active rule, return without creating PendingJournalPosting
  const rule = await prisma.accountingRule.findFirst({
    where: { organizationId, sourceType, isActive: true },
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: 'asc' as const },
      },
    },
  });
  if (!rule) return;

  // Upsert PendingJournalPosting (handles re-calls gracefully)
  const pending = await prisma.pendingJournalPosting.upsert({
    where: { sourceType_sourceId: { sourceType, sourceId } },
    create: {
      organizationId,
      sourceType,
      sourceId,
      accountingRuleId: rule.id,
      status: 'PROCESSING',
    },
    update: {
      status: 'PROCESSING',
      accountingRuleId: rule.id,
      errorMessage: null,
      updatedAt: new Date(),
    },
  });

  await _executePosting(pending, rule, organizationId);
}

// ─── retry() ─────────────────────────────────────────────────────────
// Re-attempts a single ERROR posting (per D-16).

export async function retry(
  pendingId: string,
  organizationId: string,
): Promise<PendingPostingOutput> {
  const pending = await prisma.pendingJournalPosting.findFirst({
    where: { id: pendingId, organizationId },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      status: true,
      accountingRuleId: true,
      journalEntryId: true,
      errorMessage: true,
      createdAt: true,
      processedAt: true,
    },
  });

  if (!pending) {
    throw new AutoPostingError('Lancamento pendente nao encontrado', 'NOT_FOUND', 404);
  }
  if (pending.status !== 'ERROR') {
    throw new AutoPostingError(
      `Apenas lancamentos com status ERROR podem ser reprocessados. Status atual: ${pending.status}`,
      'INVALID_STATUS',
      422,
    );
  }

  const rule = await prisma.accountingRule.findFirst({
    where: { organizationId, sourceType: pending.sourceType, isActive: true },
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: 'asc' as const },
      },
    },
  });

  if (!rule) {
    throw new AutoPostingError(
      `Nenhuma regra ativa encontrada para ${pending.sourceType}`,
      'NO_ACTIVE_RULE',
      422,
    );
  }

  // Reset to PENDING, then execute
  const updated = await prisma.pendingJournalPosting.update({
    where: { id: pendingId },
    data: { status: 'PROCESSING', errorMessage: null, updatedAt: new Date() },
  });

  await _executePosting(updated, rule, organizationId);

  const result = await prisma.pendingJournalPosting.findFirst({
    where: { id: pendingId },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      status: true,
      accountingRuleId: true,
      journalEntryId: true,
      errorMessage: true,
      createdAt: true,
      processedAt: true,
    },
  });

  return formatPending(result!);
}

// ─── retryBatch() ─────────────────────────────────────────────────────

export async function retryBatch(
  filters: PendingPostingFilters,
  organizationId: string,
): Promise<RetryBatchOutput> {
  const pendings = await prisma.pendingJournalPosting.findMany({
    where: {
      organizationId,
      status: 'ERROR',
      ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    },
    select: { id: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const { id } of pendings) {
    try {
      await retry(id, organizationId);
      succeeded++;
    } catch {
      failed++;
    }
  }

  return { succeeded, failed };
}

// ─── listPending() ───────────────────────────────────────────────────

export async function listPending(
  organizationId: string,
  filters: PendingPostingFilters = {},
): Promise<PendingPostingOutput[]> {
  const pendings = await prisma.pendingJournalPosting.findMany({
    where: {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      status: true,
      accountingRuleId: true,
      journalEntryId: true,
      errorMessage: true,
      createdAt: true,
      processedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return pendings.map(formatPending);
}

// ─── getPendingCounts() ────────────────────────────────────────────────

export async function getPendingCounts(organizationId: string): Promise<PendingCountsOutput> {
  const groups = await prisma.pendingJournalPosting.groupBy({
    by: ['status'],
    where: { organizationId, status: { in: ['ERROR', 'PENDING'] } },
    _count: true,
  });

  const error = groups.find((g) => g.status === 'ERROR')?._count ?? 0;
  const pending = groups.find((g) => g.status === 'PENDING')?._count ?? 0;
  return { error, pending };
}

// ─── listRules() ──────────────────────────────────────────────────────

export async function listRules(organizationId: string): Promise<AccountingRuleOutput[]> {
  const rules = await prisma.accountingRule.findMany({
    where: { organizationId },
    select: RULE_SELECT,
    orderBy: { sourceType: 'asc' },
  });
  return rules.map(formatRule);
}

// ─── getRule() ────────────────────────────────────────────────────────

export async function getRule(
  organizationId: string,
  ruleId: string,
): Promise<AccountingRuleOutput | null> {
  const rule = await prisma.accountingRule.findFirst({
    where: { id: ruleId, organizationId },
    select: RULE_SELECT,
  });
  if (!rule) return null;
  return formatRule(rule);
}

// ─── updateRule() ─────────────────────────────────────────────────────
// Per D-09 (future only): update isActive, historyTemplate, requireCostCenter, lines.

export async function updateRule(
  organizationId: string,
  ruleId: string,
  input: UpdateRuleInput,
): Promise<AccountingRuleOutput> {
  const rule = await prisma.accountingRule.findFirst({
    where: { id: ruleId, organizationId },
    select: { id: true },
  });
  if (!rule) {
    throw new AutoPostingError('Regra nao encontrada', 'NOT_FOUND', 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountingRule.update({
      where: { id: ruleId },
      data: {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.historyTemplate !== undefined ? { historyTemplate: input.historyTemplate } : {}),
        ...(input.requireCostCenter !== undefined
          ? { requireCostCenter: input.requireCostCenter }
          : {}),
        updatedAt: new Date(),
      },
    });

    if (input.lines !== undefined) {
      // Delete existing lines and recreate
      await tx.accountingRuleLine.deleteMany({ where: { ruleId } });
      if (input.lines.length > 0) {
        await tx.accountingRuleLine.createMany({
          data: input.lines.map((l) => ({
            ruleId,
            lineOrder: l.lineOrder,
            side: l.side,
            accountId: l.accountId,
            description: l.description ?? null,
          })),
        });
      }
    }
  });

  const updated = await prisma.accountingRule.findFirst({
    where: { id: ruleId },
    select: RULE_SELECT,
  });
  return formatRule(updated!);
}

// ─── previewRule() ────────────────────────────────────────────────────
// Per D-03: find last COMPLETED posting for this rule's sourceType,
// use its sourceId to build a preview entry.

export async function previewRule(
  organizationId: string,
  ruleId: string,
): Promise<PreviewOutput | null> {
  const rule = await prisma.accountingRule.findFirst({
    where: { id: ruleId, organizationId },
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineOrder: 'asc' as const },
      },
    },
  });
  if (!rule) return null;

  // Find the most recent COMPLETED posting for this sourceType
  const lastPosting = await prisma.pendingJournalPosting.findFirst({
    where: { organizationId, sourceType: rule.sourceType, status: 'COMPLETED' },
    orderBy: { processedAt: 'desc' },
    select: { sourceId: true },
  });
  if (!lastPosting) return null;

  // Extract data using the same extractor
  const extractor = EXTRACTORS[rule.sourceType];
  let data: ExtractedData;
  try {
    data = await extractor(lastPosting.sourceId, organizationId);
  } catch {
    return null;
  }

  const description = interpolate(rule.historyTemplate, data.templateVars);
  const amountMap = new Map(data.amounts.map((a) => [a.lineOrder, a.amount]));

  // Resolve cost center name
  let costCenterName: string | null = null;
  if (data.farmId) {
    const cc = await prisma.costCenter.findFirst({
      where: { organizationId, farmId: data.farmId },
      select: { name: true },
    });
    costCenterName = cc?.name ?? null;
  }

  return {
    entryDate: data.entryDate.toISOString().slice(0, 10),
    description,
    lines: rule.lines.map((rl) => ({
      lineOrder: rl.lineOrder,
      side: rl.side,
      accountCode: rl.account.code,
      accountName: rl.account.name,
      amount: amountMap.get(rl.lineOrder) ?? data.amounts[0]?.amount ?? '0',
      description: rl.description ? interpolate(rl.description, data.templateVars) : null,
    })),
    costCenterName,
  };
}

// ─── seedAccountingRules() ────────────────────────────────────────────
// Per D-02/D-13: creates default rules for all sourceTypes using COA codes.
// Upserts by (organizationId, sourceType) — safe to call multiple times.

const DEFAULT_RULES: Array<{
  sourceType: AutoPostingSourceType;
  historyTemplate: string;
  requireCostCenter: boolean;
  lines: Array<{
    lineOrder: number;
    side: 'DEBIT' | 'CREDIT';
    codePrefix: string;
    description?: string;
  }>;
}> = [
  {
    sourceType: 'PAYROLL_RUN_CLOSE',
    historyTemplate: 'Folha de pagamento {{referenceMonth}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '6.1.01', description: 'Salarios' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '2.1.01', description: 'Salarios a pagar' },
    ],
  },
  {
    sourceType: 'PAYROLL_PROVISION_VACATION',
    historyTemplate: 'Provisao de ferias {{referenceMonth}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '6.1.03', description: 'Provisao ferias' },
      {
        lineOrder: 2,
        side: 'CREDIT',
        codePrefix: '2.2.01',
        description: 'Provisao ferias a pagar',
      },
    ],
  },
  {
    sourceType: 'PAYROLL_PROVISION_THIRTEENTH',
    historyTemplate: 'Provisao 13o salario {{referenceMonth}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '6.1.04', description: 'Provisao 13o' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '2.2.02', description: 'Provisao 13o a pagar' },
    ],
  },
  {
    sourceType: 'PAYABLE_SETTLEMENT',
    historyTemplate: 'Liquidacao CP {{supplierName}} - Doc {{documentNumber}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '2.1', description: 'Contas a pagar' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.1.01', description: 'Caixa/Bancos' },
    ],
  },
  {
    sourceType: 'RECEIVABLE_SETTLEMENT',
    historyTemplate: 'Recebimento CR {{description}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '1.1.01', description: 'Caixa/Bancos' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.1.02', description: 'Creditos a receber' },
    ],
  },
  {
    sourceType: 'DEPRECIATION_RUN',
    historyTemplate: 'Depreciacao mensal {{periodMonth}}/{{periodYear}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '5.2', description: 'Depreciacao' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.2.03', description: 'Deprec. acum. imob.' },
    ],
  },
  {
    sourceType: 'STOCK_ENTRY',
    historyTemplate: 'Entrada estoque {{supplierName}} - NF {{documentNumber}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '1.1.03', description: 'Estoques' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '2.1', description: 'Contas a pagar' },
    ],
  },
  {
    sourceType: 'STOCK_OUTPUT_CONSUMPTION',
    historyTemplate: 'Saida estoque consumo {{referenceDate}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '5.1', description: 'Custo insumos' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.1.03', description: 'Estoques' },
    ],
  },
  {
    sourceType: 'STOCK_OUTPUT_TRANSFER',
    historyTemplate: 'Transferencia estoque {{referenceDate}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '1.1.03', description: 'Estoque destino' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.1.03', description: 'Estoque origem' },
    ],
  },
  {
    sourceType: 'STOCK_OUTPUT_DISPOSAL',
    historyTemplate: 'Descarte estoque {{referenceDate}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '5.2', description: 'Perda descarte' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.1.03', description: 'Estoques' },
    ],
  },
  {
    sourceType: 'PAYABLE_REVERSAL',
    historyTemplate: 'Estorno CP {{supplierName}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '1.1.01', description: 'Caixa/Bancos' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '2.1', description: 'Contas a pagar' },
    ],
  },
  {
    sourceType: 'RECEIVABLE_REVERSAL',
    historyTemplate: 'Estorno CR {{description}}',
    requireCostCenter: false,
    lines: [
      { lineOrder: 1, side: 'DEBIT', codePrefix: '1.1.02', description: 'Creditos a receber' },
      { lineOrder: 2, side: 'CREDIT', codePrefix: '1.1.01', description: 'Caixa/Bancos' },
    ],
  },
];

export async function seedAccountingRules(organizationId: string): Promise<void> {
  for (const ruleDef of DEFAULT_RULES) {
    // Find or create the rule
    const existing = await prisma.accountingRule.findFirst({
      where: { organizationId, sourceType: ruleDef.sourceType },
      select: { id: true },
    });

    let ruleId: string;
    if (existing) {
      ruleId = existing.id;
    } else {
      const created = await prisma.accountingRule.create({
        data: {
          organizationId,
          sourceType: ruleDef.sourceType,
          historyTemplate: ruleDef.historyTemplate,
          requireCostCenter: ruleDef.requireCostCenter,
          isActive: true,
        },
        select: { id: true },
      });
      ruleId = created.id;
    }

    // Check if rule already has lines — skip if so (idempotent)
    const lineCount = await prisma.accountingRuleLine.count({ where: { ruleId } });
    if (lineCount > 0) continue;

    // Resolve accounts by code prefix
    for (const lineDef of ruleDef.lines) {
      const account = await prisma.chartOfAccount.findFirst({
        where: {
          organizationId,
          code: { startsWith: lineDef.codePrefix },
          isActive: true,
        },
        select: { id: true },
        orderBy: { code: 'asc' },
      });
      if (!account) continue; // COA not seeded yet — skip silently

      await prisma.accountingRuleLine.create({
        data: {
          ruleId,
          lineOrder: lineDef.lineOrder,
          side: lineDef.side,
          accountId: account.id,
          description: lineDef.description ?? null,
        },
      });
    }
  }
}
