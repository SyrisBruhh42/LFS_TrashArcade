
class VFXManager {
    constructor() {
        this.particles = [];
        this.floatingTexts = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.shakeDir = {x: 0, y: 0};
        this.hitStopTime = 0;
        this.trails = [];
    }

    update(dt) {
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
        }

        if (this.hitStopTime > 0) {
            this.hitStopTime -= dt;
            return true; // Return true to indicate game should be paused
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.size *= 0.95;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let t = this.floatingTexts[i];
            t.y -= 50 * dt * (t.life / t.maxLife); // smooth easing out
            t.life -= dt;
            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        for (let i = this.trails.length - 1; i >= 0; i--) {
            let t = this.trails[i];
            t.life -= dt;
            if (t.life <= 0) {
                this.trails.splice(i, 1);
            }
        }

        return false;
    }

    draw(ctx) {
        for (let t of this.trails) {
            ctx.save();
            ctx.globalAlpha = (t.life / t.maxLife) * 0.5;
            ctx.translate(t.x, t.y);
            ctx.rotate(t.angle);
            ctx.fillStyle = t.color;
            ctx.fillRect(-t.size, -t.size, t.size*2, t.size*2);
            ctx.restore();
        }

        for (let p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        for (let t of this.floatingTexts) {
            ctx.save();
            ctx.globalAlpha = t.life / t.maxLife;
            ctx.fillStyle = t.color;
            ctx.font = t.size + 'px monospace';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }

    applyShake(ctx) {
        if (this.shakeTime > 0) {
            let intensity = this.shakeIntensity * (this.shakeTime / 0.5);
            let dx = (Math.random() - 0.5) * intensity * 2;
            let dy = (Math.random() - 0.5) * intensity * 2;
            if (this.shakeDir.x !== 0 || this.shakeDir.y !== 0) {
                 dx += this.shakeDir.x * intensity;
                 dy += this.shakeDir.y * intensity;
            }
            ctx.translate(dx, dy);
        }
    }

    spawnExplosion(x, y, color, count=20) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 100 + 50;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0,
                size: Math.random() * 5 + 3
            });
        }
    }

    spawnDirectional(x, y, dirX, dirY, color, count=10) {
        let baseAngle = Math.atan2(dirY, dirX);
        for (let i = 0; i < count; i++) {
            let angle = baseAngle + (Math.random() - 0.5) * Math.PI / 2;
            let speed = Math.random() * 150 + 50;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6,
                size: Math.random() * 4 + 2
            });
        }
    }

    spawnFloatingText(x, y, text, color, size=20) {
        this.floatingTexts.push({
            x: x, y: y,
            text: text,
            color: color,
            life: 1.0,
            maxLife: 1.0,
            size: size
        });
    }

    addTrail(x, y, angle, size, color) {
        this.trails.push({
            x: x, y: y,
            angle: angle,
            size: size,
            color: color,
            life: 0.2,
            maxLife: 0.2
        });
    }

    shake(intensity, time=0.2, dirX=0, dirY=0) {
        this.baseShakeIntensity = intensity;
        this.shakeIntensity = intensity;
        this.shakeTime = time;
        this.shakeDir = {x: dirX, y: dirY};
    }

    hitStop(time=0.1) {
        this.hitStopTime = time;
    }
}
