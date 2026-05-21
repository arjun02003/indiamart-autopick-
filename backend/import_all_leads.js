const db = require('./db');
const { fetchLeads } = require('./services/indiamartService');
const { scoreLead, extractMedicineNames, extractTags, isHighPriority } = require('./services/aiScoringService');

const cfg = db.prepare('SELECT * FROM config WHERE id=1').get();

console.log('🚀 Starting full import of all IndiaMART leads...');

fetchLeads(cfg.cookies, cfg.proxy_url || '').then(leads => {
  console.log(`✅ Fetched ${leads.length} leads from IndiaMART`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO leads
      (lead_id, customer_name, company_name, product, medicine_name,
       country, mobile, email, quantity, message, timestamp,
       status, ai_score, priority, tags)
    VALUES
      (@lead_id, @customer_name, @company_name, @product, @medicine_name,
       @country, @mobile, @email, @quantity, @message, @timestamp,
       @status, @ai_score, @priority, @tags)
  `);

  const importAll = db.transaction((rows) => {
    let saved = 0;
    for (const rawLead of rows) {
      // Null-safe — ensure all string fields are strings
      const lead = {
        ...rawLead,
        product      : String(rawLead.product || ''),
        message      : String(rawLead.message || ''),
        country      : String(rawLead.country || ''),
        customer_name: String(rawLead.customer_name || ''),
        company_name : String(rawLead.company_name || ''),
        mobile       : String(rawLead.mobile || ''),
        email        : String(rawLead.email || ''),
      };
      const score    = scoreLead(lead, cfg);
      const medText  = `${lead.product} ${lead.message}`;
      const medicine = extractMedicineNames(medText).join(', ');
      const tags     = JSON.stringify(extractTags(lead, cfg));
      const priority = score.priority || (score.score >= 70 ? 'High' : score.score >= 40 ? 'Medium' : 'Low');
      const aiScore  = score.score !== undefined ? score.score : score;
      insert.run({
        ...lead,
        medicine_name: medicine,
        ai_score     : aiScore,
        priority,
        tags,
        status       : 'Pending',
      });
      saved++;
    }
    return saved;
  });

  const total   = importAll(leads);
  const dbCount = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  console.log(`🎉 Import complete! Saved: ${total} | Total in DB: ${dbCount}`);
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
