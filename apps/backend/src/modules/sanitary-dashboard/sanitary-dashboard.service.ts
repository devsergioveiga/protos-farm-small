import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PENDING_TYPE_LABELS,
  type SanitaryDashboardQuery,
  type SanitaryDashboardResponse,
  type SanitaryKpis,
  type PendingAnimalItem,
  type SanitaryCostItem,
  type IncidencePoint,
} from './sanitary-dashboard.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const ANIMAL_CATEGORY_LABELS: Record<string, string> = {
  BULL: 'Touro',
  COW: 'Vaca',
  HEIFER: 'Novilha',
  CALF_MALE: 'Bezerro',
  CALF_FEMALE: 'Bezerra',
  STEER: 'Boi',
  YEARLING_MALE: 'Garrote',
  YEARLING_FEMALE: 'Garota',
};

// ─── Main service ───────────────────────────────────────────────────

export async function getSanitaryDashboard(
  ctx: RlsContext,
  query: SanitaryDashboardQuery,
): Promise<SanitaryDashboardResponse> {
  return withRlsContext(ctx, async (tx) => {
    // Build animal filter
    const animalWhere: any = {
      farm: { organizationId: ctx.organizationId },
      deletedAt: null,
    };
    if (query.farmId) animalWhere.farmId = query.farmId;
    if (query.lotId) animalWhere.lotId = query.lotId;
    if (query.category) animalWhere.category = query.category;

    const animals = await tx.animal.findMany({
      where: animalWhere,
      select: {
        id: true,
        earTag: true,
        name: true,
        category: true,
        lotId: true,
        lot: { select: { name: true } },
        farm: { select: { id: true, name: true } },
      },
    });

    const animalIds = animals.map((a) => a.id);
    const farmIds = [...new Set(animals.map((a) => a.farm.id))];
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // ═══ KPIs ═══════════════════════════════════════════════════

    // CA1: Vaccination coverage — animals with at least one vaccination in last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let vaccinationCoveragePercent = 0;
    if (animalIds.length > 0) {
      const vaccinations = await tx.vaccination.findMany({
        where: {
          animalId: { in: animalIds },
          vaccinationDate: { gte: oneYearAgo },
        },
        select: { animalId: true },
      });
      const uniqueVaccinated = new Set(vaccinations.map((v) => v.animalId));
      vaccinationCoveragePercent = Math.round((uniqueVaccinated.size / animalIds.length) * 100);
    }

    // CA1: Animals in treatment
    const animalsInTreatment =
      animalIds.length > 0
        ? await tx.therapeuticTreatment.count({
            where: {
              animalId: { in: animalIds },
              status: { in: ['OPEN', 'IN_PROGRESS'] },
            },
          })
        : 0;

    // CA1: Animals in withdrawal (have withdrawalEndDate > now)
    const animalsInWithdrawal =
      animalIds.length > 0
        ? await tx.vaccination.count({
            where: {
              animalId: { in: animalIds },
              withdrawalEndDate: { gte: now },
            },
          })
        : 0;

    // CA1: Upcoming campaigns from sanitary protocols
    const upcomingCampaigns = await tx.sanitaryProtocol.count({
      where: {
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    // CA1: Pending exam results
    const pendingExamResults =
      farmIds.length > 0
        ? await tx.animalExam.count({
            where: {
              farmId: { in: farmIds },
              organizationId: ctx.organizationId,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
          })
        : 0;

    // Expired regulatory exams
    const expiredRegulatoryExams =
      farmIds.length > 0
        ? await tx.animalExam.count({
            where: {
              farmId: { in: farmIds },
              organizationId: ctx.organizationId,
              certificateValidity: { lt: now },
              examType: { isRegulatory: true },
              status: 'COMPLETED',
            },
          })
        : 0;

    const kpis: SanitaryKpis = {
      vaccinationCoveragePercent,
      animalsInTreatment,
      animalsInWithdrawal,
      upcomingCampaigns,
      pendingExamResults,
      expiredRegulatoryExams,
    };

    // ═══ CA2: Pending animals list ══════════════════════════════

    const pendingAnimals: PendingAnimalItem[] = [];

    // Animals in treatment
    if (animalIds.length > 0) {
      const treatments = await tx.therapeuticTreatment.findMany({
        where: {
          animalId: { in: animalIds },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        select: {
          animalId: true,
          diseaseName: true,
          animal: {
            select: {
              earTag: true,
              name: true,
              category: true,
              lot: { select: { name: true } },
              farm: { select: { name: true } },
            },
          },
        },
      });

      for (const t of treatments) {
        pendingAnimals.push({
          animalId: t.animalId,
          earTag: t.animal.earTag,
          animalName: t.animal.name,
          farmName: t.animal.farm.name,
          lotName: t.animal.lot?.name ?? null,
          category: t.animal.category,
          pendingType: 'IN_TREATMENT',
          pendingTypeLabel: PENDING_TYPE_LABELS.IN_TREATMENT,
          detail: t.diseaseName,
        });
      }

      // Animals with next dose pending (vaccination)
      const pendingBoosters = await tx.vaccination.findMany({
        where: {
          animalId: { in: animalIds },
          nextDoseDate: { lte: now },
        },
        select: {
          animalId: true,
          productName: true,
          nextDoseDate: true,
          animal: {
            select: {
              earTag: true,
              name: true,
              category: true,
              lot: { select: { name: true } },
              farm: { select: { name: true } },
            },
          },
        },
      });

      for (const v of pendingBoosters) {
        pendingAnimals.push({
          animalId: v.animalId,
          earTag: v.animal.earTag,
          animalName: v.animal.name,
          farmName: v.animal.farm.name,
          lotName: v.animal.lot?.name ?? null,
          category: v.animal.category,
          pendingType: 'PENDING_BOOSTER',
          pendingTypeLabel: PENDING_TYPE_LABELS.PENDING_BOOSTER,
          detail: `${v.productName} — vencido ${v.nextDoseDate ? (v.nextDoseDate as Date).toISOString().slice(0, 10) : ''}`,
        });
      }

      // Animals in withdrawal
      const withdrawalAnimals = await tx.vaccination.findMany({
        where: {
          animalId: { in: animalIds },
          withdrawalEndDate: { gte: now },
        },
        select: {
          animalId: true,
          productName: true,
          withdrawalEndDate: true,
          animal: {
            select: {
              earTag: true,
              name: true,
              category: true,
              lot: { select: { name: true } },
              farm: { select: { name: true } },
            },
          },
        },
      });

      for (const w of withdrawalAnimals) {
        pendingAnimals.push({
          animalId: w.animalId,
          earTag: w.animal.earTag,
          animalName: w.animal.name,
          farmName: w.animal.farm.name,
          lotName: w.animal.lot?.name ?? null,
          category: w.animal.category,
          pendingType: 'IN_WITHDRAWAL',
          pendingTypeLabel: PENDING_TYPE_LABELS.IN_WITHDRAWAL,
          detail: `${w.productName} — até ${w.withdrawalEndDate ? (w.withdrawalEndDate as Date).toISOString().slice(0, 10) : ''}`,
        });
      }
    }

    // ═══ CA3: Costs ═════════════════════════════════════════════

    const costsByCategory: SanitaryCostItem[] = [];
    const costsByLot: SanitaryCostItem[] = [];

    if (animalIds.length > 0) {
      // Costs from therapeutic treatments
      const treatmentCosts = await tx.therapeuticTreatment.findMany({
        where: { animalId: { in: animalIds } },
        select: {
          totalCostCents: true,
          animal: {
            select: {
              category: true,
              lotId: true,
              lot: { select: { name: true } },
            },
          },
        },
      });

      // Aggregate by category
      const catMap = new Map<string, number>();
      const lotMap = new Map<string, { name: string; cost: number }>();

      for (const t of treatmentCosts) {
        const cat = t.animal.category;
        catMap.set(cat, (catMap.get(cat) ?? 0) + t.totalCostCents);

        if (t.animal.lotId && t.animal.lot) {
          const entry = lotMap.get(t.animal.lotId) ?? { name: t.animal.lot.name, cost: 0 };
          entry.cost += t.totalCostCents;
          lotMap.set(t.animal.lotId, entry);
        }
      }

      for (const [cat, cost] of catMap.entries()) {
        costsByCategory.push({
          groupKey: cat,
          groupLabel: ANIMAL_CATEGORY_LABELS[cat] ?? cat,
          totalCostCents: cost,
        });
      }
      costsByCategory.sort((a, b) => b.totalCostCents - a.totalCostCents);

      for (const [lotId, entry] of lotMap.entries()) {
        costsByLot.push({
          groupKey: lotId,
          groupLabel: entry.name,
          totalCostCents: entry.cost,
        });
      }
      costsByLot.sort((a, b) => b.totalCostCents - a.totalCostCents);
    }

    // ═══ CA4: Incidence charts ══════════════════════════════════

    const diseaseIncidence: IncidencePoint[] = [];
    const treatmentIncidence: IncidencePoint[] = [];

    if (animalIds.length > 0) {
      // Disease incidence — from therapeutic treatments
      const recentTreatments = await tx.therapeuticTreatment.findMany({
        where: {
          animalId: { in: animalIds },
          diagnosisDate: { gte: sixMonthsAgo },
        },
        select: {
          diseaseName: true,
          diagnosisDate: true,
        },
        orderBy: { diagnosisDate: 'asc' },
      });

      const diseaseMap = new Map<string, number>();
      for (const t of recentTreatments) {
        const key = `${monthKey(t.diagnosisDate as Date)}|${t.diseaseName}`;
        diseaseMap.set(key, (diseaseMap.get(key) ?? 0) + 1);
      }

      for (const [key, count] of diseaseMap.entries()) {
        const [month, diseaseName] = key.split('|');
        diseaseIncidence.push({ month, diseaseName, count });
      }

      // Treatment incidence — vaccinations + dewormings per month
      const recentVaccinations = await tx.vaccination.findMany({
        where: {
          animalId: { in: animalIds },
          vaccinationDate: { gte: sixMonthsAgo },
        },
        select: {
          productName: true,
          vaccinationDate: true,
        },
      });

      const treatMap = new Map<string, number>();
      for (const v of recentVaccinations) {
        const key = `${monthKey(v.vaccinationDate as Date)}|Vacinação`;
        treatMap.set(key, (treatMap.get(key) ?? 0) + 1);
      }

      const recentDewormings = await tx.deworming.findMany({
        where: {
          animalId: { in: animalIds },
          dewormingDate: { gte: sixMonthsAgo },
        },
        select: {
          dewormingDate: true,
        },
      });

      for (const d of recentDewormings) {
        const key = `${monthKey(d.dewormingDate as Date)}|Vermifugação`;
        treatMap.set(key, (treatMap.get(key) ?? 0) + 1);
      }

      for (const [key, count] of treatMap.entries()) {
        const [month, diseaseName] = key.split('|');
        treatmentIncidence.push({ month, diseaseName, count });
      }
    }

    return {
      kpis,
      pendingAnimals,
      costsByCategory,
      costsByLot,
      diseaseIncidence,
      treatmentIncidence,
    };
  });
}

// ─── CSV export (CA6) ───────────────────────────────────────────────

export async function exportSanitaryReportCsv(
  ctx: RlsContext,
  query: SanitaryDashboardQuery,
): Promise<string> {
  const data = await getSanitaryDashboard(ctx, query);

  const lines: string[] = [];

  // KPIs section
  lines.push('INDICADORES SANITÁRIOS');
  lines.push(`"Cobertura vacinal";"${data.kpis.vaccinationCoveragePercent}%"`);
  lines.push(`"Animais em tratamento";"${data.kpis.animalsInTreatment}"`);
  lines.push(`"Animais em carência";"${data.kpis.animalsInWithdrawal}"`);
  lines.push(`"Campanhas ativas";"${data.kpis.upcomingCampaigns}"`);
  lines.push(`"Exames pendentes";"${data.kpis.pendingExamResults}"`);
  lines.push(`"Regulatórios vencidos";"${data.kpis.expiredRegulatoryExams}"`);
  lines.push('');

  // Pending animals
  lines.push('ANIMAIS COM PENDÊNCIAS');
  lines.push('"Brinco";"Animal";"Fazenda";"Lote";"Tipo";"Detalhe"');
  for (const p of data.pendingAnimals) {
    lines.push(
      [p.earTag, p.animalName ?? '', p.farmName, p.lotName ?? '', p.pendingTypeLabel, p.detail]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    );
  }
  lines.push('');

  // Costs
  lines.push('CUSTOS POR CATEGORIA');
  lines.push('"Categoria";"Custo (R$)"');
  for (const c of data.costsByCategory) {
    lines.push(`"${c.groupLabel}";"${(c.totalCostCents / 100).toFixed(2)}"`);
  }

  return '\uFEFF' + lines.join('\n');
}
