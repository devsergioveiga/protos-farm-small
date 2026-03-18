import { withRlsBypass } from '../../database/rls';
import { sendMail } from './mail.service';
import { shouldNotify } from '../../modules/notification-preferences/notification-preferences.service';
import { logger } from '../utils/logger';

function formatDatePtBr(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildDigestHtml(params: {
  userName: string;
  orgName: string;
  date: string;
  pendingRcCount: number;
  overduePoCount: number;
  lateDeliveriesCount: number;
  pendingReturnsCount: number;
}): string {
  const sections: string[] = [];

  if (params.pendingRcCount > 0) {
    sections.push(`
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5;">
          <strong style="color: #2A2520;">Requisições Pendentes</strong>
          <span style="float: right; color: #2E7D32; font-weight: bold;">${params.pendingRcCount}</span>
        </td>
      </tr>
    `);
  }

  if (params.overduePoCount > 0) {
    sections.push(`
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5;">
          <strong style="color: #2A2520;">Ordens de Compra Vencidas</strong>
          <span style="float: right; color: #C62828; font-weight: bold;">${params.overduePoCount}</span>
        </td>
      </tr>
    `);
  }

  if (params.lateDeliveriesCount > 0) {
    sections.push(`
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5;">
          <strong style="color: #2A2520;">Entregas Atrasadas</strong>
          <span style="float: right; color: #C62828; font-weight: bold;">${params.lateDeliveriesCount}</span>
        </td>
      </tr>
    `);
  }

  if (params.pendingReturnsCount > 0) {
    sections.push(`
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E5E5E5;">
          <strong style="color: #2A2520;">Devoluções Pendentes</strong>
          <span style="float: right; color: #3E3833; font-weight: bold;">${params.pendingReturnsCount}</span>
        </td>
      </tr>
    `);
  }

  if (sections.length === 0) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Protos Farm</h1>
        </div>
        <div style="padding: 24px; background: #fff;">
          <h2 style="color: #2A2520;">Resumo de compras — ${params.date}</h2>
          <p style="color: #3E3833;">Nenhum item pendente. Bom trabalho!</p>
        </div>
        <div style="padding: 16px; background: #FAFAF8; text-align: center; font-size: 13px;">
          <a href="/notification-preferences" style="color: #2E7D32;">Gerenciar preferências</a>
        </div>
      </div>
    `;
  }

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Protos Farm</h1>
        <p style="color: #e8f5e9; margin: 4px 0 0; font-size: 14px;">${params.orgName}</p>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #2A2520; margin-top: 0;">Resumo de compras — ${params.date}</h2>
        <p style="color: #3E3833;">Olá, ${params.userName}. Aqui está seu resumo do dia:</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${sections.join('')}
        </table>
      </div>
      <div style="padding: 16px; background: #FAFAF8; text-align: center; font-size: 13px; color: #3E3833;">
        <a href="/notification-preferences" style="color: #2E7D32;">Gerenciar preferências</a>
      </div>
    </div>
  `;
}

export async function sendDigestEmails(): Promise<void> {
  const today = new Date();
  const dateLabel = formatDatePtBr(today);

  // Query all users with role MANAGER or ADMIN in active organizations
  const usersWithOrgs = await withRlsBypass(async (tx) => {
    const users = await tx.user.findMany({
      where: {
        role: { in: ['MANAGER', 'ADMIN'] },
        status: 'ACTIVE',
        organizationId: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
    return users
      .filter((u) => u.organizationId !== null)
      .map((u) => ({
        userId: u.id,
        organizationId: u.organizationId as string,
        user: { name: u.name, email: u.email },
        organization: { name: u.organization?.name ?? '' },
      }));
  });

  let sentCount = 0;
  let skippedCount = 0;

  for (const entry of usersWithOrgs) {
    try {
      // Check if user has digest email enabled
      const shouldSend = await withRlsBypass(async (tx) => {
        return shouldNotify(tx, entry.userId, entry.organizationId, 'DAILY_DIGEST', 'EMAIL');
      });

      if (!shouldSend) {
        skippedCount++;
        continue;
      }

      // Build digest summary for this user+org
      const summary = await withRlsBypass(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orgFilter = { organizationId: entry.organizationId, deletedAt: null as any };

        const [pendingRcCount, overduePoCount, lateGrs, pendingReturnsCount] = await Promise.all([
          tx.purchaseRequest.count({
            where: { ...orgFilter, status: { in: ['PENDENTE', 'DEVOLVIDA'] } },
          }),
          tx.purchaseOrder.count({
            where: {
              ...orgFilter,
              status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'] },
              expectedDeliveryDate: { lt: new Date() },
            },
          }),
          tx.goodsReceipt.findMany({
            where: {
              ...orgFilter,
              status: 'CONFIRMADO',
              purchaseOrder: { expectedDeliveryDate: { not: null } },
            },
            select: {
              confirmedAt: true,
              purchaseOrder: { select: { expectedDeliveryDate: true } },
            },
          }),
          tx.goodsReturn.count({
            where: {
              organizationId: entry.organizationId,
              status: { in: ['PENDENTE', 'EM_ANALISE'] },
            },
          }),
        ]);

        const lateDeliveriesCount = lateGrs.filter(
          (gr: {
            confirmedAt: Date | null;
            purchaseOrder: { expectedDeliveryDate: Date | null } | null;
          }) => {
            const expected = gr.purchaseOrder?.expectedDeliveryDate;
            return gr.confirmedAt && expected && gr.confirmedAt > expected;
          },
        ).length;

        return { pendingRcCount, overduePoCount, lateDeliveriesCount, pendingReturnsCount };
      });

      // Only send if there's something to report
      const hasItems =
        summary.pendingRcCount > 0 ||
        summary.overduePoCount > 0 ||
        summary.lateDeliveriesCount > 0 ||
        summary.pendingReturnsCount > 0;

      if (!hasItems) {
        skippedCount++;
        continue;
      }

      const html = buildDigestHtml({
        userName: entry.user.name ?? 'Usuário',
        orgName: entry.organization.name,
        date: dateLabel,
        ...summary,
      });

      const totalItems =
        summary.pendingRcCount +
        summary.overduePoCount +
        summary.lateDeliveriesCount +
        summary.pendingReturnsCount;

      await sendMail({
        to: entry.user.email,
        subject: `Resumo de compras — ${dateLabel} (${totalItems} itens pendentes)`,
        text: [
          `Resumo de compras — ${dateLabel}`,
          '',
          `Requisições Pendentes: ${summary.pendingRcCount}`,
          `Ordens de Compra Vencidas: ${summary.overduePoCount}`,
          `Entregas Atrasadas: ${summary.lateDeliveriesCount}`,
          `Devoluções Pendentes: ${summary.pendingReturnsCount}`,
        ].join('\n'),
        html,
      });
      sentCount++;
    } catch (err) {
      logger.error(
        { err, userId: entry.userId, organizationId: entry.organizationId },
        'Failed to send digest email for user',
      );
    }
  }

  logger.info({ sentCount, skippedCount }, 'Digest emails completed');
}
