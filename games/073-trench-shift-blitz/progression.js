class ProgressionSystem {
    constructor() {
        this.combo = 0;
        this.comboTimer = 0;
        this.maxComboTimer = 5;
        this.comboDecayRate = 1;

        this.inDraft = false;
        this.draftOptions = [];

        this.perkPool = [
            { id: "max_hp", name: "Max HP +1", desc: "Increases your maximum health by 1." },
            { id: "heal", name: "Heal +2", desc: "Restores 2 health immediately." },
            { id: "dash_cd", name: "Dash CD -1", desc: "Reduces dash max cooldown by 1 turn." },
            { id: "invuln", name: "Invuln Up", desc: "Increases invulnerability time after hit." },
            { id: "combo_time", name: "Combo Time +", desc: "Increases max combo timer." },
            { id: "score_bonus", name: "Score Surge", desc: "Immediately grants 1000 score." },
            { id: "combo_decay", name: "Slower Decay", desc: "Reduces combo timer decay rate." },
            { id: "dash_free", name: "Free Dash", desc: "First dash per wave has no cooldown." }
        ];
    }

    reset() {
        this.combo = 0;
        this.comboTimer = 0;
        this.inDraft = false;
        this.draftOptions = [];
    }

    addCombo(amount) {
        this.combo += amount;
        this.comboTimer = this.maxComboTimer;
    }

    getMultiplier() {
        if (this.combo >= 20) return 4;
        if (this.combo >= 10) return 3;
        if (this.combo >= 5) return 2;
        return 1;
    }

    update(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt * this.comboDecayRate;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.comboTimer = 0;
            }
        }
    }

    triggerDraft() {
        this.inDraft = true;
        let pool = [...this.perkPool];
        pool.sort(() => Math.random() - 0.5);
        this.draftOptions = pool.slice(0, 3);
    }

    applyPerk(engine, perkId) {
        switch(perkId) {
            case "max_hp": engine.player.maxHp++; engine.player.hp++; break;
            case "heal": engine.player.hp = Math.min(engine.player.maxHp, engine.player.hp + 2); break;
            case "dash_cd": engine.player.dashMaxCooldown = Math.max(1, engine.player.dashMaxCooldown - 1); break;
            case "invuln": engine.player.invulnTimer += 0.5; break;
            case "combo_time": this.maxComboTimer += 2; break;
            case "score_bonus": engine.score += 1000; break;
            case "combo_decay": this.comboDecayRate *= 0.8; break;
            case "dash_free": engine.player.dashCooldown = 0; break;
        }
        this.inDraft = false;
        if(perkId === 'heal' || perkId === 'max_hp') engine.sound.playHeal(); else engine.sound.playPowerup();
    }

    drawComboUI(ctx, width, height) {
        if (this.comboTimer > 0) {
            let cx = width / 2;
            let cy = 40;
            let barW = 200;
            let barH = 15;

            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(cx - barW/2, cy, barW, barH);

            let fillW = (this.comboTimer / this.maxComboTimer) * barW;
            ctx.fillStyle = "#ffaa00";
            ctx.fillRect(cx - barW/2, cy, fillW, barH);

            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - barW/2, cy, barW, barH);

            ctx.fillStyle = "#fff";
            ctx.font = "20px monospace";
            ctx.textAlign = "center";
            ctx.fillText(`Combo x${this.getMultiplier()} (${this.combo})`, cx, cy - 5);
        }
    }

    drawDraftUI(ctx, width, height) {
        if (!this.inDraft) return;

        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#fff";
        ctx.font = "30px monospace";
        ctx.textAlign = "center";
        ctx.fillText("WAVE CLEARED - CHOOSE UPGRADE", width / 2, height / 2 - 120);

        let optW = 250;
        let optH = 120;
        let startX = width / 2 - (optW * 1.5) - 20;

        for (let i = 0; i < this.draftOptions.length; i++) {
            let opt = this.draftOptions[i];
            let bx = startX + i * (optW + 20);
            let by = height / 2 - optH / 2;

            ctx.fillStyle = "rgba(100, 100, 200, 0.5)";
            ctx.fillRect(bx, by, optW, optH);
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, optW, optH);

            ctx.fillStyle = "#fff";
            ctx.font = "20px monospace";
            ctx.fillText(opt.name, bx + optW/2, by + 30);

            ctx.font = "14px monospace";
            let words = opt.desc.split(" ");
            let line = "";
            let ly = by + 60;
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + " ";
                let metrics = ctx.measureText(testLine);
                if (metrics.width > optW - 20 && n > 0) {
                    ctx.fillText(line, bx + optW/2, ly);
                    line = words[n] + " ";
                    ly += 20;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, bx + optW/2, ly);

            ctx.font = "16px monospace";
            ctx.fillText(`Press [${i+1}] or Click`, bx + optW/2, by + optH - 10);
        }
    }

    handleDraftInput(engine, input) {
        if (!this.inDraft) return false;

        if (input.wasKeyPressed('Digit1') || input.wasKeyPressed('Numpad1')) {
            this.applyPerk(engine, this.draftOptions[0].id);
            return true;
        }
        if (input.wasKeyPressed('Digit2') || input.wasKeyPressed('Numpad2')) {
            this.applyPerk(engine, this.draftOptions[1].id);
            return true;
        }
        if (input.wasKeyPressed('Digit3') || input.wasKeyPressed('Numpad3')) {
            this.applyPerk(engine, this.draftOptions[2].id);
            return true;
        }

        for (let p of input.pointers) {
            let optW = 250;
            let optH = 120;
            let startX = engine.width / 2 - (optW * 1.5) - 20;
            for (let i = 0; i < this.draftOptions.length; i++) {
                let bx = startX + i * (optW + 20);
                let by = engine.height / 2 - optH / 2;
                if (p.x >= bx && p.x <= bx + optW && p.y >= by && p.y <= by + optH) {
                    this.applyPerk(engine, this.draftOptions[i].id);
                    p.x = -1000;
                    return true;
                }
            }
        }

        return true;
    }
}

class Pickup extends GridEntity {
    constructor(x, y) {
        super(x, y, "#00ffaa");
        this.isItem = true;
        this.isPickup = true;
    }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cellSize * 0.3);
        ctx.lineTo(cx + cellSize * 0.2, cy + cellSize * 0.2);
        ctx.lineTo(cx - cellSize * 0.2, cy + cellSize * 0.2);
        ctx.fill();
    }
}