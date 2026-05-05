/**
 * storage.js — Gerenciamento do LocalStorage
 * Correções: adicionadas categorias de receita, método updateBill, defaults robustos
 */

const STORAGE_KEYS = {
    TRANSACTIONS: 'financas_transactions',
    GOAL: 'financas_goal',
    CATEGORIES: 'financas_categories',
    FIXED_BILLS: 'financas_fixed_bills',
    SOUND_PREF: 'financas_sound_pref',
    ECO_MODE: 'financas_eco_mode',
    PROFILE: 'financas_profile'
};

const DEFAULT_CATEGORIES = [
    // Despesas
    { id: '1',  name: 'Mercado',      icon: 'shopping-cart', color: '#10b981' },
    { id: '2',  name: 'Combustível',  icon: 'fuel',          color: '#f59e0b' },
    { id: '3',  name: 'Contas',       icon: 'file-text',     color: '#3b82f6' },
    { id: '4',  name: 'Lazer',        icon: 'gamepad-2',     color: '#ec4899' },
    { id: '5',  name: 'iFood',        icon: 'utensils',      color: '#ef4444' },
    { id: '7',  name: 'Outros',       icon: 'package',       color: '#6b7280' },
    // Receitas
    { id: '6',  name: 'Salário',      icon: 'banknote',      color: '#10B981', type: 'income' },
    { id: '8',  name: 'Freelance',    icon: 'laptop',        color: '#3b82f6', type: 'income' },
    { id: '9',  name: 'Comissão',     icon: 'handshake',     color: '#8b5cf6', type: 'income' },
    { id: '10', name: 'Investimentos',icon: 'bar-chart-3',  color: '#f59e0b', type: 'income' },
    { id: '11', name: 'Renda Extra',  icon: 'sparkles',      color: '#ec4899', type: 'income' }
];

const DEFAULT_BILLS = [
    { id: 'b1', name: 'Aluguel',  amount: 1200, day: 5  },
    { id: 'b2', name: 'Água',     amount: 80,   day: 10 },
    { id: 'b3', name: 'Luz',      amount: 150,  day: 15 },
    { id: 'b4', name: 'Internet', amount: 100,  day: 20 }
];

const Storage = {

    // ─── Transactions ────────────────────────────────────────────────────────

    getTransactions: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },

    saveTransactions: (transactions) => {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    },

    addTransaction: async (transaction) => {
        const transactions = Storage.getTransactions();
        transactions.push(transaction);
        Storage.saveTransactions(transactions);
        
        // Sincronização em background com MongoDB
        if (typeof Api !== 'undefined') {
            try {
                const res = await Api.createTransaction(transaction);
                if (res && res._id) {
                    // Atualiza o ID local com o ID do MongoDB para consistência
                    Storage.updateTransactionSync(transaction.id, { mongoId: res._id });
                    return { success: true, remote: true };
                }
                return { success: true, remote: false };
            } catch (err) {
                console.error('Erro na sincronização:', err);
                return { success: true, remote: false, error: err.message };
            }
        }
        return { success: true, remote: false };
    },

    // Versão interna para atualizar sem disparar novo sync
    updateTransactionSync: (id, updatedData) => {
        const transactions = Storage.getTransactions();
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            transactions[index] = { ...transactions[index], ...updatedData };
            Storage.saveTransactions(transactions);
        }
    },

    updateTransaction: async (id, updatedTransaction) => {
        const transactions = Storage.getTransactions();
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            const oldData = transactions[index];
            transactions[index] = { ...oldData, ...updatedTransaction };
            Storage.saveTransactions(transactions);

            // Sincronização em background com MongoDB
            if (typeof Api !== 'undefined') {
                const syncId = updatedTransaction.mongoId || oldData.mongoId || id;
                try {
                    const res = await Api.updateTransaction(syncId, transactions[index]);
                    return { success: true, remote: !!res };
                } catch (err) {
                    return { success: true, remote: false, error: err.message };
                }
            }
        }
        return { success: false };
    },

    deleteTransaction: async (id) => {
        const transactions = Storage.getTransactions();
        const toDelete = transactions.find(t => t.id === id);
        const filtered = transactions.filter(t => t.id !== id);
        Storage.saveTransactions(filtered);

        // Sincronização em background com MongoDB
        if (typeof Api !== 'undefined' && toDelete) {
            const syncId = toDelete.mongoId || id;
            try {
                const res = await Api.deleteTransaction(syncId);
                return { success: true, remote: !!res };
            } catch (err) {
                return { success: true, remote: false, error: err.message };
            }
        }
        return { success: true, remote: false };
    },

    togglePinTransaction: (id) => {
        const transactions = Storage.getTransactions();
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            transactions[index].pinned = !transactions[index].pinned;
            Storage.saveTransactions(transactions);
            return true;
        }
        return false;
    },

    // ─── Goal ────────────────────────────────────────────────────────────────

    getGoal: () => {
        const data = localStorage.getItem(STORAGE_KEYS.GOAL);
        return data ? parseFloat(data) : 3000.00;
    },

    saveGoal: (amount) => {
        localStorage.setItem(STORAGE_KEYS.GOAL, amount.toString());
    },

    // ─── Settings ────────────────────────────────────────────────────────────

    getSoundPref: () => localStorage.getItem(STORAGE_KEYS.SOUND_PREF) || 'ca-ching.mp3',
    saveSoundPref: (sound) => localStorage.setItem(STORAGE_KEYS.SOUND_PREF, sound),

    getEcoMode: () => localStorage.getItem(STORAGE_KEYS.ECO_MODE) === 'true',
    saveEcoMode: (val) => localStorage.setItem(STORAGE_KEYS.ECO_MODE, val ? 'true' : 'false'),

    // ─── Profile ─────────────────────────────────────────────────────────────

    getProfile: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
            return data ? JSON.parse(data) : { name: 'Usuário', color: '#10b981', photo: null };
        } catch {
            return { name: 'Usuário', color: '#10b981', photo: null };
        }
    },

    saveProfile: (profile) => {
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    },

    // ─── Categories ──────────────────────────────────────────────────────────

    getCategories: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
            if (!data) {
                Storage.saveCategories(DEFAULT_CATEGORIES);
                return DEFAULT_CATEGORIES;
            }
            const saved = JSON.parse(data);
            // Atualiza ícones das categorias padrão caso tenham mudado (ex: migração para Lucide)
            const updated = saved.map(s => {
                const def = DEFAULT_CATEGORIES.find(d => d.id === s.id);
                if (def) return { ...s, icon: def.icon }; // Mantém nome/cor customizados mas atualiza ícone
                return s;
            });
            
            const ids = updated.map(c => c.id);
            const missing = DEFAULT_CATEGORIES.filter(c => !ids.includes(c.id));
            const final = [...updated, ...missing];
            
            if (missing.length || JSON.stringify(saved) !== JSON.stringify(final)) {
                Storage.saveCategories(final);
            }
            return final;
        } catch {
            Storage.saveCategories(DEFAULT_CATEGORIES);
            return DEFAULT_CATEGORIES;
        }
    },

    saveCategories: (categories) => {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    },

    updateCategory: (id, data) => {
        const categories = Storage.getCategories();
        const index = categories.findIndex(c => c.id === String(id));
        if (index !== -1) {
            categories[index] = { ...categories[index], ...data };
            Storage.saveCategories(categories);
            return true;
        }
        return false;
    },

    getCategoryById: (id) => {
        const categories = Storage.getCategories();
        return categories.find(c => c.id === String(id))
            || DEFAULT_CATEGORIES.find(c => c.id === '7'); // fallback "Outros"
    },

    // Retorna categorias de despesa
    getExpenseCategories: () => Storage.getCategories().filter(c => c.type !== 'income'),

    // Retorna categorias de receita
    getIncomeCategories: () => Storage.getCategories().filter(c => c.type === 'income'),

    // ─── Fixed Bills ─────────────────────────────────────────────────────────

    getBills: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.FIXED_BILLS);
            return data ? JSON.parse(data) : DEFAULT_BILLS;
        } catch { return DEFAULT_BILLS; }
    },

    saveBills: (bills) => {
        localStorage.setItem(STORAGE_KEYS.FIXED_BILLS, JSON.stringify(bills));
    },

    addBill: (bill) => {
        const bills = Storage.getBills();
        bills.push(bill);
        Storage.saveBills(bills);
    },

    // CORREÇÃO: método updateBill que faltava no original
    updateBill: (id, updatedBill) => {
        const bills = Storage.getBills();
        const index = bills.findIndex(b => b.id === id);
        if (index !== -1) {
            bills[index] = { ...bills[index], ...updatedBill };
            Storage.saveBills(bills);
        }
    },

    deleteBill: (id) => {
        const bills = Storage.getBills().filter(b => b.id !== id);
        Storage.saveBills(bills);
    }
};
