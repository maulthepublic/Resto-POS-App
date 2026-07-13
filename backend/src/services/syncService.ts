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
    }).catch(() => null);
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
    await prisma.rawMaterial.delete({ where: { id: item.entityId } }).catch(() => null);
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
  } else if (item.operation === 'update') {
    await prisma.recipe.update({
      where: { id: item.entityId },
      data: {
        quantity: p.quantity !== undefined ? p.quantity : undefined,
      },
    });
  } else if (item.operation === 'delete') {
    await prisma.recipe.delete({ where: { id: item.entityId } }).catch(() => null);
  }
}

async function handleUser(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  const userData = p.user ?? p;

  if (item.operation === 'insert') {
    await prisma.user.upsert({
      where: { id: item.entityId },
      update: {
        name: userData.name,
        role: userData.role,
        isActive: userData.isActive ?? true,
        updatedAt: new Date(),
      },
      create: {
        id: item.entityId,
        name: userData.name,
        // Email diisi kosong bila tidak ada — backend tidak wajib punya email
        email: userData.email ?? null,
        // PIN tidak di-sync lewat queue karena harus di-hash. Gunakan authService untuk update PIN.
        passwordHash: '', // placeholder, tidak bisa login lewat password tanpa set via authService
        pinHash: null,
        role: userData.role,
        isActive: userData.isActive ?? true,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.user.update({
      where: { id: item.entityId },
      data: {
        name: userData.name ?? undefined,
        role: userData.role ?? undefined,
        isActive: userData.isActive ?? undefined,
        updatedAt: new Date(),
      },
    });
  } else if (item.operation === 'delete') {
    // Soft-delete: nonaktifkan user daripada hapus
    await prisma.user.update({
      where: { id: item.entityId },
      data: { isActive: false },
    }).catch(() => null); // Abaikan bila user tidak ditemukan
  }
}

async function handleCategory(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  const catData = p.category ?? p;

  if (item.operation === 'insert') {
    await prisma.category.upsert({
      where: { id: item.entityId },
      update: {
        name: catData.name,
        sortOrder: catData.sortOrder ?? 0,
        isActive: catData.isActive ?? true,
        updatedAt: new Date(),
      },
      create: {
        id: item.entityId,
        name: catData.name,
        sortOrder: catData.sortOrder ?? 0,
        isActive: catData.isActive ?? true,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.category.update({
      where: { id: item.entityId },
      data: {
        name: catData.name ?? undefined,
        sortOrder: catData.sortOrder ?? undefined,
        isActive: catData.isActive ?? undefined,
        updatedAt: new Date(),
      },
    });
  } else if (item.operation === 'delete') {
    await prisma.category.update({
      where: { id: item.entityId },
      data: { isActive: false },
    }).catch(() => null);
  }
}

async function handleModifier(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  const modData = p.modifier ?? p;

  if (item.operation === 'insert') {
    await prisma.modifier.upsert({
      where: { id: item.entityId },
      update: {
        name: modData.name,
        priceDelta: modData.priceDelta ?? 0,
        isActive: modData.isActive ?? true,
      },
      create: {
        id: item.entityId,
        name: modData.name,
        priceDelta: modData.priceDelta ?? 0,
        isActive: modData.isActive ?? true,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.modifier.update({
      where: { id: item.entityId },
      data: {
        name: modData.name ?? undefined,
        priceDelta: modData.priceDelta ?? undefined,
        isActive: modData.isActive ?? undefined,
      },
    });
  } else if (item.operation === 'delete') {
    await prisma.modifier.delete({ where: { id: item.entityId } }).catch(() => null);
  }
}

async function handleVariantGroup(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  const vgData = p.variantGroup ?? p;

  if (item.operation === 'insert') {
    await prisma.variantGroup.upsert({
      where: { id: item.entityId },
      update: {
        name: vgData.name,
        isRequired: vgData.isRequired ?? false,
        maxSelected: vgData.maxSelected ?? 1,
      },
      create: {
        id: item.entityId,
        menuItemId: vgData.menuItemId,
        name: vgData.name,
        isRequired: vgData.isRequired ?? false,
        maxSelected: vgData.maxSelected ?? 1,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.variantGroup.update({
      where: { id: item.entityId },
      data: {
        name: vgData.name ?? undefined,
        isRequired: vgData.isRequired ?? undefined,
        maxSelected: vgData.maxSelected ?? undefined,
      },
    });
  } else if (item.operation === 'delete') {
    // Cascade delete is handled by PostgreSQL (onDelete: Cascade on Variant).
    // Soft-delete is not applicable here — a deleted group means the variants are gone too.
    await prisma.variantGroup.delete({ where: { id: item.entityId } }).catch(() => null);
  }
}

async function handleVariant(item: SyncMutationItem): Promise<void> {
  const p = item.payload as any;
  const varData = p.variant ?? p;

  if (item.operation === 'insert') {
    await prisma.variant.upsert({
      where: { id: item.entityId },
      update: {
        name: varData.name,
        priceDelta: varData.priceDelta ?? 0,
        isActive: varData.isActive ?? true,
      },
      create: {
        id: item.entityId,
        variantGroupId: varData.variantGroupId,
        name: varData.name,
        priceDelta: varData.priceDelta ?? 0,
        isActive: varData.isActive ?? true,
      },
    });
  } else if (item.operation === 'update') {
    await prisma.variant.update({
      where: { id: item.entityId },
      data: {
        name: varData.name ?? undefined,
        priceDelta: varData.priceDelta ?? undefined,
        isActive: varData.isActive ?? undefined,
      },
    });
  } else if (item.operation === 'delete') {
    await prisma.variant.delete({ where: { id: item.entityId } }).catch(() => null);
  }
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

export async function processMutation(item: SyncMutationItem): Promise<void> {
  switch (item.entityType) {
    case 'order':         return handleOrder(item);
    case 'stockMovement': return handleStockMovement(item);
    case 'financeLedger': return handleFinanceLedger(item);
    case 'menuItem':      return handleMenuItem(item);
    case 'rawMaterial':   return handleRawMaterial(item);
    case 'recipe':        return handleRecipe(item);
    case 'user':          return handleUser(item);
    case 'category':      return handleCategory(item);
    case 'modifier':      return handleModifier(item);
    case 'variantGroup':  return handleVariantGroup(item);
    case 'variant':       return handleVariant(item);
    default:
      throw new Error(`Unknown entityType: ${(item as any).entityType}`);
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
