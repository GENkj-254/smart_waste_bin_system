const mongoose = require('mongoose');

const binSchema = new mongoose.Schema({
  binId: {
    type: Number,
    required: true,
    unique: true,
    min: 1
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  fillLevel: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  },
  capacity: {
    type: Number,
    required: true,
    default: 100,
    min: 1
  },
  batteryLevel: {
    type: Number,
    required: true,
    default: 100,
    min: 0,
    max: 100
  },
  temperature: {
    type: Number,
    required: true,
    default: 20
  },
  sensorStatus: {
    type: String,
    required: true,
    enum: ['active', 'warning', 'error', 'low_battery', 'offline'],
    default: 'active'
  },
  lastEmptied: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  coordinates: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    }
  },
  metadata: {
    installationDate: {
      type: Date,
      default: Date.now
    },
    lastMaintenance: {
      type: Date,
      default: null
    },
    maintenanceInterval: {
      type: Number, // days
      default: 30
    },
    alerts: [{
      type: {
        type: String,
        enum: ['full', 'maintenance', 'battery', 'sensor_error']
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }]
  }
}, {
  timestamps: true
});

// Virtual to check if bin needs collection
binSchema.virtual('needsCollection').get(function() {
  return this.fillLevel >= 85;
});

// Virtual to check if bin needs maintenance
binSchema.virtual('needsMaintenance').get(function() {
  if (!this.metadata.lastMaintenance) return true;
  
  const daysSinceLastMaintenance = (Date.now() - this.metadata.lastMaintenance) / (1000 * 60 * 60 * 24);
  return daysSinceLastMaintenance >= this.metadata.maintenanceInterval;
});

// Virtual to calculate days since last emptied
binSchema.virtual('daysSinceEmptied').get(function() {
  return Math.floor((Date.now() - this.lastEmptied) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update lastUpdated timestamp
binSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Pre-save middleware to update sensor status based on battery level
binSchema.pre('save', function(next) {
  if (this.batteryLevel < 20) {
    this.sensorStatus = 'low_battery';
  } else if (this.batteryLevel < 30 && this.sensorStatus === 'low_battery') {
    this.sensorStatus = 'warning';
  } else if (this.batteryLevel >= 50 && this.sensorStatus === 'low_battery') {
    this.sensorStatus = 'active';
  }
  next();
});

// Method to add alert
binSchema.methods.addAlert = function(type, message) {
  this.metadata.alerts.push({
    type,
    message,
    timestamp: new Date(),
    resolved: false
  });
  return this.save();
};

// Method to resolve alert
binSchema.methods.resolveAlert = function(alertId) {
  const alert = this.metadata.alerts.id(alertId);
  if (alert) {
    alert.resolved = true;
    return this.save();
  }
  return Promise.reject(new Error('Alert not found'));
};

// Method to update fill level with validation
binSchema.methods.updateFillLevel = function(newLevel) {
  if (newLevel < 0 || newLevel > 100) {
    throw new Error('Fill level must be between 0 and 100');
  }
  
  const oldLevel = this.fillLevel;
  this.fillLevel = newLevel;
  
  // Auto-generate alerts based on fill level
  if (newLevel >= 90 && oldLevel < 90) {
    this.addAlert('full', `Bin ${this.binId} is ${newLevel}% full and needs immediate collection`);
  }
  
  // Reset last emptied if fill level dropped significantly (indicates collection)
  if (oldLevel > 80 && newLevel < 20) {
    this.lastEmptied = new Date();
  }
  
  return this.save();
};

// Static method to find bins that need collection
binSchema.statics.findBinsNeedingCollection = function(threshold = 85) {
  return this.find({ 
    fillLevel: { $gte: threshold },
    isActive: true 
  }).sort({ fillLevel: -1 });
};

// Static method to find bins with low battery
binSchema.statics.findLowBatteryBins = function(threshold = 30) {
  return this.find({ 
    batteryLevel: { $lte: threshold },
    isActive: true 
  }).sort({ batteryLevel: 1 });
};

// Static method to get system statistics
binSchema.statics.getSystemStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalBins: { $sum: 1 },
        averageFillLevel: { $avg: '$fillLevel' },
        averageBatteryLevel: { $avg: '$batteryLevel' },
        binsNeedingCollection: {
          $sum: { $cond: [{ $gte: ['$fillLevel', 85] }, 1, 0] }
        },
        lowBatteryBins: {
          $sum: { $cond: [{ $lte: ['$batteryLevel', 30] }, 1, 0] }
        },
        offlineBins: {
          $sum: { $cond: [{ $eq: ['$sensorStatus', 'offline'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalBins: 0,
    averageFillLevel: 0,
    averageBatteryLevel: 0,
    binsNeedingCollection: 0,
    lowBatteryBins: 0,
    offlineBins: 0
  };
};

// Ensure virtual fields are serialized
binSchema.set('toJSON', { virtuals: true });
binSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Bin', binSchema);