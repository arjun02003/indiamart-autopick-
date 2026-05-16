const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const apiRoutes  = require('./routes/api');
const authRoutes = require('./routes/auth');
const path = require('path');

const app = express();

// SSE client registry
const sseClients = new Set();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session & Passport
app.use(session({
  secret: 'indiamart-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
    callbackURL: "/api/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    // Allow any email for now, but you can restrict it here
    return done(null, { id: profile.id, email });
  }
));

// Google Auth Routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: req.user });
  } else {
    res.status(401).json({ success: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

/* ── Health check ─────────────────────────────────────────────── */
app.get('/', (_req, res) => res.json({ status: 'ok', message: '🚀 IndiaMART Lead System API' }));

/* ── SSE — Real-time event stream ─────────────────────────────── */
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send heartbeat immediately
  res.write('event: ping\ndata: connected\n\n');

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write('event: ping\ndata: heartbeat\n\n');
  }, 25000);

  sseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

/* ── Broadcast helper (used by worker) ────────────────────────── */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    if (!client.writableEnded) client.write(payload);
  }
}

// Attach broadcast to app so routes/worker can access it
app.locals.broadcast = broadcast;

/* ── Routes ────────────────────────────────────────────────────── */
app.use('/api',      apiRoutes);
app.use('/api/auth', authRoutes);

/* ── Global error handler ──────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message });
});

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Catch-all route to serve index.html for any unknown request
  app.use((req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));

module.exports = app;
