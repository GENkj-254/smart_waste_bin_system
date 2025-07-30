const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{10}$/, 'Phone number must be 10 digits']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Supervisor', 'Collection Officer'],
    default: 'Collection Officer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  profile: {
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    avatar: {
      type: String,
      default: null
    },
    department: {
      type: String,
      trim: true
    },
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true }
      },
      dashboard: {
        refreshInterval: { type: Number, default: 60000 },
        alertThreshold: { type: Number, default: 85 },
        theme: { type: String, enum: ['light', 'dark'], default: 'light' }
      }
    }
  },
  permissions: [{
    resource: {
      type: String,
      required: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete']
    }]
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set default permissions based on role
userSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('role')) {
    this.permissions = this.getDefaultPermissions(this.role);
  }
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Instance method to get default permissions based on role
userSchema.methods.getDefaultPermissions = function(role) {
  const permissions = {
    Admin: [
      { resource: 'bins', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'settings', actions: ['read', 'update'] }
    ],
    Supervisor: [
      { resource: 'bins', actions: ['read', 'update'] },
      { resource: 'users', actions: ['read'] },
      { resource: 'analytics', actions: ['read'] }
    ],
    'Collection Officer': [
      { resource: 'bins', actions: ['read', 'update'] }
    ]
  };
  
  return permissions[role] || permissions['Collection Officer'];
};

// Instance method to check if user has permission
userSchema.methods.hasPermission = function(resource, action) {
  if (this.role === 'Admin') {
    return true; // Administrators have all permissions
  }
  
  const permission = this.permissions.find(p => p.resource === resource);
  return permission && permission.actions.includes(action);
};

// Instance method to update last login
userSchema.methods.updateLastLogin = function() {
  return this.updateOne({ lastLogin: new Date() });
};

// Instance method to change password
userSchema.methods.changePassword = async function(newPassword) {
  this.password = newPassword;
  return this.save();
};

// Instance method to update profile
userSchema.methods.updateProfile = function(profileData) {
  Object.keys(profileData).forEach(key => {
    if (key in this.profile) {
      this.profile[key] = profileData[key];
    }
  });
  return this.save();
};

// Static method to find user by email or username
userSchema.statics.findByCredentials = async function(identifier) {
  const user = await this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ],
    isActive: true
  });
  
  return user;
};

// Static method to find active users
userSchema.statics.findActiveUsers = function(filters = {}) {
  return this.find({ 
    isActive: true,
    ...filters 
  }).select('-password');
};

// Static method to get user statistics
userSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { 
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
        },
        lockedUsers: { 
          $sum: { 
            $cond: [
              { $gt: ['$lockUntil', new Date()] }, 
              1, 
              0
            ] 
          } 
        },
        usersByRole: {
          $push: {
            role: '$role',
            count: 1
          }
        }
      }
    }
  ]);
  
  // Process role statistics
  const roleStats = {};
  if (stats.length > 0 && stats[0].usersByRole) {
    stats[0].usersByRole.forEach(user => {
      roleStats[user.role] = (roleStats[user.role] || 0) + 1;
    });
  }
  
  return {
    totalUsers: stats[0]?.totalUsers || 0,
    activeUsers: stats[0]?.activeUsers || 0,
    lockedUsers: stats[0]?.lockedUsers || 0,
    roleDistribution: roleStats
  };
};

// Static method to create admin user
userSchema.statics.createAdmin = async function(adminData) {
  const admin = new this({
    ...adminData,
    role: 'Admin',
    isActive: true
  });
  
  return admin.save();
};

// Static method to cleanup expired locks
userSchema.statics.cleanupExpiredLocks = function() {
  return this.updateMany(
    { lockUntil: { $lt: new Date() } },
    { $unset: { lockUntil: 1, loginAttempts: 1 } }
  );
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  return userObject;
};

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('user', userSchema);