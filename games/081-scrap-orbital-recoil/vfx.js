class FloatingText {
  constructor(text, x, y, color, size = 20) {
    this.text = text;
    this.pos = new Vector2(x, y);
    this.color = color;
    this.size = size;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.vel = new Vector2((Math.random() - 0.5) * 50, -50 - Math.random() * 50);
  }
  update(dt) {
    this.pos.add(this.vel.copy().mult(dt));
    this.life -= dt;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.globalAlpha = 1.0;
  }
}

class Trail {
  constructor(x, y, radius, angle, color) {
    this.pos = new Vector2(x, y);
    this.radius = radius;
    this.angle = angle;
    this.color = color;
    this.life = 0.3;
    this.maxLife = 0.3;
  }
  update(dt) {
    this.life -= dt;
  }
  draw(ctx) {
    const alpha = Math.max(0, (this.life / this.maxLife) * 0.5);
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-10 - 20, 0); // simulated thrust
    ctx.lineTo(-10, 6);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
    ctx.globalAlpha = 1.0;
  }
}

class AdvancedParticle extends Particle {
  constructor(x, y, color, baseDir = null) {
    super(x, y, color, baseDir);
    this.life = 0.3 + Math.random() * 0.4;
    this.maxLife = this.life;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    const speed = this.vel.mag();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;

    if (speed > 50) {
      // Stretch along velocity vector
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.vel.heading());
      const stretch = Math.min(speed * 0.1, 20);
      ctx.fillRect(-stretch / 2, -this.radius / 2, stretch, this.radius);
      ctx.restore();
    } else {
      ctx.fillRect(this.pos.x - this.radius, this.pos.y - this.radius, this.radius * 2, this.radius * 2);
    }
    ctx.globalAlpha = 1.0;
  }
}

class VFXManager {
  constructor(game) {
    this.game = game;
    this.floatingTexts = [];
    this.trails = [];
    this.advancedParticles = [];
    this.screenShake = { duration: 0, magnitude: 0, x: 0, y: 0 };
    this.hitStop = 0;
  }

  init() {
    this.floatingTexts = [];
    this.trails = [];
    this.advancedParticles = [];
    this.screenShake = { duration: 0, magnitude: 0, x: 0, y: 0 };
    this.hitStop = 0;
  }

  update(dt) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      // During hitstop, only update visual decay, not positions for game feel
    }

    if (this.screenShake.duration > 0) {
      this.screenShake.duration -= dt;
      const intensity = this.game.saveManager.data.options.screenShake || 1.0;
      if (this.screenShake.duration > 0) {
        this.screenShake.x = (Math.random() - 0.5) * this.screenShake.magnitude * intensity;
        this.screenShake.y = (Math.random() - 0.5) * this.screenShake.magnitude * intensity;
      } else {
        this.screenShake.x = 0;
        this.screenShake.y = 0;
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].update(dt);
      if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].update(dt);
      if (this.trails[i].life <= 0) this.trails.splice(i, 1);
    }

    for (let i = this.advancedParticles.length - 1; i >= 0; i--) {
      this.advancedParticles[i].update(dt);
      if (this.advancedParticles[i].life <= 0) this.advancedParticles.splice(i, 1);
    }
  }

  applyScreenShake(ctx) {
    if (this.screenShake.duration > 0) {
      ctx.translate(this.screenShake.x, this.screenShake.y);
    }
  }

  draw(ctx) {
    for (let p of this.advancedParticles) p.draw(ctx);
    for (let t of this.trails) t.draw(ctx);
    for (let f of this.floatingTexts) f.draw(ctx);
  }

  spawnFloatingText(text, x, y, color, size = 20) {
    this.floatingTexts.push(new FloatingText(text, x, y, color, size));
  }

  spawnTrail(x, y, radius, angle, color) {
    this.trails.push(new Trail(x, y, radius, angle, color));
  }

  spawnAdvancedParticle(x, y, color, baseDir = null) {
    this.advancedParticles.push(new AdvancedParticle(x, y, color, baseDir));
  }

  triggerScreenShake(duration, magnitude) {
    this.screenShake.duration = Math.max(this.screenShake.duration, duration);
    this.screenShake.magnitude = Math.max(this.screenShake.magnitude, magnitude);
  }

  triggerHitStop(duration) {
    this.hitStop = Math.max(this.hitStop, duration);
  }
}
