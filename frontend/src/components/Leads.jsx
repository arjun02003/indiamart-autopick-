import { useEffect, useState } from 'react';
import { getLeads, acceptLead, skipLead, exportLeads } from '../services/api';
import { useLeadSystem } from '../context/LeadContext';

export default function Leads() {
  const { refreshStats, addNotification } = useLeadSystem();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const limit = 25;

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await getLeads({ page, limit, search, status });
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (error) {
      addNotification('error', `Failed to load leads: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [page, search, status]);

  const handleAccept = async (id) => {
    try {
      await acceptLead(id);
      addNotification('success', 'Lead accepted successfully.');
      refreshStats();
      loadLeads();
    } catch (error) {
      addNotification('error', `Accept failed: ${error.message}`);
    }
  };

  const handleSkip = async (id) => {
    try {
      await skipLead(id);
      addNotification('success', 'Lead skipped successfully.');
      refreshStats();
      loadLeads();
    } catch (error) {
      addNotification('error', `Skip failed: ${error.message}`);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="leads-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Leads</h2>
          <p className="page-subtitle">Review, accept, or skip leads collected by the system.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-success" onClick={() => exportLeads('csv', status)}>
            Export CSV
          </button>
          <button className="btn btn-outline" onClick={() => exportLeads('json', status)}>
            Export JSON
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem' }}>
        <input
          className="form-control"
          type="search"
          value={search}
          placeholder="Search leads by name, company, product, country, or mobile"
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />
        <select
          className="form-control"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="">All statuses</option>
          <option value="Accepted">Accepted</option>
          <option value="Skipped">Skipped</option>
          <option value="Pending">Pending</option>
        </select>
        <div style={{ textAlign: 'right', color: 'var(--text-muted)', alignSelf: 'center' }}>
          Total leads: {total}
        </div>
      </div>

      <div className="glass-panel table-container">
        {loading ? (
          <div className="spinner" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Country</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem 0' }}>
                    No leads found.
                  </td>
                </tr>
              ) : leads.map((lead) => (
                <>
                  <tr
                    key={lead.id}
                    className="lead-row"
                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                  >
                    <td>{lead.id}</td>
                    <td>{lead.customer_name || lead.company_name || '—'}</td>
                    <td>{lead.product || '—'}</td>
                    <td>{lead.country || '—'}</td>
                    <td>
                      <span className={`badge ${lead.status === 'Accepted' ? 'badge-success' : lead.status === 'Skipped' ? 'badge-danger' : 'badge-muted'}`}>
                        {lead.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); handleAccept(lead.id); }}>
                        Accept
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleSkip(lead.id); }}>
                        Skip
                      </button>
                    </td>
                  </tr>
                  {expandedId === lead.id && (
                    <tr className="lead-detail-row">
                      <td colSpan="6">
                        <div className="lead-detail">
                          <div><strong>Company</strong><br />{lead.company_name || '—'}</div>
                          <div><strong>Mobile</strong><br />{lead.mobile || '—'}</div>
                          <div><strong>Email</strong><br />{lead.email || '—'}</div>
                          <div><strong>Quantity</strong><br />{lead.quantity || '—'}</div>
                          <div style={{ gridColumn: '1 / -1' }}><strong>Message</strong><br />{lead.message || '—'}</div>
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

      <div className="pagination">
        <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </button>
        <span>Page {page} of {pages}</span>
        <button className="btn btn-outline" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
          Next
        </button>
      </div>
    </div>
  );
}
