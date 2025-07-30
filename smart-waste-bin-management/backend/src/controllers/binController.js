const Bin = require('../models/bin'); // Assuming your Bin model is in backend/src/models/bin.js

// Helper function to broadcast messages via Socket.IO
// This function takes the request object to get the 'io' instance
const emitBinUpdate = async (req, eventName, data) => {
    const io = req.app.get('io'); // Get the socket.io instance attached to the app
    if (io) {
        try {
            const allBins = await Bin.find({}); // Fetch updated list of bins to send
            // Emit to all connected clients
            io.emit(eventName, { payload: allBins, singleBin: data });
            console.log(`Socket.IO: Emitted '${eventName}' update.`);
        } catch (dbError) {
            console.error('Error fetching bins for Socket.IO emit:', dbError);
        }
    } else {
        console.warn('Socket.IO server (io) not available on app object.');
    }
};


// Get the status of all bins
exports.getAllBins = async (req, res) => {
    try {
        const bins = await Bin.find();
        res.status(200).json({ success: true, data: bins });
    } catch (error) {
        console.error('Error retrieving bins:', error);
        res.status(500).json({ success: false, message: 'Error retrieving bins', error: error.message });
    }
};

// Get the status of a specific bin by binId (not _id)
exports.getBinStatus = async (req, res) => {
    const { binId } = req.params;
    try {
        const bin = await Bin.findOne({ binId });
        if (!bin) {
            return res.status(404).json({ success: false, message: 'Bin not found' });
        }
        res.status(200).json({ success: true, data: bin });
    } catch (error) {
        console.error('Error retrieving bin:', error);
        res.status(500).json({ success: false, message: 'Error retrieving bin', error: error.message });
    }
};

// Get the fill level history of a bin (stub, implement as needed)
exports.getBinHistory = async (req, res) => {
    res.status(501).json({ success: false, message: 'Bin history not implemented.' });
};

// Update the fill level of a specific bin
exports.updateBin = async (req, res) => {
    const { binId } = req.params;
    const { fillLevel } = req.body;

    if (typeof fillLevel !== 'number' || fillLevel < 0 || fillLevel > 100) {
        return res.status(400).json({ success: false, message: 'Fill level must be a number between 0 and 100.' });
    }

    try {
        const updatedBin = await Bin.findOneAndUpdate(
            { binId },
            { fillLevel, timestamp: Date.now() },
            { new: true }
        );
        if (!updatedBin) {
            return res.status(404).json({ success: false, message: 'Bin not found' });
        }

        // Emit real-time update using socket.io
        await emitBinUpdate(req, 'binUpdated', updatedBin);

        res.status(200).json({ success: true, data: updatedBin });
    } catch (error) {
        console.error('Error updating bin:', error);
        res.status(500).json({ success: false, message: 'Error updating bin', error: error.message });
    }
};

// Add a new bin
exports.createBin = async (req, res) => {
    const { binId, location, capacity, fillLevel, batteryLevel, temperature, sensorStatus, lastEmptied, coordinates, metadata } = req.body;

    if (!binId || !location) {
        return res.status(400).json({ success: false, message: 'Bin ID and location are required.' });
    }

    try {
        const existingBin = await Bin.findOne({ binId });
        if (existingBin) {
            return res.status(409).json({ success: false, message: 'Bin with this ID already exists.' });
        }

        const newBin = new Bin({
            binId,
            location: location.trim(),
            capacity: capacity || 100,
            fillLevel: fillLevel || 0,
            batteryLevel: batteryLevel || 100,
            temperature: temperature || 20,
            sensorStatus: sensorStatus || 'active',
            lastEmptied: lastEmptied || new Date(),
            coordinates: coordinates || {},
            metadata: {
                ...metadata,
                installationDate: new Date()
            }
        });

        await newBin.save();

        // Emit real-time update using socket.io
        await emitBinUpdate(req, 'binAdded', newBin);

        res.status(201).json({ success: true, message: 'Bin created successfully.', data: newBin });
    } catch (error) {
        console.error('Error creating bin:', error);
        res.status(500).json({ success: false, message: 'Error creating bin', error: error.message });
    }
};

// Delete a bin
exports.deleteBin = async (req, res) => {
    const { binId } = req.params;
    try {
        const deletedBin = await Bin.findOneAndDelete({ binId });
        if (!deletedBin) {
            return res.status(404).json({ success: false, message: 'Bin not found.' });
        }

        // Emit real-time update using socket.io
        await emitBinUpdate(req, 'binDeleted', { binId: binId });

        res.status(200).json({ success: true, message: 'Bin deleted successfully.', data: deletedBin });
    } catch (error) {
        console.error('Error deleting bin:', error);
        res.status(500).json({ success: false, message: 'Error deleting bin', error: error.message });
    }
};

// Mark bin as emptied
exports.markBinEmptied = async (req, res) => {
    const { binId } = req.params;
    try {
        const updatedBin = await Bin.findOneAndUpdate(
            { binId },
            { fillLevel: 0, lastEmptied: new Date(), lastUpdated: new Date() },
            { new: true }
        );
        if (!updatedBin) {
            return res.status(404).json({ success: false, message: 'Bin not found' });
        }

        // Emit real-time update using socket.io
        await emitBinUpdate(req, 'binEmptied', updatedBin);

        res.status(200).json({ success: true, message: 'Bin marked as emptied.', data: updatedBin });
    } catch (error) {
        console.error('Error marking bin as emptied:', error);
        res.status(500).json({ success: false, message: 'Error marking bin as emptied', error: error.message });
    }
};