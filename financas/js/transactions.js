/**
 * transactions.js — Renderização e ações da lista de transações
 * Correções: agrupamento por data correto, ações funcionais, estado vazio
 */

const TransactionsUI = {

    renderList: (transactions, containerId = 'transactionsList') => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="folder-open" class="empty-icon-lucide"></i>
                    <h3 class="empty-title">Nenhuma transação encontrada</h3>
                    <p class="empty-desc" style="font-size: 0.8rem;">
                        Adicione uma transação ou ajuste os filtros.
                    </p>
                </div>
            `;
            return;
        }

        // Ordena: fixados no topo, depois por data decrescente
        const sorted = [...transactions].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.date) - new Date(a.date);
        });

        let lastLabel = '';

        sorted.forEach(t => {
            const label = TransactionsUI._getRelativeDateLabel(t.date);
            const category = Storage.getCategoryById(t.categoryId);
            const isIncome = Utils.isIncome(t);

            // Cabeçalho de grupo por data
            if (label !== lastLabel) {
                const header = document.createElement('div');
                header.className = 'tx-group-header';
                header.textContent = label;
                container.appendChild(header);
                lastLabel = label;
            }

            const div = document.createElement('div');
            div.className = `transaction-item${t.pinned ? ' pinned' : ''}`;
            div.innerHTML = `
                <div class="tx-left">
                    <div class="tx-icon" style="color: ${category.color}; background-color: ${category.color}20;">
                        ${t.pinned ? '<i data-lucide="pin" class="pin-indicator"></i>' : ''}
                        <i data-lucide="${category.icon || 'tag'}" class="icon-secondary"></i>
                    </div>
                    <div class="tx-details">
                        <span class="tx-title">${t.description || 'Sem descrição'}</span>
                        <span class="tx-category" style="color: ${category.color}; background-color: ${category.color}15; display:inline-flex; align-items:center; gap:3px;">
                            <i data-lucide="${category.icon || 'tag'}" style="width:10px;height:10px;flex-shrink:0;"></i>
                            ${category.name}
                        </span>
                    </div>
                </div>
                <div class="tx-right">
                    <span class="tx-amount ${isIncome ? 'income' : 'expense'}">
                        ${isIncome ? '+' : '−'} ${Utils.formatCurrency(t.amount)}
                    </span>
                    <span class="tx-date">${Utils.formatDate(t.date)}</span>
                    <div class="tx-actions">
                        <button class="btn-icon" onclick="TransactionsUI.togglePin('${t.id}')" title="${t.pinned ? 'Desafixar' : 'Fixar'}">
                            <i data-lucide="${t.pinned ? 'pin-off' : 'pin'}" class="icon-secondary"></i>
                        </button>
                        <button class="btn-icon" onclick="TransactionsUI.edit('${t.id}')" title="Editar">
                            <i data-lucide="edit-3" class="icon-secondary"></i>
                        </button>
                        <button class="btn-icon text-expense" onclick="TransactionsUI.delete('${t.id}')" title="Excluir">
                            <i data-lucide="trash-2" class="icon-secondary"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /** Rótulo de data relativa amigável */
    _getRelativeDateLabel: (dateString) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Usa T00:00:00 para evitar deslocamento de fuso horário
        const target = new Date(dateString + 'T00:00:00');
        const diffMs   = today - target;
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays === 0)  return 'Hoje';
        if (diffDays === 1)  return 'Ontem';
        if (diffDays < 7)   return 'Esta Semana';
        if (diffDays < 14)  return 'Semana Passada';

        return target.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    },

    togglePin: (id) => {
        Storage.togglePinTransaction(id);
        App.refreshDashboard();
    },

    delete: (id) => {
        Utils.confirmAction('Tem certeza que deseja excluir esta transação?', async () => {
            const result = await Storage.deleteTransaction(id);
            
            if (result && result.remote) {
                Utils.showToast('🗑️ Excluído do MongoDB com sucesso!', 'success');
            } else if (result && result.error) {
                Utils.showToast('⚠️ Removido localmente, mas erro ao sincronizar com MongoDB.', 'warning');
            } else {
                Utils.showToast('🗑️ Removido com sucesso (Modo Local).');
            }

            Utils.playSound('assets/sounds/delete.mp3');
            App.refreshDashboard();
        });
    },

    edit: (id) => {
        const t = Storage.getTransactions().find(tx => tx.id === id);
        if (!t) return;
        App.openTransactionModal(t);
    }
};
