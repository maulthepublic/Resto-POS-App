import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalMenuItem, LocalRawMaterial } from '../db/localSchema';
import { useNetworkStore } from '../store/networkStore';

export function MenuResep() {
  const [activeTab, setActiveTab] = useState<'menu' | 'ingredients' | 'hpp'>('menu');
  const { enqueueMutation } = useNetworkStore();

  // Queries
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const menuItems = useLiveQuery(() => db.menuItems.toArray()) || [];
  const rawMaterials = useLiveQuery(() => db.rawMaterials.toArray()) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];

  // Form states for Menu Items
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [menuCategoryId, setMenuCategoryId] = useState('');
  const [menuBasePrice, setMenuBasePrice] = useState('');
  const [menuDesc, setMenuDesc] = useState('');
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

  // Form states for Raw Materials (Bahan Baku)
  const [showIngredForm, setShowIngredForm] = useState(false);
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('');
  const [ingCost, setIngCost] = useState('');
  const [ingMinQty, setIngMinQty] = useState('');
  const [ingCurrentQty, setIngCurrentQty] = useState('');
  const [editingIngId, setEditingIngId] = useState<string | null>(null);

  // Form states for Recipe linking (BOM)
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeMenuId, setRecipeMenuId] = useState('');
  const [recipeMaterialId, setRecipeMaterialId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');

  // 1. Menu Save
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName || !menuCategoryId || !menuBasePrice) return;

    try {
      const menuData = {
        name: menuName,
        categoryId: menuCategoryId,
        basePrice: Number(menuBasePrice),
        description: menuDesc,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      if (editingMenuId) {
        await db.menuItems.update(editingMenuId, menuData);
        await enqueueMutation('menuItem', editingMenuId, 'update', menuData);
      } else {
        const id = `menu-${Date.now()}`;
        await db.menuItems.add({ id, ...menuData });
        await enqueueMutation('menuItem', id, 'insert', menuData);
      }

      // Reset
      setShowMenuForm(false);
      setMenuName('');
      setMenuCategoryId('');
      setMenuBasePrice('');
      setMenuDesc('');
      setEditingMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Menu triggers
  const triggerEditMenu = (item: LocalMenuItem) => {
    setEditingMenuId(item.id);
    setMenuName(item.name);
    setMenuCategoryId(item.categoryId || '');
    setMenuBasePrice(String(item.basePrice));
    setMenuDesc(item.description || '');
    setShowMenuForm(true);
  };

  // 2. Raw Material Save
  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName || !ingUnit || !ingCost || !ingCurrentQty) return;

    try {
      const ingredData = {
        name: ingName,
        unit: ingUnit,
        unitCost: Number(ingCost),
        minimumQuantity: Number(ingMinQty || 0),
        currentQuantity: Number(ingCurrentQty),
        updatedAt: new Date().toISOString(),
      };

      if (editingIngId) {
        await db.rawMaterials.update(editingIngId, ingredData);
        await enqueueMutation('rawMaterial', editingIngId, 'update', ingredData);
      } else {
        const id = `raw-${Date.now()}`;
        await db.rawMaterials.add({ id, ...ingredData });
        await enqueueMutation('rawMaterial', id, 'insert', ingredData);
      }

      setShowIngredForm(false);
      setIngName('');
      setIngUnit('');
      setIngCost('');
      setIngMinQty('');
      setIngCurrentQty('');
      setEditingIngId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Raw Material
  const triggerEditIngred = (mat: LocalRawMaterial) => {
    setEditingIngId(mat.id);
    setIngName(mat.name);
    setIngUnit(mat.unit);
    setIngCost(String(mat.unitCost));
    setIngMinQty(String(mat.minimumQuantity));
    setIngCurrentQty(String(mat.currentQuantity));
    setShowIngredForm(true);
  };

  // Delete Raw Material
  const handleDeleteIngred = async (id: string) => {
    if (confirm('Hapus bahan baku ini?')) {
      await db.rawMaterials.delete(id);
      // Delete any associated recipe components
      const links = await db.recipes.where('rawMaterialId').equals(id).toArray();
      for (const l of links) {
        await db.recipes.delete(l.id);
      }
      await enqueueMutation('rawMaterial', id, 'delete', {});
    }
  };

  // Delete Menu Item
  const handleDeleteMenu = async (id: string) => {
    if (confirm('Hapus menu ini?')) {
      await db.menuItems.delete(id);
      // Delete associated recipes
      const links = await db.recipes.where('menuItemId').equals(id).toArray();
      for (const l of links) {
        await db.recipes.delete(l.id);
      }
      await enqueueMutation('menuItem', id, 'delete', {});
    }
  };

  // 3. Save Recipe linkage (BOM)
  const handleSaveRecipeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeMenuId || !recipeMaterialId || !recipeQty) return;

    try {
      // Check if existing mapping
      const existing = await db.recipes
        .where('[menuItemId+rawMaterialId]')
        .equals([recipeMenuId, recipeMaterialId])
        .first();

      if (existing) {
        await db.recipes.update(existing.id, {
          quantity: Number(recipeQty),
        });
      } else {
        await db.recipes.add({
          id: `rec-${Date.now()}`,
          menuItemId: recipeMenuId,
          rawMaterialId: recipeMaterialId,
          quantity: Number(recipeQty),
        });
      }

      setShowRecipeForm(false);
      setRecipeMenuId('');
      setRecipeMaterialId('');
      setRecipeQty('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecipeLink = async (id: string) => {
    if (confirm('Hapus item komposisi resep ini?')) {
      await db.recipes.delete(id);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Calculate COGS / HPP for a menu item
  const calculateMenuItemHpp = (menuItemId: string) => {
    const constituent = recipes.filter((r) => r.menuItemId === menuItemId);
    let totalHpp = 0;
    constituent.forEach((rec) => {
      const mat = rawMaterials.find((m) => m.id === rec.rawMaterialId);
      if (mat) {
        totalHpp += Number(mat.unitCost) * Number(rec.quantity);
      }
    });
    return totalHpp;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {[
          { id: 'menu', label: 'Kelola Menu' },
          { id: 'ingredients', label: 'Stok Bahan Baku & Resep' },
          { id: 'hpp', label: 'Kalkulasi HPP & Margin (v1.1)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? '600' : '400',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Kelola Menu */}
      {activeTab === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Daftar Produk Resto</h3>
            <button
              onClick={() => {
                setEditingMenuId(null);
                setMenuName('');
                setMenuCategoryId('');
                setMenuBasePrice('');
                setMenuDesc('');
                setShowMenuForm(true);
              }}
              style={{
                background: 'var(--primary)',
                color: 'var(--text-primary)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              + Tambah Menu
            </button>
          </div>

          {/* Menu form modal */}
          {showMenuForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingMenuId ? 'Edit Menu' : 'Tambah Menu Baru'}</h4>
              <form onSubmit={handleSaveMenu} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Nama Menu</label>
                  <input
                    type="text"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Kategori</label>
                  <select
                    value={menuCategoryId}
                    onChange={(e) => setMenuCategoryId(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Harga Dasar (Rp)</label>
                  <input
                    type="number"
                    value={menuBasePrice}
                    onChange={(e) => setMenuBasePrice(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Deskripsi</label>
                  <input
                    type="text"
                    value={menuDesc}
                    onChange={(e) => setMenuDesc(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowMenuForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Batal
                  </button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}>
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Table list of menus */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Menu</th>
                <th style={{ padding: '12px 8px' }}>Kategori</th>
                <th style={{ padding: '12px 8px' }}>Harga</th>
                <th style={{ padding: '12px 8px' }}>Deskripsi</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item) => {
                const cat = categories.find((c) => c.id === item.categoryId);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{cat ? cat.name : 'Uncategorized'}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>{formatCurrency(Number(item.basePrice))}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>{item.description || '-'}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button onClick={() => triggerEditMenu(item)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteMenu(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Ingredients & Recipes */}
      {activeTab === 'ingredients' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          {/* Ingredients Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Stok Bahan Baku</h3>
              <button
                onClick={() => {
                  setEditingIngId(null);
                  setIngName('');
                  setIngUnit('');
                  setIngCost('');
                  setIngMinQty('');
                  setIngCurrentQty('');
                  setShowIngredForm(true);
                }}
                style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              >
                + Bahan Baru
              </button>
            </div>

            {showIngredForm && (
              <form onSubmit={handleSaveIngredient} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px' }}>{editingIngId ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" placeholder="Nama Bahan" value={ingName} onChange={(e) => setIngName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                  <input type="text" placeholder="Satuan (kg, butir, liter)" value={ingUnit} onChange={(e) => setIngUnit(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                  <input type="number" placeholder="Harga Beli Satuan (Rp)" value={ingCost} onChange={(e) => setIngCost(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                  <input type="number" step="0.001" placeholder="Stok Minimum" value={ingMinQty} onChange={(e) => setIngMinQty(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                  <input type="number" step="0.001" placeholder="Stok Saat Ini" value={ingCurrentQty} onChange={(e) => setIngCurrentQty(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowIngredForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 16px', borderRadius: '4px' }}>Simpan</button>
                </div>
              </form>
            )}

            {/* List */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Bahan</th>
                  <th style={{ padding: '8px' }}>Satuan</th>
                  <th style={{ padding: '8px' }}>Harga Beli</th>
                  <th style={{ padding: '8px' }}>Stok Fisik</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.map((mat) => {
                  const isLow = Number(mat.currentQuantity) <= Number(mat.minimumQuantity);
                  return (
                    <tr key={mat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{mat.name}</td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{mat.unit}</td>
                      <td style={{ padding: '8px' }}>{formatCurrency(Number(mat.unitCost))}</td>
                      <td style={{ padding: '8px', fontWeight: '600', color: isLow ? 'var(--danger)' : 'var(--success)' }}>
                        {Number(mat.currentQuantity).toFixed(2)}
                        {isLow && <span style={{ fontSize: '10px', display: 'block', color: 'var(--danger)' }}>(Low Stock)</span>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={() => triggerEditIngred(mat)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                        <button onClick={() => handleDeleteIngred(mat.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recipes Component links (BOM) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Komposisi Resep (BOM)</h3>
              <button
                onClick={() => {
                  setRecipeMenuId('');
                  setRecipeMaterialId('');
                  setRecipeQty('');
                  setShowRecipeForm(true);
                }}
                style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              >
                + Hubungkan Resep
              </button>
            </div>

            {showRecipeForm && (
              <form onSubmit={handleSaveRecipeLink} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px' }}>Hubungkan Menu dengan Bahan Baku</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select value={recipeMenuId} onChange={(e) => setRecipeMenuId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }}>
                    <option value="">Pilih Menu Makanan/Minuman</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <select value={recipeMaterialId} onChange={(e) => setRecipeMaterialId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }}>
                    <option value="">Pilih Bahan Baku</option>
                    {rawMaterials.map((rm) => (
                      <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>
                    ))}
                  </select>
                  <input type="number" step="0.001" placeholder="Jumlah Takaran Pemakaian" value={recipeQty} onChange={(e) => setRecipeQty(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRecipeForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 16px', borderRadius: '4px' }}>Simpan Link</button>
                </div>
              </form>
            )}

            {/* Link List */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Menu</th>
                  <th style={{ padding: '8px' }}>Bahan Baku</th>
                  <th style={{ padding: '8px' }}>Takaran</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((link) => {
                  const menu = menuItems.find((m) => m.id === link.menuItemId);
                  const mat = rawMaterials.find((rm) => rm.id === link.rawMaterialId);
                  return (
                    <tr key={link.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{menu ? menu.name : 'Unknown Menu'}</td>
                      <td style={{ padding: '8px' }}>{mat ? mat.name : 'Unknown Raw Material'}</td>
                      <td style={{ padding: '8px', fontWeight: '600' }}>{Number(link.quantity).toFixed(3)} {mat?.unit}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteRecipeLink(link.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: HPP & Margin Automatic Calculator */}
      {activeTab === 'hpp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3>Kalkulasi HPP Otomatis (COGS)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Harga Pokok Produksi (HPP) dihitung otomatis secara real-time berdasarkan total resep bahan baku dikalikan harga beli terbaru.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Menu</th>
                <th style={{ padding: '12px 8px' }}>Komposisi Resep</th>
                <th style={{ padding: '12px 8px' }}>Harga Jual</th>
                <th style={{ padding: '12px 8px' }}>Estimasi HPP</th>
                <th style={{ padding: '12px 8px' }}>Margin Kotor</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Status Profit</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item) => {
                const hpp = calculateMenuItemHpp(item.id);
                const price = Number(item.basePrice);
                const profit = price - hpp;
                const marginPercent = price > 0 ? (profit / price) * 100 : 0;
                
                const itemRecipes = recipes.filter((r) => r.menuItemId === item.id);
                const isHealthy = marginPercent >= 50;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {itemRecipes.length === 0 ? (
                        <span style={{ color: 'var(--danger)' }}>BOM Belum Diisi</span>
                      ) : (
                        itemRecipes.map((r, i) => {
                          const m = rawMaterials.find((rm) => rm.id === r.rawMaterialId);
                          return (
                            <span key={r.id}>
                              {m?.name} ({r.quantity}{m?.unit})
                              {i < itemRecipes.length - 1 ? ', ' : ''}
                            </span>
                          );
                        })
                      )}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>{formatCurrency(price)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{formatCurrency(hpp)}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '700', color: isHealthy ? 'var(--success)' : 'var(--warning)' }}>
                      {marginPercent.toFixed(1)}%
                      <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)', fontWeight: '400' }}>
                        Profit: {formatCurrency(profit)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <span
                        style={{
                          backgroundColor: isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: isHealthy ? 'var(--success)' : 'var(--warning)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}
                      >
                        {isHealthy ? 'PROFITABEL' : 'MARGIN RENDAH'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
