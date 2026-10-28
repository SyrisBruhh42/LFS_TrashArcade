class BaseEnemy {
    constructor(x, y, waypoints, type) {
        this.x = x; this.y = y; this.radius = 14;
        this.waypoints = waypoints;
        this.wpIdx = 0;
        this.speed = 80;
        this.color = '#d33';
        this.viewDist = 150;
        this.viewAngle = Math.PI / 3;
        this.angle = 0;
        this.state = 'patrol';
        this.target = null;
        this.type = type;
        this.attackTimer = 0;
        this.telegraphing = false;
        this.telegraphTimer = 0;
    }

    // Default logic similar to old Guard
    update(dt, player, walls) {
        if (this.state === 'patrol') {
            this.patrolBehavior(dt);
            if (this.canSee(player, walls)) {
                this.state = 'chase';
                this.target = player;
                return true;
            }
            if (player.echo && this.canSee(player.echo, walls)) {
                this.state = 'chase';
                this.target = player.echo;
                return true;
            }
        } else if (this.state === 'chase' && this.target) {
            if (this.target !== player && this.target !== player.echo) {
                this.state = 'patrol';
                this.target = null;
                return false;
            }
            return this.chaseBehavior(dt);
        }
        return false;
    }

    patrolBehavior(dt) {
        const wp = this.waypoints[this.wpIdx];
        if (!wp) return;
        const dx = wp.x - this.x;
        const dy = wp.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) {
            this.wpIdx = (this.wpIdx + 1) % this.waypoints.length;
        } else {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }
    }

    chaseBehavior(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        this.angle = Math.atan2(dy, dx);
        this.x += Math.cos(this.angle) * this.speed * 1.5 * dt;
        this.y += Math.sin(this.angle) * this.speed * 1.5 * dt;

        if (Math.hypot(dx, dy) < this.radius + this.target.radius) {
            if (!this.target.isDashing && this.target.invulnTimer <= 0) {
                return 'caught';
            }
        }
        return false;
    }

    canSee(target, walls) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.viewDist) return false;

        const angleToTarget = Math.atan2(dy, dx);
        let adiff = Math.abs(angleToTarget - this.angle);
        while (adiff > Math.PI) adiff -= Math.PI*2;
        adiff = Math.abs(adiff);

        if (adiff > this.viewAngle/2) return false;

        // Raycast
        for (let w of walls) {
            if (this.lineRectIntersect(this.x, this.y, target.x, target.y, w.x, w.y, w.w, w.h)) return false;
        }
        return true;
    }

    lineRectIntersect(x1, y1, x2, y2, rx, ry, rw, rh) {
        const left = this.lineLine(x1,y1,x2,y2, rx,ry,rx,ry+rh);
        const right = this.lineLine(x1,y1,x2,y2, rx+rw,ry,rx+rw,ry+rh);
        const top = this.lineLine(x1,y1,x2,y2, rx,ry,rx+rw,ry);
        const bottom = this.lineLine(x1,y1,x2,y2, rx,ry+rh,rx+rw,ry+rh);
        return left || right || top || bottom;
    }
    lineLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();

        // View cone
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, this.viewDist, this.angle - this.viewAngle/2, this.angle + this.viewAngle/2);
        ctx.fill();

        this.drawGeometry(ctx);
        if (this.telegraphing) {
            this.drawTelegraph(ctx);
        }
    }

    drawGeometry(ctx) {
        // Base enemy geometry
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI*2);
        ctx.fill();
    }

    drawTelegraph(ctx) {}
}

class Swarmer extends BaseEnemy {
    constructor(x, y, waypoints) {
        super(x, y, waypoints, 'swarmer');
        this.radius = 10;
        this.speed = 100;
        this.color = '#d82';
        this.viewDist = 120;
        this.viewAngle = Math.PI * 0.8;
    }
    drawGeometry(ctx) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(this.angle)*this.radius, this.y + Math.sin(this.angle)*this.radius);
        ctx.lineTo(this.x + Math.cos(this.angle+Math.PI*0.8)*this.radius, this.y + Math.sin(this.angle+Math.PI*0.8)*this.radius);
        ctx.lineTo(this.x + Math.cos(this.angle-Math.PI*0.8)*this.radius, this.y + Math.sin(this.angle-Math.PI*0.8)*this.radius);
        ctx.closePath();
        ctx.stroke();
    }
}

class Sniper extends BaseEnemy {
    constructor(x, y, waypoints) {
        super(x, y, waypoints, 'sniper');
        this.speed = 40;
        this.color = '#38d';
        this.viewDist = 300;
        this.viewAngle = Math.PI / 8;
        this.aimTimer = 0;
    }
    chaseBehavior(dt) {
        this.speed = 0; // stop moving while chasing
        this.telegraphing = true;
        this.aimTimer += dt;

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        this.angle = Math.atan2(dy, dx);

        if (this.aimTimer > 1.5) {
            // fire instantly check
            this.aimTimer = 0;
            if (!this.target.isDashing && this.target.invulnTimer <= 0) {
                // If line of sight still clear
                if (this.canSee(this.target, gameWalls)) {
                     return 'caught';
                }
            }
        }
        return false;
    }
    update(dt, player, walls) {
        window.gameWalls = walls; // dirty hack for sniper inner check
        let res = super.update(dt, player, walls);
        if (this.state !== 'chase') {
            this.telegraphing = false;
            this.aimTimer = 0;
            this.speed = 40;
        }
        return res;
    }
    drawTelegraph(ctx) {
        ctx.strokeStyle = `rgba(255, 50, 50, ${this.aimTimer / 1.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.angle)*this.viewDist, this.y + Math.sin(this.angle)*this.viewDist);
        ctx.stroke();
    }
    drawGeometry(ctx) {
        ctx.fillStyle = '#111';
        ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
    }
}

class Bruiser extends BaseEnemy {
    constructor(x, y, waypoints) {
        super(x, y, waypoints, 'bruiser');
        this.radius = 20;
        this.speed = 50;
        this.color = '#83d';
        this.shieldActive = true;
    }
    chaseBehavior(dt) {
        // Charging logic
        if (this.telegraphing) {
            this.telegraphTimer += dt;
            if (this.telegraphTimer > 1.0) {
                this.telegraphing = false;
                this.chargeDx = Math.cos(this.angle) * 300;
                this.chargeDy = Math.sin(this.angle) * 300;
                this.chargeTimer = 0.5;
            }
            return false;
        }

        if (this.chargeTimer > 0) {
            this.chargeTimer -= dt;
            this.x += this.chargeDx * dt;
            this.y += this.chargeDy * dt;

            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            if (Math.hypot(dx, dy) < this.radius + this.target.radius) {
                if (!this.target.isDashing && this.target.invulnTimer <= 0) {
                    return 'caught';
                }
            }
            return false;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        this.angle = Math.atan2(dy, dx);
        if (Math.hypot(dx, dy) < 100) {
            this.telegraphing = true;
            this.telegraphTimer = 0;
        } else {
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }
        return false;
    }
    update(dt, player, walls) {
        let res = super.update(dt, player, walls);
        if (this.state !== 'chase') {
            this.telegraphing = false;
            this.chargeTimer = 0;
        }
        return res;
    }
    drawTelegraph(ctx) {
        ctx.fillStyle = `rgba(200, 0, 200, ${this.telegraphTimer})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI*2);
        ctx.fill();
    }
    drawGeometry(ctx) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4;
        ctx.strokeRect(this.x - 10, this.y - 10, 20, 20);
    }
}

class Spawner extends BaseEnemy {
    constructor(x, y, waypoints) {
        super(x, y, waypoints, 'spawner');
        this.radius = 16;
        this.speed = 30;
        this.color = '#3d3';
        this.spawnTimer = 0;
    }
    chaseBehavior(dt) {
        // Runs away from player instead of chasing
        const dx = this.x - this.target.x;
        const dy = this.y - this.target.y;
        this.angle = Math.atan2(dy, dx);
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        this.spawnTimer += dt;
        this.telegraphing = this.spawnTimer > 2.0;
        if (this.spawnTimer > 3.0) {
            this.spawnTimer = 0;
            // Spawning handled in main game loop
            return 'spawn_swarmer';
        }
        return false;
    }
    drawTelegraph(ctx) {
        ctx.strokeStyle = `rgba(50, 255, 50, ${(this.spawnTimer-2.0)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 10 + Math.sin(this.spawnTimer*10)*5, 0, Math.PI*2);
        ctx.stroke();
    }
    drawGeometry(ctx) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 10);
        ctx.lineTo(this.x + 10, this.y + 5);
        ctx.lineTo(this.x - 10, this.y + 5);
        ctx.fill();
    }
}

class HazardEnemy extends BaseEnemy {
    constructor(x, y, waypoints) {
        super(x, y, waypoints, 'hazard');
        this.radius = 14;
        this.speed = 60;
        this.color = '#d38';
        this.hazardTimer = 0;
        this.hazardRadius = 60;
    }
    chaseBehavior(dt) {
        this.hazardTimer += dt;
        this.telegraphing = true;

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        this.angle = Math.atan2(dy, dx);

        // Move closer but stop at hazard radius
        if (Math.hypot(dx, dy) > this.hazardRadius - 10) {
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }

        if (this.hazardTimer > 2.0) {
            this.hazardTimer = 0;
            if (Math.hypot(dx, dy) < this.hazardRadius) {
                if (!this.target.isDashing && this.target.invulnTimer <= 0) {
                    return 'caught';
                }
            }
        }
        return false;
    }
    update(dt, player, walls) {
        let res = super.update(dt, player, walls);
        if (this.state !== 'chase') {
            this.telegraphing = false;
            this.hazardTimer = 0;
        }
        return res;
    }
    drawTelegraph(ctx) {
        ctx.fillStyle = `rgba(255, 100, 0, ${this.hazardTimer / 4.0})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.hazardRadius, 0, Math.PI*2);
        ctx.fill();

        if (this.hazardTimer > 1.8) {
            ctx.strokeStyle = '#f00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.hazardRadius, 0, Math.PI*2);
            ctx.stroke();
        }
    }
    drawGeometry(ctx) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        for(let i=0; i<6; i++) {
            let a = i * Math.PI / 3;
            ctx.lineTo(this.x + Math.cos(a)*8, this.y + Math.sin(a)*8);
        }
        ctx.fill();
    }
}
