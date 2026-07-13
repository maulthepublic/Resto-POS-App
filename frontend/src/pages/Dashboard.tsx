import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/localSchema';

interface DashboardProps {
  onNavigateToKasir: () => void;
}

export function Dashboard({ onNavigateToKasir }: DashboardProps) {
  // Fetch orders created today
  const stats = useLiveQuery(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await db.orders.toArray();
    const todayOrders = orders.filter(
      (o) =>
        new Date(o.createdAt) >= today &&
        ['paid', 'cooking', 'ready', 'served'].includes(o.status)
    );

    const subtotalSales = todayOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const receiptCount = todayOrders.length;

    // Payment methods popularities
    const payments = await db.payments.toArray();
    const todayPayments = payments.filter((p) => {
      const o = orders.find((ord) => ord.id === p.orderId);
      return (
        o &&
        new Date(o.createdAt) >= today &&
        ['paid', 'cooking', 'ready', 'served'].includes(o.status)
      );
    });

    const paymentMethodsMap: Record<string, number> = {};
    todayPayments.forEach((p) => {
      paymentMethodsMap[p.method] = (paymentMethodsMap[p.method] || 0) + Number(p.amount);
    });

    // Formulate recent orders
    const recent = orders
      .filter((o) => ['paid', 'cooking', 'ready', 'served'].includes(o.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);

    // Calculate hourly slots for dynamic chart representation
    const timeSlots = [
      { label: '08:00', hourStart: 8, hourEnd: 10, total: 0 },
      { label: '10:00', hourStart: 10, hourEnd: 12, total: 0 },
      { label: '12:00', hourStart: 12, hourEnd: 14, total: 0 },
      { label: '14:00', hourStart: 14, hourEnd: 16, total: 0 },
      { label: '16:00', hourStart: 16, hourEnd: 18, total: 0 },
      { label: '18:00', hourStart: 18, hourEnd: 20, total: 0 },
      { label: '20:00', hourStart: 20, hourEnd: 22, total: 0 },
      { label: '22:00', hourStart: 22, hourEnd: 24, total: 0 },
    ];

    todayOrders.forEach((o) => {
      const orderDate = new Date(o.createdAt);
      const hour = orderDate.getHours();
      const slot = timeSlots.find((s) => hour >= s.hourStart && hour < s.hourEnd);
      if (slot) {
        slot.total += Number(o.grandTotal);
      }
    });

    const maxTotal = Math.max(...timeSlots.map((s) => s.total), 1);
    const chartData = timeSlots.map((s) => ({
      label: s.label,
      val: s.total > 0 ? (s.total / maxTotal) * 100 : 5, // minimum 5% to show empty bars elegantly
      amount: s.total,
    }));

    return {
      totalRevenue: subtotalSales,
      receipts: receiptCount,
      paymentMethods: paymentMethodsMap,
      recentOrders: recent,
      chartData,
    };
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="page-shell page-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Bento Grid: Overview Cards */}
      <div
        className="bento-grid"
        style={{
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '24px',
        }}
      >
        {/* Card Revenue - Bento span 5 */}
        <div
          className="bezel-outer interactive"
          style={{
            gridColumn: 'span 5',
          }}
        >
          <div
            className="bezel-inner"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              minHeight: '160px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Pendapatan Hari Ini
              </span>
              <span className="badge-eyebrow" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>LIVE</span>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '34px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatCurrency(stats?.totalRevenue || 0)}
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 550 }}>
                Terhitung dari transaksi lokal sukses hari ini
              </span>
            </div>
          </div>
        </div>

        {/* Card Receipts - Bento span 4 */}
        <div
          className="bezel-outer interactive"
          style={{
            gridColumn: 'span 4',
          }}
        >
          <div
            className="bezel-inner"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              minHeight: '160px',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Jumlah Struk Tercetak
            </span>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '34px',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {stats?.receipts || 0} <span style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-secondary)' }}>Struk</span>
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 550 }}>
                Total pesanan berhasil diproses hari ini
              </span>
            </div>
          </div>
        </div>

        {/* Quick Access Card - Bento span 3 */}
        <div
          className="bezel-outer interactive"
          style={{
            gridColumn: 'span 3',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(255, 255, 255, 0.01))',
            borderColor: 'rgba(99, 102, 241, 0.25)',
          }}
        >
          <div
            className="bezel-inner"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              minHeight: '160px',
              background: 'transparent',
              border: 'none',
              padding: '20px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                Akses Kasir Cepat
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.4 }}>
                Mencatat order dan mencetak struk transaksi baru.
              </p>
            </div>
            <button
              onClick={onNavigateToKasir}
              className="btn-pill-primary"
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
              }}
            >
              Mulai Transaksi
              <span className="btn-icon-wrapper">↗</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '8fr 4fr',
          gap: '24px',
        }}
        className="bento-grid-split"
      >
        {/* Sales Chart Simulation */}
        <div className="bezel-outer">
          <div className="bezel-inner" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 650 }}>
                Tren Penjualan (Simulasi Grafik Hari Ini)
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>IDR / 2 JAM</span>
            </div>

            <div
              style={{
                height: '220px',
                width: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '18px',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {/* Hour points representation */}
              {(stats?.chartData || [
                { label: '08:00', val: 5, amount: 0 },
                { label: '10:00', val: 5, amount: 0 },
                { label: '12:00', val: 5, amount: 0 },
                { label: '14:00', val: 5, amount: 0 },
                { label: '16:00', val: 5, amount: 0 },
                { label: '18:00', val: 5, amount: 0 },
                { label: '20:00', val: 5, amount: 0 },
                { label: '22:00', val: 5, amount: 0 },
              ]).map((pt, idx) => {
                const isPositive = pt.amount > 0;
                return (
                  <div
                    key={idx}
                    title={isPositive ? `Penjualan: ${formatCurrency(pt.amount)}` : 'Tidak ada penjualan'}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        style={{
                          width: '100%',
                          background: isPositive
                            ? 'linear-gradient(to top, var(--primary), var(--primary-hover))'
                            : 'rgba(255,255,255,0.03)',
                          height: `${pt.val}%`,
                          borderRadius: '8px 8px 0 0',
                          boxShadow: isPositive ? '0 4px 20px var(--primary-glow)' : 'none',
                          transition: 'height var(--transition-normal), background var(--transition-fast)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {pt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Popular Payment Methods */}
        <div className="bezel-outer">
          <div className="bezel-inner">
            <h3 style={{ fontSize: '18px', fontWeight: 650, marginBottom: '28px' }}>
              Metode Pembayaran
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { id: 'cash', label: 'Tunai (Cash)', color: '#10b981' },
                { id: 'static_qris', label: 'QRIS Statis', color: '#6366f1' },
                { id: 'dynamic_qris', label: 'QRIS Dinamis', color: '#8b5cf6' },
                { id: 'ewallet', label: 'E-Wallet', color: '#ec4899' },
                { id: 'debit_credit', label: 'Kartu Debit/Kredit', color: '#f59e0b' },
              ].map((method) => {
                const amount = stats?.paymentMethods[method.id] || 0;
                const total = Object.values(stats?.paymentMethods || {}).reduce((s, a) => s + a, 0) || 1;
                const percentage = Math.round((amount / total) * 100);

                return (
                  <div key={method.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{method.label}</span>
                      <span style={{ fontWeight: '700', color: '#ffffff' }}>{formatCurrency(amount)} ({percentage}%)</span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.02)',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: method.color,
                          width: `${percentage}%`,
                          boxShadow: `0 0 8px ${method.color}`,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bezel-outer">
        <div className="bezel-inner" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 650, marginBottom: '20px' }}>
            Transaksi Terakhir (Hari Ini)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-premium" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nomor Struk</th>
                  <th>Meja</th>
                  <th>Waktu</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Belum ada transaksi hari ini.
                    </td>
                  </tr>
                ) : (
                  stats?.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: '600', color: '#ffffff' }}>
                        {order.receiptNumber}
                      </td>
                      <td style={{ fontWeight: '550' }}>Meja {order.tableNumber || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.15)',
                            color: 'var(--success)',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.02em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span className="status-badge-pulse" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--success)', color: 'var(--success)' }} />
                          LUNAS
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>
                        {formatCurrency(Number(order.grandTotal))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
