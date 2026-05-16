import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="login-container" style={{
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white',
      textAlign: 'center'
    }}>
      <div className="glass-panel" style={{ padding: '3rem', borderRadius: '1.5rem', maxWidth: '400px' }}>
        <img src="/logo512.png" alt="Logo" style={{ width: '80px', marginBottom: '1.5rem' }} />
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Welcome Back</h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Sign in with your Google account to access the Lead Dashboard</p>
        
        <button 
          onClick={loginWithGoogle}
          className="btn btn-primary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            padding: '0.75rem 1.5rem',
            width: '100%',
            justifyContent: 'center',
            fontSize: '1rem'
          }}
        >
          <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="G" style={{ width: '24px' }} />
          Continue with Google
        </button>
        
        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          Private & Secure Lead Management System
        </p>
      </div>
    </div>
  );
}
