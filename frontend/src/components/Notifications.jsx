import { useLeadSystem } from '../context/LeadContext';

const TYPE_STYLE = {
  FETCH  : { color: '#60a5fa', icon: '🔄' },
  ACCEPT : { color: '#10b981', icon: '✅' },
  REPLY  : { color: '#a78bfa', icon: '💬' },
  SKIP   : { color: '#f59e0b', icon: '⏭️' },
  INFO   : { color: '#94a3b8', icon: 'ℹ️' },
  ERROR  : { color: '#ef4444', icon: '❌' },
};

export default function Notifications() {
  const { notifications, dismissNotification } = useLeadSystem();

  if (!notifications.length) return null;

  return (
    <div className="toast-container">
      {notifications.map(n => {
        const style = TYPE_STYLE[n.type?.toUpperCase()] || { color: '#94a3b8', icon: '🔔' };
        return (
          <div
            key={n.id}
            className="toast"
            style={{ borderLeft: `3px solid ${style.color}` }}
          >
            <span style={{ fontSize: '1.1rem' }}>{style.icon}</span>
            <span className="toast-msg">{n.message}</span>
            <button className="toast-close" onClick={() => dismissNotification(n.id)}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
