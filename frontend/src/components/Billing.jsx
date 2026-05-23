import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { upgradeSubscription, cancelSubscription } from '../services/api';

export default function Billing() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isPremium = user?.subscription_status === 'active';

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await upgradeSubscription();
      if (res.success) {
        updateUser({ ...user, subscription_status: 'active' });
        setSuccess('🎉 Successfully upgraded to Premium PRO! Auto Mode worker has been unlocked.');
      } else {
        setError(res.error || 'Upgrade failed');
      }
    } catch (err) {
      setError(err.message || 'Server error occurred during checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your Premium Subscription? This will stop your Auto-Mode automated background worker.')) {
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await cancelSubscription();
      if (res.success) {
        updateUser({ ...user, subscription_status: 'inactive' });
        setSuccess('Subscription cancelled. Your account has returned to the Free plan.');
      } else {
        setError(res.error || 'Cancellation failed');
      }
    } catch (err) {
      setError(err.message || 'Server error occurred during subscription update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">Subscription & Billing</h2>
          <div className="page-subtitle">Manage your plan, billing cycle, and unlock automated worker capabilities.</div>
        </div>
      </div>

      {error && <div className="alert-banner alert-danger">⚠️ {error}</div>}
      {success && <div className="alert-banner alert-success">✅ {success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {/* Plan status card */}
        <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Current Plan</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                {isPremium ? (
                  <>
                    <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Premium PRO</span>
                    <span className="priority-badge priority-medium">ACTIVE</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Free Starter</span>
                    <span className="priority-badge priority-low">LIMITED</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {isPremium ? '$29 / month' : '$0 / forever'}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
              {isPremium
                ? 'Your Premium PRO plan is active. The background automation worker is currently running or ready to run according to your interval settings. Thank you for supporting LeadMed!'
                : 'You are on the Free Starter plan. To activate "Auto Mode" and run automated background polling of IndiaMART inquiries, please upgrade your subscription.'}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {isPremium ? (
              <button
                className="btn btn-outline"
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Cancel Subscription'}
              </button>
            ) : (
              <button
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                  color: 'white',
                  fontWeight: 600,
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                }}
                onClick={handleUpgrade}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Upgrade to Premium PRO'}
              </button>
            )}
          </div>
        </div>

        {/* Feature comparison card */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem' }}>Plan Feature Comparison</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--panel-border)', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 500 }}>Lead Capture via Chrome Extension</span>
              <span style={{ color: 'var(--success)' }}>✅ Included</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--panel-border)', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 500 }}>AI Lead Scoring & Analysis</span>
              <span style={{ color: 'var(--success)' }}>✅ Included</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--panel-border)', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 500 }}>Telegram Notifications & Alerts</span>
              <span style={{ color: 'var(--success)' }}>✅ Included</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--panel-border)', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 500 }}>Automatic Replies</span>
              <span style={{ color: 'var(--success)' }}>✅ Included</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--panel-border)', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 500 }}>Auto-Mode Background Automation Worker</span>
              {isPremium ? (
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>✅ UNLOCKED & ACTIVE</span>
              ) : (
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>❌ LOCKED (Requires Premium PRO)</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--panel-border)', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 500 }}>Priority Support & High-Frequency Polling</span>
              {isPremium ? (
                <span style={{ color: 'var(--success)' }}>✅ Enabled</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>❌ Disabled</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
