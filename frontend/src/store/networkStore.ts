import { create } from 'zustand';
import { db, LocalSyncQueueItem } from '../db/localSchema';

interface NetworkState {
  isOffline: boolean;
  syncQueueCount: number;
  isSyncing: boolean;
  syncError: string | null;
  toggleNetwork: () => void;
  updateSyncQueueCount: () => Promise<void>;
  enqueueMutation: (
    entityType: LocalSyncQueueItem['entityType'],
    entityId: string,
    operation: LocalSyncQueueItem['operation'],
    payload: unknown
  ) => Promise<void>;
  processSyncQueue: () => Promise<void>;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOffline: false,
  syncQueueCount: 0,
  isSyncing: false,
  syncError: null,

  toggleNetwork: () => {
    const nextState = !get().isOffline;
    set({ isOffline: nextState });
    console.log(`[Network Simulator] Network status changed to: ${nextState ? 'OFFLINE' : 'ONLINE'}`);
    if (!nextState) {
      // Auto-trigger sync when returning online
      get().processSyncQueue();
    }
  },

  updateSyncQueueCount: async () => {
    try {
      const count = await db.syncQueue
        .where('syncStatus')
        .equals('pending')
        .count();
      set({ syncQueueCount: count });
    } catch (err) {
      console.error('Failed to count sync queue:', err);
    }
  },

  enqueueMutation: async (entityType, entityId, operation, payload) => {
    try {
      const deviceIdSetting = await db.appSettings.get('deviceId');
      const deviceId = (deviceIdSetting?.value as string) || 'unknown-device';
      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const queueItem: LocalSyncQueueItem = {
        idempotencyKey,
        deviceId,
        entityType,
        entityId,
        operation,
        payload,
        requestHash: '',
        syncStatus: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      await db.syncQueue.add(queueItem);
      await get().updateSyncQueueCount();

      // If online, immediately try to sync
      if (!get().isOffline) {
        get().processSyncQueue();
      }
    } catch (err) {
      console.error('Failed to enqueue mutation:', err);
    }
  },

  processSyncQueue: async () => {
    if (get().isOffline || get().isSyncing) return;

    const pendingItems = await db.syncQueue
      .where('syncStatus')
      .equals('pending')
      .toArray();

    if (pendingItems.length === 0) {
      return;
    }

    set({ isSyncing: true, syncError: null });
    console.log(`[Sync Service] Found ${pendingItems.length} pending mutations. Attempting upload...`);

    try {
      const deviceIdSetting = await db.appSettings.get('deviceId');
      const deviceId = (deviceIdSetting?.value as string) || 'unknown-device';

      // Call mock sync endpoint or actual endpoint if available
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          mutations: pendingItems.map((item) => ({
            idempotencyKey: item.idempotencyKey,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            payload: item.payload,
            clientCreatedAt: item.createdAt,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync server returned ${response.status} status.`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.results)) {
        // Update local sync status based on results
        for (const res of data.results) {
          const matchingItem = pendingItems.find((i) => i.idempotencyKey === res.idempotencyKey);
          if (matchingItem && matchingItem.localSequence !== undefined) {
            if (res.status === 'synced') {
              // Option A: Delete from queue
              await db.syncQueue.delete(matchingItem.localSequence);
            } else {
              // Update retry count and error message
              await db.syncQueue.update(matchingItem.localSequence, {
                syncStatus: 'failed',
                retryCount: matchingItem.retryCount + 1,
                errorMessage: res.error || 'Server processing failed',
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[Sync Service] Server sync failed (Network error or offline server). Storing in pending queue.');
      set({ syncError: 'Gagal menghubungi server. Data aman dalam antrean lokal.' });
      
      // Fallback: Simulate sync success if we want a pure demo, 
      // but let's keep it realistic and show them as "pending" or allow manual resolve.
      // For testing, let's keep them in IndexedDB and print a message.
    } finally {
      set({ isSyncing: false });
      await get().updateSyncQueueCount();
    }
  },
}));
