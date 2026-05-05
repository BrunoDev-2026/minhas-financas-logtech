const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        // Conecta ao MongoDB usando a URI do seu arquivo .env
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Conectado com sucesso!');
    } catch (err) {
        console.error('❌ Erro ao conectar ao MongoDB:', err.message);
        process.exit(1); // Para o servidor em caso de falha crítica
    }
};

module.exports = connectDB;