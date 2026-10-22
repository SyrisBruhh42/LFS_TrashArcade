class ParallaxLayer {
    constructor(speed, type, width, height) {
        this.speed = speed;
        this.type = type;
        this.width = width;
        this.height = height;
        this.elements = [];
        this.generateElements();
        this.offset = 0;
    }
    generateElements() {
        const count = this.type === 'distant_gears' ? 6 : (this.type === 'pipes' ? 10 : 15);
        for(let i = 0; i < count; i++) {
            this.elements.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: this.type === 'distant_gears' ? 80 + Math.random() * 80 : (this.type === 'pipes' ? 15 + Math.random() * 30 : 10 + Math.random() * 15),
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 2
            });
        }
    }
    update(dt) {
        this.offset += this.speed * dt;
        if (this.offset > this.width) this.offset -= this.width;
        if (this.offset < -this.width) this.offset += this.width;

        this.elements.forEach(el => {
            el.rotation += el.rotSpeed * dt;
        });
    }
    draw(ctx, cameraX, cameraY) {
        ctx.save();
        // Camera parallax + auto scroll
        let tx = -cameraX * this.speed * 0.02 - this.offset;
        let ty = -cameraY * this.speed * 0.02;

        // Wrap logic for drawing
        tx = tx % this.width;
        if (tx > 0) tx -= this.width;

        ctx.translate(tx, ty);

        ctx.fillStyle = this.type === 'distant_gears' ? '#201a1f' : (this.type === 'pipes' ? '#30252e' : '#453542');
        ctx.strokeStyle = this.type === 'distant_gears' ? '#181317' : (this.type === 'pipes' ? '#251c23' : '#352932');
        ctx.lineWidth = 2;

        for (let j = 0; j < 3; j++) {
            ctx.save();
            ctx.translate(j * this.width, 0);

            this.elements.forEach(el => {
                if (this.type === 'distant_gears' || this.type === 'chains') {
                    ctx.save();
                    ctx.translate(el.x, el.y);
                    ctx.rotate(el.rotation);
                    ctx.beginPath();
                    const teeth = this.type === 'distant_gears' ? 12 : 6;
                    for (let i = 0; i < teeth * 2; i++) {
                        const angle = (i * Math.PI) / teeth;
                        const r = i % 2 === 0 ? el.size : el.size * 0.8;
                        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, el.size * 0.3, 0, Math.PI * 2);
                    ctx.fillStyle = '#2a2029';
                    ctx.fill();
                    ctx.restore();
                } else if (this.type === 'pipes') {
                    ctx.fillRect(el.x, -this.height, el.size, this.height * 3);
                    ctx.strokeRect(el.x, -this.height, el.size, this.height * 3);
                    ctx.fillRect(el.x - 10, el.y, el.size + 20, 20);
                    ctx.strokeRect(el.x - 10, el.y, el.size + 20, 20);
                }
            });
            ctx.restore();
        }
        ctx.restore();
    }
}

class SteamVent {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.timer = Math.random() * 5;
        this.state = 'IDLE';
        this.particles = [];
    }
    update(dt, player, enemies, soundEngine) {
        this.timer -= dt;

        if (this.state === 'IDLE' && this.timer <= 0) {
            this.state = 'WARNING';
            this.timer = 1.5;
        } else if (this.state === 'WARNING' && this.timer <= 0) {
            this.state = 'ERUPTING';
            this.timer = 2.0;
            if (soundEngine) soundEngine.playHit();
        } else if (this.state === 'ERUPTING') {
            if (this.timer <= 0) {
                this.state = 'IDLE';
                this.timer = 4.0 + Math.random() * 3.0;
            } else {
                if (Math.random() < 0.6) {
                    this.particles.push({
                        x: this.x + (Math.random() - 0.5) * this.radius,
                        y: this.y + (Math.random() - 0.5) * this.radius,
                        vx: (Math.random() - 0.5) * 50,
                        vy: -100 - Math.random() * 100,
                        life: 0.5 + Math.random() * 0.5,
                        size: 5 + Math.random() * 15
                    });
                }

                const affectEntity = (ent) => {
                    const dx = ent.x - this.x;
                    const dy = ent.y - this.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < this.radius + ent.radius) {
                        const pushForce = 350;
                        if (dist > 0) {
                            ent.x += (dx / dist) * pushForce * dt;
                            ent.y += (dy / dist) * pushForce * dt;
                        }
                        if (ent === player) {
                            if (player.invulnTimer <= 0) {
                                player.health--;
                                player.invulnTimer = 1.0;
                                if (soundEngine) soundEngine.playHit();
                            }
                        } else {
                            ent.active = false;
                        }
                    }
                };

                if (player) affectEntity(player);
                enemies.forEach(affectEntity);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#555';
        ctx.stroke();

        ctx.beginPath();
        for(let i = -this.radius + 10; i < this.radius; i+= 15) {
            const dy = Math.sqrt(Math.max(0, this.radius*this.radius - i*i));
            ctx.moveTo(i, -dy);
            ctx.lineTo(i, dy);
            ctx.moveTo(-dy, i);
            ctx.lineTo(dy, i);
        }
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.state === 'WARNING') {
            ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + 0.2 * Math.sin(this.timer * 15)})`;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        this.particles.forEach(p => {
            ctx.fillStyle = `rgba(200, 200, 200, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

class ConveyorBelt {
    constructor(y, width, height, speed, dir) {
        this.x = 0;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.dir = dir;
        this.offset = 0;
    }
    update(dt, player, enemies) {
        this.offset += this.speed * this.dir * dt;
        if (this.offset > 40) this.offset -= 40;
        if (this.offset < -40) this.offset += 40;

        const affectEntity = (ent) => {
            if (ent.y > this.y && ent.y < this.y + this.height) {
                ent.x += this.speed * this.dir * dt;
            }
        };

        if (player) affectEntity(player);
        enemies.forEach(affectEntity);
    }
    draw(ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = '#555';
        ctx.beginPath();
        for (let i = this.offset - 40; i < this.width + 40; i += 40) {
            if (this.dir > 0) {
                ctx.moveTo(i, this.y + 10);
                ctx.lineTo(i + 20, this.y + this.height / 2);
                ctx.lineTo(i, this.y + this.height - 10);
            } else {
                ctx.moveTo(i + 20, this.y + 10);
                ctx.lineTo(i, this.y + this.height / 2);
                ctx.lineTo(i + 20, this.y + this.height - 10);
            }
        }
        ctx.stroke();
    }
}

class Environment {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [
            new ParallaxLayer(5, 'distant_gears', width, height),
            new ParallaxLayer(15, 'pipes', width, height),
            new ParallaxLayer(30, 'chains', width, height)
        ];
        this.vents = [
            new SteamVent(width * 0.25, height * 0.25, 45),
            new SteamVent(width * 0.75, height * 0.75, 45)
        ];
        this.conveyors = [
            new ConveyorBelt(height * 0.4, width, 80, 80, 1),
            new ConveyorBelt(height * 0.8, width, 80, 80, -1)
        ];
    }
    update(dt, player, enemies, soundEngine) {
        this.layers.forEach(l => l.update(dt));
        this.vents.forEach(v => v.update(dt, player, enemies, soundEngine));
        this.conveyors.forEach(c => c.update(dt, player, enemies));
    }
    drawBackground(ctx, cameraX, cameraY) {
        this.layers.forEach(l => l.draw(ctx, cameraX, cameraY));
        this.conveyors.forEach(c => c.draw(ctx));
        this.vents.forEach(v => v.draw(ctx));
    }
}
