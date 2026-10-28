class ParallaxLayer {
    constructor(imageSrc, speedY, speedX, yOffset, alpha = 1.0, color = '#ffffff') {
        this.speedY = speedY;
        this.speedX = speedX;
        this.yOffset = yOffset;
        this.alpha = alpha;
        this.color = color;
        this.elements = [];
        this.generateElements();
        this.time = 0;
    }

    generateElements() {
        for (let i = 0; i < 30; i++) {
            this.elements.push({
                x: Math.random() * 800,
                y: Math.random() * 2000 - 1000,
                size: Math.random() * 3 + 1,
                type: Math.floor(Math.random() * 3) // 0: square, 1: circle, 2: line
            });
        }
    }

    update(dt) {
        this.time += dt;
    }

    draw(ctx, width, height, cameraY) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        let offsetY = (cameraY * this.speedY) + this.yOffset;
        let offsetX = this.time * this.speedX;

        // Draw elements wrapping around vertically and horizontally
        this.elements.forEach(el => {
            let drawX = (el.x + offsetX) % width;
            if (drawX < 0) drawX += width;

            let drawY = ((el.y - offsetY) % height + height) % height;

            if (el.type === 0) {
                ctx.fillRect(drawX, drawY, el.size * 2, el.size * 2);
            } else if (el.type === 1) {
                ctx.beginPath();
                ctx.arc(drawX, drawY, el.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(drawX, drawY);
                ctx.lineTo(drawX, drawY + el.size * 4);
                ctx.stroke();
            }
        });

        ctx.restore();
    }
}

class ParallaxBackground {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [
            // Deep background - slow, matrix-like falling data
            new ParallaxLayer(null, 0.1, 0, 0, 0.2, '#1a4f3b'),
            // Mid background - glowing grid nodes
            new ParallaxLayer(null, 0.3, 10, 0, 0.4, '#2e8c61'),
            // Foreground atmospheric particles
            new ParallaxLayer(null, 0.6, -20, 0, 0.6, '#a0efb8')
        ];

        // Add cyber-dojo silhouettes in the background
        this.toriGates = [];
        for (let i = 0; i < 5; i++) {
            this.toriGates.push({
                y: i * 800 + Math.random() * 400
            });
        }
    }

    update(dt, cameraY) {
        this.layers.forEach(l => l.update(dt));
    }

    draw(ctx, width, height) {
        // Base gradient (already handled by game.js drawing the clear rect, but we add detail)
        let grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#050a08');
        grad.addColorStop(1, '#0b1612');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Draw layers
        this.layers[0].draw(ctx, width, height, window.engine.cameraY);

        // Draw Torii Gates
        ctx.save();
        ctx.fillStyle = '#1c0f13'; // Very dark red/black
        let camY = window.engine.cameraY * 0.2;
        this.toriGates.forEach(g => {
            let drawY = ((g.y - camY) % (800 * 5));
            if (drawY > -200 && drawY < height + 200) {
                // Draw a simple torii gate silhouette
                ctx.fillRect(width / 2 - 150, drawY - 100, 300, 20); // Top beam
                ctx.fillRect(width / 2 - 130, drawY - 70, 260, 15); // Second beam
                ctx.fillRect(width / 2 - 100, drawY - 70, 20, 200); // Left pillar
                ctx.fillRect(width / 2 + 80, drawY - 70, 20, 200); // Right pillar
            }
        });
        ctx.restore();

        this.layers[1].draw(ctx, width, height, window.engine.cameraY);
        this.layers[2].draw(ctx, width, height, window.engine.cameraY);
    }
}

class Hazard {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'geyser' (plasma geyser) or 'shifter' (shifting geometry)
        this.active = true;
        this.w = 60;
        this.h = 60;
        this.stateTimer = 0;
        this.phase = 0; // 0: dormant, 1: warning, 2: active

        if (this.type === 'shifter') {
            this.w = 120;
            this.h = 40;
            this.startX = this.x;
            this.targetX = this.x + (Math.random() > 0.5 ? 100 : -100);
            this.speed = 50 + Math.random() * 50;
        }
    }

    update(dt, engine) {
        this.stateTimer += dt;

        if (this.type === 'geyser') {
            if (this.phase === 0 && this.stateTimer > 3) {
                this.phase = 1;
                this.stateTimer = 0;
            } else if (this.phase === 1 && this.stateTimer > 1) {
                this.phase = 2;
                this.stateTimer = 0;
                // Eruption sound
                if (Math.abs(this.y - engine.cameraY) < engine.height) {
                    engine.soundEngine.playExplosion();
                }
            } else if (this.phase === 2) {
                if (this.stateTimer > 2) {
                    this.phase = 0;
                    this.stateTimer = 0;
                }

                // Active Hitbox for geyser is a tall column
                if (engine.player && engine.player.invulnTimer <= 0) {
                    let hx = this.x - 20;
                    let hw = 40;
                    let hy = this.y - 300; // Shoots up
                    let hh = 300;

                    if (engine.player.x + engine.player.r > hx && engine.player.x - engine.player.r < hx + hw &&
                        engine.player.y + engine.player.r > hy && engine.player.y - engine.player.r < hy + hh) {
                        engine.gameOver();
                    }
                }
                // Enemies die in geyser
                engine.enemies.forEach(e => {
                    let hx = this.x - 20;
                    let hw = 40;
                    let hy = this.y - 300;
                    let hh = 300;
                    if (e.x + e.r > hx && e.x - e.r < hx + hw && e.y + e.r > hy && e.y - e.r < hy + hh) {
                        e.active = false;
                        engine.spawnParticles(e.x, e.y, '#f14668', 10);
                    }
                });
            }
        } else if (this.type === 'shifter') {
            // Shifter moves back and forth, acts as a solid block but can crush
            let dir = Math.sign(this.targetX - this.startX);
            if (this.phase === 0) {
                this.x += dir * this.speed * dt;
                if ((dir > 0 && this.x >= this.targetX) || (dir < 0 && this.x <= this.targetX)) {
                    this.x = this.targetX;
                    this.phase = 1; // wait
                    this.stateTimer = 0;
                }
            } else if (this.phase === 1) {
                if (this.stateTimer > 1) {
                    this.phase = 0;
                    let temp = this.startX;
                    this.startX = this.targetX;
                    this.targetX = temp;
                }
            }

            // Solid collision logic
            if (engine.player) {
                let px = engine.player.x;
                let py = engine.player.y;
                let pr = engine.player.r;

                if (px + pr > this.x && px - pr < this.x + this.w &&
                    py + pr > this.y && py - pr < this.y + this.h) {

                    // Simple ejection or crush
                    if (engine.player.isDashing) {
                        // Dash lets you pass/damage it slightly, but for now we just bounce
                        engine.player.vx = -engine.player.vx;
                        engine.player.vy = -engine.player.vy;
                        engine.player.applyRecoil(300, engine.player.angle);
                        this.active = false; // Destroyed by dash!
                        engine.soundEngine.playExplosion();
                        engine.spawnParticles(this.x + this.w/2, this.y + this.h/2, '#f5ca53', 20);
                    } else {
                        // Regular hit, acts like solid rock but pushes
                        engine.player.x += dir * this.speed * dt; // Get pushed

                        // If pushed into a wall/block, you die (simplified check: just taking damage/recoil for now)
                        engine.player.applyRecoil(200, engine.player.angle);
                    }
                }
            }
        }
    }

    draw(ctx, cameraY) {
        if (!this.active) return;

        ctx.save();
        if (this.type === 'geyser') {
            // Base
            ctx.fillStyle = '#2a1d1d';
            ctx.fillRect(this.x - 30, this.y - cameraY, 60, 20);

            if (this.phase === 1) {
                // Warning glow
                ctx.fillStyle = `rgba(241, 70, 104, ${(Math.sin(this.stateTimer * 20) + 1)/2})`;
                ctx.fillRect(this.x - 20, this.y - cameraY - 300, 40, 300);
            } else if (this.phase === 2) {
                // Active beam
                ctx.fillStyle = '#f14668';
                ctx.fillRect(this.x - 20, this.y - cameraY - 300, 40, 300);
                // Core
                ctx.fillStyle = '#fff';
                ctx.fillRect(this.x - 10, this.y - cameraY - 300, 20, 300);
            }
        } else if (this.type === 'shifter') {
            ctx.fillStyle = '#f5ca53';
            ctx.fillRect(this.x, this.y - cameraY, this.w, this.h);
            ctx.strokeStyle = '#1c222b';
            ctx.lineWidth = 4;
            ctx.strokeRect(this.x, this.y - cameraY, this.w, this.h);

            // Cyber details
            ctx.fillStyle = '#1c222b';
            for(let i=10; i<this.w-10; i+=20) {
                ctx.fillRect(this.x + i, this.y - cameraY + 10, 10, 20);
            }
        }
        ctx.restore();
    }
}
