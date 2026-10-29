with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "r") as f:
    game_js = f.read()

# Add code to update milestone HTML
game_js = game_js.replace("document.getElementById('options-modal').classList.add('active');", "document.getElementById('options-modal').classList.add('active');\n                if (this.campaign) this.campaign.populateHTML();")

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "w") as f:
    f.write(game_js)
