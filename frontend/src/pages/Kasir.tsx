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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', height: 'calc(100vh - 150px)' }}>
      
      {/* Left Screen: Catalog and Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Search and Categories bar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Cari menu makanan atau minuman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              cursor: 'pointer',
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{item.name}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.description}
                </p>
              </div>
              <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '16px' }}>
                {formatCurrency(Number(item.basePrice))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Screen: Shopping Cart Sidebar */}
      <div
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '20px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Keranjang Belanja</h3>
          
          {cartItems.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', minHeight: '150px' }}>
              Keranjang masih kosong.<br />Ketuk menu di sebelah kiri untuk memesan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cartItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.menuItem.name}</span>
                    
                    {/* Variants Info */}
                    {item.selectedVariants.map((v) => (
                      <span key={v.id} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ▪ {v.name}
                      </span>
                    ))}
                    {/* Modifiers Info */}
                    {item.selectedModifiers.map((m) => (
                      <span key={m.id} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        + {m.name} (+{formatCurrency(Number(m.priceDelta))})
                      </span>
                    ))}
                    
                    {item.kitchenNote && (
                      <span style={{ fontSize: '11px', color: 'var(--warning)', fontStyle: 'italic' }}>
                        Note: {item.kitchenNote}
                      </span>
                    )}

                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>
                      {formatCurrency(item.unitPrice)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        +
                      </button>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{formatCurrency(item.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calculation Panel */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', alignItems: 'center' }}>
            <span>Diskon (%):</span>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscount(Number(e.target.value))}
              style={{ width: '60px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>Pajak (10%):</span>
            <span>{formatCurrency(totals.taxTotal)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', margin: '8px 0' }}>
            <span>TOTAL:</span>
            <span style={{ color: 'var(--success)' }}>{formatCurrency(totals.grandTotal)}</span>
          </div>

          <button
            onClick={() => setShowCheckoutModal(true)}
            disabled={cartItems.length === 0}
            style={{
              width: '100%',
              background: cartItems.length === 0 ? 'var(--bg-card)' : 'var(--primary)',
              color: cartItems.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              border: 'none',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background var(--transition-fast)',
            }}
          >
            Bayar / Transaksi
          </button>
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
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              width: '100%',
              maxWidth: '500px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '20px', color: 'var(--primary)' }}>Kustomisasi {activeItemConfig.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pilih variasi dan tambahan menu</p>
            </div>

            {/* Render Variant Groups */}
            {variantGroups
              .filter((g) => g.menuItemId === activeItemConfig.id)
              .map((grp) => (
                <div key={grp.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>
                    {grp.name} {grp.isRequired && <span style={{ color: 'var(--danger)' }}>*Wajib</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '12px' }}>
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
                              background: isChosen ? 'var(--primary)' : 'var(--bg-main)',
                              border: isChosen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              fontSize: '13px',
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
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Tambahan (Topping)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                          background: isChosen ? 'var(--primary)' : 'var(--bg-main)',
                          border: isChosen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '12px',
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
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Catatan Dapur</span>
              <input
                type="text"
                placeholder="Contoh: jangan pakai kol, extra kecap..."
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Quantity Selector inside modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                  style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px' }}
                >
                  -
                </button>
                <span style={{ fontSize: '16px', fontWeight: '700' }}>{itemQuantity}</span>
                <button
                  onClick={() => setItemQuantity(itemQuantity + 1)}
                  style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px' }}
                >
                  +
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setActiveItemConfig(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '10px 16px' }}
                >
                  Batal
                </button>
                <button
                  onClick={handleCustomizationSubmit}
                  style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}
                >
                  Simpan Order
                </button>
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
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              width: '100%',
              maxWidth: '450px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <h3 style={{ fontSize: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Pembayaran</h3>

            {/* Table Number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nomor Meja / Keterangan</label>
              <input
                type="text"
                placeholder="Contoh: Meja 05, Bungkus..."
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Payment Method Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Pilih Metode Pembayaran</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'cash', label: 'Tunai (Cash)' },
                  { id: 'static_qris', label: 'QRIS Statis' },
                  { id: 'dynamic_qris', label: 'QRIS Dinamis', disabled: isOffline },
                  { id: 'ewallet', label: 'E-Wallet' },
                  { id: 'debit_credit', label: 'Debit / Kredit' },
                ].map((m) => (
                  <button
                    key={m.id}
                    disabled={m.disabled}
                    onClick={() => setPaymentMethod(m.id as any)}
                    style={{
                      background: paymentMethod === m.id ? 'var(--primary)' : 'var(--bg-main)',
                      border: paymentMethod === m.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      color: m.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: m.disabled ? 'not-allowed' : 'pointer',
                      opacity: m.disabled ? 0.4 : 1,
                      fontSize: '13px',
                      fontWeight: paymentMethod === m.id ? '600' : '400',
                    }}
                  >
                    {m.label} {m.disabled && '(Offline)'}
                  </button>
                ))}
              </div>
            </div>

            {/* If Cash, Enter amount */}
            {paymentMethod === 'cash' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Uang Diterima</label>
                <input
                  type="number"
                  placeholder="Masukkan jumlah tunai..."
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    fontSize: '16px',
                    fontWeight: '600',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {[totals.grandTotal, 20000, 50000, 100000].map((quick) => (
                    <button
                      key={quick}
                      onClick={() => setAmountPaid(String(Math.ceil(quick)))}
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '4px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {formatCurrency(Math.ceil(quick))}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                onClick={() => setShowCheckoutModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '10px 16px' }}
              >
                Batal
              </button>
              <button
                onClick={handleCheckoutSubmit}
                style={{
                  background: 'var(--success)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Bayar Lunas
              </button>
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
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 101,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              color: '#333333',
              padding: '24px',
              width: '300px',
              fontFamily: 'Courier New, Courier, monospace',
              fontSize: '12px',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
              RESTO POS APP v1.1
            </div>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #333', paddingBottom: '8px', marginBottom: '8px' }}>
              Ruko Kuliner Nusantara No. 12<br />
              Tangerang, Indonesia
            </div>
            <div>
              No: {printedReceipt.receiptNumber}<br />
              Meja: {printedReceipt.tableNumber}<br />
              Waktu: {printedReceipt.date} {printedReceipt.time}<br />
            </div>
            <div style={{ borderBottom: '1px dashed #333', paddingBottom: '8px', margin: '8px 0' }} />
            
            {/* Items */}
            {printedReceipt.items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.menuItem.name}</span>
                  <span>{item.quantity}x</span>
                </div>
                {item.selectedVariants.map((v: any) => (
                  <div key={v.id} style={{ fontSize: '10px', color: '#666' }}>
                    - {v.name}
                  </div>
                ))}
                {item.selectedModifiers.map((m: any) => (
                  <div key={m.id} style={{ fontSize: '10px', color: '#666' }}>
                    - {m.name} (+{formatCurrency(Number(m.priceDelta))})
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontWeight: '600' }}>
                  {formatCurrency(item.lineTotal)}
                </div>
              </div>
            ))}

            <div style={{ borderBottom: '1px dashed #333', paddingBottom: '8px', margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{formatCurrency(printedReceipt.totals.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Diskon:</span>
              <span>-{formatCurrency(printedReceipt.totals.discountTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pajak (10%):</span>
              <span>{formatCurrency(printedReceipt.totals.taxTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', margin: '4px 0' }}>
              <span>TOTAL AKHIR:</span>
              <span>{formatCurrency(printedReceipt.totals.grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
              <span>Bayar ({printedReceipt.paymentMethod.toUpperCase()}):</span>
              <span>{formatCurrency(printedReceipt.cashPaid)}</span>
            </div>
            {printedReceipt.paymentMethod === 'cash' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Kembalian:</span>
                <span>{formatCurrency(printedReceipt.cashPaid - printedReceipt.totals.grandTotal)}</span>
              </div>
            )}

            <div style={{ borderBottom: '1px dashed #333', paddingBottom: '8px', margin: '8px 0' }} />
            <div style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '8px' }}>
              Terima Kasih atas Kunjungan Anda!
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={handlePrintReceipt}
                style={{
                  flex: 1,
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'sans-serif',
                  fontWeight: '600',
                }}
              >
                Cetak Struk
              </button>
              <button
                onClick={() => setPrintedReceipt(null)}
                style={{
                  flex: 1,
                  background: '#374151',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'sans-serif',
                  fontWeight: '600',
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
