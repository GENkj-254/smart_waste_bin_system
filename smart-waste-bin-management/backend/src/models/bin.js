const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    // 🚀 UPDATED: Removed 'emptied' as it wasn't in your original enum.
    // If you want 'emptied' alerts, add it here and handle its generation.
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
  resolvedAt: { // 🚀 NEW: Track when an alert was resolved
    type: Date
  }
});

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
    // 🚀 ALIGNED: Using your provided enum values
    enum: ['active', 'warning', 'error', 'low_battery', 'offline', 'maintenance'], // Added 'maintenance' for clearer distinction
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
  // Prevent duplicate active alerts of the same type (optional, but good practice)
  const existingActiveAlert = this.metadata.alerts.find(alert =>
    !alert.resolved && alert.type === type && alert.message === message
  );
  if (existingActiveAlert) {
    console.log(`Alert of type '${type}' with message '${message}' already exists and is active. Not adding duplicate.`);
    return this; // Return the current bin instance without adding a new alert
  }

  this.metadata.alerts.push({
    type,
    message,
    timestamp: new Date(),
    resolved: false
  });
  return this.save(); // Save the bin after adding the alert
};

// Method to resolve alert
binSchema.methods.resolveAlert = async function(alertId) {
  const alert = this.metadata.alerts.id(alertId);
  if (alert) {
    alert.resolved = true;
    alert.resolvedAt = new Date(); // 🚀 NEW: Set resolvedAt timestamp
    return this.save(); // Save the bin after resolving the alert
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

  // Auto-generate alerts based on fill level
  if (newLevel >= 90 && oldLevel < 90) {
    await this.addAlert('full', `Bin ${this.binId} is ${newLevel}% full and needs immediate collection`);
  } else if (newLevel < 90 && oldLevel >= 90) {
      // 🚀 NEW: Automatically resolve 'full' alert if fill level drops significantly
      const fullAlert = this.metadata.alerts.find(a => a.type === 'full' && !a.resolved);
      if (fullAlert) {
          await this.resolveAlert(fullAlert._id);
      }
  }


  // Reset last emptied if fill level dropped significantly (indicates collection)
  // This logic should be here or in markBinEmptied, but not duplicated.
  // The `markBinEmptied` endpoint specifically sets fillLevel to 0 and updates lastEmptied.
  // If sensor data causes a significant drop, this could also trigger an implied emptying.
  if (oldLevel > 80 && newLevel < 20 && (Date.now() - this.lastEmptied.getTime()) / (1000 * 60 * 60 * 24) > 0.1) {
    // Only update if it hasn't been emptied very recently (e.g., within the last few hours)
    this.lastEmptied = new Date();
    // Optional: add a specific 'emptied' log entry if needed, but not as a persistent 'alert' type based on schema
  }

  return this.save(); // Save the bin after updating fill level and potentially alerts
};

// Static method to find bins that need collection
binSchema.statics.findBinsNeedingCollection = function(threshold = 85) {
  return this.find({
    fillLevel: { $gte: threshold },
    isActive: true,
    sensorStatus: { $ne: 'offline' } // Don't count offline bins for collection
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
  const allBins = await this.find({ isActive: true }); // Only consider active bins for dashboard stats

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
    inactive: 0, // This generally maps to sensorStatus: 'offline' or 'error' combined, or isActive: false
    warning: 0, // For sensorStatus 'warning'
    error: 0, // For sensorStatus 'error'
    offline: 0 // For sensorStatus 'offline'
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const bin of allBins) {
    averageFillLevel += bin.fillLevel;

    // Categorize fill level for distribution chart
    if (bin.fillLevel <= 25) fillLevelDistribution['0-25']++;
    else if (bin.fillLevel <= 50) fillLevelDistribution['26-50']++;
    else if (bin.fillLevel <= 75) fillLevelDistribution['51-75']++;
    else fillLevelDistribution['76-100']++;

    // Categorize for status breakdown chart
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

    // Check for "full" status for the chart
    if (bin.fillLevel >= 90) {
        statusBreakdown.full++;
    }

    // Count active alerts
    activeAlerts += bin.metadata.alerts.filter(alert => !alert.resolved).length;

    // Count collections today (if lastEmptied is today)
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
    statusBreakdown // Now includes 'active', 'full', 'lowBattery', 'maintenance', 'inactive' (mapping to offline/error)
  };
};

// Ensure virtual fields are serialized
binSchema.set('toJSON', { virtuals: true });
binSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Bin', binSchema);