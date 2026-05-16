const axios = require('axios');

function processCookies(cookiesRaw) {
  try {
    const cookies = typeof cookiesRaw === 'string' ? JSON.parse(cookiesRaw) : cookiesRaw;
    if (Array.isArray(cookies)) {
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } else if (typeof cookies === 'object') {
      return Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');
    }
    return cookiesRaw; // If string
  } catch(e) {
    return '';
  }
}

exports.uploadCookies = (req, res) => {
  const { cookies } = req.body;
  if (!cookies) {
    return res.status(400).json({ error: 'No cookies provided' });
  }
  
  const cookieString = processCookies(cookies);
  if (!cookieString) {
    return res.status(400).json({ error: 'Invalid cookie format' });
  }

  res.json({ success: true, message: 'Cookies parsed successfully' });
};

exports.getLeads = async (req, res) => {
  const { cookies } = req.body;
  
  const cookieString = processCookies(cookies);
  if (!cookieString) {
    return res.status(400).json({ error: 'Invalid or missing cookies' });
  }

  try {
    const response = await axios.post('https://seller.indiamart.com/lmsreact/getContactList', {}, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    const leads = data.RESPONSE || data.leads || data.data || (Array.isArray(data) ? data : []);
    
    res.json({ success: true, leads });
  } catch (error) {
    console.error('Error fetching leads:', error.message);
    res.status(500).json({ error: 'Failed to fetch leads from IndiaMART' });
  }
};

exports.applyFilters = (req, res) => {
  const { leads, keywords = [], countries = [], minOrderValue = 0 } = req.body;
  
  if (!Array.isArray(leads)) {
    return res.status(400).json({ error: 'Leads must be an array' });
  }

  const processedKeywords = keywords.map(k => k.toLowerCase());
  const processedCountries = countries.map(c => c.toLowerCase());
  
  const results = leads.map(lead => {
    const id = lead.I_REQ_ID || lead.QUERY_ID || lead.id || Math.random().toString(36).substring(7);
    const customerName = lead.SENDER_NAME || lead.sender_name || lead.name || 'Unknown';
    const companyName = lead.SENDER_COMPANY || lead.company_name || lead.company || 'Unknown';
    const product = lead.QUERY_PRODUCT_NAME || lead.subject || lead.product || '';
    const country = lead.SENDER_COUNTRY || lead.sender_country || lead.country || 'Unknown';
    const contactDetails = lead.SENDER_EMAIL || lead.SENDER_MOBILE || lead.email || lead.phone || 'Unknown';
    
    // Attempt to extract order value if present
    const orderValueStr = lead.ORDER_VALUE || lead.order_value || '0';
    const orderValue = parseFloat(orderValueStr.replace(/[^0-9.]/g, '')) || 0;

    // Filter Logic
    // 1. Medicine / Product Match
    let productMatch = processedKeywords.length === 0;
    for (const kw of processedKeywords) {
      if (product.toLowerCase().includes(kw)) {
        productMatch = true;
        break;
      }
    }

    // 2. Country Match
    let countryMatch = processedCountries.length === 0;
    const lowerCountry = country.toLowerCase();
    const countryAliases = {
      'united states': 'usa',
      'united states of america': 'usa',
      'us': 'usa',
      'united kingdom': 'uk',
      'great britain': 'uk',
      'united arab emirates': 'uae'
    };
    const normalizedCountry = countryAliases[lowerCountry] || lowerCountry;

    for (const c of processedCountries) {
      if (normalizedCountry.includes(c) || lowerCountry.includes(c)) {
        countryMatch = true;
        break;
      }
    }

    // 3. Minimum Order Value Match
    let valueMatch = true;
    if (minOrderValue > 0) {
      valueMatch = orderValue >= minOrderValue;
    }

    const isAccepted = productMatch && countryMatch && valueMatch;
    const status = isAccepted ? 'Accepted' : 'Rejected';
    
    let reason = 'Matched';
    if (!isAccepted) {
      if (!productMatch) reason = 'Product mismatch';
      else if (!countryMatch) reason = 'Country mismatch';
      else if (!valueMatch) reason = 'Order value too low';
    }

    return {
      id: id.toString(),
      customerName,
      companyName,
      product,
      country,
      contactDetails,
      orderValue,
      status,
      reason,
      timestamp: new Date().toISOString()
    };
  });

  res.json({ success: true, processedLeads: results });
};
