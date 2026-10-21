class FloatingText {
  constructor(x, y, text, color, size = 20) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.vy = -30;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px monospace`;
    ctx.textAlign = 'center';

    // Smooth easing for popup
    let scale = 1.0;
    const progress = 1.0 - (this.life / this.maxLife);
    if (progress < 0.2) {
      scale = 1.0 + progress * 2.0; // scale up fast
    } else {
      scale = 1.4 - (progress - 0.2) * 0.5; // scale down slow
    }

    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

class VFXManager {
  constructor(game) {
    this.game = game;
    this.floatingTexts = [];
    this.hitStopTimer = 0;
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
  }

  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
      }
    }

    // If hit stop is active, we return true to let game know to freeze
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt; // real dt, not scaled
      return true; // FREEZE
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].update(dt);
      if (this.floatingTexts[i].life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    return false; // don't freeze
  }

  draw(ctx) {
    for (const t of this.floatingTexts) {
      t.draw(ctx);
    }
  }

  triggerShake(intensity, duration) {
    if (this.game.saveManager && this.game.saveManager.data && this.game.saveManager.data.options) {
      const optShake = this.game.saveManager.data.options.screenShake !== undefined ? this.game.saveManager.data.options.screenShake : 1.0;
      this.shakeIntensity = intensity * optShake;
      this.shakeTimer = duration;
    } else {
      this.shakeIntensity = intensity;
      this.shakeTimer = duration;
    }
  }

  triggerHitStop(duration) {
    this.hitStopTimer = duration;
  }

  spawnDamageText(x, y, amount, isCrit = false, isCombo = false) {
    let color = '#fff';
    let size = 20;
    if (isCrit) {
      color = '#f2a65a';
      size = 28;
    } else if (isCombo) {
      color = '#d8b0e2';
      size = 24;
    }
    this.floatingTexts.push(new FloatingText(x, y, amount.toString(), color, size));
  }

  spawnDirectionalParticles(x, y, dirX, dirY, color, count, speedMin=50, speedMax=150) {
    const optParticles = (this.game.saveManager && this.game.saveManager.data && this.game.saveManager.data.options && this.game.saveManager.data.options.particles !== undefined) ? this.game.saveManager.data.options.particles : 1.0;
    if (optParticles === 0) return;
    const finalCount = Math.floor(count * optParticles);

    const baseAngle = Math.atan2(dirY, dirX);
    const spread = Math.PI / 3; // 60 degrees spread

    for (let i = 0; i < finalCount; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.game.particles.push(new Particle(
        x, y, vx, vy,
        0.3 + Math.random() * 0.4,
        color,
        2 + Math.random() * 3
      ));
    }
  }

  spawnExplosion(x, y, color, count) {
    const optParticles = (this.game.saveManager && this.game.saveManager.data && this.game.saveManager.data.options && this.game.saveManager.data.options.particles !== undefined) ? this.game.saveManager.data.options.particles : 1.0;
    if (optParticles === 0) return;
    const finalCount = Math.floor(count * optParticles);

    for(let i=0; i<finalCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;
      this.game.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        0.5 + Math.random() * 0.5,
        color,
        3 + Math.random() * 4
      ));
    }
  }

  spawnTrail(x, y, color, size = 3) {
    const optParticles = (this.game.saveManager && this.game.saveManager.data && this.game.saveManager.data.options && this.game.saveManager.data.options.particles !== undefined) ? this.game.saveManager.data.options.particles : 1.0;
    if (optParticles === 0) return;

    this.game.particles.push(new Particle(
      x, y,
      0, 0,
      0.2, // short life
      color,
      size
    ));
  }

  applyShake(ctx) {
    if (this.shakeTimer > 0 && this.shakeIntensity > 0) {
      const dx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      ctx.translate(dx, dy);
    }
  }
}
