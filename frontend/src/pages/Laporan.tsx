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

    const filteredOrders = orders.filter((o) => new Date(o.createdAt) >= minDate && o.status === 'paid');
    
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
      if (o && new Date(o.createdAt) >= minDate && o.status === 'paid') {
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

  const handleExport = () => {
    alert('Simulasi ekspor laporan berhasil! Berkas PDF / Spreadsheet siap diunduh.');
  };

  if (!reportData) return <div style={{ color: 'var(--text-muted)' }}>Memuat laporan...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Filters & Export Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Laporan & Analisis Finansial</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Pantau ringkasan margin keuntungan kotor dan rekapitulasi harian Z-Report.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            value={filterRange}
            onChange={(e) => setFilterRange(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="today">Hari Ini</option>
            <option value="week">7 Hari Terakhir</option>
            <option value="month">30 Hari Terakhir</option>
          </select>

          <button
            onClick={handleExport}
            style={{
              background: 'var(--primary)',
              color: 'var(--text-primary)',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Ekspor Laporan (PDF/Excel)
          </button>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Pendapatan Kotor</span>
          <h3 style={{ fontSize: '24px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(reportData.grossSales)}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dari {reportData.ordersCount} transaksi</span>
        </div>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total HPP Menu Terjual</span>
          <h3 style={{ fontSize: '24px', color: 'var(--warning)', marginTop: '4px' }}>{formatCurrency(reportData.totalHpp)}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HPP teoritis berdasarkan resep BOM</span>
        </div>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Biaya Operasional</span>
          <h3 style={{ fontSize: '24px', color: 'var(--danger)', marginTop: '4px' }}>{formatCurrency(reportData.manualExpenses)}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kas keluar petty cash</span>
        </div>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', background: 'linear-gradient(135deg, var(--bg-card), var(--primary-glow))' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Estimasi Profit Bersih</span>
          <h3 style={{ fontSize: '24px', color: 'var(--success)', marginTop: '4px' }}>{formatCurrency(reportData.netProfitMargin)}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-primary)', opacity: 0.7 }}>Revenue - HPP - Petty Cash</span>
        </div>
      </div>

      {/* Margin and Payment Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        
        {/* Margin Analysis card */}
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Ringkasan Margin Kotor Harian</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span>Total Penjualan Bersih:</span>
              <strong style={{ color: 'var(--success)' }}>{formatCurrency(reportData.grossSales - reportData.taxCollected)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span>Estimasi Beban Bahan Baku (HPP):</span>
              <strong style={{ color: 'var(--warning)' }}>-{formatCurrency(reportData.totalHpp)}</strong>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
            
            {/* Profit Margin Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Margin Keuntungan Kotor Proyeksi</span>
                <h4 style={{ fontSize: '22px', color: 'var(--primary)' }}>
                  {reportData.grossSales > 0
                    ? (((reportData.grossSales - reportData.totalHpp) / reportData.grossSales) * 100).toFixed(1)
                    : '0.0'}%
                </h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Laba Kotor</span>
                <h4 style={{ fontSize: '22px', color: 'var(--success)' }}>
                  {formatCurrency(reportData.grossSales - reportData.totalHpp)}
                </h4>
              </div>
            </div>
          </div>
        </div>

        {/* Z-Report payment details */}
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Z-Report Rekonsiliasi Kas & QRIS</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Uang Tunai di Laci Kasir:</span>
              <strong>{formatCurrency(reportData.paymentMethods.cash)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Uang Masuk QRIS Statis:</span>
              <strong>{formatCurrency(reportData.paymentMethods.static_qris)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Uang Masuk QRIS Dinamis:</span>
              <strong>{formatCurrency(reportData.paymentMethods.dynamic_qris)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>E-Wallet / EDC Debit / Kartu:</span>
              <strong>{formatCurrency(reportData.paymentMethods.ewallet + reportData.paymentMethods.debit_credit)}</strong>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
              <span>Total Uang Masuk Bersih (Nett):</span>
              <span>{formatCurrency(reportData.grossSales)}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
