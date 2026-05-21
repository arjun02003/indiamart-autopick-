import { useLeadSystem } from '../context/LeadContext';

const ICONS = {
  success : '✅',
  error   : '❌',
  info    : 'ℹ️',
  warning : '⚠️',
  priority: '🔥',
};
const BORDER_COLORS = {
  success : 'rgba(16,185,129,0.4)',
  error   : 'rgba(239,68,68,0.4)',
  info    : 'rgba(96,165,250,0.4)',
  warning : 'rgba(245,158,11,0.4)',
  priority: 'rgba(239,68,68,0.8)',
};

export default function Notifications() {
  const { notifications, dismissNotification } = useLeadSystem();
  return (
    <div className="toast-container">
      {notifications.map(n => (
        <div
          key={n.id}
          className="toast"
          style={{ borderLeft: `3px solid ${BORDER_COLORS[n.type] || BORDER_COLORS.info}`, animation: 'slide-in 0.3s ease' }}
        >
          <span style={{ fontSize: '1.1rem' }}>{ICONS[n.type] || 'ℹ️'}</span>
          <span className="toast-msg">{n.message}</span>
          <button className="toast-close" onClick={() => dismissNotification(n.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
