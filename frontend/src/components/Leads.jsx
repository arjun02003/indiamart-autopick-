import { useState, useEffect, useCallback, Fragment } from 'react';
import { getLeads, acceptLead, skipLead, exportLeads, removeDuplicates, rescoreLeads, clearLeads } from '../services/api';
import { useLeadSystem } from '../context/LeadContext';

const STATUS_COLORS = {
  Accepted: 'badge-success',
  Skipped : 'badge-danger',
  Pending : 'badge-warning',
};

const PRIORITY_CONFIG = {
  High:   { cls: 'priority-high',   icon: '🔥', label: 'High' },
  Medium: { cls: 'priority-medium', icon: '⭐', label: 'Medium' },
  Low:    { cls: 'priority-low',    icon: '—',   label: 'Low' },
};

const SCORE_COLOR = (s) => s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';

const PHARMA_COUNTRIES = [
  'USA', 'UK', 'UAE', 'Germany', 'Australia', 'Canada', 'Singapore',
  'Saudi Arabia', 'South Africa', 'Nigeria', 'Kenya', 'Malaysia',
  'France', 'Italy', 'Netherlands', 'Brazil', 'Mexico', 'Japan',
  'South Korea', 'Qatar', 'Kuwait', 'Oman', 'Bahrain',
  'Bangladesh', 'Nepal', 'Sri Lanka', 'Philippines', 'Vietnam',
  'Indonesia', 'Thailand', 'Egypt', 'Morocco', 'Russia',
];

export default function Leads() {
  const { addNotification, refreshStats } = useLeadSystem();
  const [leads,    setLeads]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('');
  const [country,  setCountry]  = useState('');
  const [medicine, setMedicine] = useState('');
  const [priority, setPriority] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [sort,     setSort]     = useState('newest');
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [removing, setRemoving] = useState(false);
  const LIMIT = 25;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeads({ page, limit: LIMIT, search, status: filter, country, medicine, priority, min_score: minScore, sort });
      setLeads(data.leads);
      setTotal(data.total);
    } catch (e) {
      addNotification('error', 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, country, medicine, priority, minScore, sort, addNotification]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(1); }, [search, filter, country, medicine, priority, minScore, sort]);

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

  const handleRemoveDuplicates = async () => {
    setRemoving(true);
    try {
      const r = await removeDuplicates();
      addNotification('success', r.message || 'Duplicates removed');
      fetchLeads(); refreshStats();
    } catch (e) { addNotification('error', e.message); }
    finally { setRemoving(false); }
  };

  const handleClearLeads = async () => {
    if (!window.confirm('⚠️ Are you sure you want to delete all leads from the database? This cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      await clearLeads();
      addNotification('success', 'All leads cleared & counter reset');
      fetchLeads(); refreshStats();
    } catch (e) { addNotification('error', e.message); }
    finally { setLoading(false); }
  };

  const handleRescore = async () => {
    try {
      const r = await rescoreLeads();
      addNotification('success', r.message || 'Leads re-scored!');
      fetchLeads();
    } catch (e) { addNotification('error', e.message); }
  };

  const whatsappUrl = (mobile) => {
    const clean = (mobile || '').replace(/\D/g, '');
    return `https://wa.me/${clean.startsWith('91') ? clean : '91' + clean}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const ScoreBar = ({ score }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `conic-gradient(${SCORE_COLOR(score)} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.65rem', fontWeight: 700, color: SCORE_COLOR(score),
        flexShrink: 0,
      }}>
        {score}
      </div>
    </div>
  );

  return (
    <div className="leads-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Lead Management</h2>
          <p className="page-subtitle">{total} total leads found</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={handleRescore} title="Re-calculate AI scores for all leads">🤖 Re-Score</button>
          <button className="btn btn-outline btn-sm" onClick={handleRemoveDuplicates} disabled={removing}>
            {removing ? '⏳ Removing…' : '🔄 Remove Dupes'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => exportLeads('csv',   filter, priority)}>⬇ CSV</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportLeads('excel', filter, priority)}>⬇ Excel</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportLeads('json',  filter, priority)}>⬇ JSON</button>
          <button className="btn btn-danger btn-sm" onClick={handleClearLeads} title="Delete all leads from database">🗑️ Clear Leads</button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="glass-panel filter-bar">
        <input
          id="lead-search"
          type="text"
          placeholder="🔍 Search by name, product, country, mobile…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <select id="lead-filter-status" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Accepted">Accepted</option>
          <option value="Skipped">Skipped</option>
          <option value="Pending">Pending</option>
        </select>
        <select id="lead-filter-country" value={country} onChange={e => setCountry(e.target.value)}>
          <option value="">All Countries</option>
          {PHARMA_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select id="lead-filter-priority" value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">All Priority</option>
          <option value="High">🔥 High</option>
          <option value="Medium">⭐ Medium</option>
          <option value="Low">— Low</option>
        </select>
        <select id="lead-filter-sort" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">📅 Newest First</option>
          <option value="score">🎯 Score First</option>
        </select>
        <input
          type="text"
          placeholder="💊 Medicine keyword"
          value={medicine}
          onChange={e => setMedicine(e.target.value)}
          style={{ flex: '0 1 160px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 0 auto' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Min Score: {minScore}</span>
          <input type="range" min="0" max="100" step="5" value={minScore} onChange={e => setMinScore(+e.target.value)} style={{ width: 80 }} />
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchLeads}>🔄</button>
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
                <th>Time</th>
                <th>Score</th>
                <th>Priority</th>
                <th>Customer</th>
                <th>Medicine / Product</th>
                <th>Qty</th>
                <th>Country</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No leads found.</td></tr>
              ) : leads.map(lead => {
                const pc = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.Low;
                const tags = (() => { try { return JSON.parse(lead.tags || '[]'); } catch { return []; } })();
                return (
                  <Fragment key={lead.id}>
                    <tr className={`lead-row ${lead.priority === 'High' ? 'priority-row' : ''}`} onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(lead.timestamp).toLocaleDateString()}<br/>
                        <span style={{ fontSize: '0.7rem' }}>{new Date(lead.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td><ScoreBar score={lead.ai_score || 0} /></td>
                      <td>
                        <span className={`priority-badge ${pc.cls}`}>
                          {pc.icon} {pc.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{lead.customer_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.company_name}</div>
                      </td>
                      <td style={{ maxWidth: '180px' }}>
                        {lead.medicine_name && <div style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600 }}>💊 {lead.medicine_name}</div>}
                        <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.product}</div>
                      </td>
                      <td><span className="badge badge-info">{lead.quantity > 0 ? lead.quantity : '—'}</span></td>
                      <td>{lead.country}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {lead.mobile && <div>📞 {lead.mobile}</div>}
                        {lead.email  && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>✉️ {lead.email}</div>}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[lead.status] || 'badge-muted'}`}>{lead.status}</span>
                        {lead.replied ? <span className="badge badge-success" style={{ display: 'block', marginTop: '0.2rem', width: 'fit-content' }}>💬 Replied</span> : null}
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {lead.status !== 'Accepted' && (
                              <button className="btn btn-sm btn-success" onClick={() => handleAccept(lead.id)}>✅</button>
                            )}
                            {lead.status !== 'Skipped' && (
                              <button className="btn btn-sm btn-danger" onClick={() => handleSkip(lead.id)}>⏭</button>
                            )}
                            <a
                              href={`https://seller.indiamart.com/#/leadmanager/contactlist?id=${lead.lead_id}`}
                              target="_blank" rel="noreferrer"
                              className="btn btn-sm btn-outline"
                              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                            >👁️</a>
                          </div>
                          {lead.mobile && (
                            <a
                              href={whatsappUrl(lead.mobile)}
                              target="_blank" rel="noreferrer"
                              className="btn btn-sm btn-whatsapp"
                              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.25rem' }}>
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === lead.id && (
                      <tr className="lead-detail-row">
                        <td colSpan="10">
                          <div className="lead-detail">
                            <div><strong>Lead ID:</strong> {lead.lead_id}</div>
                            <div><strong>Reason:</strong> {lead.reason || '—'}</div>
                            <div><strong>AI Score:</strong> {lead.ai_score}/100 | Priority: {lead.priority}</div>
                            <div><strong>Medicine:</strong> {lead.medicine_name || '—'}</div>
                            <div><strong>Call Details:</strong> {lead.call_details || '—'}</div>
                            <div><strong>Message:</strong> {lead.message || '—'}</div>
                            <div><strong>Timestamp:</strong> {new Date(lead.timestamp).toLocaleString()}</div>
                            {tags.length > 0 && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <strong>Tags: </strong>
                                {tags.map(t => <span key={t} className="tag" style={{ marginLeft: '0.25rem' }}>{t}</span>)}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            return p <= totalPages ? (
              <button key={p} className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>{p}</button>
            ) : null;
          })}
          <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Page {page} of {totalPages} ({total} leads)</span>
        </div>
      )}
    </div>
  );
}
