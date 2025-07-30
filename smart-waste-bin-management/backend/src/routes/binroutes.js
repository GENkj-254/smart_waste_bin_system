const express = require('express');
const router = express.Router();
const Bin = require('../models/bin');

// Get all bins
router.get('/', async (req, res) => {
  try {
    const { status, location, needsCollection } = req.query;
    let query = {};
    
    if (status) {
      query.sensorStatus = status;
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    if (needsCollection === 'true') {
      query.fillLevel = { $gte: 85 };
    }
    
    const bins = await Bin.find(query).sort({ binId: 1 });
    
    res.json({
      success: true,
      count: bins.length,
      data: bins
    });
  } catch (error) {
    console.error('Error fetching bins:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bins',
      error: error.message
    });
  }
});

// Get single bin by ID
router.get('/:binId', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const bin = await Bin.findOne({ binId });
    
    if (!bin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    res.json({
      success: true,
      data: bin
    });
  } catch (error) {
    console.error('Error fetching bin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bin',
      error: error.message
    });
  }
});

// Create new bin
router.post('/', async (req, res) => {
  try {
    const {
      binId,
      location,
      capacity = 100,
      coordinates,
      metadata
    } = req.body;
    
    // Validation
    if (!binId || !location) {
      return res.status(400).json({
        success: false,
        message: 'binId and location are required'
      });
    }
    
    if (binId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'binId must be a positive number'
      });
    }
    
    // Check if bin already exists
    const existingBin = await Bin.findOne({ binId });
    if (existingBin) {
      return res.status(400).json({
        success: false,
        message: 'Bin with this ID already exists'
      });
    }
    
    const newBin = new Bin({
      binId,
      location: location.trim(),
      capacity,
      fillLevel: 0,
      batteryLevel: 100,
      temperature: 20,
      sensorStatus: 'active',
      lastEmptied: new Date(),
      coordinates: coordinates || {},
      metadata: {
        ...metadata,
        installationDate: new Date()
      }
    });
    
    await newBin.save();
    
    // Emit to WebSocket clients if available
    const io = req.app.get('io');
    if (io) {
      io.emit('binUpdate', {
        type: 'bin_added',
        bin: newBin
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Bin created successfully',
      data: newBin
    });
  } catch (error) {
    console.error('Error creating bin:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bin with this ID already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating bin',
      error: error.message
    });
  }
});

// Update bin
router.put('/:binId', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const updateData = { ...req.body };
    delete updateData.binId; // Prevent changing the binId
    delete updateData._id; // Prevent changing the _id
    
    // Validate fill level if provided
    if (updateData.fillLevel !== undefined) {
      if (updateData.fillLevel < 0 || updateData.fillLevel > 100) {
        return res.status(400).json({
          success: false,
          message: 'Fill level must be between 0 and 100'
        });
      }
    }
    
    // Validate battery level if provided
    if (updateData.batteryLevel !== undefined) {
      if (updateData.batteryLevel < 0 || updateData.batteryLevel > 100) {
        return res.status(400).json({
          success: false,
          message: 'Battery level must be between 0 and 100'
        });
      }
    }
    
    const updatedBin = await Bin.findOneAndUpdate(
      { binId },
      { 
        ...updateData,
        lastUpdated: new Date()
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!updatedBin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    // Emit to WebSocket clients if available
    const io = req.app.get('io');
    if (io) {
      io.emit('binUpdate', {
        type: 'bin_updated',
        bin: updatedBin
      });
    }
    
    res.json({
      success: true,
      message: 'Bin updated successfully',
      data: updatedBin
    });
  } catch (error) {
    console.error('Error updating bin:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bin',
      error: error.message
    });
  }
});

// Update bin fill level (sensor data endpoint)
router.post('/:binId/data', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    const { fillLevel, batteryLevel, temperature } = req.body;
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const bin = await Bin.findOne({ binId });
    if (!bin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    // Update sensor data
    const updateData = { lastUpdated: new Date() };
    
    if (fillLevel !== undefined) {
      if (fillLevel < 0 || fillLevel > 100) {
        return res.status(400).json({
          success: false,
          message: 'Fill level must be between 0 and 100'
        });
      }
      updateData.fillLevel = fillLevel;
      
      // Check if collection occurred (significant drop in fill level)
      if (bin.fillLevel > 80 && fillLevel < 20) {
        updateData.lastEmptied = new Date();
      }
    }
    
    if (batteryLevel !== undefined) {
      if (batteryLevel < 0 || batteryLevel > 100) {
        return res.status(400).json({
          success: false,
          message: 'Battery level must be between 0 and 100'
        });
      }
      updateData.batteryLevel = batteryLevel;
    }
    
    if (temperature !== undefined) {
      updateData.temperature = temperature;
    }
    
    const updatedBin = await Bin.findOneAndUpdate(
      { binId },
      updateData,
      { new: true, runValidators: true }
    );
    
    // Generate alerts if needed
    if (fillLevel >= 90) {
      await updatedBin.addAlert('full', `Bin ${binId} is ${fillLevel}% full and needs immediate collection`);
    }
    
    if (batteryLevel <= 20) {
      await updatedBin.addAlert('battery', `Bin ${binId} has low battery: ${batteryLevel}%`);
    }
    
    // Emit to WebSocket clients if available
    const io = req.app.get('io');
    if (io) {
      io.emit('binUpdate', {
        type: 'sensor_data_update',
        bin: updatedBin
      });
    }
    
    res.json({
      success: true,
      message: 'Sensor data updated successfully',
      data: updatedBin
    });
  } catch (error) {
    console.error('Error updating sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sensor data',
      error: error.message
    });
  }
});

// Delete bin
router.delete('/:binId', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const deletedBin = await Bin.findOneAndDelete({ binId });
    
    if (!deletedBin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    // Emit to WebSocket clients if available
    const io = req.app.get('io');
    if (io) {
      io.emit('binUpdate', {
        type: 'bin_deleted',
        binId: binId
      });
    }
    
    res.json({
      success: true,
      message: 'Bin deleted successfully',
      data: deletedBin
    });
  } catch (error) {
    console.error('Error deleting bin:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bin',
      error: error.message
    });
  }
});

// Get bins that need collection
router.get('/collection/needed', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 85;
    const bins = await Bin.findBinsNeedingCollection(threshold);
    
    res.json({
      success: true,
      count: bins.length,
      threshold: threshold,
      data: bins
    });
  } catch (error) {
    console.error('Error fetching bins needing collection:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bins needing collection',
      error: error.message
    });
  }
});

// Get bins with low battery
router.get('/battery/low', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 30;
    const bins = await Bin.findLowBatteryBins(threshold);
    
    res.json({
      success: true,
      count: bins.length,
      threshold: threshold,
      data: bins
    });
  } catch (error) {
    console.error('Error fetching low battery bins:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low battery bins',
      error: error.message
    });
  }
});

// Get system statistics
router.get('/stats/system', async (req, res) => {
  try {
    const stats = await Bin.getSystemStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system stats',
      error: error.message
    });
  }
});

// Mark bin as emptied
router.post('/:binId/empty', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const updatedBin = await Bin.findOneAndUpdate(
      { binId },
      {
        fillLevel: 0,
        lastEmptied: new Date(),
        lastUpdated: new Date()
      },
      { new: true }
    );
    
    if (!updatedBin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    // Resolve any full alerts
    const fullAlerts = updatedBin.metadata.alerts.filter(alert => 
      alert.type === 'full' && !alert.resolved
    );
    
    for (const alert of fullAlerts) {
      await updatedBin.resolveAlert(alert._id);
    }
    
    // Emit to WebSocket clients if available
    const io = req.app.get('io');
    if (io) {
      io.emit('binUpdate', {
        type: 'bin_emptied',
        bin: updatedBin
      });
    }
    
    res.json({
      success: true,
      message: 'Bin marked as emptied',
      data: updatedBin
    });
  } catch (error) {
    console.error('Error marking bin as emptied:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking bin as emptied',
      error: error.message
    });
  }
});

// Get bin alerts
router.get('/:binId/alerts', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    const { resolved } = req.query;
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const bin = await Bin.findOne({ binId });
    
    if (!bin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    let alerts = bin.metadata.alerts;
    
    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      alerts = alerts.filter(alert => alert.resolved === isResolved);
    }
    
    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching bin alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bin alerts',
      error: error.message
    });
  }
});

// Add alert to bin
router.post('/:binId/alerts', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    const { type, message } = req.body;
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    if (!type || !message) {
      return res.status(400).json({
        success: false,
        message: 'Alert type and message are required'
      });
    }
    
    const validTypes = ['full', 'maintenance', 'battery', 'sensor_error'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid alert type'
      });
    }
    
    const bin = await Bin.findOne({ binId });
    
    if (!bin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    await bin.addAlert(type, message);
    
    // Emit to WebSocket clients if available
    const io = req.app.get('io');
    if (io) {
      io.emit('alert', {
        binId: binId,
        type: type,
        message: message,
        timestamp: new Date()
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Alert added successfully',
      data: bin.metadata.alerts[bin.metadata.alerts.length - 1]
    });
  } catch (error) {
    console.error('Error adding alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding alert',
      error: error.message
    });
  }
});

// Resolve alert
router.patch('/:binId/alerts/:alertId', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    const { alertId } = req.params;
    
    if (isNaN(binId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bin ID'
      });
    }
    
    const bin = await Bin.findOne({ binId });
    
    if (!bin) {
      return res.status(404).json({
        success: false,
        message: 'Bin not found'
      });
    }
    
    await bin.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    
    if (error.message === 'Alert not found') {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error resolving alert',
      error: error.message
    });
  }
});

module.exports = router;