import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/localSchema';
import { useNetworkStore } from '../store/networkStore';

export function AdminCms() {
  const [activeTab, setActiveTab] = useState<'users' | 'menu' | 'categories' | 'variants' | 'modifiers' | 'materials' | 'recipes' | 'hpp'>('users');
  const { enqueueMutation } = useNetworkStore();

  // ─── Shared Dexie Queries ───
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const appSettings = useLiveQuery(() => db.appSettings.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const menuItems = useLiveQuery(() => db.menuItems.toArray()) || [];
  const rawMaterials = useLiveQuery(() => db.rawMaterials.toArray()) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const variantGroups = useLiveQuery(() => db.variantGroups.toArray()) || [];
  const variants = useLiveQuery(() => db.variants.toArray()) || [];
  const modifiers = useLiveQuery(() => db.modifiers.toArray()) || [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Helper to read local PIN mapping
  const getUserPin = (userId: string) => {
    const setting = appSettings.find((s) => s.key === `pin:${userId}`);
    return setting ? (setting.value as string) : 'Belum diatur';
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

  // ─── 1. TAB: USERS & PIN MANAGEMENT ───
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'cashier' | 'chef'>('cashier');
  const [userStatus, setUserStatus] = useState<boolean>(true);
  const [userPin, setUserPin] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userRole) return;
    try {
      const uId = editingUserId || `usr-${Date.now()}`;
      const userData = {
        id: uId,
        name: userName,
        role: userRole,
        isActive: userStatus,
        updatedAt: new Date().toISOString(),
      };

      if (editingUserId) {
        await db.users.put(userData);
      } else {
        await db.users.add(userData);
      }

      if (userPin.trim()) {
        await db.appSettings.put({ key: `pin:${uId}`, value: userPin });
      }

      await enqueueMutation('rawMaterial', uId, editingUserId ? 'update' : 'insert', { user: userData, pin: userPin });

      setShowUserForm(false);
      setEditingUserId(null);
      setUserName('');
      setUserPin('');
      setUserRole('cashier');
      setUserStatus(true);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan user.');
    }
  };

  const triggerEditUser = (user: any) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserRole(user.role);
    setUserStatus(user.isActive);
    const pin = appSettings.find((s) => s.key === `pin:${user.id}`);
    setUserPin(pin ? (pin.value as string) : '');
    setShowUserForm(true);
  };

  // ─── 2. TAB: MENU ITEMS ───
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuCategoryId, setMenuCategoryId] = useState('');
  const [menuBasePrice, setMenuBasePrice] = useState('');
  const [menuDesc, setMenuDesc] = useState('');
  const [showMenuForm, setShowMenuForm] = useState(false);

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

      setShowMenuForm(false);
      setEditingMenuId(null);
      setMenuName('');
      setMenuCategoryId('');
      setMenuBasePrice('');
      setMenuDesc('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMenu = async (id: string) => {
    if (confirm('Hapus menu ini?')) {
      await db.menuItems.delete(id);
      const links = await db.recipes.where('menuItemId').equals(id).toArray();
      for (const l of links) {
        await db.recipes.delete(l.id);
      }
      await enqueueMutation('menuItem', id, 'delete', {});
    }
  };

  // ─── 3. TAB: CATEGORIES ───
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySort, setCategorySort] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) return;
    try {
      const cId = editingCategoryId || `cat-${Date.now()}`;
      const catData = {
        id: cId,
        name: categoryName,
        sortOrder: Number(categorySort || 0),
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      if (editingCategoryId) {
        await db.categories.put(catData);
      } else {
        await db.categories.add(catData);
      }

      await enqueueMutation('rawMaterial', cId, editingCategoryId ? 'update' : 'insert', { category: catData });

      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryName('');
      setCategorySort('');
    } catch (err) {
      console.error(err);
    }
  };

  const triggerEditCategory = (cat: any) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setCategorySort(String(cat.sortOrder));
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Hapus kategori ini?')) {
      await db.categories.delete(id);
      await enqueueMutation('rawMaterial', id, 'delete', {});
    }
  };

  // ─── 4. TAB: VARIANTS ───
  const [showVariantGroupForm, setShowVariantGroupForm] = useState(false);
  const [vgMenuId, setVgMenuId] = useState('');
  const [vgName, setVgName] = useState('');
  const [vgRequired, setVgRequired] = useState(false);
  
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [varGroupId, setVarGroupId] = useState('');
  const [varName, setVarName] = useState('');
  const [varPriceDelta, setVarPriceDelta] = useState('');

  const handleSaveVariantGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vgMenuId || !vgName) return;
    try {
      const id = `vg-${Date.now()}`;
      await db.variantGroups.add({
        id,
        menuItemId: vgMenuId,
        name: vgName,
        isRequired: vgRequired,
        maxSelected: 1,
      });
      setShowVariantGroupForm(false);
      setVgMenuId('');
      setVgName('');
      setVgRequired(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varGroupId || !varName) return;
    try {
      const id = `var-${Date.now()}`;
      await db.variants.add({
        id,
        variantGroupId: varGroupId,
        name: varName,
        priceDelta: Number(varPriceDelta || 0),
        isActive: true,
      });
      setShowVariantForm(false);
      setVarGroupId('');
      setVarName('');
      setVarPriceDelta('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVariantGroup = async (id: string) => {
    if (confirm('Hapus group variasi ini beserta seluruh pilihannya?')) {
      await db.variantGroups.delete(id);
      const childs = await db.variants.where('variantGroupId').equals(id).toArray();
      for (const c of childs) {
        await db.variants.delete(c.id);
      }
    }
  };

  const handleDeleteVariant = async (id: string) => {
    if (confirm('Hapus pilihan variasi ini?')) {
      await db.variants.delete(id);
    }
  };

  // ─── 5. TAB: MODIFIERS ───
  const [editingModifierId, setEditingModifierId] = useState<string | null>(null);
  const [modifierName, setModifierName] = useState('');
  const [modifierDelta, setModifierDelta] = useState('');
  const [showModifierForm, setShowModifierForm] = useState(false);

  const handleSaveModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifierName || !modifierDelta) return;
    try {
      const mId = editingModifierId || `mod-${Date.now()}`;
      const modData = {
        id: mId,
        name: modifierName,
        priceDelta: Number(modifierDelta),
        isActive: true,
      };

      if (editingModifierId) {
        await db.modifiers.put(modData);
      } else {
        await db.modifiers.add(modData);
      }

      await enqueueMutation('rawMaterial', mId, editingModifierId ? 'update' : 'insert', { modifier: modData });

      setShowModifierForm(false);
      setEditingModifierId(null);
      setModifierName('');
      setModifierDelta('');
    } catch (err) {
      console.error(err);
    }
  };

  const triggerEditModifier = (mod: any) => {
    setEditingModifierId(mod.id);
    setModifierName(mod.name);
    setModifierDelta(String(mod.priceDelta));
    setShowModifierForm(true);
  };

  const handleDeleteModifier = async (id: string) => {
    if (confirm('Hapus modifier/tambahan ini?')) {
      await db.modifiers.delete(id);
      await enqueueMutation('rawMaterial', id, 'delete', {});
    }
  };

  // ─── 6. TAB: RAW MATERIALS (BAHAN BAKU) ───
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('');
  const [matCost, setMatCost] = useState('');
  const [matMinQty, setMatMinQty] = useState('');
  const [matCurrentQty, setMatCurrentQty] = useState('');
  const [showMatForm, setShowMatForm] = useState(false);

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName || !matUnit || !matCost) return;
    try {
      const matData = {
        name: matName,
        unit: matUnit,
        unitCost: Number(matCost),
        minimumQuantity: Number(matMinQty || 0),
        currentQuantity: Number(matCurrentQty || 0),
        updatedAt: new Date().toISOString(),
      };

      if (editingMatId) {
        await db.rawMaterials.update(editingMatId, matData);
        await enqueueMutation('rawMaterial', editingMatId, 'update', matData);
      } else {
        const id = `raw-${Date.now()}`;
        await db.rawMaterials.add({ id, ...matData });
        await enqueueMutation('rawMaterial', id, 'insert', matData);
      }

      setShowMatForm(false);
      setEditingMatId(null);
      setMatName('');
      setMatUnit('');
      setMatCost('');
      setMatMinQty('');
      setMatCurrentQty('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (confirm('Hapus bahan baku ini beserta hubungannya di resep?')) {
      await db.rawMaterials.delete(id);
      const links = await db.recipes.where('rawMaterialId').equals(id).toArray();
      for (const l of links) {
        await db.recipes.delete(l.id);
      }
      await enqueueMutation('rawMaterial', id, 'delete', {});
    }
  };

  // ─── 7. TAB: RECIPES (BOM) ───
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeMenuId, setRecipeMenuId] = useState('');
  const [recipeMaterialId, setRecipeMaterialId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');

  const handleSaveRecipeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeMenuId || !recipeMaterialId || !recipeQty) return;
    try {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* CMS Navigation Tabs Bar */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '1. User & PIN' },
          { id: 'menu', label: '2. Menu Produk' },
          { id: 'categories', label: '3. Kategori Menu' },
          { id: 'variants', label: '4. Opsi Variasi' },
          { id: 'modifiers', label: '5. Modifier / Topping' },
          { id: 'materials', label: '6. Bahan Baku' },
          { id: 'recipes', label: '7. Resep (BOM)' },
          { id: 'hpp', label: '8. HPP & Margin' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: USERS ─── */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Pengaturan Karyawan & PIN</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Atur kata sandi login cepat (PIN) untuk masing-masing karyawan.</p>
            </div>
            <button
              onClick={() => {
                setEditingUserId(null);
                setUserName('');
                setUserPin('');
                setUserRole('cashier');
                setUserStatus(true);
                setShowUserForm(true);
              }}
              style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Tambah User
            </button>
          </div>

          {showUserForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingUserId ? 'Edit User' : 'Tambah User'}</h4>
              <form onSubmit={handleSaveUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Nama Karyawan</label>
                  <input type="text" required value={userName} onChange={(e) => setUserName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Jabatan / Role</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value as any)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }}>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="cashier">Kasir</option>
                    <option value="chef">Chef</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>PIN Login (4 Digit Angka)</label>
                  <input type="text" maxLength={4} placeholder="PIN baru" value={userPin} onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Status Akun</label>
                  <select value={userStatus ? 'active' : 'inactive'} onChange={(e) => setUserStatus(e.target.value === 'active')} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }}>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowUserForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: '600' }}>Simpan</button>
                </div>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama</th>
                <th style={{ padding: '12px 8px' }}>Role</th>
                <th style={{ padding: '12px 8px' }}>PIN</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{u.name}</td>
                  <td style={{ padding: '12px 8px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: '600' }}>{u.role}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{getUserPin(u.id)}</td>
                  <td style={{ padding: '12px 8px', color: u.isActive ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>{u.isActive ? 'Aktif' : 'Nonaktif'}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => triggerEditUser(u)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>Edit / PIN</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 2: MENU ITEMS ─── */}
      {activeTab === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Daftar Produk & Menu Jual</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Atur nama menu makanan/minuman, kategori kelompok, dan harga jual produk POS.</p>
            </div>
            <button
              onClick={() => {
                setEditingMenuId(null);
                setMenuName('');
                setMenuCategoryId('');
                setMenuBasePrice('');
                setMenuDesc('');
                setShowMenuForm(true);
              }}
              style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Tambah Menu
            </button>
          </div>

          {showMenuForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingMenuId ? 'Edit Menu' : 'Tambah Menu'}</h4>
              <form onSubmit={handleSaveMenu} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Nama Menu</label>
                  <input type="text" required value={menuName} onChange={(e) => setMenuName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Kelompok Kategori</label>
                  <select required value={menuCategoryId} onChange={(e) => setMenuCategoryId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }}>
                    <option value="">Pilih Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Harga Jual Dasar (Rp)</label>
                  <input type="number" required value={menuBasePrice} onChange={(e) => setMenuBasePrice(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Deskripsi Singkat</label>
                  <input type="text" value={menuDesc} onChange={(e) => setMenuDesc(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowMenuForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: '600' }}>Simpan Menu</button>
                </div>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Menu</th>
                <th style={{ padding: '12px 8px' }}>Kategori</th>
                <th style={{ padding: '12px 8px' }}>Harga Jual</th>
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
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>{formatCurrency(item.basePrice)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>{item.description || '-'}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingMenuId(item.id);
                          setMenuName(item.name);
                          setMenuCategoryId(item.categoryId || '');
                          setMenuBasePrice(String(item.basePrice));
                          setMenuDesc(item.description || '');
                          setShowMenuForm(true);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDeleteMenu(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 3: CATEGORIES ─── */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Kategori Menu Makanan / Minuman</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kategori menentukan tab pemilah katalog produk pada layar Kasir (POS).</p>
            </div>
            <button
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryName('');
                setCategorySort('');
                setShowCategoryForm(true);
              }}
              style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Kategori Baru
            </button>
          </div>

          {showCategoryForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingCategoryId ? 'Edit Kategori' : 'Tambah Kategori'}</h4>
              <form onSubmit={handleSaveCategory} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                  <label style={{ fontSize: '13px' }}>Nama Kategori</label>
                  <input type="text" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px' }}>Urutan Tampilan</label>
                  <input type="number" value={categorySort} onChange={(e) => setCategorySort(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '12px 24px', borderRadius: '4px', fontWeight: '600' }}>Simpan</button>
                <button type="button" onClick={() => setShowCategoryForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '12px' }}>Batal</button>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Kategori</th>
                <th style={{ padding: '12px 8px' }}>Sort Order</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{c.name}</td>
                  <td style={{ padding: '12px 8px' }}>{c.sortOrder}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => triggerEditCategory(c)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}>Edit</button>
                    <button onClick={() => handleDeleteCategory(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 4: VARIANTS ─── */}
      {activeTab === 'variants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px' }}>
          
          {/* Left Panel: Variant Groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Group Pilihan Variasi</h3>
              <button onClick={() => setShowVariantGroupForm(true)} style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>+ Group Baru</button>
            </div>

            {showVariantGroupForm && (
              <form onSubmit={handleSaveVariantGroup} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select required value={vgMenuId} onChange={(e) => setVgMenuId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }}>
                  <option value="">Pilih Menu Hubungan</option>
                  {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input type="text" placeholder="Nama Group (contoh: Porsi, Level Pedas)" required value={vgName} onChange={(e) => setVgName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={vgRequired} onChange={(e) => setVgRequired(e.target.checked)} />
                  Wajib Dipilih Konsumen (Required)
                </label>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowVariantGroupForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '4px' }}>Simpan Group</button>
                </div>
              </form>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Nama Group</th>
                  <th style={{ padding: '8px' }}>Menu Terkait</th>
                  <th style={{ padding: '8px' }}>Required</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {variantGroups.map((vg) => {
                  const m = menuItems.find((item) => item.id === vg.menuItemId);
                  return (
                    <tr key={vg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: '600' }}>{vg.name}</td>
                      <td style={{ padding: '8px' }}>{m ? m.name : 'Unknown Menu'}</td>
                      <td style={{ padding: '8px', color: vg.isRequired ? 'var(--danger)' : 'var(--text-muted)' }}>{vg.isRequired ? 'WAJIB' : 'OPSIONAL'}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteVariantGroup(vg.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right Panel: Variant Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Pilihan Variasi (Variants)</h3>
              <button onClick={() => setShowVariantForm(true)} style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>+ Opsi Pilihan</button>
            </div>

            {showVariantForm && (
              <form onSubmit={handleSaveVariant} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select required value={varGroupId} onChange={(e) => setVarGroupId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }}>
                  <option value="">Pilih Variant Group</option>
                  {variantGroups.map((g) => {
                    const m = menuItems.find((item) => item.id === g.menuItemId);
                    return <option key={g.id} value={g.id}>{g.name} ({m ? m.name : 'Menu'})</option>;
                  })}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" placeholder="Nama Pilihan (Jumbo, Less Sugar)" required value={varName} onChange={(e) => setVarName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                  <input type="number" placeholder="Selisih Harga (Delta Rp)" value={varPriceDelta} onChange={(e) => setVarPriceDelta(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowVariantForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '4px' }}>Simpan Pilihan</button>
                </div>
              </form>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Opsi Pilihan</th>
                  <th style={{ padding: '8px' }}>Variant Group</th>
                  <th style={{ padding: '8px' }}>Selisih Harga</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const g = variantGroups.find((grp) => grp.id === v.variantGroupId);
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: '600' }}>{v.name}</td>
                      <td style={{ padding: '8px' }}>{g ? g.name : 'Unknown Group'}</td>
                      <td style={{ padding: '8px', color: 'var(--primary)' }}>{Number(v.priceDelta) >= 0 ? '+' : ''}{formatCurrency(v.priceDelta)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteVariant(v.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: MODIFIERS ─── */}
      {activeTab === 'modifiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Modifiers / Topping Tambahan</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Modifier adalah topping tambahan opsional yang berlaku umum di kasir (misalnya: Ekstra Keju, Ekstra Telur).</p>
            </div>
            <button
              onClick={() => {
                setEditingModifierId(null);
                setModifierName('');
                setModifierDelta('');
                setShowModifierForm(true);
              }}
              style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Modifier Baru
            </button>
          </div>

          {showModifierForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingModifierId ? 'Edit Modifier' : 'Tambah Modifier'}</h4>
              <form onSubmit={handleSaveModifier} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                  <label style={{ fontSize: '13px' }}>Nama Modifier (Tambahan)</label>
                  <input type="text" required value={modifierName} onChange={(e) => setModifierName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px' }}>Harga Tambahan (Rp)</label>
                  <input type="number" required value={modifierDelta} onChange={(e) => setModifierDelta(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '12px 24px', borderRadius: '4px', fontWeight: '600' }}>Simpan</button>
                <button type="button" onClick={() => setShowModifierForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '12px' }}>Batal</button>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Topping / Modifier</th>
                <th style={{ padding: '12px 8px' }}>Selisih Harga</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {modifiers.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{m.name}</td>
                  <td style={{ padding: '12px 8px', fontWeight: '600', color: 'var(--primary)' }}>+{formatCurrency(m.priceDelta)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => triggerEditModifier(m)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}>Edit</button>
                    <button onClick={() => handleDeleteModifier(m.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 6: RAW MATERIALS ─── */}
      {activeTab === 'materials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Gudang Bahan Baku (Inventory)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kelola bahan mentah dapur beserta harga beli satuan untuk perhitungan biaya modal produksi menu (HPP).</p>
            </div>
            <button
              onClick={() => {
                setEditingMatId(null);
                setMatName('');
                setMatUnit('');
                setMatCost('');
                setMatMinQty('');
                setMatCurrentQty('');
                setShowMatForm(true);
              }}
              style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              + Bahan Baku Baru
            </button>
          </div>

          {showMatForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingMatId ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</h4>
              <form onSubmit={handleSaveMaterial} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Nama Bahan Baku</label>
                  <input type="text" required value={matName} onChange={(e) => setMatName(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Satuan Ukuran (kg, liter, butir, gram)</label>
                  <input type="text" required placeholder="misal: kg, butir" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Harga Beli per Satuan (Rp)</label>
                  <input type="number" required value={matCost} onChange={(e) => setMatCost(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Stok Batas Minimum Peringatan</label>
                  <input type="number" step="0.001" value={matMinQty} onChange={(e) => setMatMinQty(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Stok Fisik Saat Ini</label>
                  <input type="number" step="0.001" value={matCurrentQty} onChange={(e) => setMatCurrentQty(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ gridColumn: 'span 3', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowMatForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: '600' }}>Simpan Bahan</button>
                </div>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Bahan</th>
                <th style={{ padding: '12px 8px' }}>Satuan</th>
                <th style={{ padding: '12px 8px' }}>Harga Beli</th>
                <th style={{ padding: '12px 8px' }}>Stok Saat Ini</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((mat) => {
                const isLow = Number(mat.currentQuantity) <= Number(mat.minimumQuantity);
                return (
                  <tr key={mat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '500' }}>{mat.name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{mat.unit}</td>
                    <td style={{ padding: '12px 8px' }}>{formatCurrency(mat.unitCost)}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '600', color: isLow ? 'var(--danger)' : 'var(--success)' }}>
                      {Number(mat.currentQuantity).toFixed(2)}
                      {isLow && <span style={{ fontSize: '10px', display: 'block', color: 'var(--danger)', fontWeight: 'normal' }}>(Stok Kritis)</span>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingMatId(mat.id);
                          setMatName(mat.name);
                          setMatUnit(mat.unit);
                          setMatCost(String(mat.unitCost));
                          setMatMinQty(String(mat.minimumQuantity));
                          setMatCurrentQty(String(mat.currentQuantity));
                          setShowMatForm(true);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDeleteMaterial(mat.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 7: RECIPES (BOM) ─── */}
      {activeTab === 'recipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Komposisi Resep Menu (Bill of Materials)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hubungkan produk menu POS dengan takaran bahan baku agar stok otomatis berkurang setiap ada penjualan.</p>
            </div>
            <button onClick={() => setShowRecipeForm(true)} style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
              + Hubungkan Resep
            </button>
          </div>

          {showRecipeForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>Buat Hubungan Resep</h4>
              <form onSubmit={handleSaveRecipeLink} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Pilih Menu Jual</label>
                  <select required value={recipeMenuId} onChange={(e) => setRecipeMenuId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }}>
                    <option value="">Pilih Menu...</option>
                    {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Pilih Bahan Baku</label>
                  <select required value={recipeMaterialId} onChange={(e) => setRecipeMaterialId(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }}>
                    <option value="">Pilih Bahan...</option>
                    {rawMaterials.map((rm) => <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Takaran Kebutuhan Porsi</label>
                  <input type="number" step="0.001" required placeholder="Jumlah terpakai" value={recipeQty} onChange={(e) => setRecipeQty(e.target.value)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px' }} />
                </div>
                <div style={{ gridColumn: 'span 3', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowRecipeForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Batal</button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: '600' }}>Hubungkan Resep</button>
                </div>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Menu Makanan/Minuman</th>
                <th style={{ padding: '12px 8px' }}>Bahan Baku Terpakai</th>
                <th style={{ padding: '12px 8px' }}>Takaran Kebutuhan</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((link) => {
                const menu = menuItems.find((m) => m.id === link.menuItemId);
                const mat = rawMaterials.find((rm) => rm.id === link.rawMaterialId);
                return (
                  <tr key={link.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '500' }}>{menu ? menu.name : 'Unknown Menu'}</td>
                    <td style={{ padding: '12px 8px' }}>{mat ? mat.name : 'Unknown Material'}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>{Number(link.quantity).toFixed(3)} {mat?.unit}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button onClick={() => handleDeleteRecipeLink(link.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Hapus Hubungan</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 8: HPP & MARGIN ─── */}
      {activeTab === 'hpp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3>Analisis Biaya (HPP) & Margin Keuntungan</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Proyeksi laba kotor dihitung real-time berdasarkan total biaya bahan baku resep dikalikan harga beli gudang terbaru.</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Menu</th>
                <th style={{ padding: '12px 8px' }}>Bahan Resep BOM</th>
                <th style={{ padding: '12px 8px' }}>Harga Jual</th>
                <th style={{ padding: '12px 8px' }}>Proyeksi HPP</th>
                <th style={{ padding: '12px 8px' }}>Laba Kotor</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Status Margin</th>
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
                        <span style={{ color: 'var(--danger)' }}>BOM belum ditentukan</span>
                      ) : (
                        itemRecipes.map((r, i) => {
                          const m = rawMaterials.find((rm) => rm.id === r.rawMaterialId);
                          return <span key={r.id}>{m?.name} ({r.quantity}{m?.unit}){i < itemRecipes.length - 1 ? ', ' : ''}</span>;
                        })
                      )}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>{formatCurrency(price)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{formatCurrency(hpp)}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '700', color: isHealthy ? 'var(--success)' : 'var(--warning)' }}>
                      {marginPercent.toFixed(1)}%
                      <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)', fontWeight: 'normal' }}>Laba: {formatCurrency(profit)}</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <span style={{ background: isHealthy ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: isHealthy ? 'var(--success)' : 'var(--warning)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        {isHealthy ? 'PROFITABEL' : 'MARGIN TIPIS'}
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
