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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Mini Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {[
          { id: 'cashbook', label: 'Buku Kas Harian (Ledger)' },
          { id: 'reconciliation', label: 'Rekonsiliasi Stok vs Penjualan (v1.1)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              background: activeSubTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeSubTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: activeSubTab === tab.id ? '600' : '400',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB: CASHBOOK */}
      {activeSubTab === 'cashbook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Pemasukan Kas</span>
              <h3 style={{ fontSize: '24px', color: 'var(--success)' }}>{formatCurrency(cashbookTotalIncome)}</h3>
            </div>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Pengeluaran Petty Cash</span>
              <h3 style={{ fontSize: '24px', color: 'var(--danger)' }}>{formatCurrency(cashbookTotalExpense)}</h3>
            </div>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Saldo Bersih Kas Kecil</span>
              <h3 style={{ fontSize: '24px', color: 'var(--primary)' }}>{formatCurrency(netCash)}</h3>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Buku Kas Harian</h3>
            <button
              onClick={() => setShowLedgerForm(true)}
              style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Catat Keuangan
            </button>
          </div>

          {/* Form Ledger entry */}
          {showLedgerForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>Catat Transaksi Manual Kas</h4>
              <form onSubmit={handleSaveLedger} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px' }}>Jenis Kas</label>
                  <select value={ledgerType} onChange={(e) => setLedgerType(e.target.value as any)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }}>
                    <option value="expense">Pengeluaran (Biaya/Operasional)</option>
                    <option value="income">Pemasukan (Non-Penjualan)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px' }}>Kategori</label>
                  <input type="text" placeholder="Contoh: Gas Elpiji, Es Batu, Parkir" value={ledgerCategory} onChange={(e) => setLedgerCategory(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px' }}>Nominal (Rp)</label>
                  <input type="number" placeholder="Nominal Rp" value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px' }}>Catatan</label>
                  <input type="text" placeholder="Keterangan tambahan" value={ledgerDesc} onChange={(e) => setLedgerDesc(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ gridColumn: 'span 4', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowLedgerForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>Simpan Keuangan</button>
                </div>
              </form>
            </div>
          )}

          {/* List of cash movements */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>Waktu</th>
                <th style={{ padding: '12px 8px' }}>Kategori</th>
                <th style={{ padding: '12px 8px' }}>Keterangan</th>
                <th style={{ padding: '12px 8px' }}>Jenis</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                    {new Date(item.occurredAt).toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{item.category}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{item.description || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span
                      style={{
                        backgroundColor: item.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: item.type === 'income' ? 'var(--success)' : 'var(--danger)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      {item.type === 'income' ? 'MASUK' : 'KELUAR'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: item.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      )}

      {/* SUBTAB: RECONCILIATION */}
      {activeSubTab === 'reconciliation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          {/* Opname Calculator Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3>Stock Opname & Deteksi Kebocoran</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Bandingkan jumlah stok teoritis yang dihitung otomatis oleh sistem kasir dengan hitungan fisik riil di gudang/dapur.
              </p>
            </div>

            <form onSubmit={handleCalculateReconciliation} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px' }}>Pilih Bahan Baku</label>
                <select value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}>
                  <option value="">-- Pilih Bahan Baku --</option>
                  {rawMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Stok Sistem: {Number(m.currentQuantity).toFixed(2)} {m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px' }}>Jumlah Fisik Terhitung Riil</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Masukkan stok fisik di resto..."
                    value={physicalQty}
                    onChange={(e) => setPhysicalQty(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>
                    {rawMaterials.find((m) => m.id === selectedMaterialId)?.unit || ''}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px' }}>Catatan Opname</label>
                <input
                  type="text"
                  placeholder="Sebab selisih (misal: pecah, busuk, tumpah)..."
                  value={opnameNote}
                  onChange={(e) => setOpnameNote(e.target.value)}
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                />
              </div>

              <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' }}>
                Audit Bandingkan Selisih
              </button>
            </form>
          </div>

          {/* Reconciliation Audit Results Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {reconReport ? (
              <div
                style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  Hasil Audit Selisih Stok
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px' }}>Nama Bahan Baku</span>
                    <strong>{reconReport.materialName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px' }}>Harga Beli Satuan</span>
                    <strong>{formatCurrency(reconReport.unitCost)} / {reconReport.materialUnit}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px' }}>Stok Sistem (Teoritis)</span>
                    <strong>{reconReport.expectedQty.toFixed(3)} {reconReport.materialUnit}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px' }}>Stok Fisik (Opname)</span>
                    <strong>{reconReport.physicalQty.toFixed(3)} {reconReport.materialUnit}</strong>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: reconReport.variance < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderLeft: `4px solid ${reconReport.variance < 0 ? 'var(--danger)' : 'var(--success)'}`,
                    padding: '16px',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: '500', color: reconReport.variance < 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {reconReport.variance < 0 ? 'TERJADI KEBOCORAN / SELISIH KURANG' : 'SELISIH LEBIH / SURPLUS STOK'}
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: '700' }}>
                    Selisih: {reconReport.variance.toFixed(3)} {reconReport.materialUnit}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    Potensi Kebocoran Keuangan: <strong>{formatCurrency(reconReport.leakageCost)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button onClick={() => setReconReport(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Batal
                  </button>
                  <button onClick={handleCommitOpname} style={{ background: 'var(--success)', color: 'var(--text-primary)', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}>
                    Koreksi & Sesuaikan Stok Sistem
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
                Silakan pilih bahan baku dan masukkan<br />jumlah fisik untuk melihat laporan audit selisih.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
