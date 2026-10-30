class PlayerController extends Player {
  constructor(x, y, isBot, color) {
    super(x, y, isBot, color);
    this.overdrive = 0;
    this.overdriveMax = 100;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.armAngle = 0;
    this.legAngle = 0;
    this.walkCycle = 0;
    this.facingRight = isBot ? false : true;
  }

  update(dt, input, ball, gameWidth, gameHeight) {
    const prevState = super.update(dt, input, ball, gameWidth, gameHeight);

    // Increment overdrive passively and on action
    if (this.overdrive < this.overdriveMax) {
      this.overdrive += dt * 5;
    }
    if (prevState && prevState.smashReq) {
      this.overdrive += 15;
    }
    this.overdrive = Math.min(this.overdrive, this.overdriveMax);

    // Direction facing
    if (prevState && prevState.moveDir > 0) this.facingRight = true;
    else if (prevState && prevState.moveDir < 0) this.facingRight = false;

    // Dash logic (Secondary tactical ability)
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.vy = 0;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      let dashReq = false;
      if (!this.isBot && (input.isDown('ShiftLeft') || input.isDown('ShiftRight') || input.isDown('btn-dash'))) {
        dashReq = true;
      } else if (this.isBot && this.overdrive >= 50 && Math.abs(ball.x - this.x) > 150) {
        dashReq = true;
      }

      if (dashReq && this.dashCooldown <= 0 && this.overdrive >= 30) {
        this.isDashing = true;
        this.dashTimer = 0.2;
        this.dashCooldown = 1.0;
        this.overdrive -= 30;
        this.vx = this.facingRight ? this.speed * 3 : -this.speed * 3;
        this.vy = 0;
        // Visual recoil boost
        this.armAngle = -Math.PI/2;
      }
    }

    if (this.isDashing) {
      this.x += this.vx * dt;

      // Keep in bounds even when dashing fast
      if (this.isBot) {
        if (this.x < gameWidth/2 + this.width/2) this.x = gameWidth/2 + this.width/2;
        if (this.x > gameWidth - this.width/2) this.x = gameWidth - this.width/2;
      } else {
        if (this.x < this.width/2) this.x = this.width/2;
        if (this.x > gameWidth/2 - this.width/2) this.x = gameWidth/2 - this.width/2;
      }
    }

    // Animation / Rig state
    if (this.grounded && prevState && prevState.moveDir !== 0) {
      this.walkCycle += dt * 15;
      this.legAngle = Math.sin(this.walkCycle) * 0.5;
      this.armAngle = Math.cos(this.walkCycle) * 0.5;
    } else if (!this.grounded) {
      this.legAngle = 0.2;
      this.armAngle = -0.5;
    } else {
      this.legAngle = 0;
      this.armAngle = 0;
    }

    if (prevState && prevState.smashReq) {
      this.armAngle = -Math.PI; // Full swing
    }

    return prevState;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const scaleX = this.facingRight ? 1 : -1;
    ctx.scale(scaleX, 1);

    // Overdrive Aura if high
    if (this.overdrive > 80) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, this.height * 0.8, 0, Math.PI*2);
      ctx.fill();
    }

    // Legs (Back & Front)
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    // Back leg
    ctx.save();
    ctx.translate(0, this.height/4);
    ctx.rotate(-this.legAngle);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, this.height/4); ctx.stroke();
    ctx.restore();

    // Front leg
    ctx.save();
    ctx.translate(0, this.height/4);
    ctx.rotate(this.legAngle);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, this.height/4); ctx.stroke();
    ctx.restore();

    // Torso (Garment Layering)
    ctx.fillStyle = this.isBot ? '#552233' : '#113344'; // undershirt
    ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height * 0.75);
    ctx.fillStyle = this.color; // jacket/jersey
    ctx.fillRect(-this.width/2 - 2, -this.height/2 - 2, this.width + 4, this.height * 0.5);

    // Head
    ctx.fillStyle = '#ffccaa'; // skin
    ctx.beginPath();
    ctx.arc(0, -this.height/2 - 10, 15, 0, Math.PI*2);
    ctx.fill();

    // Punk Hair (Expressive)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-15, -this.height/2 - 15);
    ctx.lineTo(0, -this.height/2 - 40 + (this.vy < 0 ? -10 : 0)); // dynamic hair based on jump
    ctx.lineTo(15, -this.height/2 - 15);
    ctx.fill();

    // Face/Expression
    ctx.fillStyle = '#000';
    if (this.isDashing) {
      // Intense expression
      ctx.fillRect(5, -this.height/2 - 15, 8, 2); // angry brow
      ctx.fillRect(5, -this.height/2 - 10, 4, 4); // eye
    } else {
      ctx.fillRect(5, -this.height/2 - 12, 4, 4); // normal eye
    }

    // Arms
    ctx.save();
    ctx.translate(0, -this.height/4);
    ctx.rotate(this.armAngle);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, this.height/3); ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Overdrive HUD Indicator
    ctx.fillStyle = '#333';
    ctx.fillRect(this.x - 25, this.y - this.height/2 - 40, 50, 6);
    ctx.fillStyle = this.overdrive >= 30 ? '#00ff00' : '#ffff00';
    ctx.fillRect(this.x - 25, this.y - this.height/2 - 40, (this.overdrive / this.overdriveMax) * 50, 6);
  }
}
