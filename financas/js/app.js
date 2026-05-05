/**
 * app.js — Lógica principal da aplicação
 *
 * CORREÇÕES APLICADAS:
 * - projectedExpense definida antes de ser usada (bug de escopo)
 * - populateCategories filtra por tipo (expense/income) conforme seleção
 * - Modal de transação atualiza categorias ao trocar tipo
 * - handleTransactionSubmit: validação de data, descrição e categoria
 * - Receitas: categorias separadas e visíveis
 * - refreshDashboard: renderização robusta e sem erros de referência
 * - Flatpickr: fallback nativo quando CDN falha
 * - Header: sem alterações visuais
 */

const App = {
    prevValues: {
        valSaldo: 0,
        valEntradas: 0,
        valSaidas: 0,
        valEconomia: 0,
        valPercentualEconomia: 0,
        valPrevisao: 0
    },
    criticalAlertsShown: {}, // Para controlar toasts de alerta críticos
    cachedValues: {},
    lastFilteredTransactions: [],

    // ─── Inicialização ────────────────────────────────────────────────────────

    init: () => {
        App.bindEvents();
        App.populateCategories('expense'); // Padrão: despesa ao abrir
        App.refreshDashboard();
        App.refreshBills();
        App.refreshPaidHistory();

        // Sincronização Inicial com MongoDB (Senior approach: Local First + Server Sync)
        App.syncWithServer();

        // Inicializa critical alerts tracking para o mês atual
        App.criticalAlertsShown = JSON.parse(localStorage.getItem('financas_critical_alerts') || '{}');
        const currentMonth = Utils.getCurrentMonthYear();
        if (!App.criticalAlertsShown.month || App.criticalAlertsShown.month !== currentMonth) {
            App.criticalAlertsShown = { month: currentMonth, categories: {} };
        }

        // Carregamento Instantâneo via Cache
        App.loadCache();

        // Simulação de Skeleton Loading
        document.querySelectorAll('.skeleton-wrapper').forEach(el => el.classList.add('loading'));
        
        setTimeout(() => {
            document.querySelectorAll('.skeleton-wrapper').forEach(el => el.classList.remove('loading'));
        }, 1200);

        // Inicializa Tema
        App.initTheme();

        // Inicializa Modo Eco
        App.initEcoMode();

        // Restaura modo de privacidade
        if (localStorage.getItem('privacyMode') === 'true') {
            document.body.classList.add('privacy-active');
            const icon = document.getElementById('iconPrivacidade');
            if (icon) icon.setAttribute('data-lucide', 'eye-off');
        }

        // Inicializa ícones Lucide
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Ouvinte para mudança de tema do sistema (atualiza gráficos)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            App.refreshDashboard();
        });
    },

    /**
     * Sincroniza dados locais com o MongoDB
     */
    syncWithServer: async () => {
        if (typeof Api === 'undefined') return;

        const isOnline = await Api.checkStatus();
        if (!isOnline) {
            console.warn('⚠️ Servidor offline. Operando em modo local.');
            return;
        }

        console.log('🔄 Sincronizando com MongoDB...');
        const remoteTransactions = await Api.getTransactions();
        
        if (remoteTransactions) {
            // Merge simples: Se o servidor tem dados, vamos atualizar o local
            // Em um sistema real, usaríamos timestamps para conflitos
            const localTransactions = Storage.getTransactions();
            
            if (remoteTransactions.length > 0 || localTransactions.length > 0) {
                // Para este projeto, vamos priorizar o que está no MongoDB se houver dados lá
                // Ou se local estiver vazio. 
                if (remoteTransactions.length >= localTransactions.length) {
                    // Mapeia _id para mongoId para consistência
                    const normalized = remoteTransactions.map(t => ({
                        ...t,
                        id: t.id || t._id,
                        mongoId: t._id
                    }));
                    Storage.saveTransactions(normalized);
                    App.refreshDashboard();
                    console.log('✅ Sincronização concluída.');
                } else {
                    // Se local tem mais dados, vamos subir os faltantes (bulk sync simplificado)
                    console.log('📤 Enviando dados locais novos para o servidor...');
                    for (const t of localTransactions) {
                        if (!t.mongoId) {
                            await Api.createTransaction(t);
                        }
                    }
                }
            }
        }
    },


    // ─── Eventos ─────────────────────────────────────────────────────────────

    bindEvents: () => {
        // Modal de Transação
        document.getElementById('btnNovaTransacao')
            ?.addEventListener('click', () => App.openTransactionModal());
        document.getElementById('modalTransacaoClose')
            ?.addEventListener('click', () => App.closeTransactionModal());
        document.getElementById('btnTransacaoCancelar')
            ?.addEventListener('click', () => App.closeTransactionModal());
        document.getElementById('formTransacao')
            ?.addEventListener('submit', App.handleTransactionSubmit);

        // Ao trocar tipo (Entrada / Saída), atualiza lista de categorias
        document.querySelectorAll('input[name="txType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                App.populateCategories(radio.value);
            });
        });

        // Privacidade
        document.getElementById('btnPrivacidade')
            ?.addEventListener('click', App.togglePrivacy);

        // Modo Eco
        document.getElementById('btnEco')
            ?.addEventListener('click', App.toggleEcoMode);

        // Alternar Tema
        document.getElementById('btnTheme')
            ?.addEventListener('click', App.toggleTheme);

        // Modal de Meta
        document.getElementById('btnDefinirMeta')
            ?.addEventListener('click', App.openMetaModal);
        document.getElementById('modalMetaClose')
            ?.addEventListener('click', App.closeMetaModal);
        document.getElementById('btnMetaCancelar')
            ?.addEventListener('click', App.closeMetaModal);
        document.getElementById('formMeta')
            ?.addEventListener('submit', App.handleMetaSubmit);

        // Modal de Conta Fixa
        document.getElementById('btnNovaContaFixa')
            ?.addEventListener('click', App.openBillModal);
        document.getElementById('modalContaClose')
            ?.addEventListener('click', App.closeBillModal);
        document.getElementById('btnContaCancelar')
            ?.addEventListener('click', App.closeBillModal);
        document.getElementById('formConta')
            ?.addEventListener('submit', App.handleBillSubmit);

        // Exportações
        document.getElementById('btnExportCSV')
            ?.addEventListener('click', App.exportCSV);
        document.getElementById('btnPrintReport')
            ?.addEventListener('click', App.printReport);
        document.getElementById('btnExportPDF')
            ?.addEventListener('click', App.exportPDF);

        // Filtros
        document.getElementById('inputMonthFilter')
            ?.addEventListener('change', App.refreshDashboard);
        document.getElementById('inputTransactionTypeFilter')
            ?.addEventListener('change', App.refreshDashboard);
        document.getElementById('inputSearchTx')
            ?.addEventListener('input', App.refreshDashboard);
        document.getElementById('btnClearFilters')
            ?.addEventListener('click', App.clearFilters);

        // Feedback sonoro de hover nos cards principais
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', () => Utils.playSound('assets/sounds/hover.mp3'));
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            });
        });

        // Feedback háptico global em botões
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn') || e.target.closest('.btn-icon')) {
                Utils.hapticFeedback();
            }
        });

        // Colapsar Detalhamento da Meta
        document.getElementById('headerGoal')?.addEventListener('click', () => {
            document.getElementById('cardGoal')?.classList.toggle('collapsed');
        });

        // Novos Accordions
        document.getElementById('headerEvolucao')?.addEventListener('click', () => {
            document.getElementById('cardEvolucao')?.classList.toggle('collapsed');
        });
        document.getElementById('headerCategorias')?.addEventListener('click', () => {
            document.getElementById('cardCategorias')?.classList.toggle('collapsed');
        });
        document.getElementById('headerTransacoes')?.addEventListener('click', (e) => {
            // Evita fechar ao clicar no input de busca
            if (e.target.tagName !== 'INPUT') {
                document.getElementById('cardTransacoes')?.classList.toggle('collapsed');
            }
        });

        // Inicializa mês atual no filtro
        const inputMonth = document.getElementById('inputMonthFilter');
        if (inputMonth && !inputMonth.value) {
            inputMonth.value = Utils.getCurrentMonthYear();
        }

        // Flatpickr (opcional — fallback para input nativo se não carregar)
        App._initFlatpickr();

        // Atalho de teclado 'N' para nova transação
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement?.tagName;
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
            const isModalOpen = document.querySelector('.modal-overlay.active');

            if (e.key.toLowerCase() === 'n' && !isInput && !isModalOpen) {
                e.preventDefault();
                App.openTransactionModal();
            }
            // Atalho 'T' para alternar tema
            if (e.key.toLowerCase() === 't' && !isInput && !isModalOpen) {
                e.preventDefault();
                App.toggleTheme();
            }
            if (e.key === 'Escape' && isModalOpen) {
                document.querySelectorAll('.modal-overlay.active').forEach(m => {
                    m.classList.remove('active');
                });
            }
        });

        // Fecha modal ao clicar no overlay (fora do conteúdo)
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });
    },

    _initFlatpickr: () => {
        if (typeof flatpickr === 'undefined') return;

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

        // Datas simples
        document.querySelectorAll('.flatpickr-date').forEach(el => {
            if (el._flatpickr) el._flatpickr.destroy();
            flatpickr(el, {
                locale: typeof flatpickr.l10ns?.pt !== 'undefined' ? 'pt' : 'default',
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'd/m/Y',
                disableMobile: true,
                defaultDate: el.value || 'today'
            });
        });

        // Seletor de mês
        if (typeof monthSelectPlugin !== 'undefined') {
            const monthEl = document.getElementById('inputMonthFilter');
            if (monthEl) {
                const currentVal = monthEl.value;
                if (monthEl._flatpickr) monthEl._flatpickr.destroy();
                flatpickr(monthEl, {
                    locale: 'pt',
                    plugins: [
                        new monthSelectPlugin({
                            shorthand: true,
                            dateFormat: 'Y-m',
                            altFormat: 'F Y',
                            theme: currentTheme === 'dark' ? 'dark' : 'light'
                        })
                    ],
                    defaultDate: currentVal,
                    onChange: () => App.refreshDashboard()
                });
            }
        }
    },

    // ─── Filtros ─────────────────────────────────────────────────────────────

    clearFilters: () => {
        const currentMonth = Utils.getCurrentMonthYear();
        const inputMonth  = document.getElementById('inputMonthFilter');
        const inputType   = document.getElementById('inputTransactionTypeFilter');
        const inputSearch = document.getElementById('inputSearchTx');

        // Animação de rotação
        const icon = document.querySelector('#btnClearFilters i[data-lucide]');
        if (icon) {
            icon.classList.add('rotate-reset');
            icon.addEventListener('animationend', () => icon.classList.remove('rotate-reset'), { once: true });
        }

        if (inputMonth) {
            if (inputMonth._flatpickr) inputMonth._flatpickr.setDate(currentMonth);
            else inputMonth.value = currentMonth;
        }
        if (inputType)   inputType.value  = 'all';
        if (inputSearch) inputSearch.value = '';

        App.refreshDashboard();
        Utils.showToast('Filtros limpos');
    },

    // ─── Privacidade ─────────────────────────────────────────────────────────

    togglePrivacy: () => {
        const isPrivate = document.body.classList.toggle('privacy-active');
        localStorage.setItem('privacyMode', isPrivate);
        const icon = document.getElementById('iconPrivacidade');
        if (icon) {
            icon.setAttribute('data-lucide', isPrivate ? 'eye-off' : 'eye');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        Utils.showToast(isPrivate ? 'Valores ocultados 🔒' : 'Valores visíveis 👁️');
    },

    // ─── Categorias ──────────────────────────────────────────────────────────

    /**
     * Popula o select de categorias filtrando pelo tipo da transação.
     * @param {'expense'|'income'|'all'} type
     */
    populateCategories: (type = 'expense') => {
        const select = document.getElementById('inputCategoria');
        if (!select) return;

        const all = Storage.getCategories();
        const filtered = type === 'income'
            ? all.filter(c => c.type === 'income')
            : all.filter(c => c.type !== 'income');

        select.innerHTML = '';
        filtered.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });
    },

    // ─── Dashboard ───────────────────────────────────────────────────────────

    loadCache: () => {
        const cache = JSON.parse(localStorage.getItem('financas_ui_cache') || '{}');
        if (cache.metrics) {
            App.cachedValues = {};
            Object.entries(cache.metrics).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
                // Armazena valores numéricos limpos para comparação
                App.cachedValues[id] = Utils.parseCurrencyInput(val);
            });
        }
    },

    saveCache: (metrics) => {
        localStorage.setItem('financas_ui_cache', JSON.stringify({ metrics }));
    },

    refreshDashboard: () => {
        const transactions = Storage.getTransactions();

        // 1. Get Filters
        const inputMonth = document.getElementById('inputMonthFilter');
        const monthFilter = inputMonth?.value || Utils.getCurrentMonthYear();

        const typeFilterEl = document.getElementById('inputTransactionTypeFilter');
        const typeFilter   = typeFilterEl?.value || 'all';

        const searchFilter = (document.getElementById('inputSearchTx')?.value || '').toLowerCase().trim();

        // 2. Update Type Filter UI
        if (typeFilterEl) {
            typeFilterEl.classList.remove('filter-income', 'filter-expense');
            const indicator = document.getElementById('typeFilterIndicator');
            const btnText   = document.querySelector('#btnNovaTransacao .btn-text');

            if (typeFilter === 'income') {
                if (indicator) { indicator.setAttribute('data-lucide', 'trending-up'); indicator.className = 'filter-indicator text-positive'; }
                if (btnText) btnText.textContent = 'Nova Receita';
            } else if (typeFilter === 'expense') {
                if (indicator) { indicator.setAttribute('data-lucide', 'trending-down'); indicator.className = 'filter-indicator text-expense'; }
                if (btnText) btnText.textContent = 'Nova Despesa';
            } else {
                if (indicator) { indicator.setAttribute('data-lucide', 'chevrons-up-down'); indicator.className = 'filter-indicator text-secondary'; }
                if (btnText) btnText.textContent = 'Nova';
            }
        }

        // 3. Current Month Calculations
        const monthlyTx = transactions.filter(t => t.date.startsWith(monthFilter));
        let income = 0, expense = 0;
        const incomeCats = {}, expenseCats = {};

        monthlyTx.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            if (Utils.isIncome(t)) {
                income += amt;
                incomeCats[t.categoryId] = (incomeCats[t.categoryId] || 0) + amt;
            } else {
                expense += amt;
                expenseCats[t.categoryId] = (expenseCats[t.categoryId] || 0) + amt;
            }
        });

        const balance = income - expense;
        const savings = income - expense;
        const percSav = income > 0 ? (savings / income) * 100 : 0;
        const goal = Storage.getGoal();

        // 4. Projection
        const [yr, mo] = monthFilter.split('-').map(Number);
        const now = new Date();
        let projectedExpense = expense;
        const isCurrentMonth = now.getFullYear() === yr && (now.getMonth() + 1) === mo;

        if (isCurrentMonth) {
            const day = now.getDate();
            const totalDays = new Date(yr, mo, 0).getDate();
            projectedExpense = day > 0 ? (expense / day) * totalDays : 0;
        } else if (yr > now.getFullYear() || (yr === now.getFullYear() && mo > now.getMonth() + 1)) {
            projectedExpense = 0;
        }

        // 5. Previous Month Calculations (for Sparklines)
        const prevDate = new Date(yr, mo - 2, 1);
        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const prevMonthTx = transactions.filter(t => t.date.startsWith(prevMonthKey));
        
        let prevIn = 0, prevOut = 0;
        prevMonthTx.forEach(t => {
            if (Utils.isIncome(t)) prevIn += parseFloat(t.amount) || 0;
            else prevOut += parseFloat(t.amount) || 0;
        });
        const prevBalance = prevIn - prevOut;
        const prevSavings = prevIn - prevOut;
        const prevPerc = prevIn > 0 ? (prevSavings / prevIn) * 100 : 0;
        const prevProjectedExpense = prevOut;

        // 6. Icon Colors (Top Categories)
        const getTopColor = (map) => {
            const keys = Object.keys(map);
            if (!keys.length) return null;
            const topId = keys.reduce((a, b) => map[a] > map[b] ? a : b);
            return topId ? Storage.getCategoryById(topId).color : null;
        };
        const topInColor = getTopColor(incomeCats) || '#10B981';
        const topOutColor = getTopColor(expenseCats) || '#EF4444';

        // 7. Render Sparklines (SINGLE CALLS)
        Charts.renderSparkline('sparkSaldo', balance, prevBalance, balance >= 0 ? '#10B981' : '#EF4444');
        Charts.renderSparkline('sparkEntradas', income, prevIn, '#10B981');
        Charts.renderSparkline('sparkSaidas', expense, prevOut, '#EF4444');
        Charts.renderSparkline('sparkEconomia', savings, prevSavings, savings >= 0 ? '#10B981' : '#EF4444');
        Charts.renderSparkline('sparkPerc', percSav, prevPerc, percSav >= 0 ? '#10B981' : '#EF4444');
        Charts.renderSparkline('sparkPrevisao', projectedExpense, prevProjectedExpense, (goal > 0 && projectedExpense > goal) ? '#EF4444' : '#10B981');

        // 8. Update Cards with Animation
        const cards = [
            { id: 'valSaldo',              value: balance,          fmt: Utils.formatCurrency },
            { id: 'valEntradas',           value: income,           fmt: Utils.formatCurrency },
            { id: 'valSaidas',             value: expense,          fmt: Utils.formatCurrency },
            { id: 'valEconomia',           value: savings,          fmt: Utils.formatCurrency },
            { id: 'valPercentualEconomia', value: percSav,          fmt: (v) => `${v.toFixed(1)}%` },
            { id: 'valPrevisao',           value: projectedExpense, fmt: Utils.formatCurrency }
        ];

        cards.forEach(({ id, value, fmt }) => {
            const el = document.getElementById(id);
            if (!el) return;

            // Cache & Glow
            const cachedVal = App.cachedValues[id] || 0;
            const card = el.closest('.card');
            if (card && cachedVal !== 0) {
                const diff = Math.abs(value - cachedVal);
                const percentChange = (diff / Math.abs(cachedVal)) * 100;
                if (percentChange > 10) {
                    card.classList.add('glow-alert');
                    setTimeout(() => card.classList.remove('glow-alert'), 10000);
                }
            }

            Utils.animateValue(el, App.prevValues[id] || 0, value, 800, fmt);
            App.prevValues[id] = value;

            // Contextual Colors & Icons Glow
            if (id === 'valPercentualEconomia') {
                el.style.color = value >= 20 ? 'var(--color-positive)' : (value > 0 ? 'var(--color-warning)' : 'var(--color-expense)');
            }

            const icon = card?.querySelector('.card-icon');
            if (icon) {
                icon.classList.remove('glow-active');
                const isPositiveCard = ['valSaldo', 'valEntradas', 'valEconomia', 'valPercentualEconomia'].includes(id);
                const isNegativeCard = ['valSaidas', 'valPrevisao'].includes(id);

                if ((isPositiveCard && value > 0) || (isNegativeCard && value > 0)) {
                    const gColor = isPositiveCard ? topInColor : topOutColor;
                    icon.classList.add('glow-active');
                    icon.style.setProperty('--glow-color', gColor);
                    icon.style.setProperty('--glow-rgba', gColor + '33');
                }
            }

            if (id === 'valPrevisao') {
                const isOverGoal = goal > 0 && value > goal;
                el.style.color = isOverGoal ? 'var(--color-expense)' : 'var(--text-main)';
                if (icon) {
                    if (isOverGoal) icon.classList.add('pulse-warning');
                    else icon.classList.remove('pulse-warning');
                }
            }
        });

        // 9. Extra UI Updates
        const iconEco = document.getElementById('iconEconomia');
        if (iconEco) {
            const inner = iconEco.querySelector('i[data-lucide]');
            if (inner) inner.setAttribute('data-lucide', savings >= 0 ? 'piggy-bank' : 'trending-down');
        }

        if (percSav > 30 && typeof confetti === 'function' && !App._confettiShown) {
             confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 }, colors: ['#10b981', '#3b82f6', '#f59e0b'] });
             App._confettiShown = true; // Prevents spam
             setTimeout(() => App._confettiShown = false, 60000);
        }

        // 10. Filter & Render List
        const filtered = transactions.filter(t => {
            const isInc = Utils.isIncome(t);
            const mMatch = t.date.startsWith(monthFilter);
            const tMatch = typeFilter === 'all' ? true : (typeFilter === 'income' ? isInc : !isInc);
            const sMatch = !searchFilter || (t.description || '').toLowerCase().includes(searchFilter);
            return (t.pinned || mMatch) && tMatch && sMatch;
        });

        App.lastFilteredTransactions = filtered;

        const elCount = document.getElementById('searchCount');
        if (elCount) {
            if (searchFilter || typeFilter !== 'all') {
                elCount.textContent = `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`;
                elCount.classList.add('show');
            } else {
                elCount.textContent = '';
                elCount.classList.remove('show');
            }
        }

        TransactionsUI.renderList(filtered);
        Charts.renderDistributionChart('chartDespesas', filtered);
        Charts.renderComparisonChart('chartComparativo', transactions);
        Charts.renderHealthGauge('chartHealth', percSav);
        App.renderGoalTable(expense, goal);
        Charts.renderGaugeChart('chartGauge', expense, goal);

        // 11. Cache
        const cacheData = {};
        ['valSaldo', 'valEntradas', 'valSaidas', 'valEconomia', 'valPercentualEconomia', 'valPrevisao'].forEach(id => {
            cacheData[id] = document.getElementById(id)?.textContent;
        });
        App.saveCache(cacheData);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // ─── Tema ────────────────────────────────────────────────────────────────

    initTheme: () => {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (systemDark ? 'dark' : 'light');
        
        App.applyTheme(theme);
    },

    applyTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const icon = document.getElementById('iconTheme');
        if (icon) {
            icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        
        // Re-inicializa calendários para aplicar o tema correto
        App._initFlatpickr();

        // Re-renderiza gráficos para ajustar cores de texto
        App.refreshDashboard();
    },

    toggleTheme: () => {
        const current = document.documentElement.getAttribute('data-theme');
        App.applyTheme(current === 'dark' ? 'light' : 'dark');
        Utils.playSound('assets/sounds/woosh.mp3');
    },

    // ─── Relatórios ──────────────────────────────────────────────────────────

    printReport: () => {
        // Expande todos os accordions
        const collapsedCards = document.querySelectorAll('.card.collapsed');
        collapsedCards.forEach(card => card.classList.remove('collapsed'));

        Utils.showToast('Preparando relatório para impressão...', 'warning');

        // Pequeno delay para garantir que as transições de expansão terminem ou o layout se ajuste
        setTimeout(() => {
            window.print();
        }, 500);
    },

    // ─── Modo Eco ─────────────────────────────────────────────────────────────

    initEcoMode: () => {
        const isEco = localStorage.getItem('financas_eco_mode') === 'true';
        if (isEco) App.applyEcoMode(true);
    },

    toggleEcoMode: () => {
        const isEco = !document.body.classList.contains('eco-mode');
        App.applyEcoMode(isEco);
        Utils.showToast(isEco ? 'Modo Eco Ativado 🔋' : 'Performance Máxima ⚡');
    },

    applyEcoMode: (active) => {
        document.body.classList.toggle('eco-mode', active);
        localStorage.setItem('financas_eco_mode', active);
        
        const icon = document.getElementById('iconEco');
        if (icon) {
            icon.style.color = active ? 'var(--color-positive)' : 'inherit';
        }

        // Pausa/Retoma partículas
        if (typeof ParticleSystem !== 'undefined') {
            ParticleSystem.toggle(!active);
        }
    },

    /**
     * Renderiza a tabela de detalhamento da meta
     */
    renderGoalTable: (spent, limit) => {
        const tbody = document.getElementById('goalTableBody');
        if (!tbody) return;

        const remaining = limit - spent;
        const percent   = limit > 0 ? (spent / limit) * 100 : 0;
        const isOver    = spent > limit;

        // Dados de categorias para a meta
        // Initialize critical alerts tracking for the current month if not already done
        const currentMonth = Utils.getCurrentMonthYear();
        if (!App.criticalAlertsShown.month || App.criticalAlertsShown.month !== currentMonth) {
            App.criticalAlertsShown = { month: currentMonth, categories: {} };
            localStorage.setItem('financas_critical_alerts', JSON.stringify(App.criticalAlertsShown));
        }

        const expCategories = Storage.getExpenseCategories();
        const transactions = App.lastFilteredTransactions.filter(t => !Utils.isIncome(t));
        
        const catRows = expCategories.map(cat => {
            const catSpent = transactions.filter(t => t.categoryId === cat.id).reduce((s, t) => s + parseFloat(t.amount), 0);
            if (catSpent === 0 && !cat.limit) return '';
            const isCatOver = cat.limit && catSpent > cat.limit;
            const isCriticallyOver = cat.limit && catSpent > cat.limit * 1.2; // Check for 120%

            if (isCriticallyOver && !App.criticalAlertsShown.categories[cat.id]) {
                Utils.showToast(`Atenção! Categoria "${cat.name}" excedeu 120% da meta!`, 'error', 15000); // 15 seconds
                App.criticalAlertsShown.categories[cat.id] = true;
                localStorage.setItem('financas_critical_alerts', JSON.stringify(App.criticalAlertsShown));
            }
            return `
                <tr class="category-goal-row" style="border-left: 3px solid ${cat.color}">
                    <td>
                        <i data-lucide="${cat.icon}" style="width:14px;height:14px;margin-right:8px;vertical-align:middle;color:${cat.color}"></i>
                        ${cat.name}
                    </td>
                    <td style="cursor:pointer" onclick="App.setCategoryLimit('${cat.id}')">
                        ${Utils.formatCurrency(catSpent)} / <small>${cat.limit ? Utils.formatCurrency(cat.limit) : 'Set'}</small>
                    </td>
                    <td class="${isCatOver ? 'text-expense' : 'text-positive'}">${isCatOver ? 'Excedido' : (cat.limit ? 'Ok' : '—')}</td>
                    <td>
                        <div class="progress-bar-bg"><div class="progress-bar-fill ${isCatOver ? 'bg-expense' : 'bg-positive'}" 
                        style="width: ${cat.limit ? Math.min((catSpent/cat.limit)*100, 100) : 0}%"></div></div>
                    </td>
                </tr>`;
        }).join('');

        tbody.innerHTML = `
            <tr>
                <td>Meta Mensal</td>
                <td>${Utils.formatCurrency(limit)}</td>
                <td><span class="text-secondary">Definido</span></td>
                <td>-</td>
            </tr>
            <tr>
                <td>Total Gasto</td>
                <td>${Utils.formatCurrency(spent)}</td>
                <td class="${isOver ? 'text-expense' : 'text-positive'}">${isOver ? 'Excedido' : 'No Limite'}</td>
                <td>${percent.toFixed(1)}%</td>
            </tr>
            <tr>
                <td>${isOver ? 'Diferença' : 'Disponível'}</td>
                <td class="${isOver ? 'text-expense' : 'text-positive'}">${Utils.formatCurrency(Math.abs(remaining))}</td>
                <td><i data-lucide="${isOver ? 'alert-triangle' : 'check-circle'}" class="icon-secondary ${isOver ? 'text-expense' : 'text-positive'}"></i></td>
                <td style="min-width: 80px;">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${isOver ? 'bg-expense' : 'bg-positive'}" style="width: ${Math.min(percent, 100)}%"></div>
                    </div>
                </td>
            </tr>
            ${catRows}
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // ─── Modal de Transação ───────────────────────────────────────────────────

    openTransactionModal: (tx = null) => {
        const modal = document.getElementById('modalTransacao');
        const form  = document.getElementById('formTransacao');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('txId').value = '';

        // Data padrão: hoje
        const today = new Date().toISOString().split('T')[0];
        const inputData = document.getElementById('inputData');
        if (inputData) {
            if (inputData._flatpickr) inputData._flatpickr.setDate(today);
            else inputData.value = today;
        }

        // Tipo padrão baseado no filtro ativo
        const activeFilter = document.getElementById('inputTransactionTypeFilter')?.value;
        const defaultType  = (activeFilter === 'income') ? 'income' : 'expense';
        const typeRadio    = document.querySelector(`input[name="txType"][value="${defaultType}"]`);
        if (typeRadio) {
            typeRadio.checked = true;
            App.populateCategories(defaultType);
        } else {
            App.populateCategories('expense');
        }

        // Modo edição
        if (tx) {
            document.getElementById('modalTransacaoTitle').textContent = 'Editar Transação';
            document.getElementById('txId').value = tx.id;
            document.getElementById('inputDescricao').value = tx.description || '';
            document.getElementById('inputValor').value = tx.amount;

            const txType = tx.type || 'expense';
            const radio  = document.querySelector(`input[name="txType"][value="${txType}"]`);
            if (radio) { radio.checked = true; App.populateCategories(txType); }

            // Define data
            if (inputData) {
                if (inputData._flatpickr) inputData._flatpickr.setDate(tx.date);
                else inputData.value = tx.date;
            }

            // Define categoria após populate
            requestAnimationFrame(() => {
                const selCat = document.getElementById('inputCategoria');
                if (selCat) selCat.value = tx.categoryId;
            });
        } else {
            document.getElementById('modalTransacaoTitle').textContent = 'Nova Transação';
        }

        modal.classList.add('active');
        // Foca no campo de descrição
        setTimeout(() => document.getElementById('inputDescricao')?.focus(), 150);
    },

    closeTransactionModal: () => {
        document.getElementById('modalTransacao')?.classList.remove('active');
    },

    handleTransactionSubmit: async (e) => {
        e.preventDefault();

        const id          = document.getElementById('txId').value;
        const description = document.getElementById('inputDescricao').value.trim();
        const amountRaw   = document.getElementById('inputValor').value;
        const amount      = Utils.parseCurrencyInput(amountRaw);
        const categoryId  = document.getElementById('inputCategoria').value;
        const date        = document.getElementById('inputData').value;
        const typeEl      = document.querySelector('input[name="txType"]:checked');
        const type        = typeEl?.value || 'expense';

        // ── Validações Robustas ──
        if (!description) {
            Utils.showToast('A descrição não pode estar vazia.', 'error');
            document.getElementById('inputDescricao')?.focus();
            return;
        }
        
        // Validação de valor: não pode ser vazio (0 no parse) ou negativo
        if (amount === 0) {
            Utils.showToast('O valor da transação não pode ser zero ou vazio.', 'error');
            document.getElementById('inputValor')?.focus();
            return;
        }
        if (amount < 0) {
            Utils.showToast('O valor não pode ser negativo.', 'error');
            document.getElementById('inputValor')?.focus();
            return;
        }

        if (!date) {
            Utils.showToast('Selecione uma data para o lançamento.', 'error');
            return;
        }
        if (!categoryId) {
            Utils.showToast('Selecione uma categoria.', 'error');
            return;
        }

        const tx = {
            id:          id || Utils.generateId(),
            amount,
            description,
            categoryId,
            date,
            type,
            pinned:      false
        };

        // Fecha modal e atualiza UI local imediatamente (Otimista)
        App.closeTransactionModal();
        
        Utils.showToast('Salvando dados...', 'warning', 1000);

        let result;
        if (id) {
            const original = Storage.getTransactions().find(t => t.id === id);
            if (original) tx.pinned = original.pinned || false;
            result = await Storage.updateTransaction(id, tx);
        } else {
            result = await Storage.addTransaction(tx);
        }

        // Feedback de sincronização com o banco
        if (result && result.remote) {
            Utils.showToast('✅ Sincronizado com MongoDB com sucesso!', 'success');
            if (!id && type === 'income') Utils.playSound('assets/sounds/ca-ching.mp3');
        } else if (result && result.error) {
            Utils.showToast('💾 Salvo localmente, mas erro ao sincronizar com MongoDB.', 'warning');
        } else {
            Utils.showToast('💾 Salvo com sucesso (Modo Local).', 'success');
        }

        App.refreshDashboard();
    },

    // ─── Modal de Meta ────────────────────────────────────────────────────────

    openMetaModal: () => {
        const modal = document.getElementById('modalMeta');
        if (!modal) return;
        const el = document.getElementById('inputMetaValor');
        if (el) el.value = Storage.getGoal();
        modal.classList.add('active');
    },

    closeMetaModal: () => {
        document.getElementById('modalMeta')?.classList.remove('active');
    },

    handleMetaSubmit: (e) => {
        e.preventDefault();
        const val = Utils.parseCurrencyInput(document.getElementById('inputMetaValor').value);
        if (!val || val <= 0) {
            Utils.showToast('Valor de meta inválido.', 'error');
            return;
        }
        Storage.saveGoal(val);
        Utils.showToast('Meta de gastos atualizada! 🎯');
        App.closeMetaModal();
        App.refreshDashboard();
    },

    // ─── Contas Fixas ────────────────────────────────────────────────────────

    refreshBills: () => {
        const container = document.getElementById('billsList');
        if (!container) return;

        const currentMonth = Utils.getCurrentMonthYear();
        const bills = Storage.getBills().filter(b => b.lastPaid !== currentMonth);

        container.innerHTML = '';

        if (bills.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:2rem 1rem;">
                    <i data-lucide="check-circle-2" style="width:40px;height:40px;opacity:0.3;display:block;margin:0 auto 0.75rem;"></i>
                    <p class="text-secondary" style="font-size:0.85rem;">Todas as contas pagas! 🎉</p>
                </div>`;
            return;
        }

        const today = new Date().getDate();

        bills.sort((a, b) => a.day - b.day).forEach(b => {
            let statusClass = '';
            let badge = '';
            const diff = b.day - today;

            if (diff === 0)            { statusClass = 'today-due'; badge = '<span class="badge-today">Vence Hoje</span>'; }
            else if (diff > 0 && diff <= 3) statusClass = 'near-due';
            else if (diff < 0)         statusClass = 'overdue';

            const iconColor = statusClass === 'overdue' ? 'var(--color-expense)'
                : statusClass === 'today-due' ? 'var(--color-positive)'
                : statusClass === 'near-due'  ? 'var(--color-warning)'
                : 'var(--text-secondary)';

            const div = document.createElement('div');
            div.className = `transaction-item ${statusClass}`;
            div.innerHTML = `
                <div class="tx-left">
                    <div class="tx-icon" style="color:${iconColor}; background:var(--bg-hover)">
                        <i data-lucide="calendar" class="icon-card"></i>
                    </div>
                    <div class="tx-details">
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <span class="tx-title">${b.name}</span>${badge}
                        </div>
                        <span class="tx-category">Todo dia ${String(b.day).padStart(2, '0')}</span>
                    </div>
                </div>
                <div class="tx-right">
                    <span class="tx-amount expense">− ${Utils.formatCurrency(b.amount)}</span>
                    <div class="tx-actions" style="opacity:1;">
                        <button class="btn-icon text-positive" onclick="App.payBill('${b.id}')" title="Marcar como pago">
                            <i data-lucide="check-circle" class="icon-secondary"></i>
                        </button>
                        <button class="btn-icon text-expense"  onclick="App.deleteBill('${b.id}')" title="Excluir">
                            <i data-lucide="trash-2" class="icon-secondary"></i>
                        </button>
                    </div>
                </div>`;
            container.appendChild(div);
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    refreshPaidHistory: () => {
        const container = document.getElementById('paidHistoryList');
        if (!container) return;

        const currentMonth = Utils.getCurrentMonthYear();
        const paid = Storage.getBills().filter(b => b.lastPaid === currentMonth);

        container.innerHTML = '';
        if (paid.length === 0) {
            container.innerHTML = '<p class="text-secondary" style="font-size:0.8rem;text-align:center;padding:0.5rem;">Nenhuma conta paga este mês.</p>';
            return;
        }

        paid.forEach(b => {
            const div = document.createElement('div');
            div.className = 'transaction-item paid';
            div.style.padding = '0.5rem 1rem';
            div.innerHTML = `
                <div class="tx-left">
                    <i data-lucide="check" class="text-positive icon-secondary" style="margin-right:8px"></i>
                    <span style="font-size:0.9rem;">${b.name}</span>
                </div>
                <div class="tx-right"><span class="tx-amount" style="font-size:0.9rem;">${Utils.formatCurrency(b.amount)}</span></div>`;
            container.appendChild(div);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    payBill: (id) => {
        const bill = Storage.getBills().find(b => b.id === id);
        if (!bill) return;

        // Registra como transação de despesa
        const tx = {
            id:          Utils.generateId(),
            amount:      bill.amount,
            description: `Conta: ${bill.name}`,
            categoryId:  '3', // "Contas"
            date:        new Date().toISOString().split('T')[0],
            type:        'expense'
        };
        Storage.addTransaction(tx);

        // Marca como paga no mês atual
        bill.lastPaid = Utils.getCurrentMonthYear();
        Storage.updateBill(id, bill);

        Utils.showToast(`"${bill.name}" paga e registrada! ✅`);
        App.refreshDashboard();
        App.refreshBills();
        App.refreshPaidHistory();
    },

    openBillModal: () => {
        const modal = document.getElementById('modalConta');
        if (modal) { modal.classList.add('active'); document.getElementById('formConta')?.reset(); }
    },

    closeBillModal: () => {
        document.getElementById('modalConta')?.classList.remove('active');
    },

    handleBillSubmit: (e) => {
        e.preventDefault();
        const name   = document.getElementById('inputContaNome').value.trim();
        const amount = Utils.parseCurrencyInput(document.getElementById('inputContaValor').value);
        const day    = parseInt(document.getElementById('inputContaDia').value, 10);

        if (!name || amount <= 0 || isNaN(day) || day < 1 || day > 31) {
            Utils.showToast('Preencha todos os dados corretamente.', 'error');
            return;
        }

        Storage.addBill({ id: Utils.generateId(), name, amount, day });
        Utils.showToast('Conta fixa adicionada! 📅');
        App.closeBillModal();
        App.refreshBills();
    },

    deleteBill: (id) => {
        Utils.confirmAction('Deseja remover esta conta fixa?', () => {
            Storage.deleteBill(id);
            Utils.playSound('assets/sounds/delete.mp3');
            App.refreshBills();
        });
    },

    // ─── Exportações ─────────────────────────────────────────────────────────


    setCategoryLimit: (catId) => {
        const cat = Storage.getCategoryById(catId);
        if (!cat) return;
        const current = cat.limit ? cat.limit : '';
        const val = window.prompt(`Definir limite mensal para "${cat.name}" (R$):`, current);
        if (val === null) return; // cancelled
        const num = Utils.parseCurrencyInput(val);
        if (isNaN(num) || num < 0) { Utils.showToast('Valor inválido.', 'error'); return; }
        Storage.updateCategory(catId, { limit: num > 0 ? num : null });
        Utils.showToast(`Limite de "${cat.name}" atualizado! 🎯`);
        App.refreshDashboard();
    },

    exportCSV: () => {
        const txs = App.lastFilteredTransactions;
        if (txs.length === 0) { Utils.showToast('Nenhuma transação para exportar.', 'warning'); return; }

        let csv = 'Data;Descrição;Categoria;Tipo;Valor\n';
        txs.forEach(t => {
            const cat    = Storage.getCategoryById(t.categoryId);
            const isInc  = Utils.isIncome(t);
            csv += [
                Utils.formatDate(t.date),
                (t.description || '').replace(/;/g, ','),
                cat.name,
                isInc ? 'Entrada' : 'Saída',
                parseFloat(t.amount).toFixed(2).replace('.', ',')
            ].join(';') + '\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `financas_${document.getElementById('inputMonthFilter')?.value || 'export'}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        Utils.showToast('CSV exportado! 📄');
    },

    exportPDF: () => {
        if (!window.jspdf?.jsPDF) { Utils.showToast('jsPDF não carregado.', 'error'); return; }
        const txs = App.lastFilteredTransactions;
        if (txs.length === 0) { Utils.showToast('Nenhuma transação para exportar.', 'warning'); return; }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const mes = document.getElementById('inputMonthFilter')?.value || '';

        let totalIn = 0, totalOut = 0;
        txs.forEach(t => {
            if (Utils.isIncome(t)) totalIn  += parseFloat(t.amount);
            else                   totalOut += parseFloat(t.amount);
        });

        doc.setFontSize(18);
        doc.text(`Relatório Financeiro — ${mes}`, 14, 20);

        const rows = txs.map(t => {
            const cat   = Storage.getCategoryById(t.categoryId);
            const isInc = Utils.isIncome(t);
            return [Utils.formatDate(t.date), t.description, cat.name, isInc ? 'Entrada' : 'Saída', Utils.formatCurrency(t.amount)];
        });

        doc.autoTable(['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'], rows, {
            startY: 30,
            didDrawPage: (d) => {
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, doc.internal.pageSize.getHeight() - 10);
            }
        });

        const finalY = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(11);
        doc.setTextColor(16, 185, 129);  doc.text(`Total Entradas: ${Utils.formatCurrency(totalIn)}`,  14, finalY);
        doc.setTextColor(239, 68, 68);   doc.text(`Total Saídas: ${Utils.formatCurrency(totalOut)}`,   14, finalY + 7);
        doc.setTextColor(30, 41, 59);    doc.setFont(undefined, 'bold');
        doc.text(`Saldo: ${Utils.formatCurrency(totalIn - totalOut)}`, 14, finalY + 15);

        doc.save(`financas_${mes}.pdf`);
        Utils.showToast('PDF exportado! 📊');
    }
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
