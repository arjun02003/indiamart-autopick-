const login = async (req, res) => {
  try {
    // Password system removed by user request
    res.json({ success: true, message: 'Access granted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  login
};
