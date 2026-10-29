html_path = "games/087-tokyo-high-school-rooftop-sakura-courtyard-d/index.html"
with open(html_path, "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines[120:170]):
    print(f"{i+120}: {line}", end='')
