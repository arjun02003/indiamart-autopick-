const express = require('express');
const router  = express.Router();

// Stub auth routes — authentication is handled client-side
router.post('/login',  (_req, res) => res.json({ success: true }));
router.post('/signup', (_req, res) => res.json({ success: true }));
router.post('/logout', (_req, res) => res.json({ success: true }));

module.exports = router;
