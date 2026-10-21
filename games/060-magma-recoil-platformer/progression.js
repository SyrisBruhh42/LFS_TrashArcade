class ComboManager {
    constructor() { this.combo = 0; this.comboTimer = 0; this.maxComboTimer = 5; }
    addCombo(durationMultiplier=1) { this.combo++; this.comboTimer = this.maxComboTimer * durationMultiplier; }
    getMultiplier() { if (this.combo < 5) return 1; if (this.combo < 15) return 2; if (this.combo < 30) return 3; return 4; }
    update(dt) {
        if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { this.combo = 0; this.comboTimer = 0; } }
    }
    draw(ctx, width) {
        if (this.combo > 0) {
            ctx.fillStyle = '#ffcc00'; ctx.font = '24px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText(`Combo x${this.getMultiplier()} (${this.combo})`, width - 20, 30);
            ctx.fillStyle = '#444'; ctx.fillRect(width - 120, 40, 100, 10);
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(width - 120, 40, 100 * (this.comboTimer / this.maxComboTimer), 10);
        }
    }
}
class PickupManager {
    constructor() { this.pickups = []; }
    spawn(x, y) {
        if (Math.random() < 0.3) {
            let type = Math.random() < 0.2 ? 'health' : (Math.random() < 0.5 ? 'score' : 'combo');
            this.pickups.push({ x, y, type, radius: 8, life: 10 });
        }
    }
    update(dt, player, game) {
        let magnetRange = player.upgrades ? player.upgrades.magnet * 50 : 0;
        for (let p of this.pickups) {
            p.life -= dt;
            if (magnetRange > 0) {
                let dx = player.x - p.x; let dy = player.y - p.y; let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < magnetRange + 50) { p.x += (dx / dist) * 200 * dt; p.y += (dy / dist) * 200 * dt; }
            }
            let pdx = player.x - p.x; let pdy = player.y - p.y;
            if (Math.sqrt(pdx * pdx + pdy * pdy) < player.radius + p.radius) {
                p.life = 0;
                if (p.type === 'score') game.score += 500;
                if (p.type === 'combo' && game.comboManager) game.comboManager.addCombo();
                game.audio.playSFX('pickup');
                if (p.type === 'health') { game.score += 1000; game.ui.addMessage("Score Boost!", 2); }
            }
        }
        this.pickups = this.pickups.filter(p => p.life > 0);
    }
    draw(ctx) {
        for (let p of this.pickups) {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            if (p.type === 'score') ctx.fillStyle = '#0f0';
            else if (p.type === 'combo') ctx.fillStyle = '#0ff';
            else ctx.fillStyle = '#f0f';
            ctx.fill();
        }
    }
}
class UpgradeDraft {
    constructor() {
        this.options = [];
        this.allUpgrades = [
            { id: 'damage', name: 'Damage Up', desc: 'Increase bullet damage by 1', apply: p => p.upgrades.damage += 1 },
            { id: 'multishot', name: 'Multi-Shot', desc: 'Fire an additional bullet', apply: p => p.upgrades.multishot += 1 },
            { id: 'pierce', name: 'Piercing', desc: 'Bullets pierce 1 more enemy', apply: p => p.upgrades.pierce += 1 },
            { id: 'recoil', name: 'Recoil Boost', desc: 'Increase movement from recoil', apply: p => p.upgrades.recoil += 0.2 },
            { id: 'fireRate', name: 'Fire Rate Up', desc: 'Shoot faster', apply: p => p.upgrades.fireRate *= 0.8 },
            { id: 'magnet', name: 'Magnet', desc: 'Attract pickups further away', apply: p => p.upgrades.magnet += 1 },
            { id: 'combo', name: 'Combo Plus', desc: 'Combo lasts longer', apply: p => p.upgrades.comboDuration += 0.5 },
            { id: 'dash', name: 'Overdrive Dash', desc: 'Dash cooldown reduced', apply: p => p.upgrades.dashCooldown = Math.max(0.5, (p.upgrades.dashCooldown || 2) - 0.2) }
        ];
    }
    generateOptions() {
        this.options = []; let pool = [...this.allUpgrades];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            this.options.push(pool[idx]); pool.splice(idx, 1);
        }
    }
    handlePointerDown(e, game, canvasWidth, canvasHeight) {
        const rect = document.getElementById('gameCanvas').getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvasWidth / rect.width);
        const y = (e.clientY - rect.top) * (canvasHeight / rect.height);
        let width = canvasWidth; let height = canvasHeight;
        let boxWidth = 250; let boxHeight = 150; let gap = 20;
        let startX = width / 2 - (boxWidth * 1.5 + gap); let startY = height / 2 - boxHeight / 2;
        for (let i = 0; i < this.options.length; i++) {
            let bx = startX + i * (boxWidth + gap);
            if (x > bx && x < bx + boxWidth && y > startY && y < startY + boxHeight) {
                this.options[i].apply(game.player); game.audio.playSFX('upgrade'); game.state = 'PLAYING'; return true;
            }
        }
        return true;
    }
    draw(ctx, width, height) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; ctx.font = '30px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Choose an Upgrade', width / 2, height / 2 - 150);
        let boxWidth = 250; let boxHeight = 150; let gap = 20;
        let startX = width / 2 - (boxWidth * 1.5 + gap); let startY = height / 2 - boxHeight / 2;
        for (let i = 0; i < this.options.length; i++) {
            let bx = startX + i * (boxWidth + gap);
            ctx.fillStyle = '#222'; ctx.fillRect(bx, startY, boxWidth, boxHeight);
            ctx.strokeStyle = '#e09ff1'; ctx.strokeRect(bx, startY, boxWidth, boxHeight);
            ctx.fillStyle = '#e09ff1'; ctx.font = '20px sans-serif'; ctx.fillText(this.options[i].name, bx + boxWidth / 2, startY + 40);
            ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(this.options[i].desc, bx + boxWidth / 2, startY + 80);
        }
    }
}
