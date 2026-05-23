import { useState, useEffect } from 'react';
import { getAdminUsers, togglePremiumUser, deleteUser, createUserAdmin } from '../services/api';
import { useLeadSystem } from '../context/LeadContext';
import { useAuth } from '../context/AuthContext';

export default function AdminPanel() {
  const { addNotification } = useLeadSystem();
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // New User Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      if (data && data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      addNotification('error', `Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addNotification('warning', 'Email and password are required');
      return;
    }
    
    setSubmitLoading(true);
    try {
      const res = await createUserAdmin(email, password, role, subscriptionStatus);
      if (res && res.success) {
        addNotification('success', `User account created successfully for ${email}`);
        // Reset form
        setEmail('');
        setPassword('');
        setRole('viewer');
        setSubscriptionStatus('inactive');
        // Refresh list
        fetchUsers();
      }
    } catch (err) {
      addNotification('error', `Failed to create user: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleTogglePremium = async (id, currentEmail) => {
    try {
      const res = await togglePremiumUser(id);
      if (res && res.success) {
        addNotification('success', `Subscription status for ${currentEmail} set to ${res.subscription_status.toUpperCase()}`);
        fetchUsers();
      }
    } catch (err) {
      addNotification('error', `Failed to toggle premium: ${err.message}`);
    }
  };

  const handleDeleteUser = async (id, email) => {
    if (id === currentUser?.id) {
      addNotification('error', 'You cannot delete your own admin account.');
      return;
    }
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete user "${email}"? All their leads, logs, and settings will be permanently destroyed. This cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await deleteUser(id);
      if (res && res.success) {
        addNotification('success', `Deleted user account ${email}`);
        fetchUsers();
      }
    } catch (err) {
      addNotification('error', `Failed to delete user: ${err.message}`);
    }
  };

  // Helper Stats
  const totalUsers = users.length;
  const premiumUsersCount = users.filter(u => u.subscription_status === 'active').count || users.filter(u => u.subscription_status === 'active').length;
  const adminUsersCount = users.filter(u => u.role === 'admin').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">👥 User Management & Control</h2>
          <div className="page-subtitle">Add/remove student accounts, manage roles, and activate premium features.</div>
        </div>
      </div>

      {/* Admin stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>👥</div>
          <div className="stat-title">Total Provisions</div>
          <div className="stat-value total">{totalUsers}</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>👑</div>
          <div className="stat-title">Premium Students</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{premiumUsersCount}</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>🛡️</div>
          <div className="stat-title">Administrators</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{adminUsersCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Provision New Account Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ➕ Create New Student/User Account
          </h3>
          
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="user-email">Email Address</label>
              <input
                id="user-email"
                type="email"
                placeholder="student@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="user-password">Initial Password</label>
              <input
                id="user-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="user-role">System Role</label>
                <select id="user-role" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="viewer">Student/Viewer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-status">Premium status</label>
                <select id="user-status" value={subscriptionStatus} onChange={e => setSubscriptionStatus(e.target.value)}>
                  <option value="inactive">Free (Locked Auto-Mode)</option>
                  <option value="active">Premium (Full Access)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={submitLoading}>
              {submitLoading ? '⏳ Provisioning Account...' : '🚀 Create Account'}
            </button>
          </form>
        </div>

        {/* Existing Users List */}
        <div className="glass-panel" style={{ padding: '2rem', minHeight: '350px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📋 Provisioned Accounts List
          </h3>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem' }}>Loading user base...</p>
            </div>
          ) : (
            <div className="table-container" style={{ margin: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>User Details</th>
                    <th>Auto Mode</th>
                    <th>Premium Status</th>
                    <th>Leads</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No users configured.
                      </td>
                    </tr>
                  ) : (
                    users.map(u => {
                      const isSelf = u.id === currentUser?.id;
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                          <td style={{ padding: '1rem 0.5rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                              {u.email} {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--info)' }}>(You)</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Role: <span style={{ textTransform: 'capitalize', color: u.role === 'admin' ? 'var(--purple)' : 'var(--text-muted)' }}>{u.role}</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Joined: {new Date(u.created_at || Date.now()).toLocaleDateString()}
                            </div>
                          </td>
                          <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                            {u.is_running ? (
                              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                                <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> RUNNING
                              </span>
                            ) : (
                              <span className="badge badge-muted" style={{ fontSize: '0.75rem' }}>IDLE</span>
                            )}
                          </td>
                          <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleTogglePremium(u.id, u.email)}
                              className={`btn btn-sm ${u.subscription_status === 'active' ? 'btn-success' : 'btn-outline'}`}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.6rem',
                                minWidth: '85px',
                                justifyContent: 'center',
                                background: u.subscription_status === 'active' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent'
                              }}
                            >
                              {u.subscription_status === 'active' ? '👑 Premium' : 'Free Starter'}
                            </button>
                          </td>
                          <td style={{ padding: '1rem 0.5rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--info)' }}>
                            {u.leads_count || 0}
                          </td>
                          <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              disabled={isSelf}
                              style={{
                                color: isSelf ? 'var(--text-muted)' : '#ef4444',
                                borderColor: isSelf ? 'transparent' : 'rgba(239, 68, 68, 0.2)',
                                padding: '0.25rem 0.5rem',
                                opacity: isSelf ? 0.3 : 1
                              }}
                              title={isSelf ? 'Cannot delete logged in account' : 'Delete user account'}
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
