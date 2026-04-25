import { useLeadSystem } from '../context/LeadContext';

export default function ActivityLog() {
  const { leads } = useLeadSystem();

  return (
    <div className="activity-log">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Activity Log</h2>
        <span style={{ color: 'var(--text-muted)' }}>Showing last {leads.length} leads</span>
      </div>

      <div className="glass-panel table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Country</th>
              <th>Contact Details</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No leads processed yet.
                </td>
              </tr>
            ) : (
              leads.map(lead => (
                <tr key={lead.lead_id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(lead.timestamp).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{lead.customer_name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{lead.company_name}</div>
                  </td>
                  <td>{lead.product}</td>
                  <td><span className="badge" style={{background: 'var(--primary)', color: 'white'}}>{lead.quantity || 1}</span></td>
                  <td>{lead.country}</td>
                  <td>{lead.contact_details}</td>
                  <td>
                    <span className={`badge ${lead.status.toLowerCase()}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {lead.reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
