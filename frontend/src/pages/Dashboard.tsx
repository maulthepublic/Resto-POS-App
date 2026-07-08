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
    const todayOrders = orders.filter((o) => new Date(o.createdAt) >= today && o.status === 'paid');

    const subtotalSales = todayOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const receiptCount = todayOrders.length;

    // Payment methods popularities
    const payments = await db.payments.toArray();
    const todayPayments = payments.filter((p) => {
      const o = orders.find((ord) => ord.id === p.orderId);
      return o && new Date(o.createdAt) >= today && o.status === 'paid';
    });

    const paymentMethodsMap: Record<string, number> = {};
    todayPayments.forEach((p) => {
      paymentMethodsMap[p.method] = (paymentMethodsMap[p.method] || 0) + Number(p.amount);
    });

    // Formulate recent orders
    const recent = orders
      .filter((o) => o.status === 'paid')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);

    return {
      totalRevenue: subtotalSales,
      receipts: receiptCount,
      paymentMethods: paymentMethodsMap,
      recentOrders: recent,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Card Revenue */}
        <div
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Pendapatan Hari Ini
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              color: 'var(--success)',
            }}
          >
            {formatCurrency(stats?.totalRevenue || 0)}
          </h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Terhitung dari transaksi lokal sukses hari ini
          </span>
        </div>

        {/* Card Receipts */}
        <div
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Jumlah Struk Tercetak
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              color: 'var(--primary)',
            }}
          >
            {stats?.receipts || 0} Struk
          </h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Total pesanan berhasil diproses hari ini
          </span>
        </div>

        {/* Quick Access Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--bg-card), var(--primary-glow))',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>
              Akses Kasir Cepat
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              Mulai mencatat transaksi baru segera.
            </p>
          </div>
          <button
            onClick={onNavigateToKasir}
            style={{
              background: 'var(--primary)',
              color: 'var(--text-primary)',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px var(--primary-glow)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary)')}
          >
            Mulai Transaksi
          </button>
        </div>
      </div>

      {/* Analytics Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
        }}
      >
        {/* Sales Chart Simulation */}
        <div
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h3 style={{ fontSize: '18px', marginBottom: '24px' }}>
            Tren Penjualan (Simulasi Grafik Hari Ini)
          </h3>
          <div
            style={{
              height: '200px',
              width: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '16px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            {/* Hour points representation using SVG or styled divs */}
            {[
              { label: '08:00', val: 10 },
              { label: '10:00', val: 30 },
              { label: '12:00', val: 90 }, // Peak lunch hour
              { label: '14:00', val: 40 },
              { label: '16:00', val: 25 },
              { label: '18:00', val: 75 }, // Dinner hour
              { label: '20:00', val: 95 }, // Peak dinner
              { label: '22:00', val: 15 },
            ].map((pt, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--primary)',
                    height: `${pt.val}%`,
                    borderRadius: '4px 4px 0 0',
                    boxShadow: '0 4px 10px var(--primary-glow)',
                    transition: 'height 0.5s ease',
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {pt.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Payment Methods */}
        <div
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h3 style={{ fontSize: '18px', marginBottom: '24px' }}>
            Metode Pembayaran
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <div key={method.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{method.label}</span>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(amount)} ({percentage}%)</span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: method.color,
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>
          Transaksi Terakhir (Hari Ini)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 8px', fontSize: '13px' }}>Nomor Struk</th>
              <th style={{ padding: '12px 8px', fontSize: '13px' }}>Meja</th>
              <th style={{ padding: '12px 8px', fontSize: '13px' }}>Waktu</th>
              <th style={{ padding: '12px 8px', fontSize: '13px' }}>Status</th>
              <th style={{ padding: '12px 8px', fontSize: '13px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {stats?.recentOrders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada transaksi hari ini.
                </td>
              </tr>
            ) : (
              stats?.recentOrders.map((order) => (
                <tr
                  key={order.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    fontSize: '14px',
                  }}
                >
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>
                    {order.receiptNumber}
                  </td>
                  <td style={{ padding: '12px 8px' }}>{order.tableNumber || '-'}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                    {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--success)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      LUNAS
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                    {formatCurrency(Number(order.grandTotal))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
