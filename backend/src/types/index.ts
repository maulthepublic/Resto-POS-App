// Shared TypeScript types for the Resto POS Backend

export type UserRole = 'owner' | 'admin' | 'cashier' | 'chef';

export type OrderStatus = 'draft' | 'paid' | 'cooking' | 'ready' | 'served' | 'cancelled';

export type PaymentMethod = 'cash' | 'static_qris' | 'dynamic_qris' | 'ewallet' | 'debit_credit';

export type SyncOperation = 'insert' | 'update' | 'delete';

export type SyncStatus = 'pending' | 'processing' | 'synced' | 'failed';

export type LedgerType = 'income' | 'expense';

// JWT payload shape
export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Sync mutation batch item received from client
export interface SyncMutationItem {
  idempotencyKey: string;
  deviceId: string;
  entityType:
    | 'order'
    | 'orderItem'
    | 'payment'
    | 'stockMovement'
    | 'financeLedger'
    | 'menuItem'
    | 'rawMaterial'
    | 'category'
    | 'recipe'
    | 'user'
    | 'modifier'
    | 'variantGroup'
    | 'variant';
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  clientCreatedAt: string;
}

// Sync batch request body
export interface SyncPushRequest {
  deviceId: string;
  mutations: SyncMutationItem[];
}

// Result of processing a single mutation
export interface SyncMutationResult {
  idempotencyKey: string;
  status: 'synced' | 'failed' | 'skipped';
  error?: string;
}

// API standard response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}
