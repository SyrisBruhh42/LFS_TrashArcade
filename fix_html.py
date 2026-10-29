with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/index.html", "r") as f:
    html = f.read()

# Replace scripts
html = html.replace("<script defer src=\"controls.js\"></script>", "<script defer src=\"campaign.js\"></script>\n    <script defer src=\"controls.js\"></script>")

# Replace tabs
html = html.replace("<button class=\"tab-btn active\" type=\"button\" onclick=\"switchTab('audio')\">Audio & Comfort</button>", "<button class=\"tab-btn active\" type=\"button\" onclick=\"switchTab('audio', event)\">Audio & Comfort</button>")
html = html.replace("<button class=\"tab-btn\" type=\"button\" onclick=\"switchTab('controls')\">Controls</button>", "<button class=\"tab-btn\" type=\"button\" onclick=\"switchTab('controls', event)\">Controls</button>\n                    <button class=\"tab-btn\" type=\"button\" onclick=\"switchTab('milestones', event)\">Milestones</button>")
html = html.replace("function switchTab(tabId) {", "function switchTab(tabId, event) {")

# Add Mute toggle
html = html.replace("<div class=\"controls-row\">\n                        <span>High-Contrast Mode</span>", "<div class=\"controls-row\">\n                        <span>Mute All</span>\n                        <input type=\"checkbox\" id=\"toggle-mute\">\n                    </div>\n                    <div class=\"controls-row\">\n                        <span>High-Contrast Mode</span>")

# Add Milestones tab
html = html.replace("<div id=\"tab-controls\" class=\"tab-content\">", "<div id=\"tab-milestones\" class=\"tab-content\">\n                    <div id=\"milestones-list\"></div>\n                </div>\n                <div id=\"tab-controls\" class=\"tab-content\">")

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/index.html", "w") as f:
    f.write(html)
