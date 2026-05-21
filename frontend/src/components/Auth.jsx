import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [email,    setEmail]    = useState('admin@leadmed.com');
  const [password, setPassword] = useState('admin123');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await loginWithGoogle(); // auto-login as admin
    navigate('/');
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1e1b4b, #0a0f1e)',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'rgba(99,102,241,0.15)', filter:'blur(80px)', top:'-10%', left:'-10%' }} />
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'rgba(139,92,246,0.15)', filter:'blur(80px)', bottom:'10%', right:'-5%' }} />

      <div className="glass-panel" style={{ maxWidth:400, width:'100%', padding:'2.5rem', textAlign:'center', zIndex:10, animation:'float-up 0.6s ease-out' }}>

        {/* Logo */}
        <div style={{ fontSize:'3.5rem', marginBottom:'0.5rem' }}>💊</div>
        <h1 style={{
          fontSize:'1.7rem', fontWeight:700, marginBottom:'0.35rem',
          background:'linear-gradient(135deg, #a5b4fc, #c084fc)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        }}>LeadMed Pro</h1>
        <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:'2rem' }}>
          IndiaMART Lead Automation Dashboard
        </p>

        {error && (
          <div style={{ background:'rgba(239,68,68,0.1)', color:'#fca5a5', padding:'0.75rem', borderRadius:'8px', marginBottom:'1.25rem', fontSize:'0.88rem', border:'1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ textAlign:'left' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ textAlign:'left' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'0.85rem', justifyContent:'center', fontSize:'1rem' }} disabled={loading}>
            {loading ? '⏳ Signing In…' : '🚀 Sign In'}
          </button>
        </form>

        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', margin:'1.25rem 0' }}>
          <hr style={{ flex:1, border:'none', borderTop:'1px solid rgba(255,255,255,0.08)' }} />
          <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>OR</span>
          <hr style={{ flex:1, border:'none', borderTop:'1px solid rgba(255,255,255,0.08)' }} />
        </div>

        {/* One-click entry */}
        <button onClick={handleSkip} className="btn btn-outline" style={{ width:'100%', padding:'0.75rem', justifyContent:'center' }}>
          ⚡ Quick Access (Skip Login)
        </button>

        <p style={{ marginTop:'1.5rem', fontSize:'0.75rem', color:'var(--text-muted)' }}>
          Default: any email + any password works
        </p>
      </div>
    </div>
  );
}
