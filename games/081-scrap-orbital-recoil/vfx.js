class FloatingText extends Entity {
  constructor(x, y, text, color, isCritical = false) {
    super(x, y, 0);
    this.text = text;
    this.color = color;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.vel = new Vector2((Math.random() - 0.5) * 50, -50 - Math.random() * 50);
    this.isCritical = isCritical;
    this.scale = isCritical ? 1.5 : 1.0;
  }
  update(dt) {
    super.update(dt);
    this.life -= dt;
    this.vel.y += 100 * dt;
    if (this.life <= 0) this.active = false;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${Math.floor(16 * this.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    const easedY = this.pos.y - (1 - alpha) * 20;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(this.text, this.pos.x, easedY);
    ctx.fillText(this.text, this.pos.x, easedY);
    ctx.restore();
  }
}

class MotionTrail extends Entity {
  constructor(x, y, color, radius, duration) {
    super(x, y, radius);
    this.color = color;
    this.maxLife = duration;
    this.life = duration;
    this.vel = new Vector2(0, 0); // Trails are mostly static
  }

  update(dt) {
    super.update(dt);
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
    }
    // Slowly expand or shrink
    this.radius *= (1.0 - dt * 2);
    if (this.radius < 0.1) this.radius = 0.1;
  }

  draw(ctx) {
    if (!this.active || this.radius <= 0) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha * 0.5; // Trails are slightly transparent
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class SparkParticle extends Entity {
  constructor(x, y, baseDir) {
    super(x, y, 1 + Math.random() * 2);
    this.color = '#ffff00';
    const angle = baseDir ? baseDir.heading() + (Math.random() - 0.5) * 0.5 : Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 300;
    this.vel = Vector2.fromAngle(angle).mult(speed);
    this.life = 0.2 + Math.random() * 0.3;
    this.maxLife = this.life;
  }

  update(dt) {
    super.update(dt);
    this.vel.mult(0.90); // high drag for sparks
    this.life -= dt;
    if (this.life <= 0) this.active = false;

    // Spark flickers color from white to yellow to red
    if (this.life < this.maxLife * 0.3) {
      this.color = '#ff0000';
    } else if (this.life < this.maxLife * 0.6) {
      this.color = '#ff8800';
    } else {
      this.color = '#ffffff';
    }
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;

    // Draw elongated spark based on velocity
    const speed = this.vel.mag();
    if (speed > 10) {
      const heading = this.vel.heading();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(heading);
      ctx.fillRect(0, -this.radius/2, speed * 0.05, this.radius);
    } else {
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
