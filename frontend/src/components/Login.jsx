import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        const res = await signup(email, password);
        if (res.success) {
          setIsSignup(false);
          setError('Account created! Please login.');
        } else {
          setError(res.message);
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.message);
        }
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white'
    }}>
      <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '1.5rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo512.png" alt="Logo" style={{ width: '64px', marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem' }}>{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            {isSignup ? 'Join the Premium Lead System' : 'Sign in to your dashboard'}
          </p>
        </div>

        {error && (
          <div style={{ 
            background: error.includes('created') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', 
            color: error.includes('created') ? '#4ade80' : '#f87171',
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>Email Address</label>
            <input 
              type="email" 
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'white' }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>Password</label>
            <input 
              type="password" 
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'white' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold' }}
          >
            {loading ? 'Processing...' : (isSignup ? 'Sign Up' : 'Login')}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: '#64748b' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button 
            onClick={() => setIsSignup(!isSignup)}
            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginLeft: '0.5rem', fontWeight: 'bold' }}
          >
            {isSignup ? 'Login' : 'Create One'}
          </button>
        </div>
      </div>
    </div>
  );
}
