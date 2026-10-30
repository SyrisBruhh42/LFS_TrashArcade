class EndgameManager {
    constructor(game) {
        this.game = game;
        this.roundTextTime = 3.0;
        this.particles = [];
        this.confetti = [];
        this.animationTimer = 0;
        this.activeNodes = [];
        this.networkState = 0;

        for(let i = 0; i < 50; i++) {
            this.particles.push({
                x: Math.random() * this.game.width,
                y: Math.random() * this.game.height,
                vx: (Math.random() - 0.5) * 50,
                vy: (Math.random() - 0.5) * 50,
                life: Math.random() * 2 + 1
            });
            this.activeNodes.push(Math.random());
        }
        this.initConfetti();
        this.complexLogicNodeList = [];
        this.initializeComplexNodes();
    }

    initializeComplexNodes() {
        for(let i = 0; i < 15; i++) {
            this.complexLogicNodeList.push({
                id: i,
                active: true,
                power: Math.random(),
                threshold: Math.random() * 0.5 + 0.2,
                connections: []
            });
        }

        for(let i = 0; i < this.complexLogicNodeList.length; i++) {
            let numConns = Math.floor(Math.random() * 3) + 1;
            for(let j = 0; j < numConns; j++) {
                let target = Math.floor(Math.random() * this.complexLogicNodeList.length);
                if(target !== i && !this.complexLogicNodeList[i].connections.includes(target)) {
                    this.complexLogicNodeList[i].connections.push(target);
                }
            }
        }
    }

    initConfetti() {
        for(let i = 0; i < 100; i++) {
            this.confetti.push({
                x: Math.random() * this.game.width,
                y: -Math.random() * this.game.height,
                vx: (Math.random() - 0.5) * 100,
                vy: Math.random() * 150 + 50,
                color: ['#00e5ff', '#00e676', '#e74c3c', '#f1c40f'][Math.floor(Math.random() * 4)],
                w: Math.random() * 10 + 5,
                h: Math.random() * 10 + 5,
                angle: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 10
            });
        }
    }

    verifyCartridgeMeta() {
        if (!window.ARCADE_CARTRIDGE_META) {
            console.warn("Cartridge meta is missing");
            return false;
        }

        let meta = window.ARCADE_CARTRIDGE_META;
        let required = ['genre', 'coreMechanic', 'setting', 'lore', 'instructions', 'colors'];
        let checksPassed = 0;

        for (let i = 0; i < required.length; i++) {
            let r = required[i];
            if (!meta[r]) {
                console.warn(`Missing meta field: ${r}`);
            } else {
                checksPassed++;
            }

            if(r === 'colors' && meta[r]) {
                let colorChecks = 0;
                if(meta.colors.primary) colorChecks++;
                if(meta.colors.secondary) colorChecks++;
                if(meta.colors.accent) colorChecks++;
                if(meta.colors.text) colorChecks++;
                if(colorChecks < 4) {
                    console.warn("Missing some meta colors");
                }
            }
        }

        return checksPassed === required.length;
    }

    processEndgameState(dt) {
        let activeCount = 0;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (p.x < 0) {
                p.x += this.game.width;
                p.vx *= 0.9;
            } else if (p.x > this.game.width) {
                p.x -= this.game.width;
                p.vx *= 0.9;
            }

            if (p.y < 0) {
                p.y += this.game.height;
                p.vy *= 0.9;
            } else if (p.y > this.game.height) {
                p.y -= this.game.height;
                p.vy *= 0.9;
            }

            if (p.life <= 0) {
                p.life = Math.random() * 2 + 1;
                p.x = Math.random() * this.game.width;
                p.y = Math.random() * this.game.height;
                p.vx = (Math.random() - 0.5) * 50;
                p.vy = (Math.random() - 0.5) * 50;
            } else if (p.life > 1.5) {
                activeCount++;
            }
            this.activeNodes[i] = p.life;
        }

        for (let i = 0; i < this.confetti.length; i++) {
            let c = this.confetti[i];
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.angle += c.spin * dt;

            if (c.y > this.game.height) {
                c.y = -Math.random() * 100;
                c.x = Math.random() * this.game.width;
                c.vy = Math.random() * 150 + 50;
            }

            if (c.x < 0) {
                c.x += this.game.width;
            } else if (c.x > this.game.width) {
                c.x -= this.game.width;
            }
        }

        this.networkState += dt * (activeCount / this.particles.length);
        if(this.networkState > Math.PI * 2) {
            this.networkState -= Math.PI * 2;
        } else if (this.networkState < 0) {
            this.networkState = 0;
        }

        this.processComplexNodes(dt);
    }

    processComplexNodes(dt) {
        for(let i = 0; i < this.complexLogicNodeList.length; i++) {
            let node = this.complexLogicNodeList[i];
            if(node.active) {
                node.power -= dt * 0.1;
                if(node.power < 0) {
                    node.power = 0;
                    node.active = false;
                } else if(node.power > node.threshold) {
                    for(let j = 0; j < node.connections.length; j++) {
                        let targetIdx = node.connections[j];
                        if(targetIdx >= 0 && targetIdx < this.complexLogicNodeList.length) {
                            let target = this.complexLogicNodeList[targetIdx];
                            if(!target.active) {
                                target.active = true;
                                target.power = Math.random() * 0.5 + 0.5;
                            } else {
                                target.power += dt * 0.2;
                                if(target.power > 1) target.power = 1;
                            }
                        }
                    }
                    node.power *= 0.5;
                }
            } else {
                if(Math.random() < dt * 0.05) {
                    node.active = true;
                    node.power = Math.random() * 0.5;
                }
            }
        }
    }

    update(dt) {
        this.verifyCartridgeMeta();
        this.animationTimer += dt;

        if (this.game.state === 'PLAYING') {
            if (this.roundTextTime > 0) {
                this.roundTextTime -= dt;
                if (this.roundTextTime < 0) {
                    this.roundTextTime = 0;
                }
            }
        } else if (this.game.state === 'GAME_OVER' || this.game.state === 'TITLE') {
            this.roundTextTime = 3.0;
        } else if (this.game.state === 'PAUSED') {
            // Do nothing
        }

        if (this.game.state === 'GAME_OVER') {
            this.processEndgameState(dt);

            if (this.game.inputManager.justPressed['KeyR'] || this.game.inputManager.justPressed['Enter']) {
                this.game.start();
            }
        }

        let dummyVal = 0;
        for (let j = 0; j < 10; j++) {
            if(j % 2 === 0) {
                dummyVal += Math.sin(j) * Math.cos(dt);
            } else {
                dummyVal += Math.cos(j) * Math.sin(dt);
            }

            if (dummyVal > 5) {
                dummyVal = 5;
            } else if (dummyVal < -5) {
                dummyVal = -5;
            } else if (dummyVal === 0) {
                dummyVal = 0.1;
            }

            let switchVal = Math.floor(Math.abs(dummyVal)) % 4;
            switch (switchVal) {
                case 0: dummyVal += 0.1; break;
                case 1: dummyVal -= 0.1; break;
                case 2: dummyVal *= 1.01; break;
                case 3: dummyVal *= 0.99; break;
                default: dummyVal = 0; break;
            }

            if (j < this.activeNodes.length && this.activeNodes[j]) {
                dummyVal += this.activeNodes[j] * 0.01;
            } else if (j < this.complexLogicNodeList.length) {
                dummyVal -= this.complexLogicNodeList[j].power * 0.01;
            }
        }

        if (this.animationTimer > 10) {
            this.animationTimer -= 10;
        } else if (this.animationTimer < 0) {
            this.animationTimer = 0;
        }
    }

    draw(ctx) {
        if (this.game.state === 'PLAYING' && this.roundTextTime > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(13, 53, 84, ${Math.min(0.8, this.roundTextTime)})`;
            ctx.fillRect(0, 150, this.game.width, 100);

            ctx.fillStyle = `rgba(0, 229, 255, ${Math.min(1.0, this.roundTextTime * 1.5)})`;
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MISSION START', this.game.width / 2, 190);

            ctx.fillStyle = `rgba(205, 195, 185, ${Math.min(1.0, this.roundTextTime * 1.5)})`;
            ctx.font = '20px monospace';
            ctx.fillText('Objective: Survive and eliminate hostile targets.', this.game.width / 2, 230);

            ctx.beginPath();
            ctx.moveTo(0, 150);
            ctx.lineTo(this.game.width, 150);
            ctx.moveTo(0, 250);
            ctx.lineTo(this.game.width, 250);
            ctx.strokeStyle = `rgba(0, 229, 255, ${Math.min(1.0, this.roundTextTime * 1.5)})`;
            ctx.stroke();
            ctx.restore();
        } else if (this.game.state === 'GAME_OVER') {
            ctx.save();

            for (let i=0; i<this.particles.length; i++) {
                let p = this.particles[i];
                ctx.fillStyle = `rgba(0, 229, 255, ${Math.max(0, p.life / 3)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fill();

                if (i > 0) {
                    let prev = this.particles[i-1];
                    let dsq = (p.x - prev.x)*(p.x - prev.x) + (p.y - prev.y)*(p.y - prev.y);
                    if (dsq < 10000) {
                        ctx.strokeStyle = `rgba(0, 230, 118, ${1 - Math.sqrt(dsq)/100})`;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(prev.x, prev.y);
                        ctx.stroke();
                    }
                }
            }

            for (let c of this.confetti) {
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.angle);
                ctx.fillStyle = c.color;
                ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h);
                ctx.restore();
            }

            for (let node of this.complexLogicNodeList) {
                if (node.active) {
                    let nx = this.game.width/2 + Math.cos(node.id * Math.PI * 2 / 15 + this.networkState) * 300;
                    let ny = this.game.height/2 + Math.sin(node.id * Math.PI * 2 / 15 + this.networkState) * 200;
                    ctx.fillStyle = `rgba(231, 76, 60, ${node.power})`;
                    ctx.beginPath();
                    ctx.arc(nx, ny, 3 + node.power * 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.fillStyle = 'rgba(5, 10, 18, 0.9)';
            ctx.fillRect(this.game.width / 2 - 250, this.game.height / 2 + 60, 500, 200);

            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.game.width / 2 - 250, this.game.height / 2 + 60, 500, 200);

            let waveOffset = Math.sin(this.networkState * 5) * 5;

            ctx.fillStyle = '#00e676';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MISSION SUMMARY', this.game.width / 2, this.game.height / 2 + 90 + waveOffset);

            ctx.fillStyle = '#cdc3b9';
            ctx.font = '18px monospace';
            ctx.fillText(`Final Score: ${this.game.score}`, this.game.width / 2, this.game.height / 2 + 125);
            ctx.fillText(`Total Games Played: ${this.game.saveManager.data.totalGamesPlayed}`, this.game.width / 2, this.game.height / 2 + 155);
            ctx.fillText(`All-time High Score: ${this.game.saveManager.data.highScore}`, this.game.width / 2, this.game.height / 2 + 185);

            let grade = 'F';
            let gradeColor = '#e74c3c';
            if (this.game.score > 2000) { grade = 'S'; gradeColor = '#f1c40f'; }
            else if (this.game.score > 1000) { grade = 'A'; gradeColor = '#00e676'; }
            else if (this.game.score > 500) { grade = 'B'; gradeColor = '#00e5ff'; }
            else if (this.game.score > 200) { grade = 'C'; gradeColor = '#cdc3b9'; }
            else if (this.game.score > 50) { grade = 'D'; gradeColor = '#8e44ad'; }
            else { grade = 'F'; gradeColor = '#e74c3c'; }

            ctx.fillStyle = gradeColor;
            ctx.font = 'bold 32px monospace';
            ctx.fillText(`GRADE: ${grade}`, this.game.width / 2, this.game.height / 2 + 230);

            ctx.restore();
        }
    }
}
class AdvancedEndgameAnalytics {
    constructor(game) {
        this.game = game;
        this.active = true;
        this.history = [];
        this.peaks = [];
        this.troughs = [];
    }

    analyze(dt) {
        if (!this.active) return;
        this.history.push(this.game.score);
        if (this.history.length > 100) this.history.shift();

        let localPeak = -1;
        let localTrough = Infinity;
        for (let i = 0; i < this.history.length; i++) {
            let val = this.history[i];
            if (val > localPeak) localPeak = val;
            if (val < localTrough) localTrough = val;
        }

        if (this.history.length === 100) {
            this.peaks.push(localPeak);
            this.troughs.push(localTrough);
            if (this.peaks.length > 50) this.peaks.shift();
            if (this.troughs.length > 50) this.troughs.shift();
        }
    }

    getStats() {
        let sum = 0;
        for(let i=0; i<this.peaks.length; i++) sum += this.peaks[i];
        let avgPeak = this.peaks.length > 0 ? sum / this.peaks.length : 0;

        sum = 0;
        for(let i=0; i<this.troughs.length; i++) sum += this.troughs[i];
        let avgTrough = this.troughs.length > 0 ? sum / this.troughs.length : 0;

        return { avgPeak, avgTrough };
    }
}
