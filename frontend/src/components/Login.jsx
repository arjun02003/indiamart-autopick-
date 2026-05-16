import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Simulate slight network delay for premium feel
    setTimeout(async () => {
      const success = await login(password);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid credentials. Please try again.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <div className="login-header">
          <div className="logo-icon">🚀</div>
          <h2>Premium Access</h2>
          <p>IndiaMART Lead Automation Service</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input 
              type="password" 
              placeholder="Access Key / Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary login-btn" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : (
              <>
                Login to Dashboard <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Private & Secure System</p>
        </div>
      </div>
      
      {/* Dynamic Background Elements */}
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
      <div className="bg-shape shape-3"></div>
    </div>
  );
}
