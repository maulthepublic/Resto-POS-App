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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('resto_pos_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('resto_pos_theme', theme);
  }, [theme]);

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
      <div
        className="page-shell page-login"
        style={{
          display: 'flex',
          minHeight: '100dvh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
        }}
      >
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
    <div
      className="app-shell"
      style={{
        display: 'flex',
        minHeight: '100dvh',
        background: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Background grid overlay */}
      <div className="bg-grid-overlay" />
      
      {/* Sidebar navigation */}
      <aside
        className="sidebar-shell"
        style={{
          width: '280px',
          backgroundColor: 'var(--bg-glass)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid var(--border-color)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '32px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Brand header */}
          <div className="brand-lockup">
            <h2 style={{ 
              color: 'var(--text-primary)', 
              fontFamily: 'var(--font-display)', 
              fontSize: '26px', 
              letterSpacing: '-0.02em', 
              fontWeight: 700,
              background: 'linear-gradient(to right, var(--text-primary), var(--primary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Resto POS
            </h2>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginTop: '12px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '999px'
            }}>
              <span className="status-badge-pulse" style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--success)',
                color: 'var(--success)'
              }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.02em' }}>
                {currentUser.name} <span style={{ color: 'var(--text-muted)', fontSize: '9px', marginLeft: '2px' }}>({currentUser.role.toUpperCase()})</span>
              </span>
            </div>
          </div>

          {/* Navigation links filtered by RBAC */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navigationItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    background: isActive ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    fontWeight: isActive ? '600' : '500',
                    boxShadow: isActive ? '0 8px 24px rgba(99, 102, 241, 0.3)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span style={{ 
                      fontSize: '11px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.18)', 
                      padding: '2px 6px', 
                      borderRadius: '6px',
                      fontWeight: 700 
                    }}>•</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout panel */}
        <button
          onClick={logout}
          style={{
            background: 'rgba(239, 68, 68, 0.06)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            padding: '12px 18px',
            borderRadius: '14px',
            cursor: 'pointer',
            fontWeight: '600',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            transition: 'all var(--transition-fast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          Keluar (Logout)
        </button>
      </aside>

      {/* Main Area */}
      <div className="main-shell" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        
        {/* Connection & Status Banner */}
        <header
          className="topbar-shell"
          style={{
            height: '82px',
            backgroundColor: 'var(--bg-glass)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 5,
          }}
        >
          {/* Left: Active Module Name */}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', textTransform: 'capitalize', letterSpacing: '-0.01em', fontWeight: 650 }}>
            {activeTab === 'dapur' ? 'Dapur (KDS)' : activeTab === 'cms' ? 'Admin Panel' : activeTab}
          </h2>

          {/* Right: Network status simulator and sync queue count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            
            {/* Sync Queue Badge indicator */}
            {syncQueueCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    color: 'var(--warning)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <span className="status-badge-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--warning)', color: 'var(--warning)' }} />
                  {syncQueueCount} Data Menunggu Sync
                </span>
                {!isOffline && (
                  <button
                    onClick={handleForceSyncSimulation}
                    className="btn-pill-secondary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                    }}
                  >
                    Sync Sekarang
                  </button>
                )}
              </div>
            )}

            {/* Simulated status indicator */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '999px'
            }}>
              <span
                className="status-badge-pulse"
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isOffline ? 'var(--danger)' : 'var(--success)',
                  color: isOffline ? 'var(--danger)' : 'var(--success)'
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: '700', color: isOffline ? 'var(--danger)' : 'var(--success)', letterSpacing: '0.04em' }}>
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>

            {/* Simulator network switcher */}
            <button
              onClick={toggleNetwork}
              style={{
                background: isOffline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: isOffline ? 'var(--success)' : 'var(--danger)',
                border: isOffline ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                padding: '9px 18px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isOffline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isOffline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {isOffline ? 'Hubungkan Internet' : 'Putuskan Internet'}
            </button>

            {/* Theme Switcher Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '9px 18px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </header>

        {/* Content body wrapper */}
        <div className="content-shell" style={{ flex: 1, padding: '42px', overflowY: 'auto' }}>
          {renderActivePage()}
        </div>

      </div>
    </div>
  );
}

export default App;
