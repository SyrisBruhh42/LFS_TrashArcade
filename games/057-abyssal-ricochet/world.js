class ParallaxBackground {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [
      { speed: 0.1, color: '#0f172a', items: this.generateItems(20, 2, 4) }, // Distant vents
      { speed: 0.3, color: '#1e293b', items: this.generateItems(15, 4, 8) }, // Midground rocks
      { speed: 0.8, color: 'rgba(112, 226, 249, 0.2)', items: this.generateItems(30, 1, 2) } // Foreground bubbles
    ];
    this.offsetY = 0;
  }
  generateItems(count, minR, maxR) {
    let items = [];
    for(let i=0; i<count; i++) {
      items.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: minR + Math.random() * (maxR - minR)
      });
    }
    return items;
  }
  update(dt) {
    this.offsetY += 20 * dt;
  }
  draw(ctx) {
    this.layers.forEach(layer => {
      ctx.fillStyle = layer.color;
      layer.items.forEach(item => {
        let y = (item.y - this.offsetY * layer.speed) % this.height;
        if(y < 0) y += this.height;
        ctx.beginPath();
        ctx.arc(item.x, y, item.r, 0, Math.PI*2);
        ctx.fill();
      });
    });
  }
}

class AbyssalGeyser {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.active = false;
    this.timer = 0;
    this.cycleTime = 4 + Math.random() * 2; // Every 4-6 seconds
    this.activeTime = 1.5; // Active for 1.5 seconds
    this.particles = [];
  }

  update(dt, player, enemies) {
    this.timer += dt;
    if (this.active) {
      if (this.timer > this.activeTime) {
        this.active = false;
        this.timer = 0;
      } else {
        // Spawn particles
        if (Math.random() < 0.5) {
          this.particles.push({
            x: this.x + (Math.random() - 0.5) * this.radius,
            y: this.y + (Math.random() - 0.5) * this.radius,
            vx: (Math.random() - 0.5) * 50,
            vy: (Math.random() - 0.5) * 50,
            life: 0.5 + Math.random() * 0.5
          });
        }

        // Repel entities
        const applyRepel = (entity) => {
          const dx = entity.x - this.x;
          const dy = entity.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.radius + (entity.radius || 15)) {
            const force = (1 - dist / (this.radius + (entity.radius || 15))) * 500 * dt;
            const angle = Math.atan2(dy, dx);
            entity.vx += Math.cos(angle) * force;
            entity.vy += Math.sin(angle) * force;
          }
        };

        if (player) applyRepel(player);
        if (enemies) enemies.forEach(applyRepel);
      }
    } else {
      if (this.timer > this.cycleTime) {
        this.active = true;
        this.timer = 0;
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.strokeStyle = this.active ? '#ffeb3b' : 'rgba(255, 235, 59, 0.2)';
    ctx.lineWidth = this.active ? 3 : 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (this.active) {
      ctx.fillStyle = 'rgba(255, 235, 59, 0.3)';
      ctx.fill();
    }

    this.particles.forEach(p => {
      ctx.fillStyle = `rgba(255, 235, 59, ${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

class EnvironmentHazardManager {
  constructor() {
    this.currents = [];
    this.geysers = [];
    this.timer = 0;
  }
  update(dt, arena, player, enemies) {
    this.timer += dt;
    if(this.timer > 5) {
      this.timer = 0;
      this.spawnCurrent(arena);
      if (Math.random() < 0.5) this.spawnGeyser(arena);
    }

    this.geysers.forEach(g => g.update(dt, player, enemies));

    for(let i=this.currents.length-1; i>=0; i--) {
      let c = this.currents[i];
      c.life -= dt;
      if(c.life <= 0) {
        this.currents.splice(i, 1);
        continue;
      }
      // Apply force
      let applyForce = (entity) => {
        if(entity.x > c.x && entity.x < c.x + c.w && entity.y > c.y && entity.y < c.y + c.h) {
          entity.vx += c.dirX * c.force * dt;
          entity.vy += c.dirY * c.force * dt;
        }
      };
      if(player) applyForce(player);
      if(enemies) enemies.forEach(applyForce);
    }
  }
  spawnCurrent(arena) {
    if(this.currents.length > 2) return;
    const w = 150;
    const h = 150;
    if (arena.width <= w || arena.height <= h) return;
    const x = arena.x + Math.random() * (arena.width - w);
    const y = arena.y + Math.random() * (arena.height - h);
    const angle = Math.random() * Math.PI * 2;
    this.currents.push({
      x: x, y: y, w: w, h: h,
      dirX: Math.cos(angle), dirY: Math.sin(angle),
      force: 200, life: 8
    });
  }
  spawnGeyser(arena) {
    if(this.geysers.length > 3) return;
    const r = 40 + Math.random() * 30;
    if (arena.width <= r*2 || arena.height <= r*2) return;
    const x = arena.x + r + Math.random() * (arena.width - r*2);
    const y = arena.y + r + Math.random() * (arena.height - r*2);
    this.geysers.push(new AbyssalGeyser(x, y, r));
  }
  draw(ctx) {
    this.geysers.forEach(g => g.draw(ctx));

    this.currents.forEach(c => {
      ctx.fillStyle = `rgba(112, 226, 249, ${Math.min(1, c.life) * 0.15})`;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      // draw flow arrows
      ctx.strokeStyle = `rgba(112, 226, 249, ${Math.min(1, c.life) * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(c.x + c.w/2 - c.dirX*10, c.y + c.h/2 - c.dirY*10);
      ctx.lineTo(c.x + c.w/2 + c.dirX*10, c.y + c.h/2 + c.dirY*10);
      ctx.stroke();
    });
  }
}
