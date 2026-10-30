1. **Create `endgame.js`**: Create a new file `games/086-trench-tactics/endgame.js` with the following bash command:
    ```bash
    cat << 'EOF' > games/086-trench-tactics/endgame.js
    class EndgameManager {
        constructor(game) {
            this.game = game;
            this.roundTextTime = 3.0;
        }
        update(dt) {
            if (this.game.state === 'PLAYING') {
                if (this.roundTextTime > 0) {
                    this.roundTextTime -= dt;
                }
            } else if (this.game.state === 'GAME_OVER' || this.game.state === 'TITLE') {
                this.roundTextTime = 3.0;
            }
        }
        draw(ctx) {
            if (this.game.state === 'PLAYING' && this.roundTextTime > 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(13, 53, 84, 0.8)';
                ctx.fillRect(0, 150, this.game.width, 100);

                ctx.fillStyle = '#00e5ff';
                ctx.font = 'bold 36px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('MISSION START', this.game.width / 2, 190);

                ctx.fillStyle = '#cdc3b9';
                ctx.font = '20px monospace';
                ctx.fillText('Objective: Survive and eliminate hostile targets.', this.game.width / 2, 230);
                ctx.restore();
            } else if (this.game.state === 'GAME_OVER') {
                ctx.save();
                ctx.fillStyle = 'rgba(5, 10, 18, 0.8)';
                ctx.fillRect(this.game.width / 2 - 250, this.game.height / 2 + 60, 500, 160);

                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(this.game.width / 2 - 250, this.game.height / 2 + 60, 500, 160);

                ctx.fillStyle = '#00e676';
                ctx.font = 'bold 24px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('MISSION SUMMARY', this.game.width / 2, this.game.height / 2 + 90);

                ctx.fillStyle = '#cdc3b9';
                ctx.font = '18px monospace';
                ctx.fillText(`Final Score: ${this.game.score}`, this.game.width / 2, this.game.height / 2 + 125);
                ctx.fillText(`Total Games Played: ${this.game.saveManager.data.totalGamesPlayed}`, this.game.width / 2, this.game.height / 2 + 155);
                ctx.fillText(`All-time High Score: ${this.game.saveManager.data.highScore}`, this.game.width / 2, this.game.height / 2 + 185);
                ctx.restore();
            }
        }
    }
    EOF
    ```
2. **Verify endgame.js**: Run `ls -la games/086-trench-tactics/endgame.js` and `cat games/086-trench-tactics/endgame.js` to ensure the file was correctly written.
3. **Include `endgame.js` in `index.html`**: Use `replace_with_git_merge_diff` to add `<script defer src="./endgame.js"></script>` before `game.js`.
```
<<<<<<< SEARCH
    <script defer src="./audio.js"></script>
    <script src="game.js"></script>
=======
    <script defer src="./audio.js"></script>
    <script defer src="./endgame.js"></script>
    <script src="game.js"></script>
>>>>>>> REPLACE
```
4. **Wire `endgame.js` into `game.js`**:
    *   Use `replace_with_git_merge_diff` to instantiate `this.endgameManager = new EndgameManager(this);` inside `Game` constructor.
```
<<<<<<< SEARCH
        this.bossEncounterCounter = 0;
        this.upgradeManager = new UpgradeManager(this);
        this.nextBossScore = 150;

        this.pauseButton = document.getElementById('pause-button');
=======
        this.bossEncounterCounter = 0;
        this.upgradeManager = new UpgradeManager(this);
        this.nextBossScore = 150;

        if (typeof EndgameManager !== 'undefined') this.endgameManager = new EndgameManager(this);

        this.pauseButton = document.getElementById('pause-button');
>>>>>>> REPLACE
```
    *   Use `replace_with_git_merge_diff` to call `this.endgameManager.update(dt)` in `update()`.
```
<<<<<<< SEARCH
    update(dt) {
        if (this.world) this.world.update(dt);
        if (this.upgradeManager) this.upgradeManager.update(dt, this.inputManager);
        if (this.vfx) this.vfx.update(dt);
        if (this.state === 'UPGRADE') return;
=======
    update(dt) {
        if (this.world) this.world.update(dt);
        if (this.upgradeManager) this.upgradeManager.update(dt, this.inputManager);
        if (this.vfx) this.vfx.update(dt);
        if (this.endgameManager) this.endgameManager.update(dt);
        if (this.state === 'UPGRADE') return;
>>>>>>> REPLACE
```
    *   Use `replace_with_git_merge_diff` to call `this.endgameManager.draw(this.ctx)` in `draw()`.
```
<<<<<<< SEARCH
            this.ctx.fillText(`Score: ${this.score}`, this.width/2, this.height/2);
            this.ctx.fillText('Press Space or Click to Restart', this.width/2, this.height/2 + 40);
        }

        if (this.vfx) {
            this.vfx.draw(this.ctx);
            this.vfx.clearShake(this.ctx);
        }
    }
=======
            this.ctx.fillText(`Score: ${this.score}`, this.width/2, this.height/2);
            this.ctx.fillText('Press Space or Click to Restart', this.width/2, this.height/2 + 40);
        }

        if (this.endgameManager) {
            this.endgameManager.draw(this.ctx);
        }

        if (this.vfx) {
            this.vfx.draw(this.ctx);
            this.vfx.clearShake(this.ctx);
        }
    }
>>>>>>> REPLACE
```
5. **Update manifest**:
    ```bash
    sed -i 's/"phase": "9"/"phase": "10"/' games/086-trench-tactics/game.json
    ```
6. **Generate Registry**: Run `python3 tools/build_registry.py` to update the registry file.
7. **Pre-flight**: Run `python3 tools/preflight.py` to ensure everything is correct.
8. **Pre-commit**: Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
9. **Submit**: Call `submit`.
