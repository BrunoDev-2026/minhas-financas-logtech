/**
 * api.js — Serviço de comunicação com o backend Node.js
 */

const API_BASE_URL = 'http://localhost:3000/api';

const Api = {
    /**
     * Busca todas as transações do MongoDB
     */
    getTransactions: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions`);
            if (!response.ok) throw new Error('Falha ao buscar transações');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    },

    /**
     * Salva uma nova transação no MongoDB
     */
    createTransaction: async (transaction) => {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transaction)
            });
            if (!response.ok) throw new Error('Falha ao criar transação');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    },

    /**
     * Atualiza uma transação existente
     */
    updateTransaction: async (id, transaction) => {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transaction)
            });
            if (!response.ok) throw new Error('Falha ao atualizar transação');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    },

    /**
     * Exclui uma transação
     */
    deleteTransaction: async (id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Falha ao excluir transação');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return false;
        }
    },

    /**
     * Verifica se o servidor está online
     */
    checkStatus: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/status`);
            return response.ok;
        } catch {
            return false;
        }
    }
};
