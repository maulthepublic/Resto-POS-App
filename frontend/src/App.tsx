import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useNetworkStore } from './store/networkStore';
import { seedDatabase } from './db/seed';
import { db } from './db/localSchema';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Kasir } from './pages/Kasir';
import { Keuangan } from './pages/Keuangan';
import { Kds } from './pages/Kds';
import { Laporan } from './pages/Laporan';
import { AdminCms } from './pages/AdminCms';

function App() {
  const { currentUser, checkSession, logout } = useAuthStore();
  const { isOffline, toggleNetwork, syncQueueCount, updateSyncQueueCount } = useNetworkStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbReady, setDbReady] = useState(false);

  // 1. Initial Seeder & Session Check
  useEffect(() => {
    async function init() {
      await seedDatabase();
      checkSession();
      await updateSyncQueueCount();
      setDbReady(true);
    }
    init();
  }, []);

  // 2. Adjust default tab based on user role (RBAC)
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'chef') {
        setActiveTab('dapur');
      } else if (currentUser.role === 'cashier') {
        setActiveTab('kasir');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser]);

  // Simulate pushing mutations when user manually forces push sync
  const handleForceSyncSimulation = async () => {
    if (isOffline) {
      alert('Aktifkan koneksi internet (ONLINE) terlebih dahulu untuk sinkronisasi!');
      return;
    }
    try {
      // Clear pending queue items locally (Simulate uploading successfully to Server)
      await db.syncQueue.where('syncStatus').equals('pending').delete();
      await updateSyncQueueCount();
      alert('Sinkronisasi Berhasil! Semua data antrean lokal ter-upload ke Cloud.');
    } catch (err) {
      console.error(err);
    }
  };

  if (!dbReady) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '18px' }}>
          Menyiapkan database lokal (IndexedDB)...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  // Filter sidebar navigation buttons based on Role-Based Access Control (RBAC)
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', allowedRoles: ['owner', 'admin'] },
    { id: 'kasir', label: 'Kasir (POS)', allowedRoles: ['owner', 'admin', 'cashier'] },
    { id: 'keuangan', label: 'Keuangan', allowedRoles: ['owner'] },
    { id: 'dapur', label: 'Dapur (KDS)', allowedRoles: ['owner', 'admin', 'chef'] },
    { id: 'laporan', label: 'Laporan', allowedRoles: ['owner', 'admin'] },
    { id: 'cms', label: 'Admin Panel', allowedRoles: ['owner', 'admin'] },
  ].filter((item) => item.allowedRoles.includes(currentUser.role));

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigateToKasir={() => setActiveTab('kasir')} />;
      case 'kasir':
        return <Kasir />;
      case 'keuangan':
        return <Keuangan />;
      case 'dapur':
        return <Kds />;
      case 'laporan':
        return <Laporan />;
      case 'cms':
        return <AdminCms />;
      default:
        return <Dashboard onNavigateToKasir={() => setActiveTab('kasir')} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      
      {/* Sidebar navigation */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-color)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Brand header */}
          <div>
            <h2 style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '-0.02em' }}>
              Resto POS
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '500' }}>
                {currentUser.name} ({currentUser.role.toUpperCase()})
              </span>
            </div>
          </div>

          {/* Navigation links filtered by RBAC */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: activeTab === item.id ? 'var(--primary)' : 'transparent',
                  color: activeTab === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  fontWeight: activeTab === item.id ? '600' : '400',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== item.id) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Logout panel */}
        <button
          onClick={logout}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: '600',
            fontFamily: 'var(--font-sans)',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
        >
          Keluar (Logout)
        </button>
      </aside>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* Connection & Status Banner */}
        <header
          style={{
            height: '70px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left: Active Module Name */}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'capitalize' }}>
            {activeTab === 'dapur' ? 'Dapur (KDS)' : activeTab === 'cms' ? 'Admin Panel' : activeTab}
          </h2>

          {/* Right: Network status simulator and sync queue count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            
            {/* Sync Queue Badge indicator */}
            {syncQueueCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: 'var(--warning)',
                    color: '#222',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  {syncQueueCount} Data Menunggu Sync
                </span>
                {!isOffline && (
                  <button
                    onClick={handleForceSyncSimulation}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Sync Sekarang
                  </button>
                )}
              </div>
            )}

            {/* Simulated status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: isOffline ? 'var(--danger)' : 'var(--success)',
                  boxShadow: isOffline ? '0 0 8px var(--danger)' : '0 0 8px var(--success)',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: isOffline ? 'var(--danger)' : 'var(--success)' }}>
                {isOffline ? 'OFFLINE MODE' : 'ONLINE'}
              </span>
            </div>

            {/* Simulator network switcher */}
            <button
              onClick={toggleNetwork}
              style={{
                background: isOffline ? 'var(--success)' : 'var(--danger)',
                color: 'var(--text-primary)',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
            >
              Simulasi {isOffline ? 'Hubungkan Internet' : 'Putuskan Internet'}
            </button>
          </div>
        </header>

        {/* Content body wrapper */}
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
          {renderActivePage()}
        </div>

      </div>
    </div>
  );
}

export default App;
