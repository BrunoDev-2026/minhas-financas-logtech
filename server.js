const express = require('express');
const cors = require('cors');
const path = require('path'); 
const fs = require('fs'); 
const connectDB = require('./db');
require('dotenv').config();

const app = express();

// 1. Database Connection
connectDB();

// 2. Middlewares
app.use(cors());
app.use(express.json()); 

// 3. Robust Static File Serving
// Procura pela pasta 'financas' ou serve a raiz se estiver dentro dela
const publicPath = fs.existsSync(path.join(__dirname, 'financas')) 
    ? path.join(__dirname, 'financas') 
    : __dirname;

app.use(express.static(publicPath));

// 4. Data Model
const Transaction = require('./Transaction');

// 5. API Routes

// Health check
app.get('/api/status', (req, res) => res.json({ status: 'OK', database: 'Connected' }));

// GET: List all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error('Erro GET /api/transactions:', err);
        res.status(500).json({ error: 'Erro ao buscar transações' });
    }
});

// POST: Create new transaction
app.post('/api/transactions', async (req, res) => {
    try {
        const novaTransacao = new Transaction(req.body);
        await novaTransacao.save();
        res.status(201).json(novaTransacao);
    } catch (err) {
        console.error('Erro POST /api/transactions:', err);
        res.status(400).json({ error: 'Erro ao salvar transação' });
    }
});

// PUT: Update transaction
app.put('/api/transactions/:id', async (req, res) => {
    try {
        const updated = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Transação não encontrada' });
        res.json(updated);
    } catch (err) {
        console.error('Erro PUT /api/transactions:', err);
        res.status(400).json({ error: 'Erro ao atualizar transação' });
    }
});

// DELETE: Remove transaction
app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const deleted = await Transaction.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Transação não encontrada' });
        res.json({ message: 'Transação excluída com sucesso' });
    } catch (err) {
        console.error('Erro DELETE /api/transactions:', err);
        res.status(500).json({ error: 'Erro ao excluir transação' });
    }
});

// 6. SPA Routing (serve index.html for unknown routes)
app.get('*', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Error: index.html not found');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Senior ON na porta ${PORT}`);
    console.log(`📁 Servindo arquivos de: ${publicPath}`);
    console.log(`🔗 Local: http://localhost:${PORT}\n`);
});