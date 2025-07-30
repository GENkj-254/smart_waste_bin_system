const Bin = require('../models/bin');

// Get the status of all bins
exports.getAllBins = async (req, res) => {
    try {
        const bins = await Bin.find();
        res.status(200).json(bins);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving bins', error });
    }
};

// Get the status of a specific bin by binId (not _id)
exports.getBinStatus = async (req, res) => {
    const { binId } = req.params;
    try {
        const bin = await Bin.findOne({ binId });
        if (!bin) {
            return res.status(404).json({ message: 'Bin not found' });
        }
        res.status(200).json(bin);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving bin', error });
    }
};

// Get the fill level history of a bin (stub, implement as needed)
exports.getBinHistory = async (req, res) => {
    // Implement history logic if you store bin history
    res.status(501).json({ message: 'Bin history not implemented.' });
};

// Update the fill level of a specific bin
exports.updateBin = async (req, res) => {
    const { binId } = req.params;
    const { fillLevel } = req.body;

    // Validate input
    if (typeof fillLevel !== 'number' || fillLevel < 0 || fillLevel > 100) {
        return res.status(400).json({ message: 'Fill level must be a number between 0 and 100.' });
    }

    try {
        const updatedBin = await Bin.findOneAndUpdate(
            { binId },
            { fillLevel, timestamp: Date.now() },
            { new: true }
        );
        if (!updatedBin) {
            return res.status(404).json({ message: 'Bin not found' });
        }

        // Emit real-time update to all
        const io = req.app.get('io');
        if (io) {
            try {
                const bins = await Bin.find();
                io.emit('binUpdate', bins);
            } catch (emitError) {
                console.error('WebSocket emit error:', emitError);
            }
        }

        res.status(200).json(updatedBin);
    } catch (error) {
        console.error('Error updating bin:', error);
        res.status(500).json({ message: 'Error updating bin', error: error.message });
    }
};