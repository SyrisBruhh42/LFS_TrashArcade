I have prepared an execution plan to implement the Phase 4 upgrade for "Magnetic Sky Duel".

The task requires expanding the enemy variety to at least 5 distinct enemy archetypes, each with unique procedural vector geometry, pre-attack telegraphs, and distinct AI behaviors.

My proposed plan is:
1.  **Add `enemies.js` to the Game**
    -   Create a new file `games/074-magnetic-sky-duel/enemies.js`.
    -   Include a base `Enemy` class extending `Entity`.
    -   Implement 5 distinct subclasses (`SwarmerEnemy`, `SniperEnemy`, `ShieldedEnemy`, `SpawnerEnemy`, `HazardEnemy`).
    -   Each subclass will have unique `update` logic (AI movement and shooting/spawning mechanics) and `draw` logic using `VectorRenderer` or direct `ctx` commands for procedural geometry and visual telegraphs (e.g. aiming lines, glowing circles).
2.  **Update `index.html` to Load `enemies.js`**
    -   Use `replace_with_git_merge_diff` to add `<script defer src="./enemies.js"></script>` before `game.js`.
3.  **Integrate Enemies into `game.js`**
    -   Update `Game.reset()` to initialize `this.enemies = []` and `this.enemySpawnTimer = 0`.
    -   Add a `spawnEnemy(enemy)` method to `Game`.
    -   Update `Game.update(dt)` to handle spawning enemies periodically based on `this.wave`.
    -   Update `Game.update(dt)` to loop over `this.enemies`, call their `update()` methods, handle collisions between enemy hitboxes and bullets (damaging enemies, similar to Boss logic), and handle collisions between enemies and the player (damaging the player).
    -   Update `Game.draw()` to render all active enemies.
    -   Modify `Game.bullets.forEach` collision check to also hit regular enemies, not just the Boss.
4.  **Update Manifest**
    -   Use `replace_with_git_merge_diff` to advance `phase` from `"3"` to `"4"` in `game.json`.
5.  **Test and Verify**
    -   Run tests and preflight checks.

Does this plan cover all requirements accurately?
