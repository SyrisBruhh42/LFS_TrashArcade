class BonusPickup extends Entity {
    constructor(x, y, size) {
        super(x, y, size, '#f1c40f');
        this.life = 10.0;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life < 3 && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.save();
        ctx.translate(this.x + this.size/2, this.y + this.size/2);
        ctx.rotate(Date.now() / 200);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.size/2);
        ctx.lineTo(this.size/2, 0);
        ctx.lineTo(0, this.size/2);
        ctx.lineTo(-this.size/2, 0);
        ctx.fill();
        ctx.restore();
    }
}

class UpgradeManager {
    constructor(game) {
        this.game = game;
        this.synergyMultiplier = 1;
        this.synergyTimer = 0;
        this.pickupTimer = 5.0;
        this.pickups = [];
        this.draftOptions = [];
        this.activeUpgrades = {
            diagonalDash: false,
            echoClone: false,
            tileTrap: false,
            moveSpeed: 0,
            fireRate: 0
        };
        this.allPerks = [
            { id: 'diagonalDash', name: 'Diagonal Dash', desc: 'Allows 8-way movement.' },
            { id: 'echoClone', name: 'Echo Clone', desc: 'Fires extra shots.' },
            { id: 'tileTrap', name: 'Tile-Trap Modules', desc: 'Leaves a trap behind on move.' },
            { id: 'moveSpeed', name: 'Speed Boost', desc: 'Increases move speed by 20%.' },
            { id: 'fireRate', name: 'Rapid Fire', desc: 'Decreases attack cooldown.' }
        ];
    }
    update(dt, input) {
        if (this.game.state === 'PLAYING') {
            if (this.synergyTimer > 0) {
                this.synergyTimer -= dt;
                if (this.synergyTimer <= 0) {
                    this.synergyMultiplier = 1;
                }
            }
            this.pickupTimer -= dt;
            if (this.pickupTimer <= 0) {
                this.pickupTimer = 10.0 + Math.random() * 5.0;
                let x = Math.random() * (this.game.width - this.game.grid.cellSize);
                let y = Math.random() * (this.game.height - this.game.grid.cellSize);
                this.pickups.push(new BonusPickup(this.game.grid.snap(x), this.game.grid.snap(y), this.game.grid.cellSize));
            }

            let effectiveDt = dt * this.game.timeMultiplier;
            for (let i = this.pickups.length - 1; i >= 0; i--) {
                let pk = this.pickups[i];
                pk.update(effectiveDt);
                if (pk.life <= 0) {
                    this.pickups.splice(i, 1);
                    continue;
                }
                if (this.game.checkCollision(this.game.player, pk)) {
                    this.synergyMultiplier++;
                    this.synergyTimer = 5.0;
                    this.pickups.splice(i, 1);
                    if (this.game.soundEngine.playMenuSelect) this.game.soundEngine.playMenuSelect();
                }
            }
        } else if (this.game.state === 'UPGRADE') {
            if (input.justPressed['Digit1'] || input.justPressed['Numpad1']) this.selectPerk(0);
            else if (input.justPressed['Digit2'] || input.justPressed['Numpad2']) this.selectPerk(1);
            else if (input.justPressed['Digit3'] || input.justPressed['Numpad3']) this.selectPerk(2);
            else if (input.mouse.justDown || input.touch.justDown) {
                let hw = this.game.width/2;
                let cx = input.mouse.x;
                if (cx > hw - 350 && cx < hw - 130) this.selectPerk(0);
                else if (cx > hw - 100 && cx < hw + 100) this.selectPerk(1);
                else if (cx > hw + 130 && cx < hw + 350) this.selectPerk(2);
            }
        }
    }
    triggerDraft() {
        this.game.state = 'UPGRADE';
        this.game.inputManager.clear();
        let available = this.allPerks.filter(p => {
            if (p.id === 'diagonalDash') return !this.activeUpgrades.diagonalDash;
            if (p.id === 'echoClone') return !this.activeUpgrades.echoClone;
            if (p.id === 'tileTrap') return !this.activeUpgrades.tileTrap;
            return true;
        });
        available.sort(() => Math.random() - 0.5);
        this.draftOptions = available.slice(0, 3);
    }
    selectPerk(index) {
        if (index >= this.draftOptions.length) return;
        let p = this.draftOptions[index];
        if (p.id === 'diagonalDash') this.activeUpgrades.diagonalDash = true;
        else if (p.id === 'echoClone') this.activeUpgrades.echoClone = true;
        else if (p.id === 'tileTrap') this.activeUpgrades.tileTrap = true;
        else if (p.id === 'moveSpeed') this.activeUpgrades.moveSpeed++;
        else if (p.id === 'fireRate') this.activeUpgrades.fireRate++;
        if (this.game.soundEngine.playMenuSelect) this.game.soundEngine.playMenuSelect();
        this.game.state = 'PLAYING';
        this.game.inputManager.clear();
        this.game.lastTime = performance.now();
    }
    draw(ctx, width, height) {
        if (this.game.state === 'PLAYING' || this.game.state === 'PAUSED' || this.game.state === 'GAME_OVER') {
            for (let pk of this.pickups) pk.draw(ctx);
        }
        if ((this.game.state === 'PLAYING' || this.game.state === 'PAUSED' || this.game.state === 'GAME_OVER') && this.synergyMultiplier > 1) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`Synergy x${this.synergyMultiplier}`, width / 2, 30);
            ctx.fillRect(width / 2 - 50, 40, 100 * (this.synergyTimer / 5.0), 4);
        }
        if (this.game.state === 'UPGRADE') {
            ctx.fillStyle = 'rgba(5, 10, 18, 0.9)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SELECT A PERK', width / 2, 100);

            ctx.font = '16px monospace';
            ctx.fillStyle = '#cdc3b9';
            ctx.fillText('Press 1, 2, 3 or Click to Select', width / 2, 140);

            for (let i = 0; i < this.draftOptions.length; i++) {
                let opt = this.draftOptions[i];
                let cx = width / 2 + (i - 1) * 230;

                ctx.fillStyle = '#0d3554';
                ctx.fillRect(cx - 100, height / 2 - 100, 200, 200);
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 100, height / 2 - 100, 200, 200);

                ctx.fillStyle = '#00e676';
                ctx.font = 'bold 18px monospace';
                ctx.fillText(opt.name, cx, height / 2 - 60);

                ctx.fillStyle = '#cdc3b9';
                ctx.font = '14px monospace';
                let words = opt.desc.split(' ');
                let line = '', y = height / 2;
                for (let w of words) {
                    if (ctx.measureText(line + w + ' ').width > 180) {
                        ctx.fillText(line, cx, y);
                        line = w + ' ';
                        y += 20;
                    } else line += w + ' ';
                }
                ctx.fillText(line, cx, y);

                ctx.fillStyle = '#00e5ff';
                ctx.font = 'bold 24px monospace';
                ctx.fillText(`[${i+1}]`, cx, height / 2 + 80);
            }
        }
    }
}
