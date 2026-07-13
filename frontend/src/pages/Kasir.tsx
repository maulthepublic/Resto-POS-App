import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalMenuItem, LocalVariant, LocalModifier } from '../db/localSchema';
import { useCartStore } from '../store/cartStore';
import { useNetworkStore } from '../store/networkStore';
import { useAuthStore } from '../store/authStore';

export function Kasir() {
  const { cartItems, addToCart, updateQuantity, clearCart, getTotals, discountPercent, setDiscount } = useCartStore();
  const { isOffline, enqueueMutation } = useNetworkStore();
  const { currentUser } = useAuthStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeItemConfig, setActiveItemConfig] = useState<LocalMenuItem | null>(null);
  
  // Customization Modal states
  const [chosenVariants, setChosenVariants] = useState<LocalVariant[]>([]);
  const [chosenModifiers, setChosenModifiers] = useState<LocalModifier[]>([]);
  const [itemNote, setItemNote] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  // Checkout states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'static_qris' | 'dynamic_qris' | 'ewallet' | 'debit_credit'>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  
  // Receipt printer simulation states
  const [printedReceipt, setPrintedReceipt] = useState<any | null>(null);

  // DB queries
  const categories = useLiveQuery(() => db.categories.toArray().then(c => c.filter(x => x.isActive))) || [];
  const allMenuItems = useLiveQuery(() => db.menuItems.toArray().then(items => items.filter(i => i.isActive))) || [];
  const variantGroups = useLiveQuery(() => db.variantGroups.toArray()) || [];
  const variants = useLiveQuery(() => db.variants.toArray().then(v => v.filter(x => x.isActive))) || [];
  const modifiers = useLiveQuery(() => db.modifiers.toArray().then(m => m.filter(x => x.isActive))) || [];

  // Filter products
  const filteredMenuItems = allMenuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleItemClick = (item: LocalMenuItem) => {
    // Check if this item has any variants
    const groups = variantGroups.filter((g) => g.menuItemId === item.id);
    if (groups.length > 0) {
      // Show customisation modal
      setActiveItemConfig(item);
      setChosenVariants([]);
      setChosenModifiers([]);
      setItemNote('');
      setItemQuantity(1);
    } else {
      // Add directly
      addToCart(item, [], [], 1);
    }
  };

  const handleCustomizationSubmit = () => {
    if (activeItemConfig) {
      // Validation: verify required variants are selected
      const groups = variantGroups.filter((g) => g.menuItemId === activeItemConfig.id && g.isRequired);
      for (const grp of groups) {
        const hasChoice = chosenVariants.some((v) => v.variantGroupId === grp.id);
        if (!hasChoice) {
          alert(`Pilihan variant "${grp.name}" wajib dipilih.`);
          return;
        }
      }
      addToCart(activeItemConfig, chosenVariants, chosenModifiers, itemQuantity, itemNote);
      setActiveItemConfig(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const totals = getTotals();

  // Execute Checkout & Stock Deduction
  const handleCheckoutSubmit = async () => {
    if (cartItems.length === 0) return;

    if (paymentMethod === 'cash' && Number(amountPaid) < totals.grandTotal) {
      alert('Uang yang dibayar kurang!');
      return;
    }

    try {
      const orderId = `ord-${Date.now()}`;
      const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;
      
      const newOrder = {
        id: orderId,
        deviceId: 'dev-resto-pos-tablet-01',
        receiptNumber,
        tableNumber: tableNumber || 'Meja Umum',
        status: 'paid' as const,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        paidAt: new Date().toISOString(),
        createdBy: currentUser?.id || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const,
      };

      // 1. Save Order locally
      await db.orders.add(newOrder);

      // 2. Save Order Items & Deduct stocks
      for (const item of cartItems) {
        const orderItemId = `ord-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await db.orderItems.add({
          id: orderItemId,
          orderId,
          menuItemId: item.menuItem.id,
          itemName: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          selectedVariants: item.selectedVariants,
          selectedModifiers: item.selectedModifiers,
          kitchenNote: item.kitchenNote,
        });

        // Query recipes for ingredient deduction
        const recipes = await db.recipes.where('menuItemId').equals(item.menuItem.id).toArray();
        
        for (const rec of recipes) {
          const mat = await db.rawMaterials.get(rec.rawMaterialId);
          if (mat) {
            const deductionQty = rec.quantity * item.quantity;
            const nextQty = Math.max(0, Number(mat.currentQuantity) - deductionQty);
            
            // Update raw material quantity
            await db.rawMaterials.update(mat.id, {
              currentQuantity: nextQty,
              updatedAt: new Date().toISOString(),
            });

            // Add local stock movement log
            await db.stockMovements.add({
              id: `stk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              rawMaterialId: mat.id,
              orderId,
              movementType: 'sale_deduction',
              quantityDelta: -deductionQty,
              note: `Penjualan ${item.menuItem.name} x${item.quantity}`,
              createdAt: new Date().toISOString(),
              createdBy: currentUser?.id,
              syncStatus: 'pending',
            });
          }
        }
      }

      // 3. Save Payment
      const paymentId = `pay-${Date.now()}`;
      await db.payments.add({
        id: paymentId,
        orderId,
        method: paymentMethod,
        amount: totals.grandTotal,
        providerReference: paymentMethod !== 'cash' ? `REF-${Date.now()}` : undefined,
        isOffline,
        createdAt: new Date().toISOString(),
      });

      // 3.1 Save Finance Ledger record for automatically tracking POS sales income
      const ledgerId = `ledger-${Date.now()}`;
      const ledgerData = {
        id: ledgerId,
        orderId,
        type: 'income' as const,
        category: 'Penjualan POS',
        amount: totals.grandTotal,
        paymentMethod,
        description: `Penjualan POS #${receiptNumber} (${tableNumber || 'Meja Umum'})`,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || 'unknown',
        syncStatus: 'pending' as const,
      };
      await db.financeLedger.add(ledgerData);

      // 4. Record to sync queue (For Offline-First syncing)
      await enqueueMutation('order', orderId, 'insert', {
        order: newOrder,
        items: cartItems.map((c) => ({
          menuItemId: c.menuItem.id,
          itemName: c.menuItem.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          lineTotal: c.lineTotal,
          selectedVariants: c.selectedVariants,
          selectedModifiers: c.selectedModifiers,
          kitchenNote: c.kitchenNote,
        })),
        payment: {
          method: paymentMethod,
          amount: totals.grandTotal,
          isOffline,
        },
      });

      // 4.1 Enqueue Finance Ledger mutation for server synchronization
      await enqueueMutation('financeLedger', ledgerId, 'insert', ledgerData);

      // Show receipt simulation
      setPrintedReceipt({
        receiptNumber,
        tableNumber: tableNumber || 'Meja Umum',
        items: [...cartItems],
        totals: { ...totals },
        cashPaid: paymentMethod === 'cash' ? Number(amountPaid) : totals.grandTotal,
        paymentMethod,
        time: new Date().toLocaleTimeString('id-ID'),
        date: new Date().toLocaleDateString('id-ID'),
      });

      // Reset cart and checkout modal
      clearCart();
      setShowCheckoutModal(false);
      setTableNumber('');
      setAmountPaid('');
    } catch (err) {
      console.error(err);
      alert('Gagal memproses transaksi.');
    }
  };

  const handlePrintReceipt = () => {
    if (!printedReceipt) return;
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Struk - Resto POS</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: #000;
                padding: 10px;
                width: 280px;
                margin: 0;
              }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .dashed-line { border-bottom: 1px dashed #000; margin: 8px 0; }
              .flex-between { display: flex; justify-content: space-between; }
              .text-right { text-align: right; }
              @media print {
                @page { margin: 0; }
              }
            </style>
          </head>
          <body>
            <div class="center bold" style="font-size: 14px; margin-bottom: 4px;">RESTO POS APP v1.1</div>
            <div class="center" style="margin-bottom: 8px;">
              Ruko Kuliner Nusantara No. 12<br>Tangerang, Indonesia
            </div>
            <div>
              No: ${printedReceipt.receiptNumber}<br>
              Meja: ${printedReceipt.tableNumber}<br>
              Waktu: ${printedReceipt.date} ${printedReceipt.time}
            </div>
            <div class="dashed-line"></div>
            
            ${printedReceipt.items.map((item: any) => `
              <div style="margin-bottom: 6px;">
                <div class="flex-between">
                  <span>${item.menuItem.name}</span>
                  <span>${item.quantity}x</span>
                </div>
                ${item.selectedVariants.map((v: any) => `<div style="font-size: 10px; color: #555;">- ${v.name}</div>`).join('')}
                ${item.selectedModifiers.map((m: any) => `<div style="font-size: 10px; color: #555;">- ${m.name} (+${formatCurrency(Number(m.priceDelta))})</div>`).join('')}
                <div class="text-right bold">${formatCurrency(item.lineTotal)}</div>
              </div>
            `).join('')}

            <div class="dashed-line"></div>
            <div class="flex-between">
              <span>Subtotal:</span>
              <span>${formatCurrency(printedReceipt.totals.subtotal)}</span>
            </div>
            <div class="flex-between">
              <span>Diskon:</span>
              <span>-${formatCurrency(printedReceipt.totals.discountTotal)}</span>
            </div>
            <div class="flex-between">
              <span>Pajak (10%):</span>
              <span>${formatCurrency(printedReceipt.totals.taxTotal)}</span>
            </div>
            <div class="flex-between bold" style="font-size: 13px; margin: 4px 0;">
              <span>TOTAL AKHIR:</span>
              <span>${formatCurrency(printedReceipt.totals.grandTotal)}</span>
            </div>
            <div class="flex-between">
              <span>Bayar (${printedReceipt.paymentMethod.toUpperCase()}):</span>
              <span>${formatCurrency(printedReceipt.cashPaid)}</span>
            </div>
            ${printedReceipt.paymentMethod === 'cash' ? `
              <div class="flex-between bold">
                <span>Kembalian:</span>
                <span>${formatCurrency(printedReceipt.cashPaid - printedReceipt.totals.grandTotal)}</span>
              </div>
            ` : ''}
            <div class="dashed-line"></div>
            <div class="center" style="font-style: italic; margin-top: 8px;">Terima Kasih atas Kunjungan Anda!</div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="page-shell page-kasir" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: '24px', height: 'calc(100dvh - 166px)' }}>
      
      {/* Left Screen: Catalog and Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Search and Categories bar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Cari menu makanan atau minuman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-premium"
            style={{
              flex: 1,
            }}
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-premium"
            style={{
              width: '200px',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              backgroundSize: '16px',
              paddingRight: '40px',
            }}
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Products Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: '18px',
          }}
        >
          {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="bezel-outer interactive"
              style={{
                padding: '6px',
              }}
            >
              <div
                className="bezel-inner"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  minHeight: '144px',
                  background: 'rgba(10, 16, 30, 0.4)',
                }}
              >
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: '650', color: '#ffffff', marginBottom: '4px', letterSpacing: '-0.01em' }}>{item.name}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                    {item.description}
                  </p>
                </div>
                <span style={{ fontWeight: '700', color: 'var(--primary-hover)', fontSize: '16px' }}>
                  {formatCurrency(Number(item.basePrice))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Screen: Shopping Cart Sidebar */}
      <div
        className="bezel-outer"
        style={{
          padding: '6px',
        }}
      >
        <div
          className="bezel-inner"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px 18px',
            background: 'rgba(6, 10, 18, 0.75)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', fontSize: '17px', color: '#ffffff', fontWeight: 650 }}>
              Keranjang Belanja
            </h3>
            
            {cartItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', minHeight: '150px', lineHeight: 1.5 }}>
                Keranjang masih kosong.<br />Ketuk menu di sebelah kiri untuk memesan.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {cartItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '68%' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#ffffff' }}>{item.menuItem.name}</span>
                      
                      {/* Variants Info */}
                      {item.selectedVariants.map((v) => (
                        <span key={v.id} style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          ▪ {v.name}
                        </span>
                      ))}
                      {/* Modifiers Info */}
                      {item.selectedModifiers.map((m) => (
                        <span key={m.id} style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          + {m.name} <span style={{ color: 'var(--text-muted)' }}>(+{formatCurrency(Number(m.priceDelta))})</span>
                        </span>
                      ))}
                      
                      {item.kitchenNote && (
                        <span style={{ fontSize: '10.5px', color: 'var(--warning)', fontStyle: 'italic', fontWeight: 550 }}>
                          Note: {item.kitchenNote}
                        </span>
                      )}

                      <span style={{ fontSize: '12px', color: 'var(--primary-hover)', fontWeight: '700', marginTop: '2px' }}>
                        {formatCurrency(item.unitPrice)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '2px'
                      }}>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          style={{ 
                            width: '22px', 
                            height: '22px', 
                            borderRadius: '6px', 
                            background: 'rgba(255, 255, 255, 0.03)', 
                            border: 'none', 
                            color: '#ffffff', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '16px', textAlign: 'center', color: '#ffffff' }}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={{ 
                            width: '22px', 
                            height: '22px', 
                            borderRadius: '6px', 
                            background: 'rgba(255, 255, 255, 0.03)', 
                            border: 'none', 
                            color: '#ffffff', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff' }}>{formatCurrency(item.lineTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calculation Panel */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{formatCurrency(totals.subtotal)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', alignItems: 'center' }}>
              <span>Diskon (%):</span>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="input-premium"
                style={{ 
                  width: '64px', 
                  padding: '6px 8px', 
                  textAlign: 'center',
                  fontSize: '12px'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Pajak (10%):</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{formatCurrency(totals.taxTotal)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '17px', margin: '6px 0', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <span>TOTAL:</span>
              <span style={{ color: 'var(--success)' }}>{formatCurrency(totals.grandTotal)}</span>
            </div>

            <button
              onClick={() => setShowCheckoutModal(true)}
              disabled={cartItems.length === 0}
              className={cartItems.length === 0 ? "" : "btn-pill-primary"}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                background: cartItems.length === 0 ? 'rgba(255, 255, 255, 0.02)' : undefined,
                color: cartItems.length === 0 ? 'var(--text-muted)' : undefined,
                border: cartItems.length === 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: cartItems.length === 0 ? 'none' : undefined,
              }}
            >
              Bayar / Transaksi
              {cartItems.length > 0 && <span className="btn-icon-wrapper">↗</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 1. Item Customization Modal */}
      {activeItemConfig && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 3, 6, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="bezel-outer"
            style={{
              width: '100%',
              maxWidth: '500px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'premium-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <div
              className="bezel-inner"
              style={{
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                background: 'rgba(10, 16, 30, 0.75)',
              }}
            >
              <div>
                <div className="badge-eyebrow" style={{ marginBottom: '8px' }}>CUSTOMIZATION</div>
                <h3 style={{ fontSize: '20px', color: '#ffffff', fontWeight: 700 }}>Kustomisasi {activeItemConfig.name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pilih variasi dan tambahan menu</p>
              </div>

              {/* Render Variant Groups */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {variantGroups
                  .filter((g) => g.menuItemId === activeItemConfig.id)
                  .map((grp) => (
                    <div key={grp.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        {grp.name} {grp.isRequired && <span style={{ color: 'var(--danger)', fontSize: '11px', marginLeft: '4px' }}>*Wajib</span>}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {variants
                          .filter((v) => v.variantGroupId === grp.id)
                          .map((vari) => {
                            const isChosen = chosenVariants.some((v) => v.id === vari.id);
                            return (
                              <button
                                key={vari.id}
                                onClick={() => {
                                  // Since max_selected = 1 for simple variants
                                  const otherChosen = chosenVariants.filter((v) => v.variantGroupId !== grp.id);
                                  setChosenVariants([...otherChosen, vari]);
                                }}
                                style={{
                                  background: isChosen ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'rgba(255,255,255,0.02)',
                                  border: isChosen ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)',
                                  color: isChosen ? '#ffffff' : 'var(--text-secondary)',
                                  padding: '8px 16px',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  transition: 'all var(--transition-fast)',
                                  boxShadow: isChosen ? '0 4px 12px var(--primary-glow)' : 'none',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isChosen) {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isChosen) {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                                  }
                                }}
                              >
                                {vari.name} {Number(vari.priceDelta) !== 0 && `(+${formatCurrency(Number(vari.priceDelta))})`}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}

                {/* Modifiers (Optional toppings) */}
                {modifiers.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Tambahan (Topping)</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {modifiers.map((mod) => {
                        const isChosen = chosenModifiers.some((m) => m.id === mod.id);
                        return (
                          <button
                            key={mod.id}
                            onClick={() => {
                              if (isChosen) {
                                setChosenModifiers(chosenModifiers.filter((m) => m.id !== mod.id));
                              } else {
                                setChosenModifiers([...chosenModifiers, mod]);
                              }
                            }}
                            style={{
                              background: isChosen ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'rgba(255,255,255,0.02)',
                              border: isChosen ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)',
                              color: isChosen ? '#ffffff' : 'var(--text-secondary)',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all var(--transition-fast)',
                              boxShadow: isChosen ? '0 4px 12px var(--primary-glow)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isChosen) {
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isChosen) {
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                              }
                            }}
                          >
                            {mod.name} (+{formatCurrency(Number(mod.priceDelta))})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Catatan Dapur</span>
                  <input
                    type="text"
                    placeholder="Contoh: jangan pakai kol, extra kecap..."
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    className="input-premium"
                  />
                </div>
              </div>

              {/* Quantity Selector inside modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  padding: '4px'
                }}>
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px', 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      border: 'none', 
                      color: '#ffffff', 
                      cursor: 'pointer', 
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '15px', fontWeight: '700', minWidth: '24px', textAlign: 'center', color: '#ffffff' }}>{itemQuantity}</span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px', 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      border: 'none', 
                      color: '#ffffff', 
                      cursor: 'pointer', 
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    +
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setActiveItemConfig(null)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      padding: '10px 16px',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCustomizationSubmit}
                    className="btn-pill-primary"
                    style={{ 
                      padding: '10px 24px',
                      fontSize: '13px'
                    }}
                  >
                    Simpan Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Checkout Modal */}
      {showCheckoutModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 3, 6, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="bezel-outer"
            style={{
              width: '100%',
              maxWidth: '460px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'premium-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <div
              className="bezel-inner"
              style={{
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                background: 'rgba(10, 16, 30, 0.75)',
              }}
            >
              <div>
                <div className="badge-eyebrow" style={{ marginBottom: '8px' }}>CHECKOUT PROCESS</div>
                <h3 style={{ fontSize: '20px', color: '#ffffff', fontWeight: 700 }}>Pembayaran</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lengkapi rincian pesanan pelanggan</p>
              </div>

              {/* Table Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Nomor Meja / Keterangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Meja 05, Bungkus..."
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="input-premium"
                />
              </div>

              {/* Payment Method Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Pilih Metode Pembayaran</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { id: 'cash', label: 'Tunai (Cash)' },
                    { id: 'static_qris', label: 'QRIS Statis' },
                    { id: 'dynamic_qris', label: 'QRIS Dinamis', disabled: isOffline },
                    { id: 'ewallet', label: 'E-Wallet' },
                    { id: 'debit_credit', label: 'Debit / Kredit' },
                  ].map((m) => {
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        disabled={m.disabled}
                        onClick={() => setPaymentMethod(m.id as any)}
                        style={{
                          background: isSelected ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)',
                          color: m.disabled ? 'var(--text-muted)' : isSelected ? '#ffffff' : 'var(--text-secondary)',
                          padding: '10px',
                          borderRadius: '10px',
                          cursor: m.disabled ? 'not-allowed' : 'pointer',
                          opacity: m.disabled ? 0.35 : 1,
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all var(--transition-fast)',
                          boxShadow: isSelected ? '0 4px 12px var(--primary-glow)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected && !m.disabled) {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected && !m.disabled) {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                          }
                        }}
                      >
                        {m.label} {m.disabled && '(Offline)'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* If Cash, Enter amount */}
              {paymentMethod === 'cash' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Uang Diterima</label>
                  <input
                    type="number"
                    placeholder="Masukkan jumlah tunai..."
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="input-premium"
                    style={{
                      fontSize: '16px',
                      fontWeight: '700',
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {[totals.grandTotal, 20000, 50000, 100000].map((quick) => (
                      <button
                        key={quick}
                        onClick={() => setAmountPaid(String(Math.ceil(quick)))}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                          padding: '6px 12px',
                          fontSize: '11px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                      >
                        {formatCurrency(Math.ceil(quick))}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--text-secondary)', 
                    cursor: 'pointer', 
                    padding: '10px 16px',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  Batal
                </button>
                <button
                  onClick={handleCheckoutSubmit}
                  className="btn-pill-primary"
                  style={{
                    background: 'var(--success)',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                    padding: '10px 24px',
                    fontSize: '13px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--success)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.25)';
                  }}
                >
                  Bayar Lunas
                  <span className="btn-icon-wrapper" style={{ background: 'rgba(255,255,255,0.2)' }}>✓</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 3. Thermal Receipt Simulation Modal */}
      {printedReceipt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 3, 6, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 101,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="bezel-outer"
            style={{
              padding: '8px',
              animation: 'premium-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                color: '#1e293b',
                padding: '28px 24px',
                width: '320px',
                fontFamily: 'Courier New, Courier, monospace',
                fontSize: '12.5px',
                boxShadow: 'var(--shadow-lg)',
                borderRadius: 'calc(var(--radius-lg) - 8px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                lineHeight: 1.4,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: '#000000', marginBottom: '4px' }}>
                RESTO POS APP v1.1
              </div>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px', marginBottom: '8px', color: '#64748b' }}>
                Ruko Kuliner Nusantara No. 12<br />
                Tangerang, Indonesia
              </div>
              <div style={{ color: '#475569' }}>
                No: {printedReceipt.receiptNumber}<br />
                Meja: {printedReceipt.tableNumber}<br />
                Waktu: {printedReceipt.date} {printedReceipt.time}<br />
              </div>
              <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '4px', margin: '4px 0' }} />
              
              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {printedReceipt.items.map((item: any, idx: number) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: '#0f172a' }}>
                      <span>{item.menuItem.name}</span>
                      <span>{item.quantity}x</span>
                    </div>
                    {item.selectedVariants.map((v: any) => (
                      <div key={v.id} style={{ fontSize: '10.5px', color: '#64748b', paddingLeft: '8px' }}>
                        ▪ {v.name}
                      </div>
                    ))}
                    {item.selectedModifiers.map((m: any) => (
                      <div key={m.id} style={{ fontSize: '10.5px', color: '#64748b', paddingLeft: '8px' }}>
                        + {m.name} (+{formatCurrency(Number(m.priceDelta))})
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', fontWeight: '600', color: '#475569', fontSize: '12px' }}>
                      {formatCurrency(item.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '4px', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(printedReceipt.totals.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Diskon:</span>
                <span>-{formatCurrency(printedReceipt.totals.discountTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Pajak (10%):</span>
                <span>{formatCurrency(printedReceipt.totals.taxTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13.5px', margin: '6px 0', color: '#000000', borderTop: '1px dashed #94a3b8', paddingTop: '8px' }}>
                <span>TOTAL AKHIR:</span>
                <span>{formatCurrency(printedReceipt.totals.grandTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Bayar ({printedReceipt.paymentMethod.toUpperCase()}):</span>
                <span>{formatCurrency(printedReceipt.cashPaid)}</span>
              </div>
              {printedReceipt.paymentMethod === 'cash' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#0f172a' }}>
                  <span>Kembalian:</span>
                  <span>{formatCurrency(printedReceipt.cashPaid - printedReceipt.totals.grandTotal)}</span>
                </div>
              )}

              <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px', margin: '8px 0' }} />
              <div style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '4px', color: '#64748b' }}>
                Terima Kasih atas Kunjungan Anda!
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={handlePrintReceipt}
                  style={{
                    flex: 1,
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: '600',
                    fontSize: '12px',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                >
                  Cetak Struk
                </button>
                <button
                  onClick={() => setPrintedReceipt(null)}
                  style={{
                    flex: 1,
                    background: '#64748b',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: '600',
                    fontSize: '12px',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#475569'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#64748b'}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
