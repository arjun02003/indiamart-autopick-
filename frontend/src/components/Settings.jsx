import { useState } from 'react';
import { useLeadSystem } from '../context/LeadContext';
import { X, Trash2, RefreshCw } from 'lucide-react';

const COUNTRY_OPTIONS = [
  'USA', 'UK', 'Australia', 'Canada', 'Germany', 
  'France', 'India', 'Japan', 'Singapore', 'UAE'
];

export default function Settings() {
  const { config, setConfig, clearData, resetConfig } = useLeadSystem();
  const [keywordInput, setKeywordInput] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Config is auto-saved via context, just showing a notification
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const addKeyword = (e) => {
    e.preventDefault();
    if (keywordInput.trim() && !config.keywords.includes(keywordInput.trim())) {
      setConfig({ ...config, keywords: [...config.keywords, keywordInput.trim()] });
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw) => {
    setConfig({ ...config, keywords: config.keywords.filter(k => k !== kw) });
  };

  const toggleCountry = (country) => {
    if (config.countries.includes(country)) {
      setConfig({ ...config, countries: config.countries.filter(c => c !== country) });
    } else {
      setConfig({ ...config, countries: [...config.countries, country] });
    }
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all leads and statistics? This cannot be undone.")) {
      clearData();
    }
  };

  const handleResetConfig = () => {
    if (window.confirm("Are you sure you want to reset your configuration to defaults?")) {
      resetConfig();
    }
  };

  return (
    <div className="settings-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Configuration</h2>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? 'Saved to LocalStorage!' : 'Save Settings'}
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div className="form-group">
          <label>Target Product/Medicine Keywords</label>
          <form onSubmit={addKeyword} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              placeholder="e.g. Paracetamol" 
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Add</button>
          </form>
          <div className="tags-input">
            {config.keywords.map(kw => (
              <span key={kw} className="tag">
                {kw}
                <button onClick={() => removeKeyword(kw)}><X size={14} /></button>
              </span>
            ))}
            {config.keywords.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No keywords added. All products will match.</span>}
          </div>
        </div>

        <div className="form-group">
          <label>Target Countries (Aliases like United States are handled automatically)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
            {COUNTRY_OPTIONS.map(country => (
              <label 
                key={country} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', 
                  background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 1rem', 
                  borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--panel-border)'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={config.countries.includes(country)}
                  onChange={() => toggleCountry(country)}
                />
                {country}
              </label>
            ))}
          </div>
          {config.countries.length === 0 && <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem' }}>No countries selected. All countries will match.</p>}
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📦 Minimum Quantity Required
          </label>
          <input 
            type="number" 
            min="1"
            value={config.minQuantity || 1}
            onChange={(e) => setConfig({ ...config, minQuantity: parseInt(e.target.value) || 1 })}
            style={{ 
              marginTop: '0.5rem', 
              background: 'rgba(30, 41, 59, 0.8)', 
              textAlign: 'center', 
              fontSize: '1.25rem',
              fontWeight: '600'
            }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', marginTop: '0.5rem' }}>
            Leads below this quantity will be automatically rejected
          </p>
        </div>

        <div className="form-group">
          <label>Fetch Interval: {config.interval} seconds</label>
          <input 
            type="range" 
            min="10" 
            max="300" 
            step="10"
            value={config.interval}
            onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label>IndiaMART Cookies (JSON array from EditThisCookie or String)</label>
          <textarea 
            rows="6" 
            placeholder='[{"name": "glid", "value": "123..."}, ...]'
            value={config.cookies}
            onChange={(e) => setConfig({ ...config, cookies: e.target.value })}
            style={{ fontFamily: 'monospace' }}
          />
        </div>

      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)' }}>Data Management</h3>
        <p style={{ color: 'var(--text-muted)' }}>Manage your browser LocalStorage data for this application.</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-danger" onClick={handleClearData}>
            <Trash2 size={18} />
            Clear Leads & Stats
          </button>
          <button className="btn" style={{ background: 'var(--warning)', color: '#000' }} onClick={handleResetConfig}>
            <RefreshCw size={18} />
            Reset Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
