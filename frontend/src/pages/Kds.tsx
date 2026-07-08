import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/localSchema';
import { useNetworkStore } from '../store/networkStore';

export function Kds() {
  const { enqueueMutation } = useNetworkStore();

  // Query cooking or ready orders
  const activeOrders = useLiveQuery(async () => {
    const orders = await db.orders.toArray();
    // Get orders that are cooking or ready (not completed served yet)
    const kdsOrders = orders.filter((o) => ['cooking', 'ready', 'paid'].includes(o.status));
    
    // Sort by paid time (first come first served)
    kdsOrders.sort((a, b) => a.paidAt.localeCompare(b.paidAt));

    const orderItems = await db.orderItems.toArray();

    return kdsOrders.map((order) => ({
      ...order,
      items: orderItems.filter((item) => item.orderId === order.id),
    }));
  }, []);

  const handleUpdateStatus = async (orderId: string, nextStatus: 'cooking' | 'ready' | 'served') => {
    try {
      await db.orders.update(orderId, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      // Track mutation queue
      await enqueueMutation('order', orderId, 'update', {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to update order status:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3>Monitor Dapur (Kitchen Display System)</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Daftar antrean makanan dan minuman yang masuk ke dapur secara real-time.
        </p>
      </div>

      {activeOrders === undefined || activeOrders.length === 0 ? (
        <div style={{ border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Tidak ada antrean pesanan masak aktif saat ini.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {activeOrders.map((order) => {
            const timeDiff = Math.round((Date.now() - new Date(order.paidAt).getTime()) / 60000);
            
            return (
              <div
                key={order.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <div>
                    <h4 style={{ color: 'var(--primary)' }}>{order.receiptNumber}</h4>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Meja: {order.tableNumber || '-'}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: timeDiff > 15 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: '600' }}>
                    🕒 {timeDiff} menit lalu
                  </span>
                </div>

                {/* Items list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '80px' }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                        <span>{item.itemName}</span>
                        <span>x{item.quantity}</span>
                      </div>
                      
                      {/* Selected customizations */}
                      {Array.isArray(item.selectedVariants) && item.selectedVariants.map((v: any) => (
                        <div key={v.id} style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          ▪ {v.name}
                        </div>
                      ))}

                      {Array.isArray(item.selectedModifiers) && item.selectedModifiers.map((m: any) => (
                        <div key={m.id} style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          + {m.name}
                        </div>
                      ))}

                      {item.kitchenNote && (
                        <div style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '500', fontStyle: 'italic', marginLeft: '8px' }}>
                          Note: {item.kitchenNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* KDS actions */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                  {order.status === 'paid' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'cooking')}
                      style={{ flex: 1, background: 'var(--warning)', color: '#222', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                    >
                      Mulai Masak
                    </button>
                  )}
                  {order.status === 'cooking' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      style={{ flex: 1, background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                    >
                      Siap Sajikan
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'served')}
                      style={{ flex: 1, background: 'var(--success)', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                    >
                      Selesai / Saji
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
