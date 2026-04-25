import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const LeadContext = createContext();

const DEFAULT_CONFIG = {
  keywords: [],
  countries: [],
  interval: 30,
  cookies: '',
  minQuantity: 1
};

export function LeadProvider({ children }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('indiamart_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [leads, setLeads] = useState(() => {
    const saved = localStorage.getItem('indiamart_leads');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('indiamart_stats');
    return saved ? JSON.parse(saved) : { total: 0, accepted: 0, failed: 0, lastCheckTime: null, apiMessage: 'Waiting to fetch...' };
  });

  const [isRunning, setIsRunning] = useState(() => {
    const saved = localStorage.getItem('indiamart_is_running');
    return saved ? JSON.parse(saved) : false;
  });

  const isRunningRef = useRef(isRunning);
  const workerIntervalRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('indiamart_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('indiamart_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('indiamart_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('indiamart_is_running', JSON.stringify(isRunning));
    isRunningRef.current = isRunning;

    if (isRunning) {
      startWorker();
    } else {
      stopWorker();
    }
  }, [isRunning]);

  // Sync config changes to worker
  useEffect(() => {
    if (isRunning) {
      stopWorker();
      startWorker();
    }
  }, [config.interval]);

  const processCookies = (cookiesRaw) => {
    try {
      let cookies = cookiesRaw;
      if (typeof cookiesRaw === 'string') {
        try { cookies = JSON.parse(cookiesRaw); } catch (e) { /* ignore string */ }
      }
      if (Array.isArray(cookies)) {
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
      } else if (typeof cookies === 'object') {
        return Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');
      }
      return typeof cookiesRaw === 'string' ? cookiesRaw : '';
    } catch(e) {
      return typeof cookiesRaw === 'string' ? cookiesRaw : '';
    }
  };

  const fetchLeads = async () => {
    if (!isRunningRef.current) return;

    // To get the latest config, leads, and stats in the interval callback, we use functional state updates where possible,
    // or rely on the closure if we restart interval on config change. But to be safe, we will fetch from localStorage.
    const currentConfig = JSON.parse(localStorage.getItem('indiamart_config')) || DEFAULT_CONFIG;
    
    const keywords = currentConfig.keywords.map(k => k.toLowerCase());
    const countries = currentConfig.countries.map(c => c.toLowerCase());
    const cookieString = processCookies(currentConfig.cookies);

    if (!cookieString || cookieString === '""') {
      console.warn("No cookies provided.");
      return;
    }

    try {
      const response = await axios.post('/api/indiamart/lmsreact/getContactList', {}, {
        headers: {
          'X-Proxy-Cookie': cookieString,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      const data = response.data;
      console.log("Raw IndiaMART Response:", data);
      
      let fetchedLeads = data.RESPONSE || data.leads || data.data || data.result || (Array.isArray(data) ? data : []);
      let newApiMessage = 'Connected successfully.';

      if (typeof data === 'string' && data.toLowerCase().includes('<html')) {
        newApiMessage = 'Error: IndiaMART returned a login page. Your cookies are expired or invalid.';
        fetchedLeads = [];
      } else if (!Array.isArray(fetchedLeads)) {
        newApiMessage = 'Error: Unexpected response format from IndiaMART.';
        fetchedLeads = [];
      } else if (fetchedLeads.length === 0) {
        newApiMessage = 'Success: Checked IndiaMART, but no leads were found.';
      } else {
        newApiMessage = `Success: Fetched ${fetchedLeads.length} leads from IndiaMART.`;
      }
      
      if (!Array.isArray(fetchedLeads) || fetchedLeads.length === 0) {
        setStats(prev => ({ ...prev, lastCheckTime: new Date().toISOString(), apiMessage: newApiMessage }));
        return;
      }

      setLeads(prevLeads => {
        let newLeads = [];
        let acceptedCount = 0;
        let failedCount = 0;

        for (const lead of fetchedLeads) {
          const id = lead.I_REQ_ID || lead.QUERY_ID || lead.id || lead.im_contact_id || lead.contacts_glid || Math.random().toString(36).substring(7);
          
          if (prevLeads.some(l => l.lead_id === id.toString())) {
            continue; // Already processed
          }

          const customerName = lead.SENDER_NAME || lead.sender_name || lead.name || lead.contacts_name || 'Unknown';
          const companyName = lead.SENDER_COMPANY || lead.company_name || lead.company || lead.contacts_company || 'Unknown';
          const product = lead.QUERY_PRODUCT_NAME || lead.subject || lead.product || lead.subject_desc || lead.mcat_name || lead.contact_last_product || 'Unknown Product';
          const country = lead.SENDER_COUNTRY || lead.sender_country || lead.country || lead.country_name || 'Unknown';
          const contactDetails = lead.SENDER_EMAIL || lead.SENDER_MOBILE || lead.email || lead.phone || lead.contacts_mobile1 || lead.contacts_email || 'Unknown';
          const qtyRaw = lead.ENQ_QTY || lead.I_REQ_QTY || lead.QUERY_QTY || lead.quantity || lead.qty || lead.QUANTITY || lead.last_product_qty || '1';
          const quantity = parseInt(qtyRaw) || 1;
          
          let productMatch = keywords.length === 0;
          const searchString = (product + " " + (lead.last_message || '')).toLowerCase();
          for (const kw of keywords) {
            if (searchString.includes(kw)) {
              productMatch = true;
              break;
            }
          }

          let countryMatch = countries.length === 0;
          const lowerCountry = country.toLowerCase();
          
          let normalizedCountry = lowerCountry;
          if (lowerCountry.includes('united states') || lowerCountry === 'us') {
            normalizedCountry = 'usa';
          } else if (lowerCountry.includes('united kingdom') || lowerCountry === 'great britain') {
            normalizedCountry = 'uk';
          } else if (lowerCountry.includes('arab emirates')) {
            normalizedCountry = 'uae';
          }

          for (const c of countries) {
            if (normalizedCountry.includes(c) || lowerCountry.includes(c)) {
              countryMatch = true;
              break;
            }
          }

          const qtyMatch = quantity >= (currentConfig.minQuantity || 1);

          const isAccepted = productMatch && countryMatch && qtyMatch;
          const status = isAccepted ? 'Accepted' : 'Failed';
          
          if (isAccepted) acceptedCount++;
          else failedCount++;

          let reason = '';
          if (!isAccepted) {
            let reasons = [];
            if (!productMatch) reasons.push('Product mismatch');
            if (!countryMatch) reasons.push('Country mismatch');
            if (!qtyMatch) reasons.push(`Qty too low (${quantity} < ${currentConfig.minQuantity})`);
            reason = reasons.join(', ');
          } else {
            reason = 'Matched';
          }

          newLeads.push({
            lead_id: id.toString(),
            customer_name: customerName,
            company_name: companyName,
            product,
            quantity,
            country,
            contact_details: contactDetails,
            timestamp: new Date().toISOString(),
            status,
            reason
          });
        }

        if (newLeads.length > 0) {
          setStats(prevStats => ({
            ...prevStats,
            total: prevStats.total + newLeads.length,
            accepted: prevStats.accepted + acceptedCount,
            failed: prevStats.failed + failedCount,
            lastCheckTime: new Date().toISOString(),
            apiMessage: newApiMessage
          }));
          return [...newLeads, ...prevLeads]; // Add new leads to the top
        }
        
        return prevLeads;
      });

      setStats(prev => ({ ...prev, lastCheckTime: new Date().toISOString(), apiMessage: newApiMessage }));

    } catch (error) {
      console.error("Fetch error:", error);
      setStats(prev => ({ ...prev, lastCheckTime: new Date().toISOString(), apiMessage: `Network Error: ${error.message}` }));
    }
  };

  const startWorker = () => {
    if (workerIntervalRef.current) clearInterval(workerIntervalRef.current);
    fetchLeads(); // run immediately
    const intervalMs = Math.max(10, config.interval) * 1000;
    workerIntervalRef.current = setInterval(fetchLeads, intervalMs);
  };

  const stopWorker = () => {
    if (workerIntervalRef.current) {
      clearInterval(workerIntervalRef.current);
      workerIntervalRef.current = null;
    }
  };

  const clearData = () => {
    setLeads([]);
    setStats({ total: 0, accepted: 0, failed: 0, lastCheckTime: null, apiMessage: 'Waiting to fetch...' });
  };

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setIsRunning(false);
  };

  return (
    <LeadContext.Provider value={{
      config,
      setConfig,
      leads,
      stats,
      isRunning,
      setIsRunning,
      clearData,
      resetConfig
    }}>
      {children}
    </LeadContext.Provider>
  );
}

export function useLeadSystem() {
  return useContext(LeadContext);
}
