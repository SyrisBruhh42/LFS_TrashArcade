class Pickup {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 8;
        this.life = 10.0;
        this.type = Math.random() < 0.5 ? 'combo' : 'score';
        this.color = this.type === 'combo' ? '#ffff00' : '#00ff00';
        this.vy = -150; this.vx = (Math.random() - 0.5) * 100;
        this.active = true;
    }
    update(dt, platforms) {
        this.vy += 600 * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {
                if (this.y < p.y + p.h / 2) {
                    this.y = p.y - this.radius; this.vy = 0; this.vx *= 0.9;
                }
            }
        }
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        if (this.life < 2 && Math.floor(this.life * 10) % 2 === 0) ctx.fillStyle = 'transparent';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
    }
}

const UPGRADE_POOL = [
    { id: 'speed', name: 'Agility Training', desc: '+15% Move Speed', apply: p => p.speed *= 1.15 },
    { id: 'jump', name: 'Kinetic Thrusters', desc: '+15% Jump Force', apply: p => p.jumpForce *= 1.15 },
    { id: 'dash_cd', name: 'Quick Dash', desc: '-15% Dash Cooldown', apply: p => p.dashCooldown *= 0.85 },
    { id: 'combo_time', name: 'Combo Master', desc: '+1s Max Combo Time', apply: p => p.comboMaxTimer += 1.0 },
    { id: 'grapple_len', name: 'Titanium Tether', desc: '+20% Grapple Length', apply: p => p.grapple.maxLength *= 1.2 },
    { id: 'grapple_pull', name: 'Heavy Winch', desc: '+20% Grapple Pull', apply: p => p.grapple.pullForce *= 1.2 },
    { id: 'dash_dur', name: 'Extended Dash', desc: '+20% Dash Duration', apply: p => p.dashDuration *= 1.2 },
    { id: 'gravity', name: 'Anti-Grav Module', desc: '-10% Gravity', apply: p => p.gravity *= 0.9 }
];

class WaveDirector {
    static getUpgrades(count) {
        let pool = [...UPGRADE_POOL];
        let choices = [];
        for(let i=0; i<count; i++) {
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            choices.push(pool.splice(idx, 1)[0]);
        }
        return choices;
    }
}
window.Pickup = Pickup;
window.WaveDirector = WaveDirector;
