with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "r") as f:
    game_js = f.read()

game_js = game_js.replace("""        } else if (this.state === 'PLAYING') {
            this.buttons = [
                const offset = (this.saveManager.data.options && this.saveManager.data.options.leftHand) ? 580 : 0;
            this.buttons = [""", """        } else if (this.state === 'PLAYING') {
            const offset = (this.saveManager.data.options && this.saveManager.data.options.leftHand) ? 580 : 0;
            this.buttons = [""")

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "w") as f:
    f.write(game_js)
