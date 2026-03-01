import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

// ─── Types ──────────────────────────────────────────────────────────

export interface RlsContext {
  organizationId: string;
}

// Prisma transaction client type
type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ─── withRlsContext ─────────────────────────────────────────────────
// Opens a $transaction, sets app.current_org_id via SET LOCAL (scoped
// to the transaction), and runs the callback. All queries inside see
// only rows belonging to the org.

export async function withRlsContext<T>(
  ctx: RlsContext,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.organizationId}, true)`;
    return fn(tx);
  });
}

// ─── withRlsBypass ──────────────────────────────────────────────────
// Opens a $transaction with app.bypass_rls = 'true'. Used by auth,
// admin, audit, and middleware that need cross-tenant access.

export async function withRlsBypass<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'true', true)`;
    return fn(tx);
  });
}
