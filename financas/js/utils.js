/**
 * utils.js — Utilitários gerais
 * Correções: parseCurrencyInput mais robusto, formatação de data corrigida, animateValue seguro
 */

const Utils = {

    generateId: () =>
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),

    // ─── Formatação ──────────────────────────────────────────────────────────

    formatCurrency: (value) => {
        const num = parseFloat(value) || 0;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(num);
    },

    formatDate: (dateString) => {
        if (!dateString) return '—';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    },

    getCurrentMonthYear: () => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Converte entrada do usuário (ex: "1.234,56" ou "1234.56") para número.
     * Aceita tanto vírgula quanto ponto como separador decimal.
     */
    parseCurrencyInput: (valueStr) => {
        if (typeof valueStr !== 'string') return parseFloat(valueStr) || 0;
        let clean = valueStr.trim();
        // Remove R$, espaços e outros símbolos
        clean = clean.replace(/[R$\s]/g, '');
        // Verifica se tem vírgula como separador decimal (formato pt-BR)
        if (clean.includes(',') && clean.includes('.')) {
            // "1.234,56" — ponto é milhar, vírgula é decimal
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
            // "1234,56" — vírgula é decimal
            clean = clean.replace(',', '.');
        }
        const value = parseFloat(clean);
        return isNaN(value) ? 0 : value;
    },

    // ─── Toast ───────────────────────────────────────────────────────────────

    showToast: (message, type = 'success', duration = 3000) => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = { 
            success: '<i data-lucide="check-circle" style="width:18px;height:18px;color:var(--color-positive)"></i>', 
            error:   '<i data-lucide="alert-circle" style="width:18px;height:18px;color:var(--color-expense)"></i>', 
            warning: '<i data-lucide="alert-triangle" style="width:18px;height:18px;color:var(--color-warning)"></i>' 
        };
        const icon = icons[type] || icons.success;

        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Força reflow para iniciar transição
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, duration);
    },

    // ─── Áudio ───────────────────────────────────────────────────────────────

    playSound: (path) => {
        // Não toca sons se estiver no modo eco ou se o caminho for inválido
        if (localStorage.getItem('financas_eco_mode') === 'true' || !path) return;
        
        try {
            const audio = new Audio(path);
            audio.volume = 0.4;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { /* Silencia erro de carregamento no console */ });
            }
        } catch (e) { /* Silencia erro de construção */ }
    },

    /** Feedback tátil para mobile */
    hapticFeedback: () => {
        if ("vibrate" in navigator) {
            try {
                navigator.vibrate(10); // Vibração curta de 10ms (estilo "tick")
            } catch {}
        }
    },

    // ─── Animação de valor ───────────────────────────────────────────────────

    animateValue: (element, start, end, duration, formatFn = Utils.formatCurrency) => {
        if (!element) return;
        let startTimestamp = null;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * (end - start) + start;
            element.textContent = formatFn(current);
            if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    },

    // ─── Confirmação ─────────────────────────────────────────────────────────

    confirmAction: (message, onConfirm) => {
        if (window.confirm(message)) onConfirm();
    },

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /** Verifica se uma transação é receita */
    isIncome: (transaction) => {
        const cat = Storage.getCategoryById(transaction.categoryId);
        return cat.type === 'income' || transaction.type === 'income';
    }
};
