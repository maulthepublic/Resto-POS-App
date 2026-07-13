import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalFinanceLedger } from '../db/localSchema';
import { useNetworkStore } from '../store/networkStore';
import { useAuthStore } from '../store/authStore';

export function Keuangan() {
  const [activeSubTab, setActiveSubTab] = useState<'cashbook' | 'reconciliation'>('cashbook');
  const { enqueueMutation } = useNetworkStore();
  const { currentUser } = useAuthStore();

  // Queries
  const ledger = useLiveQuery(() => db.financeLedger.toArray()) || [];
  const rawMaterials = useLiveQuery(() => db.rawMaterials.toArray()) || [];

  // Cashbook Form states
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [ledgerType, setLedgerType] = useState<'income' | 'expense'>('expense');
  const [ledgerCategory, setLedgerCategory] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDesc, setLedgerDesc] = useState('');

  // Stock Opname Form states
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [physicalQty, setPhysicalQty] = useState('');
  const [opnameNote, setOpnameNote] = useState('');
  const [reconReport, setReconReport] = useState<any | null>(null);

  // 1. Save Cashbook Entry
  const handleSaveLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerCategory || !ledgerAmount) return;

    try {
      const id = `ledger-${Date.now()}`;
      const ledgerData: LocalFinanceLedger = {
        id,
        type: ledgerType,
        category: ledgerCategory,
        amount: Number(ledgerAmount),
        description: ledgerDesc,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id,
        syncStatus: 'pending',
      };

      await db.financeLedger.add(ledgerData);
      await enqueueMutation('financeLedger', id, 'insert', ledgerData);

      setShowLedgerForm(false);
      setLedgerCategory('');
      setLedgerAmount('');
      setLedgerDesc('');
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Perform Stock Reconciliation (Audit)
  const handleCalculateReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || !physicalQty) return;

    const material = rawMaterials.find((m) => m.id === selectedMaterialId);
    if (!material) return;

    const actual = Number(physicalQty);
    const expected = Number(material.currentQuantity);
    const variance = actual - expected; // Negative means leakage (stok hilang)
    const leakageCost = Math.abs(variance) * Number(material.unitCost);

    setReconReport({
      materialName: material.name,
      materialUnit: material.unit,
      unitCost: Number(material.unitCost),
      expectedQty: expected,
      physicalQty: actual,
      variance,
      leakageCost,
      note: opnameNote,
    });
  };

  // 3. Commit Opname adjustment to DB
  const handleCommitOpname = async () => {
    if (!reconReport || !selectedMaterialId) return;

    try {
      // Update DB inventory quantity to match physical count
      await db.rawMaterials.update(selectedMaterialId, {
        currentQuantity: reconReport.physicalQty,
        updatedAt: new Date().toISOString(),
      });

      // Log movement correction
      const movementId = `stk-op-${Date.now()}`;
      await db.stockMovements.add({
        id: movementId,
        rawMaterialId: selectedMaterialId,
        movementType: 'opname_correction',
        quantityDelta: reconReport.variance,
        note: `Koreksi Opname: ${reconReport.note || 'Pencocokan fisik'}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id,
        syncStatus: 'pending',
      });

      // Record to sync queue
      await enqueueMutation('stockMovement', movementId, 'insert', {
        rawMaterialId: selectedMaterialId,
        movementType: 'opname_correction',
        quantityDelta: reconReport.variance,
        note: reconReport.note,
      });

      alert('Data stok fisik berhasil dikoreksi & disimpan!');
      setReconReport(null);
      setSelectedMaterialId('');
      setPhysicalQty('');
      setOpnameNote('');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan opname.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Calculations for Summary
  const cashbookTotalIncome = ledger.filter((l) => l.type === 'income').reduce((s, l) => s + l.amount, 0);
  const cashbookTotalExpense = ledger.filter((l) => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
  const netCash = cashbookTotalIncome - cashbookTotalExpense;

  return (
    <div className="page-shell page-keuangan" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Tab Island Navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div className="tab-island">
          {[
            { id: 'cashbook', label: 'Buku Kas Harian (Ledger)' },
            { id: 'reconciliation', label: 'Rekonsiliasi Stok vs Penjualan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`tab-island-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUBTAB: CASHBOOK */}
      {activeSubTab === 'cashbook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Summary Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }} className="bento-grid-split">
            <div className="bezel-outer">
              <div className="bezel-inner" style={{ padding: '20px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Pemasukan Kas</span>
                <h3 style={{ fontSize: '26px', color: 'var(--success)', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(cashbookTotalIncome)}</h3>
              </div>
            </div>
            <div className="bezel-outer">
              <div className="bezel-inner" style={{ padding: '20px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Pengeluaran Petty Cash</span>
                <h3 style={{ fontSize: '26px', color: 'var(--danger)', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(cashbookTotalExpense)}</h3>
              </div>
            </div>
            <div className="bezel-outer">
              <div className="bezel-inner" style={{ padding: '20px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Saldo Bersih Kas Kecil</span>
                <h3 style={{ fontSize: '26px', color: 'var(--primary-hover)', marginTop: '8px', fontWeight: 700 }}>{formatCurrency(netCash)}</h3>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 650 }}>Buku Kas Harian</h3>
            <button
              onClick={() => setShowLedgerForm(true)}
              className="btn-pill-primary"
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              + Catat Keuangan
            </button>
          </div>

          {/* Form Ledger entry */}
          {showLedgerForm && (
            <div className="bezel-outer">
              <div className="bezel-inner" style={{ padding: '24px' }}>
                <h4 style={{ marginBottom: '20px', fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Catat Transaksi Manual Kas</h4>
                <form onSubmit={handleSaveLedger} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Jenis Kas</label>
                    <select 
                      value={ledgerType} 
                      onChange={(e) => setLedgerType(e.target.value as any)} 
                      className="input-premium"
                      style={{
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '14px',
                        paddingRight: '36px'
                      }}
                    >
                      <option value="expense">Pengeluaran (Operasional)</option>
                      <option value="income">Pemasukan (Non-Penjualan)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Kategori</label>
                    <input type="text" placeholder="Contoh: Gas Elpiji, Es Batu, Parkir" value={ledgerCategory} onChange={(e) => setLedgerCategory(e.target.value)} className="input-premium" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nominal (Rp)</label>
                    <input type="number" placeholder="Nominal Rp" value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} className="input-premium" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Catatan</label>
                    <input type="text" placeholder="Keterangan tambahan" value={ledgerDesc} onChange={(e) => setLedgerDesc(e.target.value)} className="input-premium" />
                  </div>
                  <div style={{ gridColumn: 'span 4', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowLedgerForm(false)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      Batal
                    </button>
                    <button type="submit" className="btn-pill-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>Simpan Keuangan</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* List of cash movements */}
          <div className="bezel-outer">
            <div className="bezel-inner" style={{ padding: '20px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-premium" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Kategori</th>
                      <th>Keterangan</th>
                      <th>Jenis</th>
                      <th style={{ textAlign: 'right' }}>Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          Belum ada catatan keuangan manual.
                        </td>
                      </tr>
                    ) : (
                      ledger.map((item) => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {new Date(item.occurredAt).toLocaleString('id-ID')}
                          </td>
                          <td style={{ fontWeight: '600', color: '#ffffff' }}>{item.category}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{item.description || '-'}</td>
                          <td>
                            <span
                              style={{
                                backgroundColor: item.type === 'income' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                border: item.type === 'income' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                                color: item.type === 'income' ? 'var(--success)' : 'var(--danger)',
                                padding: '4px 10px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span className="status-badge-pulse" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: item.type === 'income' ? 'var(--success)' : 'var(--danger)', color: item.type === 'income' ? 'var(--success)' : 'var(--danger)' }} />
                              {item.type === 'income' ? 'MASUK' : 'KELUAR'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: item.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
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
      )}

      {/* SUBTAB: RECONCILIATION */}
      {activeSubTab === 'reconciliation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="bento-grid-split">
          
          {/* Opname Calculator Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 650, color: '#ffffff' }}>Stock Opname & Deteksi Kebocoran</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '4px' }}>
                Bandingkan jumlah stok teoritis yang dihitung otomatis oleh sistem kasir dengan hitungan fisik riil di gudang/dapur.
              </p>
            </div>

            <div className="bezel-outer">
              <div className="bezel-inner" style={{ padding: '24px' }}>
                <form onSubmit={handleCalculateReconciliation} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Pilih Bahan Baku</label>
                    <select 
                      value={selectedMaterialId} 
                      onChange={(e) => setSelectedMaterialId(e.target.value)} 
                      className="input-premium"
                      style={{
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '14px',
                        paddingRight: '36px'
                      }}
                    >
                      <option value="">-- Pilih Bahan Baku --</option>
                      {rawMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Stok Sistem: {Number(m.currentQuantity).toFixed(2)} {m.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Jumlah Fisik Terhitung Riil</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="Masukkan stok fisik di resto..."
                        value={physicalQty}
                        onChange={(e) => setPhysicalQty(e.target.value)}
                        className="input-premium"
                        style={{ flex: 1 }}
                      />
                      <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '10px 14px', borderRadius: '14px' }}>
                        {rawMaterials.find((m) => m.id === selectedMaterialId)?.unit || '-'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Catatan Opname</label>
                    <input
                      type="text"
                      placeholder="Sebab selisih (misal: pecah, busuk, tumpah)..."
                      value={opnameNote}
                      onChange={(e) => setOpnameNote(e.target.value)}
                      className="input-premium"
                    />
                  </div>

                  <button type="submit" className="btn-pill-primary" style={{ width: '100%', padding: '12px', fontSize: '13.5px', marginTop: '6px' }}>
                    Audit Bandingkan Selisih
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Reconciliation Audit Results Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {reconReport ? (
              <div className="bezel-outer" style={{ animation: 'premium-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                <div className="bezel-inner" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <h4 style={{ color: 'var(--primary-hover)', fontSize: '15px', fontWeight: 700 }}>
                      Hasil Audit Selisih Stok
                    </h4>
                    <span className="badge-eyebrow">AUDIT REPORT</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13.5px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', fontWeight: 600 }}>Nama Bahan Baku</span>
                      <strong style={{ color: '#ffffff' }}>{reconReport.materialName}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', fontWeight: 600 }}>Harga Beli Satuan</span>
                      <strong style={{ color: '#ffffff' }}>{formatCurrency(reconReport.unitCost)} / {reconReport.materialUnit}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', fontWeight: 600 }}>Stok Sistem (Teoritis)</span>
                      <strong style={{ color: '#ffffff' }}>{reconReport.expectedQty.toFixed(3)} {reconReport.materialUnit}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', fontWeight: 600 }}>Stok Fisik (Opname)</span>
                      <strong style={{ color: '#ffffff' }}>{reconReport.physicalQty.toFixed(3)} {reconReport.materialUnit}</strong>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: reconReport.variance < 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                      border: `1px solid ${reconReport.variance < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`,
                      borderLeft: `4px solid ${reconReport.variance < 0 ? 'var(--danger)' : 'var(--success)'}`,
                      padding: '16px',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: '700', color: reconReport.variance < 0 ? 'var(--danger)' : 'var(--success)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {reconReport.variance < 0 ? 'TERJADI KEBOCORAN / SELISIH KURANG' : 'SELISIH LEBIH / SURPLUS STOK'}
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: '750', color: '#ffffff' }}>
                      Selisih: {reconReport.variance.toFixed(3)} {reconReport.materialUnit}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Potensi Kebocoran Keuangan: <strong style={{ color: reconReport.variance < 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(reconReport.leakageCost)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <button 
                      onClick={() => setReconReport(null)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      Batal
                    </button>
                    <button onClick={handleCommitOpname} className="btn-pill-primary" style={{ background: 'var(--success)', padding: '10px 20px', fontSize: '13px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                      Sesuaikan Stok Sistem
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }}>
                Silakan pilih bahan baku dan masukkan<br />jumlah fisik untuk melihat laporan audit selisih.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
