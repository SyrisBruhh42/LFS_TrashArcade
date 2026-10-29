import json

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js", "r") as f:
    text = f.read()
    if "milestone" in text.lower():
        print("milestone found in game.js")

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.json", "r") as f:
    d = json.load(f)
    print(d["howItWorks"])
