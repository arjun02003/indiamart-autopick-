const login = async (req, res) => {
  try {
    const { password } = req.body;
    
    // Hardcoded simple check for Premium Service
    if (password && password.trim().toLowerCase() === 'admin123') {
      res.json({ success: true, message: 'Authenticated successfully' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  login
};
