/* ─────────────────────────────────────────────────────────────────────────
   AI Lead Scoring Service — IndiaMART Lead System
   Fully local, rule-based scoring. No external API required.
   Score: 0–100  |  Priority: 'High' | 'Medium' | 'Low'
───────────────────────────────────────────────────────────────────────── */

/* ── Pharma export target countries (high-value markets) ─────────────── */
const HIGH_VALUE_COUNTRIES = new Set([
  'usa', 'united states', 'us', 'united states of america',
  'uk', 'united kingdom', 'great britain', 'england',
  'uae', 'united arab emirates', 'dubai',
  'germany', 'france', 'italy', 'spain', 'netherlands',
  'australia', 'canada', 'new zealand',
  'singapore', 'malaysia', 'thailand', 'vietnam', 'philippines',
  'saudi arabia', 'ksa', 'kuwait', 'qatar', 'oman', 'bahrain',
  'south africa', 'kenya', 'nigeria', 'ghana', 'ethiopia',
  'brazil', 'mexico', 'argentina', 'colombia',
  'russia', 'ukraine', 'poland', 'czech republic',
  'japan', 'south korea', 'taiwan',
]);

const MEDIUM_VALUE_COUNTRIES = new Set([
  'india', 'bangladesh', 'nepal', 'sri lanka', 'pakistan',
  'myanmar', 'cambodia', 'laos', 'indonesia',
  'egypt', 'morocco', 'algeria', 'tunisia',
  'iran', 'iraq', 'jordan', 'lebanon', 'syria',
  'tanzania', 'uganda', 'zambia', 'zimbabwe',
]);

/* ── Pharma / medicine keywords ──────────────────────────────────────── */
const PHARMA_KEYWORDS = [
  // Generic drug classes
  'antibiotic', 'antifungal', 'antiviral', 'antimalarial', 'antiparasitic',
  'analgesic', 'antipyretic', 'anti-inflammatory', 'nsaid', 'painkiller',
  'antidiabetic', 'antihypertensive', 'cardiovascular', 'cardiac',
  'antidepressant', 'antipsychotic', 'anxiolytic', 'sedative',
  'antihistamine', 'bronchodilator', 'inhaler', 'respiratory',
  'antiemetic', 'antacid', 'proton pump', 'ppi', 'gastric',
  'diuretic', 'laxative', 'vitamin', 'mineral', 'supplement',
  'hormone', 'insulin', 'steroid', 'corticosteroid',
  'oncology', 'anticancer', 'chemotherapy', 'immunosuppressant',
  'vaccine', 'immunoglobulin', 'plasma', 'blood',
  // Common medicine names
  'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'naproxen',
  'amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline',
  'metformin', 'glibenclamide', 'insulin', 'sitagliptin',
  'amlodipine', 'atenolol', 'losartan', 'lisinopril', 'enalapril',
  'atorvastatin', 'rosuvastatin', 'simvastatin',
  'omeprazole', 'pantoprazole', 'esomeprazole', 'ranitidine',
  'cetirizine', 'loratadine', 'fexofenadine', 'montelukast',
  'salbutamol', 'albuterol', 'budesonide', 'fluticasone',
  'metronidazole', 'fluconazole', 'clotrimazole',
  'chloroquine', 'hydroxychloroquine', 'artemether', 'quinine',
  'codeine', 'tramadol', 'morphine', 'oxycodone',
  'diazepam', 'alprazolam', 'clonazepam',
  'prednisolone', 'dexamethasone', 'methylprednisolone',
  'ondansetron', 'metoclopramide', 'domperidone',
  'furosemide', 'spironolactone', 'hydrochlorothiazide',
  'warfarin', 'heparin', 'enoxaparin', 'clopidogrel',
  'sildenafil', 'tadalafil',
  'gabapentin', 'pregabalin', 'carbamazepine', 'valproate',
  'levothyroxine', 'methimazole', 'propylthiouracil',
  'erythropoietin', 'filgrastim',
  // Dosage forms
  'tablet', 'capsule', 'injection', 'syrup', 'suspension', 'cream',
  'ointment', 'gel', 'drops', 'suppository', 'patch', 'inhaler',
  'powder', 'granule', 'solution', 'lotion', 'spray', 'ampoule', 'vial',
  // Regulatory / export terms
  'who-gmp', 'usfda', 'eu gmp', 'iso 9001', 'schedule m', 'pharmacopoeia',
  'bp grade', 'usp grade', 'ip grade', 'pharmaceutical', 'pharma',
  'generic', 'branded', 'active pharmaceutical', 'api', 'excipient',
  // Units
  'mg', 'mcg', 'ml', 'iu', 'units',
];

/* ── Priority trigger keywords (very high value) ─────────────────────── */
const PRIORITY_KEYWORDS = [
  'urgent', 'asap', 'immediate', 'bulk', 'large quantity', 'large order',
  'annual contract', 'long term', 'exclusive', 'distributor', 'wholesale',
  'government tender', 'tender', 'hospital', 'clinic', 'pharmacy chain',
  'ngo', 'unrwa', 'unicef', 'who', 'ministry of health',
  'registered importer', 'import license', 'fda approved',
  'ceo', 'director', 'procurement', 'purchase manager',
];

/* ── Medicine name extraction from text ──────────────────────────────── */
function extractMedicineNames(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const kw of PHARMA_KEYWORDS) {
    if (lower.includes(kw) && !['mg', 'ml', 'iu', 'units', 'tablet', 'capsule',
      'injection', 'syrup', 'powder', 'gel', 'cream', 'solution', 'spray',
      'drops', 'patch', 'vial', 'ampoule', 'granule', 'suspension', 'lotion',
      'suppository', 'ointment', 'bp grade', 'usp grade', 'ip grade',
      'who-gmp', 'usfda', 'eu gmp', 'iso 9001', 'pharmaceutical', 'pharma',
      'generic', 'branded', 'api', 'excipient'].includes(kw)) {
      found.push(kw);
    }
  }
  // Remove duplicates and return max 5
  return [...new Set(found)].slice(0, 5);
}

/* ── Tag extraction — returns array of tags ──────────────────────────── */
function extractTags(lead) {
  const tags = [];
  const text = `${lead.product || ''} ${lead.message || ''}`.toLowerCase();

  // Medicine category tags
  if (/antibiotic|amoxicillin|azithromycin|ciprofloxacin|doxycycline|metronidazole/.test(text)) tags.push('Antibiotic');
  if (/antidiabetic|metformin|insulin|glibenclamide|sitagliptin/.test(text)) tags.push('Antidiabetic');
  if (/cardiovascular|amlodipine|atenolol|losartan|lisinopril|atorvastatin|rosuvastatin/.test(text)) tags.push('Cardiovascular');
  if (/antifungal|fluconazole|clotrimazole/.test(text)) tags.push('Antifungal');
  if (/antimalarial|chloroquine|artemether/.test(text)) tags.push('Antimalarial');
  if (/vitamin|supplement|mineral/.test(text)) tags.push('Supplement');
  if (/analgesic|paracetamol|ibuprofen|aspirin|painkiller/.test(text)) tags.push('Analgesic');
  if (/respiratory|inhaler|salbutamol|budesonide|bronchodilator/.test(text)) tags.push('Respiratory');
  if (/antiviral|vaccine|immunoglobulin/.test(text)) tags.push('Antiviral');
  if (/oncology|anticancer|chemotherapy/.test(text)) tags.push('Oncology');
  if (/generic/.test(text)) tags.push('Generic');
  if (/bulk|wholesale|large/.test(text)) tags.push('Bulk');
  if (/tender|government|ministry/.test(text)) tags.push('Government');
  if (/urgent|asap|immediate/.test(text)) tags.push('Urgent');
  if (/distributor|distribution/.test(text)) tags.push('Distributor');

  return [...new Set(tags)];
}

/* ── Main scoring function ───────────────────────────────────────────── */
function scoreLead(lead) {
  let score = 0;
  const breakdown = {};

  // 1. Country score (max 30 pts)
  const country = (lead.country || '').toLowerCase().trim();
  if (HIGH_VALUE_COUNTRIES.has(country)) {
    score += 30;
    breakdown.country = 30;
  } else if (MEDIUM_VALUE_COUNTRIES.has(country)) {
    score += 15;
    breakdown.country = 15;
  } else if (country && country !== 'unknown') {
    score += 5;
    breakdown.country = 5;
  } else {
    breakdown.country = 0;
  }

  // 2. Quantity score (max 20 pts)
  const qty = parseFloat(lead.quantity) || 0;
  let qtyScore = 0;
  if (qty >= 100000) qtyScore = 20;
  else if (qty >= 10000) qtyScore = 16;
  else if (qty >= 1000) qtyScore = 12;
  else if (qty >= 100) qtyScore = 8;
  else if (qty >= 10) qtyScore = 4;
  else if (qty > 0) qtyScore = 2;
  score += qtyScore;
  breakdown.quantity = qtyScore;

  // 3. Pharma keyword match (max 25 pts)
  const text = `${lead.product || ''} ${lead.message || ''}`.toLowerCase();
  const matchedKeywords = PHARMA_KEYWORDS.filter(kw => text.includes(kw)).length;
  const kwScore = Math.min(25, matchedKeywords * 5);
  score += kwScore;
  breakdown.keywords = kwScore;

  // 4. Company quality (max 10 pts)
  const company = (lead.company_name || '').trim();
  let compScore = 0;
  if (company && company.length > 5 &&
    !['unknown', 'na', 'n/a', 'test', '-'].includes(company.toLowerCase())) {
    compScore = company.length > 15 ? 10 : 5;
  }
  score += compScore;
  breakdown.company = compScore;

  // 5. Contact completeness (max 10 pts)
  let contactScore = 0;
  if (lead.mobile && lead.mobile.length > 6) contactScore += 5;
  if (lead.email && lead.email.includes('@')) contactScore += 5;
  score += contactScore;
  breakdown.contact = contactScore;

  // 6. Message quality (max 5 pts)
  const msgLen = (lead.message || '').trim().length;
  const msgScore = msgLen >= 100 ? 5 : msgLen >= 50 ? 3 : msgLen >= 20 ? 1 : 0;
  score += msgScore;
  breakdown.message = msgScore;

  // Bonus: Priority keyword in text (up to +15 bonus, capped at 100)
  const hasPriorityKw = PRIORITY_KEYWORDS.some(kw => text.includes(kw));
  if (hasPriorityKw) {
    score = Math.min(100, score + 15);
    breakdown.priorityBonus = 15;
  }

  // Final clamp
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Determine priority tier
  let priority;
  if (score >= 70) priority = 'High';
  else if (score >= 40) priority = 'Medium';
  else priority = 'Low';

  return { score, priority, breakdown };
}

/* ── Check if lead is high priority ─────────────────────────────────── */
function isHighPriority(lead) {
  const { priority } = scoreLead(lead);
  return priority === 'High';
}

module.exports = {
  scoreLead,
  extractMedicineNames,
  extractTags,
  isHighPriority,
  PHARMA_KEYWORDS,
  PRIORITY_KEYWORDS,
};
