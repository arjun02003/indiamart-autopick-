import { useState, useEffect, useCallback } from 'react';
import { getLeads, acceptLead, skipLead, exportLeads } from '../services/api';
import { useLeadSystem } from '../context/LeadContext';

const STATUS_COLORS = {
  Accepted: 'badge-success',
  Skipped : 'badge-danger',
  Pending : 'badge-warning',
};

export default function Leads() {
  const { addNotification, refreshStats } = useLeadSystem();
  const [leads,   setLeads]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const LIMIT = 25;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeads({ page, limit: LIMIT, search, status: filter });
      setLeads(data.leads);
      setTotal(data.total);
    } catch (e) {
      addNotification('error', 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, addNotification]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Reset page when search/filter changes
  useEffect(() => { setPage(1); }, [search, filter]);

  const handleAccept = async (id) => {
    try {
      await acceptLead(id);
      addNotification('success', 'Lead accepted & reply sent!');
      fetchLeads(); refreshStats();
    } catch (e) { addNotification('error', e.message); }
  };

  const handleSkip = async (id) => {
    try {
      await skipLead(id);
      addNotification('info', 'Lead skipped.');
      fetchLeads(); refreshStats();
    } catch (e) { addNotification('error', e.message); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="leads-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Lead Management</h2>
          <p className="page-subtitle">{total} total leads found</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => exportLeads('csv', filter)}>⬇️ Export CSV</button>
          <button className="btn btn-outline" onClick={() => exportLeads('json', filter)}>⬇️ Export JSON</button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          id="lead-search"
          type="text"
          placeholder="🔍 Search by name, product, country, mobile…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select id="lead-filter" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto', minWidth: '130px' }}>
          <option value="">All Status</option>
          <option value="Accepted">Accepted</option>
          <option value="Skipped">Skipped</option>
          <option value="Pending">Pending</option>
        </select>
        <button className="btn btn-outline" onClick={fetchLeads}>🔄 Refresh</button>
      </div>

      {/* Table */}
      <div className="glass-panel table-container" style={{ marginTop: '0' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem' }}>Loading leads…</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Country</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Replied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No leads found.</td></tr>
              ) : leads.map(lead => (
                <>
                  <tr key={lead.id} className="lead-row" onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{lead.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{lead.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.company_name}</div>
                    </td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.product}</td>
                    <td><span className="badge badge-info">{lead.quantity > 0 ? lead.quantity : '—'}</span></td>
                    <td>{lead.country}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {lead.mobile && <div>📞 {lead.mobile}</div>}
                      {lead.email  && <div>✉️ {lead.email}</div>}
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[lead.status] || 'badge-muted'}`}>{lead.status}</span></td>
                    <td>
                      {lead.replied 
                        ? <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>✅ Yes</span> 
                        : <span className="badge badge-muted" style={{ color: '#64748b' }}>No</span>
                      }
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      {lead.status !== 'Accepted' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleAccept(lead.id)}>Accept</button>
                      )}
                      {lead.status !== 'Skipped' && (
                        <button className="btn btn-sm btn-danger" style={{ marginLeft: '0.5rem' }} onClick={() => handleSkip(lead.id)}>Skip</button>
                      )}
                    </td>
                  </tr>
                  {expanded === lead.id && (
                    <tr key={`${lead.id}-detail`} className="lead-detail-row">
                      <td colSpan="9">
                        <div className="lead-detail">
                          <div><strong>Lead ID:</strong> {lead.lead_id}</div>
                          <div><strong>Reason:</strong> {lead.reason || '—'}</div>
                          <div><strong>Message:</strong> {lead.message || '—'}</div>
                          <div><strong>Timestamp:</strong> {new Date(lead.timestamp).toLocaleString()}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
