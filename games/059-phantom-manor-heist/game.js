class InputManager {
    constructor() {
        this.keys = {};
        this.touch = { active: false, x: 0, y: 0, tap: false, action: false, dash: false, startX: 0, startY: 0 };
        window.addEventListener('keydown', e => { this.keys[e.code] = true; });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });
        window.addEventListener('touchstart', e => this.handleTouchStart(e), {passive: false});
        window.addEventListener('touchmove', e => this.handleTouchMove(e), {passive: false});
        window.addEventListener('touchend', e => this.handleTouchEnd(e), {passive: false});
        window.addEventListener('mousedown', () => this.touch.tap = true);
        window.addEventListener('mouseup', () => this.touch.tap = false);
    }
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (touch.clientX > window.innerWidth / 2) {
            if (touch.clientY < window.innerHeight / 2) {
                this.touch.dash = true;
            } else {
                this.touch.action = true;
                this.touch.tap = true;
            }
        } else {
            this.touch.active = true;
            this.touch.startX = touch.clientX;
            this.touch.startY = touch.clientY;
            this.touch.x = 0;
            this.touch.y = 0;
        }
    }
    handleTouchMove(e) {
        e.preventDefault();
        if (!this.touch.active) return;
        for(let i=0; i<e.touches.length; i++) {
            const touch = e.touches[i];
            if (touch.clientX < window.innerWidth / 2) {
                this.touch.x = touch.clientX - this.touch.startX;
                this.touch.y = touch.clientY - this.touch.startY;
                const max = 50;
                const len = Math.hypot(this.touch.x, this.touch.y);
                if (len > max) {
                    this.touch.x = (this.touch.x / len) * max;
                    this.touch.y = (this.touch.y / len) * max;
                }
            }
        }
    }
    handleTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.clientX > window.innerWidth / 2) {
                this.touch.action = false;
                this.touch.tap = false;
                this.touch.dash = false;
            } else {
                this.touch.active = false;
                this.touch.x = 0;
                this.touch.y = 0;
            }
        }
    }
    getDir() {
        let dx = 0, dy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        if (this.touch.active) {
            if (Math.abs(this.touch.x) > 10) dx = Math.sign(this.touch.x);
            if (Math.abs(this.touch.y) > 10) dy = Math.sign(this.touch.y);
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) { dx /= len; dy /= len; }
        return {dx, dy};
    }
    consumeAction() {
        if (this.keys['Space'] || this.touch.action) {
            this.keys['Space'] = false;
            this.touch.action = false;
            return true;
        }
        return false;
    }
    consumeDash() {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touch.dash) {
            this.keys['ShiftLeft'] = false;
            this.keys['ShiftRight'] = false;
            this.touch.dash = false;
            return true;
        }
        return false;
    }
    consumeTap() {
        if (this.touch.tap || this.keys['Enter'] || this.keys['Space']) {
            this.touch.tap = false;
            this.keys['Enter'] = false;
            this.keys['Space'] = false;
            return true;
        }
        return false;
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.ready = false;
    }
    init() {
        if (this.ready) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 1.0;
        this.sfxGain.connect(this.masterGain);
        this.ready = true;
    }
    playTone(freq, type, duration, vol=1) {
        if (!this.ready) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playLoot() { this.playTone(800, 'sine', 0.1, 0.5); setTimeout(()=>this.playTone(1200, 'sine', 0.2, 0.5), 50); }
    playEcho() { this.playTone(300, 'triangle', 0.3, 0.4); }
    playSpotted() { this.playTone(150, 'sawtooth', 0.4, 0.8); }
}

class SaveManager {
    constructor() {
        this.key = 'arcade_game_059_059-phantom-manor-heist_v1';
        this.data = this.load();
    }
    load() {
        try {
            const str = localStorage.getItem(this.key);
            if (str) return JSON.parse(str);
        } catch (e) { console.error('Save load failed', e); }
        return { highScore: 0, totalGamesPlayed: 0 };
    }
    save() {
        try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
        catch (e) { console.error('Save failed', e); }
    }
}

class Player {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 12;
        this.vx = 0; this.vy = 0;
        this.accel = 1200; this.maxSpeed = 200; this.friction = 0.85;
        this.echo = null;
        this.color = '#fff';
        this.dashCooldown = 0;
        this.dashCooldownMax = 3.0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.recoil = 0;
        this.trail = [];
        this.aimAngle = 0;
        this.invulnTimer = 0; this.speedBuffTimer = 0; this.baseSpeedMod = 0; this.baseDashCdMod = 0;
    }
    update(dt, input, walls) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) this.isDashing = false;
        }
        if (this.recoil > 0) this.recoil -= dt * 5;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        const dir = input.getDir();
        if (dir.dx !== 0 || dir.dy !== 0) {
            this.aimAngle = Math.atan2(dir.dy, dir.dx);
            if (!this.isDashing) {
                this.vx += dir.dx * this.accel * dt;
                this.vy += dir.dy * this.accel * dt;
            }
        }

        if (input.consumeDash() && this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashTimer = 0.2;
            this.invulnTimer = 0.2;
            this.dashCooldown = Math.max(0.5, this.dashCooldownMax + this.baseDashCdMod);
            this.vx = Math.cos(this.aimAngle) * 800;
            this.vy = Math.sin(this.aimAngle) * 800;
            this.recoil = 1.0;
        }

        if (!this.isDashing) {
            this.vx *= Math.pow(this.friction, dt * 60);
            this.vy *= Math.pow(this.friction, dt * 60);
            if(this.speedBuffTimer > 0) this.speedBuffTimer -= dt;
            const speed = Math.hypot(this.vx, this.vy);
            let currentMax = this.maxSpeed + this.baseSpeedMod + (this.speedBuffTimer > 0 ? 100 : 0);
            if (speed > currentMax) {
                this.vx = (this.vx / speed) * currentMax;
                this.vy = (this.vy / speed) * currentMax;
            }
        }

        let nx = this.x + this.vx * dt;
        let ny = this.y + this.vy * dt;

        let cx = false, cy = false;
        for (let w of walls) {
            if (nx + this.radius > w.x && nx - this.radius < w.x + w.w && this.y + this.radius > w.y && this.y - this.radius < w.y + w.h) cx = true;
            if (this.x + this.radius > w.x && this.x - this.radius < w.x + w.w && ny + this.radius > w.y && ny - this.radius < w.y + w.h) cy = true;
        }
        if (!cx) { this.x = nx; } else { this.vx = 0; }
        if (!cy) { this.y = ny; } else { this.vy = 0; }

        if (this.isDashing || Math.hypot(this.vx, this.vy) > 50) {
            this.trail.push({x: this.x, y: this.y, life: 0.2});
        }
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].life -= dt;
            if (this.trail[i].life <= 0) this.trail.splice(i, 1);
        }

        if (input.consumeAction()) {
            if (this.echo) {
                this.echo = null;
            } else {
                this.echo = new Echo(this.x, this.y);
            }
        }
    }
    draw(ctx) {
        for (let t of this.trail) {
            ctx.fillStyle = `rgba(100, 200, 255, ${t.life * 2})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.radius * 0.8 * (t.life / 0.2), 0, Math.PI*2);
            ctx.fill();
        }

        let currentScale = 1.0 + Math.sin(this.recoil * Math.PI) * 0.3;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.aimAngle);
        ctx.scale(currentScale, currentScale);

        if (Math.hypot(this.vx, this.vy) > 20 && !this.isDashing) {
            ctx.fillStyle = '#f80';
            ctx.beginPath();
            ctx.moveTo(-this.radius, -this.radius*0.5);
            ctx.lineTo(-this.radius - 10 * Math.random(), 0);
            ctx.lineTo(-this.radius, this.radius*0.5);
            ctx.fill();
        }

        if (this.invulnTimer > 0) {
            ctx.fillStyle = (Math.floor(Date.now() / 50) % 2 === 0) ? '#fff' : '#0ff';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#0ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(this.radius + 15, -5);
        ctx.lineTo(this.radius + 15, 5);
        ctx.fill();

        ctx.restore();
    }
}

class Echo {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 12; this.speed = 150;
        this.active = true;
        this.color = 'rgba(173, 166, 185, 0.6)';
        this.noise = 0;
        this.isDashing = false;
        this.invulnTimer = 0; this.speedBuffTimer = 0; this.baseSpeedMod = 0; this.baseDashCdMod = 0;
    }
    update(dt, input, walls) {
        // Echo moves opposite to player
        const dir = input.getDir();
        let nx = this.x - dir.dx * this.speed * dt;
        let ny = this.y - dir.dy * this.speed * dt;

        let cx = false, cy = false;
        for (let w of walls) {
            if (nx + this.radius > w.x && nx - this.radius < w.x + w.w && this.y + this.radius > w.y && this.y - this.radius < w.y + w.h) cx = true;
            if (this.x + this.radius > w.x && this.x - this.radius < w.x + w.w && ny + this.radius > w.y && ny - this.radius < w.y + w.h) cy = true;
        }
        if (!cx) this.x = nx;
        if (!cy) this.y = ny;
        this.noise += dt * 5;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + Math.sin(this.noise)*2, 0, Math.PI*2);
        ctx.fill();
    }
}

class Guard {
    constructor(x, y, waypoints) {
        this.x = x; this.y = y; this.radius = 14;
        this.waypoints = waypoints;
        this.wpIdx = 0;
        this.speed = 80;
        this.color = '#d33';
        this.viewDist = 150;
        this.viewAngle = Math.PI / 3;
        this.angle = 0;
        this.state = 'patrol'; // patrol, chase
        this.target = null;
    }
    update(dt, player, walls) {
        if (this.state === 'patrol') {
            const wp = this.waypoints[this.wpIdx];
            const dx = wp.x - this.x;
            const dy = wp.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 5) {
                this.wpIdx = (this.wpIdx + 1) % this.waypoints.length;
            } else {
                this.angle = Math.atan2(dy, dx);
                this.x += Math.cos(this.angle) * this.speed * dt;
                this.y += Math.sin(this.angle) * this.speed * dt;
            }

            // Vision check
            if (this.canSee(player, walls)) {
                this.state = 'chase';
                this.target = player;
                return true; // spotted!
            }
            if (player.echo && this.canSee(player.echo, walls)) {
                this.state = 'chase';
                this.target = player.echo;
                return true;
            }
        } else if (this.state === 'chase' && this.target) {
            // Guard against stale echo reference if echo was recalled
            if (this.target !== player && this.target !== player.echo) {
                this.state = 'patrol';
                this.target = null;
                return false;
            }
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * 1.5 * dt;
            this.y += Math.sin(this.angle) * this.speed * 1.5 * dt;

            if (Math.hypot(dx, dy) < this.radius + this.target.radius) {
                if (!this.target.isDashing && this.target.invulnTimer <= 0) {
                    return 'caught';
                }
            }
        }
        return false;
    }
    canSee(target, walls) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.viewDist) return false;

        const angleToTarget = Math.atan2(dy, dx);
        let adiff = Math.abs(angleToTarget - this.angle);
        while (adiff > Math.PI) adiff -= Math.PI*2;
        adiff = Math.abs(adiff);

        if (adiff > this.viewAngle/2) return false;

        // Raycast
        for (let w of walls) {
            if (this.lineRectIntersect(this.x, this.y, target.x, target.y, w.x, w.y, w.w, w.h)) return false;
        }
        return true;
    }
    lineRectIntersect(x1, y1, x2, y2, rx, ry, rw, rh) {
        const left = this.lineLine(x1,y1,x2,y2, rx,ry,rx,ry+rh);
        const right = this.lineLine(x1,y1,x2,y2, rx+rw,ry,rx+rw,ry+rh);
        const top = this.lineLine(x1,y1,x2,y2, rx,ry,rx+rw,ry);
        const bottom = this.lineLine(x1,y1,x2,y2, rx,ry+rh,rx+rw,ry+rh);
        return left || right || top || bottom;
    }
    lineLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();

        // View cone
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, this.viewDist, this.angle - this.viewAngle/2, this.angle + this.viewAngle/2);
        ctx.fill();
    }
}

class Pickup {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type; this.radius = 12; this.active = true;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.type === 'speed' ? '#0ff' : (this.type === 'invuln' ? '#f0f' : '#ff0');
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline='middle';
        ctx.fillText(this.type === 'speed' ? 'S' : (this.type === 'invuln' ? 'I' : 'M'), this.x, this.y);
    }
}

class Loot {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 8; this.active = true; }
    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = '#fd0';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputManager();
        this.sound = new SoundEngine();
        this.save = new SaveManager();
        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER

        this.lastTime = performance.now();
        this.resize();

        const observer = new ResizeObserver(() => this.resize());
        observer.observe(document.body);


        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });

        this.score = 0;
        requestAnimationFrame((t) => this.loop(t));
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    generateDraftChoices() {
        const pool = [
            {id: 'speed', name: 'Swiftness', desc: '+20 Base Speed'},
            {id: 'dash_cd', name: 'Agility', desc: '-0.5s Dash Cooldown'},
            {id: 'combo_time', name: 'Momentum', desc: '+1.0s Combo Time'},
            {id: 'loot_score', name: 'Greed', desc: '+50 Base Loot Score'},
            {id: 'boss_dmg', name: 'Boss Slayer', desc: '+1 Boss Damage'},
            {id: 'pickup_freq', name: 'Scavenger', desc: 'More frequent pickups'},
            {id: 'shield', name: 'Shielding', desc: 'Start wave with 5s Invuln'},
            {id: 'echo_rad', name: 'Ghostly Reach', desc: '+10 Echo Pickup Radius'}
        ];
        pool.sort(() => Math.random() - 0.5);
        return pool.slice(0, 3);
    }
    applyUpgrade(id) {
        if (id === 'speed') this.player.baseSpeedMod += 20;
        if (id === 'dash_cd') this.player.baseDashCdMod -= 0.5;
        if (id === 'combo_time') this.maxComboTimer += 1.0;
        if (id === 'loot_score') this.baseLootScore += 50;
        if (id === 'boss_dmg') this.bossDamageMod += 1;
        if (id === 'pickup_freq') this.pickupSpawnRateMod += 2.0;
        if (id === 'shield') this.player.invulnTimer = 5.0;
        if (id === 'echo_rad') this.echoRadiusMod += 10;
    }
    reset() {
        this.score = 0;
        this.wave = 1;
        this.activeBoss = null;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.maxComboTimer = 3.0;
        this.pickups = [];
        this.pickupTimer = 10.0;
        this.baseLootScore = 100;
        this.bossDamageMod = 0;
        this.pickupSpawnRateMod = 0;
        this.echoRadiusMod = 0;
        this.hazards = [];
        this.player = new Player(100, 100);
        this.world = new World();
        this.ambientDust = new AmbientDust();
        this.cx = 0;
        this.cy = 0;
        this.baseWalls = [
            {x: 200, y: 100, w: 20, h: 300},
            {x: 400, y: 200, w: 300, h: 20},
            {x: 0, y: 0, w: window.innerWidth, h: 20},
            {x: 0, y: window.innerHeight-20, w: window.innerWidth, h: 20},
            {x: 0, y: 0, w: 20, h: window.innerHeight},
            {x: window.innerWidth-20, y: 0, w: 20, h: window.innerHeight}
        ];
        this.walls = [...this.baseWalls];
        this.guards = [
            new Swarmer(300, 100, [{x:300, y:100}, {x:300, y:400}]),
            new Sniper(600, 400, [{x:600, y:400}, {x:600, y:100}]),
            new Bruiser(800, 200, [{x:800, y:200}, {x:800, y:600}]),
            new Spawner(100, 500, [{x:100, y:500}, {x:500, y:500}]),
            new HazardEnemy(400, 300, [{x:400, y:300}, {x:700, y:300}])
        ];
        this.loot = [
            new Loot(150, 400), new Loot(500, 150), new Loot(700, 300)
        ];
        this.sound.playEcho();
    }
    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        // initialize audio on first input
        if (!this.sound.ready && (this.input.keys['Space'] || this.input.touch.tap)) {
            this.sound.init();
        }

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
    update(dt) {
        if (this.state === 'TITLE') {
            if (this.input.consumeTap()) {
                this.save.data.totalGamesPlayed++;
                this.save.save();
                this.reset();
                this.state = 'PLAYING';
            }
        } else if (this.state === 'PLAYING') {
            if (this.input.keys['Escape'] || this.input.keys['KeyP']) {
                this.input.keys['Escape'] = false;
                this.input.keys['KeyP'] = false;
                this.state = 'PAUSED';
            }

            this.walls = [...this.baseWalls, ...this.world.movingWalls];
            this.world.update(dt, this.player, this.guards, this.walls);
            this.ambientDust.update(dt);

            this.player.update(dt, this.input, this.walls);
            if (this.player.echo) this.player.echo.update(dt, this.input, this.walls);

            if (this.comboTimer > 0) {
                this.comboTimer -= dt;
                if (this.comboTimer <= 0) this.comboMultiplier = 1;
            }
            this.pickupTimer -= dt;
            if (this.pickupTimer <= 0) {
                this.pickupTimer = Math.max(3.0, 15.0 - this.pickupSpawnRateMod);
                const types = ['speed', 'invuln', 'multiplier'];
                this.pickups.push(new Pickup(50 + Math.random()*(window.innerWidth-100), 50 + Math.random()*(window.innerHeight-100), types[Math.floor(Math.random()*types.length)]));
            }
            for (let i = this.pickups.length - 1; i >= 0; i--) {
                let p = this.pickups[i];
                if (Math.hypot(this.player.x - p.x, this.player.y - p.y) < this.player.radius + p.radius) {
                    if (p.type === 'speed') this.player.speedBuffTimer = 5.0;
                    if (p.type === 'invuln') this.player.invulnTimer = 3.0;
                    if (p.type === 'multiplier') { this.comboMultiplier++; this.comboTimer = this.maxComboTimer; }
                    this.pickups.splice(i, 1);
                    this.sound.playLoot();
                }
            }
            for (let i = this.hazards.length - 1; i >= 0; i--) {
                this.hazards[i].life -= dt;
                if (this.hazards[i].life <= 0) {
                    this.hazards.splice(i, 1);
                    continue;
                }
                const h = this.hazards[i];
                if (h.type === 'blast') {
                    h.radius += 100 * dt;
                    if (Math.hypot(this.player.x - h.x, this.player.y - h.y) < h.radius + this.player.radius && this.player.invulnTimer <= 0) {
                        this.state = 'GAME_OVER';
                        if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
                    }
                    if (this.player.echo && Math.hypot(this.player.echo.x - h.x, this.player.echo.y - h.y) < h.radius + this.player.echo.radius) {
                        this.player.echo = null;
                    }
                } else if (h.type === 'zone') {
                    if (Math.hypot(this.player.x - h.x, this.player.y - h.y) < h.radius + this.player.radius && this.player.invulnTimer <= 0) {
                        this.state = 'GAME_OVER';
                        if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
                    }
                }
            }

            if (this.activeBoss) {
                const res = this.activeBoss.update(dt, this.player, this.walls, this.hazards);
                if (res === 'caught') {
                    this.state = 'GAME_OVER';
                    if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
                }
            }

            this.cx += (this.player.x - window.innerWidth/2 - this.cx) * 5 * dt;
            this.cy += (this.player.y - window.innerHeight/2 - this.cy) * 5 * dt;

            let guardSpotted = false;
            for (let g of this.guards) {
                const res = g.update(dt, this.player, this.walls);
                if (res === true && g.state === 'chase' && !guardSpotted) {
                    this.sound.playSpotted();
                    guardSpotted = true;
                    } else if (res === 'spawn_swarmer') {
                        let newWP = [{x: g.x + 50, y: g.y}, {x: g.x - 50, y: g.y}];
                        let swarmer = new Swarmer(g.x, g.y, newWP);
                        swarmer.state = 'chase';
                        swarmer.target = g.target;
                        this.guards.push(swarmer);
                } else if (res === 'caught') {
                    this.state = 'GAME_OVER';
                    if (this.score > this.save.data.highScore) {
                        this.save.data.highScore = this.score;
                        this.save.save();
                    }
                }
            }

            for (let p of this.pickups) p.draw(this.ctx);
            for (let l of this.loot) {
                if (l.active) {
                    if (Math.hypot(this.player.x - l.x, this.player.y - l.y) < this.player.radius + l.radius) {
                        l.active = false;
                        this.score += this.baseLootScore * this.comboMultiplier;
                        this.comboMultiplier++;
                        this.comboTimer = this.maxComboTimer;
                        this.sound.playLoot();
                        if (this.activeBoss && !this.activeBoss.isSpawning && !this.activeBoss.isTransitioning) {
                            this.activeBoss.hp -= (1 + this.bossDamageMod);
                            if (this.activeBoss.hp > 0) {
                                l.x = 50 + Math.random() * (window.innerWidth - 100);
                                l.y = 50 + Math.random() * (window.innerHeight - 100);
                                l.active = true;
                            } else {
                                this.score += 5000 * this.comboMultiplier;
                                this.comboMultiplier += 5;
                                this.comboTimer = this.maxComboTimer;
                                this.activeBoss = null;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.maxComboTimer = 3.0;
        this.pickups = [];
        this.pickupTimer = 10.0;
        this.baseLootScore = 100;
        this.bossDamageMod = 0;
        this.pickupSpawnRateMod = 0;
        this.echoRadiusMod = 0;
                            }
                        }
                    }
                    if (this.player.echo && Math.hypot(this.player.echo.x - l.x, this.player.echo.y - l.y) < this.player.echo.radius + l.radius) {
                        l.active = false;
                        this.score += this.baseLootScore * this.comboMultiplier;
                        this.comboMultiplier++;
                        this.comboTimer = this.maxComboTimer;
                        this.sound.playLoot();
                        if (this.activeBoss && !this.activeBoss.isSpawning && !this.activeBoss.isTransitioning) {
                            this.activeBoss.hp -= (1 + this.bossDamageMod);
                            if (this.activeBoss.hp > 0) {
                                l.x = 50 + Math.random() * (window.innerWidth - 100);
                                l.y = 50 + Math.random() * (window.innerHeight - 100);
                                l.active = true;
                            } else {
                                this.score += 5000 * this.comboMultiplier;
                                this.comboMultiplier += 5;
                                this.comboTimer = this.maxComboTimer;
                                this.activeBoss = null;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.maxComboTimer = 3.0;
        this.pickups = [];
        this.pickupTimer = 10.0;
        this.baseLootScore = 100;
        this.bossDamageMod = 0;
        this.pickupSpawnRateMod = 0;
        this.echoRadiusMod = 0;
                            }
                        }
                    }
                }
            }

            if (this.loot.every(l => !l.active)) {
                this.state = 'UPGRADE_DRAFT';
                this.draftChoices = this.generateDraftChoices();
                // We keep the old brace logic balanced.
                // The actual wave setup is handled in UPGRADE_DRAFT state.
            } else if (false) { // Dummy block to consume the rest of old setup block if needed
                this.wave++;
                if (this.wave % 5 === 0) {
                    this.guards = [];
                    this.loot = [new Loot(window.innerWidth/2, window.innerHeight/2)];
                    this.activeBoss = this.wave % 10 === 0 ? new MirrorWraith(window.innerWidth/2, 100) : new SpectralWarden(window.innerWidth/2, 100);
                } else {
                    this.score += 500;
                    if (this.loot.length === 1) {
                        this.loot = [new Loot(150, 400), new Loot(500, 150), new Loot(700, 300)];
                    }
                    this.loot.forEach(l => {
                        l.x = 50 + Math.random() * (window.innerWidth - 100);
                        l.y = 50 + Math.random() * (window.innerHeight - 100);
                        l.active = true;
                    });
                    const types = [Swarmer, Sniper, Bruiser, Spawner, HazardEnemy];
                    const Type = types[Math.floor(Math.random()*types.length)];
                    this.guards.push(new Type(
                        window.innerWidth/2, window.innerHeight/2,
                        [{x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight},
                         {x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight}]
                    ));
                }
            }

                } else if (this.state === 'UPGRADE_DRAFT') {
            if (this.input.consumeTap()) {
                let w = window.innerWidth, h = window.innerHeight;
                let cardW = 200, cardH = 300, spacing = 50;
                let startX = w/2 - (cardW*3 + spacing*2)/2;
                let my = h/2;
                for (let i=0; i<3; i++) {
                    let cx = startX + i*(cardW+spacing) + cardW/2;
                    let cy = my;
                    if (Math.abs(this.input.touch.x - cx) < cardW/2 && Math.abs(this.input.touch.y - cy) < cardH/2) {
                        this.applyUpgrade(this.draftChoices[i].id);
                        this.wave++;
                        if (this.wave % 5 === 0) {
                            this.guards = [];
                            this.loot = [new Loot(window.innerWidth/2, window.innerHeight/2)];
                            this.activeBoss = this.wave % 10 === 0 ? new MirrorWraith(window.innerWidth/2, 100) : new SpectralWarden(window.innerWidth/2, 100);
                        } else {
                            this.score += 500;
                            if (this.loot.length === 1) {
                                this.loot = [new Loot(150, 400), new Loot(500, 150), new Loot(700, 300)];
                            }
                            this.loot.forEach(l => {
                                l.x = 50 + Math.random() * (window.innerWidth - 100);
                                l.y = 50 + Math.random() * (window.innerHeight - 100);
                                l.active = true;
                            });
                            const types = [Swarmer, Sniper, Bruiser, Spawner, HazardEnemy];
                            const Type = types[Math.floor(Math.random()*types.length)];
                            this.guards.push(new Type(
                                window.innerWidth/2, window.innerHeight/2,
                                [{x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight},
                                 {x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight}]
                            ));
                        }
                        this.state = 'PLAYING';
                    }
                }
            }
        } else if (this.state === 'PAUSED') {
            if (this.input.keys['Escape'] || this.input.keys['KeyP'] || this.input.consumeTap()) {
                this.input.keys['Escape'] = false;
                this.input.keys['KeyP'] = false;
                this.state = 'PLAYING';
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.input.consumeTap()) {
                this.state = 'TITLE';
            }
        }
    }
    draw() {
        if (this.state === 'UPGRADE_DRAFT') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Choose Upgrade', this.canvas.width/2, 100);

            let cardW = 200, cardH = 300, spacing = 50;
            let startX = this.canvas.width/2 - (cardW*3 + spacing*2)/2;
            let my = this.canvas.height/2;

            for (let i=0; i<3; i++) {
                let choice = this.draftChoices[i];
                let cx = startX + i*(cardW+spacing);
                let cy = my - cardH/2;
                this.ctx.fillStyle = '#334';
                this.ctx.fillRect(cx, cy, cardW, cardH);
                this.ctx.strokeStyle = '#ada6b9';
                this.ctx.strokeRect(cx, cy, cardW, cardH);

                this.ctx.fillStyle = '#ff0';
                this.ctx.font = '20px monospace';
                this.ctx.fillText(choice.name, cx + cardW/2, cy + 50);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '14px monospace';
                this.ctx.fillText(choice.desc, cx + cardW/2, cy + 150);
            }
        }

        if (this.state === 'TITLE' || !this.world) {
            this.ctx.fillStyle = '#1a1a24';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.world.drawBackground(this.ctx, this.cx, this.cy);
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#ada6b9';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Phantom Manor Heist', this.canvas.width/2, this.canvas.height/3);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Tap or Space to Start', this.canvas.width/2, this.canvas.height/2);
            this.ctx.fillText(`High Score: ${this.save.data.highScore}`, this.canvas.width/2, this.canvas.height/2 + 50);

        } else if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {

            this.ctx.save();
            this.ctx.translate(-this.cx, -this.cy);

            for (let w of this.walls) {
                this.ctx.fillStyle = '#334';
                this.ctx.fillRect(w.x, w.y, w.w, w.h);
            }

            for (let p of this.pickups) p.draw(this.ctx);
            for (let l of this.loot) {
                l.draw(this.ctx);
                if (l.active && this.activeBoss) {
                    this.ctx.fillStyle = '#ff0';
                    this.ctx.font = '12px monospace';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('BOSS ORB', l.x, l.y - 15);
                }
            }

            for (let h of this.hazards) {
                if (h.type === 'blast') {
                    this.ctx.strokeStyle = `rgba(255, 50, 50, ${h.life / 0.5})`;
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.arc(h.x, h.y, h.radius, 0, Math.PI*2);
                    this.ctx.stroke();
                } else if (h.type === 'zone') {
                    this.ctx.fillStyle = `rgba(150, 0, 255, 0.4)`;
                    this.ctx.beginPath();
                    this.ctx.arc(h.x, h.y, h.radius, 0, Math.PI*2);
                    this.ctx.fill();
                }
            }

            for (let g of this.guards) g.draw(this.ctx);

            if (this.activeBoss) {
                this.activeBoss.draw(this.ctx);
            }

            if (this.player.echo) this.player.echo.draw(this.ctx);
            this.player.draw(this.ctx);

            this.ambientDust.draw(this.ctx);

            this.ctx.restore();

            if (this.activeBoss) {
                this.activeBoss.drawUI(this.ctx, window.innerWidth, window.innerHeight);
            }

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 20, 40);
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 90);
            this.ctx.fillText(`Combo: x${this.comboMultiplier}`, 20, 130);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fillRect(20, 140, 100, 10);
            this.ctx.fillStyle = '#ff0';
            this.ctx.fillRect(20, 140, 100 * (this.comboTimer / this.maxComboTimer), 10);

            let dashStatus = this.player.dashCooldown <= 0 ? 'READY' : this.player.dashCooldown.toFixed(1) + 's';
            this.ctx.fillStyle = this.player.dashCooldown <= 0 ? '#0ff' : '#888';
            this.ctx.fillText(`Dash (Shift): ${dashStatus}`, 20, 70);

            // Render extra HUD info
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fillRect(20, 80, 100, 10);
            this.ctx.fillStyle = '#0ff';
            let dashFill = 1;
            if (this.player.dashCooldown > 0) {
                dashFill = 1 - (this.player.dashCooldown / this.player.dashCooldownMax);
            }
            this.ctx.fillRect(20, 80, 100 * dashFill, 10);

            // Draw speed indicator
            const speed = Math.hypot(this.player.vx, this.player.vy);
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(`Vel: ${speed.toFixed(0)}`, 20, 110);

            // Draw state
            if (this.player.isDashing) {
                this.ctx.fillStyle = '#f0f';
                this.ctx.fillText('>>> DASHING <<<', 20, 140);
            }
            // Just one more simple helper
            if (this.player.invulnTimer > 0) {
                this.ctx.fillStyle = '#ff0';
                this.ctx.fillText('GHOST', 20, 170);
            }


            if (this.state === 'PAUSED') {
                this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
                this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('PAUSED', this.canvas.width/2, this.canvas.height/2);
            } else if (this.state === 'GAME_OVER') {
                this.ctx.fillStyle = 'rgba(100,0,0,0.7)';
                this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('CAUGHT!', this.canvas.width/2, this.canvas.height/2 - 30);
                this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width/2, this.canvas.height/2);
                this.ctx.fillText('Tap to return to Title', this.canvas.width/2, this.canvas.height/2 + 40);
            }
        }
    }
}
window.onload = () => { window.game = new Game(); };

// PREFLIGHT REQUIREMENT: Back to Arcade link.
const backLink = document.createElement('a');
backLink.href = '../../index.html';
backLink.textContent = 'Back to Arcade';
backLink.style.position = 'absolute';
backLink.style.top = '10px';
backLink.style.right = '10px';
backLink.style.color = '#fff';
backLink.style.fontFamily = 'monospace';
backLink.style.textDecoration = 'none';
backLink.id = 'backLink';
document.body.appendChild(backLink);

const originalLoop = Game.prototype.loop;
Game.prototype.loop = function(time) {
    if (this.state === 'PLAYING') backLink.style.display = 'none';
    else backLink.style.display = 'block';
    originalLoop.call(this, time);
};
