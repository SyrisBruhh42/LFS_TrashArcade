class WorldEnvironment {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.bgStars = [];
    for(let i=0; i<50; i++) {
      this.bgStars.push({
        x: Math.random() * width,
        y: Math.random() * (height - 150),
        size: Math.random() * 2 + 1,
        blink: Math.random() * Math.PI * 2,
        speed: Math.random() * 2 + 1
      });
    }

    this.speakers = [
      { x: 100, y: 150, r: 40, pulse: 0, color: '#00e5ff' },
      { x: width - 100, y: 150, r: 40, pulse: 0, color: '#ff4081' }
    ];
  }

  update(dt, ball, audio) {
    for(let star of this.bgStars) {
      star.blink += dt * star.speed;
    }

    for(let spk of this.speakers) {
      if (spk.pulse > 0) spk.pulse -= dt * 2;

      let dx = ball.x - spk.x;
      let dy = ball.y - spk.y;
      let distSq = dx*dx + dy*dy;
      let radSum = spk.r + ball.radius;

      if (distSq < radSum * radSum) {
        let dist = Math.sqrt(distSq);
        let overlap = radSum - dist;
        if (dist > 0) {
          ball.x += (dx / dist) * overlap;
          ball.y += (dy / dist) * overlap;
        }
        ball.vx = (dx / dist) * 600;
        ball.vy = (dy / dist) * 600;
        spk.pulse = 1;
        audio.playPowerup();
      }
    }
  }

  draw(ctx) {
    let grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#1b162a');
    grad.addColorStop(1, '#2c2247');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#fff';
    for(let star of this.bgStars) {
      ctx.globalAlpha = 0.5 + Math.sin(star.blink) * 0.5;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = '#443366';
    ctx.lineWidth = 4;
    for(let i=0; i<this.width; i+=100) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 50, this.height - 150); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + 100, 0); ctx.lineTo(i + 50, this.height - 150); ctx.stroke();
    }

    for(let spk of this.speakers) {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(spk.x, spk.y, spk.r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.stroke();

      let innerPulse = spk.r * 0.5 + (Math.max(0, spk.pulse) * 10);
      ctx.fillStyle = spk.color;
      ctx.beginPath(); ctx.arc(spk.x, spk.y, innerPulse, 0, Math.PI*2); ctx.fill();

      if (spk.pulse > 0) {
        ctx.strokeStyle = spk.color; ctx.globalAlpha = spk.pulse; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(spk.x, spk.y, spk.r + 10 + (1 - spk.pulse)*20, 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    ctx.fillStyle = '#0a4d3c'; ctx.fillRect(0, this.height - 150, this.width, 150);
    ctx.fillStyle = '#0c5c48';
    for(let i=0; i<this.width; i+=40) ctx.fillRect(i, this.height - 150, 20, 150);
    ctx.fillStyle = '#00e5ff'; ctx.fillRect(0, this.height - 150, this.width, 5);
  }
}
