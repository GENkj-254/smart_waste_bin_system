// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
require('dotenv').config();

// REGISTER route
router.post('/register', async (req, res) => {
  const { username, email, phoneNumber, password, role } = req.body;

  if (!username || !email || !phoneNumber || !password || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const normalizedUsername = username.toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with that email or username already exists.' });
    }

    // Pass the plain password directly. The pre-save hook in user.js will handle hashing.
    const newUser = new User({
      username: normalizedUsername,
      email,
      phoneNumber,
      password: password,
      role,
      isActive: true
    });

    await newUser.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// LOGIN route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const normalizedUsername = username.toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials - user not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'User account is deactivated' });
    }

    if (user.isLocked) {
      return res.status(403).json({ message: 'Account is temporarily locked. Try later.' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({ message: 'Invalid credentials - password mismatch' });
    }

    await user.resetLoginAttempts();
    await user.updateLastLogin();

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'fallbacksecret',
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

// Admin-only route to unlock a user manually
router.post('/admin/unlock-user', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 },
      $set: { isActive: true }
    });

    return res.status(200).json({ message: 'User unlocked successfully.' });
  } catch (error) {
    console.error('Unlock error:', error);
    return res.status(500).json({ message: 'Server error unlocking user.' });
  }
});

// Auto-create admin user if none exists (call this once during setup)
router.post('/admin/create-default', async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'administrator' });
    if (adminExists) return res.status(200).json({ message: 'Admin already exists.' });

    const hashedPassword = await bcrypt.hash('admin123', 12);
    const admin = new User({
      username: 'admin',
      email: 'admin@smartbin.com',
      phoneNumber: '0700000000',
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });

    await admin.save();
    return res.status(201).json({ message: 'Default admin created successfully.' });
  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({ message: 'Error creating default admin.' });
  }
});

module.exports = router;