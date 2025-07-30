const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Verifies JWT token and sets req.userId
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Failed to authenticate token' });
    }
    req.userId = decoded.id;
    next();
  });
};

// Checks if user is administrator
const isAdmin = (req, res, next) => {
  User.findById(req.userId, (err, user) => {
    if (err || !user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Requires administrator role' });
    }
    next();
  });
};

module.exports = {
  verifyToken,
  isAdmin,
};