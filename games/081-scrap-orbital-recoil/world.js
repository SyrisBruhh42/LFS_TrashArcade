class ParallaxLayer {
  constructor(imagePaths, speed, yOffset) {
    this.speed = speed;
    this.yOffset = yOffset;
    this.x = 0;
  }
  update(dt, speedMultiplier = 1) {
    this.x -= this.speed * dt * speedMultiplier;
  }
  draw(ctx, width, height) {
    ctx.fillStyle = `rgba(150, 100, 50, ${this.speed / 100})`;
    ctx.fillRect(0, 0, width, height);
  }
}

class ParallaxBackground {
  constructor() {
    this.layers = [
      { speed: 10, color: '#1a1a24', offset: 0 },
      { speed: 25, color: '#2a2a35', offset: 100 },
      { speed: 50, color: '#3a3a46', offset: 200 }
    ];
    this.x = 0;
  }
  update(dt) {
    this.x += dt;
  }
  draw(ctx, width, height) {
    ctx.save();
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const shift = (this.x * layer.speed) % width;
      ctx.fillStyle = layer.color;

      // Draw procedural scrap silhouettes
      for(let j = 0; j < 5; j++) {
        let lx = (j * (width/5) - shift + width) % width;
        let ly = height - layer.offset - 50 + Math.sin(j * i) * 30;
        ctx.fillRect(lx, ly, 100 + i*20, 100 + i*50);

        let lx2 = (j * (width/5) - shift + width*2) % width;
        ctx.fillRect(lx2, ly, 100 + i*20, 100 + i*50);
      }
    }
    ctx.restore();
  }
}

class Hazard extends Entity {
  constructor(x, y, radius) {
    super(x, y, radius);
  }
  update(dt, game) {
    super.update(dt);
  }
}

class DestructibleCover extends Hazard {
  constructor(x, y) {
    super(x, y, 25);
    this.color = '#7a7a7a';
    this.health = 5;
  }
  hit(game) {
    this.health--;
    game.sound.playHit();
    game.spawnParticles(this.pos.x, this.pos.y, 10, '#aaaaaa');
    if (this.health <= 0) {
      this.active = false;
      game.spawnParticles(this.pos.x, this.pos.y, 30, '#ffaa00');
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

    // Draw damage cracks
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.health < 5) {
      ctx.moveTo(-10, -10);
      ctx.lineTo(0, 5);
    }
    if (this.health < 3) {
      ctx.moveTo(10, -5);
      ctx.lineTo(-5, 10);
    }
    ctx.stroke();
    ctx.restore();
  }
}

class ConveyorBelt extends Hazard {
  constructor(x, y, width, height, speed) {
    super(x + width/2, y + height/2, Math.max(width, height)/2);
    this.w = width;
    this.h = height;
    this.conveyorSpeed = speed; // Vector2
    this.active = true;
  }
  update(dt, game) {
    // Apply force to entities on top
    const pushEntities = (entities) => {
      for (let e of entities) {
        if (!e.active) continue;
        if (Math.abs(e.pos.x - this.pos.x) < this.w/2 + e.radius &&
            Math.abs(e.pos.y - this.pos.y) < this.h/2 + e.radius) {
          e.pos.add(this.conveyorSpeed.copy().mult(dt));
        }
      }
    };
    if (game.player && game.player.active) pushEntities([game.player]);
    pushEntities(game.enemies);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.fillStyle = '#333';
    ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);

    // Draw arrows for direction
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    let offset = (Date.now() / 1000 * 50) % 20;

    ctx.beginPath();
    if (this.conveyorSpeed.x > 0) {
      for(let x = -this.w/2 + offset; x < this.w/2; x+= 20) {
        ctx.moveTo(x, -this.h/4);
        ctx.lineTo(x + 10, 0);
        ctx.lineTo(x, this.h/4);
      }
    } else if (this.conveyorSpeed.x < 0) {
       for(let x = this.w/2 - offset; x > -this.w/2; x-= 20) {
        ctx.moveTo(x, -this.h/4);
        ctx.lineTo(x - 10, 0);
        ctx.lineTo(x, this.h/4);
      }
    } else if (this.conveyorSpeed.y > 0) {
       for(let y = -this.h/2 + offset; y < this.h/2; y+= 20) {
        ctx.moveTo(-this.w/4, y);
        ctx.lineTo(0, y + 10);
        ctx.lineTo(this.w/4, y);
      }
    } else if (this.conveyorSpeed.y < 0) {
       for(let y = this.h/2 - offset; y > -this.h/2; y-= 20) {
        ctx.moveTo(-this.w/4, y);
        ctx.lineTo(0, y - 10);
        ctx.lineTo(this.w/4, y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }
}

class DamageTrap extends Hazard {
  constructor(x, y) {
    super(x, y, 20);
    this.timer = 0;
    this.activeDamage = false;
  }
  update(dt, game) {
    this.timer += dt;
    if (this.timer > 3) {
      this.timer = 0;
      this.activeDamage = !this.activeDamage;
    }

    if (this.activeDamage) {
      const checkHit = (e) => {
        if (e && e.active && e.checkCollision(this)) {
          if (e.hit) e.hit(game);
        }
      }
      checkHit(game.player);
      for (let e of game.enemies) {
        checkHit(e);
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (this.activeDamage) {
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius - 5 + Math.sin(Date.now()/50)*5, 0, Math.PI * 2);
      ctx.fill();
    } else {
       ctx.fillStyle = '#ff8800';
       ctx.beginPath();
       ctx.arc(0, 0, this.radius - 10, 0, Math.PI * 2);
       ctx.fill();
    }

    ctx.restore();
  }
}

class WorldManager {
  constructor(game) {
    this.game = game;
    this.bg = new ParallaxBackground();
    this.hazards = [];
  }
  init() {
    this.hazards = [];
    const w = this.game.width;
    const h = this.game.height;

    // Spawn some random destructible covers
    for(let i=0; i<5; i++) {
      this.hazards.push(new DestructibleCover(Math.random() * w, Math.random() * h));
    }

    // Spawn some conveyor belts
    this.hazards.push(new ConveyorBelt(100, h - 150, 200, 60, new Vector2(100, 0)));
    this.hazards.push(new ConveyorBelt(w - 300, 100, 200, 60, new Vector2(-100, 0)));
    this.hazards.push(new ConveyorBelt(w/2 - 30, h/2 - 200, 60, 400, new Vector2(0, 100)));

    // Spawn some damage traps
    for(let i=0; i<3; i++) {
      this.hazards.push(new DamageTrap(Math.random() * w, Math.random() * h));
    }
  }

  update(dt) {
    this.bg.update(dt);
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.update(dt, this.game);
      if (!h.active) this.hazards.splice(i, 1);
    }

    // Projectile vs Hazard
    for (let p of this.game.projectiles) {
      if (!p.active) continue;
      for (let h of this.hazards) {
        if (!h.active) continue;
        if (h instanceof DestructibleCover && p.checkCollision(h)) {
          p.active = false;
          h.hit(this.game);
          break;
        }
      }
    }
  }

  drawBackground(ctx) {
    this.bg.draw(ctx, this.game.width, this.game.height);
  }

  drawHazards(ctx) {
    for (let h of this.hazards) {
      h.draw(ctx);
    }
  }
}
