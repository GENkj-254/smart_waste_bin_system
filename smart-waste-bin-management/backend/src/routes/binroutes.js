const express = require('express');
const router = express.Router();
const binController = require('../controllers/binController');
const Bin = require('../models/bin'); // Still needed here for direct model calls in specific routes

// Get all bins
router.get('/', binController.getAllBins);

// Get single bin by ID (renamed from getBinStatus for clarity if you also have a getBinStatus in controller)
router.get('/:binId', binController.getBinStatus);

// Create new bin
router.post('/', binController.createBin);

// Update bin (general update)
router.put('/:binId', binController.updateBin);

// Update bin fill level (sensor data endpoint) - Directly handled here for specific sensor logic/alerts
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
            // Consider a more robust check for 'emptying' event if desired
            if (bin.fillLevel > 80 && fillLevel < 20) {
                updateData.lastEmptied = new Date();
                // Optionally, add a notification for emptying event
                if (bin.addAlert) { // Ensure addAlert method exists on your Bin model
                    await bin.addAlert('emptied', `Bin ${binId} has been emptied.`);
                }
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
        if (updatedBin.fillLevel >= 90) {
            if (updatedBin.addAlert) {
                await updatedBin.addAlert('full', `Bin ${binId} is ${updatedBin.fillLevel}% full and needs immediate collection`);
            } else {
                console.warn("Bin.addAlert method not found. Alert not added.");
            }
        }
        if (updatedBin.batteryLevel <= 20) {
            if (updatedBin.addAlert) {
                await updatedBin.addAlert('battery', `Bin ${binId} has low battery: ${updatedBin.batteryLevel}%`);
            } else {
                console.warn("Bin.addAlert method not found. Alert not added.");
            }
        }

        // 🚀 Emit to Socket.IO clients
        const io = req.app.get('io');
        if (io) {
            const allBins = await Bin.find({}); // Get updated list of all bins
            io.emit('sensor_data_update', { payload: allBins, singleBin: updatedBin });
            console.log(`Socket.IO: Emitted 'sensor_data_update' for bin ${binId}`);
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
router.delete('/:binId', binController.deleteBin);

// Mark bin as emptied
router.post('/:binId/empty', binController.markBinEmptied);


// The remaining routes below are fine as they are, assuming their helper methods
// like `findBinsNeedingCollection` are correctly defined as static methods on your Mongoose `Bin` model.
// If these are not working, you'll need to confirm those methods in your `bin.js` model file.

// Get bins that need collection
router.get('/collection/needed', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 85;
        const bins = await Bin.findBinsNeedingCollection(threshold); // Assumes static method
        res.json({ success: true, count: bins.length, threshold: threshold, data: bins });
    } catch (error) {
        console.error('Error fetching bins needing collection:', error);
        res.status(500).json({ success: false, message: 'Error fetching bins needing collection', error: error.message });
    }
});

// Get bins with low battery
router.get('/battery/low', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 30;
        const bins = await Bin.findLowBatteryBins(threshold); // Assumes static method
        res.json({ success: true, count: bins.length, threshold: threshold, data: bins });
    } catch (error) {
        console.error('Error fetching low battery bins:', error);
        res.status(500).json({ success: false, message: 'Error fetching low battery bins', error: error.message });
    }
});

// Get system statistics
router.get('/stats/system', async (req, res) => {
    try {
        const stats = await Bin.getSystemStats(); // Assumes static method
        res.json({ success: true, data: { ...stats, timestamp: new Date().toISOString() } });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching system stats', error: error.message });
    }
});

// Get bin alerts
router.get('/:binId/alerts', async (req, res) => {
    try {
        const binId = parseInt(req.params.binId);
        const { resolved } = req.query;

        if (isNaN(binId)) { return res.status(400).json({ success: false, message: 'Invalid bin ID' }); }

        const bin = await Bin.findOne({ binId });
        if (!bin) { return res.status(404).json({ success: false, message: 'Bin not found' }); }

        let alerts = bin.metadata.alerts;
        if (resolved !== undefined) {
            const isResolved = resolved === 'true';
            alerts = alerts.filter(alert => alert.resolved === isResolved);
        }
        res.json({ success: true, count: alerts.length, data: alerts });
    } catch (error) {
        console.error('Error fetching bin alerts:', error);
        res.status(500).json({ success: false, message: 'Error fetching bin alerts', error: error.message });
    }
});

// Add alert to bin
router.post('/:binId/alerts', async (req, res) => {
    try {
        const binId = parseInt(req.params.binId);
        const { type, message } = req.body;

        if (isNaN(binId) || !type || !message) {
            return res.status(400).json({ success: false, message: 'Invalid bin ID, alert type, or message.' });
        }
        const validTypes = ['full', 'maintenance', 'battery', 'sensor_error', 'emptied']; // Added 'emptied'
        if (!validTypes.includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid alert type' });
        }

        const bin = await Bin.findOne({ binId });
        if (!bin) { return res.status(404).json({ success: false, message: 'Bin not found' }); }

        if (bin.addAlert) {
            await bin.addAlert(type, message);
        } else {
            console.warn("Bin.addAlert method not found. Alert not added.");
            return res.status(500).json({ success: false, message: 'Server configuration error: addAlert method missing on Bin model.' });
        }

        // 🚀 Emit to Socket.IO clients
        const io = req.app.get('io');
        if (io) {
            io.emit('alert_added', {
                binId: binId,
                alert: { type, message, timestamp: new Date() } // Send specific alert data
            });
            console.log(`Socket.IO: Emitted 'alert_added' for bin ${binId}`);
        }

        res.status(201).json({
            success: true,
            message: 'Alert added successfully',
            data: bin.metadata.alerts[bin.metadata.alerts.length - 1]
        });
    } catch (error) {
        console.error('Error adding alert:', error);
        res.status(500).json({ success: false, message: 'Error adding alert', error: error.message });
    }
});

// Resolve alert
router.patch('/:binId/alerts/:alertId', async (req, res) => {
    try {
        const binId = parseInt(req.params.binId);
        const { alertId } = req.params;

        if (isNaN(binId)) { return res.status(400).json({ success: false, message: 'Invalid bin ID' }); }

        const bin = await Bin.findOne({ binId });
        if (!bin) { return res.status(404).json({ success: false, message: 'Bin not found' }); }

        if (bin.resolveAlert) {
            await bin.resolveAlert(alertId);
        } else {
            console.warn("Bin.resolveAlert method not found. Alert not resolved.");
            return res.status(500).json({ success: false, message: 'Server configuration error: resolveAlert method missing on Bin model.' });
        }

        // 🚀 Emit to Socket.IO clients
        const io = req.app.get('io');
        if (io) {
            io.emit('alert_resolved', {
                binId: binId,
                alertId: alertId
            });
            console.log(`Socket.IO: Emitted 'alert_resolved' for bin ${binId}, alert ${alertId}`);
        }

        res.json({ success: true, message: 'Alert resolved successfully' });
    } catch (error) {
        console.error('Error resolving alert:', error);
        if (error.message === 'Alert not found') {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
        res.status(500).json({ success: false, message: 'Error resolving alert', error: error.message });
    }
});

module.exports = router;