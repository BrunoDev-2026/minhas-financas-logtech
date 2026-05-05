/**
 * particles.js - Sistema de partículas suaves para o fundo
 */
const ParticleSystem = {
    canvas: null,
    ctx: null,
    particles: [],
    count: 40, // Quantidade discreta para performance
    mouse: { x: null, y: null, radius: 150 },
    isPaused: false,
    isRunning: false,

    init() {
        this.canvas = document.getElementById('starCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
        
        window.addEventListener('click', (e) => {
            let color = null;
            // Se o modal de transação estiver aberto, tenta pegar a cor da categoria selecionada
            const modal = document.getElementById('modalTransacao');
            if (modal && modal.classList.contains('active')) {
                const catId = document.getElementById('inputCategoria')?.value;
                if (catId && typeof Storage !== 'undefined') {
                    const cat = Storage.getCategoryById(catId);
                    if (cat) color = cat.color;
                }
            }
            
            this.createBurst(e.clientX, e.clientY, color);
        });
        
        this.createParticles();
        this.toggle(true);
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.5 + 0.1
            });
        }
    },

    createBurst(x, y, color = null) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 8,
                speedY: (Math.random() - 0.5) * 8,
                opacity: 1,
                life: 1.0, // Vida da partícula (100%)
                isBurst: true,
                color: color // Armazena a cor específica
            });
        }
    },

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const colorRGB = isDark ? '148, 163, 184' : '15, 23, 42'; // Prata (Slate 400) no Dark
        const defaultFill = isDark ? '#3b82f6' : '#0f172a'; // Azul corporativo no Dark

        // --- Lógica de Constelação e Atração ---
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = 120; // Distância para criar conexão

                if (dist < minDist) {
                    // Força de atração sutil
                    const force = (minDist - dist) / 150000;
                    p1.speedX -= dx * force;
                    p1.speedY -= dy * force;
                    p2.speedX += dx * force;
                    p2.speedY += dy * force;

                    // Desenha a linha da constelação
                    this.ctx.shadowBlur = 0;
                    this.ctx.strokeStyle = `rgba(${colorRGB}, ${(1 - dist / minDist) * 0.12})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }

        this.particles = this.particles.filter(p => {
            // Movimento Orgânico (Ondulação)
            const time = Date.now() * 0.001;
            const organicX = Math.sin(time + p.x) * 0.1;
            const organicY = Math.cos(time + p.y) * 0.1;

            // Cálculo de distância para interação
            const dxMouse = p.x - this.mouse.x;
            const dyMouse = p.y - this.mouse.y;
            const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

            // 1. Efeito de Fuga (Repelir)
            if (this.mouse.x !== null) {
                const repelRadius = 120;
                if (distMouse < repelRadius) {
                    const force = (repelRadius - distMouse) / repelRadius;
                    const moveX = (dxMouse / distMouse) * force * 5; // Intensidade da fuga
                    const moveY = (dyMouse / distMouse) * force * 5;
                    p.x += moveX;
                    p.y += moveY;
                }

                // 2. Efeito de Conexão (Rastro)
                if (distMouse < this.mouse.radius) {
                    this.ctx.shadowBlur = 0; // Desativa glow nas linhas para performance
                    this.ctx.strokeStyle = `rgba(${colorRGB}, ${(1 - distMouse / this.mouse.radius) * 0.25})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    this.ctx.stroke();
                }
            }

            // 3. Efeito de Brilho (Glow) - Apenas no tema Dark
            if (isDark) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = p.color || '#3b82f6';
            } else {
                this.ctx.shadowBlur = 0;
            }

            this.ctx.fillStyle = p.color || defaultFill;

            // Se for partícula de explosão, diminui a opacidade conforme a vida
            const currentOpacity = p.isBurst ? p.life * p.opacity : p.opacity;
            
            this.ctx.globalAlpha = Math.max(0, currentOpacity);
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;
            
            // Atualiza posição
            p.x += p.speedX + organicX;
            p.y += p.speedY + organicY;

            if (p.isBurst) {
                p.life -= 0.02; // Partícula morrendo aos poucos
                if (p.life <= 0) return false;
            }

            // Rebote suave/Loop
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
            return true;
        });
    },

    animate() {
        if (this.isPaused) {
            this.isRunning = false;
            return;
        }
        this.isRunning = true;
        this.draw();
        requestAnimationFrame(() => this.animate());
    },

    toggle(active) {
        this.isPaused = !active;
        if (active && !this.isRunning) this.animate();
    }
};

// Iniciar sistema
document.addEventListener('DOMContentLoaded', () => ParticleSystem.init());