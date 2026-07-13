import { create } from 'zustand';
import { db, LocalSyncQueueItem } from '../db/localSchema';
import { useAuthStore } from './authStore';

// Maximum number of times a single mutation will be retried before it is
// permanently marked 'failed' and excluded from future sync passes.
// The item remains in IndexedDB for manual inspection / recovery.
const MAX_RETRY = 5;

interface NetworkState {
  isOffline: boolean;
  syncQueueCount: number;
  isSyncing: boolean;
  syncError: string | null;
  hasNewMutationsDuringSync: boolean;
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
  hasNewMutationsDuringSync: false,

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

      if (get().isSyncing) {
        set({ hasNewMutationsDuringSync: true });
      }

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

    const pendingItems = await db.syncQueue.where('syncStatus').equals('pending').toArray();
    if (pendingItems.length === 0) return;

    set({ isSyncing: true, syncError: null, hasNewMutationsDuringSync: false });

    // Pastikan ada token sebelum push. Kalau belum ada, coba refresh dulu.
    let token = useAuthStore.getState().authToken;
    if (!token) {
      const refreshed = await useAuthStore.getState().refreshAuthToken();
      if (!refreshed) {
        set({ isSyncing: false, syncError: 'Belum berhasil autentikasi ke server. Sinkronisasi ditunda.' });
        return;
      }
      token = useAuthStore.getState().authToken;
    }

    try {
      const deviceIdSetting = await db.appSettings.get('deviceId');
      const deviceId = (deviceIdSetting?.value as string) || 'unknown-device';

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

      // Token basi atau invalid, jangan tandai item gagal permanen
      if (response.status === 401) {
        useAuthStore.setState({ authToken: null });
        localStorage.removeItem('resto_pos_token');
        set({ syncError: 'Sesi ke server berakhir, mencoba autentikasi ulang di sinkronisasi berikutnya.' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Sync server returned ${response.status} status.`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.results)) {
        await db.transaction('rw', db.syncQueue, async () => {
          for (const res of data.results) {
            const matchingItem = pendingItems.find((i) => i.idempotencyKey === res.idempotencyKey);
            if (matchingItem && matchingItem.localSequence !== undefined) {
              if (res.status === 'synced' || res.status === 'skipped') {
                // Item berhasil — hapus dari queue
                await db.syncQueue.delete(matchingItem.localSequence);
              } else {
                // Item gagal — tentukan apakah masih bisa dicoba atau sudah melebihi batas.
                const newRetryCount = matchingItem.retryCount + 1;
                const isPermanentlyFailed = newRetryCount >= MAX_RETRY;

                await db.syncQueue.update(matchingItem.localSequence, {
                  // Bila batas retry tercapai: tandai 'failed' permanen sehingga tidak
                  // ikut dalam batch sync berikutnya. Item tetap di IndexedDB untuk
                  // ditinjau secara manual. Bila belum: biarkan 'pending' agar dicoba lagi.
                  syncStatus: isPermanentlyFailed ? 'failed' : 'pending',
                  retryCount: newRetryCount,
                  lastTriedAt: new Date().toISOString(),
                  errorMessage: res.error || 'Server processing failed',
                });

                if (isPermanentlyFailed) {
                  console.warn(
                    `[Sync] Item ${matchingItem.idempotencyKey} (${matchingItem.entityType}/${
                      matchingItem.entityId
                    }) ditandai gagal permanen setelah ${newRetryCount} percobaan.`,
                    res.error
                  );
                }
              }
            }
          }
        });
      }
    } catch (err: any) {
      console.warn('[Sync Service] Gagal menghubungi server.', err.message);
      set({ syncError: 'Gagal menghubungi server. Data aman dalam antrean lokal.' });
    } finally {
      set({ isSyncing: false });
      await get().updateSyncQueueCount();

      // If new mutations were enqueued during this active sync, trigger another cycle immediately.
      if (get().hasNewMutationsDuringSync && !get().isOffline) {
        set({ hasNewMutationsDuringSync: false });
        setTimeout(() => {
          get().processSyncQueue();
        }, 0);
      }
    }
  },
}));
