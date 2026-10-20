class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.layer = engine.uiLayer;

        // Ensure UI layer scales or is absolute, taking up full screen for overlay HTML elements if desired.
        // Actually, let's just do everything on canvas to ensure pixel perfect scaling and easy logic, except for maybe the Back to Arcade link as required or a few buttons, but Canvas is cleaner.
        // Wait, "Back to Arcade link (`../../index.html`)" might be easier as a real <a> tag, but we can do it in canvas too. Let's do HTML overlay for menus, it's easier to style and click.

        this.htmlOverlay = document.createElement('div');
        this.htmlOverlay.style.position = 'absolute';
        this.htmlOverlay.style.top = '0';
        this.htmlOverlay.style.left = '0';
        this.htmlOverlay.style.width = '100%';
        this.htmlOverlay.style.height = '100%';
        this.htmlOverlay.style.pointerEvents = 'none';
        this.htmlOverlay.style.display = 'flex';
        this.htmlOverlay.style.flexDirection = 'column';
        this.htmlOverlay.style.alignItems = 'center';
        this.htmlOverlay.style.justifyContent = 'center';
        this.htmlOverlay.style.color = '#fff';
        this.htmlOverlay.style.fontFamily = 'monospace';

        this.layer.appendChild(this.htmlOverlay);

        this.currentState = '';
        this.optionsOpen = false;

        // Touch controls rendering
        this.touchCanvas = document.createElement('canvas');
        this.touchCanvas.style.position = 'absolute';
        this.touchCanvas.style.top = '0';
        this.touchCanvas.style.left = '0';
        this.touchCanvas.style.width = '100%';
        this.touchCanvas.style.height = '100%';
        this.touchCanvas.style.pointerEvents = 'none';
        this.layer.appendChild(this.touchCanvas);
        this.tCtx = this.touchCanvas.getContext('2d');
    }

    setState(state) {
        if (this.currentState === state) return;
        this.currentState = state;
        this.renderHTML();
    }

    renderHTML() {
        this.htmlOverlay.innerHTML = '';

        const createBtn = (text, onClick) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.style.pointerEvents = 'auto';
            btn.style.margin = '10px';
            btn.style.padding = '10px 20px';
            btn.style.fontSize = '24px';
            btn.style.backgroundColor = '#333';
            btn.style.color = '#fff';
            btn.style.border = '2px solid #85bddb';
            btn.style.cursor = 'pointer';
            btn.style.fontFamily = 'monospace';
            btn.onclick = onClick;
            return btn;
        };

        if (this.optionsOpen) {
            this.htmlOverlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
            const title = document.createElement('h1');
            title.innerText = 'Options';
            title.style.color = '#85bddb';
            this.htmlOverlay.appendChild(title);

            const opts = this.engine.saveManager.data.options;

            const toggleMute = createBtn(`Mute: ${opts.masterMute ? 'ON' : 'OFF'}`, () => {
                opts.masterMute = !opts.masterMute;
                this.engine.saveManager.save();
                this.engine.audioEngine.updateVolumes();
                this.renderHTML();
            });
            this.htmlOverlay.appendChild(toggleMute);

            const backBtn = createBtn('Back', () => {
                this.optionsOpen = false;
                this.renderHTML();
            });
            this.htmlOverlay.appendChild(backBtn);

            // Export / Import / Reset
            const exportBtn = createBtn('Export Save', () => {
                const data = btoa(JSON.stringify(this.engine.saveManager.data));
                prompt('Copy your save data:', data);
            });
            this.htmlOverlay.appendChild(exportBtn);

            const importBtn = createBtn('Import Save', () => {
                const data = prompt('Paste your save data:');
                if (data) {
                    try {
                        const parsed = JSON.parse(atob(data));
                        if (parsed) {
                            this.engine.saveManager.data = parsed;
                            this.engine.saveManager.save();
                            this.engine.audioEngine.updateVolumes();
                            this.renderHTML();
                        }
                    } catch (e) {
                        alert('Invalid save data');
                    }
                }
            });
            this.htmlOverlay.appendChild(importBtn);

            const resetBtn = createBtn('Reset Save', () => {
                if (confirm('Click again to confirm reset')) {
                    this.engine.saveManager.reset();
                    this.renderHTML();
                }
            });
            this.htmlOverlay.appendChild(resetBtn);

            return;
        }

        if (this.currentState === 'TITLE') {
            this.htmlOverlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
            const title = document.createElement('h1');
            title.innerText = 'Scrapheap Heist';
            title.style.fontSize = '64px';
            title.style.color = '#85bddb';
            title.style.textShadow = '0 0 10px #85bddb';
            this.htmlOverlay.appendChild(title);

            const hs = document.createElement('h3');
            hs.innerText = `High Score: ${this.engine.saveManager.data.highScore}`;
            this.htmlOverlay.appendChild(hs);

            this.htmlOverlay.appendChild(createBtn('Play', () => this.engine.changeState('PLAYING')));
            this.htmlOverlay.appendChild(createBtn('How to Play', () => alert('WASD/Arrows to move. SPACE to sacrifice 25 Health for Overdrive (Speed boost). Touch the screen for virtual controls (Left side: Move, Right side: Overdrive). Avoid enemies, collect scrap!')));
            this.htmlOverlay.appendChild(createBtn('Options', () => { this.optionsOpen = true; this.renderHTML(); }));

            const backLink = document.createElement('a');
            backLink.href = '../../index.html';
            backLink.innerText = 'Back to Arcade';
            backLink.style.pointerEvents = 'auto';
            backLink.style.color = '#fff';
            backLink.style.marginTop = '20px';
            this.htmlOverlay.appendChild(backLink);

        } else if (this.currentState === 'PLAYING') {
            this.htmlOverlay.style.backgroundColor = 'transparent';

            // HUD is better drawn on canvas, but we need a pause button for touch
            const pauseBtn = createBtn('II', () => this.engine.changeState('PAUSED'));
            pauseBtn.style.position = 'absolute';
            pauseBtn.style.top = '10px';
            pauseBtn.style.right = '10px';
            pauseBtn.style.padding = '5px 15px';
            this.htmlOverlay.appendChild(pauseBtn);

        } else if (this.currentState === 'PAUSED') {
            this.htmlOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
            const title = document.createElement('h1');
            title.innerText = 'PAUSED';
            title.style.color = '#fff';
            this.htmlOverlay.appendChild(title);

            this.htmlOverlay.appendChild(createBtn('Resume', () => this.engine.changeState('PLAYING')));
            this.htmlOverlay.appendChild(createBtn('Restart', () => this.engine.startGame()));
            this.htmlOverlay.appendChild(createBtn('Options', () => { this.optionsOpen = true; this.renderHTML(); }));
            this.htmlOverlay.appendChild(createBtn('Quit to Title', () => this.engine.changeState('TITLE')));

        } else if (this.currentState === 'GAME_OVER') {
            this.htmlOverlay.style.backgroundColor = 'rgba(100,0,0,0.8)';
            const title = document.createElement('h1');
            title.innerText = 'GAME OVER';
            title.style.color = '#ff4444';
            title.style.fontSize = '64px';
            this.htmlOverlay.appendChild(title);

            const score = document.createElement('h2');
            score.innerText = `Final Score: ${this.engine.levelManager.score}`;
            this.htmlOverlay.appendChild(score);

            if (this.engine.levelManager.score > this.engine.saveManager.data.highScore) {
                const newHs = document.createElement('h3');
                newHs.innerText = 'NEW HIGH SCORE!';
                newHs.style.color = '#FFD700';
                this.htmlOverlay.appendChild(newHs);
            }

            this.htmlOverlay.appendChild(createBtn('Play Again', () => this.engine.startGame()));
            this.htmlOverlay.appendChild(createBtn('Title Screen', () => this.engine.changeState('TITLE')));
        }
    }

    drawHUD(ctx, player, levelManager) {
        if (this.currentState !== 'PLAYING') return;

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '30px monospace';
        ctx.textAlign = 'left';

        ctx.fillText(`Score: ${levelManager.score}`, 20, 40);
        ctx.fillText(`Level: ${levelManager.level}`, 20, 80);

        // Health bar
        ctx.fillStyle = '#f00';
        ctx.fillRect(20, 100, 200, 20);
        if (player) {
            ctx.fillStyle = '#0f0';
            ctx.fillRect(20, 100, 200 * (Math.max(0, player.health) / player.maxHealth), 20);
            ctx.fillStyle = '#fff';
            ctx.fillText(`Health: ${Math.max(0, Math.floor(player.health))}`, 20, 150);
        }

        ctx.restore();
    }

    drawTouchControls() {
        this.touchCanvas.width = this.layer.clientWidth;
        this.touchCanvas.height = this.layer.clientHeight;

        this.tCtx.clearRect(0, 0, this.touchCanvas.width, this.touchCanvas.height);

        if (this.currentState !== 'PLAYING') return;
        const im = this.engine.inputManager;

        // Show controls if touch detected or option set
        const opts = this.engine.saveManager.data.options;
        if (opts.touchControls === 'Off') return;
        if (opts.touchControls === 'Auto' && !im.touchDetected) return;

        this.tCtx.save();
        this.tCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.tCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.tCtx.lineWidth = 2;

        // Left half (Joystick zone)
        // If joystick active, draw it
        if (im.virtualJoystick.active) {
            this.tCtx.beginPath();
            this.tCtx.arc(im.virtualJoystick.startX, im.virtualJoystick.startY, 50, 0, Math.PI * 2);
            this.tCtx.stroke();

            this.tCtx.beginPath();
            this.tCtx.arc(im.virtualJoystick.startX + im.virtualJoystick.dx, im.virtualJoystick.startY + im.virtualJoystick.dy, 25, 0, Math.PI * 2);
            this.tCtx.fill();
        } else {
            // Draw hint
            this.tCtx.beginPath();
            this.tCtx.arc(this.touchCanvas.width * 0.15, this.touchCanvas.height * 0.75, 50, 0, Math.PI * 2);
            this.tCtx.stroke();
        }

        // Right half (Overdrive button zone)
        this.tCtx.beginPath();
        this.tCtx.arc(this.touchCanvas.width * 0.85, this.touchCanvas.height * 0.75, 50, 0, Math.PI * 2);
        this.tCtx.stroke();
        if (im.actions.overdrive) {
            this.tCtx.fill();
        }
        this.tCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.tCtx.font = '16px monospace';
        this.tCtx.textAlign = 'center';
        this.tCtx.fillText('OVERDRIVE', this.touchCanvas.width * 0.85, this.touchCanvas.height * 0.75 + 5);

        this.tCtx.restore();
    }
}
