import { Money, generateInstallments } from '@protos-farm/shared';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import { parseNfeXml, calculateRateio } from './nfe-parser';
import {
  AssetAcquisitionError,
  type CreateAssetAcquisitionInput,
  type CreateFromNfeInput,
  type NfeParsedData,
  type AssetAcquisitionOutput,
  type NfeAcquisitionOutput,
} from './asset-acquisitions.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ────────────────────────────────────────────────────────

async function getNextAssetTag(tx: TxClient, organizationId: string): Promise<string> {
  const last = await tx.asset.findFirst({
    where: { organizationId, assetTag: { startsWith: 'PAT-' } },
    orderBy: { assetTag: 'desc' },
    select: { assetTag: true },
  });

  let lastNum = 0;
  if (last?.assetTag) {
    const num = parseInt(last.assetTag.replace('PAT-', ''), 10);
    if (!isNaN(num)) lastNum = num;
  }

  return `PAT-${String(lastNum + 1).padStart(5, '0')}`;
}

// ─── Create Acquisition + Payable ────────────────────────────────────

/**
 * Atomically creates an Asset and (when acquisitionValue > 0) a Payable + installments.
 * For AVISTA: 1 installment at dueDate.
 * For FINANCIADO: N installments starting at firstDueDate, monthly.
 *
 * CRITICAL: Uses tx.payable.create directly (NOT payables.service.createPayable) to avoid
 * nested withRlsContext transactions causing deadlocks.
 */
export async function createAcquisitionAndPayable(
  ctx: RlsContext,
  input: CreateAssetAcquisitionInput,
): Promise<AssetAcquisitionOutput> {
  const acquisitionValue = input.acquisitionValue ?? 0;

  // Validate: supplier required when value > 0
  if (acquisitionValue > 0 && !input.supplierId) {
    throw new AssetAcquisitionError('Fornecedor obrigatório para aquisição com valor', 400);
  }

  // Validate: dueDate required for AVISTA
  if (acquisitionValue > 0 && input.paymentType === 'AVISTA' && !input.dueDate) {
    throw new AssetAcquisitionError('Data de vencimento obrigatória para pagamento à vista', 400);
  }

  // Validate: installmentCount + firstDueDate required for FINANCIADO
  if (input.paymentType === 'FINANCIADO') {
    if (!input.installmentCount || input.installmentCount < 2) {
      throw new AssetAcquisitionError(
        'Número de parcelas deve ser pelo menos 2 para financiamento',
        400,
      );
    }
    if (!input.firstDueDate) {
      throw new AssetAcquisitionError(
        'Data do primeiro vencimento obrigatória para financiamento',
        400,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);

    // Force TERRA to NON_DEPRECIABLE_CPC27
    const classification =
      input.assetType === 'TERRA' ? 'NON_DEPRECIABLE_CPC27' : input.classification;

    // Create Asset
    const asset = await tx.asset.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        assetType: input.assetType as never,
        classification: classification as never,
        name: input.name,
        description: input.description,
        assetTag,
        acquisitionDate: input.acquisitionDate ? new Date(input.acquisitionDate) : undefined,
        acquisitionValue: acquisitionValue > 0 ? String(acquisitionValue) : undefined,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        costCenterId: input.costCenterId,
        costCenterMode: input.costCenterMode ?? 'FIXED',
        costCenterPercent:
          input.costCenterPercent != null ? String(input.costCenterPercent) : undefined,
        serialNumber: input.serialNumber,
        manufacturer: input.manufacturer,
        model: input.model,
        yearOfManufacture: input.yearOfManufacture,
        engineHp: input.engineHp != null ? String(input.engineHp) : undefined,
        fuelType: input.fuelType,
        renavamCode: input.renavamCode,
        licensePlate: input.licensePlate,
        parentAssetId: input.parentAssetId,
        constructionMaterial: input.constructionMaterial,
        areaM2: input.areaM2 != null ? String(input.areaM2) : undefined,
        capacity: input.capacity,
        registrationNumber: input.registrationNumber,
        areaHa: input.areaHa != null ? String(input.areaHa) : undefined,
        carCode: input.carCode,
        currentHourmeter:
          input.currentHourmeter != null ? String(input.currentHourmeter) : undefined,
        currentOdometer:
          input.currentOdometer != null ? String(input.currentOdometer) : undefined,
        photoUrls: [],
        notes: input.notes,
      },
      select: { id: true, assetTag: true, name: true },
    });

    // Skip CP creation if no acquisition value or no payment date
    if (acquisitionValue <= 0 || (!input.dueDate && !input.firstDueDate)) {
      return { asset, payableId: null, installmentCount: 0 };
    }

    // Resolve supplier name
    let supplierName = input.supplierName ?? '';
    if (input.supplierId && !supplierName) {
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
        select: { name: true },
      });
      supplierName = supplier?.name ?? '';
    }

    // Determine installment parameters
    const installmentCount =
      input.paymentType === 'AVISTA' ? 1 : (input.installmentCount ?? 1);
    const firstDueDate = new Date(
      input.paymentType === 'AVISTA' ? input.dueDate! : input.firstDueDate!,
    );

    // Generate installments using shared utility
    const installments = generateInstallments(
      Money(acquisitionValue),
      installmentCount,
      firstDueDate,
    );

    // Create Payable (directly via tx — NOT via payables.service to avoid nested RLS transactions)
    const payable = await tx.payable.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        supplierName,
        category: 'ASSET_ACQUISITION',
        description: `Aquisição ${asset.assetTag} — ${asset.name}`,
        totalAmount: Money(acquisitionValue).toDecimal(),
        dueDate: installments[0].dueDate,
        documentNumber: input.invoiceNumber ?? null,
        installmentCount,
        originType: 'ASSET_ACQUISITION',
        originId: asset.id,
      },
      select: { id: true },
    });

    // Create PayableInstallments
    await tx.payableInstallment.createMany({
      data: installments.map((inst) => ({
        payableId: payable.id,
        number: inst.number,
        amount: inst.amount.toDecimal(),
        dueDate: inst.dueDate,
      })),
    });

    // Create PayableCostCenterItem if costCenterId provided
    if (input.costCenterId) {
      await tx.payableCostCenterItem.create({
        data: {
          payableId: payable.id,
          costCenterId: input.costCenterId,
          farmId: input.farmId,
          allocMode: 'PERCENTAGE',
          percentage: 100,
        },
      });
    }

    return { asset, payableId: payable.id, installmentCount };
  });
}

// ─── Parse NF-e Upload ───────────────────────────────────────────────

/**
 * Parses an NF-e XML buffer and returns structured NfeParsedData.
 * Throws 400 if no items found in the XML.
 */
export async function parseNfeUpload(buffer: Buffer): Promise<NfeParsedData> {
  const xmlString = buffer.toString('utf-8');
  const parsed = parseNfeXml(xmlString);

  if (parsed.items.length === 0) {
    throw new AssetAcquisitionError('Nenhum item encontrado no XML da NF-e', 400);
  }

  return parsed;
}

// ─── Create From NF-e ────────────────────────────────────────────────

/**
 * Creates multiple assets from NF-e items with proportional rateio of accessory expenses.
 * Creates a single Payable for the total NF amount.
 */
export async function createFromNfe(
  ctx: RlsContext,
  input: CreateFromNfeInput,
): Promise<NfeAcquisitionOutput> {
  const { nfeParsed, items: itemAssignments } = input;

  if (itemAssignments.length === 0) {
    throw new AssetAcquisitionError('Nenhum item de ativo fornecido', 400);
  }

  const totalNf = nfeParsed.totalNf ? parseFloat(nfeParsed.totalNf) : 0;
  const freight = nfeParsed.freight ? parseFloat(nfeParsed.freight) : 0;
  const insurance = nfeParsed.insurance ? parseFloat(nfeParsed.insurance) : 0;
  const otherCosts = nfeParsed.otherCosts ? parseFloat(nfeParsed.otherCosts) : 0;

  // Map assignments to NfeItems for rateio
  const itemsForRateio = itemAssignments.map((assignment) => {
    const nfeItem = nfeParsed.items[assignment.nfeItemIndex];
    if (!nfeItem) {
      throw new AssetAcquisitionError(
        `Item NF-e índice ${assignment.nfeItemIndex} não encontrado`,
        400,
      );
    }
    return nfeItem;
  });

  // Calculate rateio — proportional allocation of accessory expenses
  const acquisitionValues = calculateRateio(itemsForRateio, freight, insurance, otherCosts);

  // Validate: for AVISTA
  if (totalNf > 0 && input.paymentType === 'AVISTA' && !input.dueDate) {
    throw new AssetAcquisitionError('Data de vencimento obrigatória para pagamento à vista', 400);
  }

  // Validate: for FINANCIADO
  if (input.paymentType === 'FINANCIADO') {
    if (!input.installmentCount || input.installmentCount < 2) {
      throw new AssetAcquisitionError(
        'Número de parcelas deve ser pelo menos 2 para financiamento',
        400,
      );
    }
    if (!input.firstDueDate) {
      throw new AssetAcquisitionError(
        'Data do primeiro vencimento obrigatória para financiamento',
        400,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const createdAssets: NfeAcquisitionOutput['assets'] = [];

    // Create all assets
    for (let i = 0; i < itemAssignments.length; i++) {
      const assignment = itemAssignments[i];
      const acqValue = acquisitionValues[i];

      if (assignment.existingAssetId) {
        // Update existing asset with rateio value
        const updated = await tx.asset.update({
          where: { id: assignment.existingAssetId },
          data: { acquisitionValue: String(acqValue) },
          select: { id: true, assetTag: true, name: true },
        });
        createdAssets.push({ ...updated, acquisitionValue: acqValue });
      } else {
        // Create new asset
        const assetTag = await getNextAssetTag(tx, ctx.organizationId);
        const classification =
          assignment.assetType === 'TERRA' ? 'NON_DEPRECIABLE_CPC27' : input.classification;

        const created = await tx.asset.create({
          data: {
            organizationId: ctx.organizationId,
            farmId: input.farmId,
            assetType: assignment.assetType as never,
            classification: classification as never,
            name: assignment.assetName,
            assetTag,
            acquisitionValue: String(acqValue),
            acquisitionDate: nfeParsed.issueDate ? new Date(nfeParsed.issueDate) : undefined,
            invoiceNumber: nfeParsed.invoiceNumber ?? undefined,
            costCenterId: input.costCenterId,
            costCenterMode: input.costCenterMode ?? 'FIXED',
            photoUrls: [],
          },
          select: { id: true, assetTag: true, name: true },
        });
        createdAssets.push({ ...created, acquisitionValue: acqValue });
      }
    }

    // Create single Payable for total NF amount
    let payableId: string | null = null;

    if (totalNf > 0 && (input.dueDate || input.firstDueDate)) {
      const supplierName = nfeParsed.supplierName ?? '';
      const installmentCount =
        input.paymentType === 'AVISTA' ? 1 : (input.installmentCount ?? 1);
      const firstDueDateObj = new Date(
        input.paymentType === 'AVISTA' ? input.dueDate! : input.firstDueDate!,
      );

      const installments = generateInstallments(
        Money(totalNf),
        installmentCount,
        firstDueDateObj,
      );

      const payable = await tx.payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: input.farmId,
          supplierName,
          category: 'ASSET_ACQUISITION',
          description: `Aquisição via NF-e ${nfeParsed.invoiceNumber ?? ''}`.trim(),
          totalAmount: Money(totalNf).toDecimal(),
          dueDate: installments[0].dueDate,
          documentNumber: nfeParsed.invoiceNumber ?? null,
          installmentCount,
          originType: 'ASSET_ACQUISITION',
          originId: createdAssets[0]?.id ?? null,
        },
        select: { id: true },
      });

      await tx.payableInstallment.createMany({
        data: installments.map((inst) => ({
          payableId: payable.id,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });

      if (input.costCenterId) {
        await tx.payableCostCenterItem.create({
          data: {
            payableId: payable.id,
            costCenterId: input.costCenterId,
            farmId: input.farmId,
            allocMode: 'PERCENTAGE',
            percentage: 100,
          },
        });
      }

      payableId = payable.id;
    }

    return { assets: createdAssets, payableId, totalNf };
  });
}
