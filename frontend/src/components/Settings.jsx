import { useState, useEffect } from 'react';
import { getConfig, saveConfig, uploadCookies, testTelegram, clearLeads, removeDuplicates } from '../services/api';
import { useLeadSystem } from '../context/LeadContext';
import { X } from 'lucide-react';

const COUNTRY_OPTIONS = [
  // Asia Pacific
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  // Middle East
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  // Europe
  { code: 'GB', name: 'UK', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  // Americas
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  // Africa
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
];

const QTY_PRESETS = [0, 10, 50, 100, 500, 1000, 5000, 10000];

const DEFAULT_PRIORITY_KEYWORDS = [
  'urgent', 'bulk', 'large quantity', 'annual contract', 'distributor',
  'government tender', 'hospital', 'pharmacy chain', 'wholesale',
  'registered importer', 'exclusive',
];

export default function Settings() {
  const { addNotification, refreshStats } = useLeadSystem();
  const [cfg, setCfg]             = useState(null);
  const [kwInput, setKwInput]     = useState('');
  const [pkwInput, setPkwInput]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [cookiePaste, setCookiePaste] = useState('');
  const [tgTesting, setTgTesting] = useState(false);
  const [removing, setRemoving]   = useState(false);
  const [copied, setCopied]       = useState(false);

  const token = localStorage.getItem('leadmed_token') || '';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification('success', '📋 API Token copied to clipboard!');
  };

  useEffect(() => {
    getConfig().then(c => {
      setCfg({
        ...c,
        keywords          : JSON.parse(c.keywords           || '[]'),
        countries         : JSON.parse(c.countries          || '[]'),
        priority_keywords : JSON.parse(c.priority_keywords  || '[]'),
      });
    }).catch(() => addNotification('error', 'Failed to load config'));
  }, []);

  if (!cfg) return <div style={{ padding: '3rem', color: 'var(--text-muted)' }}>Loading settings…</div>;

  const set = (key, val) => setCfg(p => ({ ...p, [key]: val }));

  const addKeyword = (e) => {
    e.preventDefault();
    const kw = kwInput.trim();
    if (kw && !cfg.keywords.includes(kw)) { set('keywords', [...cfg.keywords, kw]); setKwInput(''); }
  };
  const addPriorityKeyword = (e) => {
    e.preventDefault();
    const kw = pkwInput.trim();
    if (kw && !cfg.priority_keywords.includes(kw)) { set('priority_keywords', [...cfg.priority_keywords, kw]); setPkwInput(''); }
  };
  const removeKeyword = (kw) => set('keywords', cfg.keywords.filter(k => k !== kw));
  const removePkw = (kw) => set('priority_keywords', cfg.priority_keywords.filter(k => k !== kw));
  const toggleCountry = (name) => {
    set('countries', cfg.countries.includes(name)
      ? cfg.countries.filter(c => c !== name)
      : [...cfg.countries, name]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig({
        keywords          : cfg.keywords,
        countries         : cfg.countries,
        priority_keywords : cfg.priority_keywords,
        interval          : cfg.interval,
        auto_reply_msg    : cfg.auto_reply_msg,
        telegram_token    : cfg.telegram_token,
        telegram_chat_id  : cfg.telegram_chat_id,
        proxy_url         : cfg.proxy_url,
        min_quantity      : cfg.min_quantity,
        reply_enabled     : cfg.reply_enabled,
        accept_limit      : cfg.accept_limit,
      });
      addNotification('success', '✅ Settings saved!');
    } catch (e) { addNotification('error', e.message); }
    finally { setSaving(false); }
  };

  const handleUploadCookies = async () => {
    if (!cookiePaste.trim()) return addNotification('error', 'Please paste your cookie data first');
    try {
      const result = await uploadCookies(cookiePaste.trim());
      addNotification('success', `🍪 Cookies saved! Preview: ${result.preview}`);
      setCookiePaste('');
    } catch (e) { addNotification('error', e.message); }
  };

  const handleTelegramTest = async () => {
    if (!cfg.telegram_token || !cfg.telegram_chat_id) return addNotification('error', 'Enter token and chat ID first');
    setTgTesting(true);
    try {
      await testTelegram(cfg.telegram_token, cfg.telegram_chat_id);
      addNotification('success', '📱 Telegram test message sent!');
    } catch (e) { addNotification('error', e.message); }
    finally { setTgTesting(false); }
  };

  const handleClearLeads = async () => {
    if (!window.confirm('Clear ALL leads? This cannot be undone.')) return;
    try { await clearLeads(); addNotification('success', 'All leads cleared'); refreshStats(); }
    catch (e) { addNotification('error', e.message); }
  };

  const handleRemoveDuplicates = async () => {
    setRemoving(true);
    try {
      const r = await removeDuplicates();
      addNotification('success', r.message || 'Duplicates removed');
      refreshStats();
    } catch (e) { addNotification('error', e.message); }
    finally { setRemoving(false); }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Configuration</h2>
          <p className="page-subtitle">Manage filters, cookies, and automation settings</p>
        </div>
        <button id="save-settings-btn" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Settings'}
        </button>
      </div>

      {/* ── COOKIES ────────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">🍪 IndiaMART Session Cookies</h3>
        <p className="section-desc">Paste JSON from EditThisCookie extension or a raw cookie string from DevTools.<br/>
          <strong>How to get cookies:</strong> Login to IndiaMART → Open DevTools → Application → Cookies → Copy all.</p>
        <textarea
          rows="5"
          placeholder='[{"name":"glid","value":"123..."},...]  or  glid=123; PHPSESSID=abc;'
          value={cookiePaste}
          onChange={e => setCookiePaste(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
        />
        <button id="upload-cookies-btn" className="btn btn-primary" style={{ marginTop: '0.75rem', width: 'fit-content' }} onClick={handleUploadCookies}>
          📤 Upload & Save Cookies
        </button>
      </div>

      {/* ── KEYWORDS ──────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">🔑 Medicine / Product Keywords</h3>
        <p className="section-desc">Only leads containing these keywords in their product or message will be accepted. Leave empty to accept all.</p>
        <form onSubmit={addKeyword} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input type="text" placeholder="e.g. Paracetamol, Amoxicillin, Antibiotic…" value={kwInput} onChange={e => setKwInput(e.target.value)} />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Add</button>
        </form>
        <div className="tags-input">
          {cfg.keywords.map(kw => (
            <span key={kw} className="tag">
              {kw}
              <button onClick={() => removeKeyword(kw)}><X size={12} /></button>
            </span>
          ))}
          {cfg.keywords.length === 0 && <span style={{ color: 'var(--text-muted)', padding: '0.25rem' }}>No keywords — all leads will match.</span>}
        </div>
      </div>

      {/* ── PRIORITY KEYWORDS ─────────────────────────────────────── */}
      <div className="glass-panel settings-section" style={{ borderLeft: '3px solid rgba(239,68,68,0.5)' }}>
        <h3 className="section-title">🔥 High Priority Keywords</h3>
        <p className="section-desc">Leads containing these keywords get a priority score boost and 🔥 High Priority badge. These override the regular keyword filter.</p>
        <form onSubmit={addPriorityKeyword} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input type="text" placeholder="e.g. urgent, bulk, distributor, government tender…" value={pkwInput} onChange={e => setPkwInput(e.target.value)} />
          <button type="submit" className="btn btn-danger" style={{ whiteSpace: 'nowrap' }}>+ Add</button>
        </form>
        <div className="tags-input">
          {cfg.priority_keywords.map(kw => (
            <span key={kw} className="tag" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              🔥 {kw}
              <button onClick={() => removePkw(kw)}><X size={12} /></button>
            </span>
          ))}
          {cfg.priority_keywords.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {DEFAULT_PRIORITY_KEYWORDS.map(kw => (
                <span key={kw} style={{ padding: '0.2rem 0.5rem', background: 'rgba(100,116,139,0.1)', border: '1px dashed rgba(100,116,139,0.3)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => set('priority_keywords', [...cfg.priority_keywords, kw])}>
                  + {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── COUNTRIES ────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">🌍 Country Filter</h3>
        <p className="section-desc">Only leads from selected countries will be accepted. Leave all unchecked to accept any country.</p>
        <div className="country-grid">
          {COUNTRY_OPTIONS.map(({ code, name, flag }) => (
            <label key={code} className={`country-chip ${cfg.countries.includes(name) ? 'selected' : ''}`}>
              <input type="checkbox" checked={cfg.countries.includes(name)} onChange={() => toggleCountry(name)} style={{ display: 'none' }} />
              <span>{flag}</span> {name}
            </label>
          ))}
        </div>
        {cfg.countries.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>All countries accepted.</p>}
      </div>

      {/* ── QUANTITY ─────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">📦 Minimum Quantity Filter</h3>
        <p className="section-desc">Leads with quantity below this value will be skipped. Set to 0 to disable.</p>
        <div className="qty-presets">
          {QTY_PRESETS.map(q => (
            <button key={q} className={`btn ${cfg.min_quantity === q ? 'btn-primary' : 'btn-outline'}`} onClick={() => set('min_quantity', q)}>
              {q === 0 ? 'No Limit' : `${q}+`}
            </button>
          ))}
        </div>
        <input type="number" min="0" value={cfg.min_quantity || 0} onChange={e => set('min_quantity', parseInt(e.target.value) || 0)} style={{ marginTop: '0.75rem', maxWidth: '160px' }} placeholder="Custom value" />
      </div>

      {/* ── LIMITS ───────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">🎯 Auto Accept Limit</h3>
        <p className="section-desc">Stop auto-accepting after reaching this limit. The counter persists until reset.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input type="number" min="1" value={cfg.accept_limit || 600} onChange={e => set('accept_limit', parseInt(e.target.value) || 1)} style={{ maxWidth: '160px' }} />
          <span style={{ color: 'var(--text-muted)' }}>Leads per session</span>
        </div>
      </div>

      {/* ── AUTO REPLY ────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">💬 Auto Reply Settings</h3>
        <label className="toggle-row">
          <span>Enable auto reply after lead acceptance</span>
          <div className={`toggle ${cfg.reply_enabled ? 'on' : 'off'}`} onClick={() => set('reply_enabled', !cfg.reply_enabled)} />
        </label>
        <p className="section-desc" style={{ marginTop: '1rem' }}>
          Use <code style={{ color: '#a78bfa' }}>{'{name}'}</code>, <code style={{ color: '#a78bfa' }}>{'{product}'}</code>, <code style={{ color: '#a78bfa' }}>{'{company}'}</code> as placeholders.
        </p>
        <textarea rows="4" value={cfg.auto_reply_msg || ''} onChange={e => set('auto_reply_msg', e.target.value)} placeholder="Thank you for your inquiry about {product}. We will get back to you shortly." />
      </div>

      {/* ── FETCH INTERVAL ───────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">⏱️ Fetch Interval</h3>
        <label className="form-group" style={{ color: 'var(--text-muted)' }}>
          Check for new leads every <strong style={{ color: 'var(--text-main)' }}>{cfg.interval}s</strong>
        </label>
        <input type="range" min="1" max="120" step="1" value={cfg.interval} onChange={e => set('interval', parseInt(e.target.value))} />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <span>1s (fastest)</span><span>120s (slowest)</span>
        </div>
      </div>

      {/* ── TELEGRAM ─────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">📱 Telegram Notifications</h3>
        <p className="section-desc">Get notified on Telegram when a lead is accepted. Create a bot via <a href="https://t.me/botfather" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>@BotFather</a>.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label">Bot Token</label>
            <input type="text" placeholder="123456:ABC-DEF…" value={cfg.telegram_token || ''} onChange={e => set('telegram_token', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Chat ID</label>
            <input type="text" placeholder="-100123456…" value={cfg.telegram_chat_id || ''} onChange={e => set('telegram_chat_id', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-outline" style={{ marginTop: '0.75rem', width: 'fit-content' }} onClick={handleTelegramTest} disabled={tgTesting}>
          {tgTesting ? 'Sending…' : '🧪 Send Test Message'}
        </button>
      </div>

      {/* ── PROXY ────────────────────────────────────────────────── */}
      <div className="glass-panel settings-section">
        <h3 className="section-title">🔒 Proxy Settings (Optional)</h3>
        <p className="section-desc">Route requests through a proxy. Format: <code>http://user:pass@host:port</code></p>
        <input type="text" placeholder="http://proxy.example.com:8080" value={cfg.proxy_url || ''} onChange={e => set('proxy_url', e.target.value)} />
      </div>

      {/* ── CHROME EXTENSION ─────────────────────────────────────── */}
      <div className="glass-panel settings-section" style={{ borderLeft: '3px solid rgba(99,102,241,0.5)' }}>
        <h3 className="section-title">🔌 Chrome Extension</h3>
        <p className="section-desc">Install the Chrome Extension to capture leads directly from IndiaMART pages in real-time.</p>
        
        {token && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Your API Token / JWT</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="password" 
                value={token} 
                readOnly 
                style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.8rem', 
                  background: 'rgba(10,15,30,0.6)', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  flex: 1 
                }} 
              />
              <button 
                className="btn btn-outline" 
                onClick={handleCopyToken}
                style={{ whiteSpace: 'nowrap', minWidth: '100px' }}
              >
                {copied ? 'Copied! ✓' : '📋 Copy Token'}
              </button>
            </div>
            <p className="section-desc" style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}>
              Paste this token into the extension popup under <strong>API Token</strong> to authorize background sync.
            </p>
          </div>
        )}

        <div style={{ background: 'rgba(10,15,30,0.5)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          1. Open Chrome → chrome://extensions<br/>
          2. Enable "Developer mode" (top right)<br/>
          3. Click "Load unpacked"<br/>
          4. Select the <strong style={{ color: 'var(--text-main)' }}>chrome-extension/</strong> folder<br/>
          5. Pin the extension → Click icon → Set backend URL & paste API Token
        </div>
      </div>

      {/* ── DANGER ZONE ──────────────────────────────────────────── */}
      <div className="glass-panel settings-section danger-zone">
        <h3 className="section-title" style={{ color: 'var(--danger)' }}>⚠️ Danger Zone</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={handleRemoveDuplicates} disabled={removing} style={{ borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}>
            {removing ? '⏳ Removing…' : '🔄 Remove Duplicate Leads'}
          </button>
          <button className="btn btn-danger" onClick={handleClearLeads}>🗑️ Clear All Leads</button>
        </div>
      </div>
    </div>
  );
}
