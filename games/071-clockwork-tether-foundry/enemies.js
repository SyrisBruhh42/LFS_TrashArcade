class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.dead = false;
        this.state = 'IDLE';
        this.stateTimer = 0;
    }
    update(dt, game) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.stateTimer = 0;
    }
    draw(ctx) {}
}

class SwarmerEnemy extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 12;
        this.speed = 100;
        this.state = 'WANDER';
        this.targetAngle = Math.random() * Math.PI * 2;
    }
    update(dt, game) {
        super.update(dt, game);
        let distToPlayer = Math.hypot(game.player.x - this.x, game.player.y - this.y);

        if (this.state === 'WANDER') {
            this.x += Math.cos(this.targetAngle) * this.speed * 0.5 * dt;
            this.y += Math.sin(this.targetAngle) * this.speed * 0.5 * dt;
            if (Math.random() < 0.05) this.targetAngle = Math.random() * Math.PI * 2;

            if (distToPlayer < 250) {
                this.state = 'TELEGRAPH';
                this.stateTimer = 1.0;
            }
        } else if (this.state === 'TELEGRAPH') {
            if (this.stateTimer <= 0) {
                this.state = 'LUNGE';
                this.stateTimer = 0.5;
                this.targetAngle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            }
        } else if (this.state === 'LUNGE') {
            this.x += Math.cos(this.targetAngle) * this.speed * 3 * dt;
            this.y += Math.sin(this.targetAngle) * this.speed * 3 * dt;
            if (this.stateTimer <= 0) {
                this.state = 'WANDER';
            }
        }

        if (distToPlayer < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.state === 'TELEGRAPH') {
            ctx.scale(1 + Math.sin(this.stateTimer * 20)*0.2, 1 + Math.sin(this.stateTimer * 20)*0.2);
            ctx.fillStyle = '#ffaa00';
        } else if (this.state === 'LUNGE') {
            ctx.fillStyle = '#ff0000';
            ctx.rotate(this.targetAngle);
        } else {
            ctx.fillStyle = '#cc5500';
        }
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 5;
        this.lifetime = 3;
        this.dead = false;
    }
    update(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.dead = true;

        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();
    }
}

class SniperEnemy extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 18;
        this.state = 'AIM';
        this.stateTimer = 2.0;
        this.aimAngle = 0;
    }
    update(dt, game) {
        super.update(dt, game);
        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);

        if (this.state === 'AIM') {
            this.aimAngle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            if (this.stateTimer <= 0) {
                this.state = 'FIRE';
                this.stateTimer = 0.2;

                game.hazards.push(new Projectile(
                    this.x + Math.cos(this.aimAngle)*this.radius,
                    this.y + Math.sin(this.aimAngle)*this.radius,
                    Math.cos(this.aimAngle)*300,
                    Math.sin(this.aimAngle)*300
                ));
                if (game.sound) game.sound.playWeaponFire();
            }
        } else if (this.state === 'FIRE') {
            if (this.stateTimer <= 0) {
                this.state = 'COOLDOWN';
                this.stateTimer = 1.5;
            }
        } else if (this.state === 'COOLDOWN') {
            if (this.stateTimer <= 0) {
                this.state = 'AIM';
                this.stateTimer = 2.0;
            }
        }
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.aimAngle);

        if (this.state === 'AIM') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(800, 0);
            ctx.strokeStyle = `rgba(255, 0, 0, ${1 - this.stateTimer/2.0})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.rect(-10, -10, 20, 20);
        ctx.fillStyle = '#4400aa';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, 0, 8, 0, Math.PI*2);
        ctx.fillStyle = this.state === 'FIRE' ? '#ffffff' : '#aa00ff';
        ctx.fill();
        ctx.restore();
    }
}

class AoEBurst {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 80;
        this.lifetime = 0.5;
        this.dead = false;
    }
    update(dt, game) {
        this.radius += (this.maxRadius / 0.5) * dt;
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.dead = true;

        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = `rgba(0, 255, 255, ${this.lifetime/0.5})`;
        ctx.fill();
    }
}

class ShieldedBruiser extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 25;
        this.speed = 40;
        this.state = 'APPROACH';
    }
    update(dt, game) {
        super.update(dt, game);
        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);

        if (this.state === 'APPROACH') {
            let angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;

            if (dist < 100) {
                this.state = 'TELEGRAPH';
                this.stateTimer = 1.2;
            }
        } else if (this.state === 'TELEGRAPH') {
            if (this.stateTimer <= 0) {
                this.state = 'BURST';
                this.stateTimer = 0.5;
                game.hazards.push(new AoEBurst(this.x, this.y));
            }
        } else if (this.state === 'BURST') {
            if (this.stateTimer <= 0) {
                this.state = 'APPROACH';
            }
        }
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fillStyle = '#0055aa';
        ctx.fill();

        if (this.state === 'TELEGRAPH') {
            ctx.beginPath();
            ctx.arc(0, 0, 100 * (1.2 - this.stateTimer)/1.2, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}

class SpawnerEnemy extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 20;
        this.speed = 60;
        this.state = 'FLEE';
        this.stateTimer = 3.0;
    }
    update(dt, game) {
        super.update(dt, game);
        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);

        if (this.state === 'FLEE') {
            let angle = Math.atan2(this.y - game.player.y, this.x - game.player.x);
            if (dist < 300) {
                this.x += Math.cos(angle) * this.speed * dt;
                this.y += Math.sin(angle) * this.speed * dt;
            }
            if (this.stateTimer <= 0) {
                this.state = 'TELEGRAPH';
                this.stateTimer = 1.0;
            }
        } else if (this.state === 'TELEGRAPH') {
            if (this.stateTimer <= 0) {
                this.state = 'SPAWN';
                game.enemies.push(new SwarmerEnemy(this.x, this.y));
                this.stateTimer = 4.0;
            }
        } else if (this.state === 'SPAWN') {
            this.state = 'FLEE';
        }
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
        // Keep within bounds somewhat
        if (this.x < 50) this.x = 50;
        if (this.x > game.width - 50) this.x = game.width - 50;
        if (this.y < 50) this.y = 50;
        if (this.y > game.height - 50) this.y = game.height - 50;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        for(let i=0; i<8; i++){
            let a = i * Math.PI/4 + (this.stateTimer * 2);
            let r = this.radius * (i%2==0 ? 1 : 0.6);
            ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.fillStyle = '#00aa55';
        ctx.fill();

        if (this.state === 'TELEGRAPH') {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI*2);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();
    }
}

class ToxicPuddle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.lifetime = 10;
        this.dead = false;
    }
    update(dt, game) {
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.dead = true;

        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = `rgba(100, 255, 100, ${Math.min(0.6, this.lifetime/2)})`;
        ctx.fill();
    }
}

class AreaDenialEnemy extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 22;
        this.speed = 50;
        this.state = 'WANDER';
        this.targetAngle = Math.random() * Math.PI * 2;
        this.stateTimer = 3.0;
    }
    update(dt, game) {
        super.update(dt, game);
        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);

        if (this.state === 'WANDER') {
            this.x += Math.cos(this.targetAngle) * this.speed * dt;
            this.y += Math.sin(this.targetAngle) * this.speed * dt;
            if (Math.random() < 0.02) this.targetAngle = Math.random() * Math.PI * 2;

            if (this.stateTimer <= 0) {
                this.state = 'TELEGRAPH';
                this.stateTimer = 1.0;
            }
        } else if (this.state === 'TELEGRAPH') {
            if (this.stateTimer <= 0) {
                this.state = 'DROP';
                game.hazards.push(new ToxicPuddle(this.x, this.y));
                if (game.sound) game.sound.playWeaponFire();
                this.stateTimer = 5.0;
            }
        } else if (this.state === 'DROP') {
            this.state = 'WANDER';
        }
        if (dist < this.radius + game.player.radius && game.player.invulnerableTimer <= 0) {
            game.die();
        }

        if (this.x < 50) this.x = 50;
        if (this.x > game.width - 50) this.x = game.width - 50;
        if (this.y < 50) this.y = 50;
        if (this.y > game.height - 50) this.y = game.height - 50;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.moveTo(-this.radius, -this.radius);
        ctx.lineTo(this.radius, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.closePath();
        ctx.fillStyle = '#88aa00';
        ctx.fill();

        if (this.state === 'TELEGRAPH') {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
}
