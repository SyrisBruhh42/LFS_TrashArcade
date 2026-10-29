with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "r") as f:
    game_js = f.read()

# Replace constructor init
game_js = game_js.replace("if (typeof VFXManager !== 'undefined') this.vfx = new VFXManager(this);", "if (typeof VFXManager !== 'undefined') this.vfx = new VFXManager(this);\n        if (typeof CampaignManager !== 'undefined') this.campaign = new CampaignManager(this);")

# Replace loop update
game_js = game_js.replace("if (this.vfx) this.vfx.update(dt);", "if (this.vfx) this.vfx.update(dt);\n        if (this.campaign) this.campaign.update(dt);")

# Replace draw update
game_js = game_js.replace("if (this.vfx) this.vfx.draw(this.ctx);", "if (this.vfx) this.vfx.draw(this.ctx);\n        if (this.campaign) this.campaign.draw(this.ctx);")

# Replace button location logic for lefthand touch mode
game_js = game_js.replace("{ x: 100, y: 200, w: 120, h: 60, text: 'Study', onClick: () => this.doAction('study') },", "const offset = (this.saveManager.data.options && this.saveManager.data.options.leftHand) ? 580 : 0;\n            this.buttons = [\n                { x: 100 + offset, y: 200, w: 120, h: 60, text: 'Study', onClick: () => this.doAction('study') },")
game_js = game_js.replace("{ x: 100, y: 280, w: 120, h: 60, text: 'Work', onClick: () => this.doAction('work') },", "{ x: 100 + offset, y: 280, w: 120, h: 60, text: 'Work', onClick: () => this.doAction('work') },")
game_js = game_js.replace("{ x: 100, y: 360, w: 120, h: 60, text: 'Practice', onClick: () => this.doAction('practice') },", "{ x: 100 + offset, y: 360, w: 120, h: 60, text: 'Practice', onClick: () => this.doAction('practice') },")
game_js = game_js.replace("{ x: 100, y: 440, w: 120, h: 60, text: 'Explore', onClick: () => this.doAction('explore') },", "{ x: 100 + offset, y: 440, w: 120, h: 60, text: 'Explore', onClick: () => this.doAction('explore') },")
game_js = game_js.replace("{ x: 100, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },\n                { x: 680, y: 20, w: 100, h: 40, text: 'Menu', onClick: () => this.pause() }", "{ x: 100 + offset, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },\n                { x: 680 - offset, y: 20, w: 100, h: 40, text: 'Menu', onClick: () => this.pause() }")
game_js = game_js.replace("this.buttons = [\n                { x: 100, y: 200", "")

# Replace UI
game_js = game_js.replace("document.getElementById('vol-sfx').addEventListener('input', e => { this.saveManager.data.options.sfxVol = parseFloat(e.target.value); updateOpt(); });", "document.getElementById('vol-sfx').addEventListener('input', e => { this.saveManager.data.options.sfxVol = parseFloat(e.target.value); updateOpt(); });\n        if(document.getElementById('toggle-mute')) document.getElementById('toggle-mute').addEventListener('change', e => { this.saveManager.data.options.mute = e.target.checked; updateOpt(); });")
game_js = game_js.replace("this.sound.setVolumes(opt.masterVol, opt.sfxVol, opt.musicVol);", "if (opt.mute) this.sound.setVolumes(0, 0, 0);\n        else this.sound.setVolumes(opt.masterVol, opt.sfxVol, opt.musicVol);")
# add milestone tab logic
game_js = game_js.replace("this.buttons.push({ x: 680, y: 70, w: 100, h: 40, text: 'Boutique', onClick: () => { this.state = 'SHOP'; this.sound.playConfirm(); } });", "this.buttons.push({ x: 680 - offset, y: 70, w: 100, h: 40, text: 'Boutique', onClick: () => { this.state = 'SHOP'; this.sound.playConfirm(); } });")

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "w") as f:
    f.write(game_js)
