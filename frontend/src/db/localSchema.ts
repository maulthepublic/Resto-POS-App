import Dexie, { type Table } from 'dexie';

// Type definitions matching IndexedDB records
export interface LocalUser {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'admin' | 'cashier' | 'chef';
  isActive: boolean;
  updatedAt: string;
}

export interface LocalCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}

export interface LocalMenuItem {
  id: string;
  categoryId?: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface LocalVariantGroup {
  id: string;
  menuItemId: string;
  name: string;
  isRequired: boolean;
  maxSelected: number;
}

export interface LocalVariant {
  id: string;
  variantGroupId: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
}

export interface LocalModifier {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
}

export interface LocalRawMaterial {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
  minimumQuantity: number;
  currentQuantity: number;
  updatedAt: string;
}

export interface LocalRecipe {
  id: string;
  menuItemId: string;
  rawMaterialId: string;
  quantity: number;
}

export interface LocalOrder {
  id: string;
  receiptNumber: string;
  tableNumber?: string;
  status: 'draft' | 'paid' | 'cooking' | 'ready' | 'served' | 'cancelled';
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAt: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'processing' | 'synced' | 'failed';
}

export interface LocalOrderItem {
  id: string;
  orderId: string;
  menuItemId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedVariants: unknown[];
  selectedModifiers: unknown[];
  kitchenNote?: string;
}

export interface LocalPayment {
  id: string;
  orderId: string;
  method: 'cash' | 'static_qris' | 'dynamic_qris' | 'ewallet' | 'debit_credit';
  amount: number;
  providerReference?: string;
  isOffline: boolean;
  createdAt: string;
}

export interface LocalStockMovement {
  id: string;
  rawMaterialId: string;
  orderId?: string;
  movementType: string;
  quantityDelta: number;
  note?: string;
  createdAt: string;
  createdBy?: string;
  syncStatus: 'pending' | 'processing' | 'synced' | 'failed';
}

export interface LocalFinanceLedger {
  id: string;
  orderId?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  paymentMethod?: string;
  description?: string;
  occurredAt: string;
  createdBy?: string;
  createdAt: string;
  syncStatus: 'pending' | 'processing' | 'synced' | 'failed';
}

export interface LocalSyncQueueItem {
  localSequence?: number;
  idempotencyKey: string;
  deviceId: string;
  entityType: 'order' | 'stockMovement' | 'financeLedger' | 'menuItem' | 'rawMaterial' | 'recipe' | 'user' | 'category' | 'modifier' | 'variantGroup' | 'variant';
  entityId: string;
  operation: 'insert' | 'update' | 'delete';
  payload: unknown;
  requestHash: string;
  syncStatus: 'pending' | 'processing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: string;
  lastTriedAt?: string;
  errorMessage?: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

// Dexie Database Class Definition
export class RestoPOSDatabase extends Dexie {
  users!: Table<LocalUser, string>;
  categories!: Table<LocalCategory, string>;
  menuItems!: Table<LocalMenuItem, string>;
  variantGroups!: Table<LocalVariantGroup, string>;
  variants!: Table<LocalVariant, string>;
  modifiers!: Table<LocalModifier, string>;
  rawMaterials!: Table<LocalRawMaterial, string>;
  recipes!: Table<LocalRecipe, string>;
  orders!: Table<LocalOrder, string>;
  orderItems!: Table<LocalOrderItem, string>;
  payments!: Table<LocalPayment, string>;
  stockMovements!: Table<LocalStockMovement, string>;
  financeLedger!: Table<LocalFinanceLedger, string>;
  syncQueue!: Table<LocalSyncQueueItem, number>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super('RestoPOSDatabase');

    // Version 1: original schema
    this.version(1).stores({
      users: 'id, role, isActive, updatedAt',
      categories: 'id, name, isActive, updatedAt',
      menuItems: 'id, categoryId, name, isActive, updatedAt',
      variantGroups: 'id, menuItemId',
      variants: 'id, variantGroupId, isActive',
      modifiers: 'id, isActive',
      rawMaterials: 'id, name, unitCost, currentQuantity, minimumQuantity, updatedAt',
      recipes: 'id, menuItemId, rawMaterialId',
      orders: 'id, receiptNumber, status, paidAt, syncStatus',
      orderItems: 'id, orderId, menuItemId',
      payments: 'id, orderId, method, createdAt',
      stockMovements: 'id, rawMaterialId, orderId, createdAt, syncStatus',
      financeLedger: 'id, type, occurredAt, syncStatus',
      syncQueue: '++localSequence, idempotencyKey, entityType, entityId, operation, syncStatus, createdAt',
      appSettings: 'key',
    });

    // Version 2: force clean re-seed (clears all stores)
    this.version(2)
      .stores({
        users: 'id, role, isActive, updatedAt',
        categories: 'id, name, sortOrder, updatedAt',
        menuItems: 'id, categoryId, name, updatedAt',
        variantGroups: 'id, menuItemId',
        variants: 'id, variantGroupId',
        modifiers: 'id',
        rawMaterials: 'id, name, unitCost, currentQuantity, minimumQuantity, updatedAt',
        recipes: 'id, menuItemId, rawMaterialId',
        orders: 'id, receiptNumber, status, paidAt, syncStatus',
        orderItems: 'id, orderId, menuItemId',
        payments: 'id, orderId, method, createdAt',
        stockMovements: 'id, rawMaterialId, orderId, createdAt, syncStatus',
        financeLedger: 'id, type, occurredAt, syncStatus',
        syncQueue: '++localSequence, idempotencyKey, entityType, entityId, operation, syncStatus, createdAt',
        appSettings: 'key',
      })
      .upgrade(async (tx) => {
        // Clear all tables so seedDatabase() runs fresh on v2
        await tx.table('users').clear();
        await tx.table('categories').clear();
        await tx.table('menuItems').clear();
        await tx.table('variantGroups').clear();
        await tx.table('variants').clear();
        await tx.table('modifiers').clear();
        await tx.table('rawMaterials').clear();
        await tx.table('recipes').clear();
        await tx.table('orders').clear();
        await tx.table('orderItems').clear();
        await tx.table('payments').clear();
        await tx.table('stockMovements').clear();
        await tx.table('financeLedger').clear();
        await tx.table('syncQueue').clear();
        await tx.table('appSettings').clear();
      });
  }
}

export const db = new RestoPOSDatabase();
