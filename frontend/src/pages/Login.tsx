import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const [pin, setPin] = useState('');
  const { loginWithPin, error, loading } = useAuthStore();

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        handleLogin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleLogin = async (currentPin: string) => {
    const success = await loginWithPin(currentPin);
    if (!success) {
      setPin(''); // Reset on failure
    }
  };

  return (
    <div
      className="page-shell page-login"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        backgroundColor: 'transparent',
        padding: '24px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div className="bg-grid-overlay" />
      
      {/* Double Bezel Card Outer wrapper */}
      <div
        className="bezel-outer"
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'premium-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* Double Bezel Card Inner wrapper */}
        <div
          className="bezel-inner"
          style={{
            padding: '40px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(10, 16, 30, 0.75)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="badge-eyebrow" style={{ marginBottom: '16px' }}>SECURE ACCESS</div>
          
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              background: 'linear-gradient(to right, #ffffff, var(--primary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px',
              textAlign: 'center',
              letterSpacing: '-0.02em',
            }}
          >
            RESTO POS
          </h1>
          
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginBottom: '32px',
              textAlign: 'center',
            }}
          >
            Masukkan PIN Staf Anda untuk Masuk
          </p>

          {/* Display dots for code */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <div
                  key={index}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: isFilled ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: isFilled ? 'var(--primary)' : 'transparent',
                    boxShadow: isFilled ? '0 0 12px var(--primary-glow), 0 0 4px var(--primary)' : 'none',
                    transition: 'all var(--transition-fast)',
                    transform: isFilled ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              );
            })}
          </div>

          {error && (
            <p
              style={{
                color: 'var(--danger)',
                fontSize: '13px',
                marginBottom: '24px',
                textAlign: 'center',
                fontWeight: '600',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                padding: '8px 16px',
                borderRadius: '8px',
                width: '100%',
              }}
            >
              {error}
            </p>
          )}

          {/* PIN Pad Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              width: '100%',
              marginBottom: '36px',
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(num)}
                disabled={loading}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-primary)',
                  fontSize: '24px',
                  fontWeight: '600',
                  height: '72px',
                  width: '72px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 16px var(--primary-glow)';
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: '600',
                height: '72px',
                cursor: 'pointer',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              Clear
            </button>
            <button
              onClick={() => handleKeyPress('0')}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                color: 'var(--text-primary)',
                fontSize: '24px',
                fontWeight: '600',
                height: '72px',
                width: '72px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.boxShadow = '0 0 16px var(--primary-glow)';
                e.currentTarget.style.transform = 'translateY(-1.5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                fontWeight: '600',
                height: '72px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateX(-1.5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              ⌫
            </button>
          </div>

          {/* PIN Info Hints */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '24px',
              width: '100%',
            }}
          >
            <p
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                marginBottom: '12px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 700,
              }}
            >
              Akun Demo Karyawan:
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 16px',
                fontSize: '12px',
              }}
            >
              <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                <strong style={{ color: '#ffffff' }}>1234</strong>
                <span style={{ color: 'var(--text-muted)' }}>:</span>
                <span>Budi (Owner)</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                <strong style={{ color: '#ffffff' }}>1111</strong>
                <span style={{ color: 'var(--text-muted)' }}>:</span>
                <span>Siti (Kasir)</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                <strong style={{ color: '#ffffff' }}>2222</strong>
                <span style={{ color: 'var(--text-muted)' }}>:</span>
                <span>Agus (Chef)</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                <strong style={{ color: '#ffffff' }}>3333</strong>
                <span style={{ color: 'var(--text-muted)' }}>:</span>
                <span>Rudi (Admin)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
