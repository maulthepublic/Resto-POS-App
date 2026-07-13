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
    <div className="page-shell page-kds" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div>
        <div className="badge-eyebrow" style={{ marginBottom: '8px' }}>KITCHEN OPERATIONS</div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>Monitor Dapur (Kitchen Display System)</h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Daftar antrean makanan dan minuman yang masuk ke dapur secara real-time.
        </p>
      </div>

      {activeOrders === undefined || activeOrders.length === 0 ? (
        <div style={{ 
          border: '1px dashed rgba(255, 255, 255, 0.08)', 
          borderRadius: 'var(--radius-lg)', 
          height: '240px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'var(--text-secondary)',
          fontSize: '13px',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          Tidak ada antrean pesanan masak aktif saat ini.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {activeOrders.map((order) => {
            const timeDiff = Math.round((Date.now() - new Date(order.paidAt).getTime()) / 60000);
            
            // Choose border glow color based on status and time urgency
            const isLate = timeDiff > 15;
            let statusColor = 'rgba(255, 255, 255, 0.05)';
            let accentGlow = 'none';
            let buttonClass = 'btn-pill-primary';
            let buttonText = '';
            let buttonColor = 'var(--primary)';
            let nextAction: 'cooking' | 'ready' | 'served' = 'cooking';

            if (order.status === 'paid') {
              statusColor = 'rgba(245, 158, 11, 0.25)'; // warning / orange
              accentGlow = '0 0 16px rgba(245, 158, 11, 0.06)';
              buttonColor = 'var(--warning)';
              buttonText = 'Mulai Masak';
              nextAction = 'cooking';
            } else if (order.status === 'cooking') {
              statusColor = 'rgba(99, 102, 241, 0.25)'; // primary / indigo
              accentGlow = '0 0 16px rgba(99, 102, 241, 0.06)';
              buttonColor = 'var(--primary)';
              buttonText = 'Siap Sajikan';
              nextAction = 'ready';
            } else if (order.status === 'ready') {
              statusColor = 'rgba(16, 185, 129, 0.25)'; // success / green
              accentGlow = '0 0 16px rgba(16, 185, 129, 0.06)';
              buttonColor = 'var(--success)';
              buttonText = 'Selesai / Saji';
              nextAction = 'served';
            }

            return (
              <div
                key={order.id}
                className="bezel-outer"
                style={{
                  padding: '6px',
                  borderColor: statusColor,
                  boxShadow: accentGlow,
                }}
              >
                <div
                  className="bezel-inner"
                  style={{
                    padding: '20px',
                    background: 'rgba(10, 16, 30, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* Header card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
                    <div>
                      <h4 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>{order.receiptNumber}</h4>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '2px', display: 'inline-block' }}>Meja: {order.tableNumber || '-'}</span>
                    </div>
                    <span style={{ 
                      fontSize: '10px', 
                      color: isLate ? 'var(--danger)' : 'var(--text-secondary)', 
                      fontWeight: '700',
                      background: isLate ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: isLate ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(255, 255, 255, 0.05)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isLate ? 'var(--danger)' : 'var(--text-secondary)' }} />
                      {timeDiff} mnt lalu
                    </span>
                  </div>

                  {/* Items list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '80px' }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: '#ffffff' }}>
                          <span>{item.itemName}</span>
                          <span style={{ color: 'var(--primary-hover)' }}>x{item.quantity}</span>
                        </div>
                        
                        {/* Selected customizations */}
                        {Array.isArray(item.selectedVariants) && item.selectedVariants.map((v: any) => (
                          <div key={v.id} style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginLeft: '8px', marginTop: '2px' }}>
                            ▪ {v.name}
                          </div>
                        ))}

                        {Array.isArray(item.selectedModifiers) && item.selectedModifiers.map((m: any) => (
                          <div key={m.id} style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginLeft: '8px', marginTop: '2px' }}>
                            + {m.name}
                          </div>
                        ))}

                        {item.kitchenNote && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: 'var(--warning)', 
                            fontWeight: '600', 
                            fontStyle: 'italic', 
                            marginLeft: '8px', 
                            marginTop: '4px',
                            background: 'rgba(245, 158, 11, 0.04)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            borderLeft: '2px solid var(--warning)'
                          }}>
                            Note: {item.kitchenNote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* KDS actions */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleUpdateStatus(order.id, nextAction)}
                      className={buttonClass}
                      style={{ 
                        width: '100%', 
                        background: buttonColor,
                        color: order.status === 'paid' ? '#000000' : '#ffffff',
                        padding: '10px 16px', 
                        fontSize: '12.5px',
                        boxShadow: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1.5px)';
                        e.currentTarget.style.boxShadow = `0 6px 16px ${buttonColor}40`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {buttonText}
                      <span className="btn-icon-wrapper" style={{ background: 'rgba(255, 255, 255, 0.22)', color: order.status === 'paid' ? '#000000' : '#ffffff' }}>✓</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
