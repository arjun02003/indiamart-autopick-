const axios = require('axios');

// Helper: Process Cookies
function processCookies(cookiesRaw) {
  try {
    const cookies = typeof cookiesRaw === 'string' 
      ? JSON.parse(cookiesRaw) 
      : cookiesRaw;

    if (Array.isArray(cookies)) {
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } 
    if (typeof cookies === 'object' && cookies !== null) {
      return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    }
    return String(cookiesRaw || '');
  } catch (e) {
    console.error("Cookie Processing Error:", e.message);
    return '';
  }
}

// ====================== MAIN EXPORTS ======================

exports.uploadCookies = (req, res) => {
  const { cookies } = req.body;

  if (!cookies) {
    return res.status(400).json({ success: false, error: 'No cookies provided' });
  }

  const cookieString = processCookies(cookies);
  if (!cookieString) {
    return res.status(400).json({ success: false, error: 'Invalid cookie format' });
  }

  res.json({ 
    success: true, 
    message: 'Cookies uploaded successfully',
    cookieLength: cookieString.length 
  });
};

exports.getLeads = async (req, res) => {
  const { cookies } = req.body;

  if (!cookies) {
    return res.status(400).json({ success: false, error: 'Cookies are required' });
  }

  const cookieString = processCookies(cookies);
  if (!cookieString) {
    return res.status(400).json({ success: false, error: 'Invalid cookies' });
  }

  try {
    const response = await axios.post(
      'https://seller.indiamart.com/lmsreact/getContactList', 
      {}, 
      {
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': 'https://seller.indiamart.com/leadmanager/',
          'Origin': 'https://seller.indiamart.com'
        },
        timeout: 15000 // 15 seconds timeout
      }
    );

    const data = response.data || {};
    
    // Handle different possible response structures
    const leads = data.RESPONSE || 
                  data.result || 
                  data.leads || 
                  data.data || 
                  (Array.isArray(data) ? data : []);

    res.json({
      success: true,
      totalLeads: Array.isArray(leads) ? leads.length : 0,
      leads: leads
    });

  } catch (error) {
    console.error('IndiaMART Leads Fetch Error:', error.message);
    
    if (error.response) {
      return res.status(400).json({
        success: false,
        error: 'IndiaMART API Error',
        status: error.response.status,
        message: error.response.data?.message || error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads from IndiaMART'
    });
  }
};

exports.applyFilters = (req, res) => {
  let { leads = [], keywords = [], countries = [], minOrderValue = 0 } = req.body;

  if (!Array.isArray(leads)) {
    return res.status(400).json({ success: false, error: 'Leads must be an array' });
  }

  const processedKeywords = keywords.map(k => k.toLowerCase().trim());
  const processedCountries = countries.map(c => c.toLowerCase().trim());

  const filteredLeads = leads.map(lead => {
    const id = lead.I_REQ_ID || lead.QUERY_ID || lead.id || Date.now().toString();
    const customerName = lead.SENDER_NAME || lead.sender_name || lead.name || 'Unknown';
    const companyName = lead.SENDER_COMPANY || lead.company_name || lead.company || 'Unknown';
    const product = (lead.QUERY_PRODUCT_NAME || lead.subject || lead.product || '').toString();
    const country = (lead.SENDER_COUNTRY || lead.sender_country || lead.country || 'Unknown').toString();
    const contact = lead.SENDER_MOBILE || lead.SENDER_EMAIL || lead.phone || lead.email || 'Not Available';

    // Order Value
    const orderValueStr = lead.ORDER_VALUE || lead.order_value || '0';
    const orderValue = parseFloat(orderValueStr.toString().replace(/[^0-9.]/g, '')) || 0;

    // Product Match
    let productMatch = processedKeywords.length === 0;
    if (!productMatch) {
      const lowerProduct = product.toLowerCase();
      productMatch = processedKeywords.some(kw => lowerProduct.includes(kw));
    }

    // Country Match
    let countryMatch = processedCountries.length === 0;
    if (!countryMatch) {
      const lowerCountry = country.toLowerCase();
      countryMatch = processedCountries.some(c => 
        lowerCountry.includes(c) || 
        (c === 'usa' && ['united states', 'us', 'america'].some(us => lowerCountry.includes(us)))
      );
    }

    // Order Value Match
    const valueMatch = minOrderValue > 0 ? orderValue >= minOrderValue : true;

    const isAccepted = productMatch && countryMatch && valueMatch;

    return {
      id: id.toString(),
      customerName,
      companyName,
      product,
      country,
      contact,
      orderValue,
      status: isAccepted ? 'Accepted' : 'Rejected',
      reason: isAccepted ? 'Matched all filters' : 
              !productMatch ? 'Product mismatch' :
              !countryMatch ? 'Country mismatch' : 'Order value too low',
      timestamp: new Date().toISOString()
    };
  });

  res.json({
    success: true,
    totalProcessed: filteredLeads.length,
    accepted: filteredLeads.filter(l => l.status === 'Accepted').length,
    processedLeads: filteredLeads
  });
};