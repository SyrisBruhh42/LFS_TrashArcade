class RosterManager {
  constructor() {
    this.rivals = [
      IronWallKeeper,
      LobSpecialist,
      RushStriker,
      TrickSpinAce,
      GrandChampion
    ];
  }

  getRivalClass(winCount) {
    const index = winCount % this.rivals.length;
    return this.rivals[index];
  }
}

class IronWallKeeper extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#ffaa00'); // Orange
    this.name = "Iron Wall Keeper";
    this.speed = 200; // Slower
    this.jumpForce = -700; // High jump
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;
    const defendX = gameWidth * 3 / 4;

    // Stay near the goal
    if (this.x < defendX - 20) moveDir = 1;
    else if (this.x > defendX + 20) moveDir = -1;

    // React only when ball is close
    if (ball.x > gameWidth / 2) {
        if (ball.x > this.x + 20) moveDir = 1;
        else if (ball.x < this.x - 20) moveDir = -1;

        if (ball.y < this.y - 50 && ball.x > this.x - 120 && ball.x < this.x + 120) jumpReq = true;
        if (Math.abs(ball.x - this.x) < 80 && Math.abs(ball.y - this.y) < 80) smashReq = true;
    }

    return { moveDir, jumpReq, smashReq };
  }
}

class LobSpecialist extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#aa00ff'); // Purple
    this.name = "Lob Specialist";
    this.speed = 350; // Faster
    this.jumpForce = -500; // Low jump
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;

    // Try to get under the ball to lob it
    if (ball.x > this.x + 5) moveDir = 1;
    else if (ball.x < this.x - 5) moveDir = -1;

    // Rarely smash, mostly jump to hit up
    if (ball.y < this.y - 80 && ball.x > this.x - 50 && ball.x < this.x + 50) jumpReq = true;

    // Only smash if ball is very high
    if (ball.y < this.y - 150 && Math.abs(ball.x - this.x) < 50) smashReq = true;

    return { moveDir, jumpReq, smashReq };
  }
}

class RushStriker extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#ff0033'); // Red
    this.name = "Rush Striker";
    this.speed = 450; // Very fast
    this.jumpForce = -600;
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;

    // Aggressively chase the ball, even near the net
    if (ball.x > this.x + 10) moveDir = 1;
    else if (ball.x < this.x - 10) moveDir = -1;

    if (ball.y < this.y - 30 && ball.x > this.x - 80 && ball.x < this.x + 80) jumpReq = true;
    if (Math.abs(ball.x - this.x) < 100 && Math.abs(ball.y - this.y) < 100) smashReq = true; // High smash chance

    return { moveDir, jumpReq, smashReq };
  }
}

class TrickSpinAce extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#00ffaa'); // Mint
    this.name = "Trick Spin Ace";
    this.speed = 300;
    this.jumpForce = -650;
    this.trickTimer = 0;
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;

    // Erratic movement
    this.trickTimer += 0.016; // approx dt
    if (Math.sin(this.trickTimer * 5) > 0.5 && ball.x < this.x) {
        moveDir = 1; // Fake out
    } else {
        if (ball.x > this.x + 20) moveDir = 1;
        else if (ball.x < this.x - 20) moveDir = -1;
    }

    if (ball.y < this.y - 50 && ball.x > this.x - 100 && ball.x < this.x + 100) jumpReq = true;

    // Smash randomly when near
    if (Math.abs(ball.x - this.x) < 70 && Math.abs(ball.y - this.y) < 70 && Math.random() > 0.5) smashReq = true;

    return { moveDir, jumpReq, smashReq };
  }
}

class GrandChampion extends PlayerController {
  constructor(x, y) {
    super(x, y, true, '#ffd700'); // Gold
    this.name = "Grand Champion";
    this.speed = 400;
    this.jumpForce = -750;
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;

    // Perfect tracking
    if (ball.x > this.x + 5) moveDir = 1;
    else if (ball.x < this.x - 5) moveDir = -1;

    // Optimal jump and smash
    if (ball.y < this.y - 40 && ball.x > this.x - 60 && ball.x < this.x + 60) jumpReq = true;
    if (Math.abs(ball.x - this.x) < 50 && Math.abs(ball.y - this.y) < 50) smashReq = true;

    return { moveDir, jumpReq, smashReq };
  }
}
