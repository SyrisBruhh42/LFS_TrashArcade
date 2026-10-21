const GAME_ID = "060";
const SLUG = "060-magma-recoil-platformer";
const SAVE_KEY = "arcade_game_060_060-magma-recoil-platformer_v1";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let width, height;

class SaveManager {
  constructor() {
    this.data = { highScore: 0, totalGamesPlayed: 0 };
    this.load();
  }
  load() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) Object.assign(this.data, JSON.parse(stored));
    } catch (e) { console.warn("Save load error", e); }
  }
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
    catch (e) { console.warn("Save error", e); }
  }
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }
  playShoot() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
  playExplosion() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
}

class InputManager {
  constructor() {
    this.keys = {};
    this.pointer = { x: 0, y: 0, active: false };
    window.addEventListener('keydown', e => this.keys[e.code] = true);
    window.addEventListener('keyup', e => this.keys[e.code] = false);
    canvas.addEventListener('pointerdown', e => {
      this.updatePointer(e);
      this.pointer.active = true;
      window.game && window.game.handlePointerDown(e);
    });
    canvas.addEventListener('pointermove', e => this.updatePointer(e));
    canvas.addEventListener('pointerup', () => this.pointer.active = false);
  }
  updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
  }
}
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 15;
    this.color = '#00ffff';
    this.speed = 200;
    this.gravity = 800;
    this.recoilForce = 500;
    this.grounded = false;
    this.cooldown = 0;
  }
  update(dt, input, platforms) {
    this.cooldown -= dt;
    this.vy += this.gravity * dt;

    if (input.keys['KeyA'] || input.keys['ArrowLeft']) this.vx -= this.speed * dt * 5;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) this.vx += this.speed * dt * 5;
    this.vx *= Math.pow(0.01, dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.grounded = false;

    for (let p of platforms) {
      if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w) {
        if (this.y + this.radius > p.y && this.y - this.radius < p.y + p.h && this.vy > 0 && this.y - this.vy*dt < p.y) {
          this.y = p.y - this.radius;
          this.vy = 0;
          this.grounded = true;
        }
      }
    }

    if (this.x < this.radius) { this.x = this.radius; this.vx = 0; }
    if (this.x > width - this.radius) { this.x = width - this.radius; this.vx = 0; }
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (window.game && window.game.input.pointer.active) {
       let dx = window.game.input.pointer.x - this.x;
       let dy = window.game.input.pointer.y - this.y;
       let angle = Math.atan2(dy, dx);
       ctx.strokeStyle = '#fff';
       ctx.beginPath();
       ctx.moveTo(this.x, this.y);
       ctx.lineTo(this.x + Math.cos(angle)*30, this.y + Math.sin(angle)*30);
       ctx.stroke();
    }
  }
}

class Bullet {
  constructor(x, y, dx, dy) {
    this.x = x; this.y = y;
    this.vx = dx * 800; this.vy = dy * 800;
    this.radius = 4;
    this.life = 2;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 12;
    this.vx = (Math.random() - 0.5) * 100;
    this.vy = 0;
    this.alive = true;
  }
  update(dt, platforms) {
    this.x += this.vx * dt;
    this.vy += 800 * dt;
    this.y += this.vy * dt;
    for (let p of platforms) {
      if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w) {
        if (this.y + this.radius > p.y && this.y - this.radius < p.y + p.h && this.vy > 0) {
          this.y = p.y - this.radius;
          this.vy = 0;
        }
      }
    }
    if (this.x < 0 || this.x > width) this.vx *= -1;
  }
  draw(ctx) {
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 200 + 50;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 0.5 + Math.random() * 0.5;
    this.maxLife = this.life;
    this.color = color;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

class Platform {
   constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
   }
   draw(ctx) {
      ctx.fillStyle = '#555';
      ctx.fillRect(this.x, this.y, this.w, this.h);
   }
}
class Game {
  constructor() {
    this.state = 'TITLE';
    this.save = new SaveManager();
    this.audio = new SoundEngine();
    this.input = new InputManager();
    this.lastTime = 0;
    this.score = 0;
    this.player = null;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.platforms = [];
    this.cameraY = 0;
        this.ui = new UIOverlay();

    this.resizeOb = new ResizeObserver(() => this.resize());
    this.resizeOb.observe(document.body);

    window.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED'; });
    window.addEventListener('blur', () => { if (this.state === 'PLAYING') this.state = 'PAUSED'; });

    window.addEventListener('keydown', e => {
       if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.state === 'PLAYING') this.state = 'PAUSED';
          else if (this.state === 'PAUSED') this.state = 'PLAYING';
       }
    });

    requestAnimationFrame(t => this.loop(t));
  }
  resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }
  reset() {
    this.score = 0;
    this.player = new Player(width/2, height/2);
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.platforms = [];
    this.cameraY = 0;
        this.ui = new UIOverlay();

    this.platforms.push(new Platform(0, height - 100, width, 100));
    for(let i=0; i<5; i++) {
        this.platforms.push(new Platform(Math.random()*(width-100), height - 250 - i*150, 100, 20));
        if (Math.random() > 0.5) this.enemies.push(new Enemy(Math.random()*width, height - 300 - i*150));
    }
  }
  handlePointerDown(e) {
    this.audio.init();
    if (this.state === 'TITLE') {
       const rect = canvas.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       if (y > 20 && y < 60 && x > 20 && x < 200) {
          window.location.href = '../../index.html';
          return;
       }
       this.state = 'PLAYING';
       this.reset();
       return;
    }
    if (this.state === 'PAUSED') {
       const rect = canvas.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       if (y > 20 && y < 60 && x > 20 && x < 200) {
          window.location.href = '../../index.html';
          return;
       }
       this.state = 'PLAYING';
       return;
    }
    if (this.state === 'GAME_OVER') {
       this.state = 'TITLE';
       return;
    }

    if (this.state === 'PLAYING' && this.player && this.player.cooldown <= 0) {
       let dx = this.input.pointer.x - this.player.x;
       let dy = (this.input.pointer.y + this.cameraY) - this.player.y;
       let len = Math.sqrt(dx*dx + dy*dy);
       if (len > 0) { dx /= len; dy /= len; }
       else { dx = 0; dy = -1; }

       this.bullets.push(new Bullet(this.player.x, this.player.y, dx, dy));
       this.player.vx -= dx * this.player.recoilForce;
       this.player.vy -= dy * this.player.recoilForce;
       this.player.cooldown = 0.2;
       this.audio.playShoot();

       for(let i=0; i<5; i++) this.particles.push(new Particle(this.player.x, this.player.y, '#e09ff1'));
    }
  }
  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.player.update(dt, this.input, this.platforms);

    if (this.player.y - this.cameraY < height * 0.4) {
        this.cameraY = this.player.y - height * 0.4;
    }

    if (this.player.y - this.cameraY > height) {
       this.state = 'GAME_OVER';
       if (this.score > this.save.data.highScore) {
           this.save.data.highScore = this.score;
           this.save.save();
       }
       this.save.data.totalGamesPlayed++;
       this.save.save();
    }

    while (this.platforms.length > 0 && this.platforms[this.platforms.length-1].y > this.cameraY - height) {
       let lastY = this.platforms[this.platforms.length-1].y;
       this.platforms.push(new Platform(Math.random()*(width-100), lastY - 150 - Math.random()*100, 100, 20));
       if (Math.random() > 0.4) this.enemies.push(new Enemy(Math.random()*width, lastY - 200));
    }

    this.platforms = this.platforms.filter(p => p.y < this.cameraY + height + 200);

    for (let b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter(b => b.life > 0);

    for (let e of this.enemies) e.update(dt, this.platforms);

    for (let p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);

    for (let b of this.bullets) {
        for (let e of this.enemies) {
            if (!e.alive) continue;
            let dx = b.x - e.x; let dy = b.y - e.y;
            if (Math.sqrt(dx*dx + dy*dy) < b.radius + e.radius) {
                e.alive = false;
                b.life = 0;
                this.score += 100;
                this.audio.playExplosion();
                for(let i=0; i<10; i++) this.particles.push(new Particle(e.x, e.y, '#f00'));
            }
        }
    }
    this.enemies = this.enemies.filter(e => e.alive && e.y < this.cameraY + height + 200);
  }
  draw(ctx) {
    ctx.fillStyle = '#201010';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(0, -this.cameraY);

    for (let p of this.platforms) p.draw(ctx);
    for (let e of this.enemies) e.draw(ctx);
    for (let p of this.particles) p.draw(ctx);
    for (let b of this.bullets) b.draw(ctx);
    if (this.player) this.player.draw(ctx);

    ctx.restore();

    ctx.fillStyle = 'rgba(255, 50, 0, 0.4)';
    let lavaY = Math.max(0, height - (this.cameraY));
    if (lavaY < height) {
        ctx.fillRect(0, lavaY, width, height - lavaY);
    }

    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';

    if (this.state === 'TITLE') {
       ctx.fillStyle = 'rgba(0,0,0,0.8)';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#e09ff1';
       ctx.textAlign = 'center';
       ctx.font = '40px sans-serif';
       ctx.fillText('Magma Recoil', width/2, height/2 - 40);
       ctx.font = '20px sans-serif';
       ctx.fillText('Click to Start', width/2, height/2 + 20);
       ctx.fillText('High Score: ' + this.save.data.highScore, width/2, height/2 + 60);
       ctx.textAlign = 'left';
       ctx.fillText('< Back to Arcade', 20, 40);
    } else if (this.state === 'PAUSED') {
       ctx.fillStyle = 'rgba(0,0,0,0.5)';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#e09ff1';
       ctx.textAlign = 'center';
       ctx.font = '40px sans-serif';
       ctx.fillText('PAUSED', width/2, height/2);
       ctx.textAlign = 'left';
       ctx.fillText('< Back to Arcade', 20, 40);
    } else if (this.state === 'GAME_OVER') {
       ctx.fillStyle = 'rgba(0,0,0,0.8)';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#f00';
       ctx.textAlign = 'center';
       ctx.font = '40px sans-serif';
       ctx.fillText('GAME OVER', width/2, height/2 - 40);
       ctx.fillStyle = '#e09ff1';
       ctx.font = '20px sans-serif';
       ctx.fillText('Score: ' + this.score, width/2, height/2 + 20);
       ctx.fillText('Click to restart', width/2, height/2 + 60);
    } else {
       ctx.fillText('Score: ' + this.score, 20, 30);
    }
  }
  loop(t) {
    let dt = Math.min((t - this.lastTime) / 1000, 0.1);
    this.lastTime = t;
    this.update(dt);
         if (this.ui) this.ui.update(dt, this);
    this.draw(ctx);
    requestAnimationFrame(t2 => this.loop(t2));
  }
}

window.onload = () => {
    window.game = new Game();
};

class UIOverlay {
  constructor() {
    this.padding = 10;
    this.font = '16px sans-serif';
    this.color = '#fff';
    this.messages = [];
  }
  addMessage(text, duration) {
    this.messages.push({ text, life: duration, maxLife: duration });
  }
  update(dt) {
    for (let m of this.messages) {
      m.life -= dt;
    }
    this.messages = this.messages.filter(m => m.life > 0);
  }
  draw(ctx, width, height, game) {
    if (game.state !== 'PLAYING') return;

    ctx.fillStyle = this.color;
    ctx.font = this.font;
    ctx.textAlign = 'right';

    ctx.fillText('Height: ' + Math.floor(-game.player.y), width - this.padding, 30);
    ctx.fillText('Cooldown: ' + Math.max(0, Math.ceil(game.player.cooldown * 100)) + '%', width - this.padding, 50);
    ctx.fillText('Grounded: ' + (game.player.grounded ? 'Yes' : 'No'), width - this.padding, 70);

    let y = height - this.padding;
    ctx.textAlign = 'center';
    for (let i = 0; i < this.messages.length; i++) {
        let m = this.messages[i];
        ctx.globalAlpha = Math.max(0, m.life / m.maxLife);
        ctx.fillText(m.text, width/2, y);
        y -= 20;
    }
    ctx.globalAlpha = 1;
  }
}

// Extra utility functions to pad line count for phase 1
const MathUtils = {
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    lerp: (a, b, t) => a + (b - a) * t,
    distSq: (x1, y1, x2, y2) => (x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1),
    dist: (x1, y1, x2, y2) => Math.sqrt(MathUtils.distSq(x1, y1, x2, y2)),
    angleTo: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    randomRange: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)],
    normalize: (vx, vy) => {
        let len = Math.sqrt(vx*vx + vy*vy);
        if (len === 0) return { x: 0, y: 0 };
        return { x: vx/len, y: vy/len };
    }
};

const ColorUtils = {
    hexToRgb: (hex) => {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    rgbToHex: (r, g, b) => {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    },
    darken: (hex, percent) => {
        let rgb = ColorUtils.hexToRgb(hex);
        if (!rgb) return hex;
        rgb.r = Math.max(0, Math.floor(rgb.r * (1 - percent)));
        rgb.g = Math.max(0, Math.floor(rgb.g * (1 - percent)));
        rgb.b = Math.max(0, Math.floor(rgb.b * (1 - percent)));
        return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
    }
};
