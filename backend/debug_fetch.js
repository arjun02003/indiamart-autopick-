const axios  = require('axios');
const db     = require('./db');

const cfg         = db.prepare('SELECT cookies FROM config WHERE id=1').get();
const cookiesRaw  = JSON.parse(cfg.cookies);
const cookieStr   = Object.entries(cookiesRaw).map(([k, v]) => `${k}=${v}`).join('; ');

console.log('Cookie string length:', cookieStr.length);
console.log('Has im_iss:', cookieStr.includes('im_iss'));

axios.post(
  'https://seller.indiamart.com/lmsreact/getContactList',
  { page: 1, limit: 50, modid: 'ALL', folder: 'ALL' },
  {
    headers: {
      'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept'         : 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer'        : 'https://seller.indiamart.com/leadmanager/',
      'Origin'         : 'https://seller.indiamart.com',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type'   : 'application/json',
      'Cookie'         : cookieStr,
    },
    timeout: 60000,
  }
).then(res => {
  const data = res.data;
  console.log('HTTP Status    :', res.status);
  console.log('Response keys  :', Object.keys(data).join(', '));
  console.log('Full response  :', JSON.stringify(data).slice(0, 800));
}).catch(err => {
  console.log('ERROR:', err.response?.status, err.message);
  if (err.response?.data) console.log('Response body:', JSON.stringify(err.response.data).slice(0, 500));
});
