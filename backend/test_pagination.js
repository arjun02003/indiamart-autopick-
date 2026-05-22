const axios = require('axios');
const db = require('./db');
const { parseCookies } = require('./services/indiamartService');

const cfg = db.prepare('SELECT cookies FROM config WHERE id=1').get();
const cookieStr = parseCookies(cfg.cookies);

async function run() {
  const allLeads = [];
  let lastContactDate = null;
  const PAGE_SIZE = 50;

  for (let page = 1; page <= 4; page++) {
    const payload = {
      page: 1, // always page: 1 when using last_contact_date
      limit: PAGE_SIZE,
      modid: 'ALL',
      folder: 'ALL'
    };
    if (lastContactDate) {
      payload.last_contact_date = lastContactDate;
    }

    try {
      console.log(`\nFetching page ${page} with last_contact_date: ${lastContactDate}`);
      const res = await axios.post(
        'https://seller.indiamart.com/lmsreact/getContactList',
        payload,
        {
          headers: { 'Cookie': cookieStr, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        }
      );
      const leads = res.data.result || [];
      console.log(`  -> Page ${page} count: ${leads.length}`);
      if (leads.length === 0) break;

      console.log(`  -> First lead: ${leads[0].contacts_name} (glid: ${leads[0].contacts_glid}, date: ${leads[0].last_contact_date})`);
      const lastLead = leads[leads.length - 1];
      console.log(`  -> Last lead: ${lastLead.contacts_name} (glid: ${lastLead.contacts_glid}, date: ${lastLead.last_contact_date})`);

      allLeads.push(...leads);

      // Check if the new lastContactDate is the same as the current one to prevent infinite loop
      if (lastContactDate === lastLead.last_contact_date) {
        console.log('  -> last_contact_date did not change, breaking to avoid infinite loop');
        break;
      }
      lastContactDate = lastLead.last_contact_date;

      if (leads.length < PAGE_SIZE) break;
    } catch (e) {
      console.log(`  -> Fetch failed: ${e.message}`);
      break;
    }
  }

  console.log(`\nTotal unique leads fetched: ${allLeads.length}`);
}
run();
