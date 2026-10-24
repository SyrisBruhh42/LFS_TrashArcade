
class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_079_079-bazaar-bullet-retrieval_v1';
        this.data = this.load();
    }
    load() {
        let data = { highScore: 0, gamesPlayed: 0, settings: { masterMute: false, sfxVolume: 0.8, musicVolume: 0.5, screenShake: 1.0, particleDensity: 'High', highContrast: false, fpsCounter: false, touchMode: 'Auto', touchSwap: false }, milestones: { firstBlood: false, ammoHoarder: false, bossSlayer: false, comboMaster: false, survivor: false, rich: false } };
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                data = { ...data, ...parsed, settings: { ...data.settings, ...(parsed.settings || {}) }, milestones: { ...data.milestones, ...(parsed.milestones || {}) } };
            }
        } catch (e) { console.error('Save load failed', e); }
        return data;
    }
    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) { console.error('Save failed', e); }
    }
    exportBase64() { return btoa(JSON.stringify(this.data)); }
    importBase64(str) { try { const parsed = JSON.parse(atob(str)); this.data = { ...this.data, ...parsed, settings: { ...this.data.settings, ...(parsed.settings || {}) }, milestones: { ...this.data.milestones, ...(parsed.milestones || {}) } }; this.save(); return true; } catch(e) { return false; } }
}


class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touches = [];
        this.canvas = canvas;

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
        });
        canvas.addEventListener('mousedown', e => {
            this.mouse.down = true;
            window.game && window.game.sound.init();
        });
        canvas.addEventListener('mouseup', () => this.mouse.down = false);

        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.updateTouches(e);
            window.game && window.game.sound.init();
        }, { passive: false });
        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, { passive: false });
        canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, { passive: false });
    }

    updateTouches(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.touches = Array.from(e.touches).map(t => ({
            x: (t.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (t.clientY - rect.top) * (this.canvas.height / rect.height),
            id: t.identifier
        }));
    }

    getMovement() {
        let dx = 0;
        let dy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        // Touch joystick logic (left side of screen)
        let swap = window.game?.saveManager?.data?.settings?.touchSwap;
        const leftTouch = this.touches.find(t => swap ? t.x > this.canvas.width / 2 : t.x < this.canvas.width / 2);
        if (leftTouch) {
            const centerX = swap ? this.canvas.width * 0.75 : this.canvas.width / 4;
            const centerY = this.canvas.height * 0.75;
            dx = (leftTouch.x - centerX) / 50;
            dy = (leftTouch.y - centerY) / 50;
            const mag = Math.sqrt(dx*dx + dy*dy);
            if (mag > 1) {
                dx /= mag;
                dy /= mag;
            }
        }

        return { dx, dy };
    }

    isShooting() {
        if (this.mouse.down) return true;
        let swap = window.game?.saveManager?.data?.settings?.touchSwap;
        // Touch shoot button (right side of screen)
        return this.touches.some(t => swap ? t.x < this.canvas.width / 2 : t.x > this.canvas.width / 2);
    }

    getAim(playerX, playerY) {
        let swap = window.game?.saveManager?.data?.settings?.touchSwap;
        let rightTouch = this.touches.find(t => swap ? t.x < this.canvas.width / 2 : t.x > this.canvas.width / 2);
        if (rightTouch) {
            return { x: rightTouch.x, y: rightTouch.y };
        }
        return { x: this.mouse.x, y: this.mouse.y };
    }
    isDashing() {
        return this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    }
}

class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {}
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.speed = 200;
        this.maxAmmo = 5;
        this.ammo = this.maxAmmo;
        this.shootCooldown = 0;

        // Phase 2: Mastery, vector sprite, reactive animation
        this.dashCooldownMax = 1.5;
        this.dashCooldown = 0;
        this.dashTimeMax = 0.2;
        this.dashTimer = 0;
        this.invulnTimerMax = 0.5;
        this.invulnTimer = 0;
        this.aimAngle = 0;
        this.recoilTimer = 0;
        this.thrustTimer = 0;

        // Momentum based movement
        this.vx = 0;
        this.vy = 0;
        this.accel = 1500;
        this.friction = 0.85;
        this.maxSpeed = 250;
        this.dashSpeed = 800;
    }
    update(dt, input) {
        const move = input.getMovement();

        // Normalize movement
        const mag = Math.sqrt(move.dx * move.dx + move.dy * move.dy);
        if (mag > 1) {
            move.dx /= mag;
            move.dy /= mag;
        }

        // Aim angle
        const aim = input.getAim(this.x, this.y);
        this.aimAngle = Math.atan2(aim.y - this.y, aim.x - this.x);

        // Dash
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.recoilTimer > 0) this.recoilTimer -= dt;

        if (input.isDashing() && this.dashCooldown <= 0 && mag > 0.1) {
            this.dashTimer = this.dashTimeMax;
            this.dashCooldown = this.dashCooldownMax;
            this.invulnTimer = this.invulnTimerMax;

            // Boost velocity in dash direction
            this.vx = move.dx * this.dashSpeed;
            this.vy = move.dy * this.dashSpeed;

            if (window.game && window.game.vfx) {
                window.game.vfx.triggerShake(0.1, 3);
            }
            if (window.game && window.game.sound) {
                window.game.sound.playDash();
            }
        }

        if (this.dashTimer > 0 && window.game && window.game.vfx) {
            window.game.vfx.addTrail(this.x, this.y, this.radius, '#e2fc7a', 0.2);
            window.game.vfx.emitParticles(this.x, this.y, 2, '#fff', 300, -this.vx, -this.vy, 0.5);
        }

        // Apply acceleration if not dashing
        if (this.dashTimer <= 0) {
            this.vx += move.dx * this.accel * dt;
            this.vy += move.dy * this.accel * dt;
            if (mag > 0.1 && window.game && window.game.vfx) {
                window.game.vfx.emitParticles(this.x, this.y, 1, '#f88', 100, -move.dx, -move.dy, 0.5);
            }

            // Limit speed
            const speedSq = this.vx * this.vx + this.vy * this.vy;
            if (speedSq > this.maxSpeed * this.maxSpeed) {
                const speed = Math.sqrt(speedSq);
                this.vx = (this.vx / speed) * this.maxSpeed;
                this.vy = (this.vy / speed) * this.maxSpeed;
            }
        }

        // Apply friction
        this.vx *= Math.pow(this.friction, dt * 60);
        this.vy *= Math.pow(this.friction, dt * 60);

        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // Thrust visual timer
        if (mag > 0.1) this.thrustTimer += dt;
        else this.thrustTimer = 0;
    }
    draw(ctx) {
        // Invulnerability blink
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Recoil displacement visually
        if (this.recoilTimer > 0) {
            const recoilDist = (this.recoilTimer / 0.1) * 5;
            ctx.translate(-Math.cos(this.aimAngle) * recoilDist, -Math.sin(this.aimAngle) * recoilDist);
        }

        ctx.rotate(this.aimAngle);

        // Thrust effect
        if (this.thrustTimer > 0) {
            ctx.fillStyle = (Math.floor(this.thrustTimer * 20) % 2 === 0) ? '#ff5' : '#f50';
            ctx.beginPath();
            ctx.moveTo(-10, -5);
            ctx.lineTo(-20 - Math.random() * 10, 0);
            ctx.lineTo(-10, 5);
            ctx.fill();
        }

        // Procedural Ship Chassis
        ctx.strokeStyle = '#e2fc7a';
        ctx.fillStyle = '#1a1515';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(15, 0); // Nose
        ctx.lineTo(-10, 12); // Right Wing
        ctx.lineTo(-5, 0); // Engine Back
        ctx.lineTo(-10, -12); // Left Wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gun barrel
        ctx.fillStyle = '#e2fc7a';
        ctx.fillRect(5, -2, 12, 4);

        // Laser telegraph
        ctx.strokeStyle = 'rgba(226, 252, 122, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(17, 0);
        ctx.lineTo(800, 0);
        ctx.stroke();

        ctx.restore();

        // Draw ammo indicators (orbiting)
        const orbitTime = Date.now() / 1000;
        for (let i = 0; i < this.maxAmmo; i++) {
            const angle = (i / this.maxAmmo) * Math.PI * 2 + orbitTime;
            const px = this.x + Math.cos(angle) * (this.radius + 12);
            const py = this.y + Math.sin(angle) * (this.radius + 12);
            ctx.fillStyle = i < this.ammo ? '#fff' : '#444';
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Bullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 5);
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0; // Seconds until it stops
        this.stopped = false;
    }
    update(dt) {
        if (!this.stopped) {
            super.update(dt);
            this.life -= dt;
            if (this.life <= 0) {
                this.stopped = true;
                this.vx = 0;
                this.vy = 0;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.stopped ? '#888' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Enemy extends Entity {
    constructor(x, y, radius, hp, speed) {
        super(x, y, radius);
        this.type = 'normal';
        this.hp = hp;
        this.speed = speed;
        this.shootTimer = 0;
        this.bulletsToSpawn = [];
    }
    update(dt, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }
        super.update(dt);
        return false;
    }
    draw(ctx) {
        ctx.fillStyle = '#a5f';
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class SwarmerEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 15, 2, 140);
        this.type = 'swarmer';
        this.wobbleTime = Math.random() * Math.PI * 2;
    }
    update(dt, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.wobbleTime += dt * 5;

        if (dist > 0) {
            const angle = Math.atan2(dy, dx) + Math.sin(this.wobbleTime) * 0.5;
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        }
        Entity.prototype.update.call(this, dt);
        return false;
    }
    draw(ctx) {
        ctx.fillStyle = '#f0f';
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y - this.radius);
        ctx.fill();
    }
}

class SniperEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 2, 60);
        this.type = 'sniper';
        this.shootTimer = 3;
        this.state = 'move'; // move, aim, shoot
    }
    update(dt, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.shootTimer -= dt;

        if (this.shootTimer > 1) {
            this.state = 'move';
            if (dist > 200) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            } else if (dist < 150) {
                this.vx = -(dx / dist) * this.speed;
                this.vy = -(dy / dist) * this.speed;
            } else {
                this.vx = 0;
                this.vy = 0;
            }
        } else if (this.shootTimer > 0) {
            this.state = 'aim';
            this.vx = 0;
            this.vy = 0;
            this.aimAngle = Math.atan2(dy, dx);
        } else {
            this.state = 'shoot';
            this.bulletsToSpawn.push(new EnemyBullet(this.x, this.y, Math.cos(this.aimAngle) * 300, Math.sin(this.aimAngle) * 300));
            this.shootTimer = 4;
        }

        Entity.prototype.update.call(this, dt);
        return false;
    }
    draw(ctx) {
        ctx.fillStyle = '#0ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        if (this.state === 'aim') {
            ctx.strokeStyle = '#f00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(this.aimAngle) * 50, this.y + Math.sin(this.aimAngle) * 50);
            ctx.stroke();
        }
    }
}

class BruiserEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 8, 40);
        this.type = 'bruiser';
    }
    draw(ctx) {
        ctx.fillStyle = '#888';
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class SplitterEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 25, 4, 80);
        this.type = 'splitter';
    }
    draw(ctx) {
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.fill();
    }
}

class HazardEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 3, 50);
        this.type = 'hazard';
        this.shootTimer = 2;
    }
    update(dt, playerX, playerY) {
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = 3;
            this.bulletsToSpawn.push(new HazardBullet(this.x, this.y));
        }
        return super.update(dt, playerX, playerY);
    }
    draw(ctx) {
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(this.x + Math.cos((18 + i * 72) / 180 * Math.PI) * this.radius,
                       this.y - Math.sin((18 + i * 72) / 180 * Math.PI) * this.radius);
            ctx.lineTo(this.x + Math.cos((54 + i * 72) / 180 * Math.PI) * (this.radius / 2),
                       this.y - Math.sin((54 + i * 72) / 180 * Math.PI) * (this.radius / 2));
        }
        ctx.closePath();
        ctx.fill();
    }
}


class HazardBullet extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.life = 5;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 100, 0, ${Math.max(0, this.life) / 5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class EnemyBullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 6);
        this.vx = vx;
        this.vy = vy;
    }
    draw(ctx) {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputManager(this.canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.world = new World(this.canvas);
        this.vfx = new VFXSystem();
        if (typeof UIManager !== 'undefined') this.uiManager = new UIManager(this);

        this.state = 'TITLE';
        this.lastTime = performance.now();

        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(document.body);

        this.reset();
        this.ammoCollected = 0;

        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });

        requestAnimationFrame((time) => this.loop(time));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    reset() {
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.bullets = [];
        this.enemies = [];
        this.enemyBullets = [];
        this.score = 0;
        this.wave = 1;
        this.waveTimer = 0;
        this.spawnTimer = 0;
        this.bossWarningTimer = 0;
        this.particles = [];
        this.gameOverTimer = 0;
        this.world.reset(this.canvas.width, this.canvas.height);

        this.combo = new ComboSystem();
        this.upgradeSys = new UpgradeSystem();
        this.pickups = [];
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        if (this.state === 'PLAYING') {
            if (!this.vfx.updateHitStop(dt)) {
                this.update(dt);
            }
            this.vfx.update(dt);
        } else {
            this.update(dt);
        }
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.sound) this.sound.update(dt, this);
        if (this.state === 'SETTINGS' && this.uiManager) {
            this.uiManager.update(this.input);
            return;
        }
        if (this.state === 'TITLE') {
            if (this.uiManager && this.uiManager.updateTitle(this.input)) return;
            if (this.input.isShooting() || this.input.keys['Enter']) {
                this.sound.init();
                this.reset();
                this.state = 'PLAYING';
            }
            return;
        }

        if (this.state === 'UPGRADE') {
            if (this.input.keys['Digit1']) { this.sound.playUIButton(); this.upgradeSys.applyChoice(0, this.player); this.state = 'PLAYING'; this.input.keys['Digit1'] = false; }
            if (this.input.keys['Digit2']) { this.sound.playUIButton(); this.upgradeSys.applyChoice(1, this.player); this.state = 'PLAYING'; this.input.keys['Digit2'] = false; }
            if (this.input.keys['Digit3']) { this.sound.playUIButton(); this.upgradeSys.applyChoice(2, this.player); this.state = 'PLAYING'; this.input.keys['Digit3'] = false; }
            return;
        }

        if (this.state === 'PAUSED') {
            if (this.input.keys['Escape'] || this.input.isShooting()) {
                this.state = 'PLAYING';
            }
            return;
        }

        if (this.state === 'GAME_OVER') {
            this.gameOverTimer += dt;
            if (this.gameOverTimer > 1 && (this.input.isShooting() || this.input.keys['Enter'])) {
                this.state = 'TITLE';
            }
            return;
        }

        // --- PLAYING STATE ---

        this.world.update(dt, this.player, this.enemies);

        // Update Player
        this.player.update(dt, this.input);

        // Constrain player to screen
        this.player.x = Math.max(this.player.radius, Math.min(this.canvas.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.canvas.height - this.player.radius, this.player.y));

        // Player Shooting
        if (this.input.isShooting() && this.player.shootCooldown <= 0) {
            if (this.player.ammo <= 0) {
                this.sound.playEmptyClip();
                this.player.shootCooldown = 0.25;
            } else {
                const aim = this.input.getAim(this.player.x, this.player.y);
                const dx = aim.x - this.player.x;
                const dy = aim.y - this.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 600; // Increased bullet speed

                const dirX = dx / dist;
                const dirY = dy / dist;

                this.bullets.push(new Bullet(this.player.x, this.player.y, dirX * speed, dirY * speed));
                this.player.ammo--;
                this.player.shootCooldown = 0.25;
                this.player.recoilTimer = 0.1;

                // Add physical recoil to player momentum
                this.player.vx -= dirX * 200;
                this.player.vy -= dirY * 200;

                if (this.vfx) {
                    this.vfx.triggerShake(0.1, 2);
                    this.vfx.emitParticles(this.player.x, this.player.y, 5, '#e2fc7a', 150, dirX, dirY, 0.2);
                }

                this.sound.playShoot();
            }
        }

        // Bullet Retrieval & Update
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(dt);

            // Constrain bullets
            b.x = Math.max(0, Math.min(this.canvas.width, b.x));
            b.y = Math.max(0, Math.min(this.canvas.height, b.y));

            if (b.stopped) {
                const dx = b.x - this.player.x;
                const dy = b.y - this.player.y;
                if (dx * dx + dy * dy < (this.player.radius + b.radius + 10) ** 2) {
                    if (this.player.ammo < this.player.maxAmmo) {
                        this.player.ammo++;
                        this.ammoCollected++;
                        if (this.ammoCollected >= 50 && !this.saveManager.data.milestones.ammoHoarder) {
                            this.saveManager.data.milestones.ammoHoarder = true;
                            this.saveManager.save();
                        }
                        this.bullets.splice(i, 1);
                        if (this.player.ammo >= this.player.maxAmmo) {
                            this.sound.playReload();
                        } else {
                            this.sound.playPickup();
                        }
                    }
                }
            }
        }

        this.combo.update(dt);

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.update(dt);
            if (p.life <= 0) {
                this.pickups.splice(i, 1);
                continue;
            }
            const dx = p.x - this.player.x;
            const dy = p.y - this.player.y;
            if (dx * dx + dy * dy < (this.player.radius + p.radius) ** 2) {
                this.combo.add(30);
                this.pickups.splice(i, 1);
                this.sound.playPickup();
            }
        }

        // Spawn Enemies
        this.waveTimer += dt;
        this.spawnTimer -= dt;

        if (this.waveTimer > 10) {
            this.wave++;
            this.waveTimer = 0;

            if (this.wave >= 5 && !this.saveManager.data.milestones.survivor) {
                this.saveManager.data.milestones.survivor = true;
                this.saveManager.save();
            }

            // Trigger upgrade draft when surviving a wave
            this.state = 'UPGRADE';
            this.sound.playLevelUp();
            this.upgradeSys.rollChoices();
            this.bullets = [];

            if (this.wave % 5 === 0) {
                // Spawn boss
                this.bossWarningTimer = 3;
                const bossClass = Math.random() < 0.5 ? SandstormDjinn : BazaarOgre;
                this.enemies.push(new bossClass(this.canvas.width / 2, -50));
                this.sound.playBossSpawn();
            }
        }

        if (this.bossWarningTimer > 0) {
            this.bossWarningTimer -= dt;
        }

        if (this.spawnTimer <= 0 && this.enemies.length < 5 + this.wave) {
            this.spawnTimer = 2 - Math.min(this.wave * 0.1, 1.5);
            // Spawn random edge
            let sx, sy;
            if (Math.random() < 0.5) {
                sx = Math.random() < 0.5 ? -30 : this.canvas.width + 30;
                sy = Math.random() * this.canvas.height;
            } else {
                sx = Math.random() * this.canvas.width;
                sy = Math.random() < 0.5 ? -30 : this.canvas.height + 30;
            }

            const r = Math.random();
            if (r < 0.2) this.enemies.push(new SwarmerEnemy(sx, sy));
            else if (r < 0.4) this.enemies.push(new SniperEnemy(sx, sy));
            else if (r < 0.6) this.enemies.push(new BruiserEnemy(sx, sy));
            else if (r < 0.8) this.enemies.push(new SplitterEnemy(sx, sy));
            else this.enemies.push(new HazardEnemy(sx, sy));
        }

        // Update Enemies & Collisions
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const bossShot = e.update(dt, this.player.x, this.player.y);

            let spawnedBullet = false;
            while(e.bulletsToSpawn && e.bulletsToSpawn.length > 0) {
                this.enemyBullets.push(e.bulletsToSpawn.pop());
                spawnedBullet = true;
            }

            if (bossShot) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    this.enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150));
                }
                spawnedBullet = true;
            }
            if (spawnedBullet) {
                this.sound.playEnemyShoot();
            }

            // Check collision with moving bullets
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                if (!b.stopped) {
                    const dx = e.x - b.x;
                    const dy = e.y - b.y;
                    if (dx * dx + dy * dy < (e.radius + b.radius) ** 2) {
                        e.hp--;
                        b.stopped = true; // Bullet drops on hit
                        this.sound.playHit();
                        if (this.vfx) {
                            this.vfx.triggerHitStop(0.02);
                            this.vfx.emitParticles(e.x, e.y, 5, '#fff', 200, b.vx, b.vy, 0.5);
                            this.vfx.addFloatingText(e.x, e.y - 10, '1', '#fff', 0.5, 12);
                        }
                        break;
                    }
                }
            }

            // Check collision with player (respect invulnerability)
            if (this.player.invulnTimer <= 0) {
                const dx = e.x - this.player.x;
                const dy = e.y - this.player.y;
                if (dx * dx + dy * dy < (e.radius + this.player.radius) ** 2) {
                    if (this.vfx) {
                        this.vfx.triggerHitStop(0.5);
                        this.vfx.triggerShake(0.5, 10);
                        this.vfx.emitParticles(this.player.x, this.player.y, 30, '#f00', 300, 0, 0, Math.PI * 2);
                    }
                    this.endGame();
                }
            }

            if (e.hp <= 0) {
                const pts = (e.type === 'boss' ? 500 : 10) * this.combo.multiplier;
                this.score += pts;
                this.combo.add(e.type === 'boss' ? 50 : 15);

                if (!this.saveManager.data.milestones.firstBlood) {
                    this.saveManager.data.milestones.firstBlood = true;
                    this.saveManager.save();
                }

                if (e.type === 'boss' && !this.saveManager.data.milestones.bossSlayer) {
                    this.saveManager.data.milestones.bossSlayer = true;
                    this.saveManager.save();
                }

                if (this.vfx) {
                    this.vfx.triggerShake(e.type === 'boss' ? 0.3 : 0.05, e.type === 'boss' ? 8 : 2);
                    if (e.type === 'boss') this.vfx.triggerHitStop(0.2);
                    this.vfx.emitParticles(e.x, e.y, e.type === 'boss' ? 50 : 15, e.type === 'boss' ? '#f55' : '#aaa', 300, 0, 0, Math.PI * 2);
                    this.vfx.addFloatingText(e.x, e.y, `+${pts}`, '#e2fc7a', 1.0, e.type === 'boss' ? 24 : 16);
                }

                if (Math.random() < 0.3) {
                    this.pickups.push(new ComboPickup(e.x, e.y));
                }
                if (e.type === 'splitter') {
                    const s1 = new SwarmerEnemy(e.x - 20, e.y);
                    const s2 = new SwarmerEnemy(e.x + 20, e.y);
                    this.enemies.push(s1, s2);
                }
                this.enemies.splice(i, 1);
            }
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const eb = this.enemyBullets[i];
            eb.update(dt);

            if (eb.life !== undefined && eb.life <= 0) {
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (this.player.invulnTimer <= 0) {
                const dx = eb.x - this.player.x;
                const dy = eb.y - this.player.y;
                if (dx * dx + dy * dy < (eb.radius + this.player.radius) ** 2) {
                    if (this.vfx) {
                        this.vfx.triggerHitStop(0.5);
                        this.vfx.triggerShake(0.5, 10);
                        this.vfx.emitParticles(this.player.x, this.player.y, 30, '#f00', 300, 0, 0, Math.PI * 2);
                    }
                    this.endGame();
                }
            }

            if (eb.x < 0 || eb.x > this.canvas.width || eb.y < 0 || eb.y > this.canvas.height) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    endGame() {
        this.state = 'GAME_OVER';
        this.gameOverTimer = 0;
        this.saveManager.data.gamesPlayed++;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
            if (this.score >= 50000 && !this.saveManager.data.milestones.rich) {
                this.saveManager.data.milestones.rich = true;
            }
        }
        this.saveManager.save();
    }

    draw() {
        let hc = this.saveManager.data.settings.highContrast;
        this.ctx.fillStyle = hc ? '#000' : '#1a1515'; // Desert night
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
            this.ctx.translate(this.vfx.shakeX, this.vfx.shakeY);
        }

        this.world.drawBackground(this.ctx, this.canvas);

        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
            this.vfx.drawBottom(this.ctx);
        }

        this.pickups.forEach(p => p.draw(this.ctx));
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.enemyBullets.forEach(eb => eb.draw(this.ctx));
        this.player.draw(this.ctx);

        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
            this.vfx.drawTop(this.ctx);
        }

        this.world.drawForeground(this.ctx, this.canvas);
        this.ctx.restore();

        // UI
        this.ctx.fillStyle = hc ? '#fff' : '#e2fc7a';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';

        if (this.state === 'TITLE') {
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText('BAZAAR BULLET RETRIEVAL', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Click or Press Enter to Start', this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.font = '16px monospace';
            this.ctx.fillText('Move: WASD / Joystick. Shoot: Mouse / Button.', this.canvas.width / 2, this.canvas.height / 2 + 60);
            this.ctx.fillText('RETRIEVE YOUR DROPPED AMMO!', this.canvas.width / 2, this.canvas.height / 2 + 90);
            if (this.uiManager) this.uiManager.drawTitleOverlay(this.ctx, this.canvas);
        } else if (this.state === 'SETTINGS') {
            if (this.uiManager) this.uiManager.drawSettings(this.ctx, this.canvas);
        } else if (this.state === 'PLAYING' || this.state === 'PAUSED') {
            this.ctx.fillText(`Score: ${this.score}`, 20, 30);
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 60);
            this.ctx.fillText(`Ammo: ${this.player.ammo}/${this.player.maxAmmo}`, 20, 90);

            // Dash Cooldown HUD
            this.ctx.fillText(`Dash: ${this.player.dashCooldown > 0 ? this.player.dashCooldown.toFixed(1) + 's' : 'READY'}`, 20, 120);

            // Visual Dash Cooldown Bar
            this.ctx.strokeStyle = '#444';
            this.ctx.strokeRect(20, 130, 100, 10);
            if (this.player.dashCooldown <= 0) {
                this.ctx.fillStyle = '#e2fc7a';
                this.ctx.fillRect(20, 130, 100, 10);
            } else {
                this.ctx.fillStyle = '#f55';
                this.ctx.fillRect(20, 130, 100 * (1 - this.player.dashCooldown / this.player.dashCooldownMax), 10);
            }

            // Boss Warning Banner
            if (this.bossWarningTimer > 0) {
                if (Math.floor(this.bossWarningTimer * 10) % 2 === 0) {
                    this.ctx.fillStyle = '#f00';
                    this.ctx.fillRect(0, this.canvas.height / 2 - 40, this.canvas.width, 80);
                    this.ctx.fillStyle = '#fff';
                    this.ctx.textAlign = 'center';
                    this.ctx.font = '30px monospace';
                    this.ctx.fillText('WARNING: BOSS APPROACHING', this.canvas.width / 2, this.canvas.height / 2 + 10);
                }
            }

            // Boss Health Bar
            const activeBoss = this.enemies.find(e => e.type === 'boss');
            if (activeBoss) {
                const barWidth = this.canvas.width * 0.6;
                const barHeight = 20;
                const barX = (this.canvas.width - barWidth) / 2;
                const barY = 30;

                this.ctx.fillStyle = '#444';
                this.ctx.fillRect(barX, barY, barWidth, barHeight);
                this.ctx.fillStyle = activeBoss.phase === 2 ? '#f00' : '#f55';
                this.ctx.fillRect(barX, barY, barWidth * (activeBoss.hp / activeBoss.maxHp), barHeight);

                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.font = '16px monospace';
                this.ctx.fillText(activeBoss.name, this.canvas.width / 2, barY + 15);
            }

            this.combo.draw(this.ctx, this.canvas.width);

            if (this.saveManager.data.settings.fpsCounter) {
                const fps = Math.round(1000 / (performance.now() - this.lastTime || 16));
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`FPS: ${fps}`, this.canvas.width - 20, 20);
                this.ctx.textAlign = 'left';
            }

            // Draw Touch Controls based on mode
            let tm = this.saveManager.data.settings.touchMode;
            if (tm === 'Always' || (tm === 'Auto' && 'ontouchstart' in window)) {
                let swap = this.saveManager.data.settings.touchSwap;
                this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
                this.ctx.beginPath();
                this.ctx.arc(swap ? this.canvas.width * 0.75 : this.canvas.width * 0.25, this.canvas.height * 0.75, 50, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(swap ? this.canvas.width * 0.25 : this.canvas.width * 0.75, this.canvas.height * 0.75, 50, 0, Math.PI*2);
                this.ctx.fill();
            }

            if (this.state === 'PAUSED') {
                this.ctx.textAlign = 'center';
                this.ctx.font = '40px monospace';
                this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
            }
        } else if (this.state === 'UPGRADE') {
            this.upgradeSys.draw(this.ctx, this.canvas.width, this.canvas.height);
        } else if (this.state === 'GAME_OVER') {
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillStyle = '#f55';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.fillStyle = '#e2fc7a';
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
            if (this.gameOverTimer > 1) {
                this.ctx.fillText('Click or Press Enter to Restart', this.canvas.width / 2, this.canvas.height / 2 + 80);
            }
            if (this.uiManager) this.uiManager.drawMilestones(this.ctx, this.canvas);
        }
    }
}

window.onload = () => {
    window.game = new Game();
};
