import json
with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.json", "r") as f:
    d = json.load(f)

d["phase"] = "9"

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.json", "w") as f:
    json.dump(d, f, indent=2)
