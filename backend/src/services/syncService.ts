import prisma from '../config/db';
import { SyncMutationItem, SyncMutationResult } from '../types';

// ─── Entity Handlers ─────────────────────────────────────────────────────────

async function handleOrder(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  if (item.operation === 'insert') {
    await prisma.order.upsert({
      where: { id: item.entityId },
      update: {},
      create: {
        id: item.entityId,
        deviceId: p.deviceId ?? item.deviceId ?? '',
        receiptNumber: p.receiptNumber,
        tableNumber: p.tableNumber ?? null,
        status: p.status ?? 'paid',
        subtotal: p.subtotal,
        discountTotal: p.discountTotal ?? 0,
        taxTotal: p.taxTotal ?? 0,
        grandTotal: p.grandTotal,
        paidAt: new Date(p.paidAt),
        createdBy: p.createdBy ?? null,
      },
    });

    // Insert order items if bundled
    if (Array.isArray(p.items)) {
      for (const oi of p.items) {
        await prisma.orderItem.upsert({
          where: { id: oi.id ?? `${item.entityId}-${oi.menuItemId}` },
          update: {},
          create: {
            id: oi.id ?? `${item.entityId}-${oi.menuItemId}-${Date.now()}`,
            orderId: item.entityId,
            menuItemId: oi.menuItemId ?? null,
            itemName: oi.itemName,
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
            lineTotal: oi.lineTotal,
            selectedVariants: oi.selectedVariants ?? [],
            selectedModifiers: oi.selectedModifiers ?? [],
            kitchenNote: oi.kitchenNote ?? null,
          },
        });
      }
    }

    // Insert payment if bundled
    if (p.payment) {
      const payId = `pay-${item.entityId}`;
      await prisma.payment.upsert({
        where: { id: payId },
        update: {},
        create: {
          id: payId,
          orderId: item.entityId,
          method: p.payment.method,
          amount: p.payment.amount,
          isOffline: p.payment.isOffline ?? false,
          providerReference: p.payment.providerReference ?? null,
        },
      });
    }
  } else if (item.operation === 'update') {
    await prisma.order.update({
      where: { id: item.entityId },
      data: {
        status: p.status ?? undefined,
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      },
    });
  }
}

async function handleStockMovement(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  if (item.operation === 'insert') {
    await prisma.stockMovement.upsert({
      where: { id: item.entityId },
      update: {},
      create: {
        id: item.entityId,
        rawMaterialId: p.rawMaterialId,
        orderId: p.orderId ?? null,
        movementType: p.movementType,
        quantityDelta: p.quantityDelta,
        note: p.note ?? null,
        createdBy: p.createdBy ?? null,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      },
    });

    // Also update material quantity on cloud DB
    await prisma.rawMaterial.update({
      where: { id: p.rawMaterialId },
      data: {
        currentQuantity: { increment: p.quantityDelta },
        updatedAt: new Date(),
      },
    });
  }
}

async function handleFinanceLedger(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  if (item.operation === 'insert') {
    await prisma.financeLedger.upsert({
      where: { id: item.entityId },
      update: {},
      create: {
        id: item.entityId,
        orderId: p.orderId ?? null,
        type: p.type,
        category: p.category,
        amount: p.amount,
        paymentMethod: p.paymentMethod ?? null,
        description: p.description ?? null,
        occurredAt: new Date(p.occurredAt),
        createdBy: p.createdBy ?? null,
      },
    });
  }
}

async function handleMenuItem(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  if (item.operation === 'insert') {
    await prisma.menuItem.upsert({
      where: { id: item.entityId },
      update: {
        name: p.name,
        basePrice: p.basePrice,
        categoryId: p.categoryId ?? null,
        description: p.description ?? null,
        isActive: p.isActive ?? true,
        updatedAt: new Date(),
      },
      create: {
        id: item.entityId,
        name: p.name,
        basePrice: p.basePrice,
        categoryId: p.categoryId ?? null,
        description: p.description ?? null,
        isActive: p.isActive ?? true,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.menuItem.update({
      where: { id: item.entityId },
      data: { ...p, updatedAt: new Date() },
    });
  } else if (item.operation === 'delete') {
    await prisma.menuItem.update({
      where: { id: item.entityId },
      data: { isActive: false },
    });
  }
}

async function handleRawMaterial(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  if (item.operation === 'insert') {
    await prisma.rawMaterial.upsert({
      where: { id: item.entityId },
      update: {
        name: p.name,
        unit: p.unit,
        unitCost: p.unitCost,
        minimumQuantity: p.minimumQuantity ?? 0,
        currentQuantity: p.currentQuantity ?? 0,
        updatedAt: new Date(),
      },
      create: {
        id: item.entityId,
        name: p.name,
        unit: p.unit,
        unitCost: p.unitCost,
        minimumQuantity: p.minimumQuantity ?? 0,
        currentQuantity: p.currentQuantity ?? 0,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.rawMaterial.update({
      where: { id: item.entityId },
      data: { ...p, updatedAt: new Date() },
    });
  } else if (item.operation === 'delete') {
    await prisma.rawMaterial.delete({ where: { id: item.entityId } });
  }
}

async function handleRecipe(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  if (item.operation === 'insert') {
    await prisma.recipe.upsert({
      where: { menuItemId_rawMaterialId: { menuItemId: p.menuItemId, rawMaterialId: p.rawMaterialId } },
      update: { quantity: p.quantity },
      create: {
        id: item.entityId,
        menuItemId: p.menuItemId,
        rawMaterialId: p.rawMaterialId,
        quantity: p.quantity,
      },
    });
  } else if (item.operation === 'delete') {
    await prisma.recipe.delete({ where: { id: item.entityId } }).catch(() => null);
  }
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

export async function processMutation(item: SyncMutationItem): Promise<void> {
  switch (item.entityType) {
    case 'order':        return handleOrder(item);
    case 'stockMovement': return handleStockMovement(item);
    case 'financeLedger': return handleFinanceLedger(item);
    case 'menuItem':     return handleMenuItem(item);
    case 'rawMaterial':  return handleRawMaterial(item);
    case 'recipe':       return handleRecipe(item);
    default:
      throw new Error(`Unknown entityType: ${item.entityType}`);
  }
}

// ─── Batch Sync Handler ────────────────────────────────────────────────────

export async function processSyncBatch(
  deviceId: string,
  mutations: SyncMutationItem[]
): Promise<SyncMutationResult[]> {
  const results: SyncMutationResult[] = [];

  for (const mutation of mutations) {
    // 1. Idempotency check: skip if already processed
    const existing = await prisma.syncMutation.findUnique({
      where: { idempotencyKey: mutation.idempotencyKey },
    });

    if (existing) {
      results.push({ idempotencyKey: mutation.idempotencyKey, status: 'skipped' });
      continue;
    }

    try {
      // 2. Apply the mutation inside a transaction
      await prisma.$transaction(async () => {
        await processMutation({ ...mutation, deviceId });

        // 3. Record it in sync_mutations for future idempotency checks
        await prisma.syncMutation.create({
          data: {
            deviceId,
            idempotencyKey: mutation.idempotencyKey,
            entityType: mutation.entityType,
            entityId: mutation.entityId ?? null,
            operation: mutation.operation,
            payload: mutation.payload as any,
            clientCreatedAt: new Date(mutation.clientCreatedAt),
            status: 'synced',
          },
        });
      });

      results.push({ idempotencyKey: mutation.idempotencyKey, status: 'synced' });
    } catch (err: any) {
      console.error(`[Sync] Failed mutation ${mutation.idempotencyKey}:`, err?.message);
      results.push({
        idempotencyKey: mutation.idempotencyKey,
        status: 'failed',
        error: err?.message ?? 'Unknown processing error',
      });
    }
  }

  return results;
}
