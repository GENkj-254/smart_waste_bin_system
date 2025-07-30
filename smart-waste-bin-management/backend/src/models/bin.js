const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['full', 'maintenance', 'battery', 'sensor_error'],
    required: true
  },
  message: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  }
});

const binSchema = new mongoose.Schema({
  binId: {
    type: Number,
    // 🚀 MODIFIED: binId is no longer required on the schema directly
    // It will be auto-generated in the pre-save hook
    unique: true,
    min: 1
  },
  location: {
    type: String,
    required: true, // Location is still required from frontend
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
    required: true, // Capacity is still required from frontend
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
    enum: ['active', 'warning', 'error', 'low_battery', 'offline', 'maintenance'],
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
    alerts: [alertSchema]
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

// 🚀 NEW/MODIFIED: Pre-save hook to generate binId if not provided
binSchema.pre('save', async function(next) {
    if (this.isNew && !this.binId) { // Only generate if it's a new document and binId is not set
        try {
            // Find the bin with the highest binId
            const lastBin = await this.constructor.findOne({}, {}, { sort: { 'binId': -1 } });
            let nextBinId = 1; // Default starting ID

            if (lastBin && lastBin.binId) {
                nextBinId = lastBin.binId + 1;
            }
            this.binId = nextBinId;
            next();
        } catch (error) {
            next(error); // Pass error to Mongoose
        }
    } else {
        next();
    }
});


// 🚀 UPDATED: Pre-save middleware to update sensor status based on battery level and maintenance needs
binSchema.pre('save', function(next) {
  if (this.batteryLevel < 10) { // Critical battery
    this.sensorStatus = 'error';
  } else if (this.batteryLevel < 20) { // Low battery
    this.sensorStatus = 'low_battery';
  } else if (this.needsMaintenance) { // Needs maintenance
    this.sensorStatus = 'maintenance';
  } else if (this.sensorStatus !== 'offline' && this.sensorStatus !== 'error') {
    // If not offline or critical error, and battery/maintenance are fine, set to active
    this.sensorStatus = 'active';
  }
  next();
});


// Method to add alert
binSchema.methods.addAlert = async function(type, message) {
  const existingActiveAlert = this.metadata.alerts.find(alert =>
    !alert.resolved && alert.type === type && alert.message === message
  );
  if (existingActiveAlert) {
    console.log(`Alert of type '${type}' with message '${message}' already exists and is active. Not adding duplicate.`);
    return this;
  }

  this.metadata.alerts.push({
    type,
    message,
    timestamp: new Date(),
    resolved: false
  });
  return this.save();
};

// Method to resolve alert
binSchema.methods.resolveAlert = async function(alertId) {
  const alert = this.metadata.alerts.id(alertId);
  if (alert) {
    alert.resolved = true;
    alert.resolvedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Alert not found'));
};

// Method to update fill level with validation
binSchema.methods.updateFillLevel = async function(newLevel) {
  if (newLevel < 0 || newLevel > 100) {
    throw new Error('Fill level must be between 0 and 100');
  }

  const oldLevel = this.fillLevel;
  this.fillLevel = newLevel;

  if (newLevel >= 90 && oldLevel < 90) {
    await this.addAlert('full', `Bin ${this.binId} is ${newLevel}% full and needs immediate collection`);
  } else if (newLevel < 90 && oldLevel >= 90) {
      const fullAlert = this.metadata.alerts.find(a => a.type === 'full' && !a.resolved);
      if (fullAlert) {
          await this.resolveAlert(fullAlert._id);
      }
  }

  if (oldLevel > 80 && newLevel < 20 && (Date.now() - this.lastEmptied.getTime()) / (1000 * 60 * 60 * 24) > 0.1) {
    this.lastEmptied = new Date();
  }

  return this.save();
};

// Static method to find bins that need collection
binSchema.statics.findBinsNeedingCollection = function(threshold = 85) {
  return this.find({
    fillLevel: { $gte: threshold },
    isActive: true,
    sensorStatus: { $ne: 'offline' }
  }).sort({ fillLevel: -1 });
};

// Static method to find bins with low battery
binSchema.statics.findLowBatteryBins = function(threshold = 30) {
  return this.find({
    batteryLevel: { $lte: threshold },
    isActive: true,
    sensorStatus: { $ne: 'offline' }
  }).sort({ batteryLevel: 1 });
};


// 🚀 MAJOR UPDATE: Enhanced Static method to get comprehensive system statistics for the dashboard
binSchema.statics.getSystemStats = async function() {
  const allBins = await this.find({ isActive: true });

  let totalBins = allBins.length;
  let averageFillLevel = 0;
  let activeAlerts = 0;
  let collectionsToday = 0;
  let fillLevelDistribution = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
  let statusBreakdown = {
    active: 0,
    full: 0,
    lowBattery: 0,
    maintenance: 0,
    inactive: 0,
    warning: 0,
    error: 0,
    offline: 0
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const bin of allBins) {
    averageFillLevel += bin.fillLevel;

    if (bin.fillLevel <= 25) fillLevelDistribution['0-25']++;
    else if (bin.fillLevel <= 50) fillLevelDistribution['26-50']++;
    else if (bin.fillLevel <= 75) fillLevelDistribution['51-75']++;
    else fillLevelDistribution['76-100']++;

    if (bin.sensorStatus === 'active') {
      statusBreakdown.active++;
    } else if (bin.sensorStatus === 'offline') {
      statusBreakdown.offline++;
    } else if (bin.sensorStatus === 'low_battery') {
      statusBreakdown.lowBattery++;
    } else if (bin.sensorStatus === 'warning') {
      statusBreakdown.warning++;
    } else if (bin.sensorStatus === 'error') {
        statusBreakdown.error++;
    } else if (bin.sensorStatus === 'maintenance') {
        statusBreakdown.maintenance++;
    }

    if (bin.fillLevel >= 90) {
        statusBreakdown.full++;
    }

    activeAlerts += bin.metadata.alerts.filter(alert => !alert.resolved).length;

    if (bin.lastEmptied >= todayStart) {
        collectionsToday++;
    }
  }

  averageFillLevel = totalBins > 0 ? averageFillLevel / totalBins : 0;

  return {
    totalBins,
    averageFillLevel,
    activeAlerts,
    collectionsToday,
    fillLevelDistribution,
    statusBreakdown
  };
};

// Ensure virtual fields are serialized
binSchema.set('toJSON', { virtuals: true });
binSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Bin', binSchema);