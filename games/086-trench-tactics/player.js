class Player extends Entity {
    constructor(x, y, size) {
        super(x, y, size, '#4a90e2');
        this.targetX = x;
        this.targetY = y;
        this.isMoving = false;
        this.moveSpeed = 400 + (game && game.upgradeManager ? game.upgradeManager.activeUpgrades.moveSpeed * 80 : 0);
        this.attackCooldown = 0;

        // Phase 2: Dash/Overdrive
        this.dashCooldown = 0;
        this.dashCooldownMax = 3.0;
        this.isDashing = false;
        this.invulnerable = 0;

        // Procedural Animation State
        this.recoil = 0;
        this.thrustFlame = 0;
    }
    update(dt, grid, input, sound, game) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.invulnerable > 0) this.invulnerable -= dt;
        if (this.recoil > 0) this.recoil -= dt * 5;
        if (this.recoil < 0) this.recoil = 0;

        let dx = 0, dy = 0;
        if (!this.isMoving && !this.isDashing) {
            if (input.keys['KeyW'] || input.keys['ArrowUp']) dy -= 1;
            if (input.keys['KeyS'] || input.keys['ArrowDown']) dy += 1;
            if (input.keys['KeyA'] || input.keys['ArrowLeft']) dx -= 1;
            if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += 1;
            let hasDiagonal = game && game.upgradeManager && game.upgradeManager.activeUpgrades.diagonalDash;
            if (!hasDiagonal && dx !== 0 && dy !== 0) dy = 0;
            else if (input.touch.active && dx === 0 && dy === 0) { dx = input.touch.dx; dy = input.touch.dy; }

            if (dx !== 0 || dy !== 0) {
                let nextX = this.x + dx * grid.cellSize;
                let nextY = this.y + dy * grid.cellSize;
                if (nextX >= 0 && nextX < grid.width && nextY >= 0 && nextY < grid.height) {
                    this.targetX = nextX;
                    this.targetY = nextY;
                    this.isMoving = true;
                    if (game && game.upgradeManager && game.upgradeManager.activeUpgrades.tileTrap) {
                        let t = new Projectile(this.x + this.size/2, this.y + this.size/2, 0, 0);
                        t.life = 5.0;
                        t.speed = 0;
                        t.color = '#e74c3c';
                        t.size = this.size / 2;
                        game.projectiles.push(t);
                    }
                }
            }
        }

        // Handle Dash Input
        if ((input.justPressed['ShiftLeft'] || input.justPressed['ShiftRight'] || input.mouse.justRightDown || input.touch.dashDown) && this.dashCooldown <= 0 && this.isMoving) {
            this.isDashing = true;
            this.moveSpeed = 1200;
            this.invulnerable = 0.5;
            this.dashCooldown = this.dashCooldownMax;
            sound.playShoot(); // Reuse or create a dash sound
        }

        if (this.isMoving) {
            this.thrustFlame = Math.min(1.0, this.thrustFlame + dt * 10);
            let tx = this.targetX - this.x;
            let ty = this.targetY - this.y;
            let dist = Math.sqrt(tx*tx + ty*ty);
            if (dist < this.moveSpeed * dt) {
                this.x = this.targetX;
                this.y = this.targetY;
                if (this.isDashing) {
                    // Try to continue dash in same direction if possible
                    let cdx = Math.sign(tx);
                    let cdy = Math.sign(ty);
                    let nextX = this.x + cdx * grid.cellSize;
                    let nextY = this.y + cdy * grid.cellSize;
                    if (nextX >= 0 && nextX < grid.width && nextY >= 0 && nextY < grid.height) {
                        this.targetX = nextX;
                        this.targetY = nextY;
                    } else {
                        this.isMoving = false;
                        this.isDashing = false;
                        this.moveSpeed = 400 + (game && game.upgradeManager ? game.upgradeManager.activeUpgrades.moveSpeed * 80 : 0);
                    }
                } else {
                    this.isMoving = false;
                }
            } else {
                this.x += (tx/dist) * this.moveSpeed * dt;
                this.y += (ty/dist) * this.moveSpeed * dt;
            }
        } else {
            this.thrustFlame = Math.max(0, this.thrustFlame - dt * 10);
            this.isDashing = false;
            this.moveSpeed = 400 + (game && game.upgradeManager ? game.upgradeManager.activeUpgrades.moveSpeed * 80 : 0);
        }

        if (input.justPressed['Space'] || input.mouse.justDown || input.touch.justDown) {
            if (this.attackCooldown <= 0 && !this.isMoving) {
                game.spawnProjectile(this.x + this.size/2, this.y + this.size/2, game.lastAimDir.x, game.lastAimDir.y);
                sound.playShoot();
                this.attackCooldown = Math.max(0.1, 0.5 - (game.upgradeManager ? game.upgradeManager.activeUpgrades.fireRate * 0.1 : 0));
                this.recoil = 1.0;
                if (game.upgradeManager && game.upgradeManager.activeUpgrades.echoClone) {
                    game.spawnProjectile(this.x + this.size/2 - 20, this.y + this.size/2 - 20, game.lastAimDir.x, game.lastAimDir.y);
                }
            }
        }
    }
    draw(ctx, game) {
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) return; // Blink

        ctx.save();
        ctx.translate(this.x + this.size/2, this.y + this.size/2);

        // Draw recoil
        ctx.translate(-game.lastAimDir.x * this.recoil * 10, -game.lastAimDir.y * this.recoil * 10);

        // Draw telegraph
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(game.lastAimDir.x * 50, game.lastAimDir.y * 50);
        ctx.stroke();

        // Draw thruster
        if (this.thrustFlame > 0) {
            let angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(-this.size/2, -this.size/4);
            ctx.lineTo(-this.size/2 - this.thrustFlame * 15, 0);
            ctx.lineTo(-this.size/2, this.size/4);
            ctx.fill();
            ctx.restore();
        }

        // Draw main body (submarinesque)
        ctx.fillStyle = this.isDashing ? '#f1c40f' : this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size/2, this.size/3, Math.atan2(game.lastAimDir.y, game.lastAimDir.x), 0, Math.PI * 2);
        ctx.fill();

        // Draw cockpit
        ctx.fillStyle = '#cdc3b9';
        ctx.beginPath();
        ctx.ellipse(this.size/4, 0, this.size/6, this.size/8, Math.atan2(game.lastAimDir.y, game.lastAimDir.x), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Draw Cooldown HUD on Player
        if (this.dashCooldown > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(this.x, this.y - 10, this.size * (1 - this.dashCooldown / this.dashCooldownMax), 4);
        }
    }
}
