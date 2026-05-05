/**
 * charts.js — Wrapper para Chart.js
 * Correções: destruição segura de instâncias, dados de receita separados no pizza
 */

const Charts = {
    _instances: {},

    _destroy: (key) => {
        if (Charts._instances[key]) {
            Charts._instances[key].destroy();
            delete Charts._instances[key];
        }
    },

    /** Gráfico de distribuição de despesas (rosca) */
    renderDistributionChart: (canvasId, transactions) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        Charts._destroy(canvasId);

        // Adapta cores dinamicamente ao tema
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDark ? '#94A3B8' : '#64748b';

        // Filtra apenas despesas
        const expenses = transactions.filter(t => !Utils.isIncome(t));

        const totals = {};
        expenses.forEach(t => {
            totals[t.categoryId] = (totals[t.categoryId] || 0) + parseFloat(t.amount);
        });

        const labels   = [];
        const data     = [];
        const colors   = [];

        Object.keys(totals).forEach(catId => {
            const cat = Storage.getCategoryById(catId);
            const total = totals[catId];
            const limit = cat.limit || 0;

            labels.push(cat.name);
            data.push(total);
            
            // Se ultrapassar o limite da categoria, muda para a cor de despesa (vermelho)
            colors.push((limit > 0 && total > limit) ? '#EF4444' : cat.color);
        });

        const isEmpty = data.length === 0;
        if (isEmpty) {
            labels.push('Sem despesas');
            data.push(1);
            colors.push('#334155');
        }

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = "'Oswald', sans-serif";

        // Plugin para efeito de Glow no Hover
        const glowPlugin = {
            id: 'glow',
            beforeDraw: (chart) => {
                const { ctx } = chart;
                ctx.save();
                if (chart.getActiveElements().length > 0) {
                    const activeElement = chart.getActiveElements()[0];
                    if (activeElement && activeElement.element && activeElement.element.options) {
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = activeElement.element.options.backgroundColor || 'transparent';
                    }
                }
            },
            afterDraw: (chart) => {
                chart.ctx.shadowBlur = 0;
                chart.ctx.restore();
            }
        };

        Charts._instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            plugins: [glowPlugin],
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#fff',
                    borderWidth: 2,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: isDark ? '#F8FAFC' : '#0f172a',
                            padding: 16,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleColor: '#F8FAFC',
                        bodyColor: '#F8FAFC',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (context) => {
                                if (isEmpty) return ' Sem despesas no período';
                                return ' ' + Utils.formatCurrency(context.raw);
                            }
                        }
                    }
                }
            }
        });
    },

    /** Gráfico comparativo de entradas vs saídas (últimos 6 meses) */
    renderComparisonChart: (canvasId, transactions) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        Charts._destroy(canvasId);

        const labels    = [];
        const monthKeys = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1); // Evita problemas com meses de comprimentos diferentes
            d.setMonth(d.getMonth() - i);
            const mKey  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            monthKeys.push(mKey);
            labels.push(label.charAt(0).toUpperCase() + label.slice(1));
        }

        const incomeData = monthKeys.map(mKey =>
            transactions
                .filter(t => t.date.startsWith(mKey) && Utils.isIncome(t))
                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );

        const expenseData = monthKeys.map(mKey =>
            transactions
                .filter(t => t.date.startsWith(mKey) && !Utils.isIncome(t))
                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );

        Charts._instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Entradas',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.85)',
                        borderRadius: 5,
                        borderSkipped: false
                    },
                    {
                        label: 'Saídas',
                        data: expenseData,
                        backgroundColor: 'rgba(239, 68, 68, 0.85)',
                        borderRadius: 5,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#F8FAFC', padding: 16 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94A3B8' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#94A3B8',
                            callback: (value) => {
                                if (value >= 1000) return 'R$' + (value / 1000).toFixed(1) + 'k';
                                return 'R$' + value;
                            }
                        }
                    }
                }
            }
        });
    },

    /** Gráfico de velocidade de gastos (Gauge) */
    renderGaugeChart: (canvasId, spent, limit) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        Charts._destroy(canvasId);

        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        const isOver = spent > limit;
        const color = isOver ? '#EF4444' : '#10B981';

        Charts._instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [Math.min(percent, 100), Math.max(0, 100 - percent)],
                    backgroundColor: [color, 'rgba(255,255,255,0.05)'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '85%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });

        const label = document.getElementById('gaugeText');
        if (label) label.textContent = `${percent.toFixed(0)}%`;
    },

    /** Mini gráfico de barras comparativo (Sparkline) */
    renderSparkline: (canvasId, current, previous, color = null) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        Charts._destroy(canvasId);

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const barColor = canvasId.toLowerCase().includes('entrada') ? '#10B981' : '#EF4444';

        let finalBarColor = color;
        if (!finalBarColor) {
            if (canvasId.toLowerCase().includes('entrada') || canvasId.toLowerCase().includes('saldo') || canvasId.toLowerCase().includes('economia')) {
                finalBarColor = '#10B981'; // Positive/Income color
            } else if (canvasId.toLowerCase().includes('saida') || canvasId.toLowerCase().includes('previsao')) {
                finalBarColor = '#EF4444'; // Expense color
            } else {
                finalBarColor = '#3B82F6'; // Neutral/Default color
            }
        }

        Charts._instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Anterior', 'Atual'],
                datasets: [{
                    data: [previous, current],
                    backgroundColor: [isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', finalBarColor],
                    borderRadius: 3,
                    barThickness: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: { display: false },
                    y: { display: false, beginAtZero: true }
                }
            }
        });
    },

    /** Medidor de Saúde Financeira (Mini Gauge para % Economia) */
    renderHealthGauge: (canvasId, percSav) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        Charts._destroy(canvasId);

        // Lógica de Cor: <10% Vermelho, 10-25% Amarelo, >25% Verde
        const color = percSav < 10 ? '#EF4444' : (percSav < 25 ? '#F59E0B' : '#10B981');
        const value = Math.max(0, Math.min(percSav, 100));

        Charts._instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [value, 100 - value],
                    backgroundColor: [color, 'rgba(255,255,255,0.05)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                events: [], // Desativa interações para ser apenas visual
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }
};
