// backend/src/models/counter.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // The name of the sequence, e.g., 'binId'
    seq: { type: Number, default: 0 }    // The current sequence value
});

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;