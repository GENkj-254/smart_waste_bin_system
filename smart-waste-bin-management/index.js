const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

const binRoutes = require('./backend/src/routes/binroutes');
const authRoutes = require('./backend/src/routes/authRoutes');
const User = require('./backend/src/models/user');

const app = express();
const PORT = process.env.PORT || 5000;

// 🌐 Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://smart-waste-bin-management-system.onrender.com',
  'http://localhost:5000', // A common port for frontend development
].filter(Boolean); // Removes any falsy values like undefined

app.use(cors({
  origin: function (origin, callback) {
    // The origin 'null' is sent by browsers for local files.
    // We allow requests from whitelisted origins OR from local files (origin === 'null').
    if (allowedOrigins.indexOf(origin) !== -1 || !origin || origin === 'null') {
      callback(null, true);
    } else {
      callback(new Error('This request is blocked by CORS policy.'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 📋 Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const path = require('path');
app.use(express.static(path.join(__dirname, 'backend', 'public')));



// 🚀 Routes
app.use('/api/bin', binRoutes);
app.use('/api/auth', authRoutes);

// 🔍 Root route
app.get('/', (req, res) => {
  res.send('✅ Smart Waste Bin API is running');
});

// 🩺 Status route for external uptime checks
app.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Waste Bin API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime().toFixed(2) + ' seconds',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// 🧾 Registration Endpoint (Considered legacy, move to authRoutes in future)
app.post('/api/register', async (req, res) => {
  const { username, email, phoneNumber, password, role } = req.body;

  console.log("📩 Incoming registration request:", {
    username, email, phoneNumber, role
  });

  if (!username || !email || !phoneNumber || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required.',
      missingFields: {
        username: !username,
        email: !email,
        phoneNumber: !phoneNumber,
        password: !password,
        role: !role
      }
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email or username already exists.' });
    }

    const newUser = new User({ username, email, phoneNumber, password, role });
    await newUser.save();

    console.log("✅ User registered successfully:", {
      id: newUser._id, username: newUser.username, email: newUser.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error("❌ Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'User with this email or username already exists.' });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validationErrors
      });
    }

    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ❗ Error handling
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ❓ 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// 📦 MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://DBgroup4:we.group4@cluster0.ymvsjzo.mongodb.net/smartbin';

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);

    if (error.message.includes('ENOTFOUND')) {
      console.error('🌐 Network error: Check internet connection');
    } else if (error.message.includes('authentication failed')) {
      console.error('🔐 Auth error: Check MongoDB credentials');
    } else if (error.message.includes('IP')) {
      console.error('🚫 IP not whitelisted in MongoDB Atlas');
    }

    process.exit(1);
  }
};

// ⏹️ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected');
    process.exit(0);
  } catch (err) {
    console.error('❌ Shutdown error:', err);
    process.exit(1);
  }
});

// 🧠 Start Server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`🌍 Accessible at: ${process.env.FRONTEND_URL || 'https://smart-waste-bin-management-system.onrender.com'}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🕐 Started at: ${new Date().toISOString()}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();