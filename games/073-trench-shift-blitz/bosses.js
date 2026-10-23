class Boss extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.isBoss = true;
        this.phase = 1;
        this.maxHp = 20;
        this.hp = 20;
        this.name = "Unknown Boss";
    }

    takeDamage(amount, engine) {
        this.hp -= amount;
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseTransition(engine);
        }
    }

    onPhaseTransition(engine) {
        engine.sound.playWarning();
    }

    drawBossUI(ctx, width, height) {
        let barW = width * 0.6;
        let barH = 20;
        let bx = (width - barW) / 2;
        let by = 60;

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx, by, barW, barH);

        let hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.phase === 1 ? "#ff0000" : "#ff00ff";
        ctx.fillRect(bx, by, barW * hpRatio, barH);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, barW, barH);

        ctx.fillStyle = "#ffffff";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${this.name} - Phase ${this.phase}`, width / 2, by - 5);

        // Warning banner
        if (this.phase === 2 && Math.floor(performance.now() / 200) % 2 === 0) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
            ctx.fillRect(0, by + barH + 10, width, 30);
            ctx.fillStyle = "#ff0000";
            ctx.fillText("WARNING: ENRAGED", width / 2, by + barH + 32);
        }
    }
}

class TrenchLeviathan extends Boss {
    constructor(x, y) {
        super(x, y);
        this.name = "Trench Leviathan";
        this.maxHp = 15;
        this.hp = 15;
        this.color = "#0044aa";
        this.turnCounter = 0;
    }

    aiMove(engine) {
        this.turnCounter++;
        let dx = engine.player.gridPos.x - this.gridPos.x;
        let dy = engine.player.gridPos.y - this.gridPos.y;

        if (this.phase === 1) {
            if (this.turnCounter % 3 === 0) {
                // Slam attack logic
                if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
                    if (engine.player.invulnTimer <= 0) {
                        engine.player.hp--;
                        engine.sound.playExplosion();
                        engine.player.invulnTimer = 0.3;
                        if (engine.player.hp <= 0) engine.gameOver();
                    }
                }
            } else {
                this.basicMove(engine, dx, dy);
            }
        } else {
            if (this.turnCounter % 2 === 0) {
                // Spawn Ocean Currents
                engine.entities.push(new OceanCurrent(this.gridPos.x, this.gridPos.y, dx > 0 ? 1 : (dx < 0 ? -1 : 0), dy > 0 ? 1 : (dy < 0 ? -1 : 0)));
                this.basicMove(engine, dx, dy);
            } else {
                this.basicMove(engine, dx, dy);
            }
        }
    }

    basicMove(engine, dx, dy) {
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else if (dy !== 0) {
            moveY = dy > 0 ? 1 : -1;
        }

        let nextX = this.gridPos.x + moveX;
        let nextY = this.gridPos.y + moveY;
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
            }
        }
    }

    onPhaseTransition(engine) {
        super.onPhaseTransition(engine);
        this.color = "#ff44aa";
    }

    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(cx - cellSize*0.3, cy - cellSize*0.2, 5, 5);
        ctx.fillRect(cx + cellSize*0.3, cy - cellSize*0.2, 5, 5);
    }
}


class AbyssalConstructor extends Boss {
    constructor(x, y) {
        super(x, y);
        this.name = "Abyssal Constructor";
        this.maxHp = 12;
        this.hp = 12;
        this.color = "#aaaa00";
        this.turnCounter = 0;
    }

    aiMove(engine) {
         this.turnCounter++;
         if (this.phase === 1) {
             if (this.turnCounter % 4 === 0) {
                 engine.shrinkArena();
             } else {
                 this.teleportMove(engine);
             }
         } else {
              if (this.turnCounter % 3 === 0) {
                 engine.shrinkArena();
                 let pos = engine.getRandomEmptyPos();
                 if (pos) engine.entities.push(new CoralCover(pos.x, pos.y));
             } else {
                 this.teleportMove(engine);
             }
         }
    }

    teleportMove(engine) {
         let pos = engine.getRandomEmptyPos();
         if (pos) {
             this.gridPos.x = pos.x;
             this.gridPos.y = pos.y;
         }
    }

    onPhaseTransition(engine) {
        super.onPhaseTransition(engine);
        this.color = "#ff0000";
    }

    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.fillRect(cx - cellSize*0.6, cy - cellSize*0.6, cellSize*1.2, cellSize*1.2);

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - cellSize*0.4, cy - cellSize*0.4, cellSize*0.8, cellSize*0.8);
    }
}
