const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    categoryId: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    date: { type: String, required: true }, // Mantido como String para facilitar match com ISO date do frontend
    pinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);