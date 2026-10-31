class BossManager {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.currentBoss = null;
    this.bossHP = 0;
    this.maxBossHP = 0;
    this.phase = 1;
    this.modifierText = "";
  }

  startBossEncounter(winCount) {
    this.active = true;
    this.phase = 1;
    this.game.timeLeft = 180;
    this.game.score1 = 0;
    this.game.score2 = 0;

    if (winCount === 3 || winCount === 7) {
        this.currentBoss = new WindTitanBoss(this.game.width * 3/4, this.game.height - 100);
        this.bossHP = 3;
        this.maxBossHP = 3;
        this.modifierText = "WINDSTORM!";
    } else {
        this.currentBoss = new GravityBehemothBoss(this.game.width * 3/4, this.game.height - 100);
        this.bossHP = 4;
        this.maxBossHP = 4;
        this.modifierText = "HIGH GRAVITY!";
    }

    this.game.p2 = this.currentBoss;
    const p2Label = document.querySelector('.score-p2');
    if (p2Label) {
        p2Label.dataset.nameSet = "true";
        p2Label.innerHTML = `${this.currentBoss.name}: <span id="score2"></span>`;
    }
    this.applyModifiers();
  }

  applyModifiers() {
    if (this.currentBoss instanceof WindTitanBoss) {
      this.game.ball.vx += (this.phase === 1 ? -300 : -500); // Wind pushes left
    } else if (this.currentBoss instanceof GravityBehemothBoss) {
      this.game.ball.vy += (this.phase === 1 ? 200 : 400); // Heavy ball
    }
  }

  update(dt) {
    if (!this.active) return;
    // Apply continuous modifiers if needed, e.g. constant wind acceleration
    if (this.currentBoss instanceof WindTitanBoss) {
        this.game.ball.vx -= 100 * dt;
    }
  }

  damageBoss() {
    this.bossHP--;
    if (this.bossHP <= 0) {
      this.game.score1++;
      this.active = false;
      this.game.endMatch();
    } else {
      this.phase++;
      this.game.audio.playHit();
      this.applyModifiers();
      this.game.resetBall(2);
    }
  }

  draw(ctx) {
    if (!this.active) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(this.game.width/2 - 150, 10, 300, 60);

    ctx.fillStyle = '#ff4081';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.currentBoss.name} - Phase ${this.phase}`, this.game.width/2, 30);

    ctx.fillStyle = '#00e5ff';
    ctx.fillText(this.modifierText, this.game.width/2, 55);

    // HP Bar
    ctx.fillStyle = '#444';
    ctx.fillRect(this.game.width/2 - 100, 65, 200, 10);
    ctx.fillStyle = '#ff4081';
    ctx.fillRect(this.game.width/2 - 100, 65, (this.bossHP / this.maxBossHP) * 200, 10);
  }
}

class WindTitanBoss extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#ffffff');
    this.name = "Wind Titan";
    this.speed = 350;
    this.jumpForce = -700;
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;
    if (ball.x > this.x) moveDir = 1;
    else if (ball.x < this.x - 40) moveDir = -1;
    if (ball.y < this.y - 30 && ball.x > this.x - 120 && ball.x < this.x + 120) jumpReq = true;
    if (Math.abs(ball.x - this.x) < 70 && Math.abs(ball.y - this.y) < 70) smashReq = true;
    return { moveDir, jumpReq, smashReq };
  }
}

class GravityBehemothBoss extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#ff0000');
    this.name = "Gravity Behemoth";
    this.speed = 250;
    this.jumpForce = -800;
    this.width = 60;
    this.height = 100;
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;
    if (ball.x > this.x + 10) moveDir = 1;
    else if (ball.x < this.x - 10) moveDir = -1;
    if (ball.y < this.y - 20 && Math.abs(ball.x - this.x) < 80) jumpReq = true;
    if (Math.abs(ball.x - this.x) < 80 && Math.abs(ball.y - this.y) < 80) smashReq = true;
    return { moveDir, jumpReq, smashReq };
  }
}
