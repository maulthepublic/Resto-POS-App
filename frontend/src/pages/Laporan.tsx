import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/localSchema';

export function Laporan() {
  const [filterRange, setFilterRange] = useState('today');

  // Queries
  const reportData = useLiveQuery(async () => {
    const orders = await db.orders.toArray();
    const orderItems = await db.orderItems.toArray();
    const recipes = await db.recipes.toArray();
    const rawMaterials = await db.rawMaterials.toArray();
    const payments = await db.payments.toArray();
    const ledgers = await db.financeLedger.toArray();

    // Filter date ranges
    const now = new Date();
    let minDate = new Date();
    minDate.setHours(0, 0, 0, 0);

    if (filterRange === 'week') {
      minDate.setDate(now.getDate() - 7);
    } else if (filterRange === 'month') {
      minDate.setMonth(now.getMonth() - 1);
    }

    const filteredOrders = orders.filter(
      (o) =>
        new Date(o.createdAt) >= minDate &&
        ['paid', 'cooking', 'ready', 'served'].includes(o.status)
    );
    
    // Revenue calculations
    const grossSales = filteredOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const taxCollected = filteredOrders.reduce((sum, o) => sum + Number(o.taxTotal), 0);
    const discountGranted = filteredOrders.reduce((sum, o) => sum + Number(o.discountTotal), 0);

    // HPP / COGS calculation for all sold items
    let totalHpp = 0;
    filteredOrders.forEach((ord) => {
      const items = orderItems.filter((i) => i.orderId === ord.id);
      items.forEach((item) => {
        // Calculate HPP of item
        const itemRecipes = recipes.filter((r) => r.menuItemId === item.menuItemId);
        let itemHpp = 0;
        itemRecipes.forEach((rec) => {
          const mat = rawMaterials.find((m) => m.id === rec.rawMaterialId);
          if (mat) {
            itemHpp += Number(mat.unitCost) * Number(rec.quantity);
          }
        });
        totalHpp += itemHpp * item.quantity;
      });
    });

    // Payment Methods breakdown
    const paymentMethods: Record<string, number> = {
      cash: 0,
      static_qris: 0,
      dynamic_qris: 0,
      ewallet: 0,
      debit_credit: 0,
    };
    payments.forEach((p) => {
      const o = orders.find((ord) => ord.id === p.orderId);
      if (
        o &&
        new Date(o.createdAt) >= minDate &&
        ['paid', 'cooking', 'ready', 'served'].includes(o.status)
      ) {
        paymentMethods[p.method] = (paymentMethods[p.method] || 0) + Number(p.amount);
      }
    });

    // Finance manual entries during the period
    const periodLedgers = ledgers.filter((l) => new Date(l.occurredAt) >= minDate);
    const manualExpenses = periodLedgers.filter((l) => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
    const manualIncomes = periodLedgers.filter((l) => l.type === 'income').reduce((s, l) => s + l.amount, 0);

    return {
      ordersCount: filteredOrders.length,
      grossSales,
      taxCollected,
      discountGranted,
      totalHpp,
      netProfitMargin: grossSales - totalHpp - manualExpenses + manualIncomes,
      paymentMethods,
      manualExpenses,
      manualIncomes,
    };
  }, [filterRange]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExport = async () => {
    if (!reportData) {
      alert('Data laporan belum siap.');
      return;
    }
    try {
      const orders = await db.orders.toArray();
      const payments = await db.payments.toArray();

      const now = new Date();
      let minDate = new Date();
      minDate.setHours(0, 0, 0, 0);

      if (filterRange === 'week') {
        minDate.setDate(now.getDate() - 7);
      } else if (filterRange === 'month') {
        minDate.setMonth(now.getMonth() - 1);
      }

      const activeOrders = orders.filter(
        (o) =>
          new Date(o.createdAt) >= minDate &&
          ['paid', 'cooking', 'ready', 'served'].includes(o.status)
      );

      let csvContent = '\uFEFF'; // Add UTF-8 BOM so Excel opens it with correct encoding
      csvContent += 'LAPORAN REKAPITULASI PENJUALAN RESTO\n';
      csvContent += `Periode;${filterRange === 'today' ? 'Hari Ini' : filterRange === 'week' ? '7 Hari Terakhir' : '30 Hari Terakhir'}\n`;
      csvContent += `Tanggal Cetak;${new Date().toLocaleString('id-ID')}\n\n`;

      csvContent += 'RINGKASAN KINERJA\n';
      csvContent += `Total Transaksi;${reportData.ordersCount}\n`;
      csvContent += `Pendapatan Kotor;${formatCurrency(reportData.grossSales)}\n`;
      csvContent += `Total HPP Bahan Baku;${formatCurrency(reportData.totalHpp)}\n`;
      csvContent += `Biaya Operasional (Petty Cash);${formatCurrency(reportData.manualExpenses)}\n`;
      csvContent += `Estimasi Keuntungan Bersih;${formatCurrency(reportData.netProfitMargin)}\n\n`;

      csvContent += 'PEMBAGIAN PEMBAYARAN\n';
      csvContent += `Tunai (Cash);${formatCurrency(reportData.paymentMethods.cash)}\n`;
      csvContent += `QRIS Statis;${formatCurrency(reportData.paymentMethods.static_qris)}\n`;
      csvContent += `QRIS Dinamis;${formatCurrency(reportData.paymentMethods.dynamic_qris)}\n`;
      csvContent += `Lain-lain / Kartu;${formatCurrency(reportData.paymentMethods.ewallet + reportData.paymentMethods.debit_credit)}\n\n`;

      csvContent += 'DAFTAR DETAIL TRANSAKSI\n';
      csvContent += 'Tanggal/Waktu;Nomor Resi;Meja;Status Pesanan;Total Pembayaran;Metode\n';

      activeOrders.forEach((o) => {
        const pay = payments.find((p) => p.orderId === o.id);
        const tDate = new Date(o.createdAt).toLocaleString('id-ID');
        csvContent += `${tDate};${o.receiptNumber};${o.tableNumber || 'Meja Umum'};${o.status.toUpperCase()};${o.grandTotal};${pay ? pay.method.toUpperCase() : 'CASH'}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_ZReport_${filterRange}_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat ekspor laporan.');
    }
  };

  if (!reportData) return <div style={{ color: 'var(--text-muted)' }}>Memuat laporan...</div>;

  return (
    <div className="page-shell page-laporan" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Filters & Export Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="bento-grid-split">
        <div>
          <div className="badge-eyebrow" style={{ marginBottom: '8px' }}>Z REPORT</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>Laporan & Analisis Finansial</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Pantau ringkasan margin keuntungan kotor dan rekapitulasi harian Z-Report.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={filterRange}
            onChange={(e) => setFilterRange(e.target.value)}
            className="input-premium"
            style={{
              width: '160px',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '14px',
              paddingRight: '36px'
            }}
          >
            <option value="today">Hari Ini</option>
            <option value="week">7 Hari Terakhir</option>
            <option value="month">30 Hari Terakhir</option>
          </select>

          <button
            onClick={handleExport}
            className="btn-pill-primary"
            style={{
              padding: '10px 20px',
              fontSize: '13px',
            }}
          >
            Ekspor Laporan (CSV)
            <span className="btn-icon-wrapper">↓</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '20px' 
        }}
        className="bento-grid-split"
      >
        <div className="bezel-outer">
          <div className="bezel-inner" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '128px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Pendapatan Kotor</span>
            <h3 style={{ fontSize: '24px', color: '#ffffff', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(reportData.grossSales)}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Dari {reportData.ordersCount} transaksi</span>
          </div>
        </div>
        <div className="bezel-outer">
          <div className="bezel-inner" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '128px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total HPP Menu Terjual</span>
            <h3 style={{ fontSize: '24px', color: 'var(--warning)', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(reportData.totalHpp)}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>HPP teoritis dari BOM resep</span>
          </div>
        </div>
        <div className="bezel-outer">
          <div className="bezel-inner" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '128px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Biaya Operasional</span>
            <h3 style={{ fontSize: '24px', color: 'var(--danger)', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(reportData.manualExpenses)}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Kas keluar petty cash</span>
          </div>
        </div>
        <div className="bezel-outer" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.01))', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <div className="bezel-inner" style={{ padding: '20px', background: 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '128px', border: 'none' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estimasi Profit Bersih</span>
            <h3 style={{ fontSize: '24px', color: 'var(--success)', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(reportData.netProfitMargin)}</h3>
            <span style={{ fontSize: '11px', color: 'var(--success)', opacity: 0.8, marginTop: '4px', display: 'block' }}>Revenue - HPP - Petty Cash</span>
          </div>
        </div>
      </div>

      {/* Margin and Payment Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="bento-grid-split">
        
        {/* Margin Analysis card */}
        <div className="bezel-outer">
          <div className="bezel-inner" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#ffffff', marginBottom: '20px' }}>Ringkasan Margin Kotor</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Penjualan Bersih:</span>
                <strong style={{ color: '#ffffff' }}>{formatCurrency(reportData.grossSales - reportData.taxCollected)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Estimasi Beban Bahan Baku (HPP):</span>
                <strong style={{ color: 'var(--warning)' }}>-{formatCurrency(reportData.totalHpp)}</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
              
              {/* Profit Margin Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Margin Keuntungan Kotor Proyeksi</span>
                  <h4 style={{ fontSize: '22px', color: 'var(--primary-hover)', fontWeight: 750, marginTop: '4px' }}>
                    {reportData.grossSales > 0
                      ? (((reportData.grossSales - reportData.totalHpp) / reportData.grossSales) * 100).toFixed(1)
                      : '0.0'}%
                  </h4>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Laba Kotor</span>
                  <h4 style={{ fontSize: '22px', color: 'var(--success)', fontWeight: 750, marginTop: '4px' }}>
                    {formatCurrency(reportData.grossSales - reportData.totalHpp)}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Z-Report payment details */}
        <div className="bezel-outer">
          <div className="bezel-inner" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#ffffff', marginBottom: '20px' }}>Z-Report Rekonsiliasi Kas & QRIS</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uang Tunai di Laci Kasir:</span>
                <strong style={{ color: '#ffffff' }}>{formatCurrency(reportData.paymentMethods.cash)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uang Masuk QRIS Statis:</span>
                <strong style={{ color: '#ffffff' }}>{formatCurrency(reportData.paymentMethods.static_qris)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uang Masuk QRIS Dinamis:</span>
                <strong style={{ color: '#ffffff' }}>{formatCurrency(reportData.paymentMethods.dynamic_qris)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>E-Wallet / EDC Debit / Kartu:</span>
                <strong style={{ color: '#ffffff' }}>{formatCurrency(reportData.paymentMethods.ewallet + reportData.paymentMethods.debit_credit)}</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', color: 'var(--success)', paddingTop: '4px' }}>
                <span>Total Uang Masuk Bersih (Nett):</span>
                <span>{formatCurrency(reportData.grossSales)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
