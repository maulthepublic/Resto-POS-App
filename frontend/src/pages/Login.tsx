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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
          backdropFilter: 'blur(10px)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            color: 'var(--primary)',
            marginBottom: '4px',
            textAlign: 'center',
          }}
        >
          RESTO POS
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '32px',
            textAlign: 'center',
          }}
        >
          Masukkan PIN Staf Anda untuk Masuk
        </p>

        {/* Display dots for code */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid var(--primary)',
                backgroundColor:
                  pin.length > index ? 'var(--primary)' : 'transparent',
                boxShadow:
                  pin.length > index ? '0 0 10px var(--primary)' : 'none',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </div>

        {error && (
          <p
            style={{
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: '500',
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
            gap: '16px',
            width: '100%',
            marginBottom: '32px',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={loading}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '24px',
                fontWeight: '600',
                height: '70px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
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
              color: 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: '600',
              height: '70px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            disabled={loading}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '24px',
              fontWeight: '600',
              height: '70px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
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
              color: 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: '600',
              height: '70px',
              cursor: 'pointer',
            }}
          >
            ⌫
          </button>
        </div>

        {/* PIN Info Hints */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '20px',
            width: '100%',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '8px',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Akun Demo Karyawan:
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>1234</strong>: Budi (Owner)
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>1111</strong>: Siti (Kasir)
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>2222</strong>: Agus (Chef)
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>3333</strong>: Rudi (Admin)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
