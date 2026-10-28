
class SteamVent {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.active = false;
    this.timer = Math.random() * 5;
    this.activeDuration = 2;
    this.cooldown = 4;
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.active) {
      if (this.timer <= 0) {
        this.active = false;
        this.timer = this.cooldown;
      } else {
        // Push player up
        if (game.player.x > this.x && game.player.x < this.x + this.w &&
            game.player.y > this.y && game.player.y < this.y + this.h) {
          game.player.vy -= 800 * dt;
        }
        // Push enemies up
        for (const e of game.enemies) {
          if (e.x > this.x && e.x < this.x + this.w &&
              e.y > this.y && e.y < this.y + this.h) {
            e.vy -= 800 * dt;
          }
        }
        // Visual steam
        if (Math.random() < 0.5) {
          game.spawnParticles(this.x + Math.random() * this.w, this.y + this.h, 'rgba(200, 220, 255, 0.4)', 2);
        }
      }
    } else {
      if (this.timer <= 0) {
        this.active = true;
        this.timer = this.activeDuration;
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.fillRect(this.x, this.y + this.h - 10, this.w, 10);
    if (this.active) {
      ctx.fillStyle = 'rgba(200, 220, 255, 0.2)';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

class CryoMine {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.triggerRadius = 60;
    this.blastRadius = 150;
    this.triggered = false;
    this.timer = 1.0;
    this.active = true;
  }
  update(dt, game) {
    if (!this.active) return;

    if (this.triggered) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.explode(game);
      }
    } else {
      // Check distance to player
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      if (dx*dx + dy*dy < this.triggerRadius * this.triggerRadius) {
        this.triggered = true;
      }

      // Check distance to enemies
      for (const e of game.enemies) {
        const edx = e.x - this.x;
        const edy = e.y - this.y;
        if (edx*edx + edy*edy < this.triggerRadius * this.triggerRadius) {
          this.triggered = true;
          break;
        }
      }
    }
  }
  explode(game) {
    this.active = false;
    game.sound.playHit();
    game.spawnParticles(this.x, this.y, '#a0d8e2', 50);

    // Freeze/slow player
    const pdx = game.player.x - this.x;
    const pdy = game.player.y - this.y;
    if (pdx*pdx + pdy*pdy < this.blastRadius * this.blastRadius) {
      game.player.vx *= 0.2;
      game.player.vy *= 0.2;
    }

    // Freeze/slow enemies and damage
    for (const e of game.enemies) {
      const edx = e.x - this.x;
      const edy = e.y - this.y;
      if (edx*edx + edy*edy < this.blastRadius * this.blastRadius) {
        e.vx *= 0.1;
        e.vy *= 0.1;
        e.hp -= 2;
        if (e.hp <= 0) {
          game.score += 50;
          game.spawnParticles(e.x, e.y, '#e26b6b', 20);
          e.dead = true; // Mark for removal (handled implicitly by hp in checkCollisions, but we do it manually if check is decoupled)
        }
      }
    }
    game.enemies = game.enemies.filter(e => !e.dead && e.hp > 0);
  }
  draw(ctx) {
    if (!this.active) return;
    ctx.fillStyle = this.triggered ? (Math.floor(Date.now() / 100) % 2 === 0 ? '#ff5555' : '#ffffff') : '#44aacc';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    if (this.triggered) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.blastRadius * (1 - this.timer), 0, Math.PI*2);
      ctx.stroke();
    }
  }
}

class ConveyorZone {
  constructor(x, y, w, h, speedX) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.speedX = speedX;
    this.offset = 0;
  }
  update(dt, game) {
    this.offset += this.speedX * dt;
    if (this.offset > 20) this.offset -= 20;
    if (this.offset < -20) this.offset += 20;

    // Move player
    if (game.player.x > this.x && game.player.x < this.x + this.w &&
        game.player.y > this.y && game.player.y < this.y + this.h) {
      game.player.x += this.speedX * dt;
    }

    // Move enemies
    for (const e of game.enemies) {
      if (e.x > this.x && e.x < this.x + this.w &&
          e.y > this.y && e.y < this.y + this.h) {
        e.x += this.speedX * dt;
      }
    }

    // Move blocks
    for (const b of game.blocks) {
      if (b.x + b.w/2 > this.x && b.x + b.w/2 < this.x + this.w &&
          b.y + b.h/2 > this.y && b.y + b.h/2 < this.y + this.h) {
        b.x += this.speedX * dt;
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#223344';
    ctx.fillRect(this.x, this.y, this.w, this.h);

    ctx.strokeStyle = '#334455';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let lx = this.x + (this.offset % 20); lx < this.x + this.w; lx += 20) {
      if (lx >= this.x && lx <= this.x + this.w) {
        ctx.moveTo(lx, this.y);
        ctx.lineTo(lx, this.y + this.h);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

class ParallaxLayer {
  constructor(imgSrc, speedX, speedY, width, height, yOffset, opacity, color) {
    this.speedX = speedX;
    this.speedY = speedY;
    this.offsetX = 0;
    this.offsetY = 0;
    this.width = width;
    this.height = height;
    this.yOffset = yOffset;
    this.opacity = opacity;
    this.color = color;
    // We'll proceduraly draw since we don't have images
    this.elements = [];
    for(let i=0; i<30; i++) {
       this.elements.push({
          x: Math.random() * width,
          y: Math.random() * height,
          w: 10 + Math.random() * 50,
          h: 10 + Math.random() * 100
       });
    }
  }
  update(dt, playerVx, playerVy) {
    this.offsetX -= playerVx * this.speedX * dt;
    this.offsetY -= playerVy * this.speedY * dt;

    if (this.offsetX < -this.width) this.offsetX += this.width;
    if (this.offsetX > this.width) this.offsetX -= this.width;

    if (this.offsetY < -this.height) this.offsetY += this.height;
    if (this.offsetY > this.height) this.offsetY -= this.height;
  }
  draw(ctx) {
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;

    const drawElements = (ox, oy) => {
       for (const el of this.elements) {
          ctx.fillRect(el.x + ox, el.y + oy, el.w, el.h);
       }
    };

    drawElements(this.offsetX, this.offsetY);
    drawElements(this.offsetX - this.width, this.offsetY);
    drawElements(this.offsetX + this.width, this.offsetY);
    drawElements(this.offsetX, this.offsetY - this.height);
    drawElements(this.offsetX, this.offsetY + this.height);
    drawElements(this.offsetX - this.width, this.offsetY - this.height);
    drawElements(this.offsetX + this.width, this.offsetY - this.height);
    drawElements(this.offsetX - this.width, this.offsetY + this.height);
    drawElements(this.offsetX + this.width, this.offsetY + this.height);

    ctx.globalAlpha = 1.0;
  }
}

class WorldManager {
  constructor(logicalWidth, logicalHeight) {
    this.width = logicalWidth;
    this.height = logicalHeight;

    this.layers = [
      new ParallaxLayer(null, 0.05, 0.05, logicalWidth, logicalHeight, 0, 0.3, '#051020'), // Deep Ice Caverns
      new ParallaxLayer(null, 0.15, 0.15, logicalWidth, logicalHeight, 0, 0.5, '#0a2035'), // Background Facility Structures
      new ParallaxLayer(null, 0.3, 0.3, logicalWidth, logicalHeight, 0, 0.8, '#15304a')    // Foreground Support Pillars/Pipes
    ];

    this.hazards = [];
    this.generateHazards();
  }

  generateHazards() {
    this.hazards = [];

    // Add Steam Vents
    for(let i=0; i<3; i++) {
      this.hazards.push(new SteamVent(
        100 + Math.random() * (this.width - 200),
        200 + Math.random() * (this.height - 300),
        60,
        150
      ));
    }

    // Add Cryo Mines
    for(let i=0; i<5; i++) {
      this.hazards.push(new CryoMine(
        50 + Math.random() * (this.width - 100),
        50 + Math.random() * (this.height - 100)
      ));
    }

    // Add Conveyor Belts
    this.hazards.push(new ConveyorZone(
      100, this.height - 50, this.width - 200, 40, (Math.random() > 0.5 ? 1 : -1) * 100
    ));
    this.hazards.push(new ConveyorZone(
      100, 50, this.width - 200, 40, (Math.random() > 0.5 ? 1 : -1) * 100
    ));
  }

  update(dt, game) {
    // Update Parallax based on player velocity
    for (const layer of this.layers) {
      layer.update(dt, game.player.vx, game.player.vy);
    }

    // Update Hazards
    for (const h of this.hazards) {
      h.update(dt, game);
    }

    // Clean up inactive mines
    this.hazards = this.hazards.filter(h => !(h instanceof CryoMine) || h.active);
  }

  drawBackground(ctx) {
    ctx.fillStyle = (window.engine && window.engine.saveManager && window.engine.saveManager.data.options.highContrast) ? '#000' : '#02050a';
    ctx.fillRect(0, 0, this.width, this.height);

    for (const layer of this.layers) {
      layer.draw(ctx);
    }
  }

  drawForeground(ctx) {
    for (const h of this.hazards) {
      h.draw(ctx);
    }
  }
}
