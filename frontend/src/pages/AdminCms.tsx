import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/localSchema';
import { useNetworkStore } from '../store/networkStore';

export function AdminCms() {
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'modifiers'>('users');
  const { enqueueMutation } = useNetworkStore();

  // ─── User & PIN Queries ───
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const appSettings = useLiveQuery(() => db.appSettings.toArray()) || [];

  // Form States for Users
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userPin, setUserPin] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'cashier' | 'chef'>('cashier');
  const [userStatus, setUserStatus] = useState<boolean>(true);
  const [showUserForm, setShowUserForm] = useState(false);

  // ─── Categories Queries ───
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySort, setCategorySort] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // ─── Modifiers Queries ───
  const modifiers = useLiveQuery(() => db.modifiers.toArray()) || [];
  const [editingModifierId, setEditingModifierId] = useState<string | null>(null);
  const [modifierName, setModifierName] = useState('');
  const [modifierDelta, setModifierDelta] = useState('');
  const [showModifierForm, setShowModifierForm] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getUserPin = (userId: string) => {
    const setting = appSettings.find((s) => s.key === `pin:${userId}`);
    return setting ? (setting.value as string) : 'Belum diatur';
  };

  // ─── User & PIN Actions ───
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

      // Update PIN if entered
      if (userPin.trim()) {
        await db.appSettings.put({ key: `pin:${uId}`, value: userPin });
      }

      // Queue Sync if needed
      await enqueueMutation('rawMaterial', uId, editingUserId ? 'update' : 'insert', { user: userData, pin: userPin });

      // Reset
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

  // ─── Category Actions ───
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

      // Reset
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

  // ─── Modifier Actions ───
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

      // Reset
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {[
          { id: 'users', label: 'Kelola PIN & User' },
          { id: 'categories', label: 'Kelola Kategori Menu' },
          { id: 'modifiers', label: 'Kelola Tambahan (Modifiers)' },
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

      {/* Tab: Users & PINs */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Pengaturan PIN Login Sesi</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Ubah PIN untuk Owner, Admin, Kasir, dan Chef untuk masuk ke sesi tablet POS secara offline.
              </p>
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
              + Tambah Karyawan / User
            </button>
          </div>

          {showUserForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingUserId ? 'Edit User & PIN' : 'Tambah User & PIN Baru'}</h4>
              <form onSubmit={handleSaveUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Role / Jabatan</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as any)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="cashier">Kasir (Cashier)</option>
                    <option value="chef">Koki (Chef)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>PIN Login (4 Digit Angka)</label>
                  <input
                    type="text"
                    maxLength={4}
                    pattern="[0-9]*"
                    placeholder="Masukkan PIN baru"
                    value={userPin}
                    onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px' }}>Status Akun</label>
                  <select
                    value={userStatus ? 'active' : 'inactive'}
                    onChange={(e) => setUserStatus(e.target.value === 'active')}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowUserForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Batal
                  </button>
                  <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}>
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama</th>
                <th style={{ padding: '12px 8px' }}>Role</th>
                <th style={{ padding: '12px 8px' }}>PIN Login</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{u.name}</td>
                  <td style={{ padding: '12px 8px', textTransform: 'uppercase', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{u.role}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: '700' }}>{getUserPin(u.id)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ color: u.isActive ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => triggerEditUser(u)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                      Ubah PIN & Data
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Categories */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Kelola Kategori Menu</h3>
            <button
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryName('');
                setCategorySort('');
                setShowCategoryForm(true);
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
              + Kategori Baru
            </button>
          </div>

          {showCategoryForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingCategoryId ? 'Edit Kategori' : 'Tambah Kategori'}</h4>
              <form onSubmit={handleSaveCategory} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                  <label style={{ fontSize: '13px' }}>Nama Kategori</label>
                  <input
                    type="text"
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px' }}>Order Tampilan</label>
                  <input
                    type="number"
                    value={categorySort}
                    onChange={(e) => setCategorySort(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '12px 24px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}>
                  Simpan
                </button>
                <button type="button" onClick={() => setShowCategoryForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '12px', cursor: 'pointer' }}>
                  Batal
                </button>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Kategori</th>
                <th style={{ padding: '12px 8px' }}>Urutan (Sort Order)</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{c.name}</td>
                  <td style={{ padding: '12px 8px' }}>{c.sortOrder}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => triggerEditCategory(c)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteCategory(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Modifiers */}
      {activeTab === 'modifiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Kelola Modifiers & Toppings</h3>
            <button
              onClick={() => {
                setEditingModifierId(null);
                setModifierName('');
                setModifierDelta('');
                setShowModifierForm(true);
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
              + Modifier Baru
            </button>
          </div>

          {showModifierForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
              <h4 style={{ marginBottom: '16px' }}>{editingModifierId ? 'Edit Modifier' : 'Tambah Modifier'}</h4>
              <form onSubmit={handleSaveModifier} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                  <label style={{ fontSize: '13px' }}>Nama Modifier (Tambahan)</label>
                  <input
                    type="text"
                    required
                    value={modifierName}
                    onChange={(e) => setModifierName(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px' }}>Harga Ekstra (Rp)</label>
                  <input
                    type="number"
                    required
                    value={modifierDelta}
                    onChange={(e) => setModifierDelta(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <button type="submit" style={{ background: 'var(--primary)', color: 'var(--text-primary)', border: 'none', padding: '12px 24px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}>
                  Simpan
                </button>
                <button type="button" onClick={() => setShowModifierForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '12px', cursor: 'pointer' }}>
                  Batal
                </button>
              </form>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Nama Modifier</th>
                <th style={{ padding: '12px 8px' }}>Biaya Ekstra</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {modifiers.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{m.name}</td>
                  <td style={{ padding: '12px 8px', fontWeight: '600', color: 'var(--primary)' }}>+{formatCurrency(Number(m.priceDelta))}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => triggerEditModifier(m)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '12px' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteModifier(m.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
