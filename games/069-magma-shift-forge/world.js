class BackgroundParallax {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [
            { speed: 0.1, elements: this.generateElements(60, 2, '#410'), type: 'embers' },
            { speed: 0.3, elements: this.generateElements(30, 20, '#310'), type: 'rocks' },
            { speed: 0.6, elements: this.generateElements(15, 60, '#200'), type: 'pillars' }
        ];
        this.parallaxX = 0;
        this.parallaxY = 0;
    }

    generateElements(count, size, color) {
        let els = [];
        for (let i = 0; i < count; i++) {
            els.push({
                x: Math.random() * this.width * 2 - this.width/2,
                y: Math.random() * this.height * 2 - this.height/2,
                size: size + Math.random() * size,
                color: color,
                speedOff: Math.random()
            });
        }
        return els;
    }

    update(dt, player) {
        let dx = player.x - this.width / 2;
        let dy = player.y - this.height / 2;
        this.parallaxX = dx;
        this.parallaxY = dy;

        for (let el of this.layers[0].elements) {
            el.y -= dt * (20 + el.speedOff * 20);
            if (el.y < -50) {
                el.y = this.height * 2;
                el.x = Math.random() * this.width * 2 - this.width/2;
            }
        }
    }

    draw(ctx) {
        for (let layer of this.layers) {
            ctx.fillStyle = layer.elements[0].color;
            for (let el of layer.elements) {
                let px = el.x - this.parallaxX * layer.speed;
                let py = el.y - this.parallaxY * layer.speed;

                if (px < -300) px += this.width + 600;
                if (px > this.width + 300) px -= this.width + 600;
                if (py < -300) py += this.height + 600;
                if (py > this.height + 300) py -= this.height + 600;

                if (layer.type === 'embers') {
                    ctx.beginPath();
                    ctx.arc(px, py, el.size, 0, Math.PI * 2);
                    ctx.fill();
                } else if (layer.type === 'rocks') {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + el.size, py - el.size);
                    ctx.lineTo(px + el.size * 1.5, py);
                    ctx.lineTo(px + el.size * 0.5, py + el.size * 0.5);
                    ctx.fill();
                } else {
                    ctx.fillRect(px, py, el.size, el.size * 2);
                }
            }
        }
    }
}

class EnvironmentHazards {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.hazards = [];
        this.spawnTimer = 0;
    }

    update(dt, game) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 3 + Math.random() * 2;
            let currentArenaRadius = game.arena.radius + Math.sin(game.arena.pulsing) * 10;
            // Spawn hazard inside arena
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.random() * currentArenaRadius * 0.8;
            this.hazards.push({
                x: game.targetWidth / 2 + Math.cos(angle) * dist,
                y: game.targetHeight / 2 + Math.sin(angle) * dist,
                radius: 30 + Math.random() * 20,
                active: false,
                warnTimer: 1.5,
                life: 2,
                type: 'magmaGeyser'
            });
        }

        for (let i = this.hazards.length - 1; i >= 0; i--) {
            let h = this.hazards[i];
            if (h.warnTimer > 0) {
                h.warnTimer -= dt;
                if (h.warnTimer <= 0) {
                    h.active = true;
                    // play sound or spawn initial burst particles
                    for(let p=0; p<15; p++) {
                        game.spawnParticle(h.x, h.y, '#f50', 100);
                    }
                }
            } else {
                h.life -= dt;

                if (h.active) {
                    // Constant particle spray
                    if (Math.random() < 0.2) {
                        game.spawnParticle(h.x, h.y, '#ff0', 80);
                    }

                    // Affect player
                    if (game.player.invulnerabilityTime <= 0) {
                        let dx = game.player.x - h.x;
                        let dy = game.player.y - h.y;
                        let dist = Math.hypot(dx, dy);
                        if (dist < h.radius + game.player.radius) {
                            game.gameOver();
                        }
                    }

                    // Affect enemies
                    for (let j = game.enemies.length - 1; j >= 0; j--) {
                        let e = game.enemies[j];
                        let edx = e.x - h.x;
                        let edy = e.y - h.y;
                        let edist = Math.hypot(edx, edy);
                        if (edist < h.radius + e.radius) {
                            // Instakill enemy
                            game.enemies.splice(j, 1);
                            game.score += 25;
                            for(let p=0; p<5; p++) {
                                game.spawnParticle(e.x, e.y, '#f05', 80);
                            }
                        }
                    }
                }

                if (h.life <= 0) {
                    this.hazards.splice(i, 1);
                }
            }
        }
    }

    draw(ctx) {
        for (let h of this.hazards) {
            if (h.warnTimer > 0) {
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 50, 0, ${0.1 + Math.abs(Math.sin(h.warnTimer * 15)) * 0.2})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(255, 50, 0, ${0.5 + Math.abs(Math.sin(h.warnTimer * 15)) * 0.5})`;
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Active hazard
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 100, 0, ${0.6 + Math.random() * 0.2})`;
                ctx.fill();

                // inner core
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.radius * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 0, ${0.8 + Math.random() * 0.2})`;
                ctx.fill();
            }
        }
    }
}
