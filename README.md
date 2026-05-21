# 💊 LeadMed — IndiaMART Lead Capture & Filtering System

> **Production-ready SaaS-style lead management system for pharmaceutical & medicine export businesses.**  
> Capture, score, filter, and manage IndiaMART leads with AI scoring, real-time notifications, and a Chrome Extension.

---

## 🚀 Features

| Feature | Status |
|---|---|
| Auto lead capture from IndiaMART API | ✅ |
| AI Lead Scoring (0–100, local algorithm) | ✅ |
| Priority Detection (🔥 High / ⭐ Medium / — Low) | ✅ |
| Chrome Extension with sidebar panel | ✅ |
| Real-time dashboard (SSE) | ✅ |
| Advanced filters (country, medicine, priority, score) | ✅ |
| WhatsApp quick contact button | ✅ |
| Telegram notifications | ✅ |
| Auto-reply to leads | ✅ |
| Export CSV / Excel / JSON | ✅ |
| Duplicate lead removal | ✅ |
| Dark / Light mode | ✅ |
| Rate limiting | ✅ |
| Docker deployment | ✅ |
| 47+ pharma export countries | ✅ |

---

## 📁 Project Structure

```
indiamart-lead-system/
├── backend/
│   ├── server.js              # Express server + SSE + rate limiting
│   ├── db.js                  # SQLite schema + migrations
│   ├── worker.js              # Auto-polling worker with AI scoring
│   ├── routes/
│   │   ├── api.js             # All API routes
│   │   └── auth.js            # Authentication routes
│   ├── services/
│   │   ├── indiamartService.js # IndiaMART API client + cookie parser
│   │   ├── aiScoringService.js # Local AI scoring algorithm
│   │   └── telegramService.js  # Telegram notifications
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Dashboard.jsx   # Stats, analytics, dark mode toggle
│       │   ├── Leads.jsx       # Lead table with AI score, WhatsApp, filters
│       │   ├── Settings.jsx    # Config: cookies, keywords, countries, Telegram
│       │   ├── Layout.jsx      # Sidebar navigation
│       │   ├── ActivityLog.jsx # Real-time log viewer
│       │   └── Notifications.jsx
│       ├── context/
│       │   ├── LeadContext.jsx # Global state + SSE connection
│       │   └── AuthContext.jsx
│       └── services/
│           └── api.js          # All API calls
│
├── chrome-extension/
│   ├── manifest.json          # MV3 manifest
│   ├── popup.html/js          # Extension popup UI
│   ├── background.js          # Service worker
│   ├── content.js             # Sidebar injection + lead capture
│   ├── content-styles.css     # Sidebar styles
│   ├── options.html           # Backend URL configuration
│   └── icons/                 # Extension icons
│
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm

### 1. Install dependencies

```bash
# Backend
cd backend
npm install
cp .env.example .env

# Frontend
cd ../frontend
npm install
```

### 2. Start backend

```bash
cd backend
node server.js
# ✅ Backend running on http://localhost:3001
```

### 3. Start frontend

```bash
cd frontend
npm run dev
# ✅ Frontend at http://localhost:5173
```

### 4. Upload your IndiaMART cookies

1. Login to [seller.indiamart.com](https://seller.indiamart.com)
2. Open DevTools → Application → Cookies → Copy all
3. Go to **Settings** in the dashboard → Paste cookies → Save
4. Or install the Chrome Extension (auto-captures cookies!)

### 5. Start capturing

- Click **"▶ Start Auto Mode"** on the dashboard
- Or use the Chrome Extension sidebar

---

## 🔌 Chrome Extension Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select the `chrome-extension/` folder
5. Pin the extension from the puzzle icon
6. Navigate to [seller.indiamart.com](https://seller.indiamart.com)
7. Click the LeadMed icon → **▶ Start Capture**

The extension will:
- Automatically extract your session cookies
- Inject a floating sidebar into IndiaMART pages
- Capture leads every 15 seconds
- Send browser notifications for 🔥 High Priority leads
- Send all data to your local or cloud backend

**For cloud backend**: Open extension Options → Set Backend URL to your Render/VPS URL.

---

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# The SQLite database is persisted at ./backend/indiamart.db
```

---

## ☁️ Render.com Deployment

1. Push to GitHub:
```bash
git add . && git commit -m "Deploy LeadMed v2" && git push
```

2. Go to [render.com](https://render.com) → **New Web Service**

3. Settings:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node backend/server.js`
   - **Environment**: `NODE_ENV=production`

4. Add environment variables in Render dashboard:
   ```
   NODE_ENV=production
   PORT=10000
   ```

5. After deploy, update the Chrome Extension Options URL to your Render URL.

---

## 🖥️ VPS Deployment (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone <your-repo-url> /opt/leadmed
cd /opt/leadmed

# Install and build
cd backend && npm install --only=production
cd ../frontend && npm install && npm run build

# Start with PM2
npm install -g pm2
pm2 start backend/server.js --name leadmed --env production
pm2 save
pm2 startup
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leads` | Get leads (supports `search`, `status`, `country`, `medicine`, `priority`, `min_score`, `page`, `limit`) |
| GET | `/api/leads/priority` | High-priority leads only |
| POST | `/api/leads/:id/accept` | Accept a lead + send auto-reply |
| POST | `/api/leads/:id/skip` | Skip a lead |
| POST | `/api/leads/:id/tag` | Update lead tags |
| DELETE | `/api/leads` | Clear all leads |
| DELETE | `/api/leads/duplicates` | Remove duplicate leads |
| POST | `/api/leads/rescore` | Re-calculate AI scores |
| GET | `/api/stats` | Dashboard stats + top countries/medicines |
| GET | `/api/export` | Export leads (`format=csv/excel/json`, `status=`, `priority=`) |
| POST | `/api/upload-cookies` | Save IndiaMART session cookies |
| POST | `/api/login-cookies` | Chrome Extension cookie endpoint |
| POST | `/api/capture` | Chrome Extension lead capture |
| POST | `/api/start` | Start auto-polling worker |
| POST | `/api/stop` | Stop auto-polling worker |
| GET | `/api/status` | Worker running status |
| GET | `/api/config` | Get configuration |
| POST | `/api/config` | Save configuration |
| GET | `/api/logs` | Activity logs |
| DELETE | `/api/logs` | Clear logs |
| POST | `/api/telegram/test` | Test Telegram notification |
| GET | `/api/events` | SSE real-time event stream |

---

## 🤖 AI Scoring Algorithm

Scores are calculated locally — no external API needed:

| Factor | Max Points | Criteria |
|---|---|---|
| Country match | 30 | High-value pharma markets (USA, UK, UAE, etc.) = 30pts |
| Quantity | 20 | qty ≥ 100,000 = 20pts, sliding scale down |
| Pharma keywords | 25 | 200+ medicine/drug keywords checked |
| Company quality | 10 | Non-generic company name |
| Contact completeness | 10 | Has mobile + email |
| Message quality | 5 | Message length > 50 chars |
| Priority keyword bonus | +15 | "urgent", "bulk", "government", etc. |

**Priority tiers**: 🔥 High (≥70) | ⭐ Medium (40–69) | — Low (<40)

---

## 🔒 Security

- **Rate limiting**: 200 requests / 15 minutes per IP
- **Cookie security**: Stored in SQLite, never exposed via API
- **Duplicate prevention**: `UNIQUE` constraint on `lead_id`
- **Auto-retry**: 3 retries with exponential backoff on network errors
- **Session monitoring**: Auto-stop + SSE alert on session expiry

---

## 🌍 Supported Filter Countries (47+)

Asia Pacific, Middle East, Europe, Americas, Africa — all major pharma export destinations are covered in the Settings page.

---

## 📞 Support

For issues or feature requests, open a GitHub issue.

---

*Built with ❤️ for India's pharmaceutical export industry*
